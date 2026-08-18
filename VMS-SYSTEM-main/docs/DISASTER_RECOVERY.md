# VIMTECH VMS — Disaster Recovery Reference Guide

This 1-page operational reference details emergency procedures for database restoration, Android APK rebuilding/re-signing, and failure recovery impact analysis for the **VIMTECH Visitor Management System**.

---

## Part 1 — Database Restoration Procedures

### 1.1 Supabase Dashboard Point-In-Time Recovery (PITR)
*Applicable when Supabase project is on Pro or Enterprise plan.*

1. Open [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Navigate to **Project Settings** → **Database** → **Backups**.
3. Select **Point-in-Time Recovery (PITR)**.
4. Specify the target timestamp (date, hour, minute, second) prior to data loss or corruption.
5. Confirm restoration. The project will restore to the clean point in time within 5–15 minutes.

### 1.2 CLI Manual Backup & Snapshot Restore
*Applicable for manual SQL dumps or Free Tier project restoration.*

```bash
# Step 1: Dump database schema and data from backup file/instance
supabase db dump --db-url "postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" -f vms_disaster_recovery.sql

# Step 2: Restore dump to target Supabase instance
psql "postgres://postgres.[NEW_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" -f vms_disaster_recovery.sql

# Step 3: Verify RLS policies and trigger integrity
psql "postgres://postgres.[NEW_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" -c "SELECT count(*) FROM colleges; SELECT count(*) FROM profiles; SELECT count(*) FROM visits;"
```

---

## Part 2 — Android APK Rebuilding & Re-signing

*Prerequisite: The release keystore `vimtech-release-key.jks` and alias credentials must be intact.*

### 2.1 Verify Keystore Integrity
```bash
keytool -list -v -keystore path/to/vimtech-release-key.jks -alias vimtech
```
*Expected: SHA-256 fingerprint displayed cleanly without password or tamper errors.*

### 2.2 Rebuilding & Re-signing Release APK
```bash
# 1. Compile web bundle
npm run build

# 2. Sync native assets
npx cap sync android

# 3. Assemble release APK via Gradle
cd android
./gradlew assembleRelease

# 4. Sign APK manually with apksigner (if building outside Gradle auto-sign)
apksigner sign --ks path/to/vimtech-release-key.jks --ks-key-alias vimtech app/build/outputs/apk/release/app-release-unsigned.apk

# 5. Verify APK signature
apksigner verify --verbose app/build/outputs/apk/release/app-release.apk
```

---

## Part 3 — Disaster Impact Analysis Matrix

| Failure Scenario | Recoverable Data / Capabilities | Permanently Unrecoverable Data / Capabilities | Resolution & Action Required |
| :--- | :--- | :--- | :--- |
| **Database Corruption / Drop (Pro Plan with PITR)** | **100% Data Recoverable** up to the exact second prior to incident. | None (zero data loss beyond seconds between snapshot & crash). | Trigger Supabase Dashboard PITR restore to target timestamp. |
| **Database Corruption / Drop (Free Plan - No PITR)** | Data up to the last **manual SQL dump** taken. | All visitor visits, logs, and pre-registrations created **after** the last manual dump. | Restore from last manual `.sql` dump via `psql`. Upgrade to Pro plan immediately. |
| **Release Keystore File (`.jks`) Lost / Password Lost** | Hosted Web App code & database remain 100% operational. Installed mobile apps continue loading web core. | **CANNOT UPDATE EXISTING APK INSTANCE**. Google Play Store / Android package manager will reject signed updates due to key signature mismatch. | Must create a **NEW package ID** (`in.vidyavahini.vimtech.vms.v2`), generate a new keystore, and require all college staff to uninstall old app and install new APK. |
| **Local Client Offline Storage Cleared** | Cloud database sync ensures all synced visits are safe. | Un-synced offline check-ins created while device was offline if device memory is physically wiped. | Ensure devices re-connect to internet periodically to flush Dexie/Capacitor sync queue to cloud. |

---

## 🔒 Security Storage Checklist
- [x] **Keystore Primary Backup**: Stored in Team Vault (1Password / Bitwarden).
- [x] **Keystore Secondary Backup**: Offline encrypted storage drive (Cold Backup).
- [x] **Alias & Password**: Recorded securely alongside keystore binary.
- [x] **Database Production Plan**: Upgraded to Supabase Pro Plan for 7-day automated PITR.
