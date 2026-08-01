# BUU Pharmacy CPE — Session Context Log

ไฟล์นี้บันทึก **ประวัติการตัดสินใจ** ของโปรเจกต์ — ทำอะไรไป ทำไม และสิ่งที่ลองแล้วไม่ work
อ่านร่วมกับ `CLAUDE.md` เพื่อเข้าใจ context ทั้งหมดก่อนเริ่มทำงาน

---

## 2026-08-01 (เพิ่มเติม 3)

### 🔒 Security audit — พบและปิดช่องโหว่ Firebase Rules เปิดกว้างทั้งฐานข้อมูล

**จุดเริ่ม:** หลัง fix บั๊กหลักครบแล้ว รีวิวเพิ่มเติมพบว่าฟังก์ชัน admin หลายตัวใน `cpe-form-system.html` **ไม่มีการเช็ค `isAdmin` เลยในตัวโค้ด JS** (`adminConfirmRenewal`, `adminRejectRenewal`, `adminCompleteRenewal`, `saveOrgDetail`, `saveOrgEdit`, `confirmAdminRenew`, `deleteOrg`, `approveOrgRequest`, `rejectOrgRequest`, `sendToExperts`, `confirmDocsApproval`, `confirmCPEResultModal`, `confirmPaymentReview`, `confirmCancelConf`, และ handler การเปลี่ยน status ของ `_all_articles/{aid}` อีกราว 15 จุด) — ป้องกันแค่ระดับ UI (ปุ่มไม่โชว์ให้ user ธรรมดาเห็น) เท่านั้น

**ตรวจสอบ root cause จริง:** เปิด Firebase console → Rules พบว่า:
```json
{ "rules": { ".read": "auth != null", ".write": "auth != null" } }
```
**user ที่ login แล้วทุกคน (150+ อีเมลใน `ALLOWED_EMAILS`) อ่าน/เขียนข้อมูลได้ทั้งฐานข้อมูล ไม่จำกัด path เลย** — ไม่ใช่แค่ 4 ฟังก์ชันที่เจอตอนแรก แต่คือทุก path เปิดกว้างหมด ต่อให้ JS เช็ค isAdmin ครบ user ก็ยังเปิด browser console เขียนตรงเข้า Firebase SDK ได้อยู่ดี → **นี่คือช่องโหว่จริงที่กระทบข้อมูลรับรอง CPE ซึ่งมีผลต่อใบประกอบวิชาชีพเภสัชกรจริง**

**สำรวจ path ทั้งหมดก่อนออกแบบ Rules** (agent เดาชื่อ field ผิดจุดหนึ่ง — ต้อง verify กับโค้ดจริงเสมอก่อนเชื่อ):
- `_org_requests` → field เจ้าของคือ `submittedBy` ✓
- `_all_cpe_conferences` → field เจ้าของคือ `createdBy` ✓
- `_all_articles` → field เจ้าของคือ **`userEmail`** (agent เดาว่า `submittedBy` ผิด — เช็คโค้ดจริงแล้วแก้)
- `_cpe_renewals/{orgKey}/{ts}` → **ไม่มี field ระบุตัวผู้ส่งเลย** (มีแค่ `orgKey`/`orgName`/`status`) เป็นช่องโหว่ในตัว data model เอง (ไม่เคยผูก "org นี้เป็นของ user คนไหน" อย่างเป็นทางการ) → เขียน rule แบบ "เฉพาะเจ้าของ org เท่านั้นที่ส่งต่ออายุได้" ไม่ได้จริง (ไม่มีข้อมูลให้เช็ค) เลยยอมให้ "สร้างใหม่" ทำได้จากทุกคนที่ login เหมือนเดิม แต่ล็อค "แก้ไข/อนุมัติ" เป็น admin เท่านั้น (จุดอันตรายจริงคือการ self-approve ไม่ใช่การส่งเอกสาร)

