import { ALL_ROLES, ROLE_LABEL } from "@/lib/workflow";
import { createUserAction, updateUserAction } from "@/app/admin/users/actions";

type SectionOption = { id: string; code: string; name: string };

type UserValues = {
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  roleCode: string;
  sectionId: string | null;
  active: boolean;
};

const ERROR_TEXT: Record<string, string> = {
  username: "ชื่อผู้ใช้ต้องเป็นตัวอักษร/ตัวเลข 3–32 ตัว (จุด _ - ได้)",
  password: "กรุณาใส่รหัสผ่าน",
  password_short: "รหัสผ่านอย่างน้อย 8 ตัว",
  name: "กรุณาใส่ชื่อที่แสดง",
  role: "เลือกบทบาทให้ถูกต้อง",
  section: "หัวหน้าแผนกต้องเลือกแผนก",
  dup: "ชื่อผู้ใช้นี้มีอยู่แล้ว",
  self: "ปิดบัญชีตัวเองไม่ได้",
  last_admin: "ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน",
  missing: "ไม่พบผู้ใช้",
};

export function UserForm({
  mode,
  userId,
  values,
  sections,
  error,
}: {
  mode: "create" | "edit";
  userId?: string;
  values?: UserValues;
  sections: SectionOption[];
  error?: string;
}) {
  return (
    <form
      action={mode === "create" ? createUserAction : updateUserAction}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      {userId ? <input type="hidden" name="userId" value={userId} /> : null}
      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {ERROR_TEXT[error] ?? "บันทึกไม่สำเร็จ"}
        </p>
      ) : null}

      <label className="block text-sm font-medium text-slate-700">
        ชื่อผู้ใช้
        <input
          name="username"
          required
          defaultValue={values?.username ?? ""}
          autoComplete="off"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        {mode === "create" ? "รหัสผ่าน" : "รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"}
        <input
          name="password"
          type="password"
          required={mode === "create"}
          minLength={mode === "create" ? 8 : undefined}
          autoComplete="new-password"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        ชื่อที่แสดง
        <input
          name="displayName"
          required
          defaultValue={values?.displayName ?? ""}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          อีเมล
          <input
            name="email"
            type="email"
            defaultValue={values?.email ?? ""}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          โทรศัพท์
          <input
            name="phone"
            defaultValue={values?.phone ?? ""}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        บทบาท
        <select
          name="roleCode"
          required
          defaultValue={values?.roleCode ?? "REQUESTER"}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
        >
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-slate-700">
        แผนก
        <select
          name="sectionId"
          defaultValue={values?.sectionId ?? ""}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal"
        >
          <option value="">— ไม่ระบุ —</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.code} · {section.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="active" defaultChecked={values?.active ?? true} />
        ใช้งานได้ (เข้าสู่ระบบได้)
      </label>

      <button
        type="submit"
        className="rounded-lg bg-brand-navy px-4 py-2 font-medium text-white shadow-sm transition hover:bg-brand-navy-dark"
      >
        {mode === "create" ? "สร้างผู้ใช้" : "บันทึก"}
      </button>
    </form>
  );
}
