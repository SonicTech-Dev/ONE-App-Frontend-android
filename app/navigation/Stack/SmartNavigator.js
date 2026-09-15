import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import SmartScreen from "../../screens/SmartScreen";
import ContactsScreen from "../../screens/ContactsScreen";
import SmartLockScreen from "../../components/Smart/SmartLock/SmartLockScreen";
import SL50LockScreen from "../../components/Smart/SmartLock/SL50Lock";
import F2Lock from "../../components/Smart/SmartLock/F2Lock";
import IntercomScreen from "../../components/Smart/Intercom/Intercom"
import DeviceStatuses from "../../components/Smart/DeviceStatuses";
import IPCamera from "../../components/Smart/IPCameras/IPCamera";
import ScenesScreen from "../../components/Smart/Scenes/ScenesScreen";
import AccountDetailsScreen from "../../components/Account/AccountDetailsScreen";
import FamilyManagementScreen from "../../components/Account/FamilyManagementScreen";
const Stack = createStackNavigator();

const SmartNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SmartScreen"
        component={SmartScreen}
        options={{
          headerShown: false,
          headerBackTitleVisible: false,
          headerTitleStyle: { color: 'black' },
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="ContactsScreen"
        component={ContactsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SmartLockScreen"
        component={SmartLockScreen}
        options={{
          headerShown: false,
        }}
        />
      <Stack.Screen
        name="SL50LockScreen"
        component={SL50LockScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="F2Lock"
        component={F2Lock}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="IntercomScreen"
        component={IntercomScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DeviceStatuses"
        component={DeviceStatuses}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="IPCameraScreen"
        component={IPCamera}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ScenesScreen"
        component={ScenesScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AccountDetailsScreen"
        component={AccountDetailsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="FamilyManagementScreen"
        component={FamilyManagementScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default SmartNavigator;