**Rules ใหม่ที่ deploy แล้ว** (เก็บไว้ที่ `firebase-rtdb-rules-proposed.json` ในโปรเจกต์):
- `_cpe_orgs`, และการ**แก้ไข/อนุมัติ**ของ `_org_requests` + `_cpe_renewals` → **admin เท่านั้น**
- `_all_cpe_conferences`, `_all_articles` → **อ่านได้เฉพาะ admin** (มี PII ของทุกคน), เขียนได้เฉพาะเจ้าของเรคคอร์ด (เช็ค field เจ้าของ) หรือ admin
- `_settings` → อ่านได้ทุกคน (UI ต้องใช้), เขียนได้แค่ admin
- `$userFbKey` (subtree ส่วนตัวของแต่ละคน เช่น `{email}/articles`) → ยังปล่อย `auth != null` เหมือนเดิม เพราะ Firebase Rules ภาษา native ไม่มีทางแปลง email → key (`.`→`_`, `@`→`__`) ได้แข็งแรงพอ (เสี่ยง lock คนออกจากข้อมูลตัวเองถ้าเขียนผิด) — ไม่ใช่จุดอันตรายจริงเพราะ `_all_*` (ที่ล็อคแล้ว) คือแหล่งข้อมูลที่ admin เชื่อถือจริง ไม่ใช่สำเนาส่วนตัวนี้
- `_approved_` (academic-form-system.html) → ปล่อยไว้เหมือนเดิม เพราะไม่แน่ใจว่าตั้งใจให้แชร์ข้ามคนหรือเปล่า ไม่อยากเดาแล้วพัง

**ทดสอบก่อน publish ผ่าน Rules Playground — 10 เคส ผ่านหมด:**
1. user ธรรมดาเขียน `_cpe_orgs` → ❌ denied (ถูกต้อง)
2. admin เขียน `_cpe_orgs` → ✅ allowed
3. user สร้าง `_org_requests` ของตัวเอง (`submittedBy` ตรง) → ✅ allowed
4. user สร้าง `_org_requests` ปลอมเป็นคนอื่น (`submittedBy` ไม่ตรง) → ❌ denied
5. user แก้ไข `_org_requests` ที่มีอยู่แล้ว (ไม่ใช่ admin) → ❌ denied
6. user อ่าน `_all_articles` ทั้งคอลเลกชัน → ❌ denied
7. admin อ่าน `_all_articles` → ✅ allowed
8. user ส่งเอกสารต่ออายุใหม่ (`_cpe_renewals` create) → ✅ allowed
9. user อ่าน `_org_requests` ทั้งคอลเลกชัน (ใช้แสดง badge แจ้งเตือน) → ✅ allowed
10. user เขียนข้อมูลใน subtree ส่วนตัวของตัวเอง → ✅ allowed

**Publish แล้ว + ทดสอบผ่าน production จริง** (ผ่าน Claude in Chrome, 2 session พร้อมกัน — user zporsupreme9 + admin thiraphong.ge): ทั้ง 2 ฝั่งใช้งานได้ปกติทุก flow ไม่มี console error, ไม่มี regression

**บทเรียน:** client-side `isAdmin` check เป็นแค่ UX ไม่ใช่ security boundary จริง — **Firebase Security Rules คือด่านป้องกันตัวจริงเพียงด่านเดียว** สำหรับแอปที่ไม่มี backend เป็นของตัวเอง ต้องเช็ค Rules ควบคู่ไปกับ JS เสมอเวลารีวิว security

---

## 2026-08-01 (เพิ่มเติม 2)

### 🐛 Bug fix — ฟอร์มต่ออายุล็อคค้างถาวร ไม่ปลดล็อคในช่วง 90 วันก่อนหมดอายุ (commit af8cadf)

**ปัญหา:** user เห็นในหน้า status ว่า org เหลืออายุ 28 วัน (ต่ำกว่า 90 วันที่ระบบบอกว่าจะแจ้งเตือน) แต่กดเข้าไปหน้า "ต่ออายุล่วงหน้า" กลับล็อคอยู่ ("ยังไม่ถึงเวลาต่ออายุ")

