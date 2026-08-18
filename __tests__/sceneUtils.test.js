import {
  getSceneId,
  getSceneEntityId,
  extractSceneDetailPayload,
  buildSceneInfoRequest,
  buildManualTriggerSceneRequest,
  buildCreateSceneRequest,
  buildUpdateSceneRequest,
  extractCapabilityOptions,
  resolveSceneUserDetails,
} from '../app/components/Smart/Scenes/sceneUtils';

describe('scene detail helpers', () => {
  it('reads the correct scene id from various payload shapes', () => {
    expect(getSceneId({ scene_id: 'abc123' })).toBe('abc123');
    expect(getSceneId({ id: 'def456' })).toBe('def456');
    expect(getSceneId({ sceneId: 'ghi789' })).toBe('ghi789');
  });

  it('extracts the nested scene payload from backend responses', () => {
    const nested = {
      result: {
        scene: {
          name: 'Evening',
          scene_id: 'scene-42',
        },
      },
    };

    expect(extractSceneDetailPayload(nested)).toEqual({
      name: 'Evening',
      scene_id: 'scene-42',
    });
  });

  it('builds the WAN scene info request using residence id and selected scene id', () => {
    expect(buildSceneInfoRequest({
      isLan: false,
      selectedMockup: 'mockup_2',
      sceneId: 'scene-42',
      lanRequestId: 'lan-id',
      wanRequestId: 'wan-id',
      residenceIds: {
        mockup_1: 'res-1',
        mockup_2: 'res-2',
      },
    })).toEqual({
      command: 'get_scene_info',
      id: 'wan-id',
      param: {
        residence_id: 'res-2',
        scene_id: 'scene-42',
      },
    });
  });

  it('builds manual trigger requests from the scene info entity ID', () => {
    const sceneEntityId = getSceneEntityId({ automation_entity_id: 'automation.testing_wan_scene' });
    expect(sceneEntityId).toBe('automation.testing_wan_scene');

    expect(buildManualTriggerSceneRequest({
      isLan: false,
      selectedMockup: 'mockup2',
      sceneEntityId,
      lanRequestId: 'd0ed2ce5215a47ec8eb3896c7b65a8ff',
      wanRequestId: 'c45e846ca23ab42c9ae469d988ae32a96',
      residenceIds: { mockup2: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82' },
    })).toEqual({
      command: 'manual_trigger_scene',
      id: 'c45e846ca23ab42c9ae469d988ae32a96',
      param: {
        scene_entity_id: 'automation.testing_wan_scene',
        residence_id: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
      },
    });

    expect(buildManualTriggerSceneRequest({
      isLan: true,
      sceneEntityId: 'automation.testing_scene_creation',
      lanRequestId: 'd0ed2ce5215a47ec8eb3896c7b65a8ff',
      wanRequestId: 'c45e846ca23ab42c9ae469d988ae32a96',
    })).toEqual({
      command: 'manual_trigger_scene',
      id: 'd0ed2ce5215a47ec8eb3896c7b65a8ff',
      param: { scene_entity_id: 'automation.testing_scene_creation' },
    });
  });

  it('extracts trigger and action device names from the real scene payload shape', () => {
    const details = resolveSceneUserDetails({
      scene_name: 'testing scene creation',
      is_auto: true,
      manual: true,
      triggers: [
        {
          trigger_config: 'device',
          device_id: '0c11052b761c_63_1',
          ability_type: 'switch',
          trigger_type: 'turned_on',
        },
      ],
      actions: [
        {
          action_config: 'device',
          device_id: '0c11052b761c_65_1',
          ability_type: 'switch',
          action_type: 'turn_on',
        },
      ],
    }, 'mockup2');

    expect(details.modes).toEqual(['Auto', 'Manual']);
    expect(details.triggerDevices).toContain('SpotLight Kitchen');
    expect(details.actionDevices).toContain('SpotLight Entrance');
    expect(details.summaryText).toMatch(/When/i);
    expect(details.summaryText).toMatch(/turn on/i);
  });

  it('extracts nested capability lists for cascading scene selectors', () => {
    const options = extractCapabilityOptions({
      result: {
        trigger_list: [
          { trigger_type: 'turned_on', ability_id: 'switch.device-1', ability_type: 'switch' },
        ],
      },
    }, 'trigger_type');

    expect(options).toHaveLength(1);
    expect(options[0].value).toBe('turned_on');
    expect(options[0].ability_id).toBe('switch.device-1');
  });

  it('builds the WAN create-scene payload with residence and device entries', () => {
    expect(buildCreateSceneRequest({
      isLan: false,
      selectedMockup: 'mockup2',
      sceneName: 'testing wan scene',
      manual: true,
      isAuto: false,
      trigger: { device_id: 'trigger-device', ability_id: 'switch.trigger', ability_type: 'switch', trigger_type: 'turned_on' },
      condition: { device_id: 'condition-device', ability_id: 'switch.condition', ability_type: 'switch', condition_type: 'is_on' },
      action: { device_id: 'action-device', ability_id: 'cover.action', ability_type: 'cover', action_type: 'open' },
      lanRequestId: 'lan-id',
      wanRequestId: 'wan-id',
      residenceIds: { mockup2: 'residence-id' },
    })).toEqual({
      command: 'create_scene_info',
      id: 'wan-id',
      param: {
        residence_id: 'residence-id',
        scene_name: 'testing wan scene',
        manual: true,
        triggers: [{ trigger_config: 'device', device_id: 'trigger-device', ability_id: 'switch.trigger', ability_type: 'switch', trigger_type: 'turned_on' }],
        conditions: [{ condition_config: 'device', device_id: 'condition-device', ability_id: 'switch.condition', ability_type: 'switch', condition_type: 'is_on' }],
        actions: [{ action_config: 'device', device_id: 'action-device', ability_id: 'cover.action', ability_type: 'cover', action_type: 'open' }],
      },
    });
  });

  it('builds the WAN payload using the documented real device identifiers', () => {
    const request = buildCreateSceneRequest({
      isLan: false,
      selectedMockup: 'mockup2',
      sceneName: 'testing wan scene',
      manual: true,
      isAuto: false,
      trigger: { device_id: 'dc7edf1beadc246b0ab0248d73025d596', ability_id: 'switch.0c11052b761c_63_1', ability_type: 'switch', trigger_type: 'turned_on' },
      condition: { device_id: 'da59adf952f19dc69b82868e9c4f6aea2', ability_id: 'ec2dab6d92b8755a9f59b5611f0fa1ec2', ability_type: 'switch', condition_type: 'is_on' },
      action: { device_id: 'd467f8e96bd4f456eae181b4e073ec5c2', ability_id: 'cover.0c11052b761c_62_5', ability_type: 'cover', action_type: 'open' },
      wanRequestId: 'c45e846ca23ab42c9ae469d988ae32a96',
      residenceIds: { mockup2: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82' },
    });

    expect(request).toEqual({
      command: 'create_scene_info',
      id: 'c45e846ca23ab42c9ae469d988ae32a96',
      param: {
        residence_id: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
        scene_name: 'testing wan scene',
        manual: true,
        triggers: [{ trigger_config: 'device', device_id: 'dc7edf1beadc246b0ab0248d73025d596', ability_id: 'switch.0c11052b761c_63_1', ability_type: 'switch', trigger_type: 'turned_on' }],
        conditions: [{ condition_config: 'device', device_id: 'da59adf952f19dc69b82868e9c4f6aea2', ability_id: 'ec2dab6d92b8755a9f59b5611f0fa1ec2', ability_type: 'switch', condition_type: 'is_on' }],
        actions: [{ action_config: 'device', device_id: 'd467f8e96bd4f456eae181b4e073ec5c2', ability_id: 'cover.0c11052b761c_62_5', ability_type: 'cover', action_type: 'open' }],
      },
    });
  });

  it('builds the LAN create-scene payload using LAN condition field names', () => {
    const request = buildCreateSceneRequest({
      isLan: true,
      selectedMockup: 'mockup2',
      sceneName: 'testing lan scene',
      manual: true,
      isAuto: true,
      trigger: { device_id: 'trigger-device', ability_id: 'switch.trigger', ability_type: 'switch', trigger_type: 'turned_on' },
      condition: { device_id: 'lock-device', ability_id: 'lock.entity', ability_type: 'lock', condition_type: 'is_locked' },
      action: { device_id: 'action-device', ability_id: 'switch.action', ability_type: 'switch', action_type: 'turn_on' },
      lanRequestId: 'lan-id',
      wanRequestId: 'wan-id',
      residenceIds: {},
    });

    expect(request.id).toBe('lan-id');
    expect(request.param.is_auto).toBe(true);
    expect(request.param.conditions).toEqual([{
      condition: 'device',
      type: 'is_locked',
      device_id: 'lock-device',
      entity_id: 'lock.entity',
      domain: 'lock',
    }]);
  });

  it('builds LAN and WAN update requests with their respective scene contracts', () => {
    const base = {
      selectedMockup: 'mockup2',
      sceneId: 'scene-42',
      sceneName: 'Updated scene',
      manual: true,
      isAuto: true,
      trigger: { device_id: 'trigger-device', ability_id: 'switch.trigger', ability_type: 'switch', trigger_type: 'turned_on' },
      condition: { device_id: 'condition-device', ability_id: 'lock.condition', ability_type: 'lock', condition_type: 'is_locked' },
      action: { device_id: 'action-device', ability_id: 'switch.action', ability_type: 'switch', action_type: 'turn_on' },
      lanRequestId: '1d6b6b3c9f6c4a8aa55c0b46d0b7a901',
      wanRequestId: 'c45e846ca23ab42c9ae469d988ae32a96',
      residenceIds: { mockup2: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82' },
    };

    expect(buildUpdateSceneRequest({ ...base, isLan: true })).toEqual({
      command: 'update_scene_info',
      id: '1d6b6b3c9f6c4a8aa55c0b46d0b7a901',
      param: {
        scene_id: 'scene-42',
        scene_name: 'Updated scene',
        manual: true,
        is_auto: true,
        triggers: [{ trigger_config: 'device', device_id: 'trigger-device', ability_id: 'switch.trigger', ability_type: 'switch', trigger_type: 'turned_on' }],
        conditions: [{ condition: 'device', type: 'is_locked', device_id: 'condition-device', entity_id: 'lock.condition', domain: 'lock' }],
        actions: [{ action_config: 'device', device_id: 'action-device', ability_id: 'switch.action', ability_type: 'switch', action_type: 'turn_on' }],
      },
    });

    expect(buildUpdateSceneRequest({ ...base, isLan: false })).toEqual({
      command: 'update_scene_info',
      id: 'c45e846ca23ab42c9ae469d988ae32a96',
      param: {
        residence_id: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
        scene_id: 'scene-42',
        scene_name: 'Updated scene',
        manual: true,
        triggers: [{ trigger_config: 'device', device_id: 'trigger-device', ability_id: 'switch.trigger', ability_type: 'switch', trigger_type: 'turned_on' }],
        conditions: [{ condition_config: 'device', device_id: 'condition-device', ability_id: 'lock.condition', ability_type: 'lock', condition_type: 'is_locked' }],
        actions: [{ action_config: 'device', device_id: 'action-device', ability_id: 'switch.action', ability_type: 'switch', action_type: 'turn_on' }],
      },
    });
  });
});
