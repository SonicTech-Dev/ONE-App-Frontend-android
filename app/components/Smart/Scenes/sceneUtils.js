import { getDeviceCategoriesByMockup, MOCKUP_OPTIONS } from '../SmartScreenSections/SmartScreen.constants';

const normalizeText = (value) => String(value ?? '').trim();

const flattenDeviceIds = (candidate, results = []) => {
  if (!candidate) return results;

  if (Array.isArray(candidate)) {
    candidate.forEach((item) => flattenDeviceIds(item, results));
    return results;
  }

  if (typeof candidate !== 'object') {
    return results;
  }

  const idFields = [
    'device_id', 'deviceId', 'deviceid', 'deviceID',
    'target_device_id', 'targetDeviceId', 'targetDeviceID',
    'connected_device_id', 'connectedDeviceId', 'connectedDeviceID',
    'linked_device_id', 'linkedDeviceId',
    'trigger_device_id', 'triggerDeviceId',
    'device_ids', 'deviceIds', 'object_id', 'objectId',
    'id', 'scene_id', 'sceneId', 'sceneID'
  ];

  for (const field of idFields) {
    const value = candidate[field];
    if (value !== undefined && value !== null && normalizeText(value) !== '') {
      results.push(String(value));
    }
  }

  Object.entries(candidate).forEach(([key, value]) => {
    const keyLower = String(key).toLowerCase();
    if (value && typeof value === 'object') {
      if (
        keyLower.includes('device') ||
        keyLower.includes('target') ||
        keyLower.includes('trigger') ||
        keyLower.includes('action') ||
        keyLower.includes('scene') ||
        keyLower.includes('connected') ||
        keyLower.includes('linked')
      ) {
        flattenDeviceIds(value, results);
      }
    }

    if (typeof value === 'string' && value && /[a-f0-9]{20,}/i.test(value) && /(device|target|scene|connected|trigger|action)/i.test(keyLower)) {
      results.push(value);
    }
  });

  return results;
};

const collectDeviceNames = (candidate, names = []) => {
  if (!candidate) return names;

  if (Array.isArray(candidate)) {
    candidate.forEach((item) => collectDeviceNames(item, names));
    return names;
  }

  if (typeof candidate !== 'object') {
    return names;
  }

  const nameFields = ['device_name', 'deviceName', 'device', 'title', 'name', 'target_name', 'targetName', 'connected_device_name'];
  for (const field of nameFields) {
    const value = candidate[field];
    if (typeof value === 'string' && normalizeText(value) !== '') {
      names.push(value);
    }
    if (value && typeof value === 'object' && value.name) {
      names.push(value.name);
    }
  }

  Object.entries(candidate).forEach(([key, value]) => {
    const keyLower = String(key).toLowerCase();
    if (value && typeof value === 'object' && (keyLower.includes('device') || keyLower.includes('target') || keyLower.includes('connected') || keyLower.includes('trigger'))) {
      collectDeviceNames(value, names);
    }
  });

  return names;
};

const makeFriendlyTriggerText = (triggerValue) => {
  const raw = normalizeText(triggerValue).toLowerCase();
  if (!raw) return 'This scene is configured to automate your devices.';

  if (raw.includes('turn_on') || raw.includes('on')) return 'Turns devices on';
  if (raw.includes('turn_off') || raw.includes('off')) return 'Turns devices off';
  if (raw.includes('open')) return 'Opens the connected cover or device';
  if (raw.includes('close')) return 'Closes the connected cover or device';
  if (raw.includes('lock')) return 'Locks the connected device';
  if (raw.includes('unlock')) return 'Unlocks the connected device';
  if (raw.includes('motion') || raw.includes('sensor')) return 'Monitors the selected device state';

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const makeEventText = (deviceName, eventValue, fallback) => {
  const deviceLabel = deviceName || fallback;
  const eventLabel = normalizeText(eventValue).replace(/[_-]+/g, ' ');
  return eventLabel ? `${deviceLabel} ${eventLabel}` : deviceLabel;
};

export const getSceneId = (scene = {}) => {
  if (!scene || typeof scene !== 'object') return '';

  const candidates = [scene.scene_id, scene.id, scene.sceneId, scene._id];
  for (const value of candidates) {
    if (value !== undefined && value !== null && normalizeText(value) !== '') {
      return String(value);
    }
  }

  return '';
};

export const extractSceneDetailPayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return null;

  const candidates = [
    payload?.result?.scene,
    payload?.result?.data?.scene,
    payload?.result?.data,
    payload?.result,
    payload?.scene,
    payload?.data,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      if (Array.isArray(candidate)) {
        if (candidate.length > 0) return candidate[0];
        return candidate;
      }

      if (Object.keys(candidate).length > 0) {
        return candidate;
      }
    }
  }

  return payload;
};

export const buildSceneInfoRequest = ({
  isLan,
  selectedMockup,
  sceneId,
  lanRequestId,
  wanRequestId,
  residenceIds,
}) => {
  if (isLan) {
    return {
      command: 'get_scene_info',
      id: lanRequestId,
      param: {
        scene_id: sceneId,
      },
    };
  }

  const residenceId = residenceIds?.[selectedMockup] || Object.values(residenceIds || {})[0];

  return {
    command: 'get_scene_info',
    id: wanRequestId,
    param: {
      residence_id: residenceId,
      scene_id: sceneId,
    },
  };
};

