import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Dropdown } from 'react-native-element-dropdown';
import { useAuth } from '../../../context/AuthContext';
import Screen from '../../Screen';
import { MOCKUP_OPTIONS } from '../SmartScreenSections/SmartScreen.constants';
import {
  buildSceneInfoRequest,
  buildCreateSceneRequest,
  buildUpdateSceneRequest,
  extractCapabilityOptions,
  extractDeviceListOptions,
  getCreateSceneError,
  extractSceneDetailPayload,
  getSceneEntityId,
  getSceneId,
  buildManualTriggerSceneRequest,
  resolveSceneUserDetails,
} from './sceneUtils';

const LAN_SCENE_URL = 'http://192.168.2.115/api/v1.0/scene';
const WAN_SCENE_URL = 'https://one-development.soniciot.com/get-scene-list/';
const LAN_REQUEST_ID = '9f79e8baf8464f0d9a57f8fbc57d5d0f';
const WAN_REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
const LAN_MANUAL_TRIGGER_REQUEST_ID = 'd0ed2ce5215a47ec8eb3896c7b65a8ff';
const LAN_CREATE_REQUEST_ID = '5ca2321d8dbf4f9e8c7bfe8abcb53090';
const LAN_UPDATE_REQUEST_ID = '1d6b6b3c9f6c4a8aa55c0b46d0b7a901';
const DEVICE_LIST_URL = 'https://one-development.soniciot.com/device_status/';
const LAN_DEVICE_URL = 'http://192.168.2.115/api/v1.0/device';
const LAN_CAPABILITY_IDS = {
  trigger: 'af55bb5fbd6f4d98be5ed7fd7f5331fc',
  condition: '367bb6f2ae39499a8b66251a5fe52ae5',
  action: 'be3ae0d809e54767ad4f17a17b18f4dd',
};
const RESIDENCE_IDS = {
  [MOCKUP_OPTIONS.MOCKUP_1]: 'r45844047053e43d78fe5272c5badbd3a',
  [MOCKUP_OPTIONS.MOCKUP_2]: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
};

const getSceneArray = (payload) => {
  const result = payload?.result;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.scenes)) return result.scenes;
  if (Array.isArray(result?.scene_list)) return result.scene_list;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(payload?.scenes)) return payload.scenes;
  if (Array.isArray(payload?.scene_list)) return payload.scene_list;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getSceneName = (scene, index) => {
  if (typeof scene === 'string') return scene;
  return scene?.name || scene?.scene_name || scene?.title || `Scene ${index + 1}`;
};

