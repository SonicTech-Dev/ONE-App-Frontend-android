import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const Header = ({ name, onUserPress }) => {
  const displayName = (name || '').trim() || 'there';

  return(
  <View style={styles.headerContainer}>
    <TouchableOpacity style={styles.userButton} onPress={onUserPress} accessibilityLabel="Open my account">
      <MaterialCommunityIcons name="account-circle-outline" size={30} color="#6f4bd8" />
    </TouchableOpacity>
    <View style={styles.textBlock}>
    <Text style={styles.greeting}>
      Hey, <Text style={styles.boldText}>{displayName}</Text>
    </Text>
    <Text style={styles.subtitle}>Your home is ready</Text>
    </View>
  </View>
)};

export default Header;

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textBlock: {
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'center',
  },
  userButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  greeting: {
    fontSize: 21,
    color: '#2f2360',
    flex: 1,
    letterSpacing: 0.2,
  },
  boldText: {
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    color: '#8d79c8',
    fontSize: 13,
    fontWeight: '600',
  },
});
