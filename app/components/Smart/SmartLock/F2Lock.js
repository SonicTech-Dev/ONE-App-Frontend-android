import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import Screen from '../../Screen';
import { useAuth } from '../../../context/AuthContext';
import { controlDevice, deviceStatus as fetchDeviceStatus } from '../SmartScreenSections/api';

// Optional manual mapping for F2 lock. Fill values to force direct control
// without relying on auto-discovery.
const MANUAL_F2_LOCK_CONFIG = {
  LAN: {
    device_id: 'b7ab1bc7a91ca0c7467aff8785d8ff6b',
    ability_id: 'lock.da51a81b4eef38be28040a9c3df9818d',
    commandPair: { on: 'turn_off', off: 'turn_on' },
  },
  WAN: {
    device_id: 'd1f1c948bb3ac4910b5f26e828c6fb702',
    ability_id: 'eb331cef8bfc741b0a263b15b4e37559c',
    commandPair: { on: 'lock', off: 'unlock' },
  },
};

function normalizeMode(mode) {
  const parsed = String(mode || '').toUpperCase();
  return parsed === 'LAN' || parsed === 'WAN' ? parsed : 'WAN';
}

function parseLockViewState(deviceStatus, device) {
  let lockState = 'unknown';
  let battery;
  let tamperState = 'unknown';
  let online = null;
  let deviceType = '';
  let productName = '';

  const result = deviceStatus?.result || deviceStatus;

  let abilities = [];
  if (Array.isArray(result?.abilities)) {
    abilities = result.abilities;
  } else if (Array.isArray(deviceStatus?.abilities)) {
    abilities = deviceStatus.abilities;
  } else if (Array.isArray(result)) {
    for (const item of result) {
      if (Array.isArray(item?.abilities) && item.abilities.length > 0) {
        abilities = item.abilities;
        break;
      }
    }
  } else if (Array.isArray(result?.devices)) {
    for (const item of result.devices) {
      if (Array.isArray(item?.abilities) && item.abilities.length > 0) {
        abilities = item.abilities;
        break;
      }
    }
  } else if (Array.isArray(result?.sub_devices)) {
    for (const item of result.sub_devices) {
      if (Array.isArray(item?.abilities) && item.abilities.length > 0) {
        abilities = item.abilities;
        break;
      }
    }
  }

  const lockAbility = abilities.find((a) => {
    if (!a) return false;
    const type = String(a.ability_type || a.domain || '').toLowerCase();
    const name = String(a.ability_name || a.name || '').toLowerCase();
    const id = String(a.ability_id || a.id || '').toLowerCase();

    return (
      type === 'lock' ||
      type.includes('lock') ||
      name === 'lock' ||
      name.includes('lock') ||
      id.includes('lock') ||
      id === 'eb331cef8bfc741b0a263b15b4e37559c' ||
      id === 'lock.da51a81b4eef38be28040a9c3df9818d'
    );
  });

  if (lockAbility && lockAbility.state !== undefined) {
    const raw = String(lockAbility.state).toLowerCase();
    if (raw === 'on' || raw === 'unlocked' || raw === 'open' || raw === '1' || raw === 'true') {
      lockState = 'unlocked';
    } else if (raw === 'off' || raw === 'locked' || raw === 'close' || raw === 'closed' || raw === '0' || raw === 'false') {
      lockState = 'locked';
    } else {
      lockState = raw;
    }
  }

  const batteryAbility = abilities.find((a) => {
    if (!a) return false;
    const type = String(a.ability_type || a.domain || '').toLowerCase();
    const name = String(a.ability_name || a.name || '').toLowerCase();
    const id = String(a.ability_id || a.id || '').toLowerCase();
    return type.includes('battery') || name.includes('battery') || id.includes('battery');
  });

  if (batteryAbility && batteryAbility.state !== undefined) {
    battery = batteryAbility.state;
  }

  const tamperAbility = abilities.find((a) => {
    if (!a) return false;
    const type = String(a.ability_type || a.domain || '').toLowerCase();
    const name = String(a.ability_name || a.name || '').toLowerCase();
    const id = String(a.ability_id || a.id || '').toLowerCase();
    const attrType = String(a.attribute?.type || '').toLowerCase();

    return (
      type.includes('tamper') ||
      name.includes('tamper') ||
      id.includes('tamper') ||
      attrType.includes('tamper') ||
      name.includes('alarm')
    );
  });

  if (tamperAbility && tamperAbility.state !== undefined) {
    const raw = String(tamperAbility.state).toLowerCase();
    if (['on', 'tampered', 'alarm', 'true', '1'].includes(raw)) {
      tamperState = 'on';
    } else if (['off', 'ok', 'normal', 'false', '0', 'clear'].includes(raw)) {
      tamperState = 'off';
    } else {
      tamperState = raw;
    }
  }

  if (typeof result?.online === 'boolean') {
    online = result.online;
  } else if (typeof deviceStatus?.online === 'boolean') {
    online = deviceStatus.online;
  } else if (typeof result?._parentOnline === 'boolean') {
    online = result._parentOnline;
  } else if (abilities.length > 0) {
    online = true;
  }

  deviceType = result?.device_type || device?.device_type || '';
  productName =
    result?.product_name ||
    result?.device_name ||
    device?.product_name ||
    device?.device_name ||
    '';

  return {
    lockState,
    battery,
    tamperState,
    online,
    deviceType,
    productName,
  };
}

