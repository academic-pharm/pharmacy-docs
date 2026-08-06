# BUU Pharmacy CPE — Project Context

> อัปเดตล่าสุด: 2026-08-06

## File Locations
- **CPE form system**: `cpe-form-system.html`
- **Auth config**: `auth.js`
- **Academic form**: `academic-form-system.html`
- **Apps Script backend**: `gdrive-upload.gs`
- **Dashboard**: `index.html`
- **GitHub Pages**: `https://academic-pharm.github.io/pharmacy-docs/cpe-form-system.html`
- **Project folder (local)**: `C:\Users\admin\Claude\Projects\โครงการบริการวิชาการ และ CPE\`

## Current Apps Script URL
`https://script.google.com/macros/s/AKfycbz7n_WT63VSW_BH6Eqdju0kOzT8Qh0cmiNBvpU2jnoPE0aauyZPTXnBSWRQt9s15v8H3w/exec`
(ต้อง redeploy ทุกครั้งที่แก้ .gs และอัพเดต URL ใน HTML ทั้ง 2 ไฟล์)

## Google OAuth Client ID
`299883355949-q40iqlagj0kj3oqlt9lfhs7aiii3g0vh.apps.googleusercontent.com`

## Users (auth.js ALLOWED_EMAILS)
- `thiraphong.ge@go.buu.ac.th` — admin
- `zporsupreme@gmail.com` — regular user (test/primary)
- `thiraphong.por@gmail.com` — regular user
- `p2liftza@gmail.com` — regular user

---

## Core Architecture

### Authentication
- Firebase Auth → `firebase.auth().currentUser`
- `getCanonicalEmail()` → resolves alias email → canonical BUU email (fire-and-forget, ห้าม await)
- `getUser()` → อ่านจาก sessionStorage (มี canonical email)
- `isAdmin(getUser())` — ใช้ `getUser()` เสมอ ไม่ใช่ Firebase Auth user (alias email ทำให้ isAdmin ผิด)
- `emailToFbKey(email)` → แทน `.` ด้วย `_`, `@` ด้วย `__`

### Firebase Realtime Database Paths
```
pharma-form/
├── _org_requests/{key}                    # เจ้าของ: submittedBy
├── _cpe_orgs/{orgKey}                     # เขียนได้แค่ admin
├── _cpe_renewals/{orgKey}/{timestamp}
├── _all_cpe_conferences/{confId}          # เจ้าของ: createdBy
├── _all_articles/{aid}                    # เจ้าของ: userEmail
├── _aliases/{emailFbKey}                  # alias → canonical email
├── _settings/
└── {emailFbKey}/
    ├── cpe-conferences/{confId}
    └── articles/{aid}
```

### Firebase Security Rules (อัปเดต 2026-08-01)
- `pharma-form` root: `.read = auth != null` — ทุกคนที่ login อ่านได้ทั้งก้อน
- `_cpe_orgs`: เขียนได้แค่ admin
- `_org_requests` / `_cpe_renewals`: สร้างใหม่ได้ทุกคนที่ login, แก้/อนุมัติแค่ admin
- `_all_cpe_conferences` / `_all_articles`: เขียนได้เจ้าของ/admin เท่านั้น
- สำเนา rules อยู่ที่ `firebase-rtdb-rules-proposed.json`

---

## index.html Dashboard (แก้ 2026-08-01)
**Pitfall:** `isAdmin(user)` ใน `onAuthStateChanged` → ใช้ alias email → ผิด  
**Fix:** `isAdmin(getUser())` — session user มี canonical email ที่ถูกต้อง  
**Commits:** be61b0c → 0da62dc → c969e40

---

## Sidebar Lock System
| Flag | เงื่อนไข | Gates |
|---|---|---|
| `_renewalUnlocked` | มี org request ที่ไม่ถูก deletedByAdmin | si-renewal, si-renew-status |
| `_cpeUnlocked` | org อนุมัติแล้ว มี orgCode + registrationDate + expiryDate | si-conf, si-article |

## Article Status Flow
```
submitted → docs_reviewed → sent_to_experts → expert_feedback_r1
→ user_revised_r1 → expert_certified → user_final_revised → completed
(also: cancelled)
```

## deletedByAdmin Flag
เมื่อ admin ลบ org: set `deletedByAdmin: true` + ล้าง orgCode/dates  
Frontend กรอง: `_myApprovedOrgs = myReqs.filter(e => e[1].status === 'อนุมัติแล้ว' && !e[1].deletedByAdmin)`

## Org Field Name Convention
- เก่า: `o.code`, `o.approvalDate`
- ใหม่: `o.orgCode`, `o.registrationDate`
- อ่านเสมอ: `o.orgCode || o.code`, `o.registrationDate || o.approvalDate`

## KPI Activity Logging
`logActivity()` → Apps Script → tab "ประวัติกิจกรรม"  
9 columns: วันที่-เวลา | ผู้ใช้งาน | หน่วยงาน | หมวดหมู่ | ประเภทกิจกรรม | รายละเอียด | ชื่อไฟล์ | URL ไฟล์ | รหัสอ้างอิง

## Sheet Column Positions — ประชุมวิชาการ tab
- col 18 = รหัสประชุม (confId)
- col 19 = ผลการพิจารณา (PDF)
- col 20 = วันที่ยืนยันผล
