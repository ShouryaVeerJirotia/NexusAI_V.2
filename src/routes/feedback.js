const express = require("express");
const { asyncHandler } = require("../lib/async-handler");

function createFeedbackRouter({ feedbackService }) {
  const router = express.Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      await feedbackService.saveFeedback({
        feedback: req.body.feedback,
        timestamp: req.body.timestamp,
      });

      res.status(200).json({
        success: true,
        message: "Intel transmitted.",
      });
    })
  );

  return router;
}

module.exports = { createFeedbackRouter };
