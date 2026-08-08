/**
 * Okuma isteklerinde tek seferlik tekrar deneme.
 *
 * Bir istek tek seferlik bir aksilikle düşebiliyor: ağ bir an kopuyor, önündeki
 * vekil 502 veriyor, sunucu yeniden başlıyor. Ekran o zaman "liste alınamadı"
 * diyor ve kullanıcıya sayfayı yenilemekten başka bir şey bırakmıyor — oysa
 * ikinci istek neredeyse her zaman başarılı oluyor.
 *
 * Yalnızca GET: bir POST'u tekrar denemek çift kayıt demektir. Yalnızca
 * sunucu hataları ve ağ kopmaları: 401/403/404 tekrar denemekle düzelmez,
 * sadece kullanıcıyı bekletir.
 *
 * Saf modül — `fetch` dışarıdan verilebildiği için testten doğrudan çağrılır.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type RetryOptions = {
  /** Kaç kez yeniden denensin (ilk istek hariç). */
  retries?: number;
  /** Denemeler arası bekleme. */
  delayMs?: number;
  fetchFn?: FetchLike;
};

/** 5xx geçici sayılır; 4xx istemcinin kendi sorunudur, tekrar denenmez. */
export function isRetryableStatus(status: number): boolean {
  return status >= 500;
}

const wait = (ms: number) =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export async function getWithRetry(
  url: string,
  { retries = 1, delayMs = 400, fetchFn }: RetryOptions = {}
): Promise<Response> {
  const doFetch: FetchLike = fetchFn ?? ((input, init) => fetch(input, init));
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await doFetch(url, { method: "GET" });
      if (!isRetryableStatus(response.status) || attempt === retries) {
        return response;
      }
    } catch (error) {
      // Ağ kopması: son denemede olduğu gibi yukarı verilir.
      lastError = error;
      if (attempt === retries) throw error;
    }

    await wait(delayMs);
  }

  // Buraya yalnızca döngü beklenmedik biçimde biterse gelinir.
  throw lastError ?? new Error(`İstek tamamlanamadı: ${url}`);
}
