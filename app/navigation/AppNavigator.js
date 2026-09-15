import React from "react";
import { Platform, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_BASE_HEIGHT } from "./tabBarLayout";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';
import Entypo from 'react-native-vector-icons/Entypo';
import ShopNavigator from "./Stack/ShopNavigator";
import SmartNavigator from "./Stack/SmartNavigator";
import HomeNavigator from "./Stack/HomeNavigator";
import ServicesNavigator from "./Stack/ServicesNavigator";
import AmenitiesNavigator from "./Stack/AmenitiesNavigator";
import useColors from "../hooks/useColors";

const Tab = createBottomTabNavigator();

const INACTIVE_TINT = '#969696';

const TABS = [
  {
    name: 'HomeScreen',
    component: HomeNavigator,
    label: 'Home',
    render: (color) => <Entypo name="home" size={28} color={color} />,
  },
  {
    name: 'Services',
    component: ServicesNavigator,
    label: 'Services',
    render: (color) => <MaterialIcons name="home-repair-service" size={28} color={color} />,
  },
  {
    name: 'Smart',
    component: SmartNavigator,
    label: 'Smart',
    render: (color) => <Feather name="smartphone" size={28} color={color} />,
  },
  {
    name: 'Amenities',
    component: AmenitiesNavigator,
    label: 'Amenities',
    render: (color) => <Feather name="share-2" size={28} color={color} />,
  },
  {
    name: 'Shop',
    component: ShopNavigator,
    label: 'Shop',
    render: (color) => <MaterialCommunityIcons name="store" size={28} color={color} />,
  },
];

const AppNavigator = () => {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="HomeScreen"
      screenOptions={{
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: INACTIVE_TINT,
        // Lift the bar clear of the gesture/navigation area so icons are never
        // clipped by system UI on devices with a bottom inset.
        tabBarStyle: [
          styles.tabBar,
          { height: TAB_BAR_BASE_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ],
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      {TABS.map(({ name, component, label, render }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            tabBarAccessibilityLabel: label,
            tabBarIcon: ({ focused }) => render(focused ? colors.primary : INACTIVE_TINT),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderTopWidth: 0,
    paddingTop: 8,
    elevation: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#2f2550',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      default: {},
    }),
  },
  tabBarItem: {
    paddingTop: 2,
  },
});

export default AppNavigator;