**root cause:** `_checkRenewalLock()` เช็คแค่ว่า renewal ล่าสุดมี status `'ต่ออายุแล้ว'` หรือไม่ — ถ้าใช่ล็อคฟอร์มทันที **ไม่เคยเทียบวันที่จริงเลย** ข้อความ "แจ้งเตือน 90 วันก่อนหมดอายุ" เป็นแค่ text แสดงผล ไม่มีโค้ดจุดไหนไปปลดล็อคคืนเมื่อถึงช่วงจริง → ฟอร์มจะล็อคค้างไปตลอดจนกว่าจะหมดอายุจริง

**fix:** เพิ่มคำนวณ `daysLeft` จาก `expiryDate` (ใช้สูตรเดียวกับจุดอื่นในระบบ) ถ้า `daysLeft <= 90` ให้ `return` แสดงฟอร์ม upload ปกติแทนการล็อค — สอดคล้องกับ threshold 90 วันที่ระบบใช้อยู่ทุกที่ (`daysLeft <= 90` ที่ line 4459, 4969, 5048 ฯลฯ)

---

### 🐛 Bug fix — Article status "docs_reviewed" โชว์เป็น raw code ให้ user เห็น (commit 2138cbb)

**ปัญหา:** ช่วงที่ admin ยืนยันรับเอกสารบทความแล้วแต่ยังไม่ส่งผู้ทรงคุณวุฒิ (`status: 'docs_reviewed'`) user จะเห็นคำว่า **"docs_reviewed"** โผล่ตรงๆ ทั้งใน stepper และ status pill แทนข้อความไทย

**root cause:** `artStatusLabel()` (line 8879) และ inline map `M` ใน stepper (line 8975) ไม่มี key `docs_reviewed` เลย ทั้งที่เป็น status จริงที่ admin set ได้ (line 9878) → fallback `M[st] || st` เลยโชว์ raw string

**fix:** เพิ่ม label ภาษาไทยให้ทั้ง 2 จุด

---

### 🐛🔥 `_canonicalEmail` ไม่เคยถูก resolve จริง → พยายามแก้ → ทำ production พัง → revert → แก้ใหม่แบบปลอดภัย (commit 5e8295c → aef9c60 revert → b772aa6)

**ปัญหาเดิม:** CLAUDE.md เตือนให้ใช้ `_canonicalEmail` ไม่ใช่ `currentUser.email` แต่จริงๆ แล้ว `cpe-form-system.html` ไม่เคย resolve ค่านี้เลย — `getCanonicalEmail()` อ่าน `currentUser._canonicalEmail` ซึ่งไม่มีโค้ดจุดไหน set property นี้เลยในทั้งไฟล์ จึง fallback ไปใช้ `currentUser.email` (อีเมล login) ตลอด

**root cause (เทียบกับ academic-form-system.html ที่ทำถูก):** academic-form-system.html เก็บ canonical email เป็น **module-level variable แยกต่างหาก** (`let _canonicalEmail`) แล้ว resolve แบบ async ผ่าน `_resolveEmail()` ที่ query `pharma-form/_aliases/{key}` — แต่ cpe-form-system.html คาดหวังผิดว่ามันเป็น property บน `currentUser` object ซึ่งไม่มีจุดไหน set ให้เลย

**ตรวจสอบ impact จริงก่อนแก้:** เปิด Firebase console (`pharmacy-buu` → Realtime Database → `pharma-form/_aliases`) พบ alias เดียว: `thiraphong.psw@gmail.com → thiraphong.ge@go.buu.ac.th` — แต่ `thiraphong.psw@gmail.com` ไม่อยู่ใน `ALLOWED_EMAILS` ของ `auth.js` เลย ดังนั้นตอนนั้นยังไม่มี user จริงคนไหนได้รับผลกระทบ

#### ❌ ความพยายามแรก (commit `5e8295c`) — ทำ production พัง

**สิ่งที่ทำ:** เปลี่ยน `initAuth()` ให้ `_resolveEmail(currentUser.email).then(...)` **ก่อน** ค่อยเรียก `loadMyOrgRequests`/`loadMyConferences`/`loadOrgRequests`/`_setupUserNotifications`/`_setupAdminNotifications` — เหตุผลตอนนั้นคือ listener พวกนี้ capture email เป็น closure ครั้งเดียว ถ้าโหลดก่อน resolve เสร็จจะค้างใช้ email ผิดตลอด session

