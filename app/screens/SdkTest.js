import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  PermissionsAndroid,
  Platform,
  NativeModules,
  NativeEventEmitter,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOCKUP_OPTIONS } from '../components/Smart/SmartScreenSections/SmartScreen.constants';
const { Akuvox } = NativeModules;

/**
 * Contacts now reflect SIP registration initiated in SmartScreen.
 * We read 'registeredTransport' from AsyncStorage to know whether LAN/WAN was chosen.
 * Buttons for init/register are removed — registration happens automatically in SmartScreen.
 */

const API_RESULT_MOCKUP_1 = {
  family_name: 'One-Dev Mockup-Flat',
  sip_group: '1191000500',
  devices: [
    { device_id: 'd4f54a92bea2a440c8a6a23d0b636dcf7', device_name: 'HyPanel Supreme', mac: '0C110500755C', sip_wan: '1192101703', sip_lan: '1000' },
    { device_id: 'd1b001e5ddcf24d65a9d1c6ad23df43ba', device_name: 'Hypanel Lux', mac: '0C11052BF1CF', sip_wan: '1192101705', sip_lan: '1003' },
    { device_id: 'd9a69e144b34c47ea822169672c0fd40d', device_name: 'Hypanel KeyPlus  1 on M1', mac: '0C110527CAAC', sip_wan: '1192102163', sip_lan: '1001' },
    { device_id: 'd7ed72241e59342d29daffc0911503029', device_name: 'Hypanel KeyPlus 2 in M1', mac: '0C110527CA8F', sip_wan: '1192102164', sip_lan: '1002' },
  ],
  accounts: [
    { account_id: 'a9b41de81c3284515a5e833d53412fe14', sip_wan: '1192101702', sip_lan: '1192101702', account_name: 'fayis@sonictech.ae', first_name: 'Laguna Mockup', last_name: 'One-Development', email: 'fayis@sonictech.ae', main_sip: '1192101504' },
    { account_id: 'a2a340656d43745fdafce231cc9d1b2d1', sip_wan: '1192102110', sip_lan: '1192102110', account_name: 'marwan@sonictech.ae', first_name: 'Marwan', last_name: 'Khater', email: 'marwan@sonictech.ae', main_sip: '1467100107' },
  ],
  akuvox_devices: [
    { mac: '0C11052C6E92', device_name: 'Intercom R29', sip_wan: '1192101722', sip_lan: '1004' },
  ],
};

const API_RESULT_MOCKUP_2 = {
  family_name: 'One-Dev Mockup-Flat',
  sip_group: '1191000500',
  devices: [
    { device_id: 'd03852d726b074d77a7d658e7fac7d3b6', device_name: 'HyPanel Supreme', mac: '0C110500755C', sip_wan: '1192102080', sip_lan: '1000' },
    { device_id: 'd394ddaa179d0469ebe4b7c710bfbe5e0', device_name: 'Hypanel Lux', mac: '0C11052BF1CF', sip_wan: '1192102082', sip_lan: '1037' },
    { device_id: 'd6909df0aa38444ba8e11ce1f55e3cb9d', device_name: 'Hypanel KeyPlus  Bedside', mac: '0C110527CAAC', sip_wan: '1192102081', sip_lan: '1035' },
    { device_id: 'd715ca4ce814c436ba3cb8a88702170c5', device_name: 'Hypanel KeyPlus Kitchen', mac: '0C110527CA8F', sip_wan: '1192102083', sip_lan: '1036' },
  ],
  accounts: [
    { account_id: 'a9b41de81c3284515a5e833d53412fe14', sip_wan: '1192101702', sip_lan: '1192101702', account_name: 'fayis@sonictech.ae', first_name: 'Laguna Mockup', last_name: 'One-Development', email: 'fayis@sonictech.ae', main_sip: '1192101504' },
    { account_id: 'a2a340656d43745fdafce231cc9d1b2d1', sip_wan: '1192102110', sip_lan: '1192102110', account_name: 'marwan@sonictech.ae', first_name: 'Marwan', last_name: 'Khater', email: 'marwan@sonictech.ae', main_sip: '1467100107' },
  ],
  akuvox_devices: [
    { mac: '0C11052C6E79', device_name: 'Intercom R29', sip_wan: '1192102367', sip_lan: '1038' },
  ],
};

