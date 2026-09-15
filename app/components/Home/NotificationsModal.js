import React,{useRef,useState,useEffect} from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    FlatList,
    Modal,
    Text,
    Dimensions,
    Animated
} from 'react-native';
import useColors from '../../hooks/useColors';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import UploadScreen from "../../screens/UploadScreen";
import { BlurView } from '@react-native-community/blur';
import Swipeable from "react-native-gesture-handler/Swipeable";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const initialNotifications = [
    {
      id: '1',
      title: 'New Message',
      description: 'You have a new message from Sarah Johnson',
      time: '2 mins ago',
      type: 'message',
      read: false,
      avatar: 'https://randomuser.me/api/portraits/women/68.jpg'
    },
    {
      id: '2',
      title: 'Project Update',
      description: 'Your team has completed the Q1 report',
      time: '1 hour ago',
      type: 'work',
      read: false,
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
    },
    {
      id: '3',
      title: 'Payment Received',
      description: 'Invoice #1234 has been paid',
      time: '3 hours ago',
      type: 'finance',
      read: true,
      avatar: 'https://randomuser.me/api/portraits/men/85.jpg'
    },
    {
      id: '4',
      title: 'System Maintenance',
      description: 'Scheduled maintenance on Sunday at 2 AM',
      time: 'Yesterday',
      type: 'system',
      read: true,
      avatar: null
    }
];

function NotificationsModal({modalVisible,setModalVisible}) {
  const colors = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(1)).current;
  const [innerModalHeight, setInnerModalHeight] = useState(0);
  const screenHeight = Dimensions.get('window').height;
  const [notifications, setNotifications] = useState(initialNotifications);
  const [loading, setLoading]=useState(false)

  const getIconByType = (type) => {
    switch(type) {
      case 'message': return <MaterialIcons name="badge" color="#3B82F6" size={24} />;
      case 'work': return <MaterialIcons name="badge" color="#10B981" size={24} />;
      case 'finance': return <MaterialIcons name="badge" color="#8B5CF6" size={24} />;
      case 'system': return <MaterialIcons name="badge" color="#EF4444" size={24} />;
      default: return <MaterialIcons name="badge" color="#6B7280" size={24} />;
    }
  };

  const markAsRead = (id) => {
    setNotifications(notifications.map(notif => 
      notif.id === id ? { ...notif, read: true } : notif
    ));
  };

  const renderNotification = ({item}) => {
    return (
      <Swipeable
        friction={2}
        rightThreshold={SCREEN_WIDTH * 0.25}
        onSwipeableOpen={() => deleteNotification(item.id)}
        renderRightActions={() => (
          <View style={{ 
            // backgroundColor: 'red', 
            justifyContent: 'center', 
            width: '100%' 
          }} />
        )}
        containerStyle={{marginVertical:5,}}
      >
        <View style={{
          flexDirection: 'row', 
          padding: 15, 
          backgroundColor: item.read ? '#f3f4f6' : '#eff6ff',
          borderRadius:10
        }}>
          <View style={{ marginRight: 10 }}>
            <Text style={{ 
              fontWeight: item.read ? 'normal' : 'bold',
              fontSize: 16 
            }}>
              {item.title}
            </Text>
            <Text style={{ 
              color: item.read ? '#6b7280' : '#1f2937',
              fontSize: 14 
            }}>
              {item.description}
            </Text>
            <Text style={{ 
              color: '#9ca3af',
              fontSize: 12 
            }}>
              {item.time}
            </Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  const clearAllNotifications = () => {
    setNotifications(notifications.map(notif => ({ ...notif, read: true })));
  };

 const deleteNotification = (id) => {
    setNotifications(notifications.filter(notif => notif.id !== id));
  };

  useEffect(() => {
    setInnerModalHeight(screenHeight * 0.9); // Set inner modal height to 75% of the screen height
  }, [screenHeight]);

  useEffect(() => {
    if (modalVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 1,  // Assuming this value closes the modal
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [modalVisible]);

  const hideModal = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  };
  
    return(
      <>
      <Modal 
visible={modalVisible} 
animationType="none"
transparent={true}
onRequestClose={hideModal}
>

<UploadScreen
        visible={loading}
        opacity={0.5}
      />

<BlurView
    style={[StyleSheet.absoluteFill, styles.blurContainer]}
    intensity={15}
  >
    <TouchableOpacity onPress={()=>{
      hideModal();
    }} 
    style={StyleSheet.absoluteFill} 
    />
  </BlurView>
  
  <Animated.View style={[styles.modalContent, { height: innerModalHeight*1, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, innerModalHeight] }) }], opacity: fadeAnim }]}>
    <View style={[styles.innerModalContent,{backgroundColor:colors.background}]}>
    <TouchableOpacity 
  onPress={() => {

    hideModal();
  }}
 style={{
   zIndex:1,
   height:40,
   width:40,
   backgroundColor:colors.primary,
   justifyContent:"center",alignItems:"center",borderRadius:20,
   shadowColor: 'rgba(0,0,0, .2)', // IOS
          shadowOffset: { height: 1, width: 1 }, // IOS
          shadowOpacity: 1, // IOS
          shadowRadius: 1, //IOS
          elevation: 2, // Android
          marginBottom:10,
          marginLeft:10
   }}>
 <MaterialIcons name="close" size={32} color={colors.background}/>
 </TouchableOpacity>

<ScrollView 
            bounces={false} 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{paddingBottom:0, marginHorizontal:10}}
            scrollEventThrottle={16}
            >

 <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={clearAllNotifications}>
          <Text style={styles.clearButton}>Mark All Read</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        contentContainerStyle={[
            styles.listContainer,
            notifications.length === 0 && styles.emptyListContainer, // Center content when empty
        ]}
        ListEmptyComponent={
            <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No Notifications</Text>
            </View>
        }
        />

    </View>

</ScrollView>

      </View>
      </Animated.View>
      </Modal>
</>
);
}

const styles=StyleSheet.create({
  blurContainer: {
    justifyContent: 'flex-end',
    flex:1
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  innerModalContent: {
    // backgroundColor: 'white',
    paddingTop: 20,
    // alignItems: 'flex-start',
    flex:1,
    borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.5,
      shadowRadius: 4,
      elevation: 5,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  clearButton: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  notificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
  },
  notificationLeftContent: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    marginBottom: 4,
    color: '#6B7280',
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50, // Optional, adjust for layout
  },
  emptyText: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyListContainer: {
    flex: 1, // Ensure FlatList stretches to take available space
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NotificationsModal;