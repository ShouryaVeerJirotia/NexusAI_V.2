const fs = require("fs/promises");
const path = require("path");
const { ApiError } = require("../lib/api-error");

function createFeedbackService({ feedbackLogPath }) {
  async function saveFeedback({ feedback, timestamp }) {
    const trimmedFeedback = typeof feedback === "string" ? feedback.trim() : "";

    if (!trimmedFeedback) {
      throw new ApiError(400, "Feedback cannot be empty.", {
        code: "EMPTY_FEEDBACK",
      });
    }

    const parsedDate = timestamp ? new Date(timestamp) : new Date();
    const safeTimestamp = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();
    const logEntry = `[${safeTimestamp}] FEEDBACK: ${trimmedFeedback}\n--------------------------\n`;

    await fs.mkdir(path.dirname(feedbackLogPath), { recursive: true });
    await fs.appendFile(feedbackLogPath, logEntry, "utf8");
  }

  return {
    saveFeedback,
  };
}

module.exports = { createFeedbackService };
