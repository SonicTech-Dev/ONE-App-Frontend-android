import { Alert } from 'react-native';

export const controlDevice = async (
  deviceId,
  abilityId,
  command,
  attribute,
  selectedOption,
  HEADERS,
  options = {},
) => {
  const { suppressErrorAlert = false } = options;

  // Normalize selectedOption
  const isLAN = selectedOption && selectedOption.toLowerCase() === 'lan';

  if (isLAN) {
    const lanApiUrl = `http://192.168.2.115/api/v1.0/device`;
    const body = {
      command: "control_device",
      id: "c45e846ca23ab42c9ae469d988ae32a96",
      param: {
        device_id: deviceId,
        ability_id: abilityId,
        action: command,
        ...(attribute ? { attribute } : {}),
      },
    };
    console.log('LAN headers received for API:', HEADERS);

    try {
      const response = await fetch(lanApiUrl, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        let data = null;
        try {
          data = await response.json();
        } catch {}
        return { ok: true, status: response.status, data };
      } else {
        let data = null;
        try {
          data = await response.json();
        } catch {}
        if (!suppressErrorAlert) {
          Alert.alert('Error', 'LAN control failed. Please check device connection.');
        }
        return { ok: false, status: response.status, data };
      }
    } catch (error) {
      console.error('LAN error:', error);
      if (!suppressErrorAlert) {
        Alert.alert('Error', 'Failed to control device locally.');
      }
      return { ok: false, status: null, error };
    }
  } else {
    const apiUrl = 'https://one-development.soniciot.com/control_devices/';
    const body = {
      command: 'batch_control_device',
      id: 'c45e846ca23ab42c9ae469d988ae32a96',
      param: {
        //onsite - residence_id: 'r45844047053e43d78fe5272c5badbd3a',
        residence_id: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
        devices: [
          {
            device_id: deviceId,
            ability_id: abilityId,
            control: command,
            ...(attribute ? { attribute } : {}),
          },
        ],
      },
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        let data = null;
        try {
          data = await response.json();
        } catch {}
        return { ok: true, status: response.status, data };
      } else {
        let data = null;
        try {
          data = await response.json();
        } catch {}
        if (!suppressErrorAlert) {
          Alert.alert('Error', 'Something went wrong. Please try again.');
        }
        return { ok: false, status: response.status, data };
      }
    } catch (error) {
      console.error('Error controlling device:', error);
      if (!suppressErrorAlert) {
        Alert.alert('Error', 'Failed to control the device. Please check your connection.');
      }
      return { ok: false, status: null, error };
    }
  }
};

