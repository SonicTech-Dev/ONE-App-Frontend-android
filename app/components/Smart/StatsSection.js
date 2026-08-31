import React, { useState } from 'react';
import styled from 'styled-components/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Modal, ScrollView, TouchableOpacity, View, Text } from 'react-native';
import OnlineStatus from './OnlineStatus';
import { useNavigation } from '@react-navigation/native';
import styles from './SmartScreenSections/SmartScreen.styles';
import { MOCKUP_OPTIONS, getIntercomConfigByMockup } from './SmartScreenSections/SmartScreen.constants';

const StatsSection = ({
  selectedOption,
  setSelectedOption,
  selectedMockup,
  setSelectedMockup,
  selectedResidenceId,
  familyOptions = [],
  familyListLoading = false,
  onSelectFamily,
  lanHeaders,
}) => {
  // Legacy: parent may have headers, but OnlineStatus now generates fresh ones per request.
  const lanAuthToken = lanHeaders?.Authorization ?? lanHeaders?.token ?? null;
  const navigation = useNavigation();
  const intercomConfig = getIntercomConfigByMockup(selectedMockup);
  const [familyDropdownVisible, setFamilyDropdownVisible] = useState(false);
  const selectedFamily = familyOptions.find((family) => family?.residence_id === selectedResidenceId) || familyOptions[0];
  const selectedFamilyName = selectedFamily?.family_name || 'Select family';

  const handleFamilyPress = (family) => {
    setFamilyDropdownVisible(false);
    if (onSelectFamily) {
      onSelectFamily(family);
    } else if (family?.residence_id?.includes('45844047053')) {
      setSelectedMockup(MOCKUP_OPTIONS.MOCKUP_1);
    } else {
      setSelectedMockup(MOCKUP_OPTIONS.MOCKUP_2);
    }
  };

  return (
    <>
      <View style={[styles.actionDockContainer, { marginTop: 8 }]}>
        {/* Contacts */}
        <TouchableOpacity 
          style={styles.actionButtonWrapper} 
          onPress={() => navigation.navigate('SdkTest', { selectedMockup, selectedOption, selectedResidenceId })}
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
          onPress={() => navigation.navigate('SmartLockScreen', { selectedOption, selectedMockup, selectedResidenceId })}
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
            selectedResidenceId,
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

        {/* Scenes */}
        <TouchableOpacity
          style={styles.actionButtonWrapper}
          onPress={() => navigation.navigate('ScenesScreen', { selectedOption, selectedMockup, selectedResidenceId })}
          activeOpacity={0.7}
        >
          <View style={[styles.actionButtonIcon, { backgroundColor: '#efe6ff' }]}>
            <MaterialCommunityIcons name="play-box-multiple-outline" size={24} color="#6f4bd8" />
          </View>
          <Text style={styles.actionButtonLabel}>Scenes</Text>
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
          onPress={() => navigation.navigate('DeviceStatuses', { selectedOption, selectedMockup, selectedResidenceId, lanAuthToken })}
        >
          <NavigateText>All Devices Status</NavigateText>
        </NavigateButton>
        <OnlineStatus selectedOption={selectedOption} selectedMockup={selectedMockup} residenceId={selectedResidenceId} />
      </RadioRow>

      <MockupRow>
        <MockupLabel>Family</MockupLabel>
        <FamilyDropdownButton onPress={() => setFamilyDropdownVisible(true)} activeOpacity={0.8}>
          <FamilyDropdownText numberOfLines={1}>{selectedFamilyName}</FamilyDropdownText>
          {familyListLoading ? (
            <ActivityIndicator size="small" color="#6f4bd8" />
          ) : (
            <MaterialCommunityIcons name="chevron-down" size={20} color="#6f4bd8" />
          )}
        </FamilyDropdownButton>
      </MockupRow>

      <Modal
        visible={familyDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFamilyDropdownVisible(false)}
      >
        <DropdownBackdrop>
          <DropdownCard>
            <DropdownHeader>
              <DropdownTitle>Select family</DropdownTitle>
              <TouchableOpacity onPress={() => setFamilyDropdownVisible(false)} accessibilityLabel="Close family selector">
                <MaterialCommunityIcons name="close" size={22} color="#6f4bd8" />
              </TouchableOpacity>
            </DropdownHeader>
            <ScrollView>
              {familyOptions.map((family) => {
                const isSelected = family?.residence_id === selectedResidenceId;
                return (
                  <FamilyOption
                    key={family?.residence_id || family?.family_name}
                    onPress={() => handleFamilyPress(family)}
                    selected={isSelected}
                    activeOpacity={0.75}
                  >
                    <FamilyOptionIcon selected={isSelected}>
                      <MaterialCommunityIcons name="home-account" size={20} color={isSelected ? '#ffffff' : '#6f4bd8'} />
                    </FamilyOptionIcon>
                    <FamilyOptionBody>
                      <FamilyOptionName numberOfLines={1}>{family?.family_name || 'Unnamed family'}</FamilyOptionName>
                      <FamilyOptionStatus>
                        {family?.online ? 'Online' : 'Offline'} · {family?.installed ? 'Installed' : 'Not installed'}
                      </FamilyOptionStatus>
                    </FamilyOptionBody>
                    {isSelected ? <MaterialCommunityIcons name="check-circle" size={20} color="#6f4bd8" /> : null}
                  </FamilyOption>
                );
              })}
            </ScrollView>
          </DropdownCard>
        </DropdownBackdrop>
      </Modal>
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

const FamilyDropdownButton = styled(TouchableOpacity)`
  flex: 1;
  margin-left: 12px;
  min-height: 42px;
  border-radius: 14px;
  border-width: 1px;
  border-color: #e7dcff;
  background-color: #ffffff;
  padding: 0 12px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const FamilyDropdownText = styled.Text`
  flex: 1;
  color: #4f3a8a;
  font-size: 13px;
  font-weight: 800;
  margin-right: 8px;
`;

const DropdownBackdrop = styled.View`
  flex: 1;
  background-color: rgba(30, 18, 56, 0.42);
  justify-content: center;
  padding: 22px;
`;

const DropdownCard = styled.View`
  background-color: #ffffff;
  border-radius: 20px;
  padding: 16px;
  max-height: 70%;
`;

const DropdownHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const DropdownTitle = styled.Text`
  color: #34225f;
  font-size: 18px;
  font-weight: 800;
`;

const FamilyOption = styled(TouchableOpacity)`
  flex-direction: row;
  align-items: center;
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 10px;
  background-color: ${(props) => (props.selected ? '#f2ebff' : '#fbf9ff')};
  border-width: 1px;
  border-color: ${(props) => (props.selected ? '#d9c8ff' : '#eee7fb')};
`;

const FamilyOptionIcon = styled.View`
  width: 38px;
  height: 38px;
  border-radius: 19px;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  background-color: ${(props) => (props.selected ? '#6f4bd8' : '#efe6ff')};
`;

const FamilyOptionBody = styled.View`
  flex: 1;
`;

const FamilyOptionName = styled.Text`
  color: #34225f;
  font-size: 14px;
  font-weight: 800;
`;

const FamilyOptionStatus = styled.Text`
  color: #8975a8;
  font-size: 12px;
  font-weight: 600;
  margin-top: 3px;
`;