# BUU Pharmacy CPE — Live Handoff

ไฟล์นี้คือสถานะงานปัจจุบันสำหรับส่งต่องานระหว่าง Cowork, Claude Code และ Codex
ให้อ่านก่อนเริ่มแก้โค้ด และอัปเดตเมื่อเริ่มงาน เปลี่ยนแผน แก้เสร็จ หรือพบปัญหา

> ก่อนทำงานต้องอ่าน `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md` และ `HANDOFF.md` พร้อมกันเสมอ
> เมื่อผู้ใช้สั่ง "จดจำข้อมูลทั้งหมด" หรือ "บันทึกข้อมูลทั้งหมด" ต้องอัปเดตทั้ง 4 ไฟล์ตามบทบาทของแต่ละไฟล์
> ข้อกำหนดนี้ใช้กับ Claude, Claude Code, Codex และ AI อื่นทุกตัว ห้ามอ่านความจำเพียงไฟล์เดียว
> ผู้ใช้อนุญาตถาวรให้ AI `git push` ได้หลังตรวจ branch, remote, commit และขอบเขตแล้ว; ห้าม force-push เว้นแต่ได้รับคำสั่งโดยตรง

## วิธีใช้

- เก็บเฉพาะงานที่กำลังทำและงานถัดไป ไม่ต้องเก็บประวัติยาว
- เมื่อปิดงาน ให้ย้ายสาระสำคัญไป `CONTEXT.md` แล้วลบหรือแทนที่รายการนี้
- ระบุไฟล์ที่แก้, commit และสถานะ deploy ทุกครั้ง
- Commit และ push ไฟล์นี้พร้อมงานที่เกี่ยวข้อง เพื่อให้อีก AI เห็นสถานะล่าสุด

---

## สถานะปัจจุบัน — 2026-08-03

### ล่าสุดที่เสร็จ

- Dashboard ใน `index.html` กลับมาแสดงข้อมูลครบสำหรับผู้ใช้ที่ login ทุกคนแล้ว
- Firebase RTDB Rules ที่ `pharma-form/.read` ถูกตั้งเป็น `auth != null` และผู้ใช้ได้ Publish ใน Firebase Console แล้ว
- เอา role-based branching ที่ทำให้ dashboard ของ regular user เป็นศูนย์ออกแล้ว
- แก้ข้อควรระวัง: ใน dashboard หากเช็คสิทธิ์ admin ให้ใช้ `isAdmin(getUser())` ไม่ใช่ Firebase Auth `user` โดยตรง เพราะอาจมี alias email ไม่ตรง canonical email

### Commit ล่าสุดบน main

- `c969e40` — เปิด read dashboard สำหรับผู้ใช้ที่ login ทุกคน
- `da1042b` — อัปเดต `CLAUDE.md` และ `CONTEXT.md` ให้ตรงกับ Rules ใหม่

### งานค้าง

- ไม่มีงานค้างที่ผู้ใช้ร้องขอ
- ภายหลังอาจทบทวนสิทธิ์ dashboard สำหรับ regular user อีกครั้ง หากต้องการจำกัดข้อมูลที่เห็น

### ข้อควรระวัง

- ห้ามแก้ `login.html` เพราะเคยทำให้ authentication ใช้งานไม่ได้ทั้งระบบ
- Firebase Rules คือ security boundary จริง: เมื่อเพิ่ม path หรือปรับสิทธิ์ ต้องแก้ `firebase-rtdb-rules-proposed.json` และ Publish ใน Firebase Console พร้อมกัน
- อ่าน `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md` และ `HANDOFF.md` ก่อนทำงานทุกครั้ง
