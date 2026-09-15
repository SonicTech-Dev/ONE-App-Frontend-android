import React from "react"
import { createStackNavigator } from "@react-navigation/stack";
import WelcomeScreen from "../screens/WelcomeScreen";
import AppNavigator from "./AppNavigator";
import ActiveCallScreen from "../screens/ActiveCallScreen";

const Stack = createStackNavigator();

const AuthNavigator = () => {

return(
<Stack.Navigator screenOptions={{ headerShown: false }}>
     
<Stack.Screen 
      name="WelcomeScreen" 
      component={WelcomeScreen} 
      options={{
        headerBackTitleVisible: false,
        headerShown:false,
        gestureDirection:'horizontal',
        }}
        />

<Stack.Screen name="AppNavigator" component={AppNavigator} />
<Stack.Screen 
      name="ActiveCallScreen" 
      component={ActiveCallScreen} 
      options={{ headerShown: false, presentation: 'fullScreenModal' }} 
/>

    </Stack.Navigator>
)}

export default AuthNavigator;
