import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import RTSPViewer from './RTSPViewer';
import Screen from '../../Screen';

const CAMERAS = [
  {
    key: 'camera1',
    label: 'Camera 1',
    title: 'Hikvision Camera',
    urls: {
      LAN: 'rtsp://admin:Sonic123@192.168.2.121:554',
      WAN: 'rtsp://d4f54a92bea2a440c8a6a23d0b636dcf7:p5241f530fefc4497923e3db8de08c851@rtsp-a.ecloud.akubela.com:10554/TD-0C110500755C-ib89acd84d5864f288393fbe35775cf78',
    },
  },
  {
    key: 'camera2',
    label: 'Camera 2',
    title: 'Dahua Camera',
    urls: {
      LAN: 'rtsp://admin:Sonic123@192.168.2.122:554/cam/realmonitor?channel=1&subtype=0',
      WAN: 'rtsp://d4f54a92bea2a440c8a6a23d0b636dcf7:p5241f530fefc4497923e3db8de08c851@rtsp-a.ecloud.akubela.com:10554/TD-0C110500755C-i6213d5a5865342199b69b21c1e7592f4',
    },
  },
  {
    key: 'camera3',
    label: 'Camera 3',
    title: 'Entrance Camera',
    urls: {
      LAN: 'rtsp://admin:Sonic123@192.168.2.123:554/cam/realmonitor?channel=1&subtype=0',
      WAN: 'rtsp://d4f54a92bea2a440c8a6a23d0b636dcf7:p5241f530fefc4497923e3db8de08c851@rtsp-a.ecloud.akubela.com:10554/TD-0C110500755C-idf4027bb4b2b45c8aae58f3d29c2fe7b',
    },
  },
];


export default function CameraView({ route }) {
  const selectedOption = route?.params?.selectedOption === 'WAN' ? 'WAN' : 'LAN';
  const [selectedCameraKey, setSelectedCameraKey] = useState(CAMERAS[0].key);
  const selectedCamera = CAMERAS.find((camera) => camera.key === selectedCameraKey) || CAMERAS[0];

  // Choose the appropriate RTSP URL based on `selectedOption`
  const uri = useMemo(() => {
    return selectedOption === 'LAN' ? selectedCamera.urls.LAN : selectedCamera.urls.WAN;
  }, [selectedOption, selectedCamera]);

  const { width } = Dimensions.get('window');
  const playerHeight = Math.round((width * 9) / 16); // 16:9 player

  return (
    <Screen style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.contextChip}>
            <Text style={styles.contextChipText}>Camera Hub</Text>
          </View>
          <View style={[styles.contextChip, styles.modeChip]}>
            <Text style={styles.modeChipText}>{selectedOption}</Text>
          </View>
        </View>

        <View style={styles.contentCard}>
          <Text style={styles.cardTitle}>Live Cameras</Text>
          <Text style={styles.cardSubtitle}>Switch feeds and monitor entrances in real time.</Text>

          <View style={styles.tabContainer}>
            {CAMERAS.map((camera) => (
              <TouchableOpacity
                key={camera.key}
                style={[styles.tabButton, selectedCameraKey === camera.key && styles.tabButtonActive]}
                onPress={() => setSelectedCameraKey(camera.key)}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    selectedCameraKey === camera.key && styles.tabButtonTextActive,
                  ]}
                >
                  {camera.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.playerContainer, { height: playerHeight }]}>
            <RTSPViewer uri={uri} style={styles.player} />
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f0ff' },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  contextChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7dcff',
  },
  contextChipText: {
    color: '#6548b2',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modeChip: {
    backgroundColor: '#6f4bd8',
    borderColor: '#6f4bd8',
  },
  modeChipText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  contentCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e7dcff',
    shadowColor: '#7f58e2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    color: '#263650',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#6c7a90',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4d6ff',
  },
  tabButtonActive: {
    backgroundColor: '#6f4bd8',
    borderColor: '#6f4bd8',
    shadowColor: '#6f4bd8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 3,
  },
  tabButtonText: {
    color: '#684caf',
    fontSize: 14,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  playerContainer: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#e4d7ff',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(111,75,216,0.8)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  player: { width: '100%', height: '100%' },
});