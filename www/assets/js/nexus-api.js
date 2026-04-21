(function bootstrapNexusApi(global) {
  const STORAGE_KEY = "nexus_api_base_url";
  const FALLBACK_REMOTE_BASE = "https://nexus-ai-d7ys.onrender.com";

  function sanitizeBaseUrl(value) {
    return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  }

  function buildCandidateBaseUrls() {
    const candidates = [];
    const savedValue = sanitizeBaseUrl(global.localStorage.getItem(STORAGE_KEY));

    if (savedValue) {
      candidates.push(savedValue);
    }

    if (typeof global.location?.origin === "string" && /^https?:/i.test(global.location.origin)) {
      candidates.push(sanitizeBaseUrl(global.location.origin));
    }

    if (
      typeof global.location?.hostname === "string" &&
      ["127.0.0.1", "localhost"].includes(global.location.hostname)
    ) {
      candidates.push(`http://${global.location.hostname}:5001`);
    }

    candidates.push(FALLBACK_REMOTE_BASE);

    return [...new Set(candidates.filter(Boolean))];
  }

  function resolveBaseUrl() {
    return buildCandidateBaseUrls()[0] || FALLBACK_REMOTE_BASE;
  }

  function setBaseUrl(value) {
    const sanitized = sanitizeBaseUrl(value);

    if (!sanitized) {
      global.localStorage.removeItem(STORAGE_KEY);
      return "";
    }

    global.localStorage.setItem(STORAGE_KEY, sanitized);
    return sanitized;
  }

  async function readJsonSafely(response) {
    return response.json().catch(() => ({}));
  }

  function delay(ms) {
    return new Promise((resolve) => global.setTimeout(resolve, ms));
  }

  async function postJson(endpoint, payload) {
    const attemptedEndpoints = [endpoint];

    if (endpoint === "/api/generate") {
      attemptedEndpoints.push("/generate");
    }

    let lastError = null;

    for (const baseUrl of buildCandidateBaseUrls()) {
      for (const candidate of attemptedEndpoints) {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const response = await global.fetch(`${baseUrl}${candidate}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            const result = await readJsonSafely(response);

            if (response.ok) {
              return result;
            }

            const message = result.error || result.details || `Request failed with status ${response.status}`;

            if ([404, 405].includes(response.status)) {
              lastError = new Error(`${candidate} unavailable on ${baseUrl}`);
              break;
            }

            if (response.status === 503 && attempt < 3) {
              lastError = new Error(`Temporary Gemini overload on ${baseUrl}; retrying`);
              await delay(attempt * 1200);
              continue;
            }

            throw new Error(message);
          } catch (error) {
            lastError = error;

            if (attempt < 3 && /503|Service Unavailable|high demand|temporarily unavailable/i.test(error.message || "")) {
              await delay(attempt * 1200);
              continue;
            }

            break;
          }
        }
      }
    }

    throw new Error(
      `${lastError?.message || "Connection interrupted"}. Checked backends: ${buildCandidateBaseUrls().join(", ")}`
    );
  }

  global.NexusApi = {
    resolveBaseUrl,
    setBaseUrl,
    postJson,
  };
})(window);
