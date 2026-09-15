import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PreviewSection from '../components/Preview/PreviewSection';

const SERVICE_CATEGORIES = [
  {
    category: 'Services',
    items: [
      { id: 1, name: 'Plumbing', description: 'Fix leaking pipes, clogged drains, and other plumbing issues.', iconName: 'water', color: '#32a852' },
      { id: 2, name: 'Electrical', description: 'Repair electrical faults, install new wiring, or replace fixtures.', iconName: 'flash', color: '#f4b400' },
      { id: 3, name: 'Air Conditioning', description: 'Service and repair air conditioning units.', iconName: 'snow', color: '#4ac0ff' },
      { id: 4, name: 'Heating', description: 'Repair or maintain heating systems, including boilers and radiators.', iconName: 'flame', color: '#e63946' },
      { id: 5, name: 'Pest Control', description: 'Eliminate pests like rodents, insects, and termites.', iconName: 'bug', color: '#ff4500' },
      { id: 6, name: 'Cleaning', description: 'General cleaning services for common areas and apartments.', iconName: 'sparkles', color: '#6a5acd' },
      { id: 7, name: 'Security', description: 'Provide security personnel and systems, including CCTV.', iconName: 'shield-checkmark', color: '#1e90ff' },
      { id: 8, name: 'Gardening', description: 'Maintain gardens, lawns, and outdoor spaces.', iconName: 'leaf', color: '#32d2d6' },
      { id: 9, name: 'Waste Management', description: 'Handle waste collection and recycling services.', iconName: 'trash', color: '#7f8c8d' },
    ],
  },
  {
    category: 'Open',
    items: [
      { id: 2, name: 'Electrical', description: 'Repair electrical faults, install new wiring, or replace fixtures.', iconName: 'flash', color: '#f4b400' },
    ],
  },
  {
    category: 'History',
    items: [],
  },
];

export default function ServicesScreen() {
  const [activeTab, setActiveTab] = useState('Services');
  const activeItems = SERVICE_CATEGORIES.find((c) => c.category === activeTab)?.items || [];

  return (
    <PreviewSection
      title="Services"
      subtitle="A preview of on-demand home services. Requests cannot be submitted yet."
      items={activeItems}
    >
      <View style={styles.tabRow}>
        {SERVICE_CATEGORIES.map(({ category }) => {
          const isActive = category === activeTab;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(category)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{category}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Nothing here yet.</Text>
        </View>
      ) : null}
    </PreviewSection>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 18,
    borderRadius: 999,
    backgroundColor: '#f3edff',
    borderWidth: 1,
    borderColor: '#e7dcff',
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#6f4bd8',
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#7f72a3',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a99fc0',
  },
});