const getContacts = (apiResult) => {
  const contacts = [];
  apiResult.devices.forEach(device => {
    contacts.push({
      id: device.device_id,
      name: device.device_name,
      sip_wan: device.sip_wan,
      sip_lan: device.sip_lan,
      sip_group: apiResult.sip_group,
      type: 'Device',
    });
  });
  apiResult.accounts.forEach(account => {
    contacts.push({
      id: account.account_id,
      name: `${account.first_name} ${account.last_name}`,
      sip_wan: account.sip_wan,
      sip_lan: account.sip_lan,
      main_sip: account.main_sip,
      sip_group: apiResult.sip_group,
      type: 'Account',
    });
  });
  apiResult.akuvox_devices.forEach((dev, idx) => {
    contacts.push({
      id: `akuvox_${idx}`,
      name: dev.device_name,
      sip_wan: dev.sip_wan,
      sip_lan: dev.sip_lan,
      sip_group: apiResult.sip_group,
      type: 'Akuvox Device',
    });
  });
  return contacts;
};

async function requestPermissionsIfNeeded() {
  if (Platform.OS === 'android') {
    const camera = PermissionsAndroid.PERMISSIONS.CAMERA;
    const audio = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    const granted = await PermissionsAndroid.requestMultiple([camera, audio]);
    return (
      granted[camera] === PermissionsAndroid.RESULTS.GRANTED &&
      granted[audio] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  return true;
}

export default function SdkContactScreen({ navigation, route }) {
  const [sipStatus, setSipStatus] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [registeredTransport, setRegisteredTransport] = useState(null); // 'wan' | 'lan' | null

  const selectedMockup = route?.params?.selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? MOCKUP_OPTIONS.MOCKUP_1
    : MOCKUP_OPTIONS.MOCKUP_2;
  const selectedOption = String(route?.params?.selectedOption || '').toUpperCase() === 'LAN' ? 'LAN' : 'WAN';
  const selectedTransport = selectedOption.toLowerCase();
  const apiResult = selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? API_RESULT_MOCKUP_1
    : API_RESULT_MOCKUP_2;
  const contacts = getContacts(apiResult);

  // ------- Keep sipStatus in sync with the native SIP line -------
  // Subscribe to onSipRegStatus events so we get live updates
  // (status 1=trying, 2=registered, 3=failed).
  useEffect(() => {
    const emitter = new NativeEventEmitter(Akuvox);
    const sub = emitter.addListener('onSipRegStatus', ({ status }) => {
      setSipStatus(status);
      if (status === 2) {
        // Registration confirmed — read the transport that SmartScreen's
        // onSipRegStatus(2) handler just wrote to AsyncStorage.
        AsyncStorage.getItem('registeredTransport').then(t => {
          if (t === 'lan' || t === 'wan') setRegisteredTransport(t);
        }).catch(() => {});
      } else {
        // status=1 (trying) or status=3 (failed): block calls immediately so the
        // user cannot dial while the SIP line is switching transports or in error.
        setRegisteredTransport(null);
      }
    });
    return () => sub.remove();
  }, []);
  // ---------------------------------------------------------------

  const loadTransport = async () => {
    try {
      const t = await AsyncStorage.getItem('registeredTransport');
      if (t === 'lan' || t === 'wan') {
        setRegisteredTransport(t);
      } else {
        setRegisteredTransport(null);
      }
    } catch (e) {
      console.warn('[Contacts] Failed to load registeredTransport:', e);
    }
  };

  const isTransportReady = () => {
    return sipStatus === 2 && registeredTransport === selectedTransport;
  };

  // Keep transport synced when this screen regains focus (after user switches LAN/WAN in SmartScreen).
  useFocusEffect(
    React.useCallback(() => {
      loadTransport();
      // Also refresh the current SIP line status on focus
      Akuvox.getSipStatus().then(setSipStatus).catch(() => {});
    }, [])
  );

  useEffect(() => {
    let mounted = true;
    let timer = null;

    const syncExpectedTransport = async () => {
      try {
        const storedTransport = await AsyncStorage.getItem('registeredTransport');
        const currentSipStatus = await Akuvox.getSipStatus();
        if (!mounted) return;

        setSipStatus(currentSipStatus);
        if (storedTransport === 'lan' || storedTransport === 'wan') {
          setRegisteredTransport(storedTransport);
        }
      } catch (_) {}
    };

    // Quick resync loop when entering SdkTest helps avoid calling during mode switches.
    syncExpectedTransport();
    timer = setInterval(syncExpectedTransport, 1500);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  // Optionally poll or fetch SIP status to show user feedback
  useEffect(() => {
    Akuvox.getSipStatus().then(setSipStatus).catch(() => {});
  }, []);

  const uniqueSipTargets = (items) => {
    const seen = new Set();
    const result = [];

    items.forEach((item) => {
      const value = typeof item === 'string' || typeof item === 'number' ? String(item).trim() : '';
      if (!value || seen.has(value)) {
        return;
      }
      seen.add(value);
      result.push(value);
    });

    return result;
  };

  // Build ordered SIP candidates for resilient dialing.
  const getSipCandidatesForContact = (contact) => {
    if (!contact) return [];

    const effectiveTransport = registeredTransport || selectedTransport;

    if (effectiveTransport === 'lan') {
      return uniqueSipTargets([
        contact.sip_lan,
        contact.sip_wan,
        contact.main_sip,
        contact.sip_group,
        contact.sip,
      ]);
    }

    if (effectiveTransport === 'wan') {
      // sip_wan first — devices have no main_sip so it must not be the leading candidate
      return uniqueSipTargets([
        contact.sip_wan,
        contact.sip_group,
        contact.main_sip,
        contact.sip_lan,
        contact.sip,
      ]);
    }

    return uniqueSipTargets([
      contact.main_sip,
      contact.sip_wan,
      contact.sip_lan,
      contact.sip_group,
      contact.sip,
    ]);
  };

  // Contact Call Actions
  const handleMakeAudioCall = async (contact) => {
    const effectiveTransport = registeredTransport || selectedTransport;
    if (!effectiveTransport) {
      Alert.alert('Not Registered', 'Please go to Smart page and choose LAN or WAN to register SIP.');
      return;
    }
    if (!isTransportReady()) {
      Alert.alert(
        'Transport Not Ready',
        `Expected ${selectedTransport.toUpperCase()} registration. Current: ${registeredTransport ? registeredTransport.toUpperCase() : 'none'}. Please wait a moment and try again.`
      );
      return;
    }
    if (sipStatus !== 2) {
      Alert.alert(
        'SIP Not Ready',
        `SIP line is ${sipStatus === 1 ? 'still registering' : sipStatus === 3 ? 'registration failed' : 'not ready'}. Please wait a moment and try again.`
      );
      return;
    }
    const permissionsGranted = await requestPermissionsIfNeeded();
    if (!permissionsGranted) {
      Alert.alert('Permission Denied', 'Camera and microphone permissions are required for calls.');
      return;
    }
    const sipCandidates = getSipCandidatesForContact(contact);
    const sipToCall = sipCandidates[0];
    if (!sipToCall) {
      Alert.alert('Missing SIP', `No valid SIP target found for ${contact?.name || 'contact'}.`);
      return;
    }

    console.log('[Contacts] Audio call target:', {
      transport: effectiveTransport,
      sipToCall,
      sipCandidates,
      contact: contact?.name,
    });
    Akuvox.makeCall(sipToCall, contact.name, 0); // 0 for audio call
    setModalVisible(false);
    
    // Immediately navigate to ActiveCallScreen in Outgoing mode
    navigation.navigate('ActiveCallScreen', {
      callId: 'dialing',
      remoteName: contact.name,
      isOutgoing: true,
      dialTargets: sipCandidates,
      dialTargetIndex: 0,
      callVideoMode: 0,
    });
  };

  const handleMakeVideoCall = async (contact) => {
    const effectiveTransport = registeredTransport || selectedTransport;
    if (!effectiveTransport) {
      Alert.alert('Not Registered', 'Please go to Smart page and choose LAN or WAN to register SIP.');
      return;
    }
    if (!isTransportReady()) {
      Alert.alert(
        'Transport Not Ready',
        `Expected ${selectedTransport.toUpperCase()} registration. Current: ${registeredTransport ? registeredTransport.toUpperCase() : 'none'}. Please wait a moment and try again.`
      );
      return;
    }
    if (sipStatus !== 2) {
      Alert.alert(
        'SIP Not Ready',
        `SIP line is ${sipStatus === 1 ? 'still registering' : sipStatus === 3 ? 'registration failed' : 'not ready'}. Please wait a moment and try again.`
      );
      return;
    }
    const permissionsGranted = await requestPermissionsIfNeeded();
    if (!permissionsGranted) {
      Alert.alert('Permission Denied', 'Camera and microphone permissions are required for calls.');
      return;
    }
    const sipCandidates = getSipCandidatesForContact(contact);
    const sipToCall = sipCandidates[0];
    if (!sipToCall) {
      Alert.alert('Missing SIP', `No valid SIP target found for ${contact?.name || 'contact'}.`);
      return;
    }

    console.log('[Contacts] Video call target:', {
      transport: effectiveTransport,
      sipToCall,
      sipCandidates,
      contact: contact?.name,
    });
    Akuvox.makeCall(sipToCall, contact.name, 1); // 1 for video call
    setModalVisible(false);

    // Immediately navigate to ActiveCallScreen in Outgoing mode
    navigation.navigate('ActiveCallScreen', {
      callId: 'dialing',
      remoteName: contact.name,
      isOutgoing: true,
      dialTargets: sipCandidates,
      dialTargetIndex: 0,
      callVideoMode: 1,
    });
  };

  // List Item Render
  const renderContactItem = ({ item }) => {
    const activeSip = registeredTransport ? (getSipCandidatesForContact(item)[0] || '(missing sip)') : '(not registered)';
    return (
      <TouchableOpacity
        style={styles.contactItem}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedContact(item);
          setModalVisible(true);
        }}
      >
        <View style={styles.contactAvatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactDetail}>
            {item.type}
            {registeredTransport === 'lan' && item.sip_lan
              ? `  •  LAN ${item.sip_lan}`
              : registeredTransport === 'wan' && item.sip_wan
              ? `  •  WAN ${item.sip_wan}`
              : item.sip_wan
              ? `  •  ${item.sip_wan}`
              : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Modal for Call Options
  const CallOptionsModal = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            Call {selectedContact?.name}
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.audioBtn]}
              onPress={() => handleMakeAudioCall(selectedContact)}
            >
              <Text style={styles.actionText}>Audio Call</Text>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
            <TouchableOpacity
              style={[styles.actionBtn, styles.videoBtn]}
              onPress={() => handleMakeVideoCall(selectedContact)}
            >
              <Text style={styles.actionText}>Video Call</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 12 }} />
          <TouchableOpacity
            style={[styles.actionBtn, styles.cancelBtn]}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with status pill (no init/register buttons) */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <View style={[
          styles.statusPill,
          sipStatus === 2 ? styles.statusPillReady
            : sipStatus === 1 ? styles.statusPillBusy
            : styles.statusPillIdle,
        ]}>
          <Text style={[
            styles.statusPillText,
            sipStatus === 2 ? styles.statusPillTextReady
              : sipStatus === 1 ? styles.statusPillTextBusy
              : styles.statusPillTextIdle,
          ]}>
            {sipStatus === 2
              ? `${registeredTransport ? registeredTransport.toUpperCase() : ''} Ready`
              : sipStatus === 1
              ? 'Registering…'
              : sipStatus === 3
              ? 'SIP Failed'
              : registeredTransport
              ? `${registeredTransport.toUpperCase()} (checking…)`
              : 'Not Registered'}
          </Text>
        </View>
      </View>
      <Text style={styles.transportHint}>
        Selected: {selectedTransport.toUpperCase()} | Active: {registeredTransport ? registeredTransport.toUpperCase() : 'None'}
      </Text>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContactItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 10, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      />
      {sipStatus !== null && (
        <Text style={styles.sipStatus}>SIP Status: {sipStatus}</Text>
      )}

      {modalVisible && selectedContact && <CallOptionsModal />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f0ff' },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7dcff',
    shadowColor: '#7f58e2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderBottomWidth: 1,
    borderColor: '#efe5ff',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3a2c63',
    letterSpacing: 0.2,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillReady: {
    backgroundColor: '#ede5ff',
    borderColor: '#dccbff',
  },
  statusPillBusy: {
    backgroundColor: '#fff8e1',
    borderColor: '#ffe082',
  },
  statusPillIdle: {
    backgroundColor: '#f5f2ff',
    borderColor: '#e7dcff',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPillTextReady: {
    color: '#5b38c2',
  },
  statusPillTextBusy: {
    color: '#b07800',
  },
  statusPillTextIdle: {
    color: '#826fb3',
  },
  contactItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9deff',
    shadowColor: '#7f58e2',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6f4bd8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2f2550',
    marginBottom: 3,
  },
  contactDetail: {
    fontSize: 13,
    color: '#7f72a3',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: 'transparent', 
  transportHint: {
    marginTop: 6,
    marginHorizontal: 16,
    color: '#6e67a5',
    fontSize: 12,
    fontWeight: '600',
  },
  },
  sipStatus: {
    marginTop: 10,
    marginBottom: 14,
    fontSize: 13,
    color: '#6f4bd8',
    textAlign: 'center',
    fontWeight: '700',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(83,53,176,0.26)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#e9dcff',
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 24,
    color: '#31265a',
    textAlign: 'center',
  },
  modalButtons: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
  },
  audioBtn: {
    backgroundColor: '#6f4bd8',
    borderColor: '#6f4bd8',
  },
  videoBtn: {
    backgroundColor: '#8a68f0',
    borderColor: '#8a68f0',
  },
  cancelBtn: {
    backgroundColor: '#f3edff',
    borderColor: '#dfd0ff',
  },
  actionText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelText: {
    color: '#6246bb',
    fontWeight: '700',
    fontSize: 16,
  },
  incomingModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-start',
    paddingTop: 60,
    alignItems: 'center',
  },
  incomingModalContainer: {
    backgroundColor: '#1c1c1e',
    borderRadius: 24,
    padding: 32,
    width: '90%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  incomingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  incomingFrom: {
    fontSize: 16,
    color: '#a1a1aa',
    marginBottom: 24,
  },
  incomingBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#34c759',
    paddingVertical: 16,
    borderRadius: 16,
    marginRight: 8,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#ff3b30',
    paddingVertical: 16,
    borderRadius: 16,
    marginLeft: 8,
    alignItems: 'center',
  },
  rejectBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  videoCallOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  localVideo: {
    position: 'absolute',
    width: 120,
    height: 160,
    right: 20,
    top: 60,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 101,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  endCallButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: '#ff3b30',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 102,
  },
  endCallText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});