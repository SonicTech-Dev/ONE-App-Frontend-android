import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions, NativeModules, NativeEventEmitter, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import VideoCallView from '../components/Native/VideoCallView';

const { width, height } = Dimensions.get('window');
const { Akuvox } = NativeModules;
const eventEmitter = new NativeEventEmitter(Akuvox);

export default function ActiveCallScreen({ route, navigation }) {
  const { callId, remoteName, isOutgoing, dialTargets, dialTargetIndex, callVideoMode } = route.params || {};
  const initialCallId = callId === 'dialing' ? null : Number(callId);
  const [activeCallId, setActiveCallId] = useState(Number.isFinite(initialCallId) ? initialCallId : null);
  const [sessionCallId, setSessionCallId] = useState(Number.isFinite(initialCallId) ? initialCallId : null);
  const [isClosing, setIsClosing] = useState(false);
  const [currentDialIndex, setCurrentDialIndex] = useState(
    Number.isInteger(dialTargetIndex) && dialTargetIndex >= 0 ? dialTargetIndex : 0
  );
  const [videoRenderNonce, setVideoRenderNonce] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const closingRef = useRef(false);
  const retryingRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const retryTimeoutRef = useRef(null);
  const rebindTimeoutRef = useRef(null);

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

  // Pulse animation for dialing
  useEffect(() => {
    if (!activeCallId && isOutgoing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    }
  }, [activeCallId, isOutgoing]);

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
      const isTemporaryFailure = /temporarily unavailable|not found|busy here|request timeout|decline|declined|not acceptable|forbidden|server internal error|service unavailable/i.test(reason);
      const targets = Array.isArray(dialTargets) ? dialTargets : [];
      const nextIndex = currentDialIndex + 1;

      if (isOutgoing && isTemporaryFailure && nextIndex < targets.length && !retryingRef.current) {
        const nextTarget = targets[nextIndex];
        if (nextTarget) {
          retryingRef.current = true;
          setCurrentDialIndex(nextIndex);
          setActiveCallId(null);
          setSessionCallId(null);

          const nextMode = Number.isInteger(callVideoMode) ? callVideoMode : 1;
          retryTimeoutRef.current = setTimeout(() => {
            Akuvox.makeCall(nextTarget, remoteName || 'Unknown Caller', nextMode);
            retryTimeoutRef.current = null;
            retryingRef.current = false;
          }, 250);
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

  return (
    <View style={styles.container}>
      {/* Remote Video Stream Fullscreen */}
      {activeCallId ? (
        <VideoCallView
          key={`remote-${activeCallId}-${videoRenderNonce}`}
          type="remote"
          callId={activeCallId}
          style={styles.remoteVideo}
        />
      ) : (
        <View style={styles.dialingContainer}>
          <Animated.View style={[styles.avatarGlow, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.avatar}>
            <Ionicons name="person" size={50} color="#fff" />
          </View>
          <Text style={styles.dialingText}>Dialing...</Text>
        </View>
      )}

      {/* Picture-in-Picture Local Video */}
      {activeCallId && (
        <View style={styles.pipContainer}>
          <VideoCallView
            key={`local-${activeCallId}-${videoRenderNonce}`}
            type="local"
            callId={activeCallId}
            style={styles.localVideo}
          />
        </View>
      )}

      {/* Top Caller Info */}
      <View style={styles.header}>
        <Text style={styles.callerName}>{remoteName || 'Unknown Caller'}</Text>
        <Text style={styles.durationText}>{activeCallId ? '00:00' : 'Calling'}</Text>
      </View>

      {/* Floating Control Bar */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="mic-off" size={28} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlButton, styles.hangupButton]} onPress={handleHangup}>
          <Ionicons name="call" size={32} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="volume-high" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  pipContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#222',
    overflow: 'hidden',
    borderColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
  },
  localVideo: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 140, // avoid pip
  },
  callerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  durationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 16,
    borderRadius: 40,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hangupButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ff3b30',
  },
  dialingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#32d2d6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  avatarGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(50, 210, 214, 0.4)',
    zIndex: 1,
  },
  dialingText: {
    marginTop: 30,
    fontSize: 22,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    letterSpacing: 2,
  }
});
