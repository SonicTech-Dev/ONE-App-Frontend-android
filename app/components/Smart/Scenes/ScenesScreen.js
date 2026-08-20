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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import Screen from '../../Screen';
import { MOCKUP_OPTIONS } from '../SmartScreenSections/SmartScreen.constants';
import {
  buildSceneInfoRequest,
  buildCreateSceneRequest,
  buildUpdateSceneRequest,
  buildDeleteSceneRequest,
  buildBatchDeleteSceneRequest,
  buildSceneHistoryRequest,
  buildDeleteSceneHistoryRequest,
  buildBatchDeleteSceneHistoryRequest,
  extractCapabilityOptions,
  extractDeviceListOptions,
  extractSceneHistoryRecords,
  getCreateSceneError,
  extractSceneDetailPayload,
  getSceneEntityId,
  getSceneHistoryRecordId,
  getSceneId,
  buildManualTriggerSceneRequest,
  resolveSceneHistoryDetails,
  resolveSceneUserDetails,
} from './sceneUtils';

const LAN_SCENE_URL = 'http://192.168.2.115/api/v1.0/scene';
const WAN_SCENE_URL = 'https://one-development.soniciot.com/get-scene-list/';
const LAN_REQUEST_ID = '9f79e8baf8464f0d9a57f8fbc57d5d0f';
const WAN_REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
const LAN_MANUAL_TRIGGER_REQUEST_ID = 'd0ed2ce5215a47ec8eb3896c7b65a8ff';
const LAN_CREATE_REQUEST_ID = '5ca2321d8dbf4f9e8c7bfe8abcb53090';
const LAN_UPDATE_REQUEST_ID = '1d6b6b3c9f6c4a8aa55c0b46d0b7a901';
const LAN_DELETE_REQUEST_ID = 'cae4bcaaf0e44700a64e1365af6d80e1';
const LAN_BATCH_DELETE_REQUEST_ID = '71b4d64d735f4fd5b67f1600ed3df67b';
const LAN_HISTORY_REQUEST_ID = 'de14cf98d5ca4c75a3f235c1457596b2';
const LAN_HISTORY_DELETE_REQUEST_ID = '4a54cc456da742b2a4f860dcfb18ced5';
const LAN_HISTORY_BATCH_DELETE_REQUEST_ID = '77b2bf8a1b2041ec9c6a75d69c97f2db';
const HISTORY_PAGE_SIZE = 10;
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
  const insets = useSafeAreaInsets();
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSceneIds, setSelectedSceneIds] = useState([]);
  const [deletingSceneId, setDeletingSceneId] = useState('');
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyPageIndex, setHistoryPageIndex] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historySelectionMode, setHistorySelectionMode] = useState(false);
  const [historySelectedIds, setHistorySelectedIds] = useState([]);
  const [historyDeletingId, setHistoryDeletingId] = useState('');
  const [historyBatchDeleting, setHistoryBatchDeleting] = useState(false);

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

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedSceneIds([]);
  }, []);

  const toggleSceneSelection = useCallback((sceneId) => {
    if (!sceneId) return;
    setSelectedSceneIds((current) => (
      current.includes(sceneId) ? current.filter((id) => id !== sceneId) : [...current, sceneId]
    ));
  }, []);

  const startSelectionMode = useCallback((sceneId) => {
    setSelectionMode(true);
    if (sceneId) setSelectedSceneIds([sceneId]);
  }, []);

  const deleteScene = useCallback((scene) => {
    const sceneId = getSceneId(scene);
    if (!sceneId) {
      Alert.alert('Scene unavailable', 'This scene is missing its identifier.');
      return;
    }

    Alert.alert(
      'Delete scene',
      `Are you sure you want to delete "${getSceneName(scene, 0)}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingSceneId(sceneId);
            try {
              const isLan = selectedOption === 'LAN';
              const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
              const body = buildDeleteSceneRequest({
                isLan,
                selectedMockup,
                sceneId,
                lanRequestId: LAN_DELETE_REQUEST_ID,
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
                throw new Error(payload?.message || payload?.error || payload?.detail || 'Unable to delete this scene.');
              }
              setDetailModalVisible(false);
              setSelectedScene(null);
              setSelectedSceneDetails(null);
              await loadScenes();
              Alert.alert('Scene deleted', `${getSceneName(scene, 0)} has been removed.`);
            } catch (error) {
              console.error('[ScenesScreen] Failed to delete scene:', error);
              Alert.alert('Unable to delete scene', error?.message || 'Please try again.');
            } finally {
              setDeletingSceneId('');
            }
          },
        },
      ],
    );
  }, [getActiveLanToken, getActiveWanToken, getRequestHeaders, loadScenes, selectedMockup, selectedOption]);

  const deleteSelectedScenes = useCallback(() => {
    if (selectedSceneIds.length === 0) return;

    Alert.alert(
      'Delete scenes',
      `Are you sure you want to delete ${selectedSceneIds.length} selected scene${selectedSceneIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBatchDeleting(true);
            try {
              const isLan = selectedOption === 'LAN';
              const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
              const body = buildBatchDeleteSceneRequest({
                isLan,
                selectedMockup,
                sceneIds: selectedSceneIds,
                lanRequestId: LAN_BATCH_DELETE_REQUEST_ID,
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
                throw new Error(payload?.message || payload?.error || payload?.detail || 'Unable to delete the selected scenes.');
              }
              const deletedCount = selectedSceneIds.length;
              exitSelectionMode();
              await loadScenes();
              Alert.alert('Scenes deleted', `${deletedCount} scene${deletedCount > 1 ? 's' : ''} removed.`);
            } catch (error) {
              console.error('[ScenesScreen] Failed to batch delete scenes:', error);
              Alert.alert('Unable to delete scenes', error?.message || 'Please try again.');
            } finally {
              setBatchDeleting(false);
            }
          },
        },
      ],
    );
  }, [exitSelectionMode, getActiveLanToken, getActiveWanToken, getRequestHeaders, loadScenes, selectedMockup, selectedOption, selectedSceneIds]);

  const exitHistorySelectionMode = useCallback(() => {
    setHistorySelectionMode(false);
    setHistorySelectedIds([]);
  }, []);

  const resetHistoryState = useCallback(() => {
    setHistoryRecords([]);
    setHistoryPageIndex(1);
    setHistoryHasMore(false);
    setHistoryError('');
    exitHistorySelectionMode();
  }, [exitHistorySelectionMode]);

  const fetchSceneHistory = useCallback(async (scene, targetPageIndex) => {
    const sceneId = getSceneId(scene);
    if (!sceneId) return;

    setHistoryLoading(true);
    setHistoryError('');
    try {
      const isLan = selectedOption === 'LAN';
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const body = buildSceneHistoryRequest({
        isLan,
        selectedMockup,
        sceneId,
        pageIndex: targetPageIndex,
        pageSize: HISTORY_PAGE_SIZE,
        lanRequestId: LAN_HISTORY_REQUEST_ID,
        wanRequestId: WAN_REQUEST_ID,
        residenceIds: RESIDENCE_IDS,
      });
      const response = await fetch(isLan ? LAN_SCENE_URL : WAN_SCENE_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || payload?.detail || `Unable to load scene history (${response.status})`);
      }
      const records = extractSceneHistoryRecords(payload);
      console.log('[ScenesScreen] get_scene_history response sample:', JSON.stringify(records[0] || payload, null, 2));
      if (records.length === 0 && targetPageIndex > 1) {
        setHistoryHasMore(false);
        return;
      }
      setHistoryRecords(records);
      setHistoryPageIndex(targetPageIndex);
      setHistoryHasMore(records.length === HISTORY_PAGE_SIZE);
      setHistorySelectedIds([]);
    } catch (error) {
      console.error('[ScenesScreen] Failed to load scene history:', error);
      setHistoryError(error?.message || 'Unable to load scene history right now.');
    } finally {
      setHistoryLoading(false);
    }
  }, [getActiveLanToken, getActiveWanToken, getRequestHeaders, selectedMockup, selectedOption]);

  const goToNextHistoryPage = useCallback(() => {
    if (!historyHasMore || historyLoading) return;
    fetchSceneHistory(selectedSceneDetails || selectedScene, historyPageIndex + 1);
  }, [fetchSceneHistory, historyHasMore, historyLoading, historyPageIndex, selectedScene, selectedSceneDetails]);

  const goToPreviousHistoryPage = useCallback(() => {
    if (historyPageIndex <= 1 || historyLoading) return;
    fetchSceneHistory(selectedSceneDetails || selectedScene, historyPageIndex - 1);
  }, [fetchSceneHistory, historyLoading, historyPageIndex, selectedScene, selectedSceneDetails]);

  const toggleHistorySelection = useCallback((recordId) => {
    if (!recordId) return;
    setHistorySelectedIds((current) => (
      current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]
    ));
  }, []);

  const startHistorySelectionMode = useCallback((recordId) => {
    setHistorySelectionMode(true);
    if (recordId) setHistorySelectedIds([recordId]);
  }, []);

  const deleteHistoryRecord = useCallback((record) => {
    const recordId = getSceneHistoryRecordId(record);
    if (!recordId) return;

    Alert.alert(
      'Delete history entry',
      'Are you sure you want to delete this history entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setHistoryDeletingId(recordId);
            try {
              const isLan = selectedOption === 'LAN';
              const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
              const body = buildDeleteSceneHistoryRequest({
                isLan,
                selectedMockup,
                sceneRecordId: recordId,
                lanRequestId: LAN_HISTORY_DELETE_REQUEST_ID,
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
                console.warn('[ScenesScreen] delete_scene_history rejected:', { status: response.status, payload: JSON.stringify(payload) });
                throw new Error(getCreateSceneError(payload, 'Unable to delete this history entry.'));
              }
              await fetchSceneHistory(selectedSceneDetails || selectedScene, historyPageIndex);
            } catch (error) {
              console.error('[ScenesScreen] Failed to delete scene history entry:', error);
              Alert.alert('Unable to delete entry', error?.message || 'Please try again.');
            } finally {
              setHistoryDeletingId('');
            }
          },
        },
      ],
    );
  }, [fetchSceneHistory, getActiveLanToken, getActiveWanToken, getRequestHeaders, historyPageIndex, selectedMockup, selectedOption, selectedScene, selectedSceneDetails]);

  const deleteSelectedHistoryRecords = useCallback(() => {
    if (historySelectedIds.length === 0) return;

    Alert.alert(
      'Delete history entries',
      `Are you sure you want to delete ${historySelectedIds.length} selected entr${historySelectedIds.length > 1 ? 'ies' : 'y'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setHistoryBatchDeleting(true);
            try {
              const isLan = selectedOption === 'LAN';
              const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
              const body = buildBatchDeleteSceneHistoryRequest({
                isLan,
                selectedMockup,
                sceneRecordIds: historySelectedIds,
                lanRequestId: LAN_HISTORY_BATCH_DELETE_REQUEST_ID,
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
                console.warn('[ScenesScreen] batch_delete_scene_history rejected:', { status: response.status, payload: JSON.stringify(payload) });
                throw new Error(getCreateSceneError(payload, 'Unable to delete the selected entries.'));
              }
              exitHistorySelectionMode();
              await fetchSceneHistory(selectedSceneDetails || selectedScene, historyPageIndex);
            } catch (error) {
              console.error('[ScenesScreen] Failed to batch delete scene history:', error);
              Alert.alert('Unable to delete entries', error?.message || 'Please try again.');
            } finally {
              setHistoryBatchDeleting(false);
            }
          },
        },
      ],
    );
  }, [exitHistorySelectionMode, fetchSceneHistory, getActiveLanToken, getActiveWanToken, getRequestHeaders, historyPageIndex, historySelectedIds, selectedMockup, selectedOption, selectedScene, selectedSceneDetails]);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  useEffect(() => {
    if ((showCreate || editingSceneId) && deviceOptions.length === 0) loadDevicesForCreate();
  }, [deviceOptions.length, editingSceneId, loadDevicesForCreate, showCreate]);

  useEffect(() => {
    if (detailModalVisible && selectedScene) {
      resetHistoryState();
      fetchSceneHistory(selectedScene, 1);
    } else if (!detailModalVisible) {
      resetHistoryState();
    }
  }, [detailModalVisible, selectedScene, fetchSceneHistory, resetHistoryState]);

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
          {selectionMode ? (
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={exitSelectionMode}
              accessibilityLabel="Cancel selection"
            >
              <MaterialCommunityIcons name="close" size={27} color="#6f4bd8" />
            </TouchableOpacity>
          ) : (
            <>
              {scenes.length > 0 && !showCreate && !editingSceneId ? (
                <TouchableOpacity
                  style={[styles.headerIcon, styles.headerIconSecondary]}
                  onPress={() => startSelectionMode()}
                  accessibilityLabel="Select scenes to delete"
                >
                  <MaterialCommunityIcons name="checkbox-multiple-marked-outline" size={24} color="#6f4bd8" />
                </TouchableOpacity>
              ) : null}
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
            </>
          )}
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
                const isDeleting = deletingSceneId === sceneId;
                const isSelected = selectedSceneIds.includes(sceneId);

                return (
                  <View
                    key={sceneId || `${getSceneName(scene, index)}-${index}`}
                    style={[styles.sceneRow, (isTriggering || isSelected) && styles.sceneRowSelected]}
                  >
                    <TouchableOpacity
                      style={styles.sceneTileBody}
                      onPress={() => (selectionMode ? toggleSceneSelection(sceneId) : triggerScene(scene))}
                      onLongPress={() => (selectionMode ? undefined : startSelectionMode(sceneId))}
                      disabled={!selectionMode && (Boolean(triggeringSceneId) || isDeleting)}
                      activeOpacity={0.8}
                      accessibilityLabel={selectionMode ? `Select ${getSceneName(scene, index)}` : `Run ${getSceneName(scene, index)}`}
                    >
                      {selectionMode ? (
                        <View style={[styles.sceneCheckbox, isSelected && styles.sceneCheckboxChecked]}>
                          {isSelected ? <MaterialCommunityIcons name="check" size={16} color="#ffffff" /> : null}
                        </View>
                      ) : (
                        <View style={styles.sceneNumber}><Text style={styles.sceneNumberText}>{index + 1}</Text></View>
                      )}
                      <Text style={styles.sceneName}>{getSceneName(scene, index)}</Text>
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#c35b6f" />
                      ) : isTriggering ? (
                        <ActivityIndicator size="small" color="#6f4bd8" />
                      ) : !selectionMode ? (
                        <MaterialCommunityIcons name="play-circle-outline" size={22} color="#6f4bd8" />
                      ) : null}
                    </TouchableOpacity>
                    {selectionMode ? null : (
                      <>
                        <TouchableOpacity
                          style={styles.sceneDeleteButton}
                          onPress={() => deleteScene(scene)}
                          disabled={isDeleting}
                          accessibilityLabel={`Delete ${getSceneName(scene, index)}`}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#c35b6f" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.sceneDetailButton}
                          onPress={() => loadSceneDetails(scene, true)}
                          accessibilityLabel={`View details for ${getSceneName(scene, index)}`}
                        >
                          <MaterialCommunityIcons name="chevron-right" size={24} color="#a28bcf" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {selectionMode ? (
        <View style={[styles.selectionBar, { marginBottom: 100 + insets.bottom }]}>
          <Text style={styles.selectionBarText}>{selectedSceneIds.length} selected</Text>
          <TouchableOpacity
            style={[styles.selectionDeleteButton, (selectedSceneIds.length === 0 || batchDeleting) && styles.selectionDeleteButtonDisabled]}
            onPress={deleteSelectedScenes}
            disabled={selectedSceneIds.length === 0 || batchDeleting}
            accessibilityLabel="Delete selected scenes"
          >
            {batchDeleting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ffffff" />
                <Text style={styles.selectionDeleteText}>Delete</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

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
                  <View style={styles.detailActionRow}>
                    <TouchableOpacity style={[styles.editButton, styles.detailActionButton, styles.detailActionButtonSpacing]} onPress={openSceneEditor} accessibilityLabel="Edit scene">
                      <MaterialCommunityIcons name="pencil-outline" size={18} color="#ffffff" />
                      <Text style={styles.editButtonText}>Edit scene</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteSceneButton, styles.detailActionButton]}
                      onPress={() => deleteScene(selectedSceneDetails || selectedScene)}
                      disabled={deletingSceneId === getSceneId(selectedSceneDetails || selectedScene)}
                      accessibilityLabel="Delete scene"
                    >
                      {deletingSceneId === getSceneId(selectedSceneDetails || selectedScene) ? (
                        <ActivityIndicator size="small" color="#c35b6f" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color="#c35b6f" />
                          <Text style={styles.deleteSceneButtonText}>Delete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
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

                  <View style={styles.historyCard}>
                    <View style={styles.historyHeaderRow}>
                      <View style={styles.historyHeaderTitleRow}>
                        <MaterialCommunityIcons name="history" size={18} color="#6f4bd8" />
                        <Text style={styles.historyTitle}>History</Text>
                      </View>
                      {historyRecords.length > 0 ? (
                        historySelectionMode ? (
                          <TouchableOpacity onPress={exitHistorySelectionMode} accessibilityLabel="Cancel history selection">
                            <Text style={styles.historySelectToggle}>Cancel</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity onPress={() => startHistorySelectionMode()} accessibilityLabel="Select history entries">
                            <Text style={styles.historySelectToggle}>Select</Text>
                          </TouchableOpacity>
                        )
                      ) : null}
                    </View>

                    {historyLoading ? (
                      <View style={styles.historyLoading}>
                        <ActivityIndicator size="small" color="#6f4bd8" />
                        <Text style={styles.historyLoadingText}>Loading history...</Text>
                      </View>
                    ) : historyError ? (
                      <View style={styles.historyEmptyState}>
                        <MaterialCommunityIcons name="cloud-alert" size={26} color="#c35b6f" />
                        <Text style={styles.historyEmptyText}>{historyError}</Text>
                        <TouchableOpacity style={styles.historyRetryButton} onPress={() => fetchSceneHistory(selectedSceneDetails || selectedScene, historyPageIndex)}>
                          <Text style={styles.historyRetryText}>Try again</Text>
                        </TouchableOpacity>
                      </View>
                    ) : historyRecords.length === 0 ? (
                      <View style={styles.historyEmptyState}>
                        <MaterialCommunityIcons name="history" size={26} color="#8b78b8" />
                        <Text style={styles.historyEmptyText}>No history yet for this scene.</Text>
                      </View>
                    ) : (
                      <>
                        {historyRecords.map((record, idx) => {
                          const recordId = getSceneHistoryRecordId(record);
                          const recordKey = recordId || `history-${idx}`;
                          const isSelected = historySelectedIds.includes(recordId);
                          const isDeleting = historyDeletingId === recordId;
                          const info = resolveSceneHistoryDetails(record);

                          return (
                            <TouchableOpacity
                              key={recordKey}
                              style={[styles.historyRow, isSelected && styles.historyRowSelected]}
                              activeOpacity={0.8}
                              onPress={() => (historySelectionMode ? toggleHistorySelection(recordId) : undefined)}
                              onLongPress={() => (historySelectionMode ? undefined : startHistorySelectionMode(recordId))}
                              disabled={!historySelectionMode}
                            >
                              {historySelectionMode ? (
                                <View style={[styles.historyCheckbox, isSelected && styles.historyCheckboxChecked]}>
                                  {isSelected ? <MaterialCommunityIcons name="check" size={14} color="#ffffff" /> : null}
                                </View>
                              ) : (
                                <View style={[
                                  styles.historyStatusIcon,
                                  info.isFailure ? styles.historyStatusIconFailure : styles.historyStatusIconSuccess,
                                ]}>
                                  <MaterialCommunityIcons
                                    name={info.isFailure ? 'close' : 'check'}
                                    size={13}
                                    color="#ffffff"
                                  />
                                </View>
                              )}
                              <View style={styles.historyRowBody}>
                                <Text style={styles.historyTimestamp}>{info.timestamp || 'Unknown time'}</Text>
                                {info.triggerSource ? <Text style={styles.historySource}>{String(info.triggerSource).replace(/[_-]+/g, ' ')}</Text> : null}
                                {info.message ? <Text style={styles.historyMessage}>{info.message}</Text> : null}
                              </View>
                              {!historySelectionMode ? (
                                isDeleting ? (
                                  <ActivityIndicator size="small" color="#c35b6f" />
                                ) : (
                                  <TouchableOpacity
                                    style={styles.historyDeleteButton}
                                    onPress={() => deleteHistoryRecord(record)}
                                    accessibilityLabel="Delete history entry"
                                  >
                                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#c35b6f" />
                                  </TouchableOpacity>
                                )
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}

                        <View style={styles.historyPaginationRow}>
                          <TouchableOpacity
                            style={[styles.historyPageButton, historyPageIndex <= 1 && styles.historyPageButtonDisabled]}
                            onPress={goToPreviousHistoryPage}
                            disabled={historyPageIndex <= 1 || historyLoading}
                            accessibilityLabel="Previous history page"
                          >
                            <MaterialCommunityIcons name="chevron-left" size={18} color={historyPageIndex <= 1 ? '#c3b3e8' : '#6f4bd8'} />
                            <Text style={[styles.historyPageButtonText, historyPageIndex <= 1 && styles.historyPageButtonTextDisabled]}>Previous</Text>
                          </TouchableOpacity>
                          <Text style={styles.historyPageIndicator}>Page {historyPageIndex}</Text>
                          {historyHasMore ? (
                            <TouchableOpacity
                              style={styles.historyPageButton}
                              onPress={goToNextHistoryPage}
                              disabled={historyLoading}
                              accessibilityLabel="Next history page"
                            >
                              <Text style={styles.historyPageButtonText}>Next</Text>
                              <MaterialCommunityIcons name="chevron-right" size={18} color="#6f4bd8" />
                            </TouchableOpacity>
                          ) : <View style={styles.historyPageButtonPlaceholder} />}
                        </View>

                        {historySelectionMode ? (
                          <View style={styles.historySelectionBar}>
                            <Text style={styles.historySelectionBarText}>{historySelectedIds.length} selected</Text>
                            <TouchableOpacity
                              style={[styles.historySelectionDeleteButton, (historySelectedIds.length === 0 || historyBatchDeleting) && styles.selectionDeleteButtonDisabled]}
                              onPress={deleteSelectedHistoryRecords}
                              disabled={historySelectedIds.length === 0 || historyBatchDeleting}
                              accessibilityLabel="Delete selected history entries"
                            >
                              {historyBatchDeleting ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                              ) : (
                                <>
                                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ffffff" />
                                  <Text style={styles.historySelectionDeleteText}>Delete</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </>
                    )}
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
  content: { flexGrow: 1, padding: 18, paddingBottom: 96 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTextBlock: { flex: 1, marginLeft: 12 },
  title: { color: '#34225f', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#8975b5', fontSize: 13, fontWeight: '600', marginTop: 3 },
  headerIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center' },
  headerIconSecondary: { marginRight: 10 },
  totalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 18, marginBottom: 18, shadowColor: '#6f4bd8', shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  totalIcon: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#f0eaff', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  totalLabel: { color: '#7c6a9e', fontSize: 13, fontWeight: '700' },
  totalValue: { color: '#34225f', fontSize: 30, fontWeight: '800', marginTop: 1 },
  list: {},
  sceneRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, shadowColor: '#34225f', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sceneRowSelected: { backgroundColor: '#f3edff', borderRadius: 12 },
  sceneTileBody: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  sceneDetailButton: { width: 42, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sceneDeleteButton: { width: 36, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sceneNumber: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0eaff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sceneNumberText: { color: '#6f4bd8', fontSize: 14, fontWeight: '800' },
  sceneCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#c3b3e8', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  sceneCheckboxChecked: { backgroundColor: '#6f4bd8', borderColor: '#6f4bd8' },
  selectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#34225f', borderRadius: 16, marginHorizontal: 18, marginBottom: 18, paddingHorizontal: 18, paddingVertical: 14, shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 },
  selectionBarText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  selectionDeleteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#c35b6f', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  selectionDeleteButtonDisabled: { opacity: 0.5 },
  selectionDeleteText: { color: '#ffffff', fontSize: 13, fontWeight: '800', marginLeft: 7 },
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
  historyCard: { backgroundColor: '#faf8ff', borderRadius: 14, padding: 14, marginTop: 12 },
  historyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  historyHeaderTitleRow: { flexDirection: 'row', alignItems: 'center' },
  historyTitle: { color: '#443467', fontSize: 14, fontWeight: '800', marginLeft: 7 },
  historySelectToggle: { color: '#6f4bd8', fontSize: 12, fontWeight: '800' },
  historyLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  historyLoadingText: { color: '#8975a8', fontSize: 12, marginTop: 8 },
  historyEmptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  historyEmptyText: { color: '#8975a8', fontSize: 12, textAlign: 'center', marginTop: 8 },
  historyRetryButton: { marginTop: 10, backgroundColor: '#6f4bd8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  historyRetryText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, padding: 10, marginBottom: 8 },
  historyRowSelected: { backgroundColor: '#efe6ff' },
  historyRowBody: { flex: 1, marginLeft: 10 },
  historyTimestamp: { color: '#34225f', fontSize: 13, fontWeight: '800' },
  historySource: { color: '#7c6a9e', fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  historyMessage: { color: '#6e5f93', fontSize: 12, marginTop: 3 },
  historyStatusIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  historyStatusIconSuccess: { backgroundColor: '#4caf7d' },
  historyStatusIconFailure: { backgroundColor: '#c35b6f' },
  historyDeleteButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  historyCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#c3b3e8', alignItems: 'center', justifyContent: 'center' },
  historyCheckboxChecked: { backgroundColor: '#6f4bd8', borderColor: '#6f4bd8' },
  historyPaginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  historyPageButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 },
  historyPageButtonDisabled: { opacity: 0.4 },
  historyPageButtonText: { color: '#6f4bd8', fontSize: 12, fontWeight: '800' },
  historyPageButtonTextDisabled: { color: '#c3b3e8' },
  historyPageButtonPlaceholder: { width: 60 },
  historyPageIndicator: { color: '#7c6a9e', fontSize: 12, fontWeight: '700' },
  historySelectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#34225f', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  historySelectionBarText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  historySelectionDeleteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#c35b6f', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  historySelectionDeleteText: { color: '#ffffff', fontSize: 12, fontWeight: '800', marginLeft: 6 },
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
  detailActionRow: { flexDirection: 'row', marginBottom: 14 },
  detailActionButton: { flex: 1, marginBottom: 0 },
  detailActionButtonSpacing: { marginRight: 10 },
  deleteSceneButton: { minHeight: 42, borderRadius: 10, backgroundColor: '#fbe9ec', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 0 },
  deleteSceneButtonText: { color: '#c35b6f', fontSize: 13, fontWeight: '800', marginLeft: 7 },
});
