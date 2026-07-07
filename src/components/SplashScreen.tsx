import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";

type Props = {
  onFinish: () => void;
};

export default function SplashScreen({ onFinish }: Props) {
  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.center}>
        <Image
          source={require("../../assets/doctor-avatar.png")}
          style={styles.avatar}
          resizeMode="contain"
        />

        <View style={styles.divider} />

        <Text style={styles.title}>Welcome to Mediminder</Text>
        <Text style={styles.subtitle}>
          Your caring companion for staying{"\n"}on top of your health
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onFinish}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Let's Start</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  avatar: {
    width: 170,
    height: 200,
    marginBottom: 22,
  },
  divider: {
    width: 64,
    height: 1,
    backgroundColor: "#e2e8ef",
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#20242b",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#8b93a1",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 34,
  },
  button: {
    backgroundColor: "#2f7ec9",
    borderRadius: 28,
    paddingVertical: 15,
    paddingHorizontal: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2f7ec9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});