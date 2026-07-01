import React from "react";
import { Alert, TouchableOpacity } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import Today from "../screens/Today";
import AddMedication from "../screens/AddMedication";
import History from "../screens/History";
import ChatScreen from "../screens/ChatScreen";
import ScanningOverlay from "../components/ScanningOverlay";

const Tab = createBottomTabNavigator();
const CHAT_SERVER_URL = "https://mediminder-1.onrender.com";

export const navigationRef = createNavigationContainerRef();

export default function RootNavigator() {
  const [scanning, setScanning] = React.useState(false);

  const handleCameraPress = React.useCallback(async () => {
    try {
      console.log("[camera] requesting permission...");
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera permission is required to take photos.");
        return;
      }

      console.log("[camera] launching camera...");
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        console.log("[camera] user canceled");
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Oops", "No image captured.");
        return;
      }
      console.log("[camera] captured:", asset.uri);

      setScanning(true);

      let base64 = asset.base64;
      if (!base64) {
        console.log("[camera] reading file manually for base64...");
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      console.log("[camera] base64 length:", base64?.length);

      const mimeType = asset.mimeType || "image/jpeg";
      const dataUri = `data:${mimeType};base64,${base64}`;

      console.log("[camera] sending to server:", `${CHAT_SERVER_URL}/ocr`);
      const response = await fetch(`${CHAT_SERVER_URL}/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUri }),
      });
      console.log("[camera] response status:", response.status);

      const data = await response.json();
      console.log("[camera] response data:", JSON.stringify(data).slice(0, 500));

      if (!response.ok) {
        Alert.alert("Scan failed", "Couldn't read the prescription. Try a clearer photo.");
        return;
      }

      const medicines = data.medicines || [];
      if (medicines.length === 0) {
        Alert.alert("No medicines found", "We couldn't detect any medicines in this image.");
        return;
      }

      if (navigationRef.isReady()) {
        (navigationRef.navigate as any)("Add", { scannedMedicines: medicines });
      }
    } catch (e: any) {
      console.warn("[camera] CAUGHT ERROR:", e);
      Alert.alert("Camera Error", e?.message ?? "Failed to open camera");
    } finally {
      setScanning(false);
    }
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
        }}
      >
        <Tab.Screen
          name="Today"
          component={Today}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calendar-today" color={color} size={size} />
            ),
          }}
        />

        <Tab.Screen
          name="Camera"
          component={Today}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="camera" color={color} size={size} />
            ),
            tabBarButton: (props) => (
              <TouchableOpacity
                {...(props as any)}
                activeOpacity={0.8}
                onPress={handleCameraPress}
              />
            ),
          }}
          listeners={{
            tabPress: (e) => e.preventDefault(),
          }}
        />

        <Tab.Screen
          name="Add"
          component={AddMedication}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="plus-circle-outline" color={color} size={size} />
            ),
          }}
        />

        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="robot-happy-outline" color={color} size={size} />
            ),
          }}
        />

        <Tab.Screen
          name="History"
          component={History}
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="history" color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>

      <ScanningOverlay visible={scanning} />
    </NavigationContainer>
  );
}