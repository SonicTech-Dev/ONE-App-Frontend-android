import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text, Alert, StatusBar, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video } from 'react-native-video';
import { Picker } from '@react-native-picker/picker';
import AppButton from '../components/AppButton';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialFilledTextField from '../components/MaterialUI/MaterialFilledTextField';
import UploadScreen from "./UploadScreen";
import { useAuth, BACKEND_URL } from '../context/AuthContext';

const RESIDENCE_IDS = {
  mockup1: 'r45844047053e43d78fe5272c5badbd3a',
  mockup2: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
};

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [signInTransport, setSignInTransport] = useState('WAN');
  
  // Use Global Auth Context
  const { loginLan, loginWan, verifyOnlineAccount } = useAuth();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedResidence, setSelectedResidence] = useState('mockup2');
  
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const isLanSignIn = isLoginMode && signInTransport === 'LAN';
  const isWanSignIn = isLoginMode && signInTransport === 'WAN';
  const bannerTitle = isLoginMode ? `${signInTransport} mode` : 'Register';
  const bannerText = isLoginMode
    ? (isLanSignIn
        ? 'Ensure you are connected to home Wi-Fi.'
        : 'Ensure you have stable internet connection.')
    : 'Ensure you have stable internet connection to create your account.';
  const primaryButtonTitle = isLoginMode
    ? (isLanSignIn ? 'Login Offline' : 'Sign In')
    : 'Create Account';

  const attemptLogin = async () => {
    try {
      const authResult = signInTransport === 'LAN'
        ? await loginLan(email, password)
        : await loginWan(email, password);
      
      if (authResult.success) {
        navigation.replace('AppNavigator');
      }
    } catch (error) {
      console.warn("Login Failed:", error.message);
      Alert.alert("Login Failed", error.message || "Invalid credentials or network offline.");
    } finally {
      setLoading(false);
    }
  };

  const attemptRegistration = async () => {
    const url = `${BACKEND_URL}/api/register/`;
    const payload = { 
      email, 
      password, 
      first_name: firstName, 
      last_name: lastName,
      auth: 'user',
      residence_id: RESIDENCE_IDS[selectedResidence]
    };
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let data = {};
      try {
        data = await response.json();
      } catch (_) {
        data = {};
      }

      const registrationLooksComplete = (
        data?.family_linked === true ||
        data?.cloud_created === true ||
        data?.akubela_registered === true ||
        data?.provisioned === true ||
        data?.completed === true
      );

      if (!response.ok) {
        Alert.alert("Registration Failed", data.error || "Unable to complete registration right now.");
        return;
      }

      // The cloud account can take a moment to finish provisioning right after
      // the backend creates it, so retry a few times before declaring failure.
      let verifyError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await verifyOnlineAccount(email, password);
          verifyError = null;
          break;
        } catch (err) {
          verifyError = err;
          if (err?.code === 'INVALID_CREDENTIALS') break; // won't succeed on retry
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
      if (verifyError) {
        Alert.alert(
          "Registration Incomplete",
          verifyError?.code === 'INVALID_CREDENTIALS'
            ? "Your account was saved, but the password could not be verified. Please contact support."
            : "Your account was saved, but setup is not fully completed yet. Please contact support or try again later."
        );
        return;
      }

      if (
        Object.keys(data || {}).length > 0 &&
        ['family_linked', 'cloud_created', 'akubela_registered', 'provisioned', 'completed'].some(key => key in (data || {})) &&
        !registrationLooksComplete
      ) {
        Alert.alert(
          "Registration Incomplete",
          "Your account was created, but setup is not fully completed yet. Please contact support or try again later."
        );
        return;
      }

      // Success!
      Alert.alert("Success", "Account created successfully! You can now sign in.");
      setIsLoginMode(true);
      setPassword('');

    } catch (error) {
      Alert.alert("Network Error", "Registration requires a stable internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthAction = async () => {
    setLoading(true);
    if (isLoginMode) {
      await attemptLogin();
    } else {
      await attemptRegistration();
    }
  };

  const showSignInTab = () => setIsLoginMode(true);
  const showRegisterTab = () => {
    setIsLoginMode(false);
    setSignInTransport('WAN');
  };

  const enterLanMode = () => {
    setIsLoginMode(true);
    setSignInTransport('LAN');
  };

  const enterWanMode = () => {
    setIsLoginMode(true);
    setSignInTransport('WAN');
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle='light-content'/>
      <UploadScreen visible={loading} />
      
      <Video
        source={require('../assets/videos/video_9ccdee13fd.mp4')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        isLooping
        shouldPlay
        isMuted
        repeat
      />

      <View style={styles.overlay}>
        <View style={styles.container}>
          <Image 
            source={require('../assets/one_logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <KeyboardAvoidingView
          style={styles.formContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -100}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 25 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, isLoginMode ? styles.activeTab : null]} 
              onPress={showSignInTab}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isLoginMode ? styles.activeTabText : null]}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabButton, !isLoginMode ? styles.activeTab : null]} 
              onPress={showRegisterTab}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, !isLoginMode ? styles.activeTabText : null]}>Register</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputCard}>
            <View style={[styles.modeBanner, isLanSignIn ? styles.modeBannerLan : styles.modeBannerWan]}>
              <Text style={styles.modeBannerLabel}>{bannerTitle}</Text>
              <Text style={styles.modeBannerText}>{bannerText}</Text>
            </View>
            
            {!isLoginMode && (
              <>
                <MaterialFilledTextField
                  label={"First Name"}
                  value={firstName}
                  onChangeText={setFirstName}
                  backgroundColor={'#f5f5f5'}
                  autoCorrect={false}
                  marginTop={10}
                />
                <MaterialFilledTextField
                  label={"Last Name"}
                  value={lastName}
                  onChangeText={setLastName}
                  backgroundColor={'#f5f5f5'}
                  autoCorrect={false}
                  marginTop={10}
                />
                <View style={styles.residencePickerContainer}>
                  <Text style={styles.residencePickerLabel}>Residence</Text>
                  <Picker
                    selectedValue={selectedResidence}
                    onValueChange={setSelectedResidence}
                    style={styles.residencePicker}
                    mode="dropdown"
                    dropdownIconColor="#666"
                  >
                    <Picker.Item label="Mockup 1" value="mockup1" />
                    <Picker.Item label="Mockup 2" value="mockup2" />
                  </Picker>
                </View>
              </>
            )}

            <MaterialFilledTextField
              label={"Email"}
              value={email}
              onChangeText={setEmail}
              backgroundColor={'#f5f5f5'}
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType="email-address"
              marginTop={10}
            />

            <MaterialFilledTextField
              label={"Password"}
              value={password}
              onChangeText={setPassword}
              marginTop={10}
              backgroundColor={'#f5f5f5'}
              IconComponent={
                <MaterialCommunityIcons
                  name={visible ? "eye-off" : "eye"}
                  size={20}
                  color={'gray'}
                  style={styles.icon}
                  onPress={() => setVisible(!visible)}
                />
              }
              autoCorrect={false}
              autoCapitalize="none"
              secureTextEntry={!visible}
            />

            <AppButton
              title={primaryButtonTitle}
              text="background"
              disabled={
                !isValidEmail(email) || 
                password.length < 6 || 
                (!isLoginMode && (!firstName || !lastName || !selectedResidence)) || 
                loading
              }
              opacity={loading ? 0.5 : 1}
              onPress={handleAuthAction}
              loading={loading}
              marginTop={25}
            />

            {isWanSignIn && (
              <TouchableOpacity style={styles.helperLink} onPress={enterLanMode} activeOpacity={0.8}>
                <Text style={styles.helperLinkText}>Offline? Click here to log in without internet connection.</Text>
              </TouchableOpacity>
            )}

            {isLanSignIn && (
              <TouchableOpacity style={styles.helperLink} onPress={enterWanMode} activeOpacity={0.8}>
                <Text style={styles.helperLinkText}>Back to online sign in.</Text>
              </TouchableOpacity>
            )}

          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 70,
  },
  logo: {
    width: '70%',
    height: 180,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)', 
  },
  formContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    justifyContent: 'center',
  },
  inputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  icon: {
    padding: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 26,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontSize: 16,
  },
  activeTabText: {
    color: '#000',
    fontWeight: 'bold',
  },
  modeBanner: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  modeBannerWan: {
    backgroundColor: '#eef4ff',
  },
  modeBannerLan: {
    backgroundColor: '#edf8ef',
  },
  residencePickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginTop: 10,
    paddingLeft: 12,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  residencePickerLabel: {
    color: '#666',
    fontSize: 12,
    paddingTop: 8,
  },
  residencePicker: {
    height: 54,
    color: '#000',
  },
  modeBannerLabel: {
    color: '#1c1c1c',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  modeBannerText: {
    color: '#4d4d4d',
    fontSize: 13,
    lineHeight: 18,
  },
  helperLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  helperLinkText: {
    color: '#0d6b6f',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
});