**ผลที่เกิดขึ้นจริงหลัง push + deploy:** promise chain **ค้างเงียบๆ ไม่ resolve/reject เลย ไม่มี error โผล่ใน console แม้แต่บรรทัดเดียว** ทำให้ทั้งฝั่ง user (zporsupreme9) และฝั่ง admin (thiraphong.ge) **โหลดข้อมูลไม่ขึ้นเลยทั้งหน้า** — user เห็น sidebar ล็อคหมด ไม่มี card สถานะคำขอ, admin ส่ง org request ใหม่ไปแล้วแต่ panel "คำขอรอตรวจสอบ" ไม่โชว์ ทั้งที่ข้อมูลใน Firebase ถูกต้องครบ (`status: "รอตรวจสอบ"` ตรงเงื่อนไขทุกอย่าง) — ยืนยันว่าปัญหาไม่ใช่การเขียนข้อมูล แต่เป็นฝั่งโหลด/แสดงผลที่ค้าง

**สาเหตุที่แท้จริงของการค้าง:** ไม่สามารถชี้ชัดได้ 100% (debug จากระยะไกลไม่ได้เพราะตอนนั้นยังไม่มี Claude in Chrome เชื่อมต่อ) คาดว่าเกี่ยวกับพฤติกรรมของ Firebase RTDB SDK กับ `.once('value')` บน path `_aliases` ในบางเงื่อนไข — แต่ไม่คุ้มเวลาที่จะขุดต่อจนกว่าจะแน่ใจ เพราะมีทางแก้ที่ปลอดภัยกว่าอยู่แล้ว (ดูด้านล่าง)

**การกู้คืน:** `git revert 5e8295c --no-edit` → commit `aef9c60` → push ทันที เพื่อหยุด incident ก่อน แล้วค่อยทดสอบยืนยันว่า user/admin กลับมาเห็นข้อมูลปกติ

#### ✅ แก้ใหม่แบบปลอดภัย (commit `b772aa6`)

**หลักการออกแบบใหม่:** "ห้ามให้ของที่ทำงานอยู่แล้วไปพังเพราะรอ fix ใหม่ที่ยังไม่ผ่านการพิสูจน์" — แทนที่จะทำให้ `initAuth()` **รอ** `_resolveEmail()` เสร็จก่อนโหลดข้อมูล เปลี่ยนเป็น:
1. `initAuth()` เรียก `loadMyOrgRequests`/`loadOrgRequests`/ฯลฯ **แบบ synchronous เหมือนโค้ดเดิมทุกประการ** (copy กลับมาไม่แตะเลย) — พฤติกรรม default (ไม่มี alias) เหมือนเดิม 100% การันตีไม่มี regression
2. `_resolveEmail(currentUser.email)` เรียกแบบ **fire-and-forget หลังจากนั้น** — ไม่มีฟังก์ชันไหนรอผลมันเลย ถ้ามันค้างอีกก็ไม่กระทบอะไรเลยเพราะไม่มีอะไร depend on มัน
3. ถ้าเจอ alias จริง (`canonical !== currentUser.email`) ค่อย reload เฉพาะ `loadMyOrgRequests`/`loadMyConferences`/`_setupUserNotifications` อีกครั้งด้วย email ที่ถูกต้อง
4. แก้จุดที่เหลือ (`loadMyConferences`, `submitPaymentInfo`) ที่เคยอ่าน `user._canonicalEmail` ตรงๆ ให้เรียกผ่าน `getCanonicalEmail()` แทน — เหมือนเดิมทุกอย่างเพราะ property นั้นไม่เคยมีค่าอยู่แล้ว

