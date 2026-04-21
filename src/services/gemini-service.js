const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ApiError } = require("../lib/api-error");
const { classifyGeminiError, getErrorMessage } = require("./gemini-error-policy");

function normalizeAttachment(attachment) {
  if (!attachment) {
    return null;
  }

  const inlineData = attachment.inlineData;

  if (
    !inlineData ||
    typeof inlineData.data !== "string" ||
    !inlineData.data.trim() ||
    typeof inlineData.mimeType !== "string" ||
    !inlineData.mimeType.trim()
  ) {
    throw new ApiError(400, "Attachment format is invalid.", {
      code: "INVALID_ATTACHMENT",
    });
  }

  return {
    inlineData: {
      data: inlineData.data.trim(),
      mimeType: inlineData.mimeType.trim(),
    },
  };
}

function toContentItems(prompt, attachment) {
  const items = [prompt];
  const normalizedAttachment = normalizeAttachment(attachment);

  if (normalizedAttachment) {
    items.push(normalizedAttachment);
  }

  return items;
}

async function generateWithKey({ apiKey, modelName, contentItems }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(contentItems);
  const response = await result.response;
  const text = response.text();

  const cleanJson = text.replace(/```json|```/gi, "").trim();

  try {
    return {
      data: JSON.parse(cleanJson),
      rawText: text,
      parsedAsJson: true,
    };
  } catch (_error) {
    return {
      data: text,
      rawText: text,
      parsedAsJson: false,
    };
  }
}

function createGeminiService({ modelName, keyRotator, keyCooldownMs }) {
  async function generate({ prompt, attachment, customKey }) {
    const contentItems = toContentItems(prompt, attachment);

    if (customKey) {
      try {
        const result = await generateWithKey({
          apiKey: customKey,
          modelName,
          contentItems,
        });

        return {
          ...result,
          modelUsed: "Personal Satellite Link",
          source: "custom",
        };
      } catch (error) {
        const policy = classifyGeminiError(error, keyCooldownMs);
        throw new ApiError(policy.statusCode, "Custom Gemini key request failed.", {
          code: "CUSTOM_KEY_FAILED",
          details: getErrorMessage(error),
          exposeDetails: true,
        });
      }
    }

    if (!keyRotator || keyRotator.size === 0) {
      throw new ApiError(500, "No shared Gemini keys are configured.", {
        code: "NO_SHARED_KEYS_CONFIGURED",
      });
    }

    const candidates = keyRotator.ensureReadyKey();
    const failures = [];

    for (const key of candidates) {
      try {
        const result = await generateWithKey({
          apiKey: key.value,
          modelName,
          contentItems,
        });

        keyRotator.markSuccess(key);

        return {
          ...result,
          modelUsed: "Nexus Shared Engine",
          source: "shared",
        };
      } catch (error) {
        const policy = classifyGeminiError(error, keyCooldownMs);
        failures.push(getErrorMessage(error));

        if (!policy.rotate) {
          throw new ApiError(policy.statusCode, "Gemini request failed.", {
            code: "GEMINI_REQUEST_FAILED",
            details: getErrorMessage(error),
            exposeDetails: true,
          });
        }

        keyRotator.markFailure(key, getErrorMessage(error), policy.cooldownMs);
      }
    }

    throw new ApiError(503, "All shared Gemini keys failed for this request.", {
      code: "SHARED_KEYS_EXHAUSTED",
      details: failures.join(" | "),
      retryAfterMs: keyRotator.getNextRetryAt()
        ? Math.max(1_000, keyRotator.getNextRetryAt() - Date.now())
        : keyCooldownMs,
      exposeDetails: true,
    });
  }

  return {
    generate,
  };
}

module.exports = { createGeminiService };
