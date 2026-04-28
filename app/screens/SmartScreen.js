import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Animated, Alert, Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Smart/Header';
import StatsSection from '../components/Smart/StatsSection';
import Tabs from '../components/Smart/Tabs';
import Screen from '../components/Screen';
import useColors from '../hooks/useColors';
import DevicModal from '../components/Modal';
import CallbackServer from '../components/Services/Server';
import { INITIAL_DEVICE_CATEGORIES } from '../components/Smart/SmartScreenSections/SmartScreen.constants';
import { controlDevice, deviceStatus } from '../components/Smart/SmartScreenSections/api';
import styles from '../components/Smart/SmartScreenSections/SmartScreen.styles';
import DeviceGrid from '../components/Smart/SmartScreenSections/DeviceGrid';
import { BACKEND_URL, useAuth } from '../context/AuthContext';
import CallbackRegistration from '../components/Services/CallbackRegister';
import { NetworkInfo } from 'react-native-network-info';

const { Akuvox } = NativeModules;
const LAN_CALLBACK_CONFIG_URL = 'http://192.168.2.115/api/v1.0/callback';
const WAN_CALLBACK_CONFIG_URL = `${BACKEND_URL}/api/register_callback/wan/`;

// SIP credential API constants
const SIP_REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
const SIP_RESIDENCE_ID = 'rabd2c6d2aecc4ce3be11e25b4ecd3c82';

async function fetchWanSipCredentials(wanToken) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${wanToken}`,
  };

  // Fetch display name from account_info
  const accountRes = await fetch('https://one-development.soniciot.com/account_info/', {
    method: 'POST',
    headers,
    body: JSON.stringify({ command: 'get_account_info', id: SIP_REQUEST_ID, param: {} }),
  });
  if (!accountRes.ok) {
    throw new Error(`[WAN SIP] account_info failed: HTTP ${accountRes.status}`);
  }
  const accountData = await accountRes.json();
  const firstName = accountData?.result?.first_name || '';
  const lastName = accountData?.result?.last_name || '';
  const displayName = `${firstName} ${lastName}`.trim() || 'User';

  // Fetch SIP ciphertext from contact_list
  const contactRes = await fetch('https://one-development.soniciot.com/contact_list/', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      command: 'get_contact_list',
      id: SIP_REQUEST_ID,
      param: { residence_id: SIP_RESIDENCE_ID, show_ability: true },
    }),
  });
  if (!contactRes.ok) {
    throw new Error(`[WAN SIP] contact_list failed: HTTP ${contactRes.status}`);
  }
  const contactData = await contactRes.json();
  const sipToken = contactData?.result?.ciphertext;
  if (!sipToken) {
    throw new Error('[WAN SIP] ciphertext missing from contact_list response');
  }

  console.log('[WAN SIP] displayName:', displayName);
  console.log('[WAN SIP] ciphertext:', sipToken);

  return { sipToken, displayName };
}

async function fetchWithTimeout(url, options, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`LAN request timed out after ${timeoutMs}ms — device may be unreachable`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLanSipCredentials(lanToken) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${lanToken}`,
  };
  const baseUrl = 'http://192.168.2.115/api/v1.0/account';

  // Fetch SIP register info (5s timeout — LAN device may be unreachable)
  const sipRes = await fetchWithTimeout(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ command: 'get_sip_register_info', id: SIP_REQUEST_ID, param: {} }),
  });
  if (!sipRes.ok) {
    throw new Error(`[LAN SIP] get_sip_register_info failed: HTTP ${sipRes.status}`);
  }
  const sipData = await sipRes.json();
  const sipToken = sipData?.result?.sip_info;
  if (!sipToken) {
    throw new Error('[LAN SIP] sip_info missing from response');
  }

  // Fetch display name from account_info
  const accountRes = await fetchWithTimeout(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ command: 'get_account_info', id: SIP_REQUEST_ID, param: {} }),
  });
  if (!accountRes.ok) {
    throw new Error(`[LAN SIP] get_account_info failed: HTTP ${accountRes.status}`);
  }
  const accountData = await accountRes.json();
  const firstName = accountData?.result?.first_name || '';
  const lastName = accountData?.result?.last_name || '';
  const displayName = `${firstName} ${lastName}`.trim() || 'User';

  console.log('[LAN SIP] displayName:', displayName);
  console.log('[LAN SIP] sip_info (ciphertext):', sipToken);

  return { sipToken, displayName };
}

