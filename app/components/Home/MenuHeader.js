import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import useColors from '../../hooks/useColors';

const MenuHeader = ({onProfilePress}) => {
  const colors = useColors();

  return (
    <TouchableOpacity onPress={onProfilePress} style={styles.headerContainer(colors)}>
      <View style={styles.userInfo}>
      </View>
      <View style={styles.avatar}>
       
      </View>
    </TouchableOpacity>
  );
};

export default MenuHeader;

const styles = StyleSheet.create({
  headerContainer: (colors) => ({
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.light,
    borderRadius: 10,
    width: '100%',
    paddingVertical: 10,
  }),
  userInfo: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', width: '70%' },
  name: { fontSize: 20, color: '#2d3748', fontFamily: 'Arial', textTransform:'capitalize' },
  avatar: { flex: 1, justifyContent: 'center', alignItems: 'flex-end', width: '30%' },
  image: { width: 60, height: 60, borderRadius: 30 },
});