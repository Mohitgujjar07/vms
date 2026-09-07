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

Place `vidyavahini-release-key.jks` in `android/app/` (or anywhere — see Step 2).
**Never commit the `.jks` file or its passwords to source control.**

### Step 2: Provide Signing Credentials

`android/app/build.gradle` reads signing secrets from environment variables
(or `~/.gradle/gradle.properties`) — there are **no hardcoded passwords**:

| Variable | Purpose | Default |
|---|---|---|
| `VMS_KEYSTORE_FILE` | Path to keystore | `vimtech-release-key.jks` |
| `VMS_KEYSTORE_PASSWORD` | Keystore password | *(none — must set)* |
| `VMS_KEY_ALIAS` | Key alias | `vidyavahini` |
| `VMS_KEY_PASSWORD` | Key password | *(none — must set)* |

**Option A — Environment variables (CI / one-off shells):**

```bash
export VMS_KEYSTORE_FILE=/secure/path/vidyavahini-release-key.jks
export VMS_KEYSTORE_PASSWORD='********'
export VMS_KEY_ALIAS=vidyavahini
export VMS_KEY_PASSWORD='********'
```

**Option B — `~/.gradle/gradle.properties` (personal machine, outside repo):**

```properties
VMS_KEYSTORE_FILE=C:/secure/path/vidyavahini-release-key.jks
VMS_KEYSTORE_PASSWORD=********
VMS_KEY_ALIAS=vidyavahini
VMS_KEY_PASSWORD=********
```

---

### Step 3: Build & Sync

```bash
# 1. Compile Vite production bundle and sync Capacitor assets
npm run build:android
```

---

### Step 4: Assemble the Signed Release APK

```bash
# From the project root:
npm run build:apk
```

The signed release APK will be generated at:
`android/app/build/outputs/apk/release/app-release.apk`

> **Play Store note:** For Google Play distribution, prefer an **App Bundle**
> (`gradlew bundleRelease` → `app-release.aab`) and enroll in Play App Signing.
> The upload key is the keystore generated above.

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

