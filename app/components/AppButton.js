import React from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import useColors from '../hooks/useColors'; // Adjust the path to where you saved useColors.js

function AppButton({ 
  title, 
  onPress, 
  color,
  text="white",
  borderWidth=0,
  borderColor="medium",
  borderRadius=5,
  elevation=2,
  marginTop=10,
  width,
  disabled=false,
  opacity=1
}) {

  const colors = useColors();

  return (
    <View style={styles.shadow}>
    <TouchableOpacity 
    style={[
      styles.button,{
        backgroundColor: color?color:colors.primary,
        borderWidth:borderWidth,
        borderColor: colors[borderColor],
        borderRadius:borderRadius,
        elevation:elevation,
        marginTop:marginTop,
        opacity:opacity,
        }
        ]} 
        onPress={onPress}
        disabled={disabled}
        >
      <Text style={[styles.text,{color:colors[text]}]}>{title}</Text>
    </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  button: {
    // backgroundColor: colors.light,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
    // width: "90%",
    marginVertical:10,
    marginHorizontal:10,
    // marginTop:30
  },

  text: {
    // color: colors.white,
    fontSize: 16,
    // fontWeight: "bold",
  },

  shadow:{    
    shadowColor:'rgba(0,0,0, 0.4)',
    shadowOffset:{width:1,height:1},
    shadowRadius:1,
    shadowOpacity: 1,
  }
});

export default AppButton;