export const deviceStatus = async (
  deviceId,
  selectedOption,
  setSelectedDeviceStatus,
  HEADERS, // required, must be passed through props
  options = {},
) => {
  const { deviceTitle = '', abilityId = '' } = options;
  const isHyPanel = String(deviceTitle || '').toLowerCase().includes('hypanel');

  const findBestMatchFromList = (listJson, { targetDeviceId, targetAbilityId, targetTitle }) => {
    const rawDevices = Array.isArray(listJson?.result)
      ? listJson.result
      : (Array.isArray(listJson?.result?.devices) ? listJson.result.devices : []);

    const normalizeName = (value) =>
      String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    const targetName = normalizeName(targetTitle);
    const flat = [];
    for (const d of rawDevices) {
      if (!d) continue;
      flat.push({ ...d, _parentDeviceId: d.device_id });
      if (Array.isArray(d.sub_devices)) {
        for (const sub of d.sub_devices) {
          if (!sub) continue;
          flat.push({ ...sub, _parentDeviceId: d.device_id });
        }
      }
    }

    let matchedDevice = null;
    let bestScore = -1;
    for (const d of flat) {
      let score = 0;
      const currentId = String(d?.device_id || '');
      if (targetDeviceId && currentId && currentId === targetDeviceId) score += 100;

      const abilities = Array.isArray(d?.abilities) ? d.abilities : [];
      if (targetAbilityId && abilities.some((a) => a?.ability_id === targetAbilityId)) score += 50;

      const nameA = normalizeName(d?.device_name);
      const nameB = normalizeName(d?.product_name);
      if (targetName && (nameA === targetName || nameB === targetName)) score += 25;
      if (targetName && (nameA.includes(targetName) || nameB.includes(targetName) || targetName.includes(nameA) || targetName.includes(nameB))) score += 10;

      if (score > bestScore) {
        bestScore = score;
        matchedDevice = d;
      }
    }

    return { matchedDevice, bestScore };
  };
  // Normalize selectedOption
  const isLAN = selectedOption && selectedOption.toLowerCase() === 'lan';

  if (isLAN) {
    const lanApiUrl = `http://192.168.2.115/api/v1.0/device`;
    const body = {
      command: 'get_device_info',
      id: 'c45e846ca23ab42c9ae469d988ae32a96',
      param: {
        device_id: deviceId,
      },
    };
    try {
      const response = await fetch(lanApiUrl, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedDeviceStatus(data);
      } else {
        Alert.alert('Error', 'LAN control failed. Please check device connection.');
      }
    } catch (error) {
      console.error('LAN error:', error);
      Alert.alert('Error', 'Failed to retrieve device status locally.');
    }
  } else {
    const apiUrl = 'https://one-development.soniciot.com/device_status/';
    const listBody = {
      command: 'get_device_list',
      id: 'c45e846ca23ab42c9ae469d988ae32a96',
      param: {
        residence_id: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
        show_ability: true,
      },
    };
    const body = {
      command: 'get_device_info',
      id: 'c45e846ca23ab42c9ae469d988ae32a96',
      param: {
        //onsite - residence_id: 'r45844047053e43d78fe5272c5badbd3a',
        residence_id: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
        device_id: deviceId,
      },
    };
    try {
      // Backend returns unsupported-command for WAN get_device_info on HyPanel models.
      // Resolve directly from get_device_list to avoid warning + extra retry latency.
      if (isHyPanel) {
        const panelListRes = await fetch(apiUrl, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify(listBody),
        });

        if (panelListRes.ok) {
          const panelListJson = await panelListRes.json();
          const { matchedDevice, bestScore } = findBestMatchFromList(panelListJson, {
            targetDeviceId: deviceId,
            targetAbilityId: abilityId,
            targetTitle: deviceTitle,
          });

          if (matchedDevice && bestScore > 0) {
            setSelectedDeviceStatus({ result: matchedDevice });
            return;
          }
        }
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedDeviceStatus(data);
      } else {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {}
        console.warn('WAN get_device_info non-2xx:', {
          status: response.status,
          deviceId,
          deviceTitle,
          abilityId,
          body: errorBody,
        });

        // Some WAN panel mappings can drift; resolve by id/ability/title from device-list and retry.
        if (deviceTitle || abilityId || deviceId) {
          try {
            const listRes = await fetch(apiUrl, {
              method: 'POST',
              headers: HEADERS,
              body: JSON.stringify(listBody),
            });

            if (listRes.ok) {
              const listJson = await listRes.json();
              const { matchedDevice, bestScore } = findBestMatchFromList(listJson, {
                targetDeviceId: deviceId,
                targetAbilityId: abilityId,
                targetTitle: deviceTitle,
              });

              const fallbackDeviceId = matchedDevice?.device_id || matchedDevice?._parentDeviceId;
              if (fallbackDeviceId && fallbackDeviceId !== deviceId) {
                const retryBody = {
                  command: 'get_device_info',
                  id: 'c45e846ca23ab42c9ae469d988ae32a96',
                  param: {
                    residence_id: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
                    device_id: fallbackDeviceId,
                  },
                };

                const retryRes = await fetch(apiUrl, {
                  method: 'POST',
                  headers: HEADERS,
                  body: JSON.stringify(retryBody),
                });

                if (retryRes.ok) {
                  const retryData = await retryRes.json();
                  setSelectedDeviceStatus(retryData);
                  return;
                }
              }

              // Final fallback: consume matched device from list payload instead of surfacing generic error.
              if (matchedDevice && bestScore > 0) {
                setSelectedDeviceStatus({ result: matchedDevice });
                return;
              }
            }
          } catch (fallbackError) {
            console.error('WAN fallback status lookup failed:', fallbackError);
          }
        }
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('Error retrieving device status:', error);
      Alert.alert('Error', 'Failed to retrieve the device status. Please check your connection.');
    }
  }
};