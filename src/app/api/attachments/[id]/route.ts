import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveStoredPath } from "@/lib/attachments";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const attachment = await prisma.ticketAttachment.findUnique({
    where: { id },
  });
  if (!attachment) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const bytes = await readFile(resolveStoredPath(attachment.storagePath));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": attachment.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "missing file" }, { status: 404 });
  }
}