export const lookupDeviceNameById = (deviceId, selectedMockup = MOCKUP_OPTIONS.MOCKUP_2) => {
  const id = normalizeText(deviceId).toLowerCase();
  if (!id) return '';

  const mockupsToCheck = [selectedMockup, MOCKUP_OPTIONS.MOCKUP_1, MOCKUP_OPTIONS.MOCKUP_2];
  const seen = new Set();

  for (const mockup of mockupsToCheck) {
    const categories = getDeviceCategoriesByMockup(mockup);
    for (const category of categories) {
      for (const item of category.items || []) {
        const values = [
          item?.lan?.device_id,
          item?.wan?.device_id,
          item?.device_id,
          item?.id,
        ];

        const matched = values.some((value) => normalizeText(value).toLowerCase() === id);
        if (matched) {
          const name = item.title || item.device_name || item.name || 'Device';
          if (!seen.has(name)) {
            seen.add(name);
            return name;
          }
        }
      }
    }
  }

  return '';
};

export const resolveSceneUserDetails = (detail = {}, selectedMockup = MOCKUP_OPTIONS.MOCKUP_2) => {
  const name = normalizeText(detail?.name || detail?.scene_name || detail?.title || detail?.sceneName) || 'Scene';
  const autoValue = detail?.auto ?? detail?.is_auto ?? detail?.automation ?? detail?.mode;
  const isAuto = autoValue === true || autoValue === 'true' || autoValue === 'auto' || autoValue === 'AUTO' || autoValue === 1 || autoValue === '1';
  const isManual = detail?.manual === true || detail?.is_manual === true || detail?.manual === 'true' || detail?.manual === 'manual' || detail?.manual === 'MANUAL' || detail?.manual === 1 || detail?.manual === '1';
  const modeList = [];
  if (isAuto) modeList.push('Auto');
  if (isManual || (!isAuto && detail?.manual !== undefined)) modeList.push('Manual');
  if (modeList.length === 0) modeList.push('Auto');

  const triggerItems = Array.isArray(detail?.triggers) ? detail.triggers : [];
  const conditionItems = Array.isArray(detail?.conditions) ? detail.conditions : [];
  const actionItems = Array.isArray(detail?.actions) ? detail.actions : [];

  const triggerDeviceIds = triggerItems
    .map((item) => item?.device_id || item?.deviceId || item?.target_device_id || item?.targetDeviceId)
    .filter((value) => normalizeText(value) !== '');

  const actionDeviceIds = actionItems
    .map((item) => item?.device_id || item?.deviceId || item?.target_device_id || item?.targetDeviceId)
    .filter((value) => normalizeText(value) !== '');

  const triggerDevices = [...new Set(triggerDeviceIds.map((deviceId) => lookupDeviceNameById(deviceId, selectedMockup)).filter(Boolean))];
  const actionDevices = [...new Set(actionDeviceIds.map((deviceId) => lookupDeviceNameById(deviceId, selectedMockup)).filter(Boolean))];

  const triggerValue =
    triggerItems[0]?.trigger_type ||
    triggerItems[0]?.triggerType ||
    triggerItems[0]?.type ||
    detail?.trigger_type ||
    detail?.triggerType ||
    'turned_on';

  const actionValue =
    actionItems[0]?.action_type ||
    actionItems[0]?.actionType ||
    actionItems[0]?.type ||
    detail?.action_type ||
    detail?.actionType ||
    'turn_on';

  const triggerText = makeFriendlyTriggerText(triggerValue);
  const actionText = makeFriendlyTriggerText(actionValue);

  const triggerDetails = triggerItems.length > 0
    ? triggerItems.map((item, index) => {
      const deviceName = lookupDeviceNameById(
        item?.device_id || item?.deviceId || item?.target_device_id || item?.targetDeviceId,
        selectedMockup,
      );
      const eventValue = item?.trigger_type || item?.triggerType || item?.type || triggerValue;
      return makeEventText(deviceName, eventValue, `Trigger ${index + 1}`);
    })
    : ['Trigger device'];

  const conditionDetails = conditionItems.length > 0
    ? conditionItems.map((item, index) => {
      const deviceName = lookupDeviceNameById(
        item?.device_id || item?.deviceId || item?.target_device_id || item?.targetDeviceId,
        selectedMockup,
      );
      const conditionValue = item?.condition_type || item?.conditionType || item?.type || item?.value || '';
      return makeEventText(deviceName, conditionValue, `Condition ${index + 1}`);
    })
    : ['No condition'];

  const actionDetails = actionItems.length > 0
    ? actionItems.map((item, index) => {
      const deviceName = lookupDeviceNameById(
        item?.device_id || item?.deviceId || item?.target_device_id || item?.targetDeviceId,
        selectedMockup,
      );
      const eventValue = item?.action_type || item?.actionType || item?.type || actionValue;
      return makeEventText(deviceName, eventValue, `Action ${index + 1}`);
    })
    : ['Action device'];

  const triggerLabel = triggerDevices.length > 0 ? triggerDevices.join(', ') : 'Trigger device';
  const actionLabel = actionDevices.length > 0 ? actionDevices.join(', ') : 'Action device';

  const summaryText = `When ${triggerLabel} is ${triggerValue.replace(/_/g, ' ')}, ${actionLabel} will ${actionValue.replace(/_/g, ' ')}.`;

  return {
    name,
    modes: modeList,
    mode: modeList.length > 1 ? 'Auto + Manual' : modeList[0],
    triggerText,
    actionText,
    triggerDetails,
    conditionDetails,
    actionDetails,
    triggerDevices,
    actionDevices,
    devices: [...new Set([...triggerDevices, ...actionDevices])],
    summaryText,
    description: normalizeText(detail?.description) || `This scene runs in ${modeList.join(' + ').toLowerCase()} mode.`,
  };
};
