# Android Build & Single Shared APK Distribution Guide

This document explains step-by-step how to build, sign, and package the single shared Android application for **Vidyavahini Group VMS** (`in.vidyavahini.vms`) using Capacitor 6.

---

## Part 1 — Architecture & Multi-Tenant Model

- **Single Shared APK (`in.vidyavahini.vms`)**: A single unified Android APK serves all colleges and branches. No separate APK rebuilds are required when onboarding new campuses.
- **Dynamic Tenant Theming**: When a receptionist or guard logs in with their Login ID (e.g. `vimtech.reception1`), the app dynamically applies the college's branding, logos, and branch settings.
- **Hardware Integration**: Full hardware acceleration and permissions for camera photo capture, QR barcode check-out scanning, and offline IndexedDB deduplication.

---

## Part 2 — Step-by-Step Signed Release APK Build

### Step 1: Generate the Release Keystore (Once per distribution)

```bash
keytool -genkey -v -keystore vidyavahini-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias vidyavahini
```

---

### Step 2: Build & Sync

```bash
# 1. Compile Vite production bundle and sync Capacitor assets
npm run build:android
```

---

### Step 3: Assemble the Signed Release APK

```bash
# From the project root:
npm run build:apk
```

The signed release APK will be generated at:
`android/app/build/outputs/apk/release/app-release.apk`

---

## Part 3 — Dedicated Front-Desk Tablet Lockdown Mode

For dedicated front-desk security tablets:

1. **Android App Pinning (Screen Pinning)**:
   - Go to Android **Settings** > **Security** > **App Pinning** > Turn **ON**.
   - Open the **Vidyavahini VMS** app.
   - Tap Overview (Recent Apps) > Tap the app icon > Select **Pin**.
   - Receptionists / guards remain secured inside the VMS app without unauthorized device tampering.

2. **Always-On Screen & Immersive Display**:
   - Enable **Developer Options** > **Stay Awake** (Screen will never sleep while charging at the security desk).
   - The app runs in full hardware acceleration with smooth touch transitions.

