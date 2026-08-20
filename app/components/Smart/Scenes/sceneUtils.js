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

export const getSceneEntityId = (scene = {}) => {
  if (!scene || typeof scene !== 'object') return '';

  const candidates = [
    scene.scene_entity_id,
    scene.sceneEntityId,
    scene.entity_id,
    scene.entityId,
    scene.automation_entity_id,
    scene.automationEntityId,
  ];
  for (const value of candidates) {
    if (value !== undefined && value !== null && normalizeText(value) !== '') {
      return String(value);
    }
  }

  return '';
};

export const buildManualTriggerSceneRequest = ({
  isLan,
  selectedMockup,
  sceneEntityId,
  lanRequestId,
  wanRequestId,
  residenceIds,
}) => ({
  command: 'manual_trigger_scene',
  id: isLan ? lanRequestId : wanRequestId,
  param: {
    ...(isLan ? {} : { residence_id: residenceIds?.[selectedMockup] }),
    scene_entity_id: sceneEntityId,
  },
});

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

export const buildDeleteSceneRequest = ({
  isLan,
  selectedMockup,
  sceneId,
  lanRequestId,
  wanRequestId,
  residenceIds,
}) => {
  if (isLan) {
    return {
      command: 'delete_scene_info',
      id: lanRequestId,
      param: {
        scene_id: sceneId,
      },
    };
  }

  const residenceId = residenceIds?.[selectedMockup] || Object.values(residenceIds || {})[0];

  return {
    command: 'delete_scene_info',
    id: wanRequestId,
    param: {
      residence_id: residenceId,
      scene_id: sceneId,
    },
  };
};

export const buildBatchDeleteSceneRequest = ({
  isLan,
  selectedMockup,
  sceneIds,
  lanRequestId,
  wanRequestId,
  residenceIds,
}) => {
  const scenes = (sceneIds || []).map((sceneId) => ({ scene_id: sceneId }));

  if (isLan) {
    return {
      command: 'batch_delete_scene_info',
      id: lanRequestId,
      param: {
        scenes,
      },
    };
  }

  const residenceId = residenceIds?.[selectedMockup] || Object.values(residenceIds || {})[0];

  return {
    command: 'batch_delete_scene_info',
    id: wanRequestId,
    param: {
      residence_id: residenceId,
      scenes,
    },
  };
};

export const buildSceneHistoryRequest = ({
  isLan,
  selectedMockup,
  sceneId,
  pageIndex,
  pageSize,
  lanRequestId,
  wanRequestId,
  residenceIds,
}) => {
  if (isLan) {
    return {
      command: 'get_scene_history',
      id: lanRequestId,
      param: {
        page_size: pageSize,
        page_index: pageIndex,
        scene_id: sceneId,
      },
    };
  }

  const residenceId = residenceIds?.[selectedMockup] || Object.values(residenceIds || {})[0];

  return {
    command: 'get_scene_history',
    id: wanRequestId,
    param: {
      page_size: pageSize,
      page_index: pageIndex,
      scene_id: sceneId,
      residence_id: residenceId,
    },
  };
};

export const buildDeleteSceneHistoryRequest = ({
  isLan,
  selectedMockup,
  sceneRecordId,
  lanRequestId,
  wanRequestId,
  residenceIds,
}) => {
  if (isLan) {
    return {
      command: 'delete_scene_history',
      id: lanRequestId,
      param: {
        scene_record_id: Number(sceneRecordId),
      },
    };
  }

  const residenceId = residenceIds?.[selectedMockup] || Object.values(residenceIds || {})[0];

  return {
    command: 'delete_scene_history',
    id: wanRequestId,
    param: {
      scene_record_id: String(sceneRecordId),
      residence_id: residenceId,
    },
  };
};

export const buildBatchDeleteSceneHistoryRequest = ({
  isLan,
  selectedMockup,
  sceneRecordIds,
  lanRequestId,
  wanRequestId,
  residenceIds,
}) => {
  const sceneRecords = (sceneRecordIds || []).map((sceneRecordId) => ({
    scene_record_id: isLan ? Number(sceneRecordId) : String(sceneRecordId),
  }));

  if (isLan) {
    return {
      command: 'batch_delete_scene_history',
      id: lanRequestId,
      param: {
        scene_records: sceneRecords,
      },
    };
  }

  const residenceId = residenceIds?.[selectedMockup] || Object.values(residenceIds || {})[0];

  return {
    command: 'batch_delete_scene_history',
    id: wanRequestId,
    param: {
      scene_records: sceneRecords,
      residence_id: residenceId,
    },
  };
};

export const extractSceneHistoryRecords = (payload = {}) => {
  const candidates = [
    payload?.result?.records,
    payload?.result?.history,
    payload?.result?.list,
    payload?.result?.data,
    payload?.result,
    payload?.records,
    payload?.history,
    payload?.list,
    payload?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.records)) return candidate.records;
    if (Array.isArray(candidate?.history)) return candidate.history;
    if (Array.isArray(candidate?.list)) return candidate.list;
  }

  return [];
};

