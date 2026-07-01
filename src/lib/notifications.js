// src/lib/notifications.js
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

let initialized = false;

/* ---------------- Handler (module-level) ---------------- */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,  // show banner/alert even in foreground
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ---------------- Map helpers ---------------- */
const MAP_KEY = "doseNotifMap"; // doseId -> [notificationIds]

async function getMap() {
  try {
    const raw = await AsyncStorage.getItem(MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
async function setMap(m) {
  try {
    await AsyncStorage.setItem(MAP_KEY, JSON.stringify(m));
  } catch {}
}
async function link(doseId, notifId) {
  const m = await getMap();
  const arr = m[doseId] || [];
  arr.push(notifId);
  m[doseId] = arr;
  await setMap(m);
}

/* ---------------- Init ---------------- */
export async function initNotifications() {
  if (initialized) return;
  initialized = true;

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("[notif] permission not granted:", status);
      }
    }
  } catch (e) {
    console.warn("[notif] permissions error:", e);
  }

  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 200, 200, 200],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync("meds", {
        name: "Medication Reminders",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (e) {
      console.warn("[notif] channel error:", e);
    }
  }

  console.log("[notif] initialized");
}

/* ---------------- Trigger helper ---------------- */
function buildExactTrigger(date) {
  if (Platform.OS === "android") {
    return { type: "date", date, channelId: "meds" };
  }
  return { type: "date", date };
}

/* ---------------- API ---------------- */
/** dose = { doseId, whenISO, ... } */
export async function scheduleDoseNotification(dose, medName) {
  const when = new Date(dose.whenISO);
  if (when.getTime() <= Date.now()) {
    console.log("[notif] skip past dose", dose.doseId);
    return null;
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to take your Meds 💊",
        body: `${medName} — ${when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        sound: "default",
        data: { doseId: dose.doseId },
      },
      trigger: buildExactTrigger(when),
    });
    await link(dose.doseId, id);
    console.log("[notif] scheduled", dose.doseId, when.toISOString(), "->", id);
    return id;
  } catch (e) {
    console.warn("[notif] schedule failed:", e);
    return null;
  }
}

export async function scheduleMany(doses, medName) {
  for (const d of doses) {
    await scheduleDoseNotification(d, medName);
  }
}

export async function cancelNotificationsForDose(doseId) {
  const map = await getMap();
  const ids = map[doseId] || [];
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
  delete map[doseId];
  await setMap(map);
  console.log("[notif] cancelled for dose", doseId);
}

export async function cancelAllScheduled() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await setMap({});
  console.log("[notif] cancelled all scheduled");
}

export async function scheduleTestIn(seconds = 5) {
  const when = new Date(Date.now() + seconds * 1000);
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: "Test reminder 💊", body: `Fires in ${seconds}s`, sound: "default" },
    trigger: buildExactTrigger(when),
  });
  console.log("[notif] test scheduled", id, "for", when.toISOString());
  return id;
}

export async function listScheduled() {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  console.log("[notif] pending:", pending);
  return pending;
}
