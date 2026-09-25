import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collectRequestPhotos: vi.fn(),
  loadRules: vi.fn(),
  loadWorkflow: vi.fn(),
  prisma: {
    asset: {
      findUnique: vi.fn(),
    },
    ticket: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ticketAttachment: {
      createMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`) as Error & { url: string };
    error.url = url;
    throw error;
  }),
  requireSession: vi.fn(),
  saveTicketPhotos: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/auth", () => ({
  clearSession: vi.fn(),
  createSession: vi.fn(),
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/attachments", () => ({
  collectRequestPhotos: mocks.collectRequestPhotos,
  saveTicketPhotos: mocks.saveTicketPhotos,
}));

vi.mock("@/lib/flow", () => ({
  loadRules: mocks.loadRules,
  loadWorkflow: mocks.loadWorkflow,
}));

const { applyTransitionAction, createTicketAction } = await import("./actions");

function baseCreateForm() {
  const formData = new FormData();
  formData.set("type", "STAFF");
  formData.set("subject", "Need help");
  formData.set("detail", "Something needs repair");
  formData.set("priority", "NORMAL");
  formData.set("dueAt", "2099-01-01T12:00");
  return formData;
}

describe("createTicketAction SLA inputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collectRequestPhotos.mockReturnValue({ ok: true, photos: [] });
    mocks.loadWorkflow.mockResolvedValue({
      stages: [{ code: "NEW", isInitial: true }],
    });
    mocks.prisma.ticket.findFirst.mockResolvedValue(null);
    mocks.prisma.ticket.create.mockResolvedValue({ id: "ticket-1" });
    mocks.requireSession.mockResolvedValue({
      session: { id: "user-1", role: "REQUESTER" },
      user: { sectionId: "section-1", role: { code: "REQUESTER" } },
    });
  });

  it("rejects missing priority before creating a ticket", async () => {
    const formData = baseCreateForm();
    formData.delete("priority");

    await expect(createTicketAction(formData)).rejects.toMatchObject({
      url: "/tickets/new?error=priority",
    });
    expect(mocks.prisma.ticket.create).not.toHaveBeenCalled();
  });

  it("persists valid priority and validated due date on creation", async () => {
    const formData = baseCreateForm();
    formData.set("priority", "URGENT");
    formData.set("dueAt", "2099-01-01T12:00");

    await expect(createTicketAction(formData)).rejects.toMatchObject({
      url: "/tickets/ticket-1",
    });

    expect(mocks.prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: "URGENT",
          dueAt: new Date(2099, 0, 1, 12, 0, 0, 0),
        }),
      }),
    );
  });
});

describe("applyTransitionAction due date ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadRules.mockResolvedValue([
      {
        id: "complete",
        actionCode: "COMPLETE",
        actionLabel: "Complete",
        actorScope: "ANY",
        assignOnTake: false,
        formKind: "COMPLETE",
        fromCode: "IN_PROGRESS",
        roleCodes: ["EM_TECHNICIAN"],
        toCode: "DONE",
        toIsTerminal: true,
      },
    ]);
    mocks.prisma.ticket.findUnique.mockResolvedValue({
      id: "ticket-1",
      assigneeId: "tech-1",
      acceptedAt: null,
      cause: null,
      closedAt: null,
      dueAt: new Date("2099-01-01T00:00:00.000Z"),
      requesterId: "requester-1",
      resolution: null,
      rejectReason: null,
      startedAt: new Date("2026-09-25T00:00:00.000Z"),
      status: "IN_PROGRESS",
      type: "MACHINE",
    });
    mocks.prisma.ticket.update.mockResolvedValue({ id: "ticket-1" });
    mocks.requireSession.mockResolvedValue({
      session: { id: "tech-1", role: "EM_TECHNICIAN" },
      user: { role: { code: "EM_TECHNICIAN" } },
    });
  });

  it("does not let completion update the ticket due date", async () => {
    const formData = new FormData();
    formData.set("ticketId", "ticket-1");
    formData.set("transitionId", "complete");
    formData.set("cause", "Broken part");
    formData.set("resolution", "Replaced part");
    formData.set("dueAt", "2100-01-01T12:00");

    await expect(applyTransitionAction(formData)).rejects.toMatchObject({
      url: "/tickets/ticket-1",
    });

    expect(mocks.prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          dueAt: expect.anything(),
        }),
      }),
    );
  });
});