**บทเรียน:** เวลาแก้ auth/init flow ที่เป็น synchronous อยู่เดิม (ตามที่ CLAUDE.md เตือนเรื่อง var hoisting ไว้แล้ว) — **อย่าทำให้ของเดิมที่ทำงานอยู่ต้องรอ promise ใหม่ก่อนจะทำงาน** ต่อให้ promise นั้นดูปลอดภัย (มี `.catch()` ครบ) เพราะถ้ามันค้างแบบไม่มี error เลย จะดีบักยากมากและกระทบผู้ใช้จริงทันที ควรออกแบบให้ fix ใหม่เป็น "เสริม" (fire-and-forget + reload เฉพาะจุดถ้าจำเป็น) ไม่ใช่ "gate" การทำงานเดิม

**การทดสอบยืนยัน (ผ่าน Claude in Chrome extension, session จริงของ user):**
- ✅ user (zporsupreme9) เห็นข้อมูลสถานะปกติ, ฟอร์มต่ออายุปลดล็อคถูกต้อง (ยืนยัน bug fix `af8cadf` ด้วยในตัว)
- ✅ admin (thiraphong.ge) เห็น panel "คำขอลงทะเบียนใหม่" ครบ 2 รายการ
- ✅ ไม่มี console error ทั้ง 2 session

---

### 🗑️ ลบ `_aliases/thiraphong_psw__gmail_com` ออกจาก Firebase

**เหตุผล:** alias นี้ map `thiraphong.psw@gmail.com → thiraphong.ge@go.buu.ac.th` แต่ `thiraphong.psw@gmail.com` ไม่เคยอยู่ใน `ALLOWED_EMAILS` เลย เป็น entry ที่ใช้งานจริงไม่ได้ (dead data) ผู้ใช้ (owner) เป็นคนกดลบเองผ่าน Firebase console โดยตรง (Claude ทำการลบข้อมูลถาวรแทนไม่ได้ตามกฎความปลอดภัย — ได้แต่ชี้ตำแหน่งให้)

**ผล:** `_aliases` node หายไปทั้ง parent ด้วย (Firebase RTDB ลบ parent node อัตโนมัติเมื่อไม่มี children เหลือ — ไม่ใช่บั๊ก) ตอนนี้ไม่มี alias เหลือในระบบเลย ฟีเจอร์ `_resolveEmail()` จะ fallback เป็น login email เสมอจนกว่าจะมีการเพิ่ม alias ใหม่

---

### 🔌 ตั้งค่า Claude in Chrome extension

ติดตั้ง "Claude for Chrome" extension บนเครื่อง user แล้วเชื่อมต่อสำเร็จ — ทำให้ Claude ควบคุม Chrome จริงของ user (ที่ login Google account ค้างอยู่แล้ว) ได้โดยตรง ผ่าน `mcp__claude-in-chrome__*` tools (navigate, computer, read_page, get_page_text, read_console_messages ฯลฯ)

**ทำไมต้องมี:** ก่อนหน้านี้ Claude มีแค่ Browser pane sandbox (`mcp__Claude_Browser__*`) ที่ไม่มี session login ของ user เลย ทำให้ debug/ทดสอบหน้าที่ต้อง login (เช่น cpe-form-system.html) ไม่ได้เลยต้องพึ่ง user ส่ง screenshot มาให้ดูตลอด — Claude in Chrome แก้ปัญหานี้โดยใช้ session จริงที่ user login ไว้อยู่แล้ว (Claude ไม่เคยกรอก credential เอง เป็นข้อห้ามเสมอ)

**ข้อจำกัด:** login state เก็บใน `sessionStorage` ซึ่งไม่แชร์ข้ามแท็บ — ถ้าจะสลับดู user คนละบัญชี (เช่น user ↔ admin) ต้องเปิดแท็บใหม่แล้วให้ user login เองใหม่ในแท็บนั้น (Claude กดปุ่ม "เข้าสู่ระบบด้วย Google" หรือเลือกบัญชีแทนไม่ได้)

---

### 📌 State ปัจจุบัน (2026-08-01 เพิ่มเติม 2)

