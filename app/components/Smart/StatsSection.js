import React from 'react';
import styled from 'styled-components/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TouchableOpacity, View, Text } from 'react-native';
import OnlineStatus from './OnlineStatus';
import { useNavigation } from '@react-navigation/native';
import styles from './SmartScreenSections/SmartScreen.styles';
import { MOCKUP_OPTIONS, getIntercomConfigByMockup } from './SmartScreenSections/SmartScreen.constants';

const StatsSection = ({ selectedOption, setSelectedOption, selectedMockup, setSelectedMockup, lanHeaders }) => {
  // Legacy: parent may have headers, but OnlineStatus now generates fresh ones per request.
  const lanAuthToken = lanHeaders?.Authorization ?? lanHeaders?.token ?? null;
  const navigation = useNavigation();
  const intercomConfig = getIntercomConfigByMockup(selectedMockup);
  return (
    <>
      <View style={[styles.actionDockContainer, { marginTop: 8 }]}>
        {/* Contacts */}
        <TouchableOpacity 
          style={styles.actionButtonWrapper} 
          onPress={() => navigation.navigate('SdkTest')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionButtonIcon, { backgroundColor: '#f2ebff' }]}>
            <MaterialIcons name="contact-page" size={24} color="#6f4bd8" />
          </View>
          <Text style={styles.actionButtonLabel}>Contacts</Text>
        </TouchableOpacity>

        {/* Smart Lock */}
        <TouchableOpacity 
          style={styles.actionButtonWrapper} 
          onPress={() => navigation.navigate('SmartLockScreen', { selectedOption, selectedMockup })}
          activeOpacity={0.7}
        >
          <View style={[styles.actionButtonIcon, { backgroundColor: '#efe6ff' }]}>
            <MaterialIcons name="door-sliding" size={24} color="#6f4bd8" />
          </View>
          <Text style={styles.actionButtonLabel}>Locks</Text>
        </TouchableOpacity>

        {/* Intercom */}
        <TouchableOpacity 
          style={styles.actionButtonWrapper} 
          onPress={() => navigation.navigate('IntercomScreen', {
            selectedOption,
            selectedMockup,
            deviceId: intercomConfig.deviceId,
            lanRtspUrl: intercomConfig.lanRtspUrl,
            wanRtspUrl: intercomConfig.wanRtspUrl,
            LAN_HEADERS: lanHeaders
          })}
          activeOpacity={0.7}
        >
          <View style={[styles.actionButtonIcon, { backgroundColor: '#efe6ff' }]}>
            <MaterialIcons name="sensor-door" size={24} color="#6f4bd8" />
          </View>
          <Text style={styles.actionButtonLabel}>Intercom</Text>
        </TouchableOpacity>

        {/* IP Camera */}
        <TouchableOpacity 
          style={styles.actionButtonWrapper} 
          onPress={() => navigation.navigate('IPCameraScreen', { selectedOption })}
          activeOpacity={0.7}
        >
          <View style={[styles.actionButtonIcon, { backgroundColor: '#f2ebff' }]}>
            <MaterialCommunityIcons name="cctv" size={24} color="#6f4bd8" />
          </View>
          <Text style={styles.actionButtonLabel}>Cameras</Text>
        </TouchableOpacity>
      </View>

      <RadioRow>
        <RadioContainer>
          <RadioOption onPress={() => setSelectedOption('LAN')}>
            <RadioCircle selected={selectedOption === 'LAN'} />
            <RadioText>LAN</RadioText>
          </RadioOption>

          <RadioOption onPress={() => setSelectedOption('WAN')}>
            <RadioCircle selected={selectedOption === 'WAN'} />
            <RadioText>WAN</RadioText>
          </RadioOption>
        </RadioContainer>
        <NavigateButton
          onPress={() => navigation.navigate('DeviceStatuses', { selectedOption, selectedMockup, lanAuthToken })}
        >
          <NavigateText>All Devices Status</NavigateText>
        </NavigateButton>
        <OnlineStatus selectedOption={selectedOption} selectedMockup={selectedMockup} />
      </RadioRow>

      <MockupRow>
        <MockupLabel>Device Set</MockupLabel>
        <RadioContainer>
          <RadioOption onPress={() => setSelectedMockup(MOCKUP_OPTIONS.MOCKUP_1)}>
            <RadioCircle selected={selectedMockup === MOCKUP_OPTIONS.MOCKUP_1} />
            <RadioText>Mockup 1</RadioText>
          </RadioOption>

          <RadioOption onPress={() => setSelectedMockup(MOCKUP_OPTIONS.MOCKUP_2)}>
            <RadioCircle selected={selectedMockup === MOCKUP_OPTIONS.MOCKUP_2} />
            <RadioText>Mockup 2</RadioText>
          </RadioOption>
        </RadioContainer>
      </MockupRow>
    </>
  );
};

export default StatsSection;

// Styled Components unchanged...
const StatsContainer = styled.View`
  flex-direction: row;
  justify-content: space-around;
  padding: 16px;
  background-color: #ffffff;
  margin: 16px;
  border-radius: 12px;
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-radius: 10px;
  elevation: 5;
`;

const Stat = styled.View`
  align-items: center;
`;

const StatValue = styled.Text`
  font-size: 18px;
  font-weight: bold;
  color: #2d3748;
`;

const StatLabel = styled.Text`
  font-size: 12px;
  color: #7d8da6;
`;

const RadioRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  margin-top: 2px;
`;

const RadioContainer = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: #ffffff;
  border-width: 1px;
  border-color: #e7dcff;
  border-radius: 999px;
  padding: 4px;
`;

const RadioOption = styled(TouchableOpacity)`
  flex-direction: row;
  align-items: center;
  margin: 0 2px;
  padding: 4px 10px;
  border-radius: 999px;
`;

const RadioCircle = styled.View`
  width: 18px;
  height: 18px;
  border-radius: 9px;
  border: 2px solid #7f58e2;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => (props.selected ? '#7f58e2' : '#ffffff')};
`;

const RadioText = styled.Text`
  margin-left: 6px;
  font-size: 13px;
  color: #4f3a8a;
  font-weight: 700;
`;

const NavigateButton = styled(TouchableOpacity)`
  flex-direction: row;
  align-items: center;
  background-color: #efe6ff;
  padding: 8px 10px;
  border-radius: 12px;
`;

const NavigateText = styled.Text`
  font-size: 11px;
  color: #5d41b0;
  font-weight: 700;
`;

const MockupRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 0 14px;
`;

const MockupLabel = styled.Text`
  font-size: 12px;
  color: #6b54a8;
  font-weight: 700;
`;