import React, { useEffect, useState, useRef } from 'react';
import { View, Text } from 'react-native';
import styled from 'styled-components/native';
import { useAuth } from '../../context/AuthContext';
import { MOCKUP_OPTIONS } from './SmartScreenSections/SmartScreen.constants';

const StatusText = styled.Text`
  font-size: 16px;
  font-weight: bold;
  color: ${(props) => (props.isOnline ? 'green' : 'red')};
  margin-left: 16px;
`;

/**
 * OnlineStatus
 *
 * Builds new LAN headers for every request using buildLanHeaders(),
 * while WAN keeps using the backend proxy. This ignores lanAuthToken
 * and derives headers fresh per poll.
 */
export default function OnlineStatus({
  selectedOption = 'LAN',
  selectedMockup = MOCKUP_OPTIONS.MOCKUP_2,
  pollingInterval = 30000,
  wanBackendUrl = 'https://one-development.soniciot.com/device_status/',
  lanUrl = 'http://192.168.2.115/api/v1.0/device',
  requestId = 'c45e846ca23ab42c9ae469d988ae32a96',
  deviceId,
  residenceId,
  onStatusChange,
}) {
  const { getActiveLanToken, getActiveWanToken } = useAuth();
  const [isOnline, setIsOnline] = useState(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const activeDeviceId = deviceId || (
    selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
      ? 'd4f54a92bea2a440c8a6a23d0b636dcf7'
      : 'd03852d726b074d77a7d658e7fac7d3b6'
  );

  const activeResidenceId = residenceId || (
    selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
      ? 'r45844047053e43d78fe5272c5badbd3a'
      : 'rabd2c6d2aecc4ce3be11e25b4ecd3c82'
  );

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const updateOnlineStatus = (nextStatus) => {
      if (!mounted) return;
      setIsOnline(nextStatus);
      if (onStatusChange) onStatusChange(nextStatus);
    };

    async function fetchStatus() {
      setLoading(true);

      const lanBody = {
        command: 'get_device_info',
        id: requestId,
        param: { device_id: activeDeviceId },
      };
      const wanBody = {
        command: 'get_device_list',
        id: requestId,
        param: { residence_id: activeResidenceId, show_ability: true },
      };

      try {
        if (selectedOption === 'WAN') {
          console.log('[OnlineStatus] selectedOption: WAN -> calling backend proxy', wanBackendUrl);
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
            const errorBody = await res.text(); 
            console.warn('[OnlineStatus] WAN backend non-2xx', { 
              status: res.status, 
              body: errorBody //<--- PRINTING IT HERE!
            });
            console.warn('[OnlineStatus] WAN backend non-2xx', { status: res.status, url: wanBackendUrl });
            if (mounted) setIsOnline(false);
            return;
          }
          const json = await res.json();
          const onlineFlag = extractDeviceOnlineFromWanList(json, activeDeviceId);
          if (mounted) setIsOnline(onlineFlag === null ? false : onlineFlag);
          return;
        }

        // LAN path
        console.log('[OnlineStatus] selectedOption: LAN -> calling LAN URL', lanUrl);
        const activeToken = await getActiveLanToken();

        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        };

        if (!headers.Authorization) {
          console.warn('[OnlineStatus] No Authorization derived from buildLanHeaders; marking offline.');
          updateOnlineStatus(false);
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
          console.warn('[OnlineStatus] non-2xx response from LAN URL', {
            status: res.status,
            statusText: res.statusText,
            url: lanUrl,
            body: bodyText,
            usedAuthorization: headers.Authorization || null,
          });
          updateOnlineStatus(false);
          return;
        }

        const json = await res.json();
        const onlineFlag = json && json.result && typeof json.result.online === 'boolean' ? json.result.online : null;
        updateOnlineStatus(onlineFlag === null ? false : onlineFlag);
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('[OnlineStatus] fetch aborted');
        } else if (err.message === 'timeout') {
          console.warn('[OnlineStatus] LAN fetch timeout (device unreachable?)', { url: lanUrl });
        } else {
          console.warn('[OnlineStatus] LAN/WAN fetch error', err);
        }
        updateOnlineStatus(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    // Initial fetch + polling
    fetchStatus();
    if (pollingInterval > 0) intervalRef.current = setInterval(fetchStatus, pollingInterval);

    return () => {
      mounted = false;
      controller.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    selectedOption,
    pollingInterval,
    wanBackendUrl,
    lanUrl,
    requestId,
    activeDeviceId,
    activeResidenceId,
    onStatusChange,
  ]);

  if (loading && isOnline === null) {
    return (
      <View>
        <Text style={{ marginLeft: 16, color: '#777' }}>Checking...</Text>
      </View>
    );
  }

  return (
    <View>
      <StatusText isOnline={!!isOnline}>{isOnline ? 'Online' : 'Offline'}</StatusText>
    </View>
  );
}

function extractDeviceOnlineFromWanList(json, targetDeviceId) {
  if (!json || !json.result || !targetDeviceId) return null;

  const devices = Array.isArray(json.result)
    ? json.result
    : (Array.isArray(json.result.devices) ? json.result.devices : [json.result]);

  for (const device of devices) {
    if (!device) continue;

    if (device.device_id === targetDeviceId && typeof device.online === 'boolean') {
      return device.online;
    }

    if (Array.isArray(device.sub_devices)) {
      for (const sub of device.sub_devices) {
        if (!sub) continue;
        if (sub.device_id === targetDeviceId && typeof sub.online === 'boolean') {
          return sub.online;
        }
      }
    }
  }

  return null;
}