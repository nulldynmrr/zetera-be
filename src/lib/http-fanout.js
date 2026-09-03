/**
 * HTTP Fan-out helper dengan timeout per-request dan Promise.allSettled.
 * Memastikan provider yang lambat / error tidak menggagalkan seluruh pencarian.
 */

export async function safeFetchJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, status: res.status, data: null };
    }

    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return { ok: false, isTimeout, error: err.message, data: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function fanOutTasks(tasks, overallTimeoutMs = 12000) {
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ __timeout: true }), overallTimeoutMs)
  );

  const results = await Promise.allSettled(
    tasks.map((task) =>
      Promise.race([
        typeof task === "function" ? task() : task,
        timeoutPromise,
      ])
    )
  );

  return results.map((r) => {
    if (r.status === "fulfilled") {
      if (r.value && r.value.__timeout) {
        return { status: "timeout", value: null };
      }
      return { status: "success", value: r.value };
    }
    return { status: "error", reason: r.reason };
  });
}
