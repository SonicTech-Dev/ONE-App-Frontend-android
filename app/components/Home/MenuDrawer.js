import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Easing } from 'react-native';
import MenuHeader from './MenuHeader';
import useColors from '../../hooks/useColors';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const MenuDrawer = ({ visible, onClose, items, onProfilePress }) => {
  const translateX = React.useRef(new Animated.Value(-300)).current; // For drawer sliding
  const backdropOpacity = React.useRef(new Animated.Value(0)).current; // For backdrop fade
  const colors = useColors();

  React.useEffect(() => {
    if (visible) {
      // Animate the drawer in
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0, // Drawer slides to position 0 (fully visible)
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1, // Backdrop fades in
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate the drawer out
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -300, // Drawer slides back to position -300 (hidden)
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0, // Backdrop fades out
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose(); // Call onClose after animation finishes
      });
    }
  }, [visible]);

  const handleOnClose =() =>{
    Animated.parallel([
        Animated.timing(translateX, {
          toValue: -300, // Slide the drawer out
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0, // Fade the backdrop out
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => onClose())
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none" // Disable default animations
      onRequestClose={onClose}
    >
      <View style={styles.drawerContainer}>
        {/* Animated Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: backdropOpacity }, // Animate the opacity of the backdrop
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill} // Make the backdrop cover the entire area
            onPress={() => handleOnClose()}
            activeOpacity={1}
          />
        </Animated.View>

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            { transform: [{ translateX }] }, // Apply horizontal animation
          ]}
        >
           <TouchableOpacity style={{width:30,height:30, backgroundColor:colors.primary, justifyContent:'center', alignItems:'center', borderRadius:20, marginBottom:10}} onPress={()=>handleOnClose()}>
            <MaterialIcons name='close' size={22} color={colors.white}/>
          </TouchableOpacity>

          {/* <MenuHeader onProfilePress={onProfilePress}/> */}
          
          {/* <Text style={styles.drawerHeader}>Custom Drawer</Text> */}
          {/* <TouchableOpacity onPress={()=>handleOnClose()}>
            <Text style={styles.closeDrawer}>Close Drawer</Text>
          </TouchableOpacity> */}
          <View style={{marginTop:10}}/>
          {items.map((item, index) => (
            <React.Fragment key={item.id ?? index}>
            <TouchableOpacity
              onPress={item.onPress}
              disabled={item.comingSoon}
              activeOpacity={item.comingSoon ? 1 : 0.6}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!item.comingSoon }}
              style={[styles.drawerItemRow, item.comingSoon && styles.drawerItemRowDisabled]}
            >
              <View style={styles.drawerItemIcon}>
                {item.Icon}
              </View>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.drawerItem, {color: index === items.length - 1 ? colors.danger : '#1a1a1a'}]}
              >
                {item.name}
              </Text>
              {/* Marks entries that have no screen behind them yet, so they read as
                  planned rather than broken. */}
              {item.comingSoon ? <Text style={styles.soonBadge}>Soon</Text> : null}
              </TouchableOpacity>
              <View style={[styles.drawerDivider, { backgroundColor: colors.medium }]}/>
            </React.Fragment>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    flexDirection: 'row', // Layout drawer and backdrop horizontally
  },
  drawer: {
    width: 300, // Fixed width for the drawer
    height: '100%',
    backgroundColor: '#fff',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    paddingTop: 50,
  },
  backdrop: {
    flex: 1, // Covers the entire remaining screen to the right of the drawer
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Dimmed background
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  drawerHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  closeDrawer: {
    color: 'red',
    marginBottom: 20,
  },
  drawerItem: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  drawerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  drawerItemRowDisabled: {
    opacity: 0.45,
  },
  soonBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#f3edff',
    color: '#6f4bd8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  drawerItemIcon: {
    marginRight: 12,
    width: 30,
    alignItems: 'center',
  },
  drawerDivider: {
    width: '100%',
    height: 0.5,
    opacity: 0.25,
  },
});

export default MenuDrawer;