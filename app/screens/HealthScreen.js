import React, { useState, useEffect, useContext, useCallback } from "react";
import { View, Text, Alert, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar } from "react-native";
import axios from "axios";
import { Linking } from "react-native";
import storage from "../etc/Whoop/storage";
import LinearGradient from "react-native-linear-gradient";
import Entypo from 'react-native-vector-icons/Entypo';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';
import useColors from "../hooks/useColors";
import UploadScreen from "./UploadScreen";
import UserProfileModal from "../components/Home/Whoop/UserProfileModal";
import RecoveryCircle from "../components/Home/Whoop/RecoveryCircle";
import { EXPO_WHOOP_CLIENT_ID, EXPO_WHOOP_CLIENT_SECRET } from '@env';

const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v1";
const discovery = {
  authorizationEndpoint: "https://api.prod.whoop.com/oauth/oauth2/auth",
  tokenEndpoint: "https://api.prod.whoop.com/oauth/oauth2/token",
};

const REDIRECT_URI = "one-demo-app://oauth/callback";

const DataCard = ({ title, children, style }) => (
  <View style={[styles.card, style]}>
    <Text style={styles.title}>{title}</Text>
    {children}
  </View>
);

const DataText = ({ label, value, color }) => (
  <Text style={[styles.body, color && { color }]}>
    {label}: {value}
  </Text>
);

