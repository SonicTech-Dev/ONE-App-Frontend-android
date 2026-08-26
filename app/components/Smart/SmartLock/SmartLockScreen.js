import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Screen from '../../Screen';
import { useAuth } from '../../../context/AuthContext';

function normalizeMode(mode, fallbackMode) {
  const modeFromRoute = String(mode || '').toUpperCase();
  if (modeFromRoute === 'LAN' || modeFromRoute === 'WAN') return modeFromRoute;

  const authMode = String(fallbackMode || 'WAN').toUpperCase();
  return authMode === 'LAN' ? 'LAN' : 'WAN';
}

export default function SmartLockScreen({ route, navigation }) {
  const { networkMode } = useAuth();
  const selectedOption = normalizeMode(route?.params?.selectedOption, networkMode);
  const selectedMockup = route?.params?.selectedMockup || 'mockup2';

  const navigateWithinSmartStack = (screenName, params) => {
    const state = navigation?.getState?.();
    const routeNames = Array.isArray(state?.routeNames) ? state.routeNames : [];

    if (routeNames.includes(screenName)) {
      navigation.navigate(screenName, params);
      return;
    }

    // Fallback for cases where this screen is reached through a parent navigator context.
    navigation.getParent?.()?.navigate('LifestyleBasket', {
      screen: screenName,
      params,
    });
  };

  const goToSL50 = () => {
    navigateWithinSmartStack('SL50LockScreen', {
      selectedOption,
      selectedMockup,
      wanRtspUrl: route?.params?.wanRtspUrl,
      wanCiphertext: route?.params?.wanCiphertext,
    });
  };

  const goToF2 = () => {
    navigateWithinSmartStack('F2Lock', {
      selectedOption,
      selectedMockup,
      lockTitle: 'F2 SmartLock',
    });
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Smart Lock</Text>
          <Text style={styles.subtitle}>Select which lock you want to control.</Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeText}>Current Mode: {selectedOption}</Text>
          </View>
        </View>

        <View style={styles.lockActionsWrap}>
          <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={goToSL50}>
            <Text style={styles.cardTitle}>SL50 SmartLock</Text>
            <Text style={styles.cardDescription}>
              Open SL50 lock controls and monitoring.
            </Text>
            <Text style={styles.cardAction}>Open SL50</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={goToF2}>
            <Text style={styles.cardTitle}>F2 SmartLock</Text>
            <Text style={styles.cardDescription}>
              Open F2 lock page.
            </Text>
            <Text style={styles.cardAction}>Open F2</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f4f0ff',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 30,
    justifyContent: 'center',
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e7dcff',
    shadowColor: '#6b57bf',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2d2f4f',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 12,
    textAlign: 'center',
  },
  modeBadge: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#efe6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeText: {
    color: '#5d41b0',
    fontSize: 12,
    fontWeight: '700',
  },
  lockActionsWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    width: '92%',
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#e7dcff',
    shadowColor: '#7f58e2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
    alignSelf: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#25344d',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6c7a90',
    marginBottom: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  cardAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5a3aa9',
    textAlign: 'center',
  },
});
