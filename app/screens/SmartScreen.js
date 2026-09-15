import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Animated, Alert, Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../components/Smart/Header';
import StatsSection from '../components/Smart/StatsSection';
import Tabs from '../components/Smart/Tabs';
import Screen from '../components/Screen';
import useColors from '../hooks/useColors';
import DevicModal from '../components/Modal';
import CallbackServer from '../components/Services/Server';
import {
  MOCKUP_OPTIONS,
  SMARTSCREEN_RESIDENCE_IDS,
  getDeviceCategoriesByResidenceId,
} from '../components/Smart/SmartScreenSections/SmartScreen.constants';
import { controlDevice, deviceStatus } from '../components/Smart/SmartScreenSections/api';
import styles from '../components/Smart/SmartScreenSections/SmartScreen.styles';
import DeviceGrid from '../components/Smart/SmartScreenSections/DeviceGrid';
import { BACKEND_URL, useAuth } from '../context/AuthContext';
import CallbackRegistration from '../components/Services/CallbackRegister';
import { NetworkInfo } from 'react-native-network-info';
import routes from '../navigation/routes';

const { Akuvox } = NativeModules;
const LAN_CALLBACK_CONFIG_URL = 'http://192.168.2.115/api/v1.0/callback';
const WAN_CALLBACK_CONFIG_URL = `${BACKEND_URL}/api/register_callback/wan/`;
const WAN_FAMILY_URL = 'https://one-development.soniciot.com/get-family-details/';

// SIP credential API constants
const SIP_REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
const SIP_DEFAULT_RESIDENCE_ID = SMARTSCREEN_RESIDENCE_IDS.MOCKUP_2;
const MOCKUP_RESIDENCE_IDS = {
  [MOCKUP_OPTIONS.MOCKUP_1]: SMARTSCREEN_RESIDENCE_IDS.MOCKUP_1,
  [MOCKUP_OPTIONS.MOCKUP_2]: SMARTSCREEN_RESIDENCE_IDS.MOCKUP_2,
};

function resolveResidenceId(selectedMockup = MOCKUP_OPTIONS.MOCKUP_2) {
  return MOCKUP_RESIDENCE_IDS[selectedMockup] || SIP_DEFAULT_RESIDENCE_ID;
}

function resolveMockupByResidenceId(residenceId) {
  if (residenceId === MOCKUP_RESIDENCE_IDS[MOCKUP_OPTIONS.MOCKUP_1]) return MOCKUP_OPTIONS.MOCKUP_1;
  return MOCKUP_OPTIONS.MOCKUP_2;
}

function buildFallbackFamilyOptions() {
  return [
    {
      family_name: 'Mockup Panel 1',
      residence_id: MOCKUP_RESIDENCE_IDS[MOCKUP_OPTIONS.MOCKUP_1],
      installed: true,
      online: false,
    },
    {
      family_name: 'Mockup Panel 2',
      residence_id: MOCKUP_RESIDENCE_IDS[MOCKUP_OPTIONS.MOCKUP_2],
      installed: true,
      online: false,
    },
  ];
}

async function fetchWanSipCredentials(wanToken, residenceId = SIP_DEFAULT_RESIDENCE_ID) {
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
      param: { residence_id: residenceId, show_ability: true },
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

  // Never log the ciphertext itself — it is a SIP credential and logcat is readable
  // by other tooling on the device.
  console.log('[WAN SIP] displayName:', displayName, '| ciphertext received:', !!sipToken);

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

  console.log('[LAN SIP] displayName:', displayName, '| sip_info received:', !!sipToken);

  return { sipToken, displayName };
}

