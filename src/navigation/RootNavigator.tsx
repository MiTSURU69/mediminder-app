import React from "react";
import {
  Alert,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Today from "../screens/Today";
import AddMedication from "../screens/AddMedication";
import History from "../screens/History";
import ChatScreen from "../screens/ChatScreen";
import ScanningOverlay from "../components/ScanningOverlay";

const Tab = createBottomTabNavigator();
const CHAT_SERVER_URL = "https://mediminder-1.onrender.com";

const TEAL_DARK = "#0F9488";
const BAR_BG = "#FFFFFF";
const INACTIVE = "#374151";
const BAR_HEIGHT = 64;
const ICON_TOP_OFFSET = 12;

export const navigationRef = createNavigationContainerRef();

const TAB_META: Record<string, { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = {
  Today: { icon: "home-variant-outline", label: "Home" },
  Chat: { icon: "clover-outline", label: "Assistant" },
  Add: { icon: "plus-box-outline", label: "Add" },
  History: { icon: "history", label: "History" },
};

// Plain inline tab item — same size/plane as every other tab.
function TabItem({ icon, label, color, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.tabItem}>
      <View style={styles.tabIconWrap}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1} allowFontScaling={false}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CustomTabBar({ state, navigation, onCameraPress }: any) {
  const insets = useSafeAreaInsets();
  const routes = state.routes as { key: string; name: string }[];
  const leftRoutes = routes.slice(0, 2);   // Home, Assistant
  const rightRoutes = routes.slice(2);      // Add, History

  const renderTab = (route: { key: string; name: string }) => {
    const meta = TAB_META[route.name] ?? { icon: "circle-outline", label: route.name };
    const isFocused = state.index === routes.findIndex((r) => r.key === route.key);
    const color = isFocused ? TEAL_DARK : INACTIVE;

    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <TabItem key={route.key} icon={meta.icon} label={meta.label} color={color} onPress={onPress} />
    );
  };

  return (
    <View style={[styles.barWrap, { bottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {leftRoutes.map(renderTab)}
        {/* Camera sits inline, same row, same size as every other tab —
            not a raised/elevated button, no special treatment. */}
        <TabItem icon="camera-outline" label="Scan" color={INACTIVE} onPress={onCameraPress} />
        {rightRoutes.map(renderTab)}
      </View>
    </View>
  );
}

export default function RootNavigator() {
  const [scanning, setScanning] = React.useState(false);

  const handleCameraPress = React.useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera permission is required to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Oops", "No image captured.");
        return;
      }

      setScanning(true);

      let base64 = asset.base64;
      if (!base64) {
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const mimeType = asset.mimeType || "image/jpeg";
      const dataUri = `data:${mimeType};base64,${base64}`;

      const response = await fetch(`${CHAT_SERVER_URL}/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUri }),
      });

      const data = await response.json();

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
      Alert.alert("Camera Error", e?.message ?? "Failed to open camera");
    } finally {
      setScanning(false);
    }
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <CustomTabBar {...props} onCameraPress={handleCameraPress} />}
      >
        <Tab.Screen name="Today" component={Today} />
        <Tab.Screen name="Chat" component={ChatScreen} />
        <Tab.Screen name="Add" component={AddMedication} />
        <Tab.Screen name="History" component={History} />
      </Tab.Navigator>

      <ScanningOverlay visible={scanning} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: "absolute",
    left: 20,
    right: 20,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BAR_BG,
    borderRadius: 30,
    height: BAR_HEIGHT,
    paddingHorizontal: 4,
    width: "100%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  tabItem: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: "center",
    paddingTop: ICON_TOP_OFFSET,
  },
  tabIconWrap: {
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 3,
    textAlign: "center",
  },
});