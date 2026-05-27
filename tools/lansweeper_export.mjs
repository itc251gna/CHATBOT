import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = stripTrailingSlash(requiredEnv("LS_BASE"));
const username = requiredEnv("LS_USER");
const password = requiredEnv("LS_PASS");
const outputDirectory = process.env.LS_OUTPUT_DIR ?? path.join("dist", "lansweeper");
const top = Number.parseInt(process.env.LS_TOP ?? "20000", 10);
const concurrency = Number.parseInt(process.env.LS_CONCURRENCY ?? "8", 10);

const jar = new Map();

await mkdir(outputDirectory, { recursive: true });

console.log(`Connecting to ${baseUrl}`);
await login();

console.log("Fetching ticket report");
const report = await getJson(`/ReportJson.aspx?det=web50rephelpalltickets&top=${top}&page=1`);
const tickets = (report.AddedRows ?? []).map(parseReportRow).filter((ticket) => ticket.id);

console.log(`Report rows: ${tickets.length}`);
await writeFile(
  path.join(outputDirectory, "tickets-summary.json"),
  JSON.stringify({ exportedAt: new Date().toISOString(), count: tickets.length, tickets }, null, 2),
  "utf8"
);

let completed = 0;
await mapLimit(tickets, concurrency, async (ticket) => {
  ticket.notes = await fetchTicketNotes(ticket.id);
  completed += 1;
  if (completed % 250 === 0 || completed === tickets.length) {
    console.log(`Fetched notes for ${completed}/${tickets.length}`);
  }
});

const exportPath = path.join(outputDirectory, "tickets-with-notes.json");
await writeFile(
  exportPath,
  JSON.stringify({ exportedAt: new Date().toISOString(), count: tickets.length, tickets }, null, 2),
  "utf8"
);

console.log(`Wrote ${exportPath}`);

async function login() {
  const loginPage = await request("/login.aspx");
  const html = await loginPage.text();
  const form = new URLSearchParams({
    __EVENTTARGET: "",
    __EVENTARGUMENT: "",
    __VIEWSTATE: readInputValue(html, "__VIEWSTATE"),
    __EVENTVALIDATION: readInputValue(html, "__EVENTVALIDATION"),
    NameTextBox: username,
    PasswordTextBox: password,
    LoginButton: "WINDOWS LOGIN"
  });

  const response = await request("/login.aspx", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
    redirect: "manual"
  });

  if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
    await request(response.headers.get("location"));
  } else if (!response.ok) {
    throw new Error(`Login failed with HTTP ${response.status}`);
  }
}

async function getJson(url) {
  const response = await request(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchTicketNotes(ticketId) {
  const response = await request(`/helpdesk/TicketNotes.aspx?tid=${encodeURIComponent(ticketId)}&p=1`);
  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const notes = [];
  const notePattern = /<div class="notetext"[^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of html.matchAll(notePattern)) {
    const text = cleanHtml(match[1]);
    if (text && !isNoiseNote(text)) {
      notes.push(text);
    }
  }
  return unique(notes);
}

function parseReportRow(row) {
  const idHtml = String(row[1] ?? "");
  const id = (idHtml.match(/tid=(\d+)/i) ?? idHtml.match(/#(\d+)/))?.[1] ?? "";
  return {
    id,
    createdAt: cleanHtml(row[2]),
    updatedAt: cleanHtml(row[3]),
    source: cleanHtml(row[4]),
    state: cleanHtml(row[5]),
    priority: cleanHtml(row[6]),
    channel: cleanHtml(row[7]),
    requester: cleanHtml(row[8]),
    team: cleanHtml(row[9]),
    agent: cleanHtml(row[10]),
    subject: cleanHtml(row[11])
  };
}

async function request(url, options = {}) {
  const absoluteUrl = new URL(url, `${baseUrl}/`).toString();
  const headers = { ...(options.headers ?? {}) };
  const cookie = cookieHeader();
  if (cookie) {
    headers.cookie = cookie;
  }

  const response = await fetch(absoluteUrl, { ...options, headers });
  rememberCookies(response.headers);
  return response;
}

function rememberCookies(headers) {
  const setCookies = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : splitSetCookie(headers.get("set-cookie"));

  for (const item of setCookies) {
    const [pair] = item.split(";");
    const index = pair.indexOf("=");
    if (index > 0) {
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function splitSetCookie(header) {
  if (!header) {
    return [];
  }
  return header.split(/,(?=\s*[^;,=\s]+=)/g).map((part) => part.trim()).filter(Boolean);
}

function readInputValue(html, name) {
  const pattern = new RegExp(`name=["']${escapeRegExp(name)}["'][^>]*value=["']([^"']*)["']`, "i");
  return html.match(pattern)?.[1] ?? "";
}

function cleanHtml(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseNote(text) {
  return /^(ticket (opened|closed|reopened)|closed|open)$/i.test(text.trim());
}

async function mapLimit(items, limit, iterator) {
  const workers = Array.from({ length: Math.max(1, limit) }, async (_, workerIndex) => {
    for (let index = workerIndex; index < items.length; index += limit) {
      await iterator(items[index], index);
    }
  });
  await Promise.all(workers);
}

function unique(items) {
  return [...new Set(items)];
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}
