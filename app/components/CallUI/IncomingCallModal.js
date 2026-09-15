import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

const getInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const IncomingCallModal = ({ visible, callerName, isVideo = true, onAccept, onReject }) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Kept mounted through the dismiss animation so the exit transition is visible.
  const [isMounted, setIsMounted] = useState(visible);
  const slideAnim = useRef(new Animated.Value(-height)).current;
  const haloAnim = useRef(new Animated.Value(0)).current;
  const acceptAnim = useRef(new Animated.Value(1)).current;
  const initials = getInitials(callerName);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      slideAnim.setValue(-height);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 52,
        useNativeDriver: true,
      }).start();

      haloAnim.setValue(0);
      const halo = Animated.loop(
        Animated.timing(haloAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );

      const nudge = Animated.loop(
        Animated.sequence([
          Animated.timing(acceptAnim, {
            toValue: 1.09,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(acceptAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      halo.start();
      nudge.start();

      return () => {
        halo.stop();
        nudge.stop();
      };
    }

    Animated.timing(slideAnim, {
      toValue: -height,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsMounted(false);
    });
    return undefined;
  }, [visible, height, slideAnim, haloAnim, acceptAnim]);

  if (!isMounted) return null;

  const haloScale = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] });
  const haloOpacity = haloAnim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0.5, 0.2, 0] });

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateY: slideAnim }] }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#2b2054', '#161a30', '#05060b']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 68, paddingBottom: insets.bottom + 56 }]}>
        <View style={styles.identity}>
          <View style={styles.badge}>
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={13} color="#c9b8ff" />
            <Text style={styles.badgeText}>{isVideo ? 'Incoming video call' : 'Incoming call'}</Text>
          </View>

          <View style={styles.avatarStage}>
            <Animated.View
              style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
              pointerEvents="none"
            />
            <View style={styles.avatar}>
              {initials ? (
                <Text style={styles.avatarInitials}>{initials}</Text>
              ) : (
                <Ionicons name="person" size={58} color="#ffffff" />
              )}
            </View>
          </View>

          <Text style={styles.callerName} numberOfLines={2}>{callerName || 'Unknown Caller'}</Text>
          <Text style={styles.subtitle}>ONE Development</Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.action}>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={onReject}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Decline call"
            >
              <Ionicons name="call" size={30} color="#ffffff" style={styles.declineIcon} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          <View style={styles.action}>
            <Animated.View style={{ transform: [{ scale: acceptAnim }] }}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={onAccept}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Accept call"
              >
                <Ionicons name={isVideo ? 'videocam' : 'call'} size={30} color="#ffffff" />
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  identity: {
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,184,255,0.25)',
  },
  badgeText: {
    marginLeft: 7,
    color: '#c9b8ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  avatarStage: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 46,
    marginBottom: 30,
  },
  halo: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: 'rgba(138,104,240,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(201,184,255,0.4)',
  },
  avatar: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: 'rgba(111,75,216,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 46,
    fontWeight: '700',
    letterSpacing: 1,
  },
  callerName: {
    fontSize: 30,
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 9,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2.4,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
  },
  action: {
    alignItems: 'center',
  },
  actionButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },
  declineButton: {
    backgroundColor: '#ff3b30',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  acceptButton: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  actionLabel: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

export default IncomingCallModal;
