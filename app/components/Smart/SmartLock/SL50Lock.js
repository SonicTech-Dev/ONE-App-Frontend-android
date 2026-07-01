import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeModules,
  NativeEventEmitter,
  requireNativeComponent,
  UIManager,
  Dimensions,
} from 'react-native';
import Screen from '../../Screen';
import useColors from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import { MOCKUP_OPTIONS } from '../SmartScreenSections/SmartScreen.constants';

const DEVICE_IP = '192.168.2.102';
let sdkInitialized = false; // module-level guard so initSdk is only called once
const FALLBACK_WAN_RTSP_URL = 'rtsp://rtsp-a.ecloud.akubela.com:10554/507B91E334CC';
const FALLBACK_WAN_RTSP_URL_MOCKUP_1 = 'rtsp://rtsp-a.ecloud.akubela.com:10554/507B91E14E64';
const FALLBACK_WAN_CIPHERTEXT = 'mUud6jHgyOriMe31CM4YdJaw14V6QnaEQWLnt9hBESVdbkf/mhnfJzm3IDTe1CDb+jHCKim61McoxnhQucbFWv/5Ncm0BbXKNtlU7gP9VJAO7OvtDBf1SANiyN0XRtabTvxYxigUdmE4CGCz0Vf67w==';
const FALLBACK_WAN_CIPHERTEXT_MOCKUP_1 = 'mUud6jHgyOriMe31CM4YdN4wBdaPnUSPB34SX17EBxUU4y74REq8CPyGxOAVdgOxR4v/c7yUd6oILUpZ21pTLsr1OE3tN2GOFmTW+VSaQRRS6KbjskTAvbhLumJ6hVBDcpYWwDgatX9EGCFmZ0svKQ==';
const MAX_MONITOR_RETRIES = 3;

