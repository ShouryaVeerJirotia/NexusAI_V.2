const { ApiError } = require("../lib/api-error");

class ApiKeyRotator {
  constructor(keys, cooldownMs) {
    this.cooldownMs = cooldownMs;
    this.cursor = 0;
    this.pool = keys.map((value, index) => ({
      id: index,
      value,
      cooldownUntil: 0,
      failures: 0,
      lastError: null,
    }));
  }

  get size() {
    return this.pool.length;
  }

  listCandidates() {
    if (this.pool.length === 0) {
      return [];
    }

    const now = Date.now();
    const ordered = [];

    for (let offset = 0; offset < this.pool.length; offset += 1) {
      const position = (this.cursor + offset) % this.pool.length;
      const key = this.pool[position];

      if (key.cooldownUntil <= now) {
        ordered.push(key);
      }
    }

    return ordered;
  }

  getNextRetryAt() {
    const activeCooldowns = this.pool
      .map((entry) => entry.cooldownUntil)
      .filter((value) => value > Date.now());

    return activeCooldowns.length > 0 ? Math.min(...activeCooldowns) : null;
  }

  ensureReadyKey() {
    const candidates = this.listCandidates();

    if (candidates.length > 0) {
      return candidates;
    }

    const retryAt = this.getNextRetryAt();
    const retryAfterMs = retryAt ? Math.max(1_000, retryAt - Date.now()) : this.cooldownMs;

    throw new ApiError(503, "All shared Gemini keys are cooling down.", {
      code: "NO_SHARED_KEYS_READY",
      retryAfterMs,
    });
  }

  markSuccess(key) {
    key.failures = 0;
    key.lastError = null;
    key.cooldownUntil = 0;
    this.cursor = (key.id + 1) % this.pool.length;
  }

  markFailure(key, error, cooldownOverrideMs) {
    key.failures += 1;
    key.lastError = error;
    key.cooldownUntil = Date.now() + cooldownOverrideMs;
    this.cursor = (key.id + 1) % this.pool.length;
  }

  getPublicState() {
    const now = Date.now();

    return {
      totalKeys: this.pool.length,
      readyKeys: this.pool.filter((entry) => entry.cooldownUntil <= now).length,
      coolingKeys: this.pool.filter((entry) => entry.cooldownUntil > now).length,
      nextRetryAt: this.getNextRetryAt(),
    };
  }
}

module.exports = { ApiKeyRotator };
