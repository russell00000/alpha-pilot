export const FETCH_TIMEOUT_MS = 15_000;
export const TEMPORARY_DATA_MESSAGE = "Data temporarily unavailable, try again.";
export class DataTimeoutError extends Error {
  constructor() { super(TEMPORARY_DATA_MESSAGE); this.name = "DataTimeoutError"; }
}
// Bound headers AND body reads. A response whose body stalls is still a timeout.
export function createBoundedFetch(transport: typeof fetch = fetch, timeoutMs = FETCH_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const externalSignal = init?.signal;
    const abort = () => controller.abort();
    externalSignal?.addEventListener("abort", abort, { once: true });
    if (externalSignal?.aborted) controller.abort();
    try {
      return await Promise.race([
        (async () => {
          const response = await transport(input, { ...init, signal: controller.signal });
          const body = await response.arrayBuffer();
          return new Response([204, 205, 304].includes(response.status) ? null : body, {
            status: response.status, statusText: response.statusText, headers: response.headers,
          });
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new DataTimeoutError()); }, timeoutMs);
        }),
      ]);
    } catch (error) {
      if (controller.signal.aborted) throw new DataTimeoutError();
      throw error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abort);
    }
  };
}
export const boundedFetch = createBoundedFetch();
export function optionalData(error: unknown): null {
  if (error instanceof DataTimeoutError) throw error;
  return null;
}