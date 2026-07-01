import { useEffect, useRef } from 'react';
// Legacy LanAuth import removed
import { useAuth } from '../../context/AuthContext';

/**
 * DeviceListOnlineStatus
 *
 * Fetches all device statuses in one call (LAN or WAN based on selectedOption),
 * and returns a map: { [device_id]: boolean } via onStatuses.
 *
 * LAN body:
 * {
 *   "command": "get_device_list",
 *   "id": "<requestId>",
 *   "param": {}
 * }
 *
 * WAN body:
 * {
 *   "command": "get_device_list",
 *   "id": "<requestId>",
 *   "param": { "residence_id": "<residenceId>" }
 * }
 */
export default function DeviceListOnlineStatus({
  selectedOption = 'LAN',
  pollingInterval = 30000,

  // Endpoints
  wanBackendUrl = 'https://one-development.soniciot.com/device_status/',
  lanUrl = 'http://192.168.2.115/api/v1.0/device',

  // Payload values
  requestId = 'c45e846ca23ab42c9ae469d988ae32a96',
  //onsite - residenceId = 'r45844047053e43d78fe5272c5badbd3a',
  residenceId = 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',

  // Callbacks
  onStatuses = () => {},
  onLoadingChange = () => {},
}) {
  const { getActiveLanToken, getActiveWanToken } = useAuth();
  const intervalRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function fetchAllStatuses() {
      if (!mounted) return;
      onLoadingChange(true);

      const lanBody = {
        command: 'get_device_list',
        id: requestId,
        param: {},
      };
      const wanBody = {
        command: 'get_device_list',
        id: requestId,
        param: { residence_id: residenceId, show_ability: true },
      };

      try {
        if (selectedOption === 'WAN') {
          const activeToken = await getActiveWanToken();
          const res = await fetch(wanBackendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${activeToken}`
            },
            body: JSON.stringify(wanBody),
            signal: controller.signal,
          });

          if (!res.ok) {
            console.warn('[DeviceListOnlineStatus] WAN non-2xx', {
              status: res.status,
              url: wanBackendUrl,
            });
            if (mounted) onStatuses({});
            return;
          }

          const json = await res.json();
          const map = buildWanStatusMap(json);
          if (mounted) onStatuses(map);
          return;
        }

        // LAN path
        const activeToken = await getActiveLanToken();
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        };

        if (!headers.Authorization) {
          console.warn('[DeviceListOnlineStatus] No Authorization; LAN offline map.');
          if (mounted) onStatuses({});
          return;
        }

        const timeoutMs = 7000;
        const timeoutPromise = new Promise((_, reject) => {
          const id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error('timeout'));
          }, timeoutMs);
        });

        const fetchPromise = fetch(lanUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(lanBody),
          signal: controller.signal,
        });

        const res = await Promise.race([fetchPromise, timeoutPromise]);

        if (!res.ok) {
          let bodyText = '';
          try {
            bodyText = await res.text();
          } catch (_) {}
          console.warn('[DeviceListOnlineStatus] LAN non-2xx', {
            status: res.status,
            statusText: res.statusText,
            url: lanUrl,
            body: bodyText,
          });
          if (mounted) onStatuses({});
          return;
        }

        const json = await res.json();
        const map = buildLanStatusMap(json);
        if (mounted) onStatuses(map);
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[DeviceListOnlineStatus] fetch aborted');
        } else if (err.message === 'timeout') {
          console.warn('[DeviceListOnlineStatus] LAN timeout', { url: lanUrl });
        } else {
          console.warn('[DeviceListOnlineStatus] fetch error', err);
        }
        if (mounted) onStatuses({});
      } finally {
        if (mounted) onLoadingChange(false);
      }
    }

    // Initial fetch + polling
    fetchAllStatuses();
    if (pollingInterval > 0) {
      intervalRef.current = setInterval(fetchAllStatuses, pollingInterval);
    }

    return () => {
      mounted = false;
      controller.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedOption, pollingInterval, wanBackendUrl, lanUrl, requestId, residenceId]);

  return null;
}

/**
 * WAN summary: { result: [ { device_id, online, ... }, ... ] } or { result: { devices: [ ... ] } }
 */
function buildWanStatusMap(json) {
  const map = {};
  if (!json || !json.result) return map;

  // Accurately intercept the new augmented return structures!
  const rawArray = Array.isArray(json.result) 
    ? json.result 
    : (Array.isArray(json.result.devices) ? json.result.devices : [json.result]);

  for (const device of rawArray) {
    if (!device) continue;
    const normalizedName = normalizeDeviceName(device.device_name || device.product_name);
    if (device.device_id) {
      map[device.device_id] = !!device.online;
    }
    if (normalizedName) {
      map[`name:${normalizedName}`] = !!device.online;
    }
    if (Array.isArray(device.sub_devices)) {
      for (const sub of device.sub_devices) {
        if (!sub || !sub.device_id) continue;
        map[sub.device_id] = !!sub.online;
        const normalizedSubName = normalizeDeviceName(sub.device_name || sub.product_name);
        if (normalizedSubName) {
          map[`name:${normalizedSubName}`] = !!sub.online;
        }
      }
    }
  }
  return map;
}

function normalizeDeviceName(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * LAN report: { result: [ { device_id, online, sub_devices: [...] }, ... ] }
 * Include panels and sub_devices by device_id only.
 */
function buildLanStatusMap(json) {
  const map = {};
  if (!json || !Array.isArray(json.result)) return map;

  for (const device of json.result) {
    if (!device) continue;
    if (device.device_id) {
      map[device.device_id] = !!device.online;
    }
    if (Array.isArray(device.sub_devices)) {
      for (const sub of device.sub_devices) {
        if (!sub || !sub.device_id) continue;
        map[sub.device_id] = !!sub.online;
      }
    }
  }

  return map;
}