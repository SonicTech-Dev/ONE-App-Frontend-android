import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth, BACKEND_URL } from '../../../context/AuthContext';
import { useBottomSpacing } from '../../../navigation/tabBarLayout';
import Screen from '../../Screen';
import DeviceTile from '../DeviceTile';
import ACModal from '../AC/AC';
import { controlDevice, deviceStatus } from '../SmartScreenSections/api';
import { MOCKUP_OPTIONS } from '../SmartScreenSections/SmartScreen.constants';

const WAN_DEVICE_LIST_URL = `${BACKEND_URL}/device_status/`;
const LAN_DEVICE_LIST_URL = 'http://192.168.2.115/api/v1.0/device';
const REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
const LAN_TIMEOUT_MS = 7000;
const POLL_INTERVAL_MS = 20000;
const AC_COMMAND_PAIR = { on: 'turn_on', off: 'turn_off' };

// Matches "AC" as a standalone, upper-case word ("AC IT Office", "Office AC") but not
// substrings such as "Space", "Access" or "Ac Remote" product names.
const AC_NAME_PATTERN = /(^|[\s\-_])AC([\s\-_]|$)/;

const isAcDevice = (device) => AC_NAME_PATTERN.test(String(device?.device_name || ''));

// Device list nests ACs under gateways/panels at arbitrary depth, so walk every level.
const flattenDevices = (devices, out = []) => {
  if (!Array.isArray(devices)) return out;
  for (const device of devices) {
    if (!device) continue;
    out.push(device);
    if (Array.isArray(device.sub_devices) && device.sub_devices.length) {
      flattenDevices(device.sub_devices, out);
    }
  }
  return out;
};

const extractDeviceArray = (json) => {
  if (Array.isArray(json?.result)) return json.result;
  if (Array.isArray(json?.result?.devices)) return json.result.devices;
  return [];
};

const findClimateAbility = (abilities = []) => (
  abilities.find((a) => String(a?.ability_type || '').toLowerCase() === 'climate')
  || abilities.find((a) => String(a?.ability_id || '').toLowerCase().startsWith('climate'))
  || abilities[0]
  || null
);

// Shape each AC like the SmartScreen constants entries so ACModal, controlDevice and
// deviceStatus can be reused unchanged; only the active transport key is populated
// because LAN and WAN report different ids for the same physical device.
const buildAcTiles = (json, mode) => {
  const seen = new Set();
  return flattenDevices(extractDeviceArray(json))
    .filter(isAcDevice)
    .filter((device) => {
      if (!device.device_id || seen.has(device.device_id)) return false;
      seen.add(device.device_id);
      return true;
    })
    .map((device) => {
      const ability = findClimateAbility(device.abilities);
      const state = String(ability?.state || '').trim().toLowerCase();
      const isOn = state === 'on';
      return {
        title: device.device_name,
        location: device.space?.space_name || '',
        status: state === 'on' ? 'On' : state === 'off' ? 'Off' : (device.online === false ? 'Offline' : ''),
        isOn,
        online: typeof device.online === 'boolean' ? device.online : null,
        color: '#ff0000ff',
        iconName: 'air-conditioner',
        library: 'MaterialCommunityIcons',
        raw: device,
        [mode]: ability?.ability_id
          ? { device_id: device.device_id, ability_id: ability.ability_id, commandPair: AC_COMMAND_PAIR }
          : null,
      };
    });
};

export default function ClimateScreen({ route, navigation }) {
  const params = route?.params || {};
  const selectedOption = String(params.selectedOption || 'WAN').toUpperCase() === 'LAN' ? 'LAN' : 'WAN';
  const selectedMockup = params.selectedMockup || MOCKUP_OPTIONS.MOCKUP_2;
  const selectedResidenceId = params.selectedResidenceId || '';
  const familyName = params.familyName || '';
  const mode = selectedOption.toLowerCase();

  const { getActiveLanToken, getActiveWanToken } = useAuth();
  const bottomSpacing = useBottomSpacing();

  const [acDevices, setAcDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDeviceStatus, setSelectedDeviceStatus] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const getHeaders = useCallback(async () => {
    const token = selectedOption === 'LAN' ? await getActiveLanToken() : await getActiveWanToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }, [getActiveLanToken, getActiveWanToken, selectedOption]);

  const fetchDeviceList = useCallback(async () => {
    const headers = await getHeaders();
    if (selectedOption === 'WAN') {
      const res = await fetch(WAN_DEVICE_LIST_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          command: 'get_device_list',
          id: REQUEST_ID,
          param: { residence_id: selectedResidenceId, show_ability: true },
        }),
      });
      if (!res.ok) throw new Error(`Unable to load devices (${res.status})`);
      return res.json();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LAN_TIMEOUT_MS);
    try {
      const res = await fetch(LAN_DEVICE_LIST_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ command: 'get_device_list', id: REQUEST_ID, param: {} }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Unable to load devices (${res.status})`);
      return res.json();
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Gateway did not respond. Check that you are on the home network.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }, [getHeaders, selectedOption, selectedResidenceId]);

  const loadAcDevices = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const json = await fetchDeviceList();
      if (!mountedRef.current) return;
      setAcDevices(buildAcTiles(json, mode));
      setErrorMessage('');
    } catch (error) {
      console.warn('[ClimateScreen] Failed to load device list:', error?.message || error);
      if (mountedRef.current && !silent) setErrorMessage(error?.message || 'Unable to load AC devices.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [fetchDeviceList, mode]);

  useEffect(() => {
    loadAcDevices();
    const intervalId = setInterval(() => loadAcDevices({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [loadAcDevices]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAcDevices({ silent: true });
  };

  const refreshModalDeviceStatus = async (device, headersOverride = null, { retries = 1, delayMs = 350 } = {}) => {
    const dev = device?.[mode];
    if (!dev) return;
    const headers = headersOverride || await getHeaders();
    for (let attempt = 0; attempt < retries; attempt += 1) {
      await deviceStatus(dev.device_id, selectedOption, setSelectedDeviceStatus, headers, {
        deviceTitle: device.title,
        abilityId: dev.ability_id,
        selectedMockup,
        selectedResidenceId,
      });
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  };

  // Seed the modal from the list entry so it renders instantly, then confirm with get_device_info.
  useEffect(() => {
    if (!modalVisible || !selectedDevice) {
      setSelectedDeviceStatus(null);
      return;
    }
    const raw = selectedDevice.raw || {};
    setSelectedDeviceStatus({ result: { ...raw, online: typeof raw.online === 'boolean' ? raw.online : true } });
    refreshModalDeviceStatus(selectedDevice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible, selectedDevice]);

  const sendControl = async (device, control, attribute = null) => {
    const dev = device?.[mode];
    if (!dev || !dev.commandPair) {
      Alert.alert('Not supported', `This device cannot be controlled via ${selectedOption}.`);
      return;
    }
    const headers = await getHeaders();
    await controlDevice(dev.device_id, dev.ability_id, dev.commandPair[control], attribute, selectedOption, headers, {
      selectedMockup,
      selectedResidenceId,
    });
    if (modalVisible) {
      await refreshModalDeviceStatus(device, headers, { retries: 3, delayMs: 450 });
    }
    loadAcDevices({ silent: true });
  };

  const handleToggle = async (device, newControl) => {
    const newIsOn = newControl === 'on';
    const targetId = device?.[mode]?.device_id;
    setAcDevices((prev) => prev.map((d) => (
      d?.[mode]?.device_id === targetId ? { ...d, isOn: newIsOn, status: newIsOn ? 'On' : 'Off' } : d
    )));
    await sendControl(device, newControl);
  };

  const handleSetTemperature = (device, temperature) => sendControl(
    device,
    'on',
    mode === 'lan'
      ? { target_temperature: temperature, preset_temperature: temperature }
      : { preset_temperature: temperature },
  );

  const handleSetHVACMode = (device, hvacMode) => sendControl(device, 'on', { hvac_mode: hvacMode });

  const handleSetFanSpeed = (device, speed) => sendControl(device, 'on', { fan_mode: speed });

  const rows = acDevices.reduce((result, device, index) => {
    if (index % 2 === 0) result.push([device]);
    else result[result.length - 1].push(device);
    return result;
  }, []);

  const subtitleParts = [selectedOption, familyName].filter(Boolean);

  return (
    <Screen style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6f4bd8" />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#34225f" />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>Climate</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{subtitleParts.join(' - ')}</Text>
          </View>
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalIcon}>
            <MaterialCommunityIcons name="air-conditioner" size={30} color="#6f4bd8" />
          </View>
          <View>
            <Text style={styles.totalLabel}>Air conditioners</Text>
            <Text style={styles.totalValue}>{loading ? '-' : acDevices.length}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color="#6f4bd8" />
            <Text style={styles.centerText}>Loading AC devices...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerBlock}>
            <MaterialCommunityIcons name="alert-circle-outline" size={36} color="#b9a7e7" />
            <Text style={styles.centerText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadAcDevices()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : acDevices.length === 0 ? (
          <View style={styles.centerBlock}>
            <MaterialCommunityIcons name="air-conditioner" size={36} color="#b9a7e7" />
            <Text style={styles.centerText}>No AC devices found for this family.</Text>
          </View>
        ) : (
          rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.deviceRow}>
              {row.map((device) => {
                const controllable = !!device?.[mode]?.commandPair;
                return (
                  <DeviceTile
                    key={device[mode]?.device_id || device.title}
                    title={device.title}
                    location={device.location}
                    status={device.status}
                    color={device.color}
                    isOn={device.isOn}
                    iconName={device.iconName}
                    library={device.library}
                    selectedOption={selectedOption}
                    onToggle={(newControl) => handleToggle(device, newControl)}
                    disabled={!controllable}
                    onPress={() => {
                      setSelectedDevice(device);
                      setModalVisible(true);
                    }}
                    style={device.online === false ? styles.offlineTile : null}
                  />
                );
              })}
              {row.length === 1 ? <View style={styles.tileSpacer} /> : null}
            </View>
          ))
        )}
      </ScrollView>

      {selectedDevice ? (
        <ACModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          device={selectedDevice}
          selectedOption={selectedOption}
          deviceStatus={selectedDeviceStatus}
          onTurnOn={() => handleToggle(selectedDevice, 'on')}
          onTurnOff={() => handleToggle(selectedDevice, 'off')}
          onSetTemperature={(temp) => handleSetTemperature(selectedDevice, temp)}
          onSetHVACMode={(hvacMode) => handleSetHVACMode(selectedDevice, hvacMode)}
          onSetFanSpeed={(speed) => handleSetFanSpeed(selectedDevice, speed)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f8f6fc' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTextBlock: { flex: 1, marginLeft: 12 },
  title: { color: '#34225f', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#8975b5', fontSize: 13, fontWeight: '600', marginTop: 3 },
  totalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 18, marginBottom: 18, shadowColor: '#6f4bd8', shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  totalIcon: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#f0eaff', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  totalLabel: { color: '#7c6a9e', fontSize: 13, fontWeight: '700' },
  totalValue: { color: '#34225f', fontSize: 30, fontWeight: '800', marginTop: 1 },
  deviceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  tileSpacer: { flex: 1, marginRight: 16 },
  offlineTile: { opacity: 0.55 },
  centerBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  centerText: { color: '#7c6a9e', fontSize: 14, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 14, backgroundColor: '#6f4bd8' },
  retryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