/** Extracts host IP from any rtsp://host:port/... or rtsp://user:pass@host:port/... URL */
function extractIpFromRtspUrl(rtspUrl) {
  if (!rtspUrl) return null;
  // Strip credentials if present (rtsp://user:pass@host:port/...)
  const withoutScheme = rtspUrl.replace(/^rtsp:\/\//i, '');
  const hostPart = withoutScheme.includes('@')
    ? withoutScheme.split('@')[1]
    : withoutScheme;
  const ip = hostPart.split(':')[0].split('/')[0];
  return ip || null;
}

const { Akuvox } = NativeModules;

const VIEW_NAME = 'SmartLockMonitorView';
const isNativeViewRegistered =
  (UIManager.getViewManagerConfig
    ? UIManager.getViewManagerConfig(VIEW_NAME)
    : UIManager[VIEW_NAME]) != null;

// Fallback throws a helpful error if the native view isn’t registered
const SmartLockMonitorView = isNativeViewRegistered
  ? requireNativeComponent(VIEW_NAME)
  : () => {
      throw new Error(
        `${VIEW_NAME} is not registered. Rebuild the app after adding SmartLockMonitorViewManager and ensure the package is linked.`
      );
    };

function checkMethod(name) {
  if (!Akuvox || typeof Akuvox[name] !== 'function') {
    throw new Error(`[Akuvox] Missing native method: ${name}`);
  }
}

export default function SL50LockScreen({ route }) {
  const colors = useColors();
  const { networkMode } = useAuth();

  const modeFromRoute = String(route?.params?.selectedOption || '').toUpperCase();
  const selectedOption = modeFromRoute === 'LAN' || modeFromRoute === 'WAN'
    ? modeFromRoute
    : String(networkMode || 'WAN').toUpperCase() === 'LAN'
      ? 'LAN'
      : 'WAN';

  const selectedMockup = route?.params?.selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? MOCKUP_OPTIONS.MOCKUP_1
    : MOCKUP_OPTIONS.MOCKUP_2;
  const isMockup1 = selectedMockup === MOCKUP_OPTIONS.MOCKUP_1;

  const wanRtspUrl = route?.params?.wanRtspUrl || (
    isMockup1 ? FALLBACK_WAN_RTSP_URL_MOCKUP_1 : FALLBACK_WAN_RTSP_URL
  );
  const wanCiphertext = route?.params?.wanCiphertext || (
    isMockup1 ? FALLBACK_WAN_CIPHERTEXT_MOCKUP_1 : FALLBACK_WAN_CIPHERTEXT
  );

  // Device config — IDs are fixed per residence, IP is resolved automatically
  const residenceId = isMockup1 ? 'r45844047053e43d78fe5272c5badbd3a' : 'rabd2c6d2aecc4ce3be11e25b4ecd3c82';
  const userId     = 'a9b41de81c3284515a5e833d53412fe14';
  const deviceId   = isMockup1 ? 'd17a685f1c5dd4aa893cda99623df553e' : 'da1c171e3a276417fb2212f0abb2de46f';

  // IP is NOT hardcoded — loaded from cache (written by SDK after first connect)
  const [deviceIp, setDeviceIp] = useState(DEVICE_IP);

  // UI state
  const [isReady, setIsReady] = useState(false);   // true once initLockConfig delay passes
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorId, setMonitorId] = useState(null);
  const [monitorType, setMonitorType] = useState(selectedOption);
  const [unlockStatus, setUnlockStatus] = useState(null);
  const [videoError, setVideoError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewRefreshNonce, setViewRefreshNonce] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const cleanupRef = React.useRef(null);
  const monitorIdRef = React.useRef(null);
  const selectedOptionRef = React.useRef(selectedOption);
  const isPlayingRef = React.useRef(isPlaying);
  const isMonitoringRef = React.useRef(false);
  const loadingRef = React.useRef(false);
  const retryTimeoutRef = React.useRef(null);
  const unlockRetryTimeoutRef = React.useRef(null);
  const startInFlightRef = React.useRef(false);
  const startMonitorRef = React.useRef(() => {});
  const retryMonitorRef = React.useRef(() => {});
  const stopCurrentMonitorRef = React.useRef(() => {});

  useEffect(() => {
    selectedOptionRef.current = selectedOption;
    setMonitorType(selectedOption);
  }, [selectedOption]);

  useEffect(() => {
    monitorIdRef.current = monitorId;
  }, [monitorId]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const safePromiseCall = useCallback(async (fn, args = [], alertMsg = '', onError = () => {}) => {
    try {
      checkMethod(fn);
      const result = Akuvox[fn](...args);
      if (result && typeof result.then === 'function') {
        return await result;
      }
      return result;
    } catch (err) {
      console.error(`[Akuvox] ${fn} error:`, err);
      Alert.alert('Native Error', alertMsg || err.message);
      onError(err);
      return null;
    }
  }, []);

  const safeCall = useCallback((fn, args, alertMsg = '', onError = () => {}) => {
    try {
      checkMethod(fn);
      Akuvox[fn](...args);
    } catch (err) {
      console.error(`[Akuvox] ${fn} error:`, err);
      Alert.alert('Native Error', alertMsg || err.message);
      onError(err);
    }
  }, []);

  const stopCurrentMonitor = useCallback(() => {
    const activeMonitorId = monitorIdRef.current;
    console.log('[SmartLock] stopCurrentMonitor', {
      selectedOption: selectedOptionRef.current,
      monitorId: activeMonitorId,
    });

    if (activeMonitorId && activeMonitorId > 0) {
      safeCall('finishMonitor', [activeMonitorId]);
    }
    startInFlightRef.current = false;
    safeCall('stopVideoViaLAN', [deviceId]);
    safeCall('clearRtspMessageListener', []);
    setIsMonitoring(false);
    setMonitorId(null);
    setLoading(false);
  }, [safeCall, deviceId]);

  const startMonitor = useCallback(async () => {
    if (!isReady || !isPlayingRef.current) {
      return;
    }

    if (startInFlightRef.current) {
      console.log('[SmartLock] startMonitor skipped (in-flight)');
      return;
    }
    startInFlightRef.current = true;

    const mode = selectedOptionRef.current;
    setVideoError('');
    setLoading(true);
    setUnlockStatus(null);
    setMonitorType(mode);

    console.log('[SmartLock] startMonitor requested', {
      mode,
      monitorId: monitorIdRef.current,
      hasWanRtspUrl: !!wanRtspUrl,
      hasWanCiphertext: !!wanCiphertext,
    });

    if (mode === 'LAN') {
      safeCall('setRtspMessageListener', [deviceId, userId], 'Failed to set RTSP listener');
      safeCall('prepareVideoStart', [deviceId], 'Failed to prepare video start');
      startInFlightRef.current = false;
      return;
    }

    if (!wanRtspUrl || !wanCiphertext) {
      setLoading(false);
      setVideoError('WAN monitor parameters missing.');
      startInFlightRef.current = false;
      return;
    }

    const wanRes = await safePromiseCall(
      'startWanMonitor',
      [wanRtspUrl, wanCiphertext],
      'Failed to start WAN monitoring'
    );

    console.log('[SmartLock] startWanMonitor result', wanRes);

    if (!wanRes || !wanRes.monitorId || wanRes.monitorId <= 0) {
      // WAN often needs a short retry window before emitting a valid monitor ID.
      // Keep showing the connecting state instead of a transient failure message.
      setVideoError('');
      setLoading(true);
      retryMonitorRef.current('wanStartPending');
      startInFlightRef.current = false;
      return;
    }

    // Apply monitor state immediately when native start succeeds.
    setMonitorId(wanRes.monitorId);
    setIsMonitoring(true);
    setVideoError('');
    setLoading(false);

    startInFlightRef.current = false;
  }, [
    isReady,
    safeCall,
    safePromiseCall,
    deviceId,
    userId,
    wanRtspUrl,
    wanCiphertext,
  ]);

  const retryMonitor = useCallback((reason) => {
    if (!isPlayingRef.current || !isReady) {
      return;
    }

    if (!isMonitoringRef.current && !loadingRef.current) {
      console.log('[SmartLock] retryMonitor skipped (no active or pending monitor)', { reason });
      return;
    }

    setRetryCount((prev) => {
      const next = prev + 1;
      console.log('[SmartLock] retryMonitor scheduled', { reason, retryCount: next });
      if (next > MAX_MONITOR_RETRIES) {
        setVideoError(`Monitor unstable (${reason}). Please tap Play to retry.`);
        return next;
      }

      stopCurrentMonitor();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      retryTimeoutRef.current = setTimeout(() => {
        startMonitor();
      }, 900);
      return next;
    });
  }, [isReady, startMonitor, stopCurrentMonitor]);

  useEffect(() => {
    startMonitorRef.current = startMonitor;
  }, [startMonitor]);

  useEffect(() => {
    retryMonitorRef.current = retryMonitor;
  }, [retryMonitor]);

  useEffect(() => {
    stopCurrentMonitorRef.current = stopCurrentMonitor;
  }, [stopCurrentMonitor]);

  function handleInitLockConfig(ip) {
    console.log('[SmartLock] initLockConfig → deviceIp:', ip);
    safeCall('initLockConfig', [residenceId, userId, deviceId, ip], 'Lock initialization failed');
  }

  const handleUnlock = () => {
    if (!isReady) return;
    console.log('[SmartLock] Unlock requested', {
      selectedOption: selectedOptionRef.current,
      deviceId,
      monitorId: monitorIdRef.current,
    });
    const maxAttempts = selectedOptionRef.current === 'WAN' ? 3 : 2;

    const doUnlock = (attempt) => {
      safeCall(
        'unlockViaLAN',
        [deviceId, (success) => {
          console.log('[SmartLock] unlockViaLAN result', {
            selectedOption: selectedOptionRef.current,
            success,
            attempt,
            maxAttempts,
          });

          if (success) {
            setUnlockStatus('Unlocked');
            return;
          }

          if (attempt < maxAttempts) {
            unlockRetryTimeoutRef.current = setTimeout(() => doUnlock(attempt + 1), 550);
            return;
          }

          setUnlockStatus('Unlock failed');
        }],
        'Failed to trigger door unlock',
        () => {
          if (attempt < maxAttempts) {
            unlockRetryTimeoutRef.current = setTimeout(() => doUnlock(attempt + 1), 550);
          } else {
            setUnlockStatus('Unlock failed');
          }
        }
      );
    };

    doUnlock(1);
  };

  const handleTogglePlay = () => {
    const nextPlaying = !isPlayingRef.current;
    setIsPlaying(nextPlaying);

    if (!isReady) {
      return;
    }

    if (nextPlaying) {
      setRetryCount(0);
      stopCurrentMonitorRef.current();
      setTimeout(() => {
        startMonitorRef.current();
      }, 150);
      return;
    }

    stopCurrentMonitorRef.current();
  };

  // ── Step 1: once IP is known, start the SDK ──────────────────────────────
  useEffect(() => {
    if (!deviceIp) return;
    let mounted = true;

    // Ensure the global SDK (ISipMessageListener) is initialised in this process.
    // SmartScreen normally does this, but guard here so it always runs.
    if (!sdkInitialized) {
      try {
        checkMethod('initSdk');
        Akuvox.initSdk();
        sdkInitialized = true;
        console.log('[SmartLock] initSdk called from SL50LockScreen');
      } catch (e) {
        console.warn('[SmartLock] initSdk error:', e);
      }
    }

    handleInitLockConfig(deviceIp);

    // Give the SDK time to establish its internal connection to the device.
    // initLockConfig is synchronous on the JS side but async inside the SDK.
    const initDelay = setTimeout(() => {
      if (!mounted) return;
      setIsReady(true);

      const eventEmitter = new NativeEventEmitter(Akuvox);

      const lanSub = eventEmitter.addListener('onSmartLockRtsp', async (event) => {
        console.log('[SmartLock] onSmartLockRtsp event', event);
        if (selectedOptionRef.current !== 'LAN' || !isPlayingRef.current) {
          return;
        }

        if (event?.status === 'rtspReady' && event.rtspUrl) {
          const sdkIp = extractIpFromRtspUrl(event.rtspUrl);
          if (sdkIp) {
            console.log('[SmartLock] SDK detected IP from rtspUrl:', sdkIp);
          }
          setLoading(true);
          const res = await safePromiseCall(
            'startMonitorViaLAN',
            [event.rtspUrl, deviceId],
            'Failed to start LAN monitoring'
          );
          console.log('[SmartLock] startMonitorViaLAN result', res);
          if (!res) {
            setLoading(false);
            setVideoError('Failed to start LAN monitor');
          } else if (res.monitorId > 0) {
            setLoading(false);
            setMonitorId(res.monitorId);
            setIsMonitoring(true);
            setVideoError('');
          } else {
            // SDK commonly returns 0 here and emits the real monitorId through
            // onMonitorEstablished a moment later. Keep the loading state alive.
            setVideoError('');
          }
        }
        if (event?.status === 'rtspStop') {
          setIsMonitoring(false);
          setMonitorId(null);
          setLoading(false);
          if (isPlayingRef.current) {
            retryMonitor('rtspStop');
          }
        }
      });

      const establishedSub = eventEmitter.addListener('onMonitorEstablished', (event) => {
        console.log('[SmartLock] onMonitorEstablished', event);
        if (event?.monitorId > 0) {
          setRetryCount(0);
          setIsMonitoring(true);
          setVideoError('');
          setMonitorId(event.monitorId);
          setMonitorType(selectedOptionRef.current);
          setViewRefreshNonce((prev) => prev + 1);
          setLoading(false);
        }
      });

      const surfaceViewSub = eventEmitter.addListener('onMonitorLoadSurfaceView', (event) => {
        console.log('[SmartLock] onMonitorLoadSurfaceView', event);
        if (event?.monitorId > 0) {
          setMonitorId(event.monitorId);
          setViewRefreshNonce((prev) => prev + 1);
          setLoading(false);
        }
      });

      const wanStartedSub = eventEmitter.addListener('onWanMonitorStarted', (event) => {
        console.log('[SmartLock] onWanMonitorStarted', event);
        if (!event || event.monitorId <= 0) {
          setVideoError('');
          setLoading(true);
          retryMonitor('wanMonitorStartFailed');
        }
      });

      const monitorFinishedSub = eventEmitter.addListener('onMonitorFinished', () => {
        console.log('[SmartLock] onMonitorFinished');
        setIsMonitoring(false);
        setMonitorId(null);
        setLoading(false);
        if (isPlayingRef.current) {
          retryMonitor('monitorFinished');
        }
      });

      const rtspErrorSub = eventEmitter.addListener('onRtspError', (event) => {
        console.log('[SmartLock] onRtspError', event);
        setLoading(true);
        if (selectedOptionRef.current === 'LAN') {
          setVideoError(`RTSP error: ${event?.error || 'Unknown error'}`);
        } else {
          // For WAN, suppress transient startup errors and show connecting UI.
          setVideoError('');
        }
        retryMonitor('rtspError');
      });

      // inner cleanup returned from the timeout callback is not called automatically
      // so we store refs for the outer cleanup to use
      cleanupRef.current = () => {
        try {
          lanSub.remove();
          establishedSub.remove();
          surfaceViewSub.remove();
          wanStartedSub.remove();
          monitorFinishedSub.remove();
          rtspErrorSub.remove();
        } catch {}
      };

      // Intentionally do not auto-start monitoring here.
      // Play button should be the only entry point for video start.
    }, 600);

    return () => {
      mounted = false;
      clearTimeout(initDelay);
      if (cleanupRef.current) cleanupRef.current();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (unlockRetryTimeoutRef.current) clearTimeout(unlockRetryTimeoutRef.current);
      stopCurrentMonitorRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIp]);

  useEffect(() => {
    if (!isReady || !isPlayingRef.current) {
      return;
    }

    console.log('[SmartLock] selectedOption changed while playing. Restarting monitor.', {
      selectedOption,
    });
    stopCurrentMonitorRef.current();
    setTimeout(() => {
      startMonitorRef.current();
    }, 150);
  }, [isReady, selectedOption]);

  const renderVideoArea = () => {
    if (!isPlaying) {
      return (
        <View style={[styles.videoContainer, { backgroundColor: '#000' }]}>
          <Text style={styles.monitorType}>{selectedOption} Monitoring</Text>
          <Text style={styles.placeholderText}>Video paused</Text>
        </View>
      );
    }

    if (isMonitoring && monitorId && monitorId > 0) {
      return (
        <View style={[styles.videoContainer, { backgroundColor: colors.dark }]}>
          <SmartLockMonitorView
            key={`monitor-${monitorId}-${viewRefreshNonce}`}
            style={styles.nativeVideo}
            monitorId={monitorId}
          />
          <Text style={styles.monitorType}>{monitorType} Monitoring</Text>
          {videoError ? <Text style={styles.videoError}>{videoError}</Text> : null}
        </View>
      );
    }

    if (loading) {
      return (
        <View style={[styles.videoContainer, { backgroundColor: '#000' }]}>
          <Text style={styles.monitorType}>{selectedOption} Monitoring</Text>
          <Text style={styles.placeholderText}>Starting video...</Text>
        </View>
      );
    }

    if (videoError) {
      return (
        <View style={[styles.videoContainer, { backgroundColor: '#000' }]}>
          <Text style={styles.monitorType}>{selectedOption} Monitoring</Text>
          <Text style={styles.videoError}>{videoError}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.videoContainer, { backgroundColor: '#000' }]}>
        <Text style={styles.monitorType}>{selectedOption} Monitoring</Text>
        <Text style={styles.placeholderText}>Tap Play Video to start camera</Text>
      </View>
    );
  };

  return (
    <Screen style={{ backgroundColor: '#f4f0ff' }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>Smart Lock</Text>
          </View>
          <View style={[styles.metaChip, styles.metaChipSoft]}>
            <Text style={styles.metaTextSoft}>{isMonitoring ? 'Live' : 'Standby'}</Text>
          </View>
        </View>

        <View style={styles.lockCard}>
          <Text style={styles.lockCardTitle}>Entrance Door</Text>
          <Text style={styles.lockSubtitle}>Control access and monitor the live lock camera feed.</Text>
          <View style={styles.controlRow}>
            <View style={[styles.statusBadge, styles.modeBadge]}>
              <Text style={styles.statusText}>Mode: {selectedOption}</Text>
            </View>
            <TouchableOpacity
              style={[styles.playPauseButton, !isReady && styles.playPauseButtonDisabled]}
              onPress={handleTogglePlay}
              activeOpacity={0.85}
              disabled={!isReady}
            >
              <Text style={styles.playPauseText}>{isPlaying ? 'Pause Video' : 'Play Video'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.unlockButton, !isReady && styles.unlockButtonDisabled]}
            onPress={handleUnlock}
            activeOpacity={0.85}
            disabled={!isReady}
          >
            <Text style={styles.unlockButtonText}>{isReady ? 'Unlock' : 'Connecting...'}</Text>
          </TouchableOpacity>
          {loading ? <Text style={styles.connectingText}>Connecting {selectedOption} monitor...</Text> : null}
          {unlockStatus ? (
            <View style={[styles.statusBadge, unlockStatus === 'Unlocked' ? styles.statusSuccess : styles.statusError]}>
              <Text style={styles.statusText}>{unlockStatus}</Text>
            </View>
          ) : null}
        </View>

        {renderVideoArea()}
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f0ff' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6d8ff',
  },
  metaChipSoft: {
    backgroundColor: '#6f4bd8',
    borderColor: '#6f4bd8',
  },
  metaText: {
    color: '#6346b0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  metaTextSoft: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  lockCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e7dcff',
    shadowColor: '#7f58e2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lockCardTitle: { fontSize: 18, fontWeight: '700', color: '#25344d', marginBottom: 6 },
  lockSubtitle: { fontSize: 13, color: '#6c7a90', marginBottom: 16, lineHeight: 19 },
  controlRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modeBadge: {
    backgroundColor: '#f1e9ff',
  },
  playPauseButton: {
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#d7c8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  playPauseButtonDisabled: {
    opacity: 0.5,
  },
  playPauseText: {
    color: '#5a3aa9',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  unlockButton: {
    width: '100%',
    backgroundColor: '#6f4bd8',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6f4bd8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  unlockButtonDisabled: {
    backgroundColor: '#b3a0e8',
    shadowOpacity: 0,
    elevation: 0,
  },
  unlockButtonText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.4 },
  connectingText: {
    marginTop: 10,
    color: '#5b6b84',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusSuccess: {
    backgroundColor: '#f1e9ff',
  },
  statusError: {
    backgroundColor: '#fbe4e4',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5a3aa9',
  },
  videoContainer: {
    width: '100%',
    height: Math.round(Dimensions.get('window').height * 0.45),
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e7dbff',
    marginTop: 2,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7f58e2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  nativeVideo: { flex: 1, width: '100%', minHeight: 220, backgroundColor: '#111' },
  monitorType: {
    position: 'absolute',
    top: 10,
    left: 10,
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    backgroundColor: 'rgba(111,75,216,0.78)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  videoError: {
    color: '#fca5a5',
    fontWeight: '700',
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  placeholderText: {
    color: '#c9ced8',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});