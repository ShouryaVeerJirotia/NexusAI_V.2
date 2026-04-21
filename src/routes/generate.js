const express = require("express");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");

function createGenerateRouter({ geminiService, keyRotator }) {
  const router = express.Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const prompt = typeof req.body.prompt === "string" ? req.body.prompt.trim() : "";
      const customKey = typeof req.body.customKey === "string" ? req.body.customKey.trim() : "";
      const attachment = req.body.attachment || null;

      if (!prompt) {
        throw new ApiError(400, "Prompt is required.", {
          code: "MISSING_PROMPT",
        });
      }

      const result = await geminiService.generate({ prompt, customKey, attachment });

      res.json({
        data: result.data,
        modelUsed: result.modelUsed,
        source: result.source,
        keyPool: keyRotator ? keyRotator.getPublicState() : null,
      });
    })
  );

  return router;
}

module.exports = { createGenerateRouter };