export const getSceneHistoryRecordId = (record = {}) => {
  const candidates = [record?.scene_record_id, record?.sceneRecordId, record?.record_id, record?.recordId, record?.id];
  for (const value of candidates) {
    if (value !== undefined && value !== null && normalizeText(value) !== '') {
      return String(value);
    }
  }
  return '';
};

export const formatSceneHistoryTimestamp = (value) => {
  if (value === undefined || value === null || value === '') return '';
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && numeric > 0) {
    const ms = numeric > 1e12 ? numeric : numeric * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  return String(value);
};

export const resolveSceneHistoryDetails = (record = {}) => {
  const asDisplayText = (value) => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string' || typeof value === 'number') return normalizeText(value);
    return '';
  };

  const findFieldByKeyword = (keywords) => {
    for (const [key, value] of Object.entries(record || {})) {
      if (value === undefined || value === null || value === '') continue;
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      const keyLower = key.toLowerCase();
      if (keywords.some((keyword) => keyLower.includes(keyword))) return value;
    }
    return undefined;
  };

  const timestampValue = record?.create_time ?? record?.createTime ?? record?.execution_time
    ?? record?.executionTime ?? record?.time ?? record?.timestamp ?? record?.trigger_time ?? record?.triggerTime
    ?? record?.record_time ?? record?.recordTime ?? record?.add_time ?? record?.addTime ?? record?.occur_time
    ?? record?.occurTime ?? record?.date ?? record?.datetime
    ?? findFieldByKeyword(['time', 'date']);
  const timestamp = formatSceneHistoryTimestamp(timestampValue);
  const statusValue = record?.status ?? record?.result ?? record?.state ?? record?.success
    ?? findFieldByKeyword(['status', 'state', 'result', 'success']);
  const statusText = normalizeText(statusValue).toLowerCase();
  const isSuccess = statusValue === true || statusValue === 1 || statusValue === '1'
    || statusText === 'success' || statusText === 'ok' || statusText === 'true';
  const isFailure = statusValue === false || statusValue === 0 || statusValue === '0'
    || statusText === 'fail' || statusText === 'failed' || statusText === 'error';
  const message = asDisplayText(record?.message) || asDisplayText(record?.msg) || asDisplayText(record?.detail) || asDisplayText(record?.description);
  const triggerSource = asDisplayText(record?.trigger_source) || asDisplayText(record?.triggerSource)
    || asDisplayText(record?.source) || asDisplayText(record?.trigger_type) || asDisplayText(record?.triggerType);
  return { timestamp, isSuccess, isFailure, message, triggerSource };
};

export const PERMISSION_DENIED_MESSAGE = 'Permission denied. Only the property admin account can create, edit, or delete scenes and scene history on WAN. You can still view and run scenes as a standard member.';

export const isPermissionDeniedResponse = (response, payload) => {
  if (response?.status === 401 || response?.status === 403) return true;

  const code = payload?.result?.code ?? payload?.code;
  const codeText = normalizeText(code).toLowerCase();
  if (['401', '403', 'forbidden', 'permission_denied', 'no_auth', 'noauth', 'unauthorized'].includes(codeText)) return true;

  const combinedText = [
    payload?.message, payload?.error, payload?.detail,
    payload?.result?.message, payload?.result?.error, payload?.result?.detail,
  ].map((value) => normalizeText(value).toLowerCase()).join(' ');

  const permissionKeywords = ['permission', 'forbidden', 'not allow', 'not authorized', 'unauthorized', 'no auth', 'no_auth', 'admin only', 'access denied'];
  return permissionKeywords.some((keyword) => combinedText.includes(keyword));
};

export const createPermissionDeniedError = () => Object.assign(new Error(PERMISSION_DENIED_MESSAGE), { isPermissionDenied: true });

const getPayloadArray = (payload) => {
  const candidates = [
    payload?.result,
    payload?.result?.devices,
    payload?.result?.data,
    payload?.devices,
    payload?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.devices)) return candidate.devices;
    if (Array.isArray(candidate?.abilities)) return candidate.abilities;
    if (Array.isArray(candidate?.actions)) return candidate.actions;
    if (Array.isArray(candidate?.triggers)) return candidate.triggers;
    if (Array.isArray(candidate?.conditions)) return candidate.conditions;
  }

  return [];
};

export const extractDeviceListOptions = (payload) => {
  const rawDevices = getPayloadArray(payload);
  const options = [];

  const addDevice = (device, parent = null) => {
    if (!device || typeof device !== 'object') return;
    const deviceId = device.device_id || device.deviceId || parent?.device_id;
    if (!deviceId) return;

    const name = device.device_name || device.deviceName || device.name || device.title
      || parent?.device_name || parent?.deviceName || 'Device';
    const abilities = Array.isArray(device.abilities) ? device.abilities : [];
    options.push({
      label: name,
      value: String(deviceId),
      device_id: String(deviceId),
      device_name: name,
      abilities,
    });

    (Array.isArray(device.sub_devices) ? device.sub_devices : []).forEach((child) => addDevice(child, device));
  };

  rawDevices.forEach((device) => addDevice(device));
  return [...new Map(options.map((option) => [option.value, option])).values()];
};

