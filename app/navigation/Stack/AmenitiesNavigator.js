import React from "react"
import { createStackNavigator } from "@react-navigation/stack";
import AmenitiesScreen from "../../screens/AmenitiesScreen";

const Stack = createStackNavigator();

const AmenitiesNavigator = ({route,navigation}) => {

return(
  <Stack.Navigator screenOptions={{ headerShown: false }}>

  <Stack.Screen
    name="AmenitiesScreen"
    component={AmenitiesScreen}
    options={{ 
      headerShown: false,
      tabBarStyle: { display: 'none' },
      headerBackTitleVisible: false,
      headerTitle:`Amenities`,
      headerTitleStyle: {color:'black',},
    }}   
    />

</Stack.Navigator>

)}

export default AmenitiesNavigator;
