import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';

/**
 * DraggableSlider for numeric range (min..max) with step.
 * - No external dependencies.
 * - onChange called while dragging, onComplete on release.
 * - Smooth, stable thumb using Animated + PanResponder.
 *
 * Props:
 * - min (number)
 * - max (number)
 * - step (number)
 * - value (number)
 * - onChange?(value:number)
 * - onComplete?(value:number)
 * - disabled?(boolean)
 */
function DraggableSlider({
  min = 16,
  max = 32,
  step = 0.5,
  value = min,
  onChange,
  onComplete,
  disabled = false,
}) {
  const trackWidthRef = useRef(0);
  const draggingRef = useRef(false);
  const initialThumbXRef = useRef(0);

  // thumbX is pixel position (0..trackWidth)
  const thumbX = useRef(new Animated.Value(0)).current;
  const [measured, setMeasured] = useState(false);
  const [localValue, setLocalValue] = useState(Number(value));

  // Helper: clamp and snap to step
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const snap = (raw) => {
    const steps = Math.round((raw - min) / step);
    const snapped = Number((min + steps * step).toFixed(3));
    return clamp(snapped, min, max);
  };

  // When external value changes and we're not dragging, move thumb
  useEffect(() => {
    if (draggingRef.current) return;
    const w = trackWidthRef.current || 0;
    const pct = (clamp(value, min, max) - min) / (max - min);
    const targetX = Math.round(pct * w);
    Animated.spring(thumbX, {
      toValue: targetX,
      useNativeDriver: false,
      speed: 20,
      bounciness: 0,
    }).start();
    setLocalValue(Number(value));
  }, [value, min, max, thumbX]);

  const onTrackLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    trackWidthRef.current = w;
    const pct = (clamp(value, min, max) - min) / (max - min);
    const initialX = Math.round(pct * w);
    thumbX.setValue(initialX);
    setMeasured(true);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: () => {
        draggingRef.current = true;
        thumbX.stopAnimation((current) => {
          initialThumbXRef.current = current || 0;
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        const w = trackWidthRef.current || 1;
        let newX = initialThumbXRef.current + gestureState.dx;
        if (newX < 0) newX = 0;
        if (newX > w) newX = w;
        thumbX.setValue(newX);

        const raw = min + (newX / w) * (max - min);
        const snapped = snap(raw);
        setLocalValue(snapped);
        onChange && onChange(snapped);
      },
      onPanResponderRelease: (evt, gestureState) => {
        draggingRef.current = false;
        const w = trackWidthRef.current || 1;
        let newX = initialThumbXRef.current + gestureState.dx;
        if (newX < 0) newX = 0;
        if (newX > w) newX = w;
        const raw = min + (newX / w) * (max - min);
        const snapped = snap(raw);
        setLocalValue(snapped);
        // animate thumb to snapped position
        const snappedX = Math.round(((snapped - min) / (max - min)) * w);
        Animated.timing(thumbX, {
          toValue: snappedX,
          duration: 120,
          useNativeDriver: false,
        }).start();
        onComplete && onComplete(snapped);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        thumbX.stopAnimation((current) => {
          const w = trackWidthRef.current || 1;
          const raw = min + ((current || 0) / w) * (max - min);
          const snapped = snap(raw);
          setLocalValue(snapped);
          onComplete && onComplete(snapped);
        });
      },
    })
  ).current;

  const thumbTranslateStyle = {
    transform: [{ translateX: thumbX }],
  };

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.labelRow}>
        <Text style={sliderStyles.sliderLabel}>Set Position:</Text>
        <Text style={sliderStyles.sliderValue}>{localValue.toFixed(1)}°C</Text>
      </View>

      <View
        style={sliderStyles.trackContainer}
        onLayout={onTrackLayout}
        {...(measured ? panResponder.panHandlers : {})}
      >
        <View style={sliderStyles.trackBackground} />
        <Animated.View
          style={[
            sliderStyles.trackFilled,
            {
              width: thumbX.interpolate({
                inputRange: [0, trackWidthRef.current || 1],
                outputRange: [0, trackWidthRef.current || 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
        <Animated.View style={[sliderStyles.thumb, thumbTranslateStyle]} />
      </View>
    </View>
  );
}

export default function ACModal({
  visible,
  onClose,
  device,
  selectedOption = 'WAN',
  deviceStatus,
  onTurnOn,
  onTurnOff,
  onSetTemperature,
  onSetHVACMode,
  onSetFanSpeed,
}) {
  // State for all dynamic display values
  const [temp, setTemp] = useState(24);
  const [hvacMode, setHVACMode] = useState('auto');
  const [fanSpeed, setFanSpeed] = useState('auto');
  const [isOn, setIsOn] = useState(false);
  const [online, setOnline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supportHVACModes, setSupportHVACModes] = useState([
    { label: 'Auto', value: 'auto' },
    { label: 'Cool', value: 'cool' },
    { label: 'Heat', value: 'heat' },
    { label: 'Dry', value: 'dry' },
    { label: 'Fan', value: 'fan_only' },
  ]);
  const [supportFanSpeeds, setSupportFanSpeeds] = useState([
    { label: 'Auto', value: 'auto' },
    { label: 'Low', value: 'low' },
    { label: 'Med', value: 'medium' },
    { label: 'High', value: 'high' },
  ]);
  const [buttonPressed, setButtonPressed] = useState(null); // "on" or "off" or null

  // Extracted device name
  const deviceTitle = device?.title || deviceStatus?.result?.device_name || 'AC';

  // Helper to create pretty labels (handles underscores and 'fan_only' specially)
  const prettyLabel = (mode) => {
    if (!mode || typeof mode !== 'string') return '';
    if (mode === 'fan_only') return 'Fan';
    return mode
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  };

  const normalizeState = (state) => String(state || '').trim().toLowerCase();

  const resolvePreferredAbilityId = () => {
    const mode = String(selectedOption || 'WAN').toLowerCase();
    return mode === 'lan' ? device?.lan?.ability_id : device?.wan?.ability_id;
  };

  const isClimateLike = (ability = {}) => {
    const abilityType = normalizeState(ability?.ability_type);
    const abilityName = normalizeState(ability?.ability_name);
    const abilityId = normalizeState(ability?.ability_id);
    const attr = ability?.attribute || {};

    if (abilityType.includes('climate') || abilityType.includes('hvac')) return true;
    if (abilityName.includes('climate') || abilityName.includes('hvac') || abilityName.includes('air')) return true;
    if (abilityId.includes('climate') || abilityId.includes('hvac') || abilityId.includes('air')) return true;

    return (
      typeof attr.preset_temperature !== 'undefined' ||
      typeof attr.target_temperature !== 'undefined' ||
      typeof attr.hvac_mode === 'string' ||
      typeof attr.fan_mode === 'string' ||
      Array.isArray(attr.support_hvac_mode) ||
      Array.isArray(attr.support_fan_mode)
    );
  };

  const findClimateAbility = (abilities = []) => {
    const preferredAbilityId = resolvePreferredAbilityId();
    if (preferredAbilityId) {
      const exact = abilities.find((a) => a?.ability_id === preferredAbilityId);
      if (exact) return exact;
    }

    const byClimate = abilities.find((a) => isClimateLike(a));
    if (byClimate) return byClimate;

    return abilities[0] || null;
  };

  // Update display state from deviceStatus when it changes
  useEffect(() => {
    if (!deviceStatus || !deviceStatus.result) {
      setLoading(true);
      return;
    }
    setLoading(false);
    const abilities = deviceStatus.result.abilities || [];
    const climateAbility = findClimateAbility(abilities);
    if (climateAbility) {
      const climateAttributes = climateAbility.attribute || {};
      const normalizedState = normalizeState(climateAbility.state);
      if (normalizedState === 'on' || normalizedState === 'off') {
        setIsOn(normalizedState === 'on');
      }

      const nextTemperature = typeof climateAttributes.preset_temperature !== 'undefined'
        ? climateAttributes.preset_temperature
        : climateAttributes.target_temperature;
      if (typeof nextTemperature !== 'undefined') {
        setTemp(Number(nextTemperature));
      }
      if (typeof climateAttributes.hvac_mode === 'string') {
        setHVACMode(climateAttributes.hvac_mode);
      }
      if (typeof climateAttributes.fan_mode === 'string') {
        setFanSpeed(climateAttributes.fan_mode);
      }
      if (Array.isArray(climateAttributes.support_hvac_mode)) {
        const acModes = climateAttributes.support_hvac_mode.map((mode) => ({
          label: prettyLabel(mode),
          value: mode,
        }));
        setSupportHVACModes(acModes);
      }
      if (Array.isArray(climateAttributes.support_fan_mode)) {
        const fanModes = climateAttributes.support_fan_mode.map((mode) => ({
          label: prettyLabel(mode),
          value: mode,
        }));
        setSupportFanSpeeds(fanModes);
      }
    }

    // Remove device picture usage entirely (no setDeviceImage)
    setOnline(deviceStatus.result.online);
    setButtonPressed(null); // Reset pressed state when device status updates
  }, [deviceStatus]);

  // Handlers for controls
  const handleTempChange = (value) => {
    setTemp(value);
  };
  const handleTempComplete = (value) => {
    setTemp(value);
    if (onSetTemperature) onSetTemperature(value);
  };
  const handleMinus = () => {
    const newTemp = Math.max(16, parseFloat((temp - 0.5).toFixed(1)));
    setTemp(newTemp);
    if (onSetTemperature) onSetTemperature(newTemp);
  };
  const handlePlus = () => {
    const newTemp = Math.min(32, parseFloat((temp + 0.5).toFixed(1)));
    setTemp(newTemp);
    if (onSetTemperature) onSetTemperature(newTemp);
  };
  const handleModeChange = (value) => {
    setHVACMode(value);
    if (onSetHVACMode) onSetHVACMode(value);
  };
  const handleFanChange = (value) => {
    setFanSpeed(value);
    if (onSetFanSpeed) onSetFanSpeed(value);
  };

  // "gray" style logic for power buttons:
  const isTurnOnActive = (isOn && buttonPressed !== 'off') || buttonPressed === 'on';
  const isTurnOffActive = (!isOn && buttonPressed !== 'on') || buttonPressed === 'off';

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={() => {}}>
      <View style={styles.modalBackground}>
        <View style={styles.modalContent}>
          {/* Close Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={{ fontSize: 22 }}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{deviceTitle}</Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Online Status:</Text>
            <Text style={[styles.statusValue, online === true ? styles.online : styles.offline]}>
              {online === true ? 'Online' : online === false ? 'Offline' : 'Unknown'}
            </Text>
          </View>

          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#32d2d6" />
            </View>
          ) : (
            <>
              {/* Power Buttons */}
              <View style={styles.powerRow}>
                <TouchableOpacity
                  style={[styles.powerButton, isTurnOnActive ? styles.powerButtonGray : styles.powerButtonOn]}
                  onPress={() => {
                    setButtonPressed('on');
                    if (onTurnOn) onTurnOn();
                  }}
                  disabled={isTurnOnActive}
                >
                  <Text style={[styles.powerText, isTurnOnActive ? styles.powerTextGray : styles.powerTextOn]}>
                    Turn On
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.powerButton, isTurnOffActive ? styles.powerButtonGray : styles.powerButtonOff]}
                  onPress={() => {
                    setButtonPressed('off');
                    if (onTurnOff) onTurnOff();
                  }}
                  disabled={isTurnOffActive}
                >
                  <Text style={[styles.powerText, isTurnOffActive ? styles.powerTextGray : styles.powerTextOff]}>
                    Turn Off
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Arc-shaped Temperature Controller */}
              <View style={styles.arcContainer}>
                <TouchableOpacity style={styles.tempButton} onPress={handleMinus}>
                  <Text style={styles.tempButtonText}>-</Text>
                </TouchableOpacity>
                <View style={styles.tempArc}>
                  {/* Render temperature and unit on a single line and slightly reduce the font size */}
                  <Text style={styles.tempValue} numberOfLines={1} ellipsizeMode="clip">
                    {`${temp.toFixed(1)}°C`}
                  </Text>
                </View>
                <TouchableOpacity style={styles.tempButton} onPress={handlePlus}>
                  <Text style={styles.tempButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Replaced Slider with DraggableSlider (behaves like Curtain slider) */}
              <DraggableSlider
                min={16}
                max={32}
                step={0.5}
                value={temp}
                onChange={handleTempChange}
                onComplete={handleTempComplete}
                disabled={false}
              />

              {/* HVAC Modes */}
              <Text style={styles.sectionLabel}>HVAC Mode</Text>
              <View style={styles.optionsRow}>
                {supportHVACModes.map((mode) => (
                  <TouchableOpacity
                    key={mode.value}
                    style={[styles.optionButton, hvacMode === mode.value && styles.optionButtonSelected]}
                    onPress={() => handleModeChange(mode.value)}
                  >
                    <Text style={[styles.optionText, hvacMode === mode.value && styles.optionTextSelected]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Fan Speeds */}
              <Text style={styles.sectionLabel}>Fan Speed</Text>
              <View style={styles.optionsRow}>
                {supportFanSpeeds.map((fan) => (
                  <TouchableOpacity
                    key={fan.value}
                    style={[styles.optionButton, fanSpeed === fan.value && styles.optionButtonSelected]}
                    onPress={() => handleFanChange(fan.value)}
                  >
                    <Text style={[styles.optionText, fanSpeed === fan.value && styles.optionTextSelected]}>
                      {fan.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
    marginBottom: 6,
  },
  labelRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 6,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  trackContainer: {
    width: '90%',
    height: 36,
    justifyContent: 'center',
    position: 'relative',
    alignSelf: 'center',
  },
  trackBackground: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  trackFilled: {
    position: 'absolute',
    left: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#32d2d6',
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6f4bd8',
    borderWidth: 3,
    borderColor: '#32d2d6',
    top: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#32d2d6',
  },
});const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: 'flex-end', // iOS slide-up style
    backgroundColor: 'rgba(111,75,216,0.28)',
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#6f4bd8', // Dark mode glass base
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#ffffff', marginBottom: 8, letterSpacing: 0.5 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
    justifyContent: 'center',
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  statusLabel: { fontSize: 13, color: '#8e8e93', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  statusValue: { fontSize: 13, fontWeight: '800', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 1 },
  online: { color: '#34c759' },
  offline: { color: '#ff3b30' },
  powerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  powerButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  powerButtonGray: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'transparent',
  },
  powerTextGray: {
    color: '#8e8e93',
    fontWeight: '700',
    fontSize: 16,
  },
  powerButtonOn: {
    backgroundColor: 'rgba(50,210,214,0.15)',
    borderColor: '#32d2d6',
  },
  powerTextOn: {
    color: '#32d2d6',
    fontWeight: '800',
    fontSize: 16,
  },
  powerButtonOff: {
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderColor: '#ff3b30',
  },
  powerTextOff: {
    color: '#ff3b30',
    fontWeight: '800',
    fontSize: 16,
  },
  arcContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  tempArc: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    borderWidth: 2,
    borderColor: '#32d2d6',
  },
  tempValue: { fontSize: 34, fontWeight: '800', color: '#ffffff', includeFontPadding: false },
  tempButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tempButtonText: { fontSize: 26, color: '#ffffff', fontWeight: '500' },
  sectionLabel: { fontSize: 13, color: '#8e8e93', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 12, alignSelf: 'flex-start', paddingLeft: 8 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  optionText: { color: '#8e8e93', fontWeight: '600', fontSize: 13 },
  optionTextSelected: { color: '#ffffff', fontWeight: '800' },
  closeButton: { position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
});