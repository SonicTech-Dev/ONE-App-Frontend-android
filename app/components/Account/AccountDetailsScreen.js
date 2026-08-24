import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import Screen from '../Screen';
import routes from '../../navigation/routes';
import {
  buildGetAccountInfoRequest,
  buildGetFamilyInfoRequest,
  extractAccountInfo,
  extractFamilyInfo,
  resolveCurrentUserAuthRole,
  getAuthRoleLabel,
  getInitials,
  getUpstreamErrorMessage,
  normalizeNetworkMode,
} from './accountUtils';

const LAN_ACCOUNT_URL = 'http://192.168.2.115/api/v1.0/account';
const WAN_ACCOUNT_URL = 'https://one-development.soniciot.com/get-account-details/';
const LAN_FAMILY_URL = 'http://192.168.2.115/api/v1.0/family';
const WAN_FAMILY_URL = 'https://one-development.soniciot.com/get-family-details/';
const ACCOUNT_REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
// No mockup selector exists outside of Smart/Scenes yet; default to Mockup 2's residence for WAN family lookups.
const DEFAULT_WAN_RESIDENCE_ID = 'rabd2c6d2aecc4ce3be11e25b4ecd3c82';

export default function AccountDetailsScreen({ route, navigation }) {
  const { networkMode, getActiveLanToken, getActiveWanToken } = useAuth();
  const activeNetworkMode = normalizeNetworkMode(route?.params?.selectedOption, networkMode);
  const isLan = activeNetworkMode === 'LAN';
  const [accountInfo, setAccountInfo] = useState(null);
  const [authRole, setAuthRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const getRequestHeaders = useCallback((token) => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }), []);

  const loadAccountDetails = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const response = await fetch(isLan ? LAN_ACCOUNT_URL : WAN_ACCOUNT_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify(buildGetAccountInfoRequest({ requestId: ACCOUNT_REQUEST_ID })),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getUpstreamErrorMessage(payload, `Unable to load account details (${response.status})`));
      }
      const info = extractAccountInfo(payload);
      setAccountInfo(info);

      // Auth role is only exposed via family info, and only WAN returns the member list today.
      try {
        const familyResponse = await fetch(isLan ? LAN_FAMILY_URL : WAN_FAMILY_URL, {
          method: 'POST',
          headers: getRequestHeaders(token),
          body: JSON.stringify(buildGetFamilyInfoRequest({
            isLan,
            residenceId: DEFAULT_WAN_RESIDENCE_ID,
            requestId: ACCOUNT_REQUEST_ID,
          })),
        });
        const familyPayload = await familyResponse.json();
        if (familyResponse.ok) {
          const familyInfo = extractFamilyInfo(familyPayload);
          setAuthRole(resolveCurrentUserAuthRole(familyInfo, info?.account_id));
        } else {
          setAuthRole('');
        }
      } catch (familyError) {
        console.error('[AccountDetailsScreen] Failed to resolve auth role from family info:', familyError);
        setAuthRole('');
      }
    } catch (error) {
      console.error('[AccountDetailsScreen] Failed to load account details:', error);
      setAccountInfo(null);
      setErrorMessage(error?.message || 'Unable to load your account details right now.');
    } finally {
      setLoading(false);
    }
  }, [getActiveLanToken, getActiveWanToken, getRequestHeaders, isLan]);

  useEffect(() => {
    loadAccountDetails();
  }, [loadAccountDetails]);

  const fullName = `${accountInfo?.first_name || ''} ${accountInfo?.last_name || ''}`.trim() || accountInfo?.account_name || 'Account';
  const roleLabel = getAuthRoleLabel(authRole);

  return (
    <Screen style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAccountDetails} tintColor="#6f4bd8" />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#34225f" />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>My Account</Text>
            <Text style={styles.subtitle}>{activeNetworkMode} connection</Text>
          </View>
        </View>

        {loading && !accountInfo ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#6f4bd8" />
            <Text style={styles.stateMessage}>Loading account details...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="cloud-alert" size={34} color="#c35b6f" />
            <Text style={styles.stateTitle}>Unable to load account</Text>
            <Text style={styles.stateMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadAccountDetails}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
              </View>
              <Text style={styles.profileName}>{fullName}</Text>
              {accountInfo?.email ? <Text style={styles.profileEmail}>{accountInfo.email}</Text> : null}
              {accountInfo?.phone ? <Text style={styles.profilePhone}>{accountInfo.phone}</Text> : null}
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="identifier" size={18} color="#6f4bd8" />
                <Text style={styles.infoLabel}>Account ID</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{accountInfo?.account_id || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="account-key-outline" size={18} color="#6f4bd8" />
                <Text style={styles.infoLabel}>Access role</Text>
                <View style={[styles.roleBadge, authRole ? styles.roleBadgeActive : styles.roleBadgeUnknown]}>
                  <Text style={[styles.roleBadgeText, authRole ? styles.roleBadgeTextActive : styles.roleBadgeTextUnknown]}>{roleLabel}</Text>
                </View>
              </View>
            </View>

            {isLan && !authRole ? (
              <Text style={styles.roleHint}>Access role isn't available on LAN yet — this will appear once supported by the local firmware.</Text>
            ) : null}

            <TouchableOpacity
              style={styles.familyButton}
              onPress={() => navigation.navigate(routes.FAMILYMANAGEMENT, {
                currentAccountId: accountInfo?.account_id,
                selectedOption: activeNetworkMode,
              })}
              accessibilityLabel="View family management"
            >
              <MaterialCommunityIcons name="account-multiple-outline" size={20} color="#ffffff" />
              <Text style={styles.familyButtonText}>Family Management</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#ffffff" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f8f6fc' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 18, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTextBlock: { flex: 1, marginLeft: 12 },
  title: { color: '#34225f', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#8975b5', fontSize: 13, fontWeight: '600', marginTop: 3 },
  stateCard: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 28 },
  stateTitle: { color: '#443467', fontSize: 17, fontWeight: '800', marginTop: 10 },
  stateMessage: { color: '#8975a8', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  retryButton: { backgroundColor: '#6f4bd8', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  retryText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  profileCard: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 24, marginBottom: 18, shadowColor: '#6f4bd8', shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  avatar: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#6f4bd8', fontSize: 26, fontWeight: '800' },
  profileName: { color: '#34225f', fontSize: 20, fontWeight: '800', textTransform: 'capitalize' },
  profileEmail: { color: '#8975a8', fontSize: 13, fontWeight: '600', marginTop: 4 },
  profilePhone: { color: '#8975a8', fontSize: 13, fontWeight: '600', marginTop: 2 },
  infoCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoLabel: { flex: 1, color: '#6e5f93', fontSize: 13, fontWeight: '700', marginLeft: 10 },
  infoValue: { color: '#34225f', fontSize: 13, fontWeight: '700', maxWidth: 150 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  roleBadgeActive: { backgroundColor: '#efe6ff' },
  roleBadgeUnknown: { backgroundColor: '#f2f2f5' },
  roleBadgeText: { fontSize: 12, fontWeight: '800' },
  roleBadgeTextActive: { color: '#6f4bd8' },
  roleBadgeTextUnknown: { color: '#8975a8' },
  roleHint: { color: '#8975a8', fontSize: 12, lineHeight: 18, marginBottom: 18, paddingHorizontal: 4 },
  familyButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#6f4bd8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  familyButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800', marginHorizontal: 10 },
});
