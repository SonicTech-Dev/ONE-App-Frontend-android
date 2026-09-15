import React from "react"
import { createStackNavigator } from "@react-navigation/stack";
import ServicesScreen from "../../screens/ServicesScreen";

const Stack = createStackNavigator();

const ServicesNavigator = ({route,navigation}) => {

return(
  <Stack.Navigator screenOptions={{ headerShown: false }}>

  <Stack.Screen name="ServicesScreen"  component={ServicesScreen} options={{gesturesEnabled: false}}/>
  
</Stack.Navigator>

)}

export default ServicesNavigator;
