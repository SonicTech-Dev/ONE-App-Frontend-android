import React from "react"
import { createStackNavigator } from "@react-navigation/stack";

// Home
import HomeScreen from '../../screens/HomeScreen'
import HealthScreen from "../../screens/HealthScreen";

const Stack = createStackNavigator();

const HomeNavigator = ({route,navigation}) => {

return(
<Stack.Navigator>
      <Stack.Screen 
      name="HomeScreen" 
      component={HomeScreen} 
      options={{
        headerShown:false,
        headerBackTitleVisible: false,
        gestureEnabled: false
        }}/>

<Stack.Screen
    name="HealthScreen"
    component={HealthScreen}
    options={{ 
      headerShown:false,
      tabBarStyle: { display: 'none' },
      headerBackTitleVisible: false,
      headerTitle:`Health`,
      headerTitleStyle: {color:'black',},
    }}   
    />

    </Stack.Navigator>
)}

export default HomeNavigator;
