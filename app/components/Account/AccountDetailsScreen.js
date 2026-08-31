import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { BACKEND_URL, useAuth } from '../../context/AuthContext';
import { MOCKUP_OPTIONS } from '../Smart/SmartScreenSections/SmartScreen.constants';
import Screen from '../Screen';
import routes from '../../navigation/routes';
import {
  buildGetAccountInfoRequest,
  buildGetFamilyInfoRequest,
  buildUpdateAccountInfoRequest,
  buildUpdateAccountPasswordRequest,
  buildDeleteAccountInfoRequest,
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
const BACKEND_PASSWORD_URL = `${BACKEND_URL}/api/update-password/`;
const LAN_FAMILY_URL = 'http://192.168.2.115/api/v1.0/family';
const WAN_FAMILY_URL = 'https://one-development.soniciot.com/get-family-details/';
const ACCOUNT_REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
const RESIDENCE_IDS = {
  [MOCKUP_OPTIONS.MOCKUP_1]: 'r45844047053e43d78fe5272c5badbd3a',
  [MOCKUP_OPTIONS.MOCKUP_2]: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
};

export default function AccountDetailsScreen({ route, navigation }) {
  const { networkMode, authRole: authenticatedRole, getActiveLanToken, getActiveWanToken, logout, updateStoredPassword } = useAuth();
  const activeNetworkMode = normalizeNetworkMode(route?.params?.selectedOption, networkMode);
  const isLan = activeNetworkMode === 'LAN';
  const selectedMockup = route?.params?.selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? MOCKUP_OPTIONS.MOCKUP_1
    : MOCKUP_OPTIONS.MOCKUP_2;
  const selectedResidenceId = RESIDENCE_IDS[selectedMockup];
  const [accountInfo, setAccountInfo] = useState(null);
  const [authRole, setAuthRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [firstNameDraft, setFirstNameDraft] = useState('');
  const [lastNameDraft, setLastNameDraft] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [originPassword, setOriginPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOriginPassword, setShowOriginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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
      setAuthRole(info?.auth || authenticatedRole || '');

      // Auth role is only exposed via family info, and only WAN returns the member list today.
      try {
        const familyResponse = await fetch(isLan ? LAN_FAMILY_URL : WAN_FAMILY_URL, {
          method: 'POST',
          headers: getRequestHeaders(token),
          body: JSON.stringify(buildGetFamilyInfoRequest({
            isLan,
            residenceId: selectedResidenceId,
            requestId: ACCOUNT_REQUEST_ID,
          })),
        });
        const familyPayload = await familyResponse.json();
        if (familyResponse.ok) {
          const familyInfo = extractFamilyInfo(familyPayload);
          setAuthRole(resolveCurrentUserAuthRole(familyInfo, info?.account_id));
        } else {
          setAuthRole(info?.auth || authenticatedRole || '');
        }
      } catch (familyError) {
        console.error('[AccountDetailsScreen] Failed to resolve auth role from family info:', familyError);
        setAuthRole(info?.auth || authenticatedRole || '');
      }
    } catch (error) {
      console.error('[AccountDetailsScreen] Failed to load account details:', error);
      setAccountInfo(null);
      setErrorMessage(error?.message || 'Unable to load your account details right now.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedRole, getActiveLanToken, getActiveWanToken, getRequestHeaders, isLan, selectedResidenceId]);

  useEffect(() => {
    loadAccountDetails();
  }, [loadAccountDetails]);

  // Admin rights can be transferred from Family Management, so re-resolve the role on return.
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', loadAccountDetails);
    return unsubscribe;
  }, [navigation, loadAccountDetails]);

  const fullName = `${accountInfo?.first_name || ''} ${accountInfo?.last_name || ''}`.trim() || accountInfo?.account_name || 'Account';
  const roleLabel = getAuthRoleLabel(authRole);

  const getAccountToken = useCallback(() => (isLan ? getActiveLanToken() : getActiveWanToken()), [getActiveLanToken, getActiveWanToken, isLan]);

  const openNameEditor = () => {
    setFirstNameDraft(accountInfo?.first_name || '');
    setLastNameDraft(accountInfo?.last_name || '');
    setIsNameModalVisible(true);
  };

  const closePasswordEditor = () => {
    setIsPasswordModalVisible(false);
    setOriginPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOriginPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const resetToLogin = useCallback(async () => {
    await logout();
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'WelcomeScreen' }] }));
  }, [logout, navigation]);

  const handleLogout = () => {
    Alert.alert(
      'Log out?',
      "You'll need to sign in again to continue using the app.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: resetToLogin,
        },
      ],
    );
  };

  const saveAccountName = async () => {
    const firstName = firstNameDraft.trim();
    const lastName = lastNameDraft.trim();
    if (!firstName || !lastName) {
      Alert.alert('Name required', 'Please enter both first and last name.');
      return;
    }

    setIsSavingName(true);
    try {
      const token = await getAccountToken();
      const response = await fetch(isLan ? LAN_ACCOUNT_URL : WAN_ACCOUNT_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify(buildUpdateAccountInfoRequest({
          requestId: ACCOUNT_REQUEST_ID,
          firstName,
          lastName,
        })),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getUpstreamErrorMessage(payload, `Unable to update account name (${response.status})`));
      }

      const updatedInfo = extractAccountInfo(payload);
      setAccountInfo((currentInfo) => ({
        ...(currentInfo || {}),
        ...updatedInfo,
        first_name: updatedInfo?.first_name || firstName,
        last_name: updatedInfo?.last_name || lastName,
      }));
      setIsNameModalVisible(false);
      Alert.alert('Account updated', 'Your account name has been updated.');
    } catch (error) {
      console.error('[AccountDetailsScreen] Failed to update account name:', error);
      Alert.alert('Unable to update', error?.message || 'Unable to update account name right now.');
    } finally {
      setIsSavingName(false);
    }
  };

  const saveAccountPassword = async () => {
    if (!originPassword || !newPassword || !confirmPassword) {
      Alert.alert('Password required', 'Please complete all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please confirm the new password correctly.');
      return;
    }

    const email = accountInfo?.email || accountInfo?.account_name || '';
    if (!email) {
      Alert.alert('Email required', 'Unable to update the local login database because the account email is missing.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const token = await getAccountToken();
      const response = await fetch(isLan ? LAN_ACCOUNT_URL : WAN_ACCOUNT_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify(buildUpdateAccountPasswordRequest({
          requestId: ACCOUNT_REQUEST_ID,
          newPassword,
          originPassword,
        })),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getUpstreamErrorMessage(payload, `Unable to update password (${response.status})`));
      }

      const backendResponse = await fetch(BACKEND_PASSWORD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email,
          origin_password: originPassword,
          new_password: newPassword,
        }),
      });
      const backendPayload = await backendResponse.json().catch(() => ({}));
      if (!backendResponse.ok) {
        const sqlErrorMessage = getUpstreamErrorMessage(backendPayload, `HTTP ${backendResponse.status}`);
        throw new Error(`Password changed in account API, but SQL login sync failed at /api/update-password/: ${sqlErrorMessage}`);
      }

      await updateStoredPassword(newPassword, email);

      closePasswordEditor();
      Alert.alert(
        'Password updated',
        'Your account password has been changed. Please sign in again.',
        [{ text: 'OK', onPress: resetToLogin }],
      );
    } catch (error) {
      console.error('[AccountDetailsScreen] Failed to update account password:', error);
      Alert.alert('Unable to update', error?.message || 'Unable to update password right now.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const deleteWanAccount = async () => {
    const accountId = accountInfo?.account_id || '';
    if (!accountId) {
      Alert.alert('Unable to delete', 'Account ID is missing from the account details response.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const token = await getActiveWanToken();
      const response = await fetch(WAN_ACCOUNT_URL, {
        method: 'POST',
        headers: getRequestHeaders(token),
        body: JSON.stringify(buildDeleteAccountInfoRequest({
          requestId: ACCOUNT_REQUEST_ID,
          accountId,
        })),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getUpstreamErrorMessage(payload, `Unable to delete account (${response.status})`));
      }

      await logout();
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'WelcomeScreen' }] }));
    } catch (error) {
      console.error('[AccountDetailsScreen] Failed to delete account:', error);
      Alert.alert('Unable to delete', error?.message || 'Unable to delete account right now.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const confirmDeleteAccount = () => {
    if (isLan) return;
    Alert.alert(
      'Delete account?',
      'This will permanently delete your account from WAN account management. You will be logged out after deletion.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteWanAccount },
      ],
    );
  };

  const AccountActionButton = ({ icon, title, subtitle, onPress, danger = false, disabled = false }) => (
    <TouchableOpacity
      style={[styles.accountActionButton, danger ? styles.accountActionButtonDanger : null, disabled ? styles.accountActionButtonDisabled : null]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={title}
    >
      <View style={[styles.accountActionIcon, danger ? styles.accountActionIconDanger : null]}>
        <MaterialCommunityIcons name={icon} size={20} color={danger ? '#c4455c' : '#6f4bd8'} />
      </View>
      <View style={styles.accountActionTextBlock}>
        <Text style={[styles.accountActionTitle, danger ? styles.accountActionTitleDanger : null]}>{title}</Text>
        {subtitle ? <Text style={styles.accountActionSubtitle}>{subtitle}</Text> : null}
      </View>
      {disabled ? <ActivityIndicator size="small" color={danger ? '#c4455c' : '#6f4bd8'} /> : <MaterialCommunityIcons name="chevron-right" size={22} color="#b4a6d8" />}
    </TouchableOpacity>
  );

  const renderAccountTextInput = ({ label, value, onChangeText, placeholder, secureTextEntry = false, passwordVisible = false, onTogglePasswordVisibility = null }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.textInputWrap}>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#b7abc9"
          secureTextEntry={secureTextEntry && !passwordVisible}
          autoCapitalize="none"
        />
        {secureTextEntry ? (
          <TouchableOpacity
            style={styles.passwordEyeButton}
            onPress={onTogglePasswordVisibility}
            accessibilityLabel={passwordVisible ? `Hide ${label}` : `Show ${label}`}
          >
            <MaterialCommunityIcons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={21} color="#7d6da8" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const renderEditNameModal = () => (
    <Modal visible={isNameModalVisible} transparent animationType="slide" onRequestClose={() => setIsNameModalVisible(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit account name</Text>
          <Text style={styles.modalSubtitle}>Update the first and last name linked to this account.</Text>
          {renderAccountTextInput({ label: 'First name', value: firstNameDraft, onChangeText: setFirstNameDraft, placeholder: 'First name' })}
          {renderAccountTextInput({ label: 'Last name', value: lastNameDraft, onChangeText: setLastNameDraft, placeholder: 'Last name' })}
          <View style={styles.modalButtonRow}>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]} onPress={() => setIsNameModalVisible(false)} disabled={isSavingName}>
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={saveAccountName} disabled={isSavingName}>
              {isSavingName ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.modalButtonPrimaryText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderEditPasswordModal = () => (
    <Modal visible={isPasswordModalVisible} transparent animationType="slide" onRequestClose={closePasswordEditor}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Change password</Text>
          <Text style={styles.modalSubtitle}>Enter your current password and choose a new one.</Text>
          {renderAccountTextInput({ label: 'Current password', value: originPassword, onChangeText: setOriginPassword, placeholder: 'Current password', secureTextEntry: true, passwordVisible: showOriginPassword, onTogglePasswordVisibility: () => setShowOriginPassword((visible) => !visible) })}
          {renderAccountTextInput({ label: 'New password', value: newPassword, onChangeText: setNewPassword, placeholder: 'New password', secureTextEntry: true, passwordVisible: showNewPassword, onTogglePasswordVisibility: () => setShowNewPassword((visible) => !visible) })}
          {renderAccountTextInput({ label: 'Confirm new password', value: confirmPassword, onChangeText: setConfirmPassword, placeholder: 'Confirm new password', secureTextEntry: true, passwordVisible: showConfirmPassword, onTogglePasswordVisibility: () => setShowConfirmPassword((visible) => !visible) })}
          <View style={styles.modalButtonRow}>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]} onPress={closePasswordEditor} disabled={isSavingPassword}>
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={saveAccountPassword} disabled={isSavingPassword}>
              {isSavingPassword ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.modalButtonPrimaryText}>Update</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
          <TouchableOpacity style={styles.headerLogoutButton} onPress={handleLogout} accessibilityLabel="Log out">
            <MaterialCommunityIcons name="logout" size={20} color="#c35b6f" />
          </TouchableOpacity>
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
              <View style={styles.profileNameWrap}>
                <Text style={styles.profileName}>{fullName}</Text>
                <TouchableOpacity style={styles.profileEditButton} onPress={openNameEditor} accessibilityLabel="Edit account name">
                  <MaterialCommunityIcons name="pencil" size={16} color="#6f4bd8" />
                </TouchableOpacity>
              </View>
              {accountInfo?.email ? <Text style={styles.profileEmail}>{accountInfo.email}</Text> : null}
              {accountInfo?.phone ? <Text style={styles.profilePhone}>{accountInfo.phone}</Text> : null}
            </View>

            <View style={styles.accountActionsCard}>
              <Text style={styles.sectionTitle}>Account settings</Text>
              <AccountActionButton
                icon="lock-reset"
                title="Change Account Password"
                onPress={() => setIsPasswordModalVisible(true)}
              />
              {!isLan ? (
                <AccountActionButton
                  icon="account-remove-outline"
                  title="Delete account"
                  onPress={confirmDeleteAccount}
                  danger
                  disabled={isDeletingAccount}
                />
              ) : null}
            </View>

            <View style={styles.infoCard}>
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
                selectedMockup,
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
      {renderEditNameModal()}
      {renderEditPasswordModal()}
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
  headerLogoutButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f0d3d9', alignItems: 'center', justifyContent: 'center' },
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
  profileNameWrap: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 42, position: 'relative' },
  profileName: { color: '#34225f', fontSize: 20, fontWeight: '800', textTransform: 'capitalize', textAlign: 'center' },
  profileEditButton: { position: 'absolute', right: 4, top: -12, width: 32, height: 32, borderRadius: 16, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center' },
  profileEmail: { color: '#8975a8', fontSize: 13, fontWeight: '600', marginTop: 4 },
  profilePhone: { color: '#8975a8', fontSize: 13, fontWeight: '600', marginTop: 2 },
  accountActionsCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, marginBottom: 18, shadowColor: '#6f4bd8', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  sectionTitle: { color: '#34225f', fontSize: 15, fontWeight: '800', marginBottom: 10 },
  accountActionButton: { minHeight: 64, borderRadius: 14, backgroundColor: '#fbf9ff', borderWidth: 1, borderColor: '#eee7fb', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginTop: 10 },
  accountActionButtonDanger: { backgroundColor: '#fff7f8', borderColor: '#f3d6dc' },
  accountActionButtonDisabled: { opacity: 0.7 },
  accountActionIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  accountActionIconDanger: { backgroundColor: '#ffe9ed' },
  accountActionTextBlock: { flex: 1 },
  accountActionTitle: { color: '#34225f', fontSize: 14, fontWeight: '800' },
  accountActionTitleDanger: { color: '#b7354c' },
  accountActionSubtitle: { color: '#8975a8', fontSize: 12, fontWeight: '600', marginTop: 3, lineHeight: 17 },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(33, 22, 61, 0.32)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  modalHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#ddd3ef', alignSelf: 'center', marginBottom: 18 },
  modalTitle: { color: '#34225f', fontSize: 21, fontWeight: '800' },
  modalSubtitle: { color: '#8975a8', fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 5, marginBottom: 16 },
  inputGroup: { marginBottom: 13 },
  inputLabel: { color: '#5f507f', fontSize: 12, fontWeight: '800', marginBottom: 7 },
  textInputWrap: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#e7def7', backgroundColor: '#fbf9ff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  textInput: { flex: 1, minHeight: 48, color: '#34225f', fontSize: 14, fontWeight: '700', paddingVertical: 0, paddingRight: 8 },
  passwordEyeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalButtonRow: { flexDirection: 'row', marginTop: 6 },
  modalButton: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalButtonSecondary: { backgroundColor: '#f3effa', marginRight: 8 },
  modalButtonPrimary: { backgroundColor: '#6f4bd8', marginLeft: 8 },
  modalButtonSecondaryText: { color: '#6f4bd8', fontSize: 14, fontWeight: '800' },
  modalButtonPrimaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
