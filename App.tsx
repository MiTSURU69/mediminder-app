import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  Provider as PaperProvider,
  MD3LightTheme,
  type MD3Theme,
} from "react-native-paper";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Platform,
  ActionSheetIOS,
  Text,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts, DancingScript_700Bold } from "@expo-google-fonts/dancing-script";

import RootNavigator from "./src/navigation/RootNavigator";
import tw from "./src/lib/tw";
import { initNotifications } from "./src/lib/notifications";

const c = (token: string, fallback: string) =>
  (tw.color(token) as string) || fallback;

const theme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: c("brand", "#2563eb"),
    background: c("bg", "#f8fafc"),
    surface: c("card", "#ffffff"),
    onSurface: c("text", "#0f172a"),
    outline: c("border", "#e5e7eb"),
  },
};

export default function App() {
  const receivedSubRef = React.useRef<Notifications.Subscription | null>(null);
  const responseSubRef = React.useRef<Notifications.Subscription | null>(null);

  const [fontsLoaded] = useFonts({
    DancingScript_700Bold,
  });

  React.useEffect(() => {
    initNotifications();

    receivedSubRef.current =
      Notifications.addNotificationReceivedListener((n) => {
        console.log("[Notif] received (foreground):", n.request.content);
      });

    responseSubRef.current =
      Notifications.addNotificationResponseReceivedListener((resp) => {
        const doseId = resp.notification.request.content.data?.doseId as
          | string
          | undefined;
        console.log("[Notif] tapped:", {
          doseId,
          content: resp.notification.request.content,
        });
      });

    return () => {
      if (receivedSubRef.current) {
        receivedSubRef.current.remove();
        receivedSubRef.current = null;
      }
      if (responseSubRef.current) {
        responseSubRef.current.remove();
        responseSubRef.current = null;
      }
    };
  }, []);

  // ✅ Utility: Open WhatsApp with fallbacks
  async function openWhatsApp(phone: string, message: string) {
    const encoded = encodeURIComponent(message);
    const nativeUrl = `whatsapp://send?phone=${phone}&text=${encoded}`;
    const plainPhone = phone.replace(/\+/g, "").replace(/\s+/g, "");
    const waMeUrl = `https://wa.me/${plainPhone}?text=${encoded}`;
    const apiUrl = `https://api.whatsapp.com/send?phone=${plainPhone}&text=${encoded}`;

    try {
      const canOpenNative = await Linking.canOpenURL(nativeUrl);
      if (canOpenNative) {
        await Linking.openURL(nativeUrl);
        return;
      }
      try {
        await Linking.openURL(nativeUrl);
        return;
      } catch (e) {
        console.warn("[SOS] native whatsapp open failed:", e);
      }
      if (await Linking.canOpenURL(waMeUrl)) {
        await Linking.openURL(waMeUrl);
        return;
      }
      if (await Linking.canOpenURL(apiUrl)) {
        await Linking.openURL(apiUrl);
        return;
      }
      await Linking.openURL(waMeUrl);
    } catch (err) {
      console.error("[SOS] WhatsApp open error:", err);
      throw err;
    }
  }

  // ✅ 3-dot menu action (same as old SOS button)
  function handleMenuPress() {
    console.log("[Menu] pressed!");
    const whatsappPhone = "+919289678787";
    const whatsappMessage =
      "Hi, I'd like to book an appointment with Manipal Get Well Go. What's the best way to schedule a consultation?";

    const onWhatsApp = async () => {
      try {
        await openWhatsApp(whatsappPhone, whatsappMessage);
      } catch {
        Alert.alert(
          "WhatsApp not available",
          "Couldn't open WhatsApp. Please make sure WhatsApp is installed or try calling 108."
        );
      }
    };

    const onCall = async () => {
      const number = "108";
      const telScheme =
        Platform.OS === "ios" ? `telprompt:${number}` : `tel:${number}`;
      try {
        const supported = await Linking.canOpenURL(telScheme);
        if (supported) {
          await Linking.openURL(telScheme);
          return;
        }
        const fallback = `tel:${number}`;
        const fallbackSupported = await Linking.canOpenURL(fallback);
        if (fallbackSupported) {
          await Linking.openURL(fallback);
          return;
        }
        Alert.alert(
          "Call not available",
          `Unable to start a call to ${number}. Please dial manually.`
        );
      } catch (err) {
        console.error("[SOS] Error placing call:", err);
        Alert.alert(
          "Error",
          `Could not place the call to ${number}. Please dial manually.`
        );
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["WhatsApp", "Call 108", "Cancel"],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) onWhatsApp();
          else if (buttonIndex === 1) onCall();
        }
      );
    } else {
      Alert.alert(
        "Emergency",
        "How would you like to contact emergency services?",
        [
          { text: "WhatsApp", onPress: onWhatsApp },
          { text: "Call 108", onPress: onCall },
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true }
      );
    }
  }

  if (!fontsLoaded) {
    // Keep this minimal — avoids a flash of unstyled text while the cursive font loads
    return null;
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <StatusBar style="dark" />

        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <View style={styles.header}>
            <Text style={styles.logoText}>Mediminder</Text>
            <TouchableOpacity
              onPress={handleMenuPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.menuBtn}
            >
              <MaterialCommunityIcons
                name="dots-vertical"
                size={24}
                color="#374151"
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <RootNavigator />
      </SafeAreaProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  headerSafeArea: {
    backgroundColor: "#ffffff",
  },
  header: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  logoText: {
    fontFamily: "DancingScript_700Bold",
    fontSize: 28,
    color: "#10B981",
  },
  menuBtn: {
    padding: 4,
  },
});