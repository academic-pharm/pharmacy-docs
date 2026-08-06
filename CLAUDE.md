# BUU Pharmacy CPE — Project Context for AI Assistants

## File Locations
| File | Path |
|------|------|
| CPE form system | `cpe-form-system.html` |
| Auth config | `auth.js` |
| Academic form | `academic-form-system.html` |
| Apps Script backend | `gdrive-upload.gs` |
| Live URL | https://academic-pharm.github.io/pharmacy-docs/cpe-form-system.html |

## ⛔ CRITICAL RULES — อ่านก่อนทำงานทุกครั้ง

### AI Context & Memory
ก่อนเริ่มงานกับ repository นี้ ต้องอ่านไฟล์เหล่านี้:
1. `CLAUDE.md` (ไฟล์นี้) — กฎถาวร, Firebase paths, pitfalls
2. `CONTEXT.md` — ประวัติการตัดสินใจและเหตุผล
3. `HANDOFF.md` — สถานะงานล่าสุด, งานค้าง, commit ล่าสุด
4. `AGENTS.md` — กฎสำหรับ Codex และ AI agent อื่น
5. `memory/project.md` — project architecture, features, Firebase structure
6. `memory/feedback.md` — behavioral rules, coding preferences

กฎนี้ใช้กับ AI ทุกตัว รวมถึง Claude, Claude Code, Codex และ AI อื่น ห้ามเลือกอ่านเพียงไฟล์เดียว

**memory/ folder ใน git repo = memory หลักที่ย้ายเครื่องได้**  
เมื่อผู้ใช้บอกว่า **"จดจำข้อมูลทั้งหมด"** หรือ **"บันทึกข้อมูลทั้งหมด"** ให้อัปเดตพร้อมกันครบ 5 แหล่ง:
1. `CLAUDE.md` — กฎถาวร, pitfalls (ถ้ามีกฎใหม่)
2. `CONTEXT.md` — ประวัติการตัดสินใจ
3. `HANDOFF.md` — สถานะงานล่าสุด
4. `AGENTS.md` — กฎสำหรับ Codex และ AI agent อื่น
5. Mem0 `add_memory` (`user_id: zporsupreme@gmail.com`)

### ห้ามแก้ไข login.html เด็ดขาด
เคยทำให้ auth พัง สำหรับ user ทุกคน  
→ Auth logic ทั้งหมดแก้ใน `cpe-form-system.html` ที่ initAuth block เท่านั้น  
→ เพิ่ม/ลบ user แก้ใน `auth.js` (ALLOWED_EMAILS) เท่านั้น