const DataInfo = ({ title, value, style }) => (
  <View style={[styles.infoCard, style,{flexDirection:'row',justifyContent:'space-between', alignItems:'center'}]}>
    <Text style={styles.infoTitle}>{title}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const UserInfo = (user) => {
  console.log('PROFILE',user?.profile)
    return (
        <DataCard title="User Profile">
        <DataText 
          label="Name" 
          value={`${user?.profile?.first_name} ${user?.profile?.last_name}`}
          // color='black'
        />
        <DataText 
          label="Email" 
          value={user?.profile?.email}
          // color="black"
          />
      </DataCard>
    );
  };

const HealthScreen = ({ navigation }) => {
   const colors = useColors();
  const [whoopData, setWhoopData] = useState({
    profile: null,
    sleep: null,
    recovery: null,
    cycle: null
  });
  const [tokenHistory, setTokenHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [isModalOpen, setIsModalOpen]=useState(false)
  const [sleepTokenHistory, setSleepTokenHistory] = useState([]);

  // OAuth Request Configuration
  const handleOAuthLogin = async () => {
    // Without .env credentials the auth URL would carry client_id=undefined and
    // fail on WHOOP's side with an opaque error, so say what's actually wrong.
    if (!EXPO_WHOOP_CLIENT_ID || !EXPO_WHOOP_CLIENT_SECRET) {
      Alert.alert(
        'Preview only',
        'WHOOP integration is not configured in this build. Add EXPO_WHOOP_CLIENT_ID and EXPO_WHOOP_CLIENT_SECRET to a .env file to enable it.'
      );
      return;
    }

    const authUrl = `${discovery.authorizationEndpoint}?client_id=${EXPO_WHOOP_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent("read:recovery read:cycles read:workout read:sleep read:profile offline")}&state=onedevelopment`;
    try {
      await Linking.openURL(authUrl);
    } catch (error) {
      console.error("Error opening OAuth URL:", error);
      Alert.alert("Error", "Failed to open the WHOOP login page. Make sure a browser is installed.");
    }
  };


  // Load Access Token on Mount
  useEffect(() => {
    loadWhoopAccessToken();
  }, []);

  const loadWhoopAccessToken = async () => {
    try {
      const token = await storage.getAccessToken();
      console.log("Loaded access token:", token ? "present" : "none");
      setAccessToken(token);
    } catch (error) {
      console.error("Error loading access token:", error);
    }
  };

  // Handle OAuth Response via deep linking
  useEffect(() => {
    const parseCode = (url) => {
      const match = url && url.match(/[?&]code=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    };

    const handleUrl = ({ url }) => {
      if (url && url.startsWith('one-demo-app://oauth/callback')) {
        const code = parseCode(url);
        if (code) exchangeCodeForToken(code);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Handle case where app was cold-started via the OAuth redirect
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('one-demo-app://oauth/callback')) {
        const code = parseCode(url);
        if (code) exchangeCodeForToken(code);
      }
    });

    return () => subscription.remove();
  }, []);

  const exchangeCodeForToken = async (authCode) => {
    try {
      const res = await axios.post(
        discovery.tokenEndpoint,
        {
          client_id: EXPO_WHOOP_CLIENT_ID,
          client_secret: EXPO_WHOOP_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
          code: authCode,
        },
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      await storage.storeToken({
        access: res.data.access_token,
        refresh: res.data.refresh_token
      });
      setAccessToken(res.data.access_token);
      
      Alert.alert("Success", "WHOOP Connected Successfully!");
      fetchAllWhoopData("today");
    } catch (error) {
      console.error("Error exchanging code for token:", error);
      Alert.alert("Error", "Failed to connect WHOOP.");
    }
  };

  const refreshAccessToken = async () => {
    const refreshToken = await storage.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await axios.post(
        discovery.tokenEndpoint,
        {
          client_id: EXPO_WHOOP_CLIENT_ID,
          client_secret: EXPO_WHOOP_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        },
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      await storage.storeToken({
        access: res.data.access_token,
        refresh: res.data.refresh_token
      });
      setAccessToken(res.data.access_token);
      return res.data.access_token;
    } catch (error) {
      console.error("Error refreshing token:", error);
      return null;
    }
  };

  // Format Utilities
  const formatDate = useCallback((isoDate) => {
    return new Date(isoDate).toLocaleString();
  }, []);

  const formatMilliseconds = useCallback((milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }, []);

  const getRecoveryColor = useCallback((score) => {
    if (score >= 67) return "#16EC06";
    if (score >= 34) return "#FFDE00";
    return "#FF0026";
  }, []);

  const makeWhoopRequest = useCallback(async (endpoint) => {
    let token = await storage.getAccessToken();
    if (!token) {
      console.log("No access token found");
      return null;
    }

    try {
      const response = await axios.get(`${WHOOP_API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        token = await refreshAccessToken();
        if (!token) {
          // Alert.alert("Session Expired", "Please log in again.");
          return null;
        }
        try {
          const retryResponse = await axios.get(`${WHOOP_API_BASE}${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          return retryResponse.data;
        } catch (retryError) {
          console.error("Error retrying WHOOP request:", retryError);
          return null;
        }
      }
      console.error("Error making WHOOP request:", error);
      return null;
    }
  }, []);

  // Fetch WHOOP Data
  const fetchAllWhoopData = useCallback(async (direction) => {
    setLoading(true);
    try {
      let tokenParam = "";
      let sleepTokenParam = "";
      let newIndex = currentIndex;
  
      if (direction === "previous") {
        tokenParam = tokenHistory[newIndex] ? `&nextToken=${tokenHistory[newIndex]}` : "";
        sleepTokenParam = sleepTokenHistory[newIndex] ? `&nextToken=${sleepTokenHistory[newIndex]}` : "";
        newIndex = currentIndex + 1;
      } else if (direction === "next") {
        newIndex = Math.max(0, currentIndex - 1);
        tokenParam = newIndex > 0 && tokenHistory[newIndex - 1] ? `&nextToken=${tokenHistory[newIndex - 1]}` : "";
        sleepTokenParam = newIndex > 0 && sleepTokenHistory[newIndex - 1] ? `&nextToken=${sleepTokenHistory[newIndex - 1]}` : "";
      } else {
        newIndex = 0;
        setTokenHistory([]);
        setSleepTokenHistory([]);
      }
  
      // Fetch sleep, recovery, and cycle data
      const [sleepData, recoveryData, cycleData, profileData] = await Promise.all([
        makeWhoopRequest(`/activity/sleep?limit=1${sleepTokenParam}`),
        makeWhoopRequest(`/recovery?limit=1${tokenParam}`),
        makeWhoopRequest(`/cycle?limit=1${tokenParam}`),
        makeWhoopRequest("/user/profile/basic")
      ]);
  
      let finalSleepData = sleepData?.records?.[0];
      let newSleepToken = sleepData?.next_token;
      let newCycleToken = cycleData?.next_token;
  
      console.log('tokenParam',tokenParam)
      console.log('cycle data', cycleData)
      // If sleep is a nap, fetch the next sleep data
      if (finalSleepData?.nap) {
        console.log("Nap detected, fetching next sleep record...");
        const nextSleepData = await makeWhoopRequest(`/activity/sleep?limit=1&nextToken=${newSleepToken}`);
        if (nextSleepData?.records?.length > 0) {
          finalSleepData = nextSleepData.records[0]; // Use the new sleep data
          newSleepToken = nextSleepData.next_token; // Save new sleep token
        }
      }
  
      // Store next_token properly for cycle/recovery
      if (direction === "previous" && newCycleToken) {
        setTokenHistory((prev) => [...prev.slice(0, newIndex), newCycleToken]);
      }
      if (direction === "today" && newCycleToken) {
        setTokenHistory([newCycleToken]);
      }
  
      // Store next sleep token separately
      if (direction === "previous" && newSleepToken) {
        setSleepTokenHistory((prev) => [...prev.slice(0, newIndex), newSleepToken]);
      }
      if (direction === "today" && newSleepToken) {
        setSleepTokenHistory([newSleepToken]);
      }
  
      setCurrentIndex(newIndex);
      setWhoopData({
        profile: profileData,
        sleep: finalSleepData,
        recovery: recoveryData?.records?.[0],
        cycle: cycleData?.records?.[0]
      });
    } catch (error) {
      console.error("Error fetching WHOOP data:", error);
      Alert.alert("Error", "Failed to fetch WHOOP data");
    } finally {
      setLoading(false);
    }
  }, [currentIndex, tokenHistory, sleepTokenHistory, makeWhoopRequest]);  

  // Load Data When Access Token Changes
  useEffect(() => {
    if (accessToken) {
      fetchAllWhoopData("today");
    }
  }, [accessToken]);

  const handleRemoveToken = async () => {
    await storage.removeToken();
    setIsModalOpen(false)
    setAccessToken(null);
    setWhoopData({
      profile: null,
      sleep: null,
      recovery: null,
      cycle: null
    });
  };

const openWhoopProfileModal=()=>{
    setIsModalOpen(true)
}

  return (
    <>
    <LinearGradient colors={["#283339", "#101518"]} style={styles.gradient}>
    <StatusBar barStyle={"light-content"}/>
      <UploadScreen visible={loading} />
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backButton, {
          left: '2.5%',
          right: null,
        }]}
      >
        <Entypo
          name={'chevron-left'}
          size={32}
          color="#101518"
        />
      </TouchableOpacity>

      {accessToken && (   
        <TouchableOpacity
        onPress={() => openWhoopProfileModal()}
        style={[styles.backButton, {
          right: '2.5%',
          left:  null,
        }]}
      >
        <AntDesign
          name={'user'}
          size={26}
          color="#101518"
        />
      </TouchableOpacity>
      )}

  {!accessToken && (
          <View style={styles.connectContainer}>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>Preview</Text>
            </View>
            <Image
              source={require('../assets/whoop-logo-white.png')}
              style={styles.connectLogo}
            />
            <Text style={styles.previewNote}>
              Wearable health tracking is a preview of a planned integration and
              is not connected in this build.
            </Text>
            <TouchableOpacity style={styles.connectButton} onPress={handleOAuthLogin}>
              <Text style={styles.connectButtonText}>Connect to WHOOP</Text>
            </TouchableOpacity>
          </View>
        )}

     {accessToken && ( 
      <ScrollView contentContainerStyle={styles.container}>
        {/* <Text style={styles.header}>
          {accessToken ? "WHOOP Connected ✅" : "Connect WHOOP to Sync Data"}
        </Text> */}
          <>
            {/* <View style={styles.navigationControls}>
              <TouchableOpacity 
                style={styles.navButton}
                onPress={() => fetchAllWhoopData("previous")}
              >
                <Text style={styles.navButtonText}>Previous Day</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                onPress={() => fetchAllWhoopData("next")}
                disabled={currentIndex === 0}
              >
                <Text style={styles.navButtonText}>Next Day</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.navButton, styles.todayButton,{opacity:currentIndex === 0?0.5:1}]}
                onPress={() => fetchAllWhoopData("today")}
                disabled={currentIndex === 0}
              >
                <Text style={styles.navButtonText}>Today</Text>
              </TouchableOpacity>
            </View> */}

<View style={styles.navigationControls}>
      {/* Previous Button */}
      <TouchableOpacity
        style={styles.navArrowButton}
        onPress={() => fetchAllWhoopData("previous")}
      >
        <Ionicons name="chevron-back" size={18} color="white" />
      </TouchableOpacity>

      {/* Today Button */}
      <TouchableOpacity
        style={[styles.todayButton, currentIndex === 0 && styles.navButtonDisabled]}
        onPress={() => fetchAllWhoopData("today")}
        disabled={currentIndex === 0}
      >
        <Text style={styles.navButtonText}>TODAY</Text>
      </TouchableOpacity>

      {/* Next Button */}
      <TouchableOpacity
        style={[styles.navArrowButton, currentIndex === 0 && styles.navButtonDisabled]}
        onPress={() => fetchAllWhoopData("next")}
        disabled={currentIndex === 0}
      >
        <Ionicons name="chevron-forward" size={18} color="white" />
      </TouchableOpacity>
    </View>

            {/* <Button title="Disconnect WHOOP" onPress={handleRemoveToken} color="red" /> */}

            {/* Profile Card */}
            {/* {whoopData.profile && (
              <DataCard title="User Profile">
                <DataText 
                  label="Name" 
                  value={`${whoopData.profile.first_name} ${whoopData.profile.last_name}`}
                />
                <DataText label="Email" value={whoopData.profile.email} />
              </DataCard>
            )} */}

{whoopData.recovery && (
  <View style={{ alignItems: "center", marginVertical: 10 }}>
  <RecoveryCircle 
    score={whoopData.recovery.score.recovery_score} 
    size={100} 
    strokeWidth={8}
    centerImageSource={require('../assets/w-whoop-logo-white.png')}
    centerImageWidth={35}      // Optional: override default width
    centerImageHeight={25}     // Optional: override default height
    topLeftText={`${whoopData.recovery.score.recovery_score}%`}
    topLeftLabel="RECOVERY"
    topRightText={`${whoopData.cycle.score.strain.toFixed(1)}`}
    topRightLabel="STRAIN"
    bottomLeftText={`${whoopData.recovery.score.hrv_rmssd_milli.toFixed(0)}`}
    bottomLeftLabel="HRV"
    bottomRightText={`${whoopData.sleep.score.sleep_performance_percentage}%`}
    bottomRightLabel="SLEEP"
    textColor="#fff"
  />
</View>
)}

{whoopData.sleep && (
<>
<View style={[styles.infoCard,{flexDirection:'row',justifyContent:'space-between', alignItems:'center'}]}>
    <Text style={styles.infoTitle}>Sleep</Text>
    <View style={{justifyContent:'center',alignItems:'flex-end'}}>
    <Text style={[styles.infoValue,{fontSize:12}]}>{formatDate(whoopData.sleep.start)}</Text>
    <Text style={[styles.infoValue,{fontSize:12}]}>{formatDate(whoopData.sleep.end)}</Text>
    </View>
  </View>

                {whoopData.sleep.score && (
                  <>
                    <DataInfo 
                      title="Time in Bed" 
                      value={formatMilliseconds(whoopData.sleep.score.stage_summary.total_in_bed_time_milli)}
                    />
                    <DataInfo 
                      title="Sleep Debt" 
                      value={formatMilliseconds(whoopData.sleep.score.sleep_needed.need_from_sleep_debt_milli)}
                    />
                    <DataInfo 
                      title="Respiratory Rate" 
                      value={`${whoopData.sleep.score.respiratory_rate.toFixed(1)} bpm`}
                    />
                    <DataInfo 
                      title="Sleep Consistency" 
                      value={`${whoopData.sleep.score.sleep_consistency_percentage}%`}
                    />
                    <DataInfo 
                      title="Sleep Efficiency" 
                      value={`${whoopData.sleep.score.sleep_efficiency_percentage.toFixed(0)}%`}
                    />
                  </>
                )}
                </>
                )}

            {/* Sleep Card */}
            {/* {whoopData.sleep && (
              <DataCard title="Sleep">
                <DataText label="Start" value={formatDate(whoopData.sleep.start)} />
                <DataText label="End" value={formatDate(whoopData.sleep.end)} />
                <DataText label="Score" value={whoopData.sleep.score_state} />

                {whoopData.sleep.score && (
                  <>
                    <Text style={styles.sleepSubtitle}>Sleep Stages</Text>
                    <DataText 
                      label="Total Time in Bed" 
                      value={formatMilliseconds(whoopData.sleep.score.stage_summary.total_in_bed_time_milli)}
                    />
                    <DataText 
                      label="Total Awake Time" 
                      value={formatMilliseconds(whoopData.sleep.score.stage_summary.total_awake_time_milli)}
                    />
                    <DataText 
                      label="Light Sleep" 
                      value={formatMilliseconds(whoopData.sleep.score.stage_summary.total_light_sleep_time_milli)}
                    />
                    <DataText 
                      label="Deep Sleep" 
                      value={formatMilliseconds(whoopData.sleep.score.stage_summary.total_slow_wave_sleep_time_milli)}
                    />
                    <DataText 
                      label="REM Sleep" 
                      value={formatMilliseconds(whoopData.sleep.score.stage_summary.total_rem_sleep_time_milli)}
                    />
                    <DataText 
                      label="Sleep Cycles" 
                      value={whoopData.sleep.score.stage_summary.sleep_cycle_count}
                    />
                    <DataText 
                      label="Disturbances" 
                      value={whoopData.sleep.score.stage_summary.disturbance_count}
                    />

                    <Text style={styles.sleepSubtitle}>Sleep Needed</Text>
                    <DataText 
                      label="Baseline Need" 
                      value={formatMilliseconds(whoopData.sleep.score.sleep_needed.baseline_milli)}
                    />
                    <DataText 
                      label="Need from Sleep Debt" 
                      value={formatMilliseconds(whoopData.sleep.score.sleep_needed.need_from_sleep_debt_milli)}
                    />
                    <DataText 
                      label="Need from Strain" 
                      value={formatMilliseconds(whoopData.sleep.score.sleep_needed.need_from_recent_strain_milli)}
                    />

                    <Text style={styles.sleepSubtitle}>Other Metrics</Text>
                    <DataText 
                      label="Respiratory Rate" 
                      value={`${whoopData.sleep.score.respiratory_rate} bpm`}
                    />
                    <DataText 
                      label="Sleep Performance" 
                      value={`${whoopData.sleep.score.sleep_performance_percentage}%`}
                    />
                    <DataText 
                      label="Sleep Consistency" 
                      value={`${whoopData.sleep.score.sleep_consistency_percentage}%`}
                    />
                    <DataText 
                      label="Sleep Efficiency" 
                      value={`${whoopData.sleep.score.sleep_efficiency_percentage}%`}
                    />
                  </>
                )}
              </DataCard>
            )} */}

            {/* Recovery Card */}

            {whoopData.recovery && (
                whoopData.recovery.score && (
                  <>
                    <DataInfo 
                      title="Resting Heart Rate" 
                      value={`${whoopData.recovery.score.resting_heart_rate.toFixed(0)} bpm`}
                    />
                    <DataInfo 
                      title="Heart Rate Variability" 
                      value={`${whoopData.recovery.score.hrv_rmssd_milli.toFixed(0)} ms`}
                    />
                    <DataInfo 
                      title="Skin Temp" 
                      value={`${whoopData.recovery.score.skin_temp_celsius.toFixed(1)}°C`}
                    />
                    <DataInfo 
                      title="Blood Oxygen" 
                      value={`${whoopData.recovery.score.spo2_percentage.toFixed(1)}%`}
                    />
                  </>
                ))}

            {/* {whoopData.recovery && (
              <DataCard title="Recovery">
                <DataText label="Cycle ID" value={whoopData.recovery.cycle_id} />
                <DataText label="Score" value={whoopData.recovery.score_state} />
                
                {whoopData.recovery.score && (
                  <>
                    <Text style={styles.recoverySubtitle}>Recovery Score</Text>
                    <DataText 
                      label="Recovery Score" 
                      value={`${whoopData.recovery.score.recovery_score}%`}
                      color={getRecoveryColor(whoopData.recovery.score.recovery_score)}
                    />
                    <DataText 
                      label="Resting Heart Rate" 
                      value={`${whoopData.recovery.score.resting_heart_rate} bpm`}
                    />
                    <DataText 
                      label="HRV (RMSSD)" 
                      value={`${whoopData.recovery.score.hrv_rmssd_milli} ms`}
                    />
                    <DataText 
                      label="SPO2" 
                      value={`${whoopData.recovery.score.spo2_percentage}%`}
                    />
                    <DataText 
                      label="Skin Temp" 
                      value={`${whoopData.recovery.score.skin_temp_celsius}°C`}
                    />
                  </>
                )}
              </DataCard>
            )} */}

            {/* Cycle Card */}

            {whoopData.cycle && (
                whoopData.cycle.score && (
                  <>
                    <DataInfo 
                      title="Max Heart Rate" 
                      value={`${whoopData.cycle.score.max_heart_rate.toFixed(0)} ms`}
                    />
                    <DataInfo 
                      title="Average Heart Rate" 
                      value={`${whoopData.cycle.score.average_heart_rate.toFixed(0)} ms`}
                    />
                  </>
                ))}

            {/* {whoopData.cycle && (
              <DataCard title="Cycle Data">
                <DataText label="Start" value={formatDate(whoopData.cycle.start)} />
                {whoopData.cycle.end !== null ? (
                  <DataText label="End" value={formatDate(whoopData.cycle.end)} />
                ) : (
                  <DataText label="Status" value="Cycle In-Progress" />
                )}
                <DataText label="Strain" value={whoopData.cycle.score.strain} />
                <DataText label="Max Heart Rate" value={whoopData.cycle.score.max_heart_rate} />
                <DataText label="Average Heart Rate" value={whoopData.cycle.score.average_heart_rate} />
                <DataText label="Score" value={whoopData.cycle.score_state} />
              </DataCard>
            )} */}
          </>
        <Image
          source={require('../assets/whoop-logo-white.png')}
          style={styles.logo}
        />
      </ScrollView> 
    )}
    </LinearGradient>
    
    {isModalOpen&&
    <UserProfileModal 
        modalVisible={isModalOpen} 
        setModalVisible={setIsModalOpen}
        WhoopUserData={
        <>
        <View style={{justifyContent:'center', alignItems:'center'}}>
        <UserInfo profile={whoopData.profile}/>
        <Button title="Disconnect WHOOP" onPress={handleRemoveToken} color="red" />
        </View>
        </>}
    />}
    </>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    padding: 20,
    alignItems: "center",
    marginTop: 80,
    paddingBottom: 100
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  backButton: {
    zIndex: 10,
    width: 50,
    height: 50,
    backgroundColor: 'white',
    position: 'absolute',
    top: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 2,
    shadowOpacity: 0.1,
    elevation: 3,
  },
//   navigationControls: {
//     flexDirection: 'row',
//     gap: 10,
//     marginVertical: 10,
//   },
  navButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
color: 'white',
  fontSize: 14,
},
todayButton: {
  backgroundColor: 'rgba(255, 165, 0, 0.3)',
},
card: {
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  padding: 15,
  borderRadius: 10,
  width: "90%",
  marginVertical: 10,
},
title: {
  fontSize: 18,
  fontWeight: "bold",
  color: "white",
  marginBottom: 10,
},
subtitle: {
  fontSize: 16,
  fontWeight: "bold",
  color: "#7BA1BB",
  marginTop: 10,
  marginBottom: 5,
},
body: {
  fontSize: 14,
  color: "white",
  marginBottom: 5,
},
logo: {
  width: 200,
  resizeMode: 'contain',
  marginTop: 20,
},
sleepSubtitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#7BA1BB",
    marginTop: 10,
    marginBottom: 5,
  },
  recoverySubtitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#67AEE6",
    marginTop: 10,
    marginBottom: 5,
  },
  navigationControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor: "#121212", // Dark background (optional)
    paddingVertical: 10,
  },
  navArrowButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: "#333", // Dark gray background
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  todayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#444", // Slightly lighter than arrow buttons
    borderRadius: 20,
    paddingHorizontal: 25,
    paddingVertical: 10,
  },
  infoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 15,
    borderRadius: 10,
    width: "90%",
    marginVertical: 10,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
    // marginBottom: 10,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    // marginBottom: 10,
  },
  connectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  connectLogo: {
    width: 220,
    resizeMode: 'contain',
    marginBottom: 24,
  },
  previewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(50,210,214,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(50,210,214,0.4)',
    marginBottom: 28,
  },
  previewBadgeText: {
    color: '#32d2d6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  previewNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 36,
  },
  connectButton: {
    backgroundColor: '#32d2d6',
    paddingHorizontal: 44,
    paddingVertical: 16,
    borderRadius: 30,
  },
  connectButtonText: {
    color: '#101518',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default HealthScreen;