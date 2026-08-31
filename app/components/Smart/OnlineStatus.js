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

const isAuthFailurePayload = (payload) => {
  const message = [
    payload?.message,
    payload?.error,
    payload?.detail,
    payload?.result?.message,
    payload?.result?.error,
    payload?.result?.detail,
  ].filter(Boolean).join(' ').toLowerCase();

  return /invalid|expired|unauthorized|forbidden|token|login|credential/.test(message);
};

/**
 * OnlineStatus
 *
 * Builds new LAN headers for every request using buildLanHeaders(),
 * while WAN receives the selected family's online flag from get_family_list.
 */
export default function OnlineStatus({
  selectedOption = 'LAN',
  selectedMockup = MOCKUP_OPTIONS.MOCKUP_2,
  pollingInterval = 10000,
  wanBackendUrl = 'https://one-development.soniciot.com/device_status/',
  lanUrl = 'http://192.168.2.115/api/v1.0/device',
  requestId = 'c45e846ca23ab42c9ae469d988ae32a96',
  deviceId,
  residenceId,
  wanOnlineStatus = null,
  onStatusChange,
  onAuthExpired,
}) {
  const { getActiveLanToken } = useAuth();
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

      if (selectedOption === 'WAN') {
        updateOnlineStatus(typeof wanOnlineStatus === 'boolean' ? wanOnlineStatus : null);
        setLoading(false);
        return;
      }

      const lanBody = {
        command: 'get_device_info',
        id: requestId,
        param: { device_id: activeDeviceId },
      };

      try {
        // LAN path
        console.log('[OnlineStatus] selectedOption: LAN -> calling LAN URL', lanUrl);
        const activeToken = await getActiveLanToken(true);

        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        };

        if (!headers.Authorization) {
          console.warn('[OnlineStatus] No Authorization derived from buildLanHeaders; marking offline.');
          if (onAuthExpired) onAuthExpired();
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
          if (res.status === 401 || res.status === 403) {
            if (onAuthExpired) onAuthExpired();
          }
          updateOnlineStatus(false);
          return;
        }

        const json = await res.json();
        if (json?.success === false && isAuthFailurePayload(json)) {
          if (onAuthExpired) onAuthExpired();
          updateOnlineStatus(false);
          return;
        }
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
        if (err?.code === 'INVALID_CREDENTIALS' || /invalid username or password|unauthorized|forbidden/i.test(String(err?.message || ''))) {
          if (onAuthExpired) onAuthExpired();
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
    lanUrl,
    requestId,
    activeDeviceId,
    wanOnlineStatus,
    onStatusChange,
    onAuthExpired,
  ]);

  if (isOnline === null) {
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