### ห้ามลบไฟล์ถาวร
→ ย้ายไปที่ `C:\Users\admin\Claude\Projects\โครงการบริการวิชาการ และ CPE\รอ Delete\` เสมอ  
→ ห้ามใช้ rm / del / unlink ไม่ว่ากรณีใดก็ตาม

### Git workflow
→ `git add` + `git commit` ในระบบได้  
→ **AI ได้รับอนุญาตให้ `git push` ได้** — ตรวจสอบ branch, remote, commit และขอบเขตก่อน push ทุกครั้ง; ห้าม force-push เว้นแต่ผู้ใช้สั่งโดยตรง
→ ถ้าติด HEAD.lock: `Remove-Item -Force .git\HEAD.lock` ด้วย PowerShell

### R0–R2 Safety
- **R0:** ทุกคำสั่งที่ย้อนกลับไม่ได้ (ลบ/ย้าย/เขียนทับ/deploy) → ถามยืนยันก่อนเสมอ; `git push` ใช้สิทธิ์ถาวรตาม Git workflow ด้านบน
- **R1:** ไม่แน่ใจว่า user ต้องการอะไร → ถามก่อน ห้ามเดา  
- **R2:** รอ "ยืนยัน" จาก user ก่อนจึงดำเนินการ ยกเว้นการ `git push` ปกติที่ผู้ใช้อนุญาตถาวรแล้ว

---

## Authentication & Users

```javascript
// auth.js — ALLOWED_EMAILS
thiraphong.ge@go.buu.ac.th   // admin
zporsupreme@gmail.com         // regular user (primary/test)
thiraphong.por@gmail.com      // regular user
p2liftza@gmail.com            // regular user
```

```javascript
// Firebase key encoding
emailToFbKey(email) // replaces . → _ and @ → __
// e.g. zporsupreme@gmail.com → zporsupreme__gmail_com
```

**สำคัญ:** ใช้ `getCanonicalEmail()` ไม่ใช่ `currentUser.email` ตรงๆ  
User login ด้วย alias gmail แต่ข้อมูลเก็บภายใต้ BUU email → ถ้าใช้ `currentUser.email` ตรงๆ จะ return empty array  
`getCanonicalEmail()` อ่านจาก module-level var `_canonicalEmail` ที่ resolve ผ่าน `_resolveEmail()` (query `_aliases`) แบบ **fire-and-forget ในพื้นหลังเท่านั้น**

⚠️ **ห้ามทำให้ `initAuth()` รอ (`await`/`.then()`) ผลของ `_resolveEmail()` ก่อนเรียก `loadMyOrgRequests`/`loadOrgRequests`/ฯลฯ เด็ดขาด** — เคยลองแล้ว promise ค้างเงียบๆ ไม่ resolve/reject เลย (ไม่มี error ใน console) ทำให้ข้อมูลทั้งฝั่ง user และ admin หายทั้งหน้าใน production (ดู CONTEXT.md session 2026-08-01 เพิ่มเติม 2) แก้โดยให้ `initAuth()` โหลดข้อมูลแบบ synchronous เหมือนเดิมเสมอ แล้วค่อย resolve email ทีหลังแบบไม่ block อะไร

---

## Firebase Realtime Database Paths

```
pharma-form/
├── _org_requests/{key}                    # คำขอลงทะเบียนหน่วยงาน — เจ้าของ: submittedBy
├── _cpe_orgs/{orgKey}                     # หน่วยงานที่อนุมัติแล้ว — เขียนได้แค่ admin
├── _cpe_renewals/{orgKey}/{timestamp}     # การต่ออายุ — ⚠️ ไม่มี field ระบุผู้ส่ง (ไม่มี owner model)
├── _all_cpe_conferences/{confId}          # ประชุมวิชาการ (ทั้งหมด) — เจ้าของ: createdBy — อ่านได้แค่ admin (มี PII)
├── _all_articles/{aid}                    # บทความ (ทั้งหมด) — เจ้าของ: userEmail (ไม่ใช่ submittedBy!) — อ่านได้แค่ admin
├── _aliases/{emailFbKey}                  # email alias → canonical email — เขียนได้แค่ admin (ผ่าน console เท่านั้น ไม่มี UI)
├── _users/{emailFbKey}                    # registry ของ academic-form-system.html
├── _approved_/approved-docs, approved-pdf # academic-form-system.html เท่านั้น
├── _settings/                             # ตั้งค่าระบบ — อ่านได้ทุกคน เขียนได้แค่ admin
└── {emailFbKey}/
    ├── cpe-conferences/{confId}           # ประชุมวิชาการ (ของ user) — สำเนาส่วนตัว
    └── articles/{aid}                     # บทความ (ของ user) — สำเนาส่วนตัว
