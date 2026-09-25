# TCPR Repair MVP

แอปแจ้งซ่อม **TCPR** ตามสเปกใน `docs/specs/2026-09-10-repair-tickets.md`

**แสต็กที่ยืนยัน:** Next.js + PostgreSQL + Prisma (`docs/stack.md`)  
เครื่องนี้ยังไม่มี Docker/Postgres ดังนั้น MVP รันบน **SQLite** ด้วยโมเดลเดียวกัน

## รันบนเครื่องนี้

```bash
cd apps/repair
copy env.example .env
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm test
npm run dev
```

เปิด http://localhost:3000

| ผู้ใช้ | รหัสผ่าน | บทบาท |
| --- | --- | --- |
| requester | requester123 | ผู้ร้องขอ |
| tech | tech123 | ช่าง EM |
| admin | admin123 | Admin — แก้เส้นทางอนุมัติที่ `/admin/flows` |

ลูปทดลอง: ล็อกอิน requester → แจ้งซ่อมเครื่องจักร → ล็อกอิน tech → คิวช่าง รับงาน → ปิดงาน → ล็อกอิน requester → ยอมรับ

แอดมินจัดขั้นและเส้นทาง (จาก → ถึง, ใครกดได้) จาก UI ได้ โดยไม่ต้องแก้โค้ด

## PostgreSQL (เมื่อมี Docker)

```bash
docker compose up -d
```

แล้วตั้ง `DATABASE_URL="postgresql://tcpr:tcpr@localhost:5432/tcpr_repair"` และเปลี่ยน `provider` ใน `prisma/schema.prisma` เป็น `postgresql`
