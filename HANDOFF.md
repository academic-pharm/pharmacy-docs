# BUU Pharmacy CPE — Live Handoff

ไฟล์นี้คือสถานะงานปัจจุบันสำหรับส่งต่องานระหว่าง Cowork, Claude Code และ Codex
ให้อ่านก่อนเริ่มแก้โค้ด และอัปเดตเมื่อเริ่มงาน เปลี่ยนแผน แก้เสร็จ หรือพบปัญหา

> ก่อนทำงานต้องอ่าน `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md` และ `HANDOFF.md` พร้อมกันเสมอ
> เมื่อผู้ใช้สั่ง "จดจำข้อมูลทั้งหมด" หรือ "บันทึกข้อมูลทั้งหมด" ต้องอัปเดตพร้อมกันทั้ง 5 แหล่ง: `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`, `HANDOFF.md` และ Mem0 (`user_id: zporsupreme@gmail.com`)
> ข้อกำหนดนี้ใช้กับ Claude, Claude Code, Codex และ AI อื่นทุกตัว ห้ามอ่านความจำเพียงไฟล์เดียว
> AI ทุกตัวที่รองรับ Mem0/MCP ต้องอ่านหรือค้น Mem0 ร่วมกับไฟล์ทั้ง 4 เมื่อจำเป็น เพื่อให้ทำงานต่อเนื่องข้าม AI
> ผู้ใช้อนุญาตถาวรให้ AI `git push` ได้หลังตรวจ branch, remote, commit และขอบเขตแล้ว; ห้าม force-push เว้นแต่ได้รับคำสั่งโดยตรง

## วิธีใช้

- เก็บเฉพาะงานที่กำลังทำและงานถัดไป ไม่ต้องเก็บประวัติยาว
- เมื่อปิดงาน ให้ย้ายสาระสำคัญไป `CONTEXT.md` แล้วลบหรือแทนที่รายการนี้
- ระบุไฟล์ที่แก้, commit และสถานะ deploy ทุกครั้ง
- Commit และ push ไฟล์นี้พร้อมงานที่เกี่ยวข้อง เพื่อให้อีก AI เห็นสถานะล่าสุด

---

## สถานะปัจจุบัน — 2026-08-06

### ล่าสุดที่เสร็จ

- สร้าง `memory/` folder ใน git repo เป็น memory หลักที่ย้ายเครื่องได้
  - `memory/project.md` — project architecture, Firebase structure, features
  - `memory/feedback.md` — behavioral rules, coding preferences
  - `memory/MEMORY.md` — index
- อัปเดต `CLAUDE.md`: AI Context & Memory section ชี้ไป `memory/project.md` และ `memory/feedback.md`
- อัปเดต `CONTEXT.md`: บันทึกการตัดสินใจ 2026-08-06
- Dashboard `index.html` แสดงข้อมูลครบสำหรับผู้ใช้ทุกคนที่ login แล้ว (แก้ session ก่อน)

### Commit ล่าสุดบน main

- `767ec5c` — สร้าง memory/ folder + อัปเดต CLAUDE.md
- `cb5f6ff` — อัปเดต CONTEXT.md

### งานค้าง

- ไม่มีงานค้างที่ผู้ใช้ร้องขอ
- ภายหลังอาจทบทวนสิทธิ์ dashboard สำหรับ regular user อีกครั้ง หากต้องการจำกัดข้อมูลที่เห็น

### ข้อควรระวัง

- Memory หลักอยู่ที่ `memory/project.md` และ `memory/feedback.md` ใน repo — อัปเดตตรงนี้เมื่อจดจำข้อมูลใหม่
- ห้ามแก้ `login.html` เพราะเคยทำให้ authentication ใช้งานไม่ได้ทั้งระบบ
- Firebase Rules คือ security boundary จริง: เมื่อเพิ่ม path หรือปรับสิทธิ์ ต้องแก้ `firebase-rtdb-rules-proposed.json` และ Publish ใน Firebase Console พร้อมกัน
- อ่าน `CLAUDE.md`, `CONTEXT.md`, `memory/project.md`, `memory/feedback.md` ก่อนทำงานทุกครั้ง

---

## Memory checkpoint ล่าสุด — 2026-08-06

- ระบบความจำย้ายเครื่องใช้ Git repo เป็นหลัก และใช้ Mem0 เป็น semantic memory เสริม
- trigger “ให้จดจำข้อมูลทั้งหมด” ต้องอัปเดตครบ: `CLAUDE.md`, `CONTEXT.md`, `HANDOFF.md`, `AGENTS.md`, Mem0
- ชื่อที่ถูกต้องคือ `AGENTS.md` (พหูพจน์)
- สถานะงาน: ไม่มี coding task ค้าง; การจำกัดสิทธิ์ dashboard ของ regular user เลื่อนไว้พิจารณาภายหลัง
- ห้ามบันทึก secrets/credentials ทุกชนิดลง memory
