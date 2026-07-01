import * as React from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import PrimaryButton from "./PrimaryButton";
import tw from "../lib/tw";

const CHAT_SERVER_URL = "https://mediminder-1.onrender.com";

type Medicine = {
  medicine: string;
  dosage: string;
  frequency: string;
  timing: string[];
  duration: string;
};

type Props = {
  onScanned?: (medicines: Medicine[]) => void; // callback with extracted meds
};

export default function CameraCapture({ onScanned }: Props) {
  const [loading, setLoading] = React.useState(false);

  const onPressAsync = async () => {
    console.log("[camera] button pressed");
    try {
      console.log("[camera] requesting permission...");
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log("[camera] permission status:", status);

      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow camera access to take photos.");
        return;
      }

      console.log("[camera] launching camera...");
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
        exif: false,
        base64: true,
      });
      console.log("[camera] result canceled?:", result.canceled);

      if (result.canceled) {
        console.log("[camera] user canceled");
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const asset = result.assets?.[0];
      console.log("[camera] asset uri:", asset?.uri);
      console.log("[camera] asset has base64?:", !!asset?.base64);

      if (!asset?.uri) {
        Alert.alert("Oops", "No image captured.");
        return;
      }

      setLoading(true);

      let base64 = asset.base64;
      if (!base64) {
        console.log("[camera] no base64 from picker, reading file manually...");
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
      console.log("[camera] response data:", JSON.stringify(data).slice(0, 300));

      if (!response.ok) {
        console.warn("[camera] OCR error", data);
        Alert.alert("Scan failed", "Couldn't read the prescription. Try a clearer photo.");
        return;
      }

      const medicines: Medicine[] = data.medicines || [];

      if (medicines.length === 0) {
        Alert.alert("No medicines found", "We couldn't detect any medicines in this image.");
        return;
      }

      onScanned?.(medicines);
    } catch (e: any) {
      console.warn("[camera] CAUGHT ERROR:", e);
      console.warn("[camera] error message:", e?.message);
      console.warn("[camera] error stack:", e?.stack);
      Alert.alert("Scan failed", e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PrimaryButton
      mode="contained"
      icon="camera"
      onPressAsync={onPressAsync}
      disabled={loading}
      style={tw`rounded-2xl py-3 px-5`}
    >
      {loading ? "Scanning..." : "Scan Prescription"}
    </PrimaryButton>
  );
}