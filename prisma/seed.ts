import { PrismaClient, RoleCode } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDefaultWorkflows } from "./default-flows";

const prisma = new PrismaClient();

async function main() {
  await prisma.ticketComment.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.ticketEvent.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.workflowTransitionRole.deleteMany();
  await prisma.workflowTransition.deleteMany();
  await prisma.workflowStage.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.user.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.section.deleteMany();
  await prisma.role.deleteMany();

  const roleRows: { code: RoleCode; name: string }[] = [
    { code: "REQUESTER", name: "ผู้ร้องขอ" },
    { code: "SECTION_MANAGER", name: "หัวหน้าแผนก" },
    { code: "GM", name: "GM" },
    { code: "EM_MANAGER", name: "EM Manager" },
    { code: "EM_TECHNICIAN", name: "ช่าง EM" },
    { code: "IT_MANAGER", name: "IT Manager" },
    { code: "IT_TECHNICIAN", name: "ช่าง IT" },
    { code: "ADMIN", name: "Admin" },
  ];
  const roles = Object.fromEntries(
    await Promise.all(
      roleRows.map(async (row) => {
        const created = await prisma.role.create({ data: row });
        return [row.code, created] as const;
      }),
    ),
  );

  const pd = await prisma.section.create({
    data: { code: "PD", name: "Production" },
  });
  const em = await prisma.section.create({
    data: { code: "EM", name: "Engineering Maintenance" },
  });
  const it = await prisma.section.create({
    data: { code: "IT", name: "IT" },
  });

  const password = (plain: string) => bcrypt.hashSync(plain, 10);

  await prisma.user.createMany({
    data: [
      {
        username: "requester",
        passwordHash: password("requester123"),
        displayName: "ผู้ร้องขอ ทดลอง",
        email: "requester@tcpr.local",
        roleId: roles.REQUESTER.id,
        sectionId: pd.id,
      },
      {
        username: "tech",
        passwordHash: password("tech123"),
        displayName: "ช่าง EM ทดลอง",
        email: "tech@tcpr.local",
        roleId: roles.EM_TECHNICIAN.id,
        sectionId: em.id,
      },
      {
        username: "ittech",
        passwordHash: password("ittech123"),
        displayName: "ช่าง IT ทดลอง",
        email: "ittech@tcpr.local",
        roleId: roles.IT_TECHNICIAN.id,
        sectionId: it.id,
      },
      {
        username: "admin",
        passwordHash: password("admin123"),
        displayName: "ผู้ดูแลระบบ",
        email: "admin@tcpr.local",
        roleId: roles.ADMIN.id,
        sectionId: em.id,
      },
      {
        username: "manager",
        passwordHash: password("manager123"),
        displayName: "หัวหน้าแผนก PD",
        roleId: roles.SECTION_MANAGER.id,
        sectionId: pd.id,
      },
      {
        username: "gm",
        passwordHash: password("gm123"),
        displayName: "GM",
        roleId: roles.GM.id,
        sectionId: pd.id,
      },
      {
        username: "emmgr",
        passwordHash: password("emmgr123"),
        displayName: "EM Manager",
        roleId: roles.EM_MANAGER.id,
        sectionId: em.id,
      },
      {
        username: "itmgr",
        passwordHash: password("itmgr123"),
        displayName: "IT Manager",
        roleId: roles.IT_MANAGER.id,
        sectionId: it.id,
      },
    ],
  });

  await seedDefaultWorkflows(prisma);

  await prisma.asset.createMany({
    data: [
      { tag: "MIX-01", name: "Mixer Line A", line: "A", isElectric: false },
      { tag: "PMP-02", name: "Pump Line B", line: "B", isElectric: false },
      { tag: "PNL-E1", name: "Power Panel E1", line: "E", isElectric: true },
    ],
  });

  console.log("Seeded demo users: requester/requester123, tech/tech123, admin/admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
