import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createChatEngine } from "./src/chat-engine.js";
import { loadKnowledgeFromDirectory } from "./src/knowledge-base.js";
import { analyzeKnowledgeBase } from "./src/knowledge-audit.js";
import { buildLearningReport } from "./src/learning-report.js";
import { buildTerminationSignal } from "./src/termination-service.js";
import { appendLearningEvent } from "./src/learning-log.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDirectory = path.join(__dirname, "public");
const knowledgeDirectory = process.env.KNOWLEDGE_DIR
  ? path.resolve(process.env.KNOWLEDGE_DIR)
  : path.join(__dirname, "knowledge");
const port = resolvePort(process.argv.slice(2), process.env.PORT ?? "3000");
const httpsPort = resolveOptionalPort(process.argv.slice(2), process.env.HTTPS_PORT);
const httpsCertPath = readOption(process.argv.slice(2), "--https-cert") ?? process.env.HTTPS_CERT_PATH ?? "";
const httpsKeyPath = readOption(process.argv.slice(2), "--https-key") ?? process.env.HTTPS_KEY_PATH ?? "";
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const rateLimitWindowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);
const rateLimitMaxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX ?? "240", 10);
const rateLimitBuckets = new Map();

let cachedEngine = null;
let cacheLoadedAt = 0;
const cacheTtlMs = Number.parseInt(process.env.KNOWLEDGE_CACHE_MS ?? "2000", 10);

const requestHandler = async (request, response) => {
  try {
    setSecurityHeaders(response);
    setCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const protocol = request.socket.encrypted ? "https" : "http";
    const url = new URL(request.url, `${protocol}://${request.headers.host ?? "localhost"}`);

    if (isRateLimited(request, url)) {
      await sendJson(response, { error: "too many requests" }, 429);
      return;
    }

    if (url.pathname === "/api/health") {
      await sendJson(response, { ok: true });
      return;
    }

    if (url.pathname === "/api/topics" && request.method === "GET") {
      const engine = await getEngine();
      await sendJson(response, { topics: engine.topics(12) });
      return;
    }

    if (url.pathname === "/api/search" && request.method === "GET") {
      const engine = await getEngine();
      const query = url.searchParams.get("q") ?? "";
      const limit = Number.parseInt(url.searchParams.get("limit") ?? "8", 10) || 8;
      const applicationContext = url.searchParams.get("applicationContext") ?? url.searchParams.get("appContext") ?? "";
      const departmentContext = url.searchParams.get("departmentContext") ?? "";
      await sendJson(response, engine.search(query, {
        limit: Math.min(Math.max(limit, 1), 20),
        applicationContext,
        departmentContext
      }));
      return;
    }

    if (url.pathname === "/api/knowledge/audit" && request.method === "GET") {
      const entries = await getKnowledgeEntries();
      await sendJson(response, analyzeKnowledgeBase(entries));
      return;
    }

    if (url.pathname === "/api/learning/report" && request.method === "GET") {
      await sendJson(response, await buildLearningReport());
      return;
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      const body = await readJsonBody(request);
      const message = String(body.message ?? "").trim();
      const interactionCount = Number.parseInt(body.interactionCount ?? "0", 10) || 0;
      const conversationState = isPlainObject(body.conversationState) ? body.conversationState : null;
      const applicationContext = String(body.applicationContext ?? body.appContext ?? "").trim();
      const departmentContext = String(body.departmentContext ?? "").trim();

      if (!message) {
        await sendJson(response, { error: "message is required" }, 400);
        return;
      }

      const engine = await getEngine();
      const answer = engine.answer(message, { interactionCount, conversationState, applicationContext, departmentContext });
      await recordLearningEvent({
        event: "chat_exchange",
        request: {
          message,
          interactionCount,
          conversationState,
          applicationContext,
          departmentContext
        },
        response: answer
      });
      await sendJson(response, answer);
      return;
    }

    if (url.pathname === "/api/termination" && request.method === "POST") {
      const body = await readJsonBody(request);
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const conversationState = isPlainObject(body.conversationState) ? body.conversationState : null;
      const reason = String(body.reason ?? "").trim();
      const lastResponseType = String(body.lastResponseType ?? "").trim();

      const signal = buildTerminationSignal({ messages, conversationState, reason, lastResponseType });
      await recordLearningEvent({
        event: "termination_signal",
        request: {
          reason,
          lastResponseType,
          conversationState,
          messageCount: messages.length
        },
        response: signal
      });
      await sendJson(response, signal);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(url.pathname, response);
      return;
    }

    await sendJson(response, { error: "not found" }, 404);
  } catch (error) {
    console.error(error);
    await sendJson(response, { error: "internal server error" }, 500);
  }
};

const server = createHttpServer(requestHandler);

server.on("error", (error) => handleServerError(error, port));

server.listen(port, () => {
  console.log(`Hospital intranet chatbot is running at http://localhost:${port}`);
  console.log(`Knowledge directory: ${knowledgeDirectory}`);
});

if (httpsPort || httpsCertPath || httpsKeyPath) {
  if (!httpsPort || !httpsCertPath || !httpsKeyPath) {
    console.error("HTTPS requires HTTPS_PORT, HTTPS_CERT_PATH and HTTPS_KEY_PATH.");
    process.exit(1);
  }

  const httpsServer = createHttpsServer(
    {
      cert: readFileSync(httpsCertPath),
      key: readFileSync(httpsKeyPath)
    },
    requestHandler
  );
  httpsServer.on("error", (error) => handleServerError(error, httpsPort));
  httpsServer.listen(httpsPort, () => {
    console.log(`Hospital intranet chatbot HTTPS is running at https://localhost:${httpsPort}`);
  });
}

function handleServerError(error, listenPort) {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${listenPort} is already in use. Start with another port, for example: npm start -- --port ${listenPort + 1}`);
    process.exit(1);
  }

  throw error;
}

function resolvePort(args, fallback) {
  const cliPort = readOption(args, "--port") ?? readOption(args, "-p");
  const value = cliPort ?? fallback;

  if (!/^\d+$/.test(String(value))) {
    console.error(`Invalid port "${value}". Use a number between 1 and 65535.`);
    process.exit(1);
  }

  const parsedPort = Number.parseInt(value, 10);
  if (parsedPort < 1 || parsedPort > 65535) {
    console.error(`Invalid port "${value}". Use a number between 1 and 65535.`);
    process.exit(1);
  }

  return parsedPort;
}

function resolveOptionalPort(args, fallback) {
  const cliPort = readOption(args, "--https-port");
  const value = cliPort ?? fallback;
  if (!value) {
    return null;
  }

  return resolvePort([], value);
}

function readOption(args, name) {
  const equalsPrefix = `${name}=`;
  const equalsMatch = args.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsMatch) {
    return equalsMatch.slice(equalsPrefix.length);
  }

  const index = args.indexOf(name);
  if (index !== -1) {
    return args[index + 1] ?? "";
  }

  return null;
}

async function getEngine() {
  const now = Date.now();
  if (cachedEngine && now - cacheLoadedAt < cacheTtlMs) {
    return cachedEngine;
  }

  const entries = await getKnowledgeEntries();
  cachedEngine = createChatEngine(entries);
  cacheLoadedAt = now;
  return cachedEngine;
}

async function getKnowledgeEntries() {
  return loadKnowledgeFromDirectory(knowledgeDirectory);
}

async function serveStatic(pathname, response) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(requestedPath).replace(/^[/\\]+/, "");
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDirectory, safePath);
  const relativePath = path.relative(publicDirectory, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    await sendJson(response, { error: "not found" }, 404);
    return;
  }

  try {
    const file = await readFile(filePath);
    const headers = {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": "no-store"
    };
    if (path.extname(filePath).toLowerCase() === ".html") {
      headers["Content-Security-Policy"] = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        "img-src 'self' data:",
        "base-uri 'none'",
        "form-action 'self'"
      ].join("; ");
    }
    response.writeHead(200, headers);
    response.end(file);
  } catch {
    await sendJson(response, { error: "not found" }, 404);
  }
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)");
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  const allowAnyOrigin = allowedOrigins.includes("*");
  const allowedOrigin = allowAnyOrigin ? (origin ?? "*") : allowedOrigins.find((item) => item === origin);

  if (allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function isRateLimited(request, url) {
  if (!url.pathname.startsWith("/api/") || url.pathname === "/api/health") {
    return false;
  }

  if (!Number.isFinite(rateLimitWindowMs) || !Number.isFinite(rateLimitMaxRequests) || rateLimitMaxRequests <= 0) {
    return false;
  }

  const now = Date.now();
  const key = request.socket.remoteAddress || "unknown";
  const bucket = rateLimitBuckets.get(key) ?? [];
  const recent = bucket.filter((timestamp) => now - timestamp < rateLimitWindowMs);
  recent.push(now);
  rateLimitBuckets.set(key, recent);

  if (rateLimitBuckets.size > 2000) {
    cleanupRateLimitBuckets(now);
  }

  return recent.length > rateLimitMaxRequests;
}

function cleanupRateLimitBuckets(now) {
  for (const [key, bucket] of rateLimitBuckets) {
    const recent = bucket.filter((timestamp) => now - timestamp < rateLimitWindowMs);
    if (recent.length === 0) {
      rateLimitBuckets.delete(key);
    } else {
      rateLimitBuckets.set(key, recent);
    }
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new Error("Request body too large");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function sendJson(response, payload, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[extension] ?? "application/octet-stream";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function recordLearningEvent(event) {
  try {
    await appendLearningEvent(event);
  } catch (error) {
    console.error("Could not append learning event", error);
  }
}