async function requestPermissionsIfNeeded() {
  if (Platform.OS === 'android') {
    const camera = PermissionsAndroid.PERMISSIONS.CAMERA;
    const audio = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    const permissions = [camera, audio];
    // Android 13+ needs a runtime grant for the incoming-call notification.
    // Its result does not gate the call feature — ringing still works in-app.
    if (Number(Platform.Version) >= 33) {
      permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    const granted = await PermissionsAndroid.requestMultiple(permissions);
    return (
      granted[camera] === PermissionsAndroid.RESULTS.GRANTED &&
      granted[audio] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  return true;
}

// IPv4 validation
const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

// Ignore self-originated callback echoes for a short window after in-app controls.
const SELF_CALLBACK_SUPPRESS_MS = 2200;
const HEADER_HEIGHT = 240;

export default function SmartScreen({ navigation }) {
  const { getActiveLanToken, getActiveWanToken, networkMode, logout } = useAuth();
  
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
  const [selectedMockup, setSelectedMockup] = useState(MOCKUP_OPTIONS.MOCKUP_2);
  const [selectedResidenceId, setSelectedResidenceId] = useState(MOCKUP_RESIDENCE_IDS[MOCKUP_OPTIONS.MOCKUP_2]);
  const [familyOptions, setFamilyOptions] = useState(buildFallbackFamilyOptions);
  const [familyListLoading, setFamilyListLoading] = useState(false);
  const [selectedFamilyOnline, setSelectedFamilyOnline] = useState(null);
  const activeResidenceId = selectedResidenceId || resolveResidenceId(selectedMockup);
  const [deviceCategories, setDeviceCategories] = useState(() => getDeviceCategoriesByResidenceId(MOCKUP_RESIDENCE_IDS[MOCKUP_OPTIONS.MOCKUP_2]));
  const [activeTab, setActiveTab] = useState('All Devices');
  const scrollY = useRef(new Animated.Value(0)).current;
  const colors = useColors();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedDeviceStatus, setSelectedDeviceStatus] = useState(null);
  const [callbackRegistered, setCallbackRegistered] = useState(false);
  const strictStatusLookup = activeResidenceId === SMARTSCREEN_RESIDENCE_IDS.MOCKUP_1;

  // Local IPv4 state
  const [localIpv4, setLocalIpv4] = useState(null);

  // SIP state
  const [sipInitialized, setSipInitialized] = useState(false);
  const [lastRegisteredTransport, setLastRegisteredTransport] = useState(null); // 'lan' | 'wan' | null
  const [lastRegisteredMockup, setLastRegisteredMockup] = useState(null);
  const [sipRegistrationStatus, setSipRegistrationStatus] = useState(null);
  // Ref so the onSipRegStatus event handler can read selectedOption without re-subscribing.
  const selectedOptionRef = useRef(selectedOption);
  useEffect(() => { selectedOptionRef.current = selectedOption; }, [selectedOption]);
  const selectedMockupRef = useRef(selectedMockup);
  useEffect(() => { selectedMockupRef.current = selectedMockup; }, [selectedMockup]);
  const selectedResidenceIdRef = useRef(activeResidenceId);
  useEffect(() => { selectedResidenceIdRef.current = activeResidenceId; }, [activeResidenceId]);
  const selectedDeviceRef = useRef(selectedDevice);
  const modalVisibleRef = useRef(modalVisible);
  useEffect(() => { selectedDeviceRef.current = selectedDevice; }, [selectedDevice]);
  useEffect(() => { modalVisibleRef.current = modalVisible; }, [modalVisible]);

  // Tracks local controls to suppress callback-echo updates.
  const selfControlSuppressRef = useRef(new Map());
  const wanSyncInFlightRef = useRef(false);
  const wanSyncQueuedRef = useRef(false);

  const makeSuppressKey = useCallback((mode, id, ability) => {
    return `${mode}:${String(id || '')}:${String(ability || '')}`;
  }, []);

  const markSelfControl = useCallback((mode, id, ability) => {
    if (!mode || !id) return;
    const now = Date.now();
    const store = selfControlSuppressRef.current;
    for (const [key, expiresAt] of store.entries()) {
      if (expiresAt <= now) store.delete(key);
    }
    store.set(makeSuppressKey(mode, id, ability), now + SELF_CALLBACK_SUPPRESS_MS);
    store.set(makeSuppressKey(mode, id, ''), now + SELF_CALLBACK_SUPPRESS_MS);
  }, [makeSuppressKey]);

  const shouldSuppressSelfCallback = useCallback((mode, id, ability) => {
    if (!mode || !id) return false;
    const now = Date.now();
    const store = selfControlSuppressRef.current;
    for (const [key, expiresAt] of store.entries()) {
      if (expiresAt <= now) store.delete(key);
    }

    const exactKey = makeSuppressKey(mode, id, ability);
    const genericKey = makeSuppressKey(mode, id, '');
    return (store.get(exactKey) || 0) > now || (store.get(genericKey) || 0) > now;
  }, [makeSuppressKey]);

  const resetToLogin = useCallback(async () => {
    await logout();
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'WelcomeScreen' }] }));
  }, [logout, navigation]);

  const handleAuthExpired = useCallback(() => {
    Alert.alert(
      'Session expired',
      'Your account was signed in elsewhere or your token is no longer valid. Please sign in again.',
      [{ text: 'OK', onPress: resetToLogin }],
    );
  }, [resetToLogin]);

  useEffect(() => {
    console.log('[SmartScreen] selectedOption:', selectedOption);
    console.log('[SmartScreen] callbackRegistered:', callbackRegistered);
  }, [selectedOption, callbackRegistered]);

  useEffect(() => {
    if (selectedOption !== 'WAN') {
      setFamilyListLoading(false);
      return undefined;
    }
    let mounted = true;
    let intervalId = null;

    const loadFamilyList = async () => {
      setFamilyListLoading(true);
      try {
        const wanToken = await getActiveWanToken();
        const response = await fetch(WAN_FAMILY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${wanToken}`,
          },
          body: JSON.stringify({ command: 'get_family_list', id: SIP_REQUEST_ID, param: {} }),
        });
        const payload = await response.json();
        if (response.status === 401 || response.status === 403) {
          if (mounted) handleAuthExpired();
          return;
        }
        if (payload?.success === false && /invalid|expired|unauthorized|forbidden|token|login|credential/i.test(String(payload?.message || payload?.error || payload?.detail || ''))) {
          if (mounted) handleAuthExpired();
          return;
        }
        if (!response.ok || !Array.isArray(payload?.result)) {
          throw new Error(`Unable to load family list (${response.status})`);
        }
        if (!mounted) return;

        const nextFamilyOptions = payload.result.filter((family) => family?.residence_id);
        if (nextFamilyOptions.length === 0) return;

        setFamilyOptions(nextFamilyOptions);
        const hasCurrentSelection = nextFamilyOptions.some((family) => family.residence_id === selectedResidenceIdRef.current);
        if (!hasCurrentSelection) {
          const preferredFamily = nextFamilyOptions.find((family) => family.residence_id === MOCKUP_RESIDENCE_IDS[MOCKUP_OPTIONS.MOCKUP_2]) || nextFamilyOptions[0];
          setSelectedResidenceId(preferredFamily.residence_id);
          setSelectedMockup(resolveMockupByResidenceId(preferredFamily.residence_id));
          setSelectedFamilyOnline(typeof preferredFamily.online === 'boolean' ? preferredFamily.online : null);
        } else {
          const currentFamily = nextFamilyOptions.find((family) => family.residence_id === selectedResidenceIdRef.current);
          setSelectedFamilyOnline(typeof currentFamily?.online === 'boolean' ? currentFamily.online : null);
        }
      } catch (error) {
        if (error?.code === 'INVALID_CREDENTIALS' || /invalid username or password|unauthorized|forbidden/i.test(String(error?.message || ''))) {
          if (mounted) handleAuthExpired();
          return;
        }
        console.warn('[SmartScreen] Failed to load WAN family list:', error?.message || error);
      } finally {
        if (mounted) setFamilyListLoading(false);
      }
    };

    loadFamilyList();
    intervalId = setInterval(loadFamilyList, 10000);
    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [getActiveWanToken, handleAuthExpired, selectedOption]);

  useEffect(() => {
    setDeviceCategories(getDeviceCategoriesByResidenceId(activeResidenceId));
    setActiveTab('All Devices');
    setSelectedDevice(null);
    setModalVisible(false);
  }, [activeResidenceId]);

  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(Akuvox);
    const subscription = eventEmitter.addListener('onSipRegStatus', async ({ status }) => {
      console.log('[SmartScreen] Native SIP registration status:', status);
      setSipRegistrationStatus(status);
      // Only write registeredTransport to AsyncStorage once the SIP line is truly UP (status===2).
      // This prevents contacts screen from trying to call on an unregistered line.
      if (status === 2) {
        const transport = selectedOptionRef.current === 'LAN' ? 'lan' : 'wan';
        const currentMockup = selectedMockupRef.current;
        const currentResidenceId = selectedResidenceIdRef.current;
        await AsyncStorage.setItem('registeredTransport', transport);
        await AsyncStorage.setItem('registeredMockup', currentMockup);
        if (currentResidenceId) await AsyncStorage.setItem('registeredResidenceId', currentResidenceId);
        console.log('[SmartScreen] registeredTransport confirmed and saved:', transport);
        console.log('[SmartScreen] registeredMockup confirmed and saved:', currentMockup);
        console.log('[SmartScreen] registeredResidenceId confirmed and saved:', currentResidenceId);
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
        const savedMockup = await AsyncStorage.getItem('registeredMockup');
        const savedResidenceId = await AsyncStorage.getItem('registeredResidenceId');
        if (mounted && (savedTransport === 'lan' || savedTransport === 'wan')) {
          setLastRegisteredTransport(savedTransport);
          console.log('[SmartScreen] Restored registeredTransport from storage:', savedTransport);
        }
        if (mounted && (savedMockup === MOCKUP_OPTIONS.MOCKUP_1 || savedMockup === MOCKUP_OPTIONS.MOCKUP_2)) {
          setLastRegisteredMockup(savedMockup);
          console.log('[SmartScreen] Restored registeredMockup from storage:', savedMockup);
        }
        if (mounted && savedResidenceId) {
          setSelectedResidenceId(savedResidenceId);
          setSelectedMockup(resolveMockupByResidenceId(savedResidenceId));
          console.log('[SmartScreen] Restored selectedResidenceId from storage:', savedResidenceId);
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
              const storedMockup = await AsyncStorage.getItem('registeredMockup');
              if (currentStatus === 2 && storedTransport === 'lan') {
                console.log('[SmartScreen] SIP already registered (LAN), skipping re-registration.');
                setLastRegisteredTransport('lan');
                if (storedMockup === MOCKUP_OPTIONS.MOCKUP_1 || storedMockup === MOCKUP_OPTIONS.MOCKUP_2) {
                  setLastRegisteredMockup(storedMockup);
                }
                setSipRegistrationStatus(2);
                return;
              }
              // Clear transport so SdkTest blocks calls until onSipRegStatus(2) confirms
              // the new registration. The onSipRegStatus handler is the sole writer of
              // registeredTransport once a switch is in progress.
              await AsyncStorage.removeItem('registeredTransport');
              await AsyncStorage.removeItem('registeredMockup');
              await AsyncStorage.removeItem('registeredResidenceId');
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
              setLastRegisteredMockup(selectedMockup);
              const status = await Akuvox.getSipStatus();
              setSipRegistrationStatus(status);
              if (status === 2) {
                await AsyncStorage.setItem('registeredTransport', 'lan');
                await AsyncStorage.setItem('registeredMockup', selectedMockup);
                await AsyncStorage.setItem('registeredResidenceId', activeResidenceId);
              }
              console.log('[SmartScreen] SIP line status after LAN registration:', status);
            } catch (lanError) {
              // LAN failure is non-fatal — user may not be on home Wi-Fi
              console.warn('[SmartScreen] LAN SIP registration skipped:', lanError?.message || lanError);
            }
          }
        } else if (selectedOption === 'WAN') {
          if (lastRegisteredTransport !== 'wan' || lastRegisteredMockup !== selectedMockup) {
            try {
              // Only skip re-registration if the SIP line is already up on WAN specifically.
              // Do NOT skip if status===2 but transport is 'lan' — we still need to switch.
              const currentStatus = await Akuvox.getSipStatus();
              const storedTransport = await AsyncStorage.getItem('registeredTransport');
              const storedMockup = await AsyncStorage.getItem('registeredMockup');
              const storedResidenceId = await AsyncStorage.getItem('registeredResidenceId');
              if (currentStatus === 2 && storedTransport === 'wan' && storedMockup === selectedMockup && storedResidenceId === activeResidenceId) {
                console.log('[SmartScreen] SIP already registered (WAN), skipping re-registration.');
                setLastRegisteredTransport('wan');
                setLastRegisteredMockup(selectedMockup);
                setSipRegistrationStatus(2);
                return;
              }
              // Clear transport so SdkTest blocks calls until onSipRegStatus(2) confirms
              // the new registration. The onSipRegStatus handler is the sole writer of
              // registeredTransport once a switch is in progress.
              await AsyncStorage.removeItem('registeredTransport');
              await AsyncStorage.removeItem('registeredMockup');
              await AsyncStorage.removeItem('registeredResidenceId');
              setSipRegistrationStatus(null);
              console.log('[SmartScreen] Fetching WAN SIP credentials...');
              const wanToken = await getActiveWanToken();
              const { sipToken: wanSipToken, displayName: wanDisplayName } = await fetchWanSipCredentials(
                wanToken,
                activeResidenceId,
              );
              console.log('[SmartScreen] Registering SIP via WAN, display name:', wanDisplayName);
              const res = await Akuvox.registerSip(wanSipToken, wanDisplayName);
              console.log('[SmartScreen] WAN register result:', res);
              // registeredTransport is written to AsyncStorage only when onSipRegStatus
              // fires status===2 to guarantee the SIP line is truly registered.
              setLastRegisteredTransport('wan');
              setLastRegisteredMockup(selectedMockup);
              const status = await Akuvox.getSipStatus();
              setSipRegistrationStatus(status);
              if (status === 2) {
                await AsyncStorage.setItem('registeredTransport', 'wan');
                await AsyncStorage.setItem('registeredMockup', selectedMockup);
                await AsyncStorage.setItem('registeredResidenceId', activeResidenceId);
              }
              console.log('[SmartScreen] SIP line status after WAN registration:', status);
            } catch (wanError) {
              console.warn('[SmartScreen] WAN SIP registration skipped:', wanError?.message || wanError);
            }
          }
        }
    };

    register();
  }, [sipInitialized, selectedOption, selectedMockup, activeResidenceId, lastRegisteredTransport, lastRegisteredMockup]);

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
      const mode = selectedOptionRef.current?.toLowerCase() === 'wan' ? 'wan' : 'lan';
      const deviceId = payload.data.payload.device_id;
      const abilities = payload.data.payload.abilities;

      setDeviceCategories((prevCats) => {
        return prevCats.map((cat) => ({
          ...cat,
          items: cat.items.map((device) => {
            const channel = device?.[mode];
            const matchedAbility = abilities.find((ability) => {
              const callbackAbilityId = ability?.ability_id;
              return (
                channel?.device_id === deviceId &&
                (!callbackAbilityId || channel?.ability_id === callbackAbilityId)
              );
            });

            if (!matchedAbility) {
              return device;
            }

            if (shouldSuppressSelfCallback(mode, deviceId, matchedAbility?.ability_id)) {
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

      const selected = selectedDeviceRef.current;
      if (modalVisibleRef.current && selected) {
        const selectedChannel = selected?.[mode];
        if (selectedChannel?.device_id === deviceId) {
          const selectedAbilityId = selectedChannel?.ability_id;
          const modalAbility = abilities.find((ability) => {
            return !selectedAbilityId || ability?.ability_id === selectedAbilityId;
          }) || abilities[0];

          if (modalAbility) {
            setSelectedDeviceStatus((prevStatus) => {
              const prevResult = prevStatus?.result || {};
              const prevAbilities = Array.isArray(prevResult.abilities) ? prevResult.abilities : [];
              const nextAbilities = [...prevAbilities];

              const modalAbilityId = modalAbility?.ability_id;
              const abilityIndex = modalAbilityId
                ? nextAbilities.findIndex((ability) => ability?.ability_id === modalAbilityId)
                : -1;

              if (abilityIndex >= 0) {
                nextAbilities[abilityIndex] = {
                  ...nextAbilities[abilityIndex],
                  ...modalAbility,
                  attribute: {
                    ...(nextAbilities[abilityIndex]?.attribute || {}),
                    ...(modalAbility?.attribute || {}),
                  },
                };
              } else {
                nextAbilities.push(modalAbility);
              }

              return {
                ...(prevStatus || {}),
                result: {
                  ...prevResult,
                  device_id: prevResult.device_id || deviceId,
                  device_name: prevResult.device_name || selected?.title || '',
                  abilities: nextAbilities,
                  online: typeof prevResult.online === 'boolean' ? prevResult.online : true,
                },
              };
            });
          }
        }
      }
    }
  }, [shouldSuppressSelfCallback]);

  // Connect to the backend WebSocket for WAN callbacks
  useEffect(() => {
    if (selectedOption !== 'WAN') return;

    // e.g. ws://one-development.soniciot.com/ws/callbacks/wan/
    const wsUrl = `${BACKEND_URL.replace(/^http/, 'ws')}/ws/callbacks/wan/`;
    console.log(`[SmartScreen] Connecting to WAN WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    const syncDeviceStates = async () => {
      if (wanSyncInFlightRef.current) {
        wanSyncQueuedRef.current = true;
        return;
      }
      wanSyncInFlightRef.current = true;

      try {
        const activeToken = await getActiveWanToken();
        const wanBody = {
          command: 'get_device_list',
          id: 'c45e846ca23ab42c9ae469d988ae32a96',
          param: { residence_id: activeResidenceId, show_ability: true },
        };

        const res = await fetch(`${BACKEND_URL}/device_status/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${activeToken}`
          },
          body: JSON.stringify(wanBody)
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'No text body');
          console.error(`[WAN SYNC ERROR] Proxy rejected get_device_list! Status: ${res.status}, Body:`, errorText);
          return;
        }

        const data = await res.json();
        const rawArray = Array.isArray(data?.result)
          ? data.result
          : (Array.isArray(data?.result?.devices) ? data.result.devices : []);
        const validApiDevices = rawArray.flatMap((device) => (
          device?.sub_devices ? [device, ...device.sub_devices] : [device]
        ));

        setDeviceCategories((prevCats) => prevCats.map((cat) => ({
          ...cat,
          items: cat.items.map((device) => {
            const targetId = device?.wan?.device_id;
            const targetAbilityId = device?.wan?.ability_id;
            const apiDev = validApiDevices.find((candidate) => candidate?.device_id === targetId);
            const matchedAbility = apiDev?.abilities?.find(
              (ability) => ability?.ability_id === targetAbilityId
            );

            if (!matchedAbility || shouldSuppressSelfCallback('wan', targetId, targetAbilityId)) {
              return device;
            }

            const normalizedState = String(matchedAbility.state || '').trim().toLowerCase();
            return {
              ...device,
              isOn: normalizedState === 'on' ? true : normalizedState === 'off' ? false : device.isOn,
              status: normalizedState === 'on'
                ? 'On'
                : normalizedState === 'off'
                  ? 'Off'
                  : device.status,
            };
          }),
        })));
      } catch (fetchErr) {
        console.error('[WAN SYNC ERROR] Fetch crashed:', fetchErr);
      } finally {
        wanSyncInFlightRef.current = false;
        if (wanSyncQueuedRef.current) {
          wanSyncQueuedRef.current = false;
          syncDeviceStates();
        }
      }
    };

    ws.onmessage = async (e) => {
      try {
        const payload = JSON.parse(e.data);
        console.log('[SmartScreen] WAN WebSocket received:', payload);
        
        // WAN eCloud device notices arrive in two shapes: bare "sync" frames, and
        // "state" frames whose body sits under `param` (not the LAN `data.payload`
        // shape handleRequest expects). Re-polling the proxy for either one keeps a
        // single authoritative source for device state; syncDeviceStates collapses
        // overlapping calls into one in-flight request plus one trailing refresh.
        if (payload?.notice === 'device_listen_notice') {
          await syncDeviceStates();
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
  }, [selectedOption, selectedMockup, activeResidenceId, handleRequest, getActiveWanToken]);

  // Stable callback-registration status handler — must not be an inline arrow so
  // CallbackRegistration's run-effect dep array stays stable between renders.
  const handleCallbackStatus = useCallback((status, res) => {
    console.log(`[SmartScreen] ${selectedOption} callback registration status:`, status, res);
    if (status === 'success') setCallbackRegistered(true);
    if (status === 'error') {
      console.log(`[SmartScreen] ${selectedOption} callback registration error:`, res?.message || 'Failed to register callback.');
      if (res?.status === 401 || res?.status === 403) {
        handleAuthExpired();
      }
    }
  }, [handleAuthExpired, selectedOption]);

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -(HEADER_HEIGHT + 30)],
    extrapolate: 'clamp',
  });

  const tabsTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [HEADER_HEIGHT, 0],
    extrapolate: 'clamp',
  });

  const allDevices = deviceCategories.flatMap((category) => category.items);
  const categories = [{ category: 'All Devices', items: allDevices }, ...deviceCategories];
  const filteredDevices = categories.find((c) => c.category === activeTab)?.items || [];

  const handleTabChange = (tab) => setActiveTab(tab);
  const smartSectionsDisabled = selectedFamilyOnline === false;

  const refreshModalDeviceStatus = async (
    device,
    headersOverride = null,
    options = {},
  ) => {
    const { retries = 1, delayMs = 350 } = options;
    if (!modalVisible || !device) return;
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev) return;

    const headers = headersOverride || await getHeaders();
    for (let attempt = 0; attempt < retries; attempt += 1) {
      await deviceStatus(dev.device_id, selectedOption, setSelectedDeviceStatus, headers, {
        deviceTitle: device?.title,
        abilityId: dev?.ability_id,
        strictDeviceId: strictStatusLookup,
        selectedMockup,
        selectedResidenceId: activeResidenceId,
      });

      if (attempt < retries - 1) {
        // Device state propagation can lag control responses; poll briefly to keep modal in sync.
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  };

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
        setSelectedDeviceStatus(null);
        const headers = await getHeaders();
        deviceStatus(dev.device_id, selectedOption, setSelectedDeviceStatus, headers, {
          deviceTitle: selectedDevice?.title,
          abilityId: dev?.ability_id,
          strictDeviceId: strictStatusLookup,
          selectedMockup,
          selectedResidenceId: activeResidenceId,
        });
      })();
    } else {
      setSelectedDeviceStatus(null);
    }
  }, [modalVisible, selectedDevice, selectedOption, strictStatusLookup, selectedMockup, activeResidenceId]);

  const handleFamilySelect = useCallback((family) => {
    if (!family?.residence_id) return;
    setSelectedResidenceId(family.residence_id);
    setSelectedMockup(resolveMockupByResidenceId(family.residence_id));
    setSelectedFamilyOnline(typeof family.online === 'boolean' ? family.online : null);
  }, []);

  const handleToggle = async (device, newControl) => {
    if (smartSectionsDisabled) {
      Alert.alert('Family offline', 'This family is offline. Controls will be available when it comes back online.');
      return;
    }
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const newIsOn = newControl === 'on';
    const selectedDeviceId = dev.device_id;
    setDeviceCategories((prevCats) =>
      prevCats.map((cat) => ({
        ...cat,
        items: cat.items.map((d) =>
          d?.[mode]?.device_id === selectedDeviceId
            ? { ...d, isOn: newIsOn, status: newIsOn ? 'On' : 'Off' }
            : d
        ),
      }))
    );
    const command = dev.commandPair[newControl];
    const headers = await getHeaders();
    markSelfControl(mode, dev.device_id, dev.ability_id);
    await controlDevice(dev.device_id, dev.ability_id, command, null, selectedOption, headers, {
      selectedMockup,
      selectedResidenceId: activeResidenceId,
    });
    await refreshModalDeviceStatus(device, headers, { retries: 3, delayMs: 450 });
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
    markSelfControl(mode, dev.device_id, dev.ability_id);
    await controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers, {
      selectedMockup,
      selectedResidenceId: activeResidenceId,
    });
    await refreshModalDeviceStatus(device, headers, { retries: 3, delayMs: 450 });
  };

  const handleSetTemperature = async (device, temperature) => {
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const attribute = mode === 'lan'
      ? { target_temperature: temperature, preset_temperature: temperature }
      : { preset_temperature: temperature };
    const command = dev.commandPair['on'];
    const headers = await getHeaders();
    markSelfControl(mode, dev.device_id, dev.ability_id);
    await controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers, {
      selectedMockup,
      selectedResidenceId: activeResidenceId,
    });
    await refreshModalDeviceStatus(device, headers, { retries: 3, delayMs: 450 });
  };

  const handleSetHVACMode = async (device, HVACmode, temperature) => {
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const attribute = { hvac_mode: HVACmode };
    const command = dev.commandPair['on'];
    const headers = await getHeaders();
    markSelfControl(mode, dev.device_id, dev.ability_id);
    await controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers, {
      selectedMockup,
      selectedResidenceId: activeResidenceId,
    });
    await refreshModalDeviceStatus(device, headers, { retries: 3, delayMs: 450 });
  };

  const handleSetFanSpeed = async (device, speed, temperature) => {
    const mode = selectedOption.toLowerCase();
    const dev = device[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const attribute = { fan_mode: speed };
    const command = dev.commandPair['on'];
    markSelfControl(mode, dev.device_id, dev.ability_id);
    const headers = await getHeaders();
    await controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers, {
      selectedMockup,
      selectedResidenceId: activeResidenceId,
    });
    await refreshModalDeviceStatus(device, headers, { retries: 3, delayMs: 450 });
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
    markSelfControl(mode, dev.device_id, dev.ability_id);
    const command = dev.commandPair['on'];
    const headers = await getHeaders();
    await controlDevice(dev.device_id, dev.ability_id, command, attribute, selectedOption, headers, {
      selectedMockup,
      selectedResidenceId: activeResidenceId,
    });
    await refreshModalDeviceStatus(device, headers, { retries: 3, delayMs: 450 });
  };

  // Build callback URL strictly with IPv4. Fallback to prior static IPv4 if detection fails.
  const callbackHost = localIpv4 && ipv4Regex.test(localIpv4) ? localIpv4 : '192.168.2.105';
  const callbackUrl = `http://${callbackHost}:8080/`;
  // Must track the live transport/residence (not frozen at mount) so switching
  // LAN<->WAN actually re-registers the callback against the new target.
  const callbackMode = selectedOption;
  const callbackResidenceId = activeResidenceId;
  const callbackRegistrationUrl = callbackUrl;
  const callbackListenList = callbackMode === 'WAN' ? ['account', 'device'] : ['device'];
  const activeCallbackConfigUrl = callbackMode === 'WAN' ? WAN_CALLBACK_CONFIG_URL : LAN_CALLBACK_CONFIG_URL;

  // Force re-registration whenever the transport or active residence changes,
  // otherwise a stale `callbackRegistered=true` from a previous mode blocks the
  // new mode's device from ever being told where to POST callbacks.
  useEffect(() => {
    setCallbackRegistered(false);
  }, [callbackMode, callbackResidenceId]);

  useEffect(() => {
    console.log('[SmartScreen] Callback registration mode:', callbackMode);
    console.log('[SmartScreen] Callback URL (listening):', callbackUrl);
    console.log('[SmartScreen] Callback registration endpoint:', activeCallbackConfigUrl);
    if (callbackMode === 'WAN' && ipv4Regex.test(callbackHost)) {
      console.warn('[SmartScreen] WAN callback target is using a private/local IPv4 address. WAN registration may succeed, but cloud callback delivery will fail unless this address is publicly reachable.');
    }
  }, [activeCallbackConfigUrl, callbackHost, callbackMode, callbackUrl]);

  return (
    <Screen>
      <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerTranslateY }] }]}>
        <Header onUserPress={() => navigation.navigate(routes.ACCOUNTDETAILS, { selectedOption, selectedMockup, selectedResidenceId: activeResidenceId })} />
        {/* lanHeaders prop removed from StatsSection if not used there; keep if required */}
        <StatsSection
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
          selectedMockup={selectedMockup}
          setSelectedMockup={setSelectedMockup}
          selectedResidenceId={activeResidenceId}
          familyOptions={familyOptions}
          familyListLoading={familyListLoading}
          onSelectFamily={handleFamilySelect}
          selectedFamilyOnline={selectedFamilyOnline}
          onOnlineStatusChange={setSelectedFamilyOnline}
          onAuthExpired={handleAuthExpired}
          actionsDisabled={smartSectionsDisabled}
        />
      </Animated.View>
      <Animated.View style={[styles.tabsContainer, { transform: [{ translateY: tabsTranslateY }] }]}>
        <Tabs tabs={categories.map((c) => c.category)} onTabChange={handleTabChange} activeTab={activeTab} disabled={smartSectionsDisabled} />
      </Animated.View>

      {/* LAN Server for API */}
      <CallbackServer port={8080} onRequest={handleRequest} />

      {!callbackRegistered && (
        <CallbackRegistration
          deviceCallbackUrl={activeCallbackConfigUrl}
          callbackUrl={callbackRegistrationUrl}
          callbackId="c45e846ca23ab42c9ae469d988ae32a96"
          listenList={callbackListenList}
          residenceId={callbackResidenceId}
          networkMode={callbackMode}
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
        disabled={smartSectionsDisabled}
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