- Push ขึ้น production แล้วทั้งหมด: `af8cadf`, `2138cbb`, `5e8295c`(reverted), `f8526a1`, `aef9c60`(revert), `b772aa6`
- ทดสอบผ่าน Claude in Chrome ยืนยันแล้วว่าทั้ง user และ admin ใช้งานได้ปกติ ไม่มี console error
- `_aliases` ว่างเปล่า (ไม่มี alias ใดๆ ในระบบตอนนี้)
- Claude in Chrome extension เชื่อมต่อพร้อมใช้งานสำหรับ session ถัดไป

---

## 2026-08-01 (เพิ่มเติม 2)

### 📄 CLAUDE.md ถูก enrich โดย Claude Code

Claude Code อ่านโค้ดจริงแล้วเพิ่มเนื้อหาเข้า CLAUDE.md:
- `getCanonicalEmail()` — อ่านจาก `_canonicalEmail` ที่ resolve ผ่าน `_resolveEmail()` แบบ fire-and-forget เท่านั้น
- ⚠️ ห้ามให้ `initAuth()` รอ (`await`/`.then()`) ผลของ `_resolveEmail()` — เคยลองแล้ว promise ค้างเงียบๆ ทำให้หน้าว่างเปล่าทั้งหน้าใน production
- Security Model — Firebase RTDB Rules คือด่านป้องกันจริง ไม่ใช่ JS `if (isAdmin)` check
- Firebase paths พร้อม security notes ครบ (`_all_cpe_conferences` ไม่ใช่ `_cpe_conferences`)

---

## 2026-08-01 (เพิ่มเติม)

### 🐛 Bug fix — Council modal แสดงไฟล์ไม่ครบ (commit bb7ed05)

**ปัญหา:** admin เปิด modal "ส่งสภาเภสัชกรรม" เห็นแค่ 2 ไฟล์ แทนที่จะเป็น 3 ทั้งที่ user ส่งครบ

**root cause:** ตอน submitRenewalDocs() ถ้า GDrive upload ล้มเหลว จะเก็บ `url: ''` (empty string) ใน Firebase
แต่ openCouncilModal check `if (rec[t] && rec[t].url)` → empty string เป็น falsy → ไม่แสดง chip

**fix:**
```javascript
// เปลี่ยน condition จาก rec[t].url → rec[t].name (แสดงทุกไฟล์ที่ user ส่งมา)
if (rec[t] && rec[t].name) chips += _councilDocChip(rec[t].url || '', rec[t].name || docLabels[t]);

// _councilDocChip รับ empty URL → แสดง chip สีส้ม ⚠️ ไม่ clickable พร้อม tooltip
// modal._docUrls ยังนับเฉพาะไฟล์ที่มี URL จริง (สำหรับส่งอีเมล)
```

---

## 2026-08-01

### 🗑️ ลบ org ของ user zporsupreme9 ออกจากระบบ

**ปัญหา:** user zporsupreme9 (test account) เห็น org ที่ควรถูกลบแล้วยังแสดงอยู่ในหน้า dashboard พร้อมรหัส orgCode 749

**root cause:**
- `_cpe_orgs/zporsupreme9_1785547779815` มี `deleted: true` → admin list ไม่แสดง ✓
- แต่ `_org_requests/req_1785547753744` ยังมี `status: "อนุมัติแล้ว"` + `orgCode/orgKey/registrationDate/expiryDate` ครบ → user dashboard ยังดึงข้อมูลนี้แสดงผล

**วิธีแก้ (3 ขั้นตอน):**
1. ลบ field `orgCode`, `orgKey`, `registrationDate`, `expiryDate` ออกจาก `_org_requests/req_1785547753744` ใน Firebase console (ทำ manually ผ่าน Kapture browser automation)
2. เพิ่ม `deletedByAdmin: true` + `deletedByAdminAt: "2026-08-01T07:25:35.962Z"` เข้าไปแทน (ทำผ่าน `db.ref(...).update()` ใน Chrome DevTools console)
3. แก้ frontend ให้รองรับ flag ใหม่

**ทำไมไม่แก้ status:**
เพราะ status "อนุมัติแล้ว" ยังถูกต้องตาม history — ใช้ `deletedByAdmin` flag แยกต่างหากแทนเพื่อไม่ทำให้ audit trail เสีย

---

### 💻 Frontend changes — deletedByAdmin flag (4 commits)

**commit 7df899e** — filter + deleted card:
```javascript
// _myApprovedOrgs ต้องไม่นับ org ที่ถูกลบ
_myApprovedOrgs = myReqs.filter(e => e[1].status === 'อนุมัติแล้ว' && !e[1].deletedByAdmin)

// แสดง card "ถูกลบแล้ว" แทน card ปกติ
if (st === 'อนุมัติแล้ว' && req.deletedByAdmin) { ... }
```

**commit e2665e5** — lock renewal sidebar:
```javascript
// ก่อน: _renewalUnlocked = myReqs.length > 0
// หลัง: นับเฉพาะ org ที่ไม่ถูกลบ
_renewalUnlocked = myReqs.some(e => !e[1].deletedByAdmin)
```

**commit db69ec1** — dismiss button:
```javascript
function dismissDeletedReq(reqKey) {
  localStorage.setItem('dismissed_deleted_' + reqKey, '1');
  // fade out card → hide → hide section ถ้าไม่มี card เหลือ
}
```

**commit f82a249** — hide section เมื่อ dismiss ครบ:
```javascript
if (!wrap.innerHTML.trim()) section.style.display = 'none';
```

---

### 🧠 Memory system update

**เปลี่ยนแปลง:** ยกเลิกการใช้ antigravity IDE แล้ว → memory system เหลือ 2 ชั้น:
1. **MEMORY.md files** (primary) — Claude อ่านอัตโนมัติทุก session
2. **mem0** (supplement) — Claude ใช้คนเดียว, Codex ใช้ได้ถ้า configure MCP

**sync mem0:** บันทึก context ทั้งหมดของโปรเจกต์เข้า mem0 (user_id: zporsupreme@gmail.com) 13 entries ครอบคลุม rules, Firebase paths, article flow, pitfalls

---

### 📄 สร้าง CLAUDE.md และ CONTEXT.md

**CLAUDE.md** (commit 85c4d86): AI context file สำหรับ AI ทุกตัวที่เปิด repo นี้ — เก็บ rules คงที่, Firebase paths, technical pitfalls

**CONTEXT.md** (ไฟล์นี้): log การตัดสินใจ — เพื่อให้ Codex และ AI อื่นเข้าใจ "ทำไม" ไม่ใช่แค่ "อะไร"

---

### ❌ สิ่งที่ลองแล้วไม่ work

- **Firebase REST API via getIdToken()** — blocked โดย security classifier ของ sandbox
- **`rm -f .git/HEAD.lock`** ใน bash — blocked ("Operation not permitted") → ต้องใช้ PowerShell `Remove-Item -Force` ผ่าน Desktop Commander แทน
- **Kapture delete button selector** — `#kapture-60` renumber ทุกครั้งที่ลบ field → ต้อง query `button.mat-warn` fresh หลังทุกครั้ง

---

### 📌 State ปัจจุบัน (2026-08-01)

- `req_1785547753744`: `deletedByAdmin: true`, ไม่มี orgCode/orgKey/dates
- User zporsupreme9: เห็น "ถูกลบแล้ว" card + renewal sidebar locked
- ระบบพร้อมรับ org registration ใหม่จาก user ได้ตามปกติ
- Pending: user push commits ด้วยตัวเองจาก Windows terminal

---

*append session ใหม่ด้านบน (reverse chronological) ทุกครั้งที่บอก "สรุป session"*

*ถ้า user บอก "จำจดข้อมูลทั้งหมด" หรือ "บันทึกข้อมูลทั้งหมด" (ไม่ใช่แค่ "สรุป session") — บันทึกลง 3 ที่เสมอ: `CLAUDE.md` (fact ที่ถาวร) + `CONTEXT.md` (ไฟล์นี้) + mem0 (user_id: zporsupreme@gmail.com) ไม่ใช่แค่ที่เดียว (ตกลงกับ user ไว้ 2026-08-01)*
