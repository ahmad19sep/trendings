import pino from "pino";

export const workerLogger = pino({
  name: "creator-trend-radar-worker",
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "*.authorization",
      "*.cookie",
      "*.token",
      "*.apiKey",
      "*.password",
      "*.secret",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});

