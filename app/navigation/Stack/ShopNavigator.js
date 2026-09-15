import React from "react"
import { createStackNavigator } from "@react-navigation/stack";
import ShopScreen from "../../screens/ShopScreen";

const Stack = createStackNavigator();

const ShopNavigator = ({route,navigation}) => {
return(
<Stack.Navigator>
     
<Stack.Screen 
      name="ShopScreen" 
      component={ShopScreen} 
      options={{
        headerBackTitleVisible: false,
        headerTitleStyle: {color:'black',},
        headerTitle:`Shop`,
        headerShown:false,
        }}
        />

    </Stack.Navigator>
)}

export default ShopNavigator;