async function requestPermissionsIfNeeded() {
  if (Platform.OS === 'android') {
    const camera = PermissionsAndroid.PERMISSIONS.CAMERA;
    const audio = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    const granted = await PermissionsAndroid.requestMultiple([camera, audio]);
    return (
      granted[camera] === PermissionsAndroid.RESULTS.GRANTED &&
      granted[audio] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  return true;
}

// IPv4 validation
const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

export default function SmartScreen({ navigation }) {
  const { getActiveLanToken, getActiveWanToken, networkMode } = useAuth();
  
  const getHeaders = async () => {
    const activeToken = selectedOption === 'LAN' ? await getActiveLanToken() : await getActiveWanToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${activeToken}`
    };
  };

  // Initialise from the mode determined at login (LAN or WAN).
  const [selectedOption, setSelectedOption] = useState(networkMode || 'WAN');
  const [deviceCategories, setDeviceCategories] = useState(INITIAL_DEVICE_CATEGORIES);
  const scrollY = useRef(new Animated.Value(0)).current;
  const colors = useColors();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedDeviceStatus, setSelectedDeviceStatus] = useState(null);
  const [callbackRegistered, setCallbackRegistered] = useState(false);

  // Local IPv4 state
  const [localIpv4, setLocalIpv4] = useState(null);

  // SIP state
  const [sipInitialized, setSipInitialized] = useState(false);
  const [lastRegisteredTransport, setLastRegisteredTransport] = useState(null); // 'lan' | 'wan' | null
  const [sipRegistrationStatus, setSipRegistrationStatus] = useState(null);
  // Ref so the onSipRegStatus event handler can read selectedOption without re-subscribing.
  const selectedOptionRef = useRef(selectedOption);
  useEffect(() => { selectedOptionRef.current = selectedOption; }, [selectedOption]);

  useEffect(() => {
    console.log('[SmartScreen] selectedOption:', selectedOption);
    console.log('[SmartScreen] callbackRegistered:', callbackRegistered);
  }, [selectedOption, callbackRegistered]);

  // Reset callback registration whenever the user switches mode so re-registration
  // is attempted if they return to LAN.
  useEffect(() => {
    setCallbackRegistered(false);
  }, [selectedOption]);

  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(Akuvox);
    const subscription = eventEmitter.addListener('onSipRegStatus', async ({ status }) => {
      console.log('[SmartScreen] Native SIP registration status:', status);
      setSipRegistrationStatus(status);
      // Only write registeredTransport to AsyncStorage once the SIP line is truly UP (status===2).
      // This prevents contacts screen from trying to call on an unregistered line.
      if (status === 2) {
        const transport = selectedOptionRef.current === 'LAN' ? 'lan' : 'wan';
        await AsyncStorage.setItem('registeredTransport', transport);
        console.log('[SmartScreen] registeredTransport confirmed and saved:', transport);
      }
    });

    return () => subscription.remove();
  }, []);

  // Init SDK once when we land on SmartScreen and detect device IPv4
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Restore persisted transport so we don't re-register on every SmartScreen mount.
      // The native SIP stack keeps the registration alive across screen navigations.
      try {
        const savedTransport = await AsyncStorage.getItem('registeredTransport');
        if (mounted && (savedTransport === 'lan' || savedTransport === 'wan')) {
          setLastRegisteredTransport(savedTransport);
          console.log('[SmartScreen] Restored registeredTransport from storage:', savedTransport);
        }
      } catch (_) {}

      const permissionsGranted = await requestPermissionsIfNeeded();
      if (!permissionsGranted) {
        Alert.alert('Permission Denied', 'Camera and microphone permissions are required for calls.');
        return;
      }
      try {
        Akuvox?.initSdk?.();
        if (mounted) {
          setSipInitialized(true);
          console.log('[SmartScreen] SDK initialized.');
        }
      } catch (e) {
        console.warn('[SmartScreen] initSdk error:', e);
        Alert.alert('SDK Error', e?.message || 'Failed to initialize SIP SDK.');
      }

      // Detect local IPv4 address
      try {
        const ipV4 = await NetworkInfo.getIPV4Address(); // returns IPv4 string
        console.log('[SmartScreen] Local IPv4 detected:', ipV4);
        if (mounted && ipV4 && ipv4Regex.test(ipV4)) setLocalIpv4(ipV4);
        else console.warn('[SmartScreen] IPv4 not available or invalid:', ipV4);
      } catch (e) {
        console.warn('[SmartScreen] Unable to get IPv4 address:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Auto register SIP whenever selectedOption changes (LAN/WAN), after SDK init
  useEffect(() => {
    const register = async () => {
      if (!sipInitialized) return;

      if (selectedOption === 'LAN') {
          if (lastRegisteredTransport !== 'lan') {
            try {
              // Only skip re-registration if the SIP line is already up on LAN specifically.
              // Do NOT skip if status===2 but transport is 'wan' — we still need to switch.
              const currentStatus = await Akuvox.getSipStatus();
              const storedTransport = await AsyncStorage.getItem('registeredTransport');
              if (currentStatus === 2 && storedTransport === 'lan') {
                console.log('[SmartScreen] SIP already registered (LAN), skipping re-registration.');
                setLastRegisteredTransport('lan');
                setSipRegistrationStatus(2);
                return;
              }
              // Clear transport so SdkTest blocks calls until onSipRegStatus(2) confirms
              // the new registration. The onSipRegStatus handler is the sole writer of
              // registeredTransport once a switch is in progress.
              await AsyncStorage.removeItem('registeredTransport');
              setSipRegistrationStatus(null);
              console.log('[SmartScreen] Fetching LAN SIP credentials...');
              const lanToken = await getActiveLanToken();
              const { sipToken: lanSipToken, displayName: lanDisplayName } = await fetchLanSipCredentials(lanToken);
              console.log('[SmartScreen] Registering SIP via LAN, display name:', lanDisplayName);
              const res = await Akuvox.registerSipLan(lanSipToken, lanDisplayName);
              console.log('[SmartScreen] LAN register result:', res);
              // registeredTransport is written to AsyncStorage only when onSipRegStatus
              // fires status===2 to guarantee the SIP line is truly registered.
              setLastRegisteredTransport('lan');
              const status = await Akuvox.getSipStatus();
              setSipRegistrationStatus(status);
              console.log('[SmartScreen] SIP line status after LAN registration:', status);
            } catch (lanError) {
              // LAN failure is non-fatal — user may not be on home Wi-Fi
              console.warn('[SmartScreen] LAN SIP registration skipped:', lanError?.message || lanError);
            }
          }
        } else if (selectedOption === 'WAN') {
          if (lastRegisteredTransport !== 'wan') {
            try {
              // Only skip re-registration if the SIP line is already up on WAN specifically.
              // Do NOT skip if status===2 but transport is 'lan' — we still need to switch.
              const currentStatus = await Akuvox.getSipStatus();
              const storedTransport = await AsyncStorage.getItem('registeredTransport');
              if (currentStatus === 2 && storedTransport === 'wan') {
                console.log('[SmartScreen] SIP already registered (WAN), skipping re-registration.');
                setLastRegisteredTransport('wan');
                setSipRegistrationStatus(2);
                return;
              }
              // Clear transport so SdkTest blocks calls until onSipRegStatus(2) confirms
              // the new registration. The onSipRegStatus handler is the sole writer of
              // registeredTransport once a switch is in progress.
              await AsyncStorage.removeItem('registeredTransport');
              setSipRegistrationStatus(null);
              console.log('[SmartScreen] Fetching WAN SIP credentials...');
              const wanToken = await getActiveWanToken();
              const { sipToken: wanSipToken, displayName: wanDisplayName } = await fetchWanSipCredentials(wanToken);
              console.log('[SmartScreen] Registering SIP via WAN, display name:', wanDisplayName);
              const res = await Akuvox.registerSip(wanSipToken, wanDisplayName);
              console.log('[SmartScreen] WAN register result:', res);
              // registeredTransport is written to AsyncStorage only when onSipRegStatus
              // fires status===2 to guarantee the SIP line is truly registered.
              setLastRegisteredTransport('wan');
              const status = await Akuvox.getSipStatus();
              setSipRegistrationStatus(status);
              console.log('[SmartScreen] SIP line status after WAN registration:', status);
            } catch (wanError) {
              console.warn('[SmartScreen] WAN SIP registration skipped:', wanError?.message || wanError);
            }
          }
        }
    };

    register();
  }, [sipInitialized, selectedOption, lastRegisteredTransport]);

  useEffect(() => {
    if (!callbackRegistered) {
      console.log(`[SmartScreen] Ready to register ${selectedOption} callback.`);
    }
  }, [selectedOption, callbackRegistered]);

  // This function updates device state based on callback payload.
  // Wrapped in useCallback so CallbackServer never restarts due to a new function reference.
  const handleRequest = useCallback((req, payload) => {
    const normalizeStateLabel = (state) => {
      if (typeof state !== 'string') return null;
      const normalizedState = state.trim().toLowerCase();
      if (normalizedState === 'on') return 'On';
      if (normalizedState === 'off') return 'Off';
      return normalizedState.charAt(0).toUpperCase() + normalizedState.slice(1);
    };

    if (
      payload?.event_type === 'device' &&
      payload?.data?.payload?.device_id &&
      Array.isArray(payload?.data?.payload?.abilities)
    ) {
      const deviceId = payload.data.payload.device_id;
      const abilities = payload.data.payload.abilities;

      setDeviceCategories((prevCats) => {
        return prevCats.map((cat) => ({
          ...cat,
          items: cat.items.map((device) => {
            const matchedAbility = abilities.find((ability) => {
              const callbackAbilityId = ability?.ability_id;
              return (
                device?.lan?.device_id === deviceId &&
                (!callbackAbilityId || device?.lan?.ability_id === callbackAbilityId)
              );
            });

            if (!matchedAbility) {
              return device;
            }

            const rawState = matchedAbility?.state;
            const normalizedState = typeof rawState === 'string' ? rawState.trim().toLowerCase() : null;
            const nextStatus = normalizeStateLabel(rawState) ?? device.status;
            const nextIsOn = normalizedState === 'on'
              ? true
              : normalizedState === 'off'
                ? false
                : device.isOn;

            return {
              ...device,
              isOn: nextIsOn,
              status: nextStatus,
            };
          }),
        }));
      });
    }
  }, []);

  // Connect to the backend WebSocket for WAN callbacks
  useEffect(() => {
    if (selectedOption !== 'WAN') return;

    // e.g. ws://one-development.soniciot.com/ws/callbacks/wan/
    const wsUrl = `${BACKEND_URL.replace(/^http/, 'ws')}/ws/callbacks/wan/`;
    console.log(`[SmartScreen] Connecting to WAN WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.onmessage = async (e) => {
      try {
        const payload = JSON.parse(e.data);
        console.log('[SmartScreen] WAN WebSocket received:', payload);
        
        // WAN eCloud sends empty "sync" frames rather than raw payload bodies.
        // On sync frames, we must poll the latest live states manually from the proxy API
        if (payload?.notice === 'device_listen_notice' && payload?.action === 'sync') {
          const activeToken = await getActiveWanToken();
          
          const RESIDENCE_ID = 'rabd2c6d2aecc4ce3be11e25b4ecd3c82';

          // Radically optimized single-fetch pipeline leveraging the augmented get_device_list endpoint. 
          // Retreives the global house natively in under 150ms!
          const wanBody = {
            command: 'get_device_list',
            id: 'c45e846ca23ab42c9ae469d988ae32a96',
            param: { residence_id: RESIDENCE_ID, show_ability: true },
          };
          
          try {
            let validApiDevices = [];
            
            const res = await fetch(`${BACKEND_URL}/device_status/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${activeToken}`
              },
              body: JSON.stringify(wanBody)
            });

            if (res.ok) {
              const data = await res.json();
              
              // Let's console log the raw shape to figure out exactly how the abilities arrive!
              console.log(`[WAN SYNC DEBUG] Raw get_device_list returned:` + JSON.stringify(data?.result || data).slice(0, 500));
              
              if (data?.result) {
                // Handle both structures: if it directly returns an array or if it wraps it in .devices
                const rawArray = Array.isArray(data.result) 
                  ? data.result 
                  : (Array.isArray(data.result.devices) ? data.result.devices : [data.result]);

                rawArray.forEach(dev => {
                  validApiDevices.push(dev);
                  if (Array.isArray(dev.sub_devices)) {
                    validApiDevices.push(...dev.sub_devices);
                  }
                });
              }
            } else {
              const errorText = await res.text().catch(e => 'No text body');
              console.error(`[WAN SYNC ERROR] Proxy rejected get_device_list! Status: ${res.status}, Body:`, errorText);
            }
            
            console.log(`[WAN SYNC DEBUG] Flattened ${validApiDevices.length} total sub_devices from get_device_list sweep!`);

            setDeviceCategories((prevCats) => {
              return prevCats.map((cat) => ({
                ...cat,
                items: cat.items.map((device) => {
                  const targetId = device?.wan?.device_id || device?.lan?.device_id;
                  const apiDev = validApiDevices.find(d => d.device_id === targetId);
                  
                  if (!apiDev || !Array.isArray(apiDev.abilities)) return device;
                  
                  const targetAbilityId = device?.wan?.ability_id || device?.lan?.ability_id;
                  const matchedAbility = apiDev.abilities.find(a => !targetAbilityId || a.ability_id === targetAbilityId);
                  
                  if (!matchedAbility) return device;

                  const normalizeStateLabel = (state) => {
                    if (typeof state !== 'string') return null;
                    const normalizedState = state.trim().toLowerCase();
                    if (normalizedState === 'on') return 'On';
                    if (normalizedState === 'off') return 'Off';
                    return normalizedState.charAt(0).toUpperCase() + normalizedState.slice(1);
                  };

                  const rawState = matchedAbility?.state;
                  const normalizedState = typeof rawState === 'string' ? rawState.trim().toLowerCase() : null;
                  const nextStatus = normalizeStateLabel(rawState) ?? device.status;
                  const nextIsOn = normalizedState === 'on' 
                    ? true 
                    : normalizedState === 'off' 
                      ? false 
                      : device.isOn;
                  
                  console.log(`[WAN SYNC DEBUG] Patching device '${device.title}' (${targetId}) -> isOn: ${nextIsOn}, status: ${nextStatus}`);
                  
                  return {
                    ...device,
                    isOn: nextIsOn,
                    status: nextStatus,
                  };
                })
              }));
            });
            
          } catch (fetchErr) {
            console.error('[WAN SYNC ERROR] Fetch crashed:', fetchErr);
          }
        } else {
          handleRequest(null, payload);
        }
      } catch (err) {
        console.warn('[SmartScreen] WAN WebSocket parse/sync error:', err);
      }
    };

    ws.onopen = () => console.log('[SmartScreen] WAN WebSocket connected');
    ws.onclose = () => console.log('[SmartScreen] WAN WebSocket closed');
    ws.onerror = (e) => console.log('[SmartScreen] WAN WebSocket error:', e);

    return () => {
      ws.close();
    };
  }, [selectedOption, handleRequest, getActiveWanToken]);

  // Stable callback-registration status handler — must not be an inline arrow so
  // CallbackRegistration's run-effect dep array stays stable between renders.
  const handleCallbackStatus = useCallback((status, res) => {
    console.log(`[SmartScreen] ${selectedOption} callback registration status:`, status, res);
    if (status === 'success') setCallbackRegistered(true);
    if (status === 'error') {
      console.log(`[SmartScreen] ${selectedOption} callback registration error:`, res?.message || 'Failed to register callback.');
    }
  }, [selectedOption]);

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 166],
    outputRange: [0, -196],
    extrapolate: 'clamp',
  });

  const tabsTranslateY = scrollY.interpolate({
    inputRange: [0, 166],
    outputRange: [166, 0],
    extrapolate: 'clamp',
  });

  const [activeTab, setActiveTab] = useState('All Devices');
  const allDevices = deviceCategories.flatMap((category) => category.items);
  const categories = [{ category: 'All Devices', items: allDevices }, ...deviceCategories];
  const filteredDevices = categories.find((c) => c.category === activeTab)?.items || [];

  const handleTabChange = (tab) => setActiveTab(tab);

  // Always rebuild LAN headers right before status requests
  useEffect(() => {
    if (modalVisible && selectedDevice) {
      const mode = selectedOption.toLowerCase();
      const dev = selectedDevice[mode];
      if (!dev) {
        setSelectedDeviceStatus(null);
        return;
      }
      (async () => {
        const headers = await getHeaders();
        deviceStatus(dev.device_id, selectedOption, setSelectedDeviceStatus, headers);
      })();
    } else {
      setSelectedDeviceStatus(null);
    }
  }, [modalVisible, selectedDevice, selectedOption]);

  const handleToggle = async (device, newControl) => {
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const newIsOn = newControl === 'on';
    setDeviceCategories((prevCats) =>
      prevCats.map((cat) => ({
        ...cat,
        items: cat.items.map((d) =>
          d.title === device.title && d.location === device.location
            ? { ...d, isOn: newIsOn, status: newIsOn ? 'On' : 'Off' }
            : d
        ),
      }))
    );
    const command = dev.commandPair[newControl];
    const headers = await getHeaders();
    controlDevice(dev.device_id, dev.ability_id, command, null, selectedOption, headers);
    deviceStatus(dev.device_id, selectedOption, setSelectedDeviceStatus, headers);
  };

  const handleSetPosition = async (device, position) => {
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const command = dev.commandPair['on'];
    const attribute = mode === 'lan'
      ? { position }
      : { position_percent: position };
    const headers = await getHeaders();
    controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers);
  };

  const handleSetTemperature = async (device, temperature) => {
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const attribute = mode === 'lan'
      ? { target_temperature: temperature }
      : { preset_temperature: temperature };
    const command = dev.commandPair['on'];
    const headers = await getHeaders();
    controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers);
  };

  const handleSetHVACMode = async (device, HVACmode, temperature) => {
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const attribute = mode === 'lan'
      ? { target_temperature: temperature }
      : { hvac_mode: HVACmode };
    const command = dev.commandPair['on'];
    const headers = await getHeaders();
    controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers);
  };

  const handleSetFanSpeed = async (device, speed, temperature) => {
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const attribute = mode === 'lan'
      ? { target_temperature: temperature }
      : { fan_mode: speed };
    const command = dev.commandPair['on'];
    const headers = await getHeaders();
    controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers);
  };

  const handleSetBrightness = async (device, Brightness) => {
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const attribute = mode === 'lan'
      ? { brightness_pct: Brightness }
      : { brightness: Brightness };
    const command = dev.commandPair['on'];
    const headers = await getHeaders();
    controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers);
  };

  // Build callback URL strictly with IPv4. Fallback to prior static IPv4 if detection fails.
  const callbackHost = localIpv4 && ipv4Regex.test(localIpv4) ? localIpv4 : '192.168.2.105';
  const callbackUrl = `http://${callbackHost}:8080/`;
  const activeCallbackConfigUrl = selectedOption === 'WAN' ? WAN_CALLBACK_CONFIG_URL : LAN_CALLBACK_CONFIG_URL;
  useEffect(() => {
    console.log('[SmartScreen] Callback URL (listening):', callbackUrl);
    console.log('[SmartScreen] Callback registration endpoint:', activeCallbackConfigUrl);
    if (selectedOption === 'WAN' && ipv4Regex.test(callbackHost)) {
      console.warn('[SmartScreen] WAN callback target is using a private/local IPv4 address. WAN registration may succeed, but cloud callback delivery will fail unless this address is publicly reachable.');
    }
  }, [activeCallbackConfigUrl, callbackHost, callbackUrl, selectedOption]);

  return (
    <Screen>
      <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerTranslateY }] }]}>
        <Header />
        {/* lanHeaders prop removed from StatsSection if not used there; keep if required */}
        <StatsSection selectedOption={selectedOption} setSelectedOption={setSelectedOption} />
      </Animated.View>
      <Animated.View style={[styles.tabsContainer, { transform: [{ translateY: tabsTranslateY }] }]}>
        <Tabs tabs={categories.map((c) => c.category)} onTabChange={handleTabChange} activeTab={activeTab} />
      </Animated.View>

      {/* LAN Server for API */}
      <CallbackServer port={8080} onRequest={handleRequest} />

      {!callbackRegistered && (
        <CallbackRegistration
          deviceCallbackUrl={activeCallbackConfigUrl}
          callbackUrl={callbackUrl}
          callbackId="c45e846ca23ab42c9ae469d988ae32a96"
          listenList={['device']}
          networkMode={selectedOption}
          run={true}
          onStatus={handleCallbackStatus}
        />
      )}

      <DeviceGrid
        filteredDevices={filteredDevices}
        handleToggle={handleToggle}
        navigation={navigation}
        setSelectedDevice={setSelectedDevice}
        setModalVisible={setModalVisible}
        selectedOption={selectedOption}
        activeTab={activeTab}
      />
      <DevicModal
        selectedDevice={selectedDevice}
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
        handleToggle={handleToggle}
        handleSetPosition={handleSetPosition}
        handleSetTemperature={handleSetTemperature}
        handleSetHVACMode={handleSetHVACMode}
        handleSetFanSpeed={handleSetFanSpeed}
        handleSetBrightness={handleSetBrightness}
        deviceStatus={selectedDeviceStatus}
      />
    </Screen>
  );
}