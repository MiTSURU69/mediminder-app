MediMinder

A medication reminder app for Android that turns a photographed prescription into scheduled reminders — no manual data entry required.

Built at HackVerse '25 with a team; developed solo since.

Why

Most medication reminder apps assume you're willing to type in every drug, dose, and time slot by hand. Nobody does that consistently, which is exactly when reminders matter most. MediMinder starts from the artifact people already have — the prescription itself — and gets a usable reminder schedule out of it in one flow.

What it does
Photograph a prescription → OCR extracts drug names, dosages, and timing (Llama vision)
Or speak it → a voice-input route transcribes and parses medication details (Groq Whisper)
Reminders fire as sticky Android notifications that stay put until acknowledged, not just a dismissible banner
Bottom-tab navigation across schedule, history, and prescription views
Tech stack

Frontend — React Native (Expo), TypeScript Backend — Express.js, deployed on Render

POST /ocr — accepts a prescription image, returns structured medication data (Llama vision)
POST /transcribe — accepts audio, returns transcribed + parsed medication input (Groq Whisper)
Design decisions worth flagging

OCR + voice as two entry paths, not one. Prescriptions vary wildly in handwriting quality and format — vision-only OCR fails often enough that a fallback mattered more than a second polish pass on the primary path. Voice input covers the cases where OCR confidence is low or the prescription is a verbal instruction from a pharmacist rather than a printed slip.

Cold-start messaging instead of a fix. The backend runs on Render's free tier, which sleeps after inactivity and can take 20-30s to wake on the first request. Rather than eating that cost with a paid tier before validating the product, the app surfaces an explicit "waking up" state so the delay reads as expected behavior instead of a hang. A deliberate trade of infra spend for UX polish, reversible once there's a reason to pay for uptime.

Sticky notifications over standard ones. Medication reminders that can be swiped away without action defeat the point. Sticky notifications trade a bit of notification-tray politeness for actually getting acknowledged.

Status

Prescription OCR flow is confirmed working end-to-end. EAS build is configured for sideloaded APK distribution (not yet on the Play Store).

Setup
bash
# Frontend
git clone https://github.com/MiTSURU69/mediminder-app
cd mediminder-app
npm install
npx expo start
bash
# Backend
git clone https://github.com/MiTSURU69/mediminder-1
cd mediminder-1
npm install
npm start
