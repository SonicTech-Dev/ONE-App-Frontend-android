import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components/native';
import { useRoute } from '@react-navigation/native';
import {
  MOCKUP_OPTIONS,
  SMARTSCREEN_RESIDENCE_IDS,
  getDeviceCategoriesByMockup,
  getDeviceCategoriesByResidenceId,
} from '../Smart/SmartScreenSections/SmartScreen.constants';
import DeviceListOnlineStatus from './online_status_list';

const DeviceStatuses = () => {
  const route = useRoute();
  const {
    selectedOption = 'LAN',
    selectedMockup = MOCKUP_OPTIONS.MOCKUP_2,
    selectedResidenceId,
  } = route.params || {};

  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(false);
  const deviceCategories = useMemo(() => (
    selectedResidenceId
      ? getDeviceCategoriesByResidenceId(selectedResidenceId)
      : getDeviceCategoriesByMockup(selectedMockup)
  ), [selectedMockup, selectedResidenceId]);
  const allowNameFallback = selectedResidenceId
    ? selectedResidenceId === SMARTSCREEN_RESIDENCE_IDS.MOCKUP_2
    : selectedMockup === MOCKUP_OPTIONS.MOCKUP_2;

  const handleStatuses = useCallback((map) => {
    setStatusMap(map || {});
  }, []);
  const handleLoadingChange = useCallback((val) => {
    setLoading(!!val);
  }, []);

  return (
    <>
      {/* Single bulk fetch for all statuses by device_id */}
      <DeviceListOnlineStatus
        selectedOption={selectedOption}
        selectedMockup={selectedMockup}
        residenceId={selectedResidenceId}
        pollingInterval={30000}
        onStatuses={handleStatuses}
        onLoadingChange={handleLoadingChange}
      />

      <ScrollViewWrapper>
        <HeaderCard>
          <HeaderTitle>All Device Status</HeaderTitle>
          <HeaderSubtitle>Live health for every connected smart device.</HeaderSubtitle>
        </HeaderCard>
        {deviceCategories.map((category, categoryIndex) => (
          <CategoryContainer key={categoryIndex}>
            <CategoryHeader>{category.category}</CategoryHeader>
            <DeviceGroup>
              {category.items.map((device, deviceIndex) => {
                const deviceId =
                  selectedOption === 'WAN'
                    ? device?.wan?.device_id
                    : device?.lan?.device_id;

                const titleKey = `name:${String(device?.title || '').trim().toLowerCase()}`;
                const hasIdStatus = typeof statusMap[deviceId] === 'boolean';
                const hasTitleStatus = allowNameFallback && typeof statusMap[titleKey] === 'boolean';
                const hasStatus = hasIdStatus || hasTitleStatus;
                const isOnline = hasIdStatus
                  ? statusMap[deviceId]
                  : hasTitleStatus
                    ? statusMap[titleKey]
                    : false;
                const isLast = deviceIndex === category.items.length - 1;

                return (
                  <DeviceRow key={deviceIndex} isLast={isLast}>
                    <DeviceInfo>
                      <DeviceName>{device.title}</DeviceName>
                      <DeviceLocation>{device.location}</DeviceLocation>
                    </DeviceInfo>

                    {loading && !hasStatus ? (
                      <StatusPill color="#f1ebff" borderColor="#ddd0ff">
                        <StatusInnerDot color="#8a68f0" />
                        <PillText>Checking</PillText>
                      </StatusPill>
                    ) : (
                      <StatusPill
                        color={isOnline ? 'rgba(111, 75, 216, 0.14)' : 'rgba(111, 75, 216, 0.08)'}
                        borderColor={isOnline ? 'rgba(111, 75, 216, 0.3)' : 'rgba(111, 75, 216, 0.18)'}
                      >
                        <StatusInnerDot color={isOnline ? '#6f4bd8' : '#9f8bcf'} />
                        <PillText color={isOnline ? '#5b38c2' : '#7f72a3'}>
                          {isOnline ? 'Online' : 'Offline'}
                        </PillText>
                      </StatusPill>
                    )}
                  </DeviceRow>
                );
              })}
            </DeviceGroup>
          </CategoryContainer>
        ))}
      </ScrollViewWrapper>
    </>
  );
};

export default DeviceStatuses;

// Styled Components
const ScrollViewWrapper = styled.ScrollView`
  flex: 1;
  background-color: #f4f0ff;
`;

const HeaderCard = styled.View`
  margin: 14px 16px 10px 16px;
  background-color: #ffffff;
  border-radius: 18px;
  border-width: 1px;
  border-color: #e8dcff;
  padding: 14px;
`;

const HeaderTitle = styled.Text`
  font-size: 22px;
  font-weight: 800;
  color: #33285d;
`;

const HeaderSubtitle = styled.Text`
  margin-top: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #8173a7;
`;

const CategoryContainer = styled.View`
  margin-bottom: 18px;
  padding: 0 16px;
`;

const CategoryHeader = styled.Text`
  font-size: 13px;
  font-weight: 700;
  color: #6b54a8;
  text-transform: uppercase;
  margin-bottom: 10px;
  margin-left: 12px;
  letter-spacing: 0.5px;
`;

const DeviceGroup = styled.View`
  background-color: #ffffff;
  border-radius: 16px;
  border-width: 1px;
  border-color: #e9deff;
  overflow: hidden;
`;

const DeviceRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background-color: #ffffff;
  border-bottom-width: ${(props) => (props.isLast ? '0px' : '0.5px')};
  border-bottom-color: #efe6ff;
`;

const DeviceInfo = styled.View`
  flex: 1;
`;

const DeviceName = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: #2f2550;
  margin-bottom: 2px;
`;

const DeviceLocation = styled.Text`
  font-size: 12px;
  color: #7f72a3;
  font-weight: 500;
`;

const StatusPill = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: ${(props) => props.color};
  border-width: 1px;
  border-color: ${(props) => props.borderColor || 'transparent'};
  padding: 6px 12px;
  border-radius: 999px;
`;

const StatusInnerDot = styled.View`
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background-color: ${(props) => props.color};
  margin-right: 6px;
`;

const PillText = styled.Text`
  font-size: 12px;
  font-weight: 700;
  color: ${(props) => props.color || '#5f49a9'};
`;
