// src/screens/CameraScreen.tsx
import React, { useCallback, useState } from "react";
import { View, Alert, Button, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CameraCapture from "../components/CameraCapture";
import PrescriptionProcessor from "../components/PrescriptionProcessor";
import tw from "../lib/tw";

// NEW imports for gallery / bundled asset test
import * as ImagePicker from "expo-image-picker";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

/**
 * CameraScreen
 * - Uses existing CameraCapture
 * - On capture, extracts a valid image URI and opens PrescriptionProcessor
 * - Provides two reliable test options:
 *    1) Pick test image from gallery
 *    2) Use bundled asset (assets/test.jpg) -> copies it to cache and uses that URI
 *
 * Make sure you have a sample image at: <project-root>/assets/test.jpg if you want to use the bundled option.
 */

export default function CameraScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);

  const extractImageUri = useCallback((res: any): string | null => {
    console.log("[CameraScreen] raw camera response:", res);
    if (!res) return null;
    // string uri
    if (typeof res === "string") return res;
    // older shapes
    if (typeof res.uri === "string") return res.uri;
    // expo-image-picker / camera shape: { canceled: boolean, assets: [{ uri }] }
    if (res.assets && Array.isArray(res.assets) && res.assets[0] && typeof res.assets[0].uri === "string") {
      return res.assets[0].uri;
    }
    // some libs use localUri
    if (typeof res.localUri === "string") return res.localUri;
    return null;
  }, []);

  const handleUploaded = useCallback(
    (res: any) => {
      console.log("[CameraScreen] onUploaded called:", res);
      const uri = extractImageUri(res);
      if (!uri) {
        console.warn("[CameraScreen] could not extract image uri from camera response:", res);
        Alert.alert("Capture failed", "Could not retrieve the captured image. Please try again.");
        return;
      }
      console.log("[CameraScreen] extracted uri:", uri);
      setImageUri(uri);
    },
    [extractImageUri]
  );

  // pick an image from gallery (reliable for dev testing)
  const pickFromGallery = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission required", "Need gallery permission to pick a test image.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
        base64: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      console.log("[CameraScreen] gallery pick result:", res);

      // modern expo-image-picker returns { canceled: boolean, assets: [{ uri, ... }] }
      if ("canceled" in res) {
        if (res.canceled) {
          // user cancelled - nothing to do
          return;
        }
        const uri = res.assets && res.assets[0] && res.assets[0].uri;
        if (uri) {
          setImageUri(uri);
        } else {
          console.warn("[CameraScreen] gallery picked but no uri:", res);
          Alert.alert("Pick failed", "Could not get image URI from gallery result.");
        }
        return;
      }

      // fallback for older shape (deprecated)
      // @ts-expect-error legacy typing
      if (!res.cancelled && (res as any).uri) {
        setImageUri((res as any).uri);
      }
    } catch (err: any) {
      console.error("Gallery pick failed:", err);
      Alert.alert("Error", "Could not pick image: " + String(err?.message ?? err));
    }
  }, []);

  // copy bundled asset (assets/test.jpg) to cache and use that URI
  const useBundledTestImage = useCallback(async () => {
    try {
      // Require the asset relative to this file — ensure assets/test.jpg exists
      const asset = Asset.fromModule(require("../assets/test.jpg"));
      await asset.downloadAsync();
      const src = asset.localUri ?? asset.uri;
      if (!src) throw new Error("Bundled asset URI not available");
      const dest = `${FileSystem.cacheDirectory}test-sample.jpg`;
      // copy to cache directory (safe cross-platform path)
      await FileSystem.copyAsync({ from: src, to: dest });
      console.log("[CameraScreen] copied bundled asset to:", dest);
      setImageUri(dest);
    } catch (err: any) {
      console.error("Bundled image failed:", err);
      Alert.alert("Bundled image failed", String(err?.message ?? err));
    }
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={tw`flex-1 bg-bg`}>
      <View style={tw`flex-1 items-center justify-center`}>
        <CameraCapture onUploaded={(res: any) => handleUploaded(res)} />

        <View style={{ marginTop: 18, width: "90%" }}>
          <Text style={{ textAlign: "center", marginBottom: 8 }}>
            If capture didn't open processor, pick or use a test image:
          </Text>

          <View style={{ marginBottom: 8 }}>
            <Button title="Pick test image from gallery" onPress={pickFromGallery} />
          </View>

          <View style={{ marginBottom: 8 }}>
            <Button title="Use bundled test image (assets/test.jpg)" onPress={useBundledTestImage} />
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>
              Note: for the bundled option place a file at <Text style={{ fontWeight: "700" }}>assets/test.jpg</Text>.
            </Text>
          </View>
        </View>
      </View>

      {imageUri ? (
        <PrescriptionProcessor
          imageUri={imageUri}
          onClose={() => setImageUri(null)}
          onScheduled={() => {
            setImageUri(null);
            Alert.alert("Scheduled", "Reminders scheduled.");
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
