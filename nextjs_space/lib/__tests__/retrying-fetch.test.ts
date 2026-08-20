import { describe, expect, it, vi } from "vitest";
import { getWithRetry, isRetryableStatus } from "../retrying-fetch";

const response = (status: number) => new Response(null, { status });

describe("isRetryableStatus", () => {
  it("yalnızca sunucu hatalarını geçici sayar", () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe("getWithRetry", () => {
  it("sunucu hatasından sonra bir kez daha dener", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(200));

    const result = await getWithRetry("/api/test", { delayMs: 0, fetchFn });

    expect(result.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("ağ kopmasından sonra da dener", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(response(200));

    const result = await getWithRetry("/api/test", { delayMs: 0, fetchFn });

    expect(result.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("yetki hatasını tekrar denemez", async () => {
    // 403 ikinci denemede de 403; beklemek kullanıcıyı oyalamaktan başka
    // bir işe yaramaz.
    const fetchFn = vi.fn().mockResolvedValue(response(403));

    const result = await getWithRetry("/api/test", { delayMs: 0, fetchFn });

    expect(result.status).toBe(403);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("ısrarlı sunucu hatasında son yanıtı döner", async () => {
    const fetchFn = vi.fn().mockResolvedValue(response(500));

    const result = await getWithRetry("/api/test", { delayMs: 0, fetchFn });

    expect(result.status).toBe(500);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("ısrarlı ağ kopmasında hatayı yukarı verir", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));

    await expect(getWithRetry("/api/test", { delayMs: 0, fetchFn })).rejects.toThrow("network");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
