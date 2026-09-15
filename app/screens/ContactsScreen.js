import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  MOCKUP_OPTIONS,
  SMARTSCREEN_RESIDENCE_IDS,
} from '../components/Smart/SmartScreenSections/SmartScreen.constants';
import { useAuth } from '../context/AuthContext';
import { useBottomSpacing } from '../navigation/tabBarLayout';
const { Akuvox } = NativeModules;

/**
 * Contacts are loaded dynamically via get_contact_list (LAN hub or WAN cloud).
 * 'registeredTransport' in AsyncStorage tells us whether LAN/WAN was chosen;
 * SIP registration itself happens automatically in SmartScreen.
 */

// ------- Dynamic contact list via get_contact_list (LAN hub / WAN cloud) -------
const CONTACT_REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
const LAN_CONTACT_LIST_URL = 'http://192.168.2.115/api/v1.0/contact';
const WAN_CONTACT_LIST_URL = 'https://one-development.soniciot.com/contact_list/';

// WAN response shape:
//   result: { family_name, sip_group, devices[], accounts[], akuvox_devices[], ciphertext }
const mapWanContactList = (result) => {
  if (!result || typeof result !== 'object') return [];
  const sipGroup = result.sip_group;
  const contacts = [];

  (result.devices || []).forEach((device) => {
    const name = device.device_name || 'Device';
    contacts.push({
      id: device.device_id,
      name,
      sip_wan: device.sip,
      sip_group: sipGroup,
      type: isHyPanelName(name) ? 'HyPanel' : 'Device',
    });
  });

  (result.accounts || []).forEach((account) => {
    const fullName = `${account.first_name || ''} ${account.last_name || ''}`.trim();
    contacts.push({
      id: account.account_id,
      name: fullName || account.account_name || account.email || 'Account',
      sip_wan: account.sip,
      main_sip: account.main_sip,
      email: account.email,
      sip_group: sipGroup,
      type: 'Account',
    });
  });

  (result.akuvox_devices || []).forEach((dev, idx) => {
    contacts.push({
      id: dev.mac || `akuvox_${idx}`,
      name: dev.device_name || 'Intercom',
      sip_wan: dev.sip,
      sip_group: sipGroup,
      type: 'Akuvox Device',
    });
  });

  return contacts;
};

// LAN response shape:
//   result: [{ id, name, sip, sip_local, ip, type, status, first_name, last_name }]
// `sip` is the global (cloud) number, `sip_local` is the LAN extension.
const mapLanContactList = (list) => {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim();
    const name = item.name || fullName || 'Unknown';
    const isApp = item.type === 'APP';
    return {
      id: item.id,
      name,
      sip_wan: item.sip,
      sip_lan: item.sip_local,
      ip: item.ip,
      online: item.status === 1,
      type: isApp ? 'Account' : item.type === 'SL50' ? 'Smart Lock' : isHyPanelName(name) ? 'HyPanel' : 'Device',
    };
  });
};

// HyPanel displays are detected by name (HyPanel Supreme, Hypanel Lux, Hypanel KeyPlus…).
function isHyPanelName(name) {
  return /hypanel/i.test(String(name || ''));
}

// Per-type avatar icon + colours for the list rows.
const CONTACT_TYPE_META = {
  HyPanel: { icon: 'tablet-dashboard', color: '#0891b2', bg: '#e0f5fa' },
  Device: { icon: 'monitor-smartphone', color: '#6f4bd8', bg: '#efe9ff' },
  Account: { icon: 'account', color: '#0e9f6e', bg: '#e3f6ee' },
  'Akuvox Device': { icon: 'doorbell-video', color: '#d97706', bg: '#fef3e2' },
  'Smart Lock': { icon: 'lock-smart', color: '#2563eb', bg: '#e6effe' },
};
const DEFAULT_TYPE_META = { icon: 'phone-outline', color: '#6f4bd8', bg: '#efe9ff' };

const formatMockupLabel = (mockup) => {
  if (mockup === MOCKUP_OPTIONS.MOCKUP_1) return 'Mockup 1';
  if (mockup === MOCKUP_OPTIONS.MOCKUP_2) return 'Mockup 2';
  return 'None';
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

export default function ContactsScreen({ navigation, route }) {
  const { getActiveLanToken, getActiveWanToken } = useAuth();
  const bottomSpacing = useBottomSpacing();
  const [sipStatus, setSipStatus] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [registeredTransport, setRegisteredTransport] = useState(null); // 'wan' | 'lan' | null
  const [registeredMockup, setRegisteredMockup] = useState(null);

  const selectedMockup = route?.params?.selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? MOCKUP_OPTIONS.MOCKUP_1
    : MOCKUP_OPTIONS.MOCKUP_2;
  const selectedOption = String(route?.params?.selectedOption || '').toUpperCase() === 'LAN' ? 'LAN' : 'WAN';
  const selectedTransport = selectedOption.toLowerCase();

  // ------- Dynamic contact list (get_contact_list for the active transport) -------
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState(null);
  const [contactsRefreshing, setContactsRefreshing] = useState(false);

  const fetchContacts = React.useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) {
      setContactsRefreshing(true);
    } else {
      setContactsLoading(true);
    }
    setContactsError(null);
    try {
      if (selectedTransport === 'lan') {
        const lanToken = await getActiveLanToken();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        let res;
        try {
          res = await fetch(LAN_CONTACT_LIST_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${lanToken}`,
            },
            body: JSON.stringify({ command: 'get_contact_list', id: CONTACT_REQUEST_ID, param: {} }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        if (!res.ok) throw new Error(`LAN contact list failed (HTTP ${res.status})`);
        const data = await res.json();
        setContacts(mapLanContactList(data?.result));
      } else {
        const wanToken = await getActiveWanToken();
        // Prefer the residence SmartScreen last registered with (handles custom
        // family selections); fall back to the mockup-mapped residence.
        let residenceId = await AsyncStorage.getItem('registeredResidenceId').catch(() => null);
        if (!residenceId) {
          residenceId = selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
            ? SMARTSCREEN_RESIDENCE_IDS.MOCKUP_1
            : SMARTSCREEN_RESIDENCE_IDS.MOCKUP_2;
        }
        const res = await fetch(WAN_CONTACT_LIST_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${wanToken}`,
          },
          body: JSON.stringify({
            command: 'get_contact_list',
            id: CONTACT_REQUEST_ID,
            param: { residence_id: residenceId, show_ability: true },
          }),
        });
        if (!res.ok) throw new Error(`WAN contact list failed (HTTP ${res.status})`);
        const data = await res.json();
        setContacts(mapWanContactList(data?.result));
      }
    } catch (e) {
      const message = e?.name === 'AbortError'
        ? 'Contact list request timed out — the hub may be unreachable.'
        : (e?.message || 'Failed to load contacts.');
      console.warn('[Contacts] fetchContacts error:', message);
      setContacts([]);
      setContactsError(message);
    } finally {
      setContactsLoading(false);
      setContactsRefreshing(false);
    }
  }, [selectedTransport, selectedMockup, getActiveLanToken, getActiveWanToken]);

  // Load contacts on mount, whenever the screen regains focus, and whenever the
  // transport/mockup selection changes.
  useFocusEffect(
    React.useCallback(() => {
      fetchContacts();
    }, [fetchContacts])
  );

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
        AsyncStorage.getItem('registeredMockup').then(m => {
          if (m === MOCKUP_OPTIONS.MOCKUP_1 || m === MOCKUP_OPTIONS.MOCKUP_2) setRegisteredMockup(m);
        }).catch(() => {});
      } else {
        // status=1 (trying) or status=3 (failed): block calls immediately so the
        // user cannot dial while the SIP line is switching transports or in error.
        setRegisteredTransport(null);
        setRegisteredMockup(null);
      }
    });
    return () => sub.remove();
  }, []);
  // ---------------------------------------------------------------

  const isTransportReady = () => {
    const transportReady = sipStatus === 2 && registeredTransport === selectedTransport;
    if (!transportReady) return false;
    if (selectedTransport !== 'wan') return true;
    return registeredMockup === selectedMockup;
  };

  // Keep transport + SIP status synced while this screen is focused, so a LAN/WAN
  // switch made in SmartScreen can't leave a stale "ready" state behind.
  //
  // The re-sync is guarded by an in-flight flag: getSipStatus() reaches into the
  // Akuvox SDK, which can block while a call is being torn down. Without the
  // guard, ticks queued up on the single native-modules thread and saturated the
  // bridge — which froze this screen after a few calls. The onSipRegStatus
  // listener above is the primary signal; this slower poll is just a safety net.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      let inFlight = false;

      const syncExpectedTransport = async () => {
        if (inFlight || cancelled) return;
        inFlight = true;
        try {
          const [storedTransport, storedMockup] = await Promise.all([
            AsyncStorage.getItem('registeredTransport'),
            AsyncStorage.getItem('registeredMockup'),
          ]);
          const currentSipStatus = await Akuvox.getSipStatus();
          if (cancelled) return;

          setSipStatus(currentSipStatus);
          setRegisteredTransport(
            storedTransport === 'lan' || storedTransport === 'wan' ? storedTransport : null
          );
          setRegisteredMockup(
            storedMockup === MOCKUP_OPTIONS.MOCKUP_1 || storedMockup === MOCKUP_OPTIONS.MOCKUP_2
              ? storedMockup
              : null
          );
        } catch (_) {
        } finally {
          inFlight = false;
        }
      };

      syncExpectedTransport();
      const timer = setInterval(syncExpectedTransport, 4000);

      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, [])
  );

  const selectedMockupLabel = formatMockupLabel(selectedMockup);
  const activeTransportLabel = registeredTransport ? registeredTransport.toUpperCase() : 'None';
  const activeMockupLabel = registeredMockup ? formatMockupLabel(registeredMockup) : 'None';
  const transportReady = isTransportReady();

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

  // Contact Call Actions — callVideoMode: 0 = audio, 1 = video.
  const placeCall = async (contact, callVideoMode) => {
    const effectiveTransport = registeredTransport || selectedTransport;
    if (!effectiveTransport) {
      Alert.alert('Not Registered', 'Please go to Smart page and choose LAN or WAN to register SIP.');
      return;
    }
    if (!isTransportReady()) {
      Alert.alert(
        'Transport Not Ready',
        `Expected ${selectedTransport.toUpperCase()} on ${selectedMockup}. Current: ${registeredTransport ? registeredTransport.toUpperCase() : 'none'} on ${registeredMockup || 'none'}. Please wait for SmartScreen registration and try again.`
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

    console.log('[Contacts] Call target:', {
      mode: callVideoMode === 0 ? 'audio' : 'video',
      transport: effectiveTransport,
      sipToCall,
      sipCandidates,
      contact: contact?.name,
    });
    Akuvox.makeCall(sipToCall, contact.name, callVideoMode);
    setModalVisible(false);

    // Immediately navigate to ActiveCallScreen in Outgoing mode
    navigation.navigate('ActiveCallScreen', {
      callId: 'dialing',
      remoteName: contact.name,
      isOutgoing: true,
      dialTargets: sipCandidates,
      dialTargetIndex: 0,
      callVideoMode,
    });
  };

  const handleMakeAudioCall = (contact) => placeCall(contact, 0);
  const handleMakeVideoCall = (contact) => placeCall(contact, 1);

  // List Item Render
  const renderContactItem = ({ item }) => {
    const meta = CONTACT_TYPE_META[item.type] || DEFAULT_TYPE_META;
    const activeSip = registeredTransport ? (getSipCandidatesForContact(item)[0] || null) : null;
    return (
      <TouchableOpacity
        style={styles.contactItem}
        activeOpacity={0.75}
        onPress={() => {
          setSelectedContact(item);
          setModalVisible(true);
        }}
      >
        <View style={[styles.contactAvatar, { backgroundColor: meta.bg }]}>
          <MaterialCommunityIcons name={meta.icon} size={24} color={meta.color} />
          {item.online !== undefined && (
            <View style={[styles.onlineDot, item.online ? styles.onlineDotOn : styles.onlineDotOff]} />
          )}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.contactDetail} numberOfLines={1}>
            {item.type}
            {activeSip ? `  •  ${registeredTransport.toUpperCase()} ${activeSip}` : ''}
          </Text>
        </View>
        <View style={styles.contactActions}>
          <TouchableOpacity
            style={[styles.quickCallBtn, styles.quickCallAudio]}
            onPress={() => handleMakeAudioCall(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialCommunityIcons name="phone" size={18} color="#6f4bd8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickCallBtn, styles.quickCallVideo]}
            onPress={() => handleMakeVideoCall(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialCommunityIcons name="video" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Modal for Call Options
  const CallOptionsModal = () => {
    const meta = CONTACT_TYPE_META[selectedContact?.type] || DEFAULT_TYPE_META;
    const sipTarget = selectedContact ? (getSipCandidatesForContact(selectedContact)[0] || null) : null;
    return (
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalAvatar, { backgroundColor: meta.bg }]}>
              <MaterialCommunityIcons name={meta.icon} size={30} color={meta.color} />
            </View>
            <Text style={styles.modalTitle}>{selectedContact?.name}</Text>
            <Text style={styles.modalSubtitle}>
              {selectedContact?.type}{sipTarget ? `  •  ${sipTarget}` : ''}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.audioBtn]}
                onPress={() => handleMakeAudioCall(selectedContact)}
              >
                <MaterialCommunityIcons name="phone" size={20} color="#ffffff" />
                <Text style={styles.actionText}>Audio</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.videoBtn]}
                onPress={() => handleMakeVideoCall(selectedContact)}
              >
                <MaterialCommunityIcons name="video" size={20} color="#ffffff" />
                <Text style={styles.actionText}>Video</Text>
              </TouchableOpacity>
            </View>
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
  };

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
      <View style={styles.transportSummary}>
        <View style={styles.transportSummaryRow}>
          <View style={styles.transportSummaryItem}>
            <Text style={styles.transportLabel}>Selected setup</Text>
            <View style={styles.transportChipRow}>
              <Text style={[styles.transportChip, styles.transportChipPrimary]}>{selectedTransport.toUpperCase()}</Text>
              <Text style={styles.transportChip}>{selectedMockupLabel}</Text>
            </View>
          </View>
          <View style={styles.transportDivider} />
          <View style={styles.transportSummaryItem}>
            <Text style={styles.transportLabel}>Active line</Text>
            <View style={styles.transportChipRow}>
              <Text style={[styles.transportChip, transportReady ? styles.transportChipReady : styles.transportChipMuted]}>{activeTransportLabel}</Text>
              <Text style={styles.transportChip}>{activeMockupLabel}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.transportState, transportReady ? styles.transportStateReady : styles.transportStateWaiting]}>
          {transportReady ? 'Ready for calls' : 'Waiting for matching SIP registration'}
        </Text>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={renderContactItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          contacts.length === 0 ? styles.listEmptyContainer : styles.listContent,
          { paddingBottom: bottomSpacing },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={contactsRefreshing}
            onRefresh={() => fetchContacts({ isRefresh: true })}
            colors={['#6f4bd8']}
            tintColor="#6f4bd8"
          />
        }
        ListEmptyComponent={
          contactsLoading ? (
            <View style={styles.listEmptyBox}>
              <ActivityIndicator size="large" color="#6f4bd8" />
              <Text style={styles.listEmptyText}>Loading contacts…</Text>
            </View>
          ) : contactsError ? (
            <View style={styles.listEmptyBox}>
              <MaterialCommunityIcons name="cloud-alert-outline" size={42} color="#b3a6d9" />
              <Text style={styles.listEmptyText}>{contactsError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchContacts()}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listEmptyBox}>
              <MaterialCommunityIcons name="account-group-outline" size={42} color="#b3a6d9" />
              <Text style={styles.listEmptyText}>
                No contacts found for this {selectedTransport.toUpperCase()} setup.
              </Text>
            </View>
          )
        }
      />
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
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    marginVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ece4fb',
    shadowColor: '#7f58e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  onlineDotOn: {
    backgroundColor: '#22c55e',
  },
  onlineDotOff: {
    backgroundColor: '#c4b5e8',
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2f2550',
    marginBottom: 3,
  },
  contactDetail: {
    fontSize: 12.5,
    color: '#8d80b5',
    fontWeight: '600',
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickCallBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
  },
  quickCallAudio: {
    backgroundColor: '#f3edff',
    borderColor: '#dfd0ff',
  },
  quickCallVideo: {
    backgroundColor: '#6f4bd8',
    borderColor: '#6f4bd8',
  },
  listContent: {
    paddingBottom: 40,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  listEmptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  listEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listEmptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#7f72a3',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#6f4bd8',
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  separator: {
    height: 1,
    backgroundColor: 'transparent', 
  },
  transportSummary: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9deff',
    shadowColor: '#7f58e2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  transportSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transportSummaryItem: {
    flex: 1,
  },
  transportLabel: {
    fontSize: 11,
    color: '#8d80b5',
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  transportChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  transportChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f5f2ff',
    color: '#584a86',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 7,
    marginBottom: 4,
    overflow: 'hidden',
  },
  transportChipPrimary: {
    backgroundColor: '#6f4bd8',
    color: '#ffffff',
  },
  transportChipReady: {
    backgroundColor: '#e6f8ed',
    color: '#217a43',
  },
  transportChipMuted: {
    backgroundColor: '#f0edf7',
    color: '#8b82a5',
  },
  transportDivider: {
    width: 1,
    height: 45,
    backgroundColor: '#eee6ff',
    marginHorizontal: 12,
  },
  transportState: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '800',
  },
  transportStateReady: {
    color: '#217a43',
  },
  transportStateWaiting: {
    color: '#8b6a00',
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
    padding: 26,
    width: '100%',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#e9dcff',
  },
  modalAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    color: '#31265a',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8d80b5',
    marginBottom: 22,
    textAlign: 'center',
  },
  modalButtons: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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
    marginLeft: 8,
  },
  cancelText: {
    color: '#6246bb',
    fontWeight: '700',
    fontSize: 16,
  },
});