export default function F2LockModal({
  visible,
  onClose,
  device,
  deviceStatus: modalDeviceStatus,
  onToggleLock,
  lockLoading,
  route,
  navigation
}) {
  const isScreenMode = Boolean(route && navigation && typeof visible === 'undefined');
  const { networkMode, getActiveLanToken, getActiveWanToken } = useAuth();

  const [screenStatus, setScreenStatus] = useState(null);
  const [screenDevice, setScreenDevice] = useState(null);
  const [screenDeviceMeta, setScreenDeviceMeta] = useState(null);
  const [screenLoading, setScreenLoading] = useState(false);
  const [screenLockLoading, setScreenLockLoading] = useState(false);
  const [screenError, setScreenError] = useState('');

  const selectedOptionFromRoute = normalizeMode(route?.params?.selectedOption || networkMode);
  const selectedMockup = route?.params?.selectedMockup || 'mockup1';
  const lockTitle = route?.params?.lockTitle || 'F2 SmartLock';

  const getManualConfig = useCallback(() => {
    // Route params can override constants if needed.
    const routeDeviceId = route?.params?.manualDeviceId;
    const routeAbilityId = route?.params?.manualAbilityId;
    if (routeDeviceId && routeAbilityId) {
      return {
        device_id: routeDeviceId,
        ability_id: routeAbilityId,
        commandPair: selectedOptionFromRoute === 'WAN'
          ? { on: 'lock', off: 'unlock' }
          : { on: 'turn_off', off: 'turn_on' },
      };
    }

    const modeConfig = MANUAL_F2_LOCK_CONFIG[selectedOptionFromRoute];
    if (modeConfig?.device_id && modeConfig?.ability_id) {
      return modeConfig;
    }
    return null;
  }, [route?.params?.manualAbilityId, route?.params?.manualDeviceId, selectedOptionFromRoute]);

  const getHeaders = useCallback(async () => {
    const token = selectedOptionFromRoute === 'LAN'
      ? await getActiveLanToken()
      : await getActiveWanToken();
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [getActiveLanToken, getActiveWanToken, selectedOptionFromRoute]);

  const loadDirectStatusByDeviceId = useCallback(
    async (deviceId) => {
      const headers = await getHeaders();
      const manualConfig = getManualConfig();
      await fetchDeviceStatus(deviceId, selectedOptionFromRoute, setScreenStatus, headers, {
        deviceTitle: lockTitle,
        abilityId: manualConfig?.ability_id,
        selectedMockup,
      });
    },
    [getHeaders, getManualConfig, lockTitle, selectedOptionFromRoute, selectedMockup]
  );

  const loadManualF2Status = useCallback(async () => {
    if (!isScreenMode) return;

    setScreenLoading(true);
    setScreenError('');
    try {
      const manualConfig = getManualConfig();
      if (manualConfig) {
        setScreenDeviceMeta({
          title: lockTitle,
          device_name: lockTitle,
          product_name: 'Manual Mapping',
          device_type: 'F2',
        });
        setScreenDevice({
          device_id: manualConfig.device_id,
          ability_id: manualConfig.ability_id,
          commandPair: manualConfig.commandPair || (selectedOptionFromRoute === 'WAN'
            ? { on: 'lock', off: 'unlock' }
            : { on: 'turn_off', off: 'turn_on' }),
        });
        await loadDirectStatusByDeviceId(manualConfig.device_id);
      } else {
        throw new Error(
          `Manual F2 mapping missing for ${selectedOptionFromRoute}. Set device_id and ability_id in MANUAL_F2_LOCK_CONFIG.`
        );
      }
    } catch (e) {
      setScreenError(e?.message || 'Failed to load F2 lock status.');
    } finally {
      setScreenLoading(false);
    }
  }, [getManualConfig, isScreenMode, loadDirectStatusByDeviceId, lockTitle, selectedOptionFromRoute]);

  const handleScreenSetLock = useCallback(async (targetAction) => {
    if (!screenDevice?.device_id || !screenDevice?.ability_id) {
      Alert.alert('F2 Lock', 'F2 lock device is not ready yet.');
      return;
    }

    setScreenLockLoading(true);
    try {
      const headers = await getHeaders();
      const primaryCommand = targetAction === 'lock'
        ? (screenDevice.commandPair?.on || (selectedOptionFromRoute === 'WAN' ? 'lock' : 'turn_off'))
        : (screenDevice.commandPair?.off || (selectedOptionFromRoute === 'WAN' ? 'unlock' : 'turn_on'));
      const fallbackCommands = targetAction === 'lock'
        ? ['lock', 'turn_off', 'off', 'close', '0']
        : ['unlock', 'turn_on', 'on', 'open', '1'];

      const commandCandidates = [
        primaryCommand,
        ...fallbackCommands,
      ].filter((v, index, arr) => !!v && arr.indexOf(v) === index);

      let controlSucceeded = false;
      let lastErrorMessage = '';

      for (const command of commandCandidates) {
        const response = await controlDevice(
          screenDevice.device_id,
          screenDevice.ability_id,
          command,
          null,
          selectedOptionFromRoute,
          headers,
          { suppressErrorAlert: true, selectedMockup }
        );

        const data = response?.data;
        const hasHttpOk = Boolean(response?.ok);
        const hasCodeError = data && typeof data.code === 'number' && data.code !== 0 && data.code !== 200;
        const hasResultError = data && (data.result === 'fail' || data.result === 'error' || data.status === 'fail');

        if (hasHttpOk && !hasCodeError && !hasResultError) {
          controlSucceeded = true;
          break;
        } else {
          lastErrorMessage = data?.msg || data?.message || response?.error?.message || '';
        }
      }

      if (!controlSucceeded) {
        throw new Error(
          lastErrorMessage || `Failed to ${targetAction} the F2 lock. Please verify ability ID and command mapping.`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadDirectStatusByDeviceId(screenDevice.device_id);
      setScreenError('');
    } catch (err) {
      const message = err?.message || `Failed to ${targetAction} the F2 lock.`;
      setScreenError(message);
      Alert.alert('F2 Lock', message);
    } finally {
      setScreenLockLoading(false);
    }
  }, [getHeaders, loadDirectStatusByDeviceId, screenDevice, selectedOptionFromRoute, selectedMockup]);

  useEffect(() => {
    if (isScreenMode) {
      loadManualF2Status();
    }
  }, [isScreenMode, loadManualF2Status]);

  if (isScreenMode) {
    const lockView = parseLockViewState(screenStatus, screenDeviceMeta);

    return (
      <Screen style={styles.screenRoot}>
        <View style={styles.screenContent}>
          <View style={styles.screenHeaderCard}>
            <Text style={styles.screenTitle}>{lockTitle}</Text>
            <Text style={styles.screenSubtitle}>F2 lock control and live status page.</Text>
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>Current Mode: {selectedOptionFromRoute}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            {screenLoading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color="#6f4bd8" />
                <Text style={styles.loadingText}>Loading F2 lock status...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.infoTitle}>{screenDeviceMeta?.device_name || lockTitle}</Text>
                <View style={styles.statusRow}>
                  <Text style={styles.label}>Online Status:</Text>
                  <Text
                    style={[
                      styles.value,
                      lockView.online === true
                        ? styles.online
                        : styles.offline,
                    ]}
                  >
                    {lockView.online === true
                      ? 'Online'
                      : lockView.online === false
                        ? 'Offline'
                        : 'Unknown'}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.label}>Lock State:</Text>
                  <Text
                    style={[
                      styles.value,
                      lockView.lockState === 'locked'
                        ? styles.on
                        : lockView.lockState === 'unlocked'
                          ? styles.off
                          : styles.unknown,
                    ]}
                  >
                    {lockView.lockState === 'locked'
                      ? 'Locked'
                      : lockView.lockState === 'unlocked'
                        ? 'Unlocked'
                        : String(lockView.lockState)}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.label}>Tamper Alarm:</Text>
                  <Text
                    style={[
                      styles.value,
                      lockView.tamperState === 'on'
                        ? styles.on
                        : lockView.tamperState === 'off'
                          ? styles.off
                          : styles.unknown,
                    ]}
                  >
                    {lockView.tamperState === 'on'
                      ? 'TAMPERED'
                      : lockView.tamperState === 'off'
                        ? 'OK'
                        : String(lockView.tamperState)}
                  </Text>
                </View>

                {lockView.battery !== undefined && (
                  <View style={styles.statusRow}>
                    <Text style={styles.label}>Battery:</Text>
                    <Text style={styles.value}>
                      {lockView.battery !== 'unknown'
                        ? `${lockView.battery}%`
                        : 'unknown'}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {screenError ? <Text style={styles.screenError}>{screenError}</Text> : null}

          <TouchableOpacity
            style={styles.refreshButton}
            activeOpacity={0.88}
            onPress={loadManualF2Status}
            disabled={screenLoading}
          >
            <Text style={styles.refreshButtonText}>Refresh Status</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.lockActionButton, (!screenStatus || screenLockLoading) && styles.disabledButton]}
              activeOpacity={0.88}
              onPress={() => handleScreenSetLock('lock')}
              disabled={!screenStatus || screenLockLoading}
            >
              <Text style={styles.actionButtonText}>Lock</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.unlockActionButton, (!screenStatus || screenLockLoading) && styles.disabledButton]}
              activeOpacity={0.88}
              onPress={() => handleScreenSetLock('unlock')}
              disabled={!screenStatus || screenLockLoading}
            >
              {screenLockLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Unlock</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    );
  }

  // Handles both LAN and WAN responses

  const parsed = parseLockViewState(modalDeviceStatus, device);
  const lockState = parsed.lockState;
  const battery = parsed.battery;
  const tamperState = parsed.tamperState;
  const online = parsed.online;
  const deviceType = parsed.deviceType;
  const productName = parsed.productName;

  const isLocked = useMemo(() => lockState === "locked", [lockState]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={{ fontSize: 22 }}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{device?.title || productName || deviceType}</Text>
          {!modalDeviceStatus ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <ActivityIndicator size="large" color="#32d2d6" />
            </View>
          ) : (
            <View style={styles.statusContainer}>
              <View style={styles.statusRow}>
                <Text style={styles.label}>Online Status:</Text>
                <Text style={[
                  styles.value,
                  online === true ? styles.online : styles.offline
                ]}>
                  {online === true ? "Online" : online === false ? "Offline" : "Unknown"}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.label}>Lock State:</Text>
                <Text style={[
                  styles.value,
                  lockState === "locked" ? styles.on : lockState === "unlocked" ? styles.off : styles.unknown
                ]}>
                  {lockState === "locked" ? "Locked" : lockState === "unlocked" ? "Unlocked" : String(lockState)}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.label}>Tamper Alarm:</Text>
                <Text style={[
                  styles.value,
                  tamperState === "on" ? styles.on : tamperState === "off" ? styles.off : styles.unknown
                ]}>
                  {tamperState === "on" ? "TAMPERED" : tamperState === "off" ? "OK" : String(tamperState)}
                </Text>
              </View>
              {battery !== undefined && (
                <View style={styles.statusRow}>
                  <Text style={styles.label}>Battery:</Text>
                  <Text style={styles.value}>
                    {battery !== "unknown" ? `${battery}%` : "unknown"}
                  </Text>
                </View>
              )}
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.lockButton,
              isLocked ? styles.lockedButton : styles.unlockedButton,
              lockLoading && styles.disabledButton
            ]}
            onPress={onToggleLock}
            disabled={lockLoading || lockState === "unknown"}
          >
            {lockLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.lockButtonText}>
                {isLocked ? "Unlock" : "Lock"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    backgroundColor: '#f4f0ff',
  },
  screenContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 14,
  },
  screenHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#e7dcff',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2d2f4f',
    marginBottom: 6,
    textAlign: 'center',
  },
  screenSubtitle: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 12,
    textAlign: 'center',
  },
  modePill: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#efe6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modePillText: {
    color: '#5d41b0',
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#e7dcff',
  },
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    marginTop: 8,
    color: '#5d41b0',
    fontWeight: '600',
  },
  screenError: {
    color: '#b42318',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  refreshButton: {
    width: '92%',
    alignSelf: 'center',
    backgroundColor: '#efe6ff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9c9ff',
  },
  refreshButtonText: {
    color: '#5d41b0',
    fontWeight: '700',
    fontSize: 14,
  },
  actionRow: {
    width: '92%',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  lockActionButton: {
    backgroundColor: '#6f4bd8',
  },
  unlockActionButton: {
    backgroundColor: '#fd5f43',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  infoTitle: {
    fontSize: 18,
    color: '#25344d',
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#6c7a90',
    lineHeight: 20,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(111,75,216,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '70%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 2,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 10,
    textAlign: 'center',
  },
  statusContainer: {
    width: '100%',
    marginVertical: 10,
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'space-between',
    width: '90%',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  label: {
    fontSize: 16,
    color: '#7a7b7c',
    flex: 1,
    textAlign: 'left',
    fontWeight: '500',
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
    flex: 1,
    textAlign: 'right',
  },
  on: {
    color: 'red',
  },
  off: {
    color: 'green',
  },
  unknown: {
    color: '#888',
  },
  online: {
    color: 'green',
  },
  offline: {
    color: 'red',
  },
  lockButton: {
    width: '80%',
    marginTop: 18,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedButton: {
    backgroundColor: '#fd5f43',
  },
  unlockedButton: {
    backgroundColor: '#32d2d6',
  },
  disabledButton: {
    opacity: 0.5,
  },
  lockButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});