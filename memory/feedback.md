# Behavioral Rules & Coding Preferences

> อัปเดตล่าสุด: 2026-08-06

---

## ห้ามแก้ไข login.html เด็ดขาด
**Why:** เคยทำให้ auth พังสำหรับ user ทุกคน  
**How to apply:** Auth logic → แก้ใน `cpe-form-system.html` ที่ initAuth block เท่านั้น. User list → แก้ใน `auth.js` เท่านั้น

---

## ห้ามลบไฟล์ถาวร
**Why:** User ต้องการ safety net กู้คืนได้  
**How to apply:** ย้ายไปที่ `C:\Users\admin\Claude\Projects\โครงการบริการวิชาการ และ CPE\รอ Delete\` เสมอ ห้ามใช้ rm/del/unlink

---

## ใช้ getUser() ไม่ใช่ Firebase Auth user สำหรับ isAdmin
**Why:** Firebase Auth user มี alias email (gmail) — `isAdmin(firebaseUser)` return false แม้จะเป็น admin  
**How to apply:** `isAdmin(getUser())` เสมอ — session user มี canonical BUU email

---

## ใช้ getCanonicalEmail() ไม่ใช่ currentUser.email ตรงๆ
**Why:** User login ด้วย alias gmail แต่ข้อมูลเก็บใต้ BUU email → currentUser.email ทำให้ return empty array  
**How to apply:** ใช้ `getCanonicalEmail()` หรือ `currentProjectOwner || _canonicalEmail || currentUser.email`

---

## ห้ามให้ initAuth() รอ _resolveEmail() ก่อน load ข้อมูล
**Why:** Promise ค้างเงียบๆ ไม่ resolve/reject ใน production ทำให้ข้อมูลทั้งหน้าหาย  
**How to apply:** `initAuth()` โหลดข้อมูล synchronous เหมือนเดิมเสมอ, resolve email ทีหลังแบบ fire-and-forget

---

## ห้ามใส่ `</script>` literal ใน comment ภายใน script block
**Why:** HTML parser ตัด script block ทันที ทำให้ JS ทุกบรรทัดหลังจุดนั้นไม่ถูก parse  
**How to apply:** ใช้ `<\/script>` แทนเสมอ

---

## ระวัง var hoisting ใน initAuth() IIFE
**Why:** `initAuth()` รัน synchronous ตอนโหลดหน้า ตัวแปร `var` ที่ประกาศหลัง IIFE จะยังเป็น `undefined`  
**How to apply:** ประกาศตัวแปรก่อน initAuth IIFE เสมอ (ก่อนบรรทัด ~1770)

---

## html2canvas ใน iframe ต้องใช้ iframe.contentWindow.html2canvas()
**Why:** html2canvas จาก main window ไม่เห็น @font-face ใน iframe → font TH Sarabun เพี้ยนใน PDF  
**How to apply:** inject script เข้า iframe HTML แล้วเรียกผ่าน `iframe.contentWindow.html2canvas()`

---

## "Find after splice" pattern สำหรับ array reorder
**Why:** `insertAt = tgtIdx > srcIdx ? tgtIdx - 1 : tgtIdx` มี subtle bug  
**How to apply:** splice src ออกก่อน → findIndex tgt ในตำแหน่งใหม่ → splice in

---

## เก็บข้อมูลทุก field ลง Google Sheet เสมอ
**Why:** User ต้องการนำไปวิเคราะห์ KPI ในอนาคต  
**How to apply:** ทุก feature ใหม่ออกแบบ Sheet column ให้ครอบคลุม: timestamp, ผู้ส่ง, สถานะ, URL ไฟล์, metadata, action logs

---

## R0–R2: Safety Rules
**R0:** คำสั่งย้อนกลับไม่ได้ (ลบ/ย้าย/เขียนทับ/deploy) → ถามยืนยันก่อนเสมอ; git push ใช้สิทธิ์ถาวรตาม Git workflow  
**R1:** ไม่แน่ใจว่า user ต้องการอะไร → ถามก่อน ห้ามเดา  
**R2:** รอ "ยืนยัน" จาก user ก่อนดำเนินการ ยกเว้น git push ปกติที่อนุญาตถาวร

---

## ตอบเป็นภาษาไทยเสมอ
**Why:** User ขอไว้ตั้งแต่ต้นโครงการ

---

## บันทึก memory ลง git repo (memory/ folder) + mem0 พร้อมกัน
**Why:** User ต้องการให้ memory ย้ายเครื่องได้ผ่าน git และ accessible จาก AI ทุกตัวผ่าน mem0  
**How to apply:** เมื่อมีข้อมูลสำคัญใหม่ → อัปเดต `memory/project.md` หรือ `memory/feedback.md` ใน repo + `add_memory` เข้า mem0 (user_id: zporsupreme@gmail.com) พร้อมกัน
