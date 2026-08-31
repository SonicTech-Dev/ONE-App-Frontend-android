import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import useColors from '../../hooks/useColors';

const Tabs = ({ tabs, activeTab, onTabChange, disabled = false }) => {
  const colors = useColors();

  return(
  <ScrollView
    horizontal
    style={styles.buttonsContainer}
    contentContainerStyle={{
      alignItems: 'center',
      paddingHorizontal: 20,
    }}
    showsHorizontalScrollIndicator={false}
  >
    {tabs.map((tab, index) => (
      <TouchableOpacity
        key={index}
        style={[
          styles.tab,
          activeTab === tab && styles.activeTab(colors), // Highlight the active tab
          disabled && styles.disabledTab,
        ]}
        onPress={() => {
          if (!disabled) onTabChange(tab);
        }}
        disabled={disabled}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === tab && styles.activeTabText, // Change text color for active tab
            disabled && styles.disabledTabText,
          ]}
        >
          {tab}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
)};

export default Tabs;

const styles = StyleSheet.create({
  buttonsContainer: {
    flexGrow: 0,
    marginVertical: 8,
    height: 56,
    width: '100%',
  },
  tab: {
    marginHorizontal: 6,
    paddingHorizontal: 15,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5d8ff',
  },
  activeTab: (colors)=>({
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: '#8457ea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  }),
  tabText: {
    fontSize: 14,
    color: '#654ba4',
    fontWeight: '700',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  disabledTab: {
    opacity: 0.45,
  },
  disabledTabText: {
    color: '#9f94b8',
  },
});
