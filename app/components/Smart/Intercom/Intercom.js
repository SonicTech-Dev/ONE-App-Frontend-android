import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import RTSPViewer from './RTSPViewer';
import Screen from '../../Screen';
import { useAuth } from '../../../context/AuthContext';
import { MOCKUP_OPTIONS, getIntercomConfigByMockup } from '../SmartScreenSections/SmartScreen.constants';

const BACKEND_CONTROL_URL = 'https://one-development.soniciot.com/control_devices/';

export default function Intercom({ route }) {
  const params = route?.params || {};
  const selectedMockup = params.selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? MOCKUP_OPTIONS.MOCKUP_1
    : MOCKUP_OPTIONS.MOCKUP_2;
  const fallbackConfig = getIntercomConfigByMockup(selectedMockup);
  const residenceId = selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? 'r45844047053e43d78fe5272c5badbd3a'
    : 'rabd2c6d2aecc4ce3be11e25b4ecd3c82';

  const isLAN = String(params.selectedOption || 'LAN').toLowerCase() === 'lan';
  const selectedOption = isLAN ? 'LAN' : 'WAN';

  const { getActiveLanToken, getActiveWanToken } = useAuth();

  const deviceId = params.deviceId || fallbackConfig.deviceId;
  const lanRtspUrl = params.lanRtspUrl || fallbackConfig.lanRtspUrl;
  const wanRtspUrl = params.wanRtspUrl || fallbackConfig.wanRtspUrl;

  const uri = useMemo(
    () => (isLAN ? lanRtspUrl : wanRtspUrl),
    [isLAN, lanRtspUrl, wanRtspUrl],
  );

  const onPressUnlockDoor = async () => {
    try {
      if (isLAN) {
        const lanToken = await getActiveLanToken();
        const resp = await fetch('http://192.168.2.115/api/v1.0/device', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${lanToken}`,
          },
          body: JSON.stringify({
            command: 'control_device',
            id: 'c45e846ca23ab42c9ae469d988ae32a96',
            param: {
              device_id: deviceId,
              ability_id: `doorphone.${deviceId}`,
              action: 'unlock',
              attribute: { lock: [0] },
            },
          }),
        });
        if (!resp.ok) {
          console.warn('LAN unlock failed:', resp.status);
        }
      } else {
        const wanToken = await getActiveWanToken();
        const resp = await fetch(BACKEND_CONTROL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${wanToken}`,
          },
          body: JSON.stringify({
            command: 'trigger_akuvox_remote_open_door',
            id: 'c45e846ca23ab42c9ae469d988ae32a96',
            param: {
              mac: deviceId,
              residence_id: residenceId,
              relay_id: '0',
            },
          }),
        });
        if (!resp.ok) {
          console.warn('WAN unlock failed:', resp.status);
        }
      }
    } catch (err) {
      console.error('Unlock error:', err);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Intercom R29</Text>
            <Text style={styles.headerSubtitle}>Front Entrance</Text>
          </View>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>{selectedOption}</Text>
          </View>
        </View>

        <View style={styles.videoWrapper}>
          <RTSPViewer uri={uri} />
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerSubtitle}>Click the button to unlock door</Text>
          <TouchableOpacity
            style={styles.unlockButton}
            onPress={onPressUnlockDoor}
            activeOpacity={0.82}
          >
            <Text style={styles.unlockButtonText}>Unlock Door</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

const PURPLE = '#6f4bd8';
const PURPLE_LIGHT = '#f4f0ff';
const PURPLE_BORDER = '#e7dcff';
const PURPLE_DARK = '#4e3099';
const TEXT_DARK = '#1a1533';
const TEXT_MID = '#6c7a90';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PURPLE_LIGHT,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TEXT_MID,
    marginTop: 2,
  },
  modeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: PURPLE,
  },
  modeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  videoWrapper: {
    height: Math.round(Dimensions.get('window').height * 0.45),
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 16,
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(111, 75, 216, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 5,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  footer: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: PURPLE_BORDER,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  footerTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  footerSubtitle: {
    color: TEXT_MID,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  unlockButton: {
    backgroundColor: PURPLE,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: PURPLE_DARK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  unlockButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
});