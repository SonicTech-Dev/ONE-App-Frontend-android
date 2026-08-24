import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import Screen from '../Screen';
import {
  buildGetFamilyInfoRequest,
  buildUpdateFamilyInfoRequest,
  extractFamilyInfo,
  getFamilyId,
  getFamilyMembers,
  getMemberDisplayName,
  getInitials,
  getAuthRoleLabel,
  getUpstreamErrorMessage,
  normalizeNetworkMode,
} from './accountUtils';

const LAN_FAMILY_URL = 'http://192.168.2.115/api/v1.0/family';
const WAN_FAMILY_URL = 'https://one-development.soniciot.com/get-family-details/';
const FAMILY_REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
const DEFAULT_WAN_RESIDENCE_ID = 'rabd2c6d2aecc4ce3be11e25b4ecd3c82';

export default function FamilyManagementScreen({ route, navigation }) {
  const currentAccountId = route?.params?.currentAccountId || '';
  const { networkMode, getActiveLanToken, getActiveWanToken } = useAuth();
  const activeNetworkMode = normalizeNetworkMode(route?.params?.selectedOption, networkMode);
  const isLan = activeNetworkMode === 'LAN';
  const [familyInfo, setFamilyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false);
  const [familyNameDraft, setFamilyNameDraft] = useState('');
  const [savingFamilyName, setSavingFamilyName] = useState(false);

  const loadFamilyInfo = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const response = await fetch(isLan ? LAN_FAMILY_URL : WAN_FAMILY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildGetFamilyInfoRequest({
          isLan,
          residenceId: DEFAULT_WAN_RESIDENCE_ID,
          requestId: FAMILY_REQUEST_ID,
        })),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getUpstreamErrorMessage(payload, `Unable to load family details (${response.status})`));
      }
      setFamilyInfo(extractFamilyInfo(payload));
    } catch (error) {
      console.error('[FamilyManagementScreen] Failed to load family info:', error);
      setFamilyInfo(null);
      setErrorMessage(error?.message || 'Unable to load family details right now.');
    } finally {
      setLoading(false);
    }
  }, [getActiveLanToken, getActiveWanToken, isLan]);

  useEffect(() => {
    loadFamilyInfo();
  }, [loadFamilyInfo]);

  const members = getFamilyMembers(familyInfo);
  const familyName = familyInfo?.family_name || '';

  const startEditingFamilyName = () => {
    setFamilyNameDraft(familyName);
    setIsEditingFamilyName(true);
  };

  const cancelEditingFamilyName = () => {
    setFamilyNameDraft(familyName);
    setIsEditingFamilyName(false);
  };

  const saveFamilyName = async () => {
    const nextFamilyName = familyNameDraft.trim();
    if (!nextFamilyName) {
      Alert.alert('Family name required', 'Please enter a family name.');
      return;
    }

    const familyId = getFamilyId(familyInfo) || (!isLan ? DEFAULT_WAN_RESIDENCE_ID : '');
    if (!familyId) {
      Alert.alert('Unable to update', 'Family ID is missing from the family info response.');
      return;
    }

    setSavingFamilyName(true);
    try {
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const response = await fetch(isLan ? LAN_FAMILY_URL : WAN_FAMILY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildUpdateFamilyInfoRequest({
          isLan,
          familyId,
          familyName: nextFamilyName,
          requestId: FAMILY_REQUEST_ID,
        })),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getUpstreamErrorMessage(payload, `Unable to update family name (${response.status})`));
      }

      setFamilyInfo((currentFamilyInfo) => ({
        ...(currentFamilyInfo || {}),
        ...extractFamilyInfo(payload),
        family_name: extractFamilyInfo(payload)?.family_name || nextFamilyName,
      }));
      setIsEditingFamilyName(false);
    } catch (error) {
      console.error('[FamilyManagementScreen] Failed to update family name:', error);
      Alert.alert('Unable to update', error?.message || 'Unable to update family name right now.');
    } finally {
      setSavingFamilyName(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFamilyInfo} tintColor="#6f4bd8" />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#34225f" />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>Family Management</Text>
            <Text style={styles.subtitle}>{familyInfo?.family_name || `${activeNetworkMode} connection`}</Text>
          </View>
        </View>

        {familyInfo ? (
          <View style={styles.familyInfoCard}>
            <View style={styles.familyInfoIcon}>
              <MaterialCommunityIcons name="home-account" size={22} color="#6f4bd8" />
            </View>
            <View style={styles.familyInfoBody}>
              <Text style={styles.familyInfoLabel}>Family name</Text>
              {isEditingFamilyName ? (
                <TextInput
                  style={styles.familyNameInput}
                  value={familyNameDraft}
                  onChangeText={setFamilyNameDraft}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!savingFamilyName}
                  returnKeyType="done"
                  onSubmitEditing={saveFamilyName}
                />
              ) : (
                <Text style={styles.familyInfoValue} numberOfLines={2}>{familyName || 'Not available'}</Text>
              )}
            </View>
            {isEditingFamilyName ? (
              <View style={styles.familyEditActions}>
                <TouchableOpacity style={styles.iconButton} onPress={cancelEditingFamilyName} disabled={savingFamilyName} accessibilityLabel="Cancel family name edit">
                  <MaterialCommunityIcons name="close" size={20} color="#8975b5" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconButton, styles.saveIconButton]} onPress={saveFamilyName} disabled={savingFamilyName} accessibilityLabel="Save family name">
                  {savingFamilyName ? <ActivityIndicator size="small" color="#ffffff" /> : <MaterialCommunityIcons name="check" size={20} color="#ffffff" />}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.iconButton} onPress={startEditingFamilyName} accessibilityLabel="Edit family name">
                <MaterialCommunityIcons name="pencil-outline" size={20} color="#6f4bd8" />
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {!isLan && familyInfo ? (
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, familyInfo?.online ? styles.statusBadgeOn : styles.statusBadgeOff]}>
              <MaterialCommunityIcons name={familyInfo?.online ? 'wifi' : 'wifi-off'} size={14} color="#ffffff" />
              <Text style={styles.statusBadgeText}>{familyInfo?.online ? 'Online' : 'Offline'}</Text>
            </View>
            <View style={[styles.statusBadge, familyInfo?.installed ? styles.statusBadgeOn : styles.statusBadgeOff]}>
              <MaterialCommunityIcons name={familyInfo?.installed ? 'check-circle-outline' : 'progress-alert'} size={14} color="#ffffff" />
              <Text style={styles.statusBadgeText}>{familyInfo?.installed ? 'Installed' : 'Not installed'}</Text>
            </View>
          </View>
        ) : null}

        {loading && !familyInfo ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#6f4bd8" />
            <Text style={styles.stateMessage}>Loading family details...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="cloud-alert" size={34} color="#c35b6f" />
            <Text style={styles.stateTitle}>Unable to load family</Text>
            <Text style={styles.stateMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadFamilyInfo}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="account-group-outline" size={34} color="#8b78b8" />
            <Text style={styles.stateTitle}>No members to show yet</Text>
            <Text style={styles.stateMessage}>
              {isLan
                ? "The member list isn't available on LAN yet — this will appear once supported by the local firmware."
                : 'No family members have been added yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {members.map((member, index) => {
              const name = getMemberDisplayName(member);
              const isCurrentUser = currentAccountId && String(member?.account_id) === String(currentAccountId);
              return (
                <View key={member?.account_id || `${name}-${index}`} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{getInitials(name)}</Text>
                  </View>
                  <View style={styles.memberBody}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
                      {isCurrentUser ? <Text style={styles.youTag}>You</Text> : null}
                    </View>
                    {member?.email ? <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text> : null}
                  </View>
                  <View style={[styles.roleBadge, styles[`roleBadge_${String(member?.auth || '').toLowerCase()}`] || styles.roleBadgeDefault]}>
                    <Text style={styles.roleBadgeText}>{getAuthRoleLabel(member?.auth)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f8f6fc' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 18, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTextBlock: { flex: 1, marginLeft: 12 },
  title: { color: '#34225f', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#8975b5', fontSize: 13, fontWeight: '600', marginTop: 3 },
  familyInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#34225f', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  familyInfoIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  familyInfoBody: { flex: 1 },
  familyInfoLabel: { color: '#8975b5', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  familyInfoValue: { color: '#34225f', fontSize: 17, fontWeight: '800', marginTop: 3 },
  familyNameInput: { minHeight: 40, borderWidth: 1, borderColor: '#d8ccef', borderRadius: 10, color: '#34225f', fontSize: 16, fontWeight: '700', marginTop: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ffffff' },
  familyEditActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2ebff', marginLeft: 8 },
  saveIconButton: { backgroundColor: '#6f4bd8' },
  statusRow: { flexDirection: 'row', marginBottom: 16 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 10 },
  statusBadgeOn: { backgroundColor: '#4caf7d' },
  statusBadgeOff: { backgroundColor: '#a99fc0' },
  statusBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', marginLeft: 6 },
  stateCard: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 28 },
  stateTitle: { color: '#443467', fontSize: 17, fontWeight: '800', marginTop: 10 },
  stateMessage: { color: '#8975a8', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  retryButton: { backgroundColor: '#6f4bd8', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  retryText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  list: {},
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, padding: 12, marginBottom: 10, shadowColor: '#34225f', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  memberAvatarText: { color: '#6f4bd8', fontSize: 14, fontWeight: '800' },
  memberBody: { flex: 1, marginRight: 8 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { color: '#34225f', fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
  youTag: { color: '#6f4bd8', fontSize: 10, fontWeight: '800', marginLeft: 8, backgroundColor: '#efe6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  memberEmail: { color: '#8975a8', fontSize: 12, fontWeight: '600', marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#8975a8' },
  roleBadgeDefault: { backgroundColor: '#8975a8' },
  roleBadge_admin: { backgroundColor: '#6f4bd8' },
  roleBadge_user: { backgroundColor: '#4caf7d' },
  roleBadge_guest: { backgroundColor: '#a99fc0' },
  roleBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
});
