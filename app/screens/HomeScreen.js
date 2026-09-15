import React, { useState } from 'react';
import { View, ScrollView, FlatList, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import useColors from '../hooks/useColors';
import { useAuth } from '../context/AuthContext';
import { useBottomSpacing } from '../navigation/tabBarLayout';
import Header from '../components/Home/Header';
import MenuDrawer from '../components/Home/MenuDrawer';
import Screen from '../components/Screen';
import routes from '../navigation/routes';
import UploadScreen from "./UploadScreen";
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import NotificationsModal from '../components/Home/NotificationsModal';

const HomeScreen = ({navigation}) => {
  const colors = useColors();
  const { logout } = useAuth();
  const bottomSpacing = useBottomSpacing();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading]=useState(false)
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);

  const drawerItems = [
      // Amenities Section
      {
        id: 1,
        name: 'ID Badge',
        Icon: <MaterialIcons name="badge" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {
          // setIsDrawerOpen(false);
        },
        comingSoon: true
      },
      {
        id: 2,
        name: 'Gate Pass',
        Icon: <MaterialCommunityIcons name="badge-account" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {
          // setIsDrawerOpen(false);
        },
        comingSoon: true
      },
      {
        id: 12,
        name: 'Health',
        Icon: <FontAwesome name="heartbeat" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {
          setIsDrawerOpen(false);
          navigation.navigate(routes.HEALTHSCREEN)
        }
      },
      {
        id: 3,
        name: 'Requests',
        Icon: <Ionicons name="document-text-outline" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {
          // setIsDrawerOpen(false);
        },
        comingSoon: true
      },
      {
        id: 4,
        name: 'Feedback',
        Icon: <MaterialIcons name="feedback" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {},
        comingSoon: true
      },
      {
        id: 5,
        name: 'Utilities',
        Icon: <Ionicons name="bulb" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {},
        comingSoon: true
      },
      {
        id: 6,
        name: 'Fees',
        Icon: <MaterialIcons name="account-balance-wallet" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {},
        comingSoon: true
      },
      {
        id: 8,
        name: 'Reservations',
        Icon: <Ionicons name="calendar" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {},
        comingSoon: true
      },
      {
        id: 9,
        name: 'Manage Users',
        Icon: <MaterialCommunityIcons name="account-multiple" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {},
        comingSoon: true
      },
      {
        id: 10,
        name: 'Manage Properties',
        Icon: <MaterialCommunityIcons name="office-building" size={26} color={colors.primary} />, // Explicitly provide an icon JSX element
        onPress: () => {},
        comingSoon: true
      },
      {
        id: 11,
        name: 'Log Out',
        Icon: <Ionicons name="log-out-outline" size={26} color={colors.danger} />, // Explicitly provide an icon JSX element
        onPress: ()=>handleLogout()
      },
    ];

  const handleLogout = async () => {
    Alert.alert('Are you sure?', "You'll need to login again to keep using the application",
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            // Clear the real auth state, not just the legacy 'userToken' key, then
            // reset to the welcome screen — previously the navigation was commented
            // out, so logging out left the user sitting in the app still signed in.
            await logout();
            setIsDrawerOpen(false);
            navigation.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: routes.WELCOME }] })
            );
          } catch (error) {
            console.error('[HomeScreen] Logout failed:', error);
            Alert.alert('Unable to log out', 'Please try again.');
          } finally {
            setLoading(false);
          }
        },
      },
    ])
  }

  const data = [
    { id: '1', title: 'Who are we?', description: 'A homegrown boutique developer on a journey towards global recognition.' },
    { id: '2', title: 'One mission', description: 'We aim to create modern living spaces where people feel connected to each other and the world around them, all through one unique experience' },
    { id: '3', title: 'One Ethos', description: 'We maintain integrity in all we do, incorporate innovation into our designs, and empower our team and partners to deliver personalized, customer-centric experiences.' },
    { id: '4', title: 'At the heart of our enterprise',},
    { id: '5', title: 'Real estate redefined',},
  ];

  const quickActions = [
    { id: '1', title: 'ID Badge', 
      // onPress: ()=>navigation.navigate(routes.IDBADGE)
    },
    { id: '2', title:  'Requests', 
      // onPress: ()=>navigation.navigate(routes.REQUESTSCREEN) 
    },
    { id: '3', title:'Gate Pass', 
      // onPress: ()=>navigation.navigate(routes.PASS)
    },
  ];

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} 
    // onPress={()=>navigation.navigate(routes.FEEDDETAILS,{item})}
    >
      <Image source={require('../assets/Towers_Final.jpg')} style={styles.image} />
      <View style={styles.textContainer}>
        {item.title&&<Text style={styles.title}>{item.title}</Text>}
        {item.description&&<Text style={styles.description}>{item.description}</Text>}
      </View>
    </TouchableOpacity>
  );

  const onAccountDetailsPress=()=>{
    setIsDrawerOpen(false);
  }

  return (
    <>
    <UploadScreen visible={loading} />
    <Screen>
      <Header onMenuPress={() => setIsDrawerOpen(true)} notificationOnPress={()=>setNotificationModalVisible(true)}/>
        <ScrollView
          horizontal
          style={styles.buttonsContainer}
          contentContainerStyle={{
            justifyContent: 'space-between',
            alignItems: 'center',
            flex:1,
            paddingHorizontal:20,
          }}
        >
          {quickActions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.navButton(colors), !item.onPress && styles.navButtonDisabled]}
              onPress={item.onPress}
              disabled={!item.onPress}
              accessibilityRole="button"
              accessibilityState={{ disabled: !item.onPress }}
            >
              <Text style={styles.navButtonText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomSpacing }}
          showsVerticalScrollIndicator={false}
        />
      
      <MenuDrawer onProfilePress={()=>onAccountDetailsPress()} visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} items={drawerItems} />

      {notificationModalVisible?
      <NotificationsModal modalVisible={notificationModalVisible} setModalVisible={setNotificationModalVisible}/>
      :null}

    </Screen>
    </>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  buttonsContainer: {
    flexGrow: 0, // Ensure the container doesn't grow vertically
    marginVertical: 0,
    height:80,
    width:'100%'
  },
  navButton: (colors) => ({
    backgroundColor: colors.primary,
    borderRadius: 40,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    shadowColor: 'rgba(0,0,0, 0.25)',
    shadowOffset: { height: 1, width: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 2,
  }),
  // Quick actions without a destination yet read as inactive rather than broken.
  navButtonDisabled: {
    opacity: 0.45,
  },
  navButtonText: {
    color: '#fff',
    fontFamily:'Arial',
    fontSize: 16,
  },
  greeting: {
    fontSize: 18,
    marginVertical: 10,
    textAlign: 'left',
    textTransform:'capitalize',
    fontFamily:'Arial'
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius:10
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent:'center',
    alignItems:'flex-start'
  },
  title: {
    fontFamily:'Arial',
    color: '#6A0572',
    fontSize:16
  },
  description: {
    color: '#333',
    fontSize:14
  },
  button: (colors) => ({
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  }),
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});