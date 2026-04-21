function getErrorMessage(error) {
  if (!error) return "";

  if (typeof error === "string") {
    return error;
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return JSON.stringify(error);
}

function classifyGeminiError(error, cooldownMs) {
  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted") ||
    message.includes("too many requests")
  ) {
    return {
      rotate: true,
      statusCode: 429,
      cooldownMs,
      userMessage: "Shared Gemini capacity is temporarily saturated. Rotating to another key.",
    };
  }

  if (
    message.includes("api key not valid") ||
    message.includes("invalid api key") ||
    message.includes("permission denied") ||
    message.includes("unauthorized") ||
    message.includes("403")
  ) {
    return {
      rotate: true,
      statusCode: 401,
      cooldownMs: cooldownMs * 5,
      userMessage: "A Gemini key was rejected. Rotating to another key.",
    };
  }

  if (
    message.includes("503") ||
    message.includes("deadline exceeded") ||
    message.includes("unavailable") ||
    message.includes("internal")
  ) {
    return {
      rotate: true,
      statusCode: 503,
      cooldownMs: Math.max(10_000, Math.floor(cooldownMs / 2)),
      userMessage: "Gemini is temporarily unavailable. Trying the next available key.",
    };
  }

  return {
    rotate: false,
    statusCode: 500,
    cooldownMs: 0,
    userMessage: "Gemini request failed.",
  };
}

module.exports = {
  classifyGeminiError,
  getErrorMessage,
};