```

⚠️ **`_all_cpe_conferences` และ `_cpe_conferences` ไม่ใช่ path เดียวกัน** — ชื่อจริงในโค้ดคือ `_all_cpe_conferences` เท่านั้น (path เก่าที่เคยเขียนผิดในเอกสารนี้แก้ไขแล้ว 2026-08-01)

---

## Security Model — Firebase RTDB Rules คือด่านป้องกันจริง ไม่ใช่ JS

⚠️ **`if (isAdmin)` ในโค้ด JS เป็นแค่ UX (ซ่อนปุ่ม) ไม่ใช่ security boundary** — แอปนี้ไม่มี backend เป็นของตัวเอง ผู้ใช้เปิด browser console เรียก Firebase SDK ตรงๆ ได้เสมอ **Firebase Realtime Database Security Rules คือด่านป้องกันจริงด่านเดียว**

Rules ปัจจุบัน (อัปเดต 2026-08-01, เก็บสำเนาไว้ที่ `firebase-rtdb-rules-proposed.json`):
- `pharma-form` root: **อ่านได้ทุกคนที่ login** (`auth != null`) — เปิดเพื่อให้ dashboard index แสดงข้อมูลได้ครบสำหรับทุก user
- `_cpe_orgs` เขียนได้แค่ admin (`auth.token.email == 'thiraphong.ge@go.buu.ac.th'`)
- `_org_requests` / `_cpe_renewals`: สร้างใหม่ทำได้ทุกคนที่ login, **แก้ไข/อนุมัติได้แค่ admin**
- `_all_cpe_conferences` / `_all_articles`: เขียนได้เฉพาะเจ้าของเรคคอร์ด (เช็ค `createdBy`/`userEmail`) หรือ admin — **read ได้ทุกคนที่ login** (cascade จาก parent)
- `$userFbKey` subtree ส่วนตัว: `auth != null` (ไม่ล็อคเจาะจงเจ้าของ)

**ก่อนเพิ่ม Firebase path หรือฟีเจอร์ใหม่ที่มีการเขียนข้อมูล:** ต้องเช็ค/อัปเดต Rules คู่กันเสมอ อย่าพึ่ง `isAdmin` check ใน JS เพียงอย่างเดียว — ดูรายละเอียดการออกแบบและ test case ทั้งหมดใน CONTEXT.md (session 2026-08-01 เพิ่มเติม 3)

---

## Sidebar Lock System (2-tier)

| Flag | เงื่อนไข true | Gates |
|------|--------------|-------|
| `_renewalUnlocked` | มี org request ที่ไม่ถูก deletedByAdmin | si-renewal, si-renew-status |
| `_cpeUnlocked` | org อนุมัติแล้วมี orgCode + registrationDate + expiryDate | si-conf, si-article |

```css
.si-locked { opacity: 0.42; cursor: not-allowed; }
```

---

## deletedByAdmin Flag

เมื่อ admin ลบ org จาก _org_requests:
- set `deletedByAdmin: true` + `deletedByAdminAt`
- ล้าง `orgCode`, `orgKey`, `registrationDate`, `expiryDate`

Frontend:
```javascript
_myApprovedOrgs = myReqs.filter(e => e[1].status === 'อนุมัติแล้ว' && !e[1].deletedByAdmin)
_renewalUnlocked = myReqs.some(e => !e[1].deletedByAdmin)
// แสดง card "ถูกลบแล้ว" พร้อมปุ่ม dismiss
// localStorage key: dismissed_deleted_{reqKey}
```

---

## Article Status Flow

```
submitted → docs_reviewed → sent_to_experts → expert_feedback_r1
→ user_revised_r1 → expert_certified → user_final_revised → completed
(also: cancelled)
```

---

## Apps Script

```
URL: https://script.google.com/macros/s/AKfycbz7n_WT63VSW_BH6Eqdju0kOzT8Qh0cmiNBvpU2jnoPE0aauyZPTXnBSWRQt9s15v8H3w/exec
```
⚠️ ต้อง redeploy ทุกครั้งที่แก้ `.gs` และอัปเดต URL ใน HTML ทั้ง 2 ไฟล์

**Google OAuth Client ID:** `299883355949-q40iqlagj0kj3oqlt9lfhs7aiii3g0vh.apps.googleusercontent.com`

---

## Technical Pitfalls

1. **`</script>` ใน comment** — ห้ามใช้ literal `</script>` ใน script block → ใช้ `<\/script>` แทน (HTML parser จะตัด script block ทันที)

2. **var hoisting ใน initAuth IIFE** — `initAuth()` รัน synchronous ตอนโหลดหน้า ตัวแปร `var` ที่ประกาศหลัง IIFE (~บรรทัด 1770) จะยังเป็น `undefined` → ประกาศตัวแปรก่อน initAuth เสมอ

3. **html2canvas ใน iframe** — ต้องใช้ `iframe.contentWindow.html2canvas()` ไม่ใช่ main window → เพื่อให้ font TH Sarabun render ใน PDF ถูกต้อง

4. **Array reorder** — "find after splice" pattern: `splice` src ออกก่อน → `findIndex` tgt ในตำแหน่งใหม่ → `splice` in

---

## Google Sheet Policy

ทุก feature ใหม่ต้องออกแบบ Sheet column ให้เก็บข้อมูลครบ:  
timestamp, ผู้ส่ง, สถานะ, URL ไฟล์, metadata, action logs  
(user ต้องการนำไปวิเคราะห์ KPI ในอนาคต)

Tab "ประวัติกิจกรรม": วันที่-เวลา | ผู้ใช้งาน | หน่วยงาน | หมวดหมู่ | ประเภทกิจกรรม | รายละเอียด | ชื่อไฟล์ | URL ไฟล์ | รหัสอ้างอิง

---

## Language

ตอบเป็น**ภาษาไทย**เสมอ

---

## Memory checkpoint — 2026-08-06

- ยืนยันชื่อไฟล์มาตรฐานสำหรับ Codex คือ `AGENTS.md` (พหูพจน์) ไม่ใช่ `AGENT.md`
- เมื่อผู้ใช้สั่ง “ให้จดจำข้อมูลทั้งหมด” ต้องอัปเดตครบ 5 แหล่ง: `CLAUDE.md`, `CONTEXT.md`, `HANDOFF.md`, `AGENTS.md` และ Mem0
- ความจำที่ต้องย้ายเครื่องให้เก็บใน Git repo; ห้ามบันทึก API key, password, access token หรือ credentials
- ณ checkpoint นี้ dashboard เปิดให้ authenticated users เห็นข้อมูลเหมือน admin ก่อน และอาจทบทวนสิทธิ์ regular user ภายหลัง
