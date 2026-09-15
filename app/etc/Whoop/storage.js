import SecureKeyStore from "react-native-secure-key-store";

const key = "whoopAccessToken";
const key2 = "whoopRefreshToken"

const storeToken = async (data) => {
  try {
    await SecureKeyStore.set(key, data.access);
    await SecureKeyStore.set(key2, data.refresh);
  } catch (error) {
    console.log("Error storing access and refresh token", error);
  }
};

const storeAccessToken = async (data) => {
  try {
    await SecureKeyStore.set(key, data.access);
  } catch (error) {
    console.log("Error storing access token", error);
  }
};

const getAccessToken = async () => {
  try {
    return await SecureKeyStore.get(key);
  } catch (error) {
    console.log("Error getting authToken", error);
  }
};

const getRefreshToken = async () => {
  try {
    return await SecureKeyStore.get(key2);
  } catch (error) {
    console.log("Error getting authToken", error);
  }
};

const removeToken = async () => {
  try {
    await SecureKeyStore.remove(key);
    await SecureKeyStore.remove(key2);
  } catch (error) {
    console.log("Error removing authToken", error);
  }
};

export default {
  getAccessToken,
  getRefreshToken,
  removeToken,
  storeToken,
  storeAccessToken,
};
