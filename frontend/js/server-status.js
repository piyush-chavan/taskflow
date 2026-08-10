// Free-tier backends (e.g. Render) spin down when idle and can take up to a
// minute to wake back up on the next request. This pings /health on load: if
// it's already warm, nothing is shown; if not, it shows a "connecting" toast
// once and keeps retrying until the server responds, then shows "connected".

document.addEventListener("DOMContentLoaded", () => {
  ensureBackendAwake();
});

async function ensureBackendAwake() {
  const isAwake = await pingHealth(4000);
  if (isAwake) return;

  showToast("Connecting to server, this can take up to a minute...", "info");

  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(4000);
    const ok = await pingHealth(8000);
    if (ok) {
      showToast("Connected to server", "success");
      return;
    }
  }
}

function pingHealth(timeoutMs) {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    fetch(`${CONFIG.BASE_URL}/health`, { signal: controller.signal })
      .then((response) => resolve(response.ok))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(timer));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