export const extractCapabilityOptions = (payload, capabilityKey) => {
  const kind = capabilityKey.replace(/_type$/, '');
  const rawOptions = [];
  const visited = new Set();

  const collect = (candidate, parentKey = '') => {
    if (!candidate || typeof candidate !== 'object' || visited.has(candidate)) return;
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      if (parentKey.includes(kind) || parentKey.includes('ability') || parentKey.includes('option') || parentKey.includes('event')) {
        rawOptions.push(...candidate);
      }
      candidate.forEach((item) => collect(item, parentKey));
      return;
    }

    Object.entries(candidate).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      if (Array.isArray(value) && (
        normalizedKey.includes(kind) || normalizedKey.includes('ability') || normalizedKey.includes('option') || normalizedKey.includes('event')
      )) {
        rawOptions.push(...value);
      }
      collect(value, normalizedKey);
    });
  };

  collect(payload);
  if (rawOptions.length === 0) rawOptions.push(...getPayloadArray(payload));

  const options = rawOptions
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => {
      const value = item[capabilityKey] || item.type || item.action || item.trigger || item.condition || item.value;
      const ability = item.ability && typeof item.ability === 'object' ? item.ability : {};
      const valueObject = item.value && typeof item.value === 'object' ? item.value : {};
      const abilityId = item.ability_id || item.abilityId || item.entity_id || item.entityId
        || ability.ability_id || ability.abilityId || ability.entity_id || valueObject.ability_id || '';
      const abilityType = item.ability_type || item.abilityType || item.domain
        || ability.ability_type || ability.abilityType || ability.domain || valueObject.ability_type || '';
      const label = item.label || item.name || item.title || value || `Option ${index + 1}`;
      return {
        ...item,
        label: String(label).replace(/[_-]+/g, ' '),
        value: String(value || label),
        ability_id: abilityId,
        ability_type: abilityType,
      };
    })
    .filter((item) => item.value);

  return [...new Map(options.map((item) => [`${item.value}-${item.ability_id}`, item])).values()];
};

export const buildCreateSceneRequest = ({
  isLan,
  selectedMockup,
  sceneName,
  manual,
  isAuto,
  trigger,
  condition,
  action,
  lanRequestId,
  wanRequestId,
  residenceIds,
}) => {
  const getEntryType = (entry, typeKey) => String(entry?.[typeKey] || entry?.value || '').trim();
  const deviceEntry = (entry, configKey, typeKey) => ({
    [`${configKey}_config`]: 'device',
    device_id: String(entry.device_id),
    ability_id: String(entry.ability_id),
    ability_type: String(entry.ability_type),
    [typeKey]: getEntryType(entry, typeKey),
  });

  const conditions = condition ? [isLan
    ? { condition: 'device', type: getEntryType(condition, 'condition_type'), device_id: String(condition.device_id), entity_id: String(condition.ability_id), domain: String(condition.ability_type) }
    : deviceEntry(condition, 'condition', 'condition_type')] : [];

  return {
    command: 'create_scene_info',
    id: isLan ? lanRequestId : wanRequestId,
    param: {
      ...(isLan ? {} : { residence_id: residenceIds?.[selectedMockup] }),
      scene_name: sceneName,
      manual,
      ...(isLan ? { is_auto: isAuto } : {}),
      triggers: trigger ? [deviceEntry(trigger, 'trigger', 'trigger_type')] : [],
      conditions,
      actions: action ? [deviceEntry(action, 'action', 'action_type')] : [],
    },
  };
};

export const buildUpdateSceneRequest = ({
  isLan,
  selectedMockup,
  sceneId,
  sceneName,
  manual,
  isAuto,
  trigger,
  condition,
  action,
  lanRequestId,
  wanRequestId,
  residenceIds,
}) => {
  const createRequest = buildCreateSceneRequest({
    isLan,
    selectedMockup,
    sceneName,
    manual,
    isAuto,
    trigger,
    condition,
    action,
    lanRequestId,
    wanRequestId,
    residenceIds,
  });

  return {
    ...createRequest,
    command: 'update_scene_info',
    param: {
      ...createRequest.param,
      scene_id: sceneId,
    },
  };
};

export const getCreateSceneError = (payload, fallback = 'Unable to create scene.') => {
  const result = payload?.result;
  const resultCode = result?.code ? ` (${result.code})` : '';
  const details = payload?.details || payload?.invalid_params || payload?.invalidParams
    || result?.details || result?.invalid_params || result?.invalidParams;
  const resultDetail = result?.detail;
  const detailText = typeof details === 'string' ? details : details ? JSON.stringify(details) : '';
  const resultDetailText = typeof resultDetail === 'string' ? resultDetail : resultDetail ? JSON.stringify(resultDetail) : '';
  const message = payload?.message
    || payload?.error
    || payload?.detail
    || detailText
    || result?.message
    || result?.error
    || resultDetailText
    || (typeof result === 'string' ? result : '')
    || fallback;
  return `${message}${resultCode}`;
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
