import {
  getSceneId,
  extractSceneDetailPayload,
  buildSceneInfoRequest,
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
});
