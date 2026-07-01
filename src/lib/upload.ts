// src/lib/upload.ts
// Simple multipart uploader for images taken with ImagePicker
// TODO: change API_BASE to your backend URL
const API_BASE = "https://your.api.example.com"; // ← replace me

export async function uploadPhoto(uri: string, fieldName = "file") {
  const name = uri.split("/").pop() || "photo.jpg";
  // naive MIME by extension
  const ext = name.split(".").pop()?.toLowerCase();
  const type =
    ext === "png" ? "image/png" :
    ext === "heic" ? "image/heic" :
    ext === "webp" ? "image/webp" :
    "image/jpeg";

  const form = new FormData();
  form.append(fieldName as any, {
    uri,
    name,
    type,
  } as any);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    // Let React Native set the proper multipart boundary
    headers: { Accept: "application/json" },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[upload] ${res.status} ${text}`);
  }
  return res.json(); // { url: "...", ... } adjust to your API shape
}
