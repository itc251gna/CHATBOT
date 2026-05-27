import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_LOG_PATH = path.join(process.cwd(), "data", "learning-events.jsonl");

export async function appendLearningEvent(event) {
  if (!isLearningLogEnabled()) {
    return;
  }

  const filePath = process.env.CHAT_LEARNING_LOG_PATH || DEFAULT_LOG_PATH;
  const record = redactSensitiveValues({
    ...event,
    createdAt: new Date().toISOString()
  });

  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

function isLearningLogEnabled() {
  return ["1", "true", "yes", "on"].includes(String(process.env.CHAT_LEARNING_LOG_ENABLED ?? "").toLowerCase());
}

function redactSensitiveValues(value) {
  if (typeof value === "string") {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, shouldRedactKey(key) ? "[REDACTED]" : redactSensitiveValues(item)])
    );
  }

  return value;
}

function shouldRedactKey(key) {
  return /password|passwd|κωδικ|κωδικό|token|secret|credential/i.test(String(key));
}

function redactText(value) {
  return String(value ?? "")
    .replace(/\b\d{11}\b/g, "[REDACTED_AMKA]")
    .replace(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, "[REDACTED_IP]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/(?:\+30\s*)?\b(?:2\d{9}|69\d{8})\b/g, "[REDACTED_PHONE]")
    .replace(/\b(?:password|passwd|κωδικ(?:ός|οσ|ο)|κωδικό|κωδικο)\s*[:= -]*\S+/giu, "[REDACTED_SECRET]");
}
