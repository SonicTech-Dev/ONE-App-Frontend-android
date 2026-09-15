import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, NativeEventEmitter, NativeModules } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthNavigator from './app/navigation/AuthNavigator';
import { StoreProvider } from './app/context/StoreContext';
import { AuthProvider } from './app/context/AuthContext';
import IncomingCallModal from './app/components/CallUI/IncomingCallModal';
import { navigationRef } from './app/navigation/rootNavigation';

const { Akuvox } = NativeModules;
const eventEmitter = new NativeEventEmitter(Akuvox);

export default function App() {
  const [incomingCallState, setIncomingCallState] = useState(null);

  // Listen for incoming calls
  useEffect(() => {
    const subscription = eventEmitter.addListener('onIncomingCall', (data) => {
      console.log('📞 Incoming call intercepted:', data);
      setIncomingCallState(data);
    });

    const callFinishedSub = eventEmitter.addListener('onCallFinished', () => {
      setIncomingCallState(null); // Dismiss modal if caller hangs up early!
    });

    return () => {
      subscription.remove();
      callFinishedSub.remove();
    };
  }, []);

  // Recover an incoming call that arrived while the JS runtime wasn't running
  // (e.g. the app was cold-started by tapping the full-screen call notification).
  useEffect(() => {
    if (typeof Akuvox?.getPendingIncomingCall !== 'function') return;
    Akuvox.getPendingIncomingCall()
      .then((pending) => {
        if (pending && typeof pending.callId === 'number' && pending.callId > 0) {
          console.log('📞 Pending incoming call recovered:', pending);
          setIncomingCallState(pending);
        }
      })
      .catch(() => {});
  }, []);

  const handleReject = () => {
    if (incomingCallState) {
      // rejectCall handles incoming ringing calls: hungupCall is a no-op for
      // them in the Akuvox SDK, so the native layer stops the ringtone,
      // vibration and call notification explicitly.
      if (typeof Akuvox.rejectCall === 'function') {
        Akuvox.rejectCall(incomingCallState.callId);
      } else {
        Akuvox.hangupCall(incomingCallState.callId);
      }
      setIncomingCallState(null);
    }
  };

  const handleAccept = () => {
    if (incomingCallState) {
      const callVideoMode = typeof incomingCallState.callVideoMode === 'number'
        ? incomingCallState.callVideoMode
        : 1;

      if (typeof Akuvox.answerCallWithMode === 'function') {
        Akuvox.answerCallWithMode(incomingCallState.callId, callVideoMode);
      } else {
        Akuvox.answerCall(incomingCallState.callId);
      }
      navigationRef.navigate('ActiveCallScreen', {
        callId: incomingCallState.callId,
        remoteName: incomingCallState.remoteDisplayName || incomingCallState.remoteUserName,
        callVideoMode,
      });
      setIncomingCallState(null);
    }
  };

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <AuthProvider>
          <NavigationContainer ref={navigationRef}>
            <View style={{ flex: 1 }}>
              <AuthNavigator />
            </View>
          </NavigationContainer>
          <IncomingCallModal
            visible={!!incomingCallState}
            callerName={incomingCallState?.remoteDisplayName || incomingCallState?.remoteUserName}
            isVideo={incomingCallState?.callVideoMode !== 0}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        </AuthProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
