import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  NativeModules,
  NativeEventEmitter,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import VideoCallView from '../components/Native/VideoCallView';

const { Akuvox } = NativeModules;
const eventEmitter = new NativeEventEmitter(Akuvox);

const formatDuration = (totalSeconds) => {
  const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

const getInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function ActiveCallScreen({ route, navigation }) {
  const { callId, remoteName, isOutgoing, dialTargets, dialTargetIndex, callVideoMode } = route.params || {};
  const insets = useSafeAreaInsets();
  const initialCallId = callId === 'dialing' ? null : Number(callId);
  const [activeCallId, setActiveCallId] = useState(Number.isFinite(initialCallId) ? initialCallId : null);
  const [sessionCallId, setSessionCallId] = useState(Number.isFinite(initialCallId) ? initialCallId : null);
  const [isClosing, setIsClosing] = useState(false);
  const [currentDialIndex, setCurrentDialIndex] = useState(
    Number.isInteger(dialTargetIndex) && dialTargetIndex >= 0 ? dialTargetIndex : 0
  );
  const [videoRenderNonce, setVideoRenderNonce] = useState(0);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const closingRef = useRef(false);
  const retryingRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const retryTimeoutRef = useRef(null);
  const rebindTimeoutRef = useRef(null);
  const initialSpeakerRef = useRef(null);
  const speakerRef = useRef(false);
  const speakerPendingRef = useRef(false);
  const mutedRef = useRef(false);
  const mutePendingRef = useRef(false);

  const isVideoCall = callVideoMode !== 0;
  const showVideo = Boolean(activeCallId) && isVideoCall;
  const initials = getInitials(remoteName);

  const closeScreen = () => {
    if (closingRef.current) {
      return;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (rebindTimeoutRef.current) {
      clearTimeout(rebindTimeoutRef.current);
      rebindTimeoutRef.current = null;
    }

    closingRef.current = true;
    setIsClosing(true);
    setActiveCallId(null);
    setSessionCallId(null);

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('AppNavigator');
  };

  // On mount: query the native layer for an already-established call.
  // This handles the race where onCallEstablished fires during navigation
  // (before this screen's event listener is registered), which is common on
  // fast LAN connections where the call connects in < 200 ms.
  useEffect(() => {
    if (!activeCallId) {
      Akuvox.getActiveCallId().then(id => {
        if (id !== -1) {
          setActiveCallId(id);
          setSessionCallId(id);
        }
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Read the real audio route on mount and restore it on unmount, so toggling
  // the speaker never leaks routing state into the next call or the dialer.
  useEffect(() => {
    let mounted = true;
    if (typeof Akuvox.isSpeakerOn === 'function') {
      Akuvox.isSpeakerOn()
        .then((on) => {
          if (!mounted) return;
          initialSpeakerRef.current = !!on;
          speakerRef.current = !!on;
          setIsSpeakerOn(!!on);
        })
        .catch(() => {});
    }

    return () => {
      mounted = false;
      if (mutedRef.current && typeof Akuvox.setMute === 'function') {
        Akuvox.setMute(false).catch(() => {});
      }
      if (initialSpeakerRef.current !== null && typeof Akuvox.setSpeakerOn === 'function') {
        Akuvox.setSpeakerOn(initialSpeakerRef.current).catch(() => {});
      }
    };
  }, []);

  // Call duration ticks only while a call is actually established.
  useEffect(() => {
    if (!activeCallId) {
      setCallSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    setCallSeconds(0);
    const timer = setInterval(() => {
      setCallSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeCallId]);

  // Pulse animation for dialing
  useEffect(() => {
    if (!activeCallId && isOutgoing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      );
      loop.start();
      return () => loop.stop();
    }

    pulseAnim.setValue(1);
    return undefined;
  }, [activeCallId, isOutgoing, pulseAnim]);

  useEffect(() => {
    // Listen for connection
    const outgoingCallCreatedSub = eventEmitter.addListener('onOutgoingCallCreated', (data) => {
      if (data?.callId) {
        // Clear old surfaces before new outgoing session starts.
        setActiveCallId(null);
        setVideoRenderNonce((prev) => prev + 1);
        setSessionCallId(data.callId);
      }
    });

    const callEstablishedSub = eventEmitter.addListener('onCallEstablished', (data) => {
      if (data?.callId) {
        setSessionCallId(data.callId);
        if (data.callId !== activeCallId) {
          setActiveCallId(data.callId); // Keep callId synced even if route params were stale
        }
        // Force native video surfaces to remount for each established session.
        setVideoRenderNonce((prev) => prev + 1);

        // One delayed rebind catches SDK surfaces that become available slightly later.
        if (rebindTimeoutRef.current) {
          clearTimeout(rebindTimeoutRef.current);
        }
        rebindTimeoutRef.current = setTimeout(() => {
          setVideoRenderNonce((prev) => prev + 1);
          rebindTimeoutRef.current = null;
        }, 500);
      }
    });

    // Listen for call finished event to auto-close the screen
    const callFinishedSub = eventEmitter.addListener('onCallFinished', (data) => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (rebindTimeoutRef.current) {
        clearTimeout(rebindTimeoutRef.current);
        rebindTimeoutRef.current = null;
      }

      if (cancelRequestedRef.current) {
        closeScreen();
        return;
      }

      const reason = String(data?.reason || '');
      const isUserInitiatedEnd = /cancel|hangup|terminated by local|local bye|user declined|declined by local/i.test(reason);
      const targets = Array.isArray(dialTargets) ? dialTargets : [];
      const nextIndex = currentDialIndex + 1;

      // For outgoing calls, aggressively fail over to next SIP target unless the user ended it.
      if (isOutgoing && !isUserInitiatedEnd && nextIndex < targets.length && !retryingRef.current) {
        const nextTarget = targets[nextIndex];
        if (nextTarget) {
          retryingRef.current = true;
          setCurrentDialIndex(nextIndex);
          setActiveCallId(null);
          setSessionCallId(null);
          setVideoRenderNonce((prev) => prev + 1);

          const nextMode = Number.isInteger(callVideoMode) ? callVideoMode : 1;
          console.log('[ActiveCall] retrying next SIP target', {
            reason,
            nextIndex,
            nextTarget,
            totalTargets: targets.length,
            mode: nextMode,
          });
          retryTimeoutRef.current = setTimeout(() => {
            Akuvox.makeCall(nextTarget, remoteName || 'Unknown Caller', nextMode);
            retryTimeoutRef.current = null;
            retryingRef.current = false;
          }, 350);
          return;
        }
      }

      if (data.callId === sessionCallId || data.callId === activeCallId || (isOutgoing && !sessionCallId)) {
        closeScreen();
      }
    });

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (rebindTimeoutRef.current) {
        clearTimeout(rebindTimeoutRef.current);
        rebindTimeoutRef.current = null;
      }
      outgoingCallCreatedSub.remove();
      callEstablishedSub.remove();
      callFinishedSub.remove();
    };
  }, [activeCallId, sessionCallId, callId, isOutgoing, dialTargets, currentDialIndex, remoteName, callVideoMode]);

  // Both toggles are guarded: each reaches into the SDK/AudioManager, and rapid
  // taps would otherwise queue overlapping native calls on the bridge.
  const handleToggleMute = useCallback(() => {
    if (typeof Akuvox.setMute !== 'function' || mutePendingRef.current) return;
    const next = !mutedRef.current;
    mutePendingRef.current = true;
    Akuvox.setMute(next)
      .then((ok) => {
        if (ok === false) return; // SDK refused — leave the UI on the real state
        mutedRef.current = next;
        setIsMuted(next);
      })
      .catch(() => {})
      .finally(() => { mutePendingRef.current = false; });
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    if (typeof Akuvox.setSpeakerOn !== 'function' || speakerPendingRef.current) return;
    const previous = speakerRef.current;
    const next = !previous;
    speakerPendingRef.current = true;
    speakerRef.current = next;
    setIsSpeakerOn(next);
    Akuvox.setSpeakerOn(next)
      .then((actual) => {
        // Trust the value read back from AudioManager over our optimistic guess.
        speakerRef.current = !!actual;
        setIsSpeakerOn(!!actual);
      })
      .catch(() => {
        speakerRef.current = previous;
        setIsSpeakerOn(previous);
      })
      .finally(() => { speakerPendingRef.current = false; });
  }, []);

  const handleHangup = async () => {
    if (cancelRequestedRef.current) {
      return;
    }

    cancelRequestedRef.current = true;
    retryingRef.current = false;

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    let targetCallId = sessionCallId || activeCallId || (typeof callId === 'number' ? callId : null);

    if (!targetCallId) {
      try {
        const nativeCallId = await Akuvox.getCurrentCallId();
        if (nativeCallId && nativeCallId !== -1) {
          targetCallId = nativeCallId;
          setSessionCallId(nativeCallId);
        }
      } catch (_) {}
    }

    if (targetCallId) {
      Akuvox.hangupCall(targetCallId);
    }

    closeScreen();
  };

  if (isClosing) {
    return null;
  }

  const statusLabel = activeCallId
    ? formatDuration(callSeconds)
    : isOutgoing
      ? 'Calling…'
      : 'Connecting…';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Remote stream fills the screen on video calls; audio calls get a branded backdrop. */}
      {showVideo ? (
        <VideoCallView
          key={`remote-${activeCallId}-${videoRenderNonce}`}
          type="remote"
          callId={activeCallId}
          style={styles.remoteVideo}
        />
      ) : (
        <LinearGradient
          colors={['#241b45', '#13172b', '#05060b']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.avatarStage}>
            <Animated.View style={[styles.avatarHalo, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.avatar}>
              {initials ? (
                <Text style={styles.avatarInitials}>{initials}</Text>
              ) : (
                <Ionicons name="person" size={54} color="#ffffff" />
              )}
            </View>
          </View>
        </LinearGradient>
      )}

      {/* Scrim keeps the caller name and controls legible over live video. */}
      {showVideo && (
        <>
          <LinearGradient
            colors={['rgba(0,0,0,0.75)', 'transparent']}
            style={[styles.topScrim, { height: insets.top + 140 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={[styles.bottomScrim, { height: insets.bottom + 220 }]}
            pointerEvents="none"
          />
        </>
      )}

      {/* Picture-in-Picture local preview */}
      {showVideo && (
        <View style={[styles.pipContainer, { top: insets.top + 68 }]}>
          <VideoCallView
            key={`local-${activeCallId}-${videoRenderNonce}`}
            type="local"
            callId={activeCallId}
            style={styles.localVideo}
          />
        </View>
      )}

      {/* Caller identity */}
      <View style={[styles.header, { top: insets.top + 16 }, showVideo ? styles.headerOverVideo : null]}>
        <Text style={styles.callerName} numberOfLines={1}>{remoteName || 'Unknown Caller'}</Text>
        <View style={styles.statusRow}>
          {activeCallId ? <View style={styles.liveDot} /> : null}
          <Text style={styles.statusText}>{statusLabel}</Text>
          {!isVideoCall && <Text style={styles.callTypeChip}>AUDIO</Text>}
        </View>
      </View>

      {/* Controls */}
      <View style={[styles.controlsContainer, { bottom: insets.bottom + 28 }]}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={handleToggleMute}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={25} color={isMuted ? '#13172b' : '#ffffff'} />
          <Text style={[styles.controlLabel, isMuted && styles.controlLabelActive]}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.hangupButton}
          onPress={handleHangup}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="End call"
        >
          <Ionicons name="call" size={30} color="#ffffff" style={styles.hangupIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={handleToggleSpeaker}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={isSpeakerOn ? 'Turn speaker off' : 'Turn speaker on'}
        >
          <Ionicons
            name={isSpeakerOn ? 'volume-high' : 'volume-medium'}
            size={25}
            color={isSpeakerOn ? '#13172b' : '#ffffff'}
          />
          <Text style={[styles.controlLabel, isSpeakerOn && styles.controlLabelActive]}>Speaker</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060b',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  avatarStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(111, 75, 216, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: 1,
  },
  avatarHalo: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(111, 75, 216, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(138, 104, 240, 0.35)',
  },
  pipContainer: {
    position: 'absolute',
    right: 16,
    width: 104,
    height: 150,
    borderRadius: 18,
    backgroundColor: '#11131f',
    overflow: 'hidden',
    borderColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
  },
  localVideo: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    left: 24,
    right: 140,
  },
  headerOverVideo: {
    right: 136,
  },
  callerName: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34d399',
    marginRight: 8,
  },
  statusText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  callTypeChip: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  controlsContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  controlLabel: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  controlLabelActive: {
    color: '#13172b',
  },
  hangupButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  hangupIcon: {
    transform: [{ rotate: '135deg' }],
  },
});
