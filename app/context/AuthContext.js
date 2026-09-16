import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const BACKEND_URL = "https://one-development.soniciot.com";
export const LAN_BASE_URL = "http://192.168.2.115/api/v1.0";
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 3600;

// General Wan Account (Strictly for Registration)
const GENERAL_USERNAME = "fayis@sonictech.ae";
const GENERAL_PASSWORD = "Fayis@123";
const CLIENT_ID = "ccf1ac952146b11f0904c02dd80f92105";
const CLIENT_SECRET = "scf1ac95d146b11f0904c02dd80f92105";

const createAuthError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const safeParseJson = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch (_) {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [lanToken, setLanToken] = useState(null);
  const [wanToken, setWanToken] = useState(null);
  const [userCredentials, setUserCredentials] = useState(null);
  const [residenceId, setResidenceId] = useState(null);
  const [authRole, setAuthRole] = useState(null);
  const [networkMode, setNetworkMode] = useState('WAN');
  const [isInitializing, setIsInitializing] = useState(true);
  const lanTokenRef = useRef(null);
  const wanTokenRef = useRef(null);
  const credentialsRef = useRef(null);
  const lanTokenRequestRef = useRef(null);
  const wanTokenRequestRef = useRef(null);

  lanTokenRef.current = lanToken;
  wanTokenRef.current = wanToken;
  credentialsRef.current = userCredentials;

  useEffect(() => {
    const checkPersistedAuth = async () => {
      try {
        const storedMode = await AsyncStorage.getItem('networkMode') || 'WAN';
        // Manage the currently active session explicitly
        const activeEmail = await AsyncStorage.getItem('activeEmail');
        const activePassword = await AsyncStorage.getItem('activePassword');
        const activeResidenceId = await AsyncStorage.getItem('activeResidenceId');
        const activeAuthRole = await AsyncStorage.getItem('activeAuthRole');

        const storedLanToken = await AsyncStorage.getItem('lanToken');
        const storedWanToken = await AsyncStorage.getItem('wanToken');
        setLanToken(storedLanToken);
        setWanToken(storedWanToken);
        setNetworkMode(storedMode);
        
        if (activeEmail && activePassword) {
          setUserCredentials({ email: activeEmail, password: activePassword });
        }
        setResidenceId(activeResidenceId);
        setAuthRole(activeAuthRole);
      } catch (e) {
        console.error("Failed to load auth state", e);
      } finally {
        setIsInitializing(false);
      }
    };
    checkPersistedAuth();
  }, []);

  const fetchWanToken = useCallback(async (email, password) => {
    const AUTH_URL = "https://api.ecloud.akubela.com/api/v1.0/invoke/open-ability/method/oauth2/token";
    const body = "username=" + encodeURIComponent(email) +
      "&password=" + encodeURIComponent(password) +
      "&grant_type=password&client_id=" + encodeURIComponent(CLIENT_ID) +
      "&client_secret=" + encodeURIComponent(CLIENT_SECRET) +
      `&scope=user&expires_in=${ACCESS_TOKEN_EXPIRES_IN_SECONDS}`;

    let response;
    try {
      response = await fetch(AUTH_URL, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (error) {
      throw createAuthError("Ensure you have stable internet connection and try again.", 'WAN_UNREACHABLE');
    }

    const text = await response.text();
    const data = safeParseJson(text);
    if (!response.ok || !data?.success) {
      // AkuBela answers a rejected grant with HTTP 200 and `success: false`, so
      // the status code alone can't explain a failure — log its actual code and
      // message. The password is never included; on failure there is no token.
      console.warn(
        '[AuthContext] AkuBela token grant rejected for', email,
        'http=' + response.status,
        'code=' + (data?.result?.code ?? data?.code ?? 'n/a'),
        'message=' + (data?.result?.message ?? data?.message ?? text?.slice(0, 200))
      );
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw createAuthError("Invalid username or password.", 'INVALID_CREDENTIALS');
      }
      throw createAuthError("Your account is not yet active on the cloud. Please contact support.", 'WAN_TOKEN_FAILED');
    }

    return data.result.access_token;
  }, []);

  const fetchLanToken = useCallback(async (email, password) => {
    const AUTH_URL = LAN_BASE_URL + "/auth";
    const body = "username=" + encodeURIComponent(email) +
      "&password=" + encodeURIComponent(password) +
      `&grant_type=password&expires_in=${ACCESS_TOKEN_EXPIRES_IN_SECONDS}`;

    let response;
    try {
      response = await fetch(AUTH_URL, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (error) {
      console.warn('[AuthContext] LAN auth fetch failed:', AUTH_URL, error?.message || error);
      throw createAuthError("Unable to sign in offline. Ensure you are connected to home Wi-Fi.", 'LAN_UNREACHABLE');
    }

    const text = await response.text();
    const data = safeParseJson(text);
    if (!response.ok || !data?.success) {
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw createAuthError("Invalid username or password.", 'INVALID_CREDENTIALS');
      }
      throw createAuthError("Unable to sign in offline right now. Please try again.", 'LAN_TOKEN_FAILED');
    }

    return data.result.access_token;
  }, []);

  const persistSession = async (email, password, mode, activeResidenceId = null, activeAuthRole = null) => {
    setUserCredentials({ email, password });
    setNetworkMode(mode);
    setResidenceId(activeResidenceId);
    setAuthRole(activeAuthRole);
    await AsyncStorage.setItem('activeEmail', email);
    await AsyncStorage.setItem('activePassword', password);
    await AsyncStorage.setItem('networkMode', mode);
    if (activeResidenceId) {
      await AsyncStorage.setItem('activeResidenceId', activeResidenceId);
    } else {
      await AsyncStorage.removeItem('activeResidenceId');
    }
    if (activeAuthRole) {
      await AsyncStorage.setItem('activeAuthRole', activeAuthRole);
    } else {
      await AsyncStorage.removeItem('activeAuthRole');
    }
  };

  const cacheOfflineUser = async (email, password) => {
    const usersStr = await AsyncStorage.getItem('savedOfflineUsers');
    let offlineUsers = {};
    try { offlineUsers = usersStr ? JSON.parse(usersStr) : {}; } catch (e) {}

    offlineUsers[email] = password;
    await AsyncStorage.setItem('savedOfflineUsers', JSON.stringify(offlineUsers));
  };

  const updateStoredPassword = async (password, emailOverride = null) => {
    const email = emailOverride || userCredentials?.email || await AsyncStorage.getItem('activeEmail');
    setUserCredentials((currentCredentials) => (
      currentCredentials ? { ...currentCredentials, password } : currentCredentials
    ));
    await AsyncStorage.setItem('activePassword', password);
    if (email) {
      await cacheOfflineUser(email, password);
    }
  };

  /** Dynamically grabs from cache instantly, or fetches from Network exactly 1 time! */
  const getActiveLanToken = useCallback(async () => {
    if (lanTokenRef.current) return lanTokenRef.current;
    if (!credentialsRef.current) throw new Error("No offline credentials available.");
    if (!lanTokenRequestRef.current) {
      lanTokenRequestRef.current = fetchLanToken(credentialsRef.current.email, credentialsRef.current.password)
        .then(async (token) => {
          setLanToken(token);
          await AsyncStorage.setItem('lanToken', token);
          return token;
        })
        .finally(() => { lanTokenRequestRef.current = null; });
    }
    return lanTokenRequestRef.current;
  }, [fetchLanToken]);

  const getActiveWanToken = useCallback(async () => {
    if (wanTokenRef.current) return wanTokenRef.current;
    if (!credentialsRef.current) throw new Error("No offline credentials available.");
    if (!wanTokenRequestRef.current) {
      wanTokenRequestRef.current = fetchWanToken(credentialsRef.current.email, credentialsRef.current.password)
        .then(async (token) => {
          setWanToken(token);
          await AsyncStorage.setItem('wanToken', token);
          return token;
        })
        .finally(() => { wanTokenRequestRef.current = null; });
    }
    return wanTokenRequestRef.current;
  }, [fetchWanToken]);

  const loginWan = async (email, password) => {
    let response;
    try {
      response = await fetch(`${BACKEND_URL}/api/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
    } catch (error) {
      throw createAuthError("Ensure you have stable internet connection and try again.", 'BACKEND_UNREACHABLE');
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw createAuthError("Invalid username or password.", 'INVALID_CREDENTIALS');
    }

    if (!response.ok) {
      // Distinct wording from the AkuBela failure above, so the alert alone says
      // which of the two sign-in steps actually broke.
      const detail = await response.text().catch(() => '');
      console.warn('[AuthContext] backend /api/login/ failed http=' + response.status, detail?.slice(0, 200));
      throw createAuthError("Sign in service is unavailable right now. Please try again.", 'BACKEND_LOGIN_FAILED');
    }

    const loginData = await response.json().catch(() => ({}));
    const wToken = await fetchWanToken(email, password);
    setWanToken(wToken);
    setLanToken(null);
    await AsyncStorage.setItem('wanToken', wToken);
    await AsyncStorage.removeItem('lanToken');
    await persistSession(email, password, 'WAN', loginData?.residence_id || null, loginData?.auth || null);
    await cacheOfflineUser(email, password);

    return { success: true, mode: 'WAN' };
  };

  const loginLan = async (email, password) => {
    const lToken = await fetchLanToken(email, password);
    setLanToken(lToken);
    setWanToken(null);
    await AsyncStorage.setItem('lanToken', lToken);
    await AsyncStorage.removeItem('wanToken');
    await persistSession(email, password, 'LAN');
    await cacheOfflineUser(email, password);

    return { success: true, mode: 'LAN' };
  };

  const generateGeneralWanToken = async () => fetchWanToken(GENERAL_USERNAME, GENERAL_PASSWORD);

  const logout = async () => {
    setLanToken(null);
    setWanToken(null);
    setUserCredentials(null);
    setResidenceId(null);
    setAuthRole(null);
    setNetworkMode('WAN');
    // Important: We purposefully DO NOT wipe 'savedOfflineUsers' here so that multiple users can log back offline! 
    await AsyncStorage.multiRemove(['lanToken', 'wanToken', 'networkMode', 'activeEmail', 'activePassword', 'activeResidenceId', 'activeAuthRole']);
  };

  return (
    <AuthContext.Provider value={{ 
      lanToken, wanToken, getActiveLanToken, getActiveWanToken,
      networkMode, residenceId, authRole, isInitializing, loginLan, loginWan, logout, generateGeneralWanToken, updateStoredPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