export default function ScenesScreen({ route, navigation }) {
  const params = route?.params || {};
  const selectedOption = String(params.selectedOption || 'WAN').toUpperCase() === 'LAN' ? 'LAN' : 'WAN';
  const selectedMockup = params.selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? MOCKUP_OPTIONS.MOCKUP_1
    : MOCKUP_OPTIONS.MOCKUP_2;
  const { getActiveLanToken, getActiveWanToken } = useAuth();
  const [scenes, setScenes] = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedSceneDetails, setSelectedSceneDetails] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [triggeringSceneId, setTriggeringSceneId] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState('');
  const [deviceOptions, setDeviceOptions] = useState([]);
  const [capabilityOptions, setCapabilityOptions] = useState({ trigger: [], condition: [], action: [] });
  const [createDevices, setCreateDevices] = useState({ trigger: null, condition: null, action: null });
  const [createForm, setCreateForm] = useState({ name: '', manual: true, isAuto: false, trigger: null, condition: null, action: null });
  const [createLoading, setCreateLoading] = useState(false);
  const [capabilityLoading, setCapabilityLoading] = useState('');
  const [createError, setCreateError] = useState('');

  const getRequestHeaders = useCallback((token) => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }), []);

  const loadDevicesForCreate = useCallback(async () => {
    try {
      const isLan = selectedOption === 'LAN';
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const response = await fetch(isLan ? LAN_DEVICE_URL : DEVICE_LIST_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify({
          command: 'get_device_list',
          id: WAN_REQUEST_ID,
          param: isLan ? {} : { residence_id: RESIDENCE_IDS[selectedMockup], show_ability: true },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || payload?.error || 'Unable to load devices.');
      setDeviceOptions(extractDeviceListOptions(payload));
    } catch (error) {
      setCreateError(error?.message || 'Unable to load devices.');
    }
  }, [getActiveLanToken, getActiveWanToken, getRequestHeaders, selectedMockup, selectedOption]);

  const loadCapabilities = useCallback(async (kind, device) => {
    if (!device?.device_id) return;
    setCapabilityLoading(kind);
    setCreateError('');
    try {
      const isLan = selectedOption === 'LAN';
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const command = `get_device_${kind}_list`;
      const response = await fetch(isLan ? LAN_SCENE_URL : WAN_SCENE_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify({
          command,
          id: isLan ? LAN_CAPABILITY_IDS[kind] : WAN_REQUEST_ID,
          param: {
            device_id: device.device_id,
            ...(isLan ? {} : { residence_id: RESIDENCE_IDS[selectedMockup] }),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || payload?.error || `Unable to load ${kind} options.`);
      const key = kind === 'condition' ? 'condition_type' : `${kind}_type`;
      setCapabilityOptions((current) => {
        const options = [...current[kind], ...extractCapabilityOptions(payload, key)];
        return {
          ...current,
          [kind]: [...new Map(options.map((option) => [`${option.value}-${option.ability_id}`, option])).values()],
        };
      });
    } catch (error) {
      setCreateError(error?.message || `Unable to load ${kind} options.`);
    } finally {
      setCapabilityLoading('');
    }
  }, [getActiveLanToken, getActiveWanToken, getRequestHeaders, selectedMockup, selectedOption]);

  const updateCreateSelection = (kind, device) => {
    setCreateDevices((current) => ({ ...current, [kind]: device }));
    setCreateForm((current) => ({ ...current, [kind]: null }));
    loadCapabilities(kind, device);
  };

  const resetSceneEditor = useCallback(() => {
    setShowCreate(false);
    setEditingSceneId('');
    setCreateForm({ name: '', manual: true, isAuto: false, trigger: null, condition: null, action: null });
    setCreateDevices({ trigger: null, condition: null, action: null });
    setCapabilityOptions({ trigger: [], condition: [], action: [] });
    setCreateError('');
  }, []);

  const openSceneEditor = useCallback(() => {
    const detail = selectedSceneDetails || selectedScene;
    const sceneId = getSceneId(detail) || getSceneId(selectedScene);
    if (!sceneId) {
      Alert.alert('Scene unavailable', 'This scene is missing its identifier.');
      return;
    }

    const toSelection = (entry, kind) => {
      if (!entry?.device_id) return null;
      const typeKey = kind === 'condition' ? 'condition_type' : `${kind}_type`;
      const value = entry[typeKey] || (kind === 'condition' ? entry.type : '') || entry.value || '';
      const abilityId = entry.ability_id || entry.entity_id || '';
      const abilityType = entry.ability_type || entry.domain || '';
      return {
        ...entry,
        label: String(value).replace(/[_-]+/g, ' '),
        value: String(value),
        device_id: String(entry.device_id),
        ability_id: String(abilityId),
        ability_type: String(abilityType),
        [typeKey]: String(value),
      };
    };
    const toDevice = (selection) => selection ? {
      label: selection.device_name || selection.device_id,
      value: selection.device_id,
      device_id: selection.device_id,
      device_name: selection.device_name || selection.device_id,
    } : null;
    const trigger = toSelection(detail?.triggers?.[0], 'trigger');
    const condition = toSelection(detail?.conditions?.[0], 'condition');
    const action = toSelection(detail?.actions?.[0], 'action');
    const isAuto = detail?.is_auto === true || detail?.is_auto === 'true' || detail?.is_auto === 1;
    const manual = detail?.manual !== false && detail?.manual !== 'false' && detail?.manual !== 0;

    setDetailModalVisible(false);
    setEditingSceneId(sceneId);
    setCreateError('');
    setCreateForm({
      name: detail?.scene_name || detail?.name || '',
      manual,
      isAuto,
      trigger,
      condition,
      action,
    });
    setCreateDevices({ trigger: toDevice(trigger), condition: toDevice(condition), action: toDevice(action) });
    setCapabilityOptions({
      trigger: trigger ? [trigger] : [],
      condition: condition ? [condition] : [],
      action: action ? [action] : [],
    });
    [
      ['trigger', toDevice(trigger)],
      ['condition', toDevice(condition)],
      ['action', toDevice(action)],
    ].forEach(([kind, device]) => {
      if (device) loadCapabilities(kind, device);
    });
  }, [loadCapabilities, selectedScene, selectedSceneDetails]);

  const loadSceneDetails = useCallback(async (scene, showInModal = false) => {
    const sceneId = getSceneId(scene);
    if (!sceneId) {
      setSelectedSceneDetails(null);
      return null;
    }

    const isLan = selectedOption === 'LAN';
    const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
    const requestBody = buildSceneInfoRequest({
      isLan,
      selectedMockup,
      sceneId,
      lanRequestId: LAN_REQUEST_ID,
      wanRequestId: WAN_REQUEST_ID,
      residenceIds: RESIDENCE_IDS,
    });

    try {
      setSelectedScene(scene);
      setSelectedSceneDetails(null);
      if (showInModal) setDetailModalVisible(true);
      setDetailLoading(true);
      const response = await fetch(isLan ? LAN_SCENE_URL : WAN_SCENE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();
      if (!response.ok) {
        const upstreamMessage = payload?.message || payload?.error || payload?.detail;
        throw new Error(upstreamMessage || `Unable to load scene details (${response.status})`);
      }

      const detailPayload = extractSceneDetailPayload(payload);
      setSelectedSceneDetails(detailPayload);
      return detailPayload;
    } catch (error) {
      console.error('[ScenesScreen] Failed to load scene details:', error);
      setSelectedSceneDetails(null);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, [getActiveLanToken, getActiveWanToken, selectedMockup, selectedOption]);

  const triggerScene = useCallback(async (scene) => {
    const sceneId = getSceneId(scene);
    if (!sceneId) {
      Alert.alert('Scene unavailable', 'This scene is missing its identifier.');
      return;
    }

    setTriggeringSceneId(sceneId);
    try {
      const sceneDetails = await loadSceneDetails(scene);
      const sceneEntityId = getSceneEntityId(sceneDetails || scene);
      if (!sceneEntityId) {
        throw new Error('The scene information did not include a scene entity ID.');
      }

      const isLan = selectedOption === 'LAN';
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const response = await fetch(isLan ? LAN_SCENE_URL : WAN_SCENE_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify(buildManualTriggerSceneRequest({
          isLan,
          selectedMockup,
          sceneEntityId,
          lanRequestId: LAN_MANUAL_TRIGGER_REQUEST_ID,
          wanRequestId: WAN_REQUEST_ID,
          residenceIds: RESIDENCE_IDS,
        })),
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {}
      if (!response.ok || payload?.success === false || payload?.result?.success === false) {
        throw new Error(payload?.message || payload?.error || payload?.detail || 'Unable to trigger this scene.');
      }
      Alert.alert('Scene started', `${getSceneName(scene, 0)} is now running.`);
    } catch (error) {
      console.error('[ScenesScreen] Failed to trigger scene:', error);
      Alert.alert('Unable to start scene', error?.message || 'Please try again.');
    } finally {
      setTriggeringSceneId('');
    }
  }, [getActiveLanToken, getActiveWanToken, getRequestHeaders, loadSceneDetails, selectedMockup, selectedOption]);

  const loadScenes = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const isLan = selectedOption === 'LAN';
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const requestBody = {
        command: 'get_scene_list',
        id: isLan ? LAN_REQUEST_ID : WAN_REQUEST_ID,
        param: isLan ? {} : { residence_id: RESIDENCE_IDS[selectedMockup] },
      };
      let response;
      let payload;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch(isLan ? LAN_SCENE_URL : WAN_SCENE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });
        payload = await response.json();
        if (response.ok || response.status !== 504 || attempt === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      if (!response.ok) {
        const upstreamMessage = payload?.message || payload?.error || payload?.detail;
        throw new Error(upstreamMessage || `Unable to load scenes (${response.status})`);
      }
      setScenes(getSceneArray(payload));
    } catch (error) {
      console.error('[ScenesScreen] Failed to load scenes:', error);
      setScenes([]);
      setErrorMessage(error?.message || 'Unable to load scenes right now.');
    } finally {
      setLoading(false);
    }
  }, [getActiveLanToken, getActiveWanToken, selectedMockup, selectedOption]);

  const createScene = useCallback(async () => {
    const isLan = selectedOption === 'LAN';
    if (!createForm.name.trim() || !createForm.trigger || !createForm.action || (!isLan && !createForm.condition)) {
      setCreateError(isLan
        ? 'Enter a scene name and select a trigger and action.'
        : 'Enter a scene name and select a trigger, condition, and action for a WAN scene.');
      return;
    }
    const requiredSelections = [createForm.trigger, createForm.action, createForm.condition].filter(Boolean);
    const missingCapabilityData = requiredSelections.some((selection) => (
      !selection.device_id || !selection.ability_id || !selection.ability_type
    ));
    if (missingCapabilityData) {
      setCreateError('The selected event is missing device capability information. Please choose the event again.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const body = buildCreateSceneRequest({
        isLan,
        selectedMockup,
        sceneName: createForm.name.trim(),
        manual: createForm.manual,
        isAuto: createForm.isAuto,
        trigger: createForm.trigger,
        condition: createForm.condition,
        action: createForm.action,
        lanRequestId: LAN_CREATE_REQUEST_ID,
        wanRequestId: WAN_REQUEST_ID,
        residenceIds: RESIDENCE_IDS,
      });
      console.log('[ScenesScreen] create_scene_info request:', JSON.stringify(body, null, 2));
      const response = await fetch(isLan ? LAN_SCENE_URL : WAN_SCENE_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success === false || payload?.result?.success === false) {
        console.warn('[ScenesScreen] create_scene_info rejected:', {
          status: response.status,
          payload: JSON.stringify(payload),
        });
        throw new Error(getCreateSceneError(payload));
      }
      setShowCreate(false);
      setCreateForm({ name: '', manual: true, isAuto: false, trigger: null, condition: null, action: null });
      setCreateDevices({ trigger: null, condition: null, action: null });
      await loadScenes();
      Alert.alert('Scene created', 'The new scene is now available in your scene list.');
    } catch (error) {
      setCreateError(error?.message || 'Unable to create scene.');
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, getActiveLanToken, getActiveWanToken, getRequestHeaders, loadScenes, selectedMockup, selectedOption]);

  const updateScene = useCallback(async () => {
    const isLan = selectedOption === 'LAN';
    if (!editingSceneId || !createForm.name.trim() || !createForm.trigger || !createForm.action || (!isLan && !createForm.condition)) {
      setCreateError(isLan
        ? 'Enter a scene name and select a trigger and action.'
        : 'Enter a scene name and select a trigger, condition, and action for a WAN scene.');
      return;
    }
    const requiredSelections = [createForm.trigger, createForm.action, createForm.condition].filter(Boolean);
    const missingCapabilityData = requiredSelections.some((selection) => (
      !selection.device_id || !selection.ability_id || !selection.ability_type
    ));
    if (missingCapabilityData) {
      setCreateError('The selected event is missing device capability information. Please choose the event again.');
      return;
    }

    setCreateLoading(true);
    setCreateError('');
    try {
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const body = buildUpdateSceneRequest({
        isLan,
        selectedMockup,
        sceneId: editingSceneId,
        sceneName: createForm.name.trim(),
        manual: createForm.manual,
        isAuto: createForm.isAuto,
        trigger: createForm.trigger,
        condition: createForm.condition,
        action: createForm.action,
        lanRequestId: LAN_UPDATE_REQUEST_ID,
        wanRequestId: WAN_REQUEST_ID,
        residenceIds: RESIDENCE_IDS,
      });
      const response = await fetch(isLan ? LAN_SCENE_URL : WAN_SCENE_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success === false || payload?.result?.success === false) {
        throw new Error(getCreateSceneError(payload, 'Unable to update scene.'));
      }
      resetSceneEditor();
      await loadScenes();
      Alert.alert('Scene updated', 'Your scene changes have been saved.');
    } catch (error) {
      setCreateError(error?.message || 'Unable to update scene.');
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, editingSceneId, getActiveLanToken, getActiveWanToken, getRequestHeaders, loadScenes, resetSceneEditor, selectedMockup, selectedOption]);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  useEffect(() => {
    if ((showCreate || editingSceneId) && deviceOptions.length === 0) loadDevicesForCreate();
  }, [deviceOptions.length, editingSceneId, loadDevicesForCreate, showCreate]);

  const renderCreateSelector = (kind, title, iconName) => {
    const device = createDevices[kind];
    const selectedCapability = createForm[kind];
    const options = capabilityOptions[kind];
    const typeKey = kind === 'condition' ? 'condition_type' : `${kind}_type`;
    const dropdownOptions = device ? options : deviceOptions;

    return (
      <View style={styles.createSection}>
        <View style={styles.createSectionTitleRow}>
          <MaterialCommunityIcons name={iconName} size={19} color="#6f4bd8" />
          <Text style={styles.createSectionTitle}>{title}</Text>
        </View>
        <Dropdown
          style={styles.createDropdown}
          containerStyle={styles.createDropdownContainer}
          data={dropdownOptions}
          labelField="label"
          valueField="value"
          placeholder={device ? `Select ${title.toLowerCase()} event` : `Select ${title.toLowerCase()} device`}
          value={selectedCapability?.value || device?.value || null}
          search
          searchPlaceholder={device ? `Search ${title.toLowerCase()} events` : 'Search devices'}
          onChange={(nextValue) => {
            if (device) {
              setCreateForm((current) => ({
                ...current,
                [kind]: {
                  ...nextValue,
                  device_id: device.device_id,
                  device_name: device.device_name,
                  [typeKey]: nextValue[typeKey] || nextValue.value,
                },
              }));
            } else {
              updateCreateSelection(kind, nextValue);
            }
          }}
          placeholderStyle={styles.createPlaceholder}
          selectedTextStyle={styles.createSelectedText}
          itemTextStyle={styles.createItemText}
        />
        {device ? (
          capabilityLoading === kind ? (
            <View style={styles.capabilityLoading}><ActivityIndicator size="small" color="#6f4bd8" /><Text style={styles.capabilityLoadingText}>Loading options...</Text></View>
          ) : (
            <TouchableOpacity
              style={styles.changeDeviceButton}
              onPress={() => {
                setCreateDevices((current) => ({ ...current, [kind]: null }));
                setCreateForm((current) => ({ ...current, [kind]: null }));
              }}
            >
              <Text style={styles.changeDeviceText}>Change device</Text>
            </TouchableOpacity>
          )
        ) : null}
      </View>
    );
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadScenes} tintColor="#6f4bd8" />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#34225f" />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>Scenes</Text>
            <Text style={styles.subtitle}>{selectedOption} - {selectedMockup === MOCKUP_OPTIONS.MOCKUP_1 ? 'Mockup 1' : 'Mockup 2'}</Text>
          </View>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => {
              if (showCreate || editingSceneId) {
                resetSceneEditor();
              } else {
                setShowCreate(true);
                setCreateError('');
              }
            }}
            accessibilityLabel={showCreate || editingSceneId ? 'Close scene editor' : 'Create scene'}
          >
            <MaterialCommunityIcons name={showCreate || editingSceneId ? 'close' : 'plus'} size={27} color="#6f4bd8" />
          </TouchableOpacity>
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalIcon}>
            <MaterialCommunityIcons name="playlist-play" size={30} color="#6f4bd8" />
          </View>
          <View>
            <Text style={styles.totalLabel}>Total scenes</Text>
            {loading ? <ActivityIndicator size="small" color="#6f4bd8" /> : <Text style={styles.totalValue}>{scenes.length}</Text>}
          </View>
        </View>

        {showCreate || editingSceneId ? (
          <View style={styles.createCard}>
            <View style={styles.createHeaderRow}>
              <View>
                <Text style={styles.createTitle}>{editingSceneId ? 'Edit scene' : 'Create scene'}</Text>
                <Text style={styles.createSubtitle}>{editingSceneId ? 'Update the selected devices or events, then save your changes.' : 'Choose a device first, then choose its event.'}</Text>
              </View>
              {deviceOptions.length === 0 ? <ActivityIndicator size="small" color="#6f4bd8" /> : null}
            </View>

            <TextInput
              style={styles.createInput}
              placeholder="Scene name"
              placeholderTextColor="#9b8bb8"
              value={createForm.name}
              onChangeText={(name) => setCreateForm((current) => ({ ...current, name }))}
            />

            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>Mode</Text>
              <TouchableOpacity
                style={[styles.modeToggle, createForm.manual && styles.modeToggleActive]}
                onPress={() => setCreateForm((current) => ({ ...current, manual: !current.manual }))}
              >
                <Text style={styles.modeToggleText}>Manual</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeToggle, createForm.isAuto && styles.modeToggleActive]}
                onPress={() => setCreateForm((current) => ({ ...current, isAuto: !current.isAuto }))}
              >
                <Text style={styles.modeToggleText}>Auto</Text>
              </TouchableOpacity>
            </View>

            {renderCreateSelector('trigger', 'Trigger', 'motion-sensor')}
            {renderCreateSelector('condition', 'Condition', 'filter-outline')}
            {renderCreateSelector('action', 'Action', 'lightbulb-on-outline')}

            {createError ? <Text style={styles.createError}>{createError}</Text> : null}
            <TouchableOpacity style={styles.createButton} onPress={editingSceneId ? updateScene : createScene} disabled={createLoading}>
              {createLoading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.createButtonText}>{editingSceneId ? 'Save changes' : 'Create scene'}</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="cloud-alert" size={34} color="#c35b6f" />
            <Text style={styles.stateTitle}>Scenes unavailable</Text>
            <Text style={styles.stateMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadScenes}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : !loading && scenes.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="playlist-remove" size={34} color="#8b78b8" />
            <Text style={styles.stateTitle}>No scenes found</Text>
            <Text style={styles.stateMessage}>There are no scenes configured for this device set.</Text>
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {scenes.map((scene, index) => {
                const sceneId = getSceneId(scene);
                const isTriggering = triggeringSceneId === sceneId;

                return (
                  <View
                    key={sceneId || `${getSceneName(scene, index)}-${index}`}
                    style={[styles.sceneRow, isTriggering && styles.sceneRowSelected]}
                  >
                    <TouchableOpacity
                      style={styles.sceneTileBody}
                      onPress={() => triggerScene(scene)}
                      disabled={Boolean(triggeringSceneId)}
                      activeOpacity={0.8}
                      accessibilityLabel={`Run ${getSceneName(scene, index)}`}
                    >
                      <View style={styles.sceneNumber}><Text style={styles.sceneNumberText}>{index + 1}</Text></View>
                      <Text style={styles.sceneName}>{getSceneName(scene, index)}</Text>
                      {isTriggering ? <ActivityIndicator size="small" color="#6f4bd8" /> : <MaterialCommunityIcons name="play-circle-outline" size={22} color="#6f4bd8" />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sceneDetailButton}
                      onPress={() => loadSceneDetails(scene, true)}
                      accessibilityLabel={`View details for ${getSceneName(scene, index)}`}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={24} color="#a28bcf" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.detailHeaderRow}>
              <View style={styles.detailBadge}>
                <MaterialCommunityIcons name="play-box-multiple-outline" size={18} color="#6f4bd8" />
              </View>
              <Text style={styles.detailTitle}>Scene summary</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)} accessibilityLabel="Close scene details">
                <MaterialCommunityIcons name="close" size={24} color="#6f4bd8" />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator size="small" color="#6f4bd8" />
                <Text style={styles.detailLoadingText}>Loading scene details...</Text>
              </View>
            ) : selectedScene ? (() => {
              const details = resolveSceneUserDetails(selectedSceneDetails || selectedScene, selectedMockup);
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.badgeGroup}>
                    {details.modes.map((mode) => (
                      <View key={mode} style={[styles.modeBadge, mode === 'Auto' ? styles.autoBadge : styles.manualBadge]}>
                        <Text style={styles.modeBadgeText}>{mode}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.detailSceneName}>{details.name}</Text>
                  <Text style={styles.detailDescription}>{details.description}</Text>
                  <TouchableOpacity style={styles.editButton} onPress={openSceneEditor} accessibilityLabel="Edit scene">
                    <MaterialCommunityIcons name="pencil-outline" size={18} color="#ffffff" />
                    <Text style={styles.editButtonText}>Edit scene</Text>
                  </TouchableOpacity>
                  <View style={styles.deviceSummaryCard}>
                    <Text style={styles.deviceSummaryLabel}>Trigger</Text>
                    {details.triggerDetails.map((text, idx) => <View key={`trigger-${text}-${idx}`} style={styles.devicePill}><MaterialCommunityIcons name="motion-sensor" size={15} color="#6f4bd8" /><Text style={styles.devicePillText}>{text}</Text></View>)}
                  </View>
                  <View style={styles.conditionSummaryCard}>
                    <Text style={styles.conditionSummaryLabel}>Condition</Text>
                    {details.conditionDetails.map((text, idx) => <View key={`condition-${text}-${idx}`} style={styles.devicePill}><MaterialCommunityIcons name="filter-outline" size={15} color="#6f4bd8" /><Text style={styles.devicePillText}>{text}</Text></View>)}
                  </View>
                  <View style={styles.actionSummaryCard}>
                    <Text style={styles.actionSummaryLabel}>Action</Text>
                    {details.actionDetails.map((text, idx) => <View key={`action-${text}-${idx}`} style={styles.devicePill}><MaterialCommunityIcons name="lightbulb-on-outline" size={15} color="#6f4bd8" /><Text style={styles.devicePillText}>{text}</Text></View>)}
                    <Text style={styles.actionSummaryLabel}>Scene behavior</Text>
                    <Text style={styles.actionSummaryText}>{details.summaryText}</Text>
                  </View>
                </ScrollView>
              );
            })() : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f8f6fc' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 18, paddingBottom: 72 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTextBlock: { flex: 1, marginLeft: 12 },
  title: { color: '#34225f', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#8975b5', fontSize: 13, fontWeight: '600', marginTop: 3 },
  headerIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center' },
  totalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 18, marginBottom: 18, shadowColor: '#6f4bd8', shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  totalIcon: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#f0eaff', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  totalLabel: { color: '#7c6a9e', fontSize: 13, fontWeight: '700' },
  totalValue: { color: '#34225f', fontSize: 30, fontWeight: '800', marginTop: 1 },
  list: {},
  sceneRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, shadowColor: '#34225f', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sceneRowSelected: { backgroundColor: '#f3edff', borderRadius: 12 },
  sceneTileBody: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  sceneDetailButton: { width: 42, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sceneNumber: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0eaff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sceneNumberText: { color: '#6f4bd8', fontSize: 14, fontWeight: '800' },
  sceneName: { flex: 1, color: '#443467', fontSize: 15, fontWeight: '700' },
  stateCard: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 28 },
  stateTitle: { color: '#443467', fontSize: 17, fontWeight: '800', marginTop: 10 },
  stateMessage: { color: '#8975a8', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  retryButton: { backgroundColor: '#6f4bd8', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  retryText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  detailCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, marginTop: 18 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' },
  detailBadge: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  detailTitle: { color: '#34225f', fontSize: 16, fontWeight: '800', flex: 1, minWidth: 100 },
  badgeGroup: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  modeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start', marginLeft: 6, marginBottom: 4 },
  autoBadge: { backgroundColor: '#e9f9ee' },
  manualBadge: { backgroundColor: '#f4edf9' },
  modeBadgeText: { color: '#34225f', fontSize: 11, fontWeight: '800' },
  detailSceneName: { color: '#34225f', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  detailDescription: { color: '#6e5f93', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  deviceSummaryCard: { backgroundColor: '#f8f4ff', borderRadius: 14, padding: 14, marginBottom: 12 },
  deviceSummaryLabel: { color: '#7c6a9e', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  conditionSummaryCard: { backgroundColor: '#f7f7ff', borderRadius: 14, padding: 14, marginBottom: 12 },
  conditionSummaryLabel: { color: '#7c6a9e', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  devicePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  devicePillText: { color: '#443467', fontSize: 13, fontWeight: '700', marginLeft: 8 },
  actionSummaryCard: { backgroundColor: '#f5f8ff', borderRadius: 14, padding: 14 },
  actionSummaryLabel: { color: '#7c6a9e', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  actionSummaryText: { color: '#34225f', fontSize: 14, fontWeight: '700', lineHeight: 22 },
  detailLoadingText: { color: '#443467', fontSize: 13, fontWeight: '700', marginTop: 8 },
  detailLoading: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28, 18, 52, 0.45)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '86%', backgroundColor: '#ffffff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20 },
  createCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, marginBottom: 18 },
  createHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  createTitle: { color: '#34225f', fontSize: 19, fontWeight: '800' },
  createSubtitle: { color: '#8975a8', fontSize: 12, marginTop: 4 },
  createInput: { height: 50, borderWidth: 1, borderColor: '#dfd5f0', borderRadius: 10, paddingHorizontal: 14, color: '#34225f', fontSize: 14, marginBottom: 12 },
  modeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  modeLabel: { color: '#6e5f93', fontSize: 13, fontWeight: '700', marginRight: 8 },
  modeToggle: { borderWidth: 1, borderColor: '#dfd5f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  modeToggleActive: { backgroundColor: '#efe6ff', borderColor: '#6f4bd8' },
  modeToggleText: { color: '#443467', fontSize: 12, fontWeight: '700' },
  createSection: { marginTop: 12 },
  createSectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  createSectionTitle: { color: '#443467', fontSize: 14, fontWeight: '800', marginLeft: 7 },
  createDropdown: { height: 50, borderWidth: 1, borderColor: '#dfd5f0', borderRadius: 10, paddingHorizontal: 12, marginTop: 8 },
  createDropdownContainer: { borderRadius: 10 },
  createPlaceholder: { color: '#9b8bb8', fontSize: 13 },
  createSelectedText: { color: '#34225f', fontSize: 13 },
  createItemText: { color: '#443467', fontSize: 13 },
  capabilityLoading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  capabilityLoadingText: { color: '#8975a8', fontSize: 12, marginLeft: 8 },
  changeDeviceButton: { alignSelf: 'flex-start', paddingVertical: 7 },
  changeDeviceText: { color: '#6f4bd8', fontSize: 12, fontWeight: '700' },
  createError: { color: '#c35b6f', fontSize: 12, lineHeight: 18, marginTop: 12 },
  createButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#6f4bd8', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  createButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  editButton: { minHeight: 42, borderRadius: 10, backgroundColor: '#6f4bd8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  editButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800', marginLeft: 7 },
});
