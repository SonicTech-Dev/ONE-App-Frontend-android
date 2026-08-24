const normalizeText = (value) => String(value ?? '').trim();

export const normalizeNetworkMode = (value, fallback = 'WAN') => {
  const normalized = normalizeText(value || fallback).toUpperCase();
  return normalized === 'LAN' ? 'LAN' : 'WAN';
};

export const buildGetAccountInfoRequest = ({ requestId }) => ({
  command: 'get_account_info',
  id: requestId,
  param: {},
});

export const buildGetFamilyInfoRequest = ({ isLan, residenceId, requestId }) => ({
  command: 'get_family_info',
  id: requestId,
  param: isLan ? {} : { residence_id: residenceId },
});

export const buildUpdateFamilyInfoRequest = ({ isLan, familyId, familyName, requestId }) => ({
  command: 'update_family_info',
  id: requestId,
  param: {
    [isLan ? 'family_id' : 'residence_id']: familyId,
    family_name: familyName,
  },
});

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

export const extractAccountInfo = (payload = {}) => asObject(payload?.result);

export const extractFamilyInfo = (payload = {}) => asObject(payload?.result);

export const getFamilyMembers = (familyInfo = {}) => (Array.isArray(familyInfo?.accounts) ? familyInfo.accounts : []);

export const getFamilyId = (familyInfo = {}) => (
  normalizeText(familyInfo?.family_id)
    || normalizeText(familyInfo?.residence_id)
    || normalizeText(familyInfo?.id)
);

export const resolveCurrentUserAuthRole = (familyInfo, accountId) => {
  const targetId = normalizeText(accountId).toLowerCase();
  if (!targetId) return '';
  const match = getFamilyMembers(familyInfo).find((member) => normalizeText(member?.account_id).toLowerCase() === targetId);
  return normalizeText(match?.auth);
};

export const getMemberDisplayName = (member = {}) => {
  const fullName = `${normalizeText(member?.first_name)} ${normalizeText(member?.last_name)}`.trim();
  return fullName || normalizeText(member?.account_name) || normalizeText(member?.email) || 'Family member';
};

export const getInitials = (name = '') => {
  const parts = normalizeText(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const getAuthRoleLabel = (auth) => {
  const role = normalizeText(auth).toLowerCase();
  if (role === 'admin') return 'Admin';
  if (role === 'user') return 'Member';
  if (role === 'guest') return 'Guest';
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Not available';
};

export const getUpstreamErrorMessage = (payload, fallback) => (
  payload?.message || payload?.error || payload?.detail
    || payload?.result?.message || payload?.result?.error || payload?.result?.detail
    || fallback
);
