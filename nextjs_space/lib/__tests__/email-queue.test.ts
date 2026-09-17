import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emailOutbox: { createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(() => true),
}));

vi.mock("../db", () => ({ prisma: mocks }));
vi.mock("../email", () => ({
  sendEmail: mocks.sendEmail,
  isEmailConfigured: mocks.isEmailConfigured,
}));

import { drainOutbox, queueEmails } from "../email-queue";

const item = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  to: "a@b.test",
  subject: "konu",
  html: "<p>x</p>",
  text: null,
  attempts: 0,
  ...over,
});

describe("email-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEmailConfigured.mockReturnValue(true);
    mocks.emailOutbox.findMany.mockResolvedValue([]);
    mocks.emailOutbox.update.mockResolvedValue({});
    mocks.emailOutbox.createMany.mockResolvedValue({ count: 0 });
  });

  it("boş listede sorgu yapmaz", async () => {
    expect(await queueEmails([])).toBe(0);
    expect(mocks.emailOutbox.createMany).not.toHaveBeenCalled();
  });

  it("aynı dedupeKey ikinci kez kuyruğa girmez", async () => {
    mocks.emailOutbox.createMany.mockResolvedValue({ count: 1 });
    const count = await queueEmails([
      { to: "a@b.test", subject: "s", html: "<p>1</p>", dedupeKey: "k1" },
      { to: "a@b.test", subject: "s", html: "<p>1</p>", dedupeKey: "k1" },
    ]);
    expect(count).toBe(1);
    expect(mocks.emailOutbox.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it("başarılı gönderimi SENT olarak işaretler", async () => {
    mocks.emailOutbox.findMany.mockResolvedValue([item()]);
    mocks.sendEmail.mockResolvedValue({ success: true });

    const result = await drainOutbox();

    expect(result).toEqual({ sent: 1, failed: 0, skipped: false });
    expect(mocks.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SENT" }) })
    );
  });

  it("başarısız gönderim yeniden denenmek üzere PENDING kalır", async () => {
    mocks.emailOutbox.findMany.mockResolvedValue([item({ attempts: 0 })]);
    mocks.sendEmail.mockResolvedValue({ success: false, error: "429" });

    const result = await drainOutbox();

    expect(result.failed).toBe(1);
    expect(mocks.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", attempts: 1 }) })
    );
  });

  it("hakkı biten kayıt FAILED olur ve bir daha denenmez", async () => {
    mocks.emailOutbox.findMany.mockResolvedValue([item({ attempts: 2 })]);
    mocks.sendEmail.mockResolvedValue({ success: false, error: "kalıcı hata" });

    await drainOutbox();

    expect(mocks.emailOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", attempts: 3 }) })
    );
  });

  it("e-posta yapılandırılmamışsa kuyruğa dokunmaz", async () => {
    mocks.isEmailConfigured.mockReturnValue(false);
    const result = await drainOutbox();
    expect(result).toEqual({ sent: 0, failed: 0, skipped: true });
    expect(mocks.emailOutbox.findMany).not.toHaveBeenCalled();
  });

  it("eşzamanlılık sınırını aşmaz", async () => {
    mocks.emailOutbox.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => item({ id: `m${i}` }))
    );
    let inFlight = 0;
    let peak = 0;
    mocks.sendEmail.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return { success: true };
    });

    await drainOutbox();

    expect(peak).toBeLessThanOrEqual(4);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(10);
  });
});
