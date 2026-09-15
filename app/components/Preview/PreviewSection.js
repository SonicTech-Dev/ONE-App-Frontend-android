import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Screen from '../Screen';
import PreviewTile from './PreviewTile';
import { useBottomSpacing } from '../../navigation/tabBarLayout';

/**
 * Shared shell for the preview-only sections (Shop, Services, Amenities).
 * These areas are design placeholders — the badge makes that explicit rather
 * than letting the tiles look like broken, unresponsive controls.
 */
const PreviewSection = ({ title, subtitle, items, children }) => {
  const bottomSpacing = useBottomSpacing();

  return (
  <Screen>
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomSpacing }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="flask-outline" size={12} color="#6f4bd8" />
            <Text style={styles.badgeText}>Preview</Text>
          </View>
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {children}

      <View style={styles.grid}>
        {items.map((item) => (
          <PreviewTile
            key={item.id}
            title={item.name}
            description={item.description}
            color={item.color}
            iconName={item.iconName}
            Icon={item.Icon}
          />
        ))}
        {/* Keeps a lone trailing card at half width instead of stretching it. */}
        {items.length % 2 === 1 ? <View style={styles.gridSpacer} /> : null}
      </View>
    </ScrollView>
  </Screen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2f2550',
    letterSpacing: 0.2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#f3edff',
    borderWidth: 1,
    borderColor: '#dfd0ff',
  },
  badgeText: {
    marginLeft: 5,
    fontSize: 11,
    fontWeight: '800',
    color: '#6f4bd8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#8d80b5',
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridSpacer: {
    width: '48%',
  },
});

export default PreviewSection;
