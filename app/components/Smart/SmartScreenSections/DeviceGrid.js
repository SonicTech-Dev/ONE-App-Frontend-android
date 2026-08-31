import React from 'react';
import { ScrollView, View, TouchableOpacity, Text } from 'react-native';

import DeviceTile from '../DeviceTile';
import styles from './SmartScreen.styles';

export default function DeviceGrid({
  filteredDevices,
  handleToggle,
  navigation,
  setSelectedDevice,
  selectedOption,
  lanHeaders,
  setModalVisible,
  activeTab, // Use activeTab to determine which tab is selected
  disabled = false,
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} scrollEventThrottle={16}>
      {/* Device Tiles */}
      {filteredDevices
        .reduce((result, device, index) => {
          if (index % 2 === 0) result.push([device]);
          else result[result.length - 1].push(device);
          return result;
        }, [])
        .map((row, rowIndex) => (
          <View key={rowIndex} style={styles.deviceRow}>
            {row.map((device, index) => {
              const deviceKey = `${device.title}-${device.location}-${index}`;
              return (
                <DeviceTile
                  key={deviceKey}
                  title={device.title}
                  location={device.location}
                  status={device.status}
                  color={device.color}
                  isOn={device.isOn}
                  iconName={device.iconName}
                  library={device.library}
                  onToggle={(newControl) => handleToggle(device, newControl)}
                  disabled={disabled || !device?.[String(selectedOption || '').toLowerCase()]?.commandPair}
                  selectedOption={selectedOption}
                  onPress={() => {
                    if (disabled) return;
                    setSelectedDevice(device);
                    setModalVisible(true);
                  }}
                  style={disabled ? styles.disabledDeviceTile : null}
                />
              );
            })}
          </View>
        ))}
    </ScrollView>
  );
}