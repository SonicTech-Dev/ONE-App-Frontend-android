import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import useColors from '../../hooks/useColors';
import Fontisto from 'react-native-vector-icons/Fontisto';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const Header = ({ onMenuPress, appLogo, notificationOnPress }) => {
  const colors = useColors();

  return (
    <View style={styles.headerContainer}>
      {/* Menu Button */}
      <TouchableOpacity onPress={onMenuPress} style={styles.menuButton}>
        <MaterialCommunityIcons style={styles.menu(colors)} name='menu'/>
      </TouchableOpacity>

      {/* Logo */}
      <Image
        source={require('../../assets/one_logo.png')}
        style={styles.logo}
        onError={(e) => console.log('Error loading image', e.nativeEvent.error)}
      />

      {/* Placeholder for layout alignment */}
      <View style={styles.placeholder(colors)}>
        <TouchableOpacity style={styles.notificationBell(colors)} onPress={notificationOnPress}>
            <Fontisto name='bell' style={styles.bell(colors)} />
        </TouchableOpacity>
        
        </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 0,
    height: 70,
  },
  menuButton: {
    width: '20%',
    justifyContent:'center',
    alignItems:'center',
  },
  menu: (colors) => ({
    fontSize: 36,
    color: colors.primary,
    opacity: 0.5,
  }),
  logo: {
    width: '50%',
    height: '100%',
    resizeMode: 'contain',
  },
  placeholder: (colors)=>({
    width: '20%',
    justifyContent:'center',
    alignItems:'center',
  }),
  notificationBell: (colors)=>({
    width: 50,
    height:50,
    backgroundColor:colors.primary,
    justifyContent:'center',
    alignItems:'center',
    borderRadius:30,
    shadowColor: 'rgba(0,0,0, 0.25)',
    shadowOffset: { height: 1, width: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 2,
  }),
  bell: (colors) => ({
    fontSize: 26,
    color: colors.white,
  }),
});

export default Header;
