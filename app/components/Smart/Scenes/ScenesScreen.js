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
import { useAuth } from '../../../context/AuthContext';
import Screen from '../../Screen';
import { MOCKUP_OPTIONS } from '../SmartScreenSections/SmartScreen.constants';
import {
  buildSceneInfoRequest,
  extractSceneDetailPayload,
  getSceneId,
  resolveSceneUserDetails,
} from './sceneUtils';

const LAN_SCENE_URL = 'http://192.168.2.115/api/v1.0/scene';
const WAN_SCENE_URL = 'https://one-development.soniciot.com/get-scene-list/';
const LAN_REQUEST_ID = '9f79e8baf8464f0d9a57f8fbc57d5d0f';
const WAN_REQUEST_ID = 'c45e846ca23ab42c9ae469d988ae32a96';
const RESIDENCE_IDS = {
  [MOCKUP_OPTIONS.MOCKUP_1]: 'r45844047053e43d78fe5272c5badbd3a',
  [MOCKUP_OPTIONS.MOCKUP_2]: 'rabd2c6d2aecc4ce3be11e25b4ecd3c82',
};

const getSceneArray = (payload) => {
  const result = payload?.result;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.scenes)) return result.scenes;
  if (Array.isArray(result?.scene_list)) return result.scene_list;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(payload?.scenes)) return payload.scenes;
  if (Array.isArray(payload?.scene_list)) return payload.scene_list;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getSceneName = (scene, index) => {
  if (typeof scene === 'string') return scene;
  return scene?.name || scene?.scene_name || scene?.title || `Scene ${index + 1}`;
};

export default function ScenesScreen({ route, navigation }) {
  const params = route?.params || {};
  const selectedOption = String(params.selectedOption || 'WAN').toUpperCase() === 'LAN' ? 'LAN' : 'WAN';
  const selectedMockup = params.selectedMockup === MOCKUP_OPTIONS.MOCKUP_1
    ? MOCKUP_OPTIONS.MOCKUP_1
    : MOCKUP_OPTIONS.MOCKUP_2;
  const { getActiveLanToken, getActiveWanToken } = useAuth();
  const [scenes, setScenes] = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedSceneDetails, setSelectedSceneDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadSceneDetails = useCallback(async (scene) => {
    const sceneId = getSceneId(scene);
    if (!sceneId) {
      setSelectedSceneDetails(null);
      return;
    }

    const isLan = selectedOption === 'LAN';
    const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
    const requestBody = buildSceneInfoRequest({
      isLan,
      selectedMockup,
      sceneId,
      lanRequestId: LAN_REQUEST_ID,
      wanRequestId: WAN_REQUEST_ID,
      residenceIds: RESIDENCE_IDS,
    });

    try {
      setDetailLoading(true);
      const response = await fetch(isLan ? LAN_SCENE_URL : WAN_SCENE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();
      if (!response.ok) {
        const upstreamMessage = payload?.message || payload?.error || payload?.detail;
        throw new Error(upstreamMessage || `Unable to load scene details (${response.status})`);
      }

      const detailPayload = extractSceneDetailPayload(payload);
      setSelectedSceneDetails(detailPayload);
      setSelectedScene(scene);
    } catch (error) {
      console.error('[ScenesScreen] Failed to load scene details:', error);
      setSelectedSceneDetails(null);
      setSelectedScene(scene);
    } finally {
      setDetailLoading(false);
    }
  }, [getActiveLanToken, getActiveWanToken, selectedMockup, selectedOption]);

  const loadScenes = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const isLan = selectedOption === 'LAN';
      const token = isLan ? await getActiveLanToken() : await getActiveWanToken();
      const requestBody = {
        command: 'get_scene_list',
        id: isLan ? LAN_REQUEST_ID : WAN_REQUEST_ID,
        param: isLan ? {} : { residence_id: RESIDENCE_IDS[selectedMockup] },
      };
      let response;
      let payload;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch(isLan ? LAN_SCENE_URL : WAN_SCENE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });
        payload = await response.json();
        if (response.ok || response.status !== 504 || attempt === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      if (!response.ok) {
        const upstreamMessage = payload?.message || payload?.error || payload?.detail;
        throw new Error(upstreamMessage || `Unable to load scenes (${response.status})`);
      }
      setScenes(getSceneArray(payload));
    } catch (error) {
      console.error('[ScenesScreen] Failed to load scenes:', error);
      setScenes([]);
      setErrorMessage(error?.message || 'Unable to load scenes right now.');
    } finally {
      setLoading(false);
    }
  }, [getActiveLanToken, getActiveWanToken, selectedMockup, selectedOption]);

  useEffect(() => {
    loadScenes();
  }, [loadScenes]);

  return (
    <Screen style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadScenes} tintColor="#6f4bd8" />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <MaterialCommunityIcons name="arrow-left" size={24} color="#34225f" />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>Scenes</Text>
            <Text style={styles.subtitle}>{selectedOption} - {selectedMockup === MOCKUP_OPTIONS.MOCKUP_1 ? 'Mockup 1' : 'Mockup 2'}</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="play-box-multiple-outline" size={25} color="#6f4bd8" />
          </View>
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalIcon}>
            <MaterialCommunityIcons name="playlist-play" size={30} color="#6f4bd8" />
          </View>
          <View>
            <Text style={styles.totalLabel}>Total scenes</Text>
            {loading ? <ActivityIndicator size="small" color="#6f4bd8" /> : <Text style={styles.totalValue}>{scenes.length}</Text>}
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="cloud-alert" size={34} color="#c35b6f" />
            <Text style={styles.stateTitle}>Scenes unavailable</Text>
            <Text style={styles.stateMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadScenes}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : !loading && scenes.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="playlist-remove" size={34} color="#8b78b8" />
            <Text style={styles.stateTitle}>No scenes found</Text>
            <Text style={styles.stateMessage}>There are no scenes configured for this device set.</Text>
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {scenes.map((scene, index) => {
                const sceneId = getSceneId(scene);
                const isSelected = selectedScene && getSceneId(selectedScene) === sceneId;

                return (
                  <TouchableOpacity
                    key={sceneId || `${getSceneName(scene, index)}-${index}`}
                    style={[styles.sceneRow, isSelected && styles.sceneRowSelected]}
                    onPress={() => loadSceneDetails(scene)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sceneNumber}><Text style={styles.sceneNumberText}>{index + 1}</Text></View>
                    <Text style={styles.sceneName}>{getSceneName(scene, index)}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={22} color="#a28bcf" />
                  </TouchableOpacity>
                );
              })}
            </View>

            {detailLoading ? (
              <View style={styles.detailCard}>
                <ActivityIndicator size="small" color="#6f4bd8" />
                <Text style={styles.detailLoadingText}>Loading scene details...</Text>
              </View>
            ) : selectedScene ? (
              <View style={styles.detailCard}>
                {(() => {
                  const details = resolveSceneUserDetails(selectedSceneDetails || selectedScene, selectedMockup);

                  return (
                    <>
                      <View style={styles.detailHeaderRow}>
                        <View style={styles.detailBadge}>
                          <MaterialCommunityIcons name="play-box-multiple-outline" size={18} color="#6f4bd8" />
                        </View>
                        <Text style={styles.detailTitle}>Scene summary</Text>
                        <View style={styles.badgeGroup}>
                          {details.modes.map((mode) => (
                            <View key={mode} style={[styles.modeBadge, mode === 'Auto' ? styles.autoBadge : styles.manualBadge]}>
                              <Text style={styles.modeBadgeText}>{mode}</Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <Text style={styles.detailSceneName}>{details.name}</Text>
                      <Text style={styles.detailDescription}>{details.description}</Text>

                      <View style={styles.deviceSummaryCard}>
                        <Text style={styles.deviceSummaryLabel}>Trigger</Text>
                        {details.triggerDetails.map((text, idx) => (
                          <View key={`trigger-${text}-${idx}`} style={styles.devicePill}>
                            <MaterialCommunityIcons name="motion-sensor" size={15} color="#6f4bd8" />
                            <Text style={styles.devicePillText}>{text}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.conditionSummaryCard}>
                        <Text style={styles.conditionSummaryLabel}>Condition</Text>
                        {details.conditionDetails.map((text, idx) => (
                          <View key={`condition-${text}-${idx}`} style={styles.devicePill}>
                            <MaterialCommunityIcons name="filter-outline" size={15} color="#6f4bd8" />
                            <Text style={styles.devicePillText}>{text}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.actionSummaryCard}>
                        <Text style={styles.actionSummaryLabel}>Action</Text>
                        {details.actionDetails.map((text, idx) => (
                          <View key={`action-${text}-${idx}`} style={styles.devicePill}>
                            <MaterialCommunityIcons name="lightbulb-on-outline" size={15} color="#6f4bd8" />
                            <Text style={styles.devicePillText}>{text}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.actionSummaryCard}>
                        <Text style={styles.actionSummaryLabel}>Scene behavior</Text>
                        <Text style={styles.actionSummaryText}>{details.summaryText}</Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f8f6fc' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 18, paddingBottom: 72 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTextBlock: { flex: 1, marginLeft: 12 },
  title: { color: '#34225f', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#8975b5', fontSize: 13, fontWeight: '600', marginTop: 3 },
  headerIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center' },
  totalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 18, marginBottom: 18, shadowColor: '#6f4bd8', shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  totalIcon: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#f0eaff', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  totalLabel: { color: '#7c6a9e', fontSize: 13, fontWeight: '700' },
  totalValue: { color: '#34225f', fontSize: 30, fontWeight: '800', marginTop: 1 },
  list: { backgroundColor: '#ffffff', borderRadius: 18, paddingHorizontal: 16 },
  sceneRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0ebf8', paddingVertical: 10 },
  sceneRowSelected: { backgroundColor: '#f3edff', borderRadius: 12 },
  sceneNumber: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0eaff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sceneNumberText: { color: '#6f4bd8', fontSize: 14, fontWeight: '800' },
  sceneName: { flex: 1, color: '#443467', fontSize: 15, fontWeight: '700' },
  stateCard: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, padding: 28 },
  stateTitle: { color: '#443467', fontSize: 17, fontWeight: '800', marginTop: 10 },
  stateMessage: { color: '#8975a8', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  retryButton: { backgroundColor: '#6f4bd8', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  retryText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  detailCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, marginTop: 18 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' },
  detailBadge: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#efe6ff', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  detailTitle: { color: '#34225f', fontSize: 16, fontWeight: '800', flex: 1, minWidth: 100 },
  badgeGroup: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  modeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start', marginLeft: 6, marginBottom: 4 },
  autoBadge: { backgroundColor: '#e9f9ee' },
  manualBadge: { backgroundColor: '#f4edf9' },
  modeBadgeText: { color: '#34225f', fontSize: 11, fontWeight: '800' },
  detailSceneName: { color: '#34225f', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  detailDescription: { color: '#6e5f93', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  deviceSummaryCard: { backgroundColor: '#f8f4ff', borderRadius: 14, padding: 14, marginBottom: 12 },
  deviceSummaryLabel: { color: '#7c6a9e', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  conditionSummaryCard: { backgroundColor: '#f7f7ff', borderRadius: 14, padding: 14, marginBottom: 12 },
  conditionSummaryLabel: { color: '#7c6a9e', fontSize: 12, fontWeight: '800', marginBottom: 10 },
  devicePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  devicePillText: { color: '#443467', fontSize: 13, fontWeight: '700', marginLeft: 8 },
  actionSummaryCard: { backgroundColor: '#f5f8ff', borderRadius: 14, padding: 14 },
  actionSummaryLabel: { color: '#7c6a9e', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  actionSummaryText: { color: '#34225f', fontSize: 14, fontWeight: '700', lineHeight: 22 },
  detailLoadingText: { color: '#443467', fontSize: 13, fontWeight: '700', marginTop: 8 },
});
