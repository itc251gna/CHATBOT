import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = stripTrailingSlash(requiredEnv("LS_BASE"));
const username = requiredEnv("LS_USER");
const password = requiredEnv("LS_PASS");
const outputDirectory = process.env.LS_OUTPUT_DIR ?? path.join("dist", "lansweeper");
const concurrency = Number.parseInt(process.env.LS_CONCURRENCY ?? "6", 10);
const timeoutMs = Number.parseInt(process.env.LS_TIMEOUT_MS ?? "8000", 10);
const saveHtml = process.env.LS_SAVE_HTML === "1";

const jar = new Map();
const visited = new Set();

await mkdir(outputDirectory, { recursive: true });

console.log(`Connecting to ${baseUrl}`);
await login();

console.log("Discovering Lansweeper knowledgebase pages");
const discovered = await discoverKnowledgebaseLinks();
console.log(`Discovered ${discovered.length} candidate links`);
await writeFile(
  path.join(outputDirectory, "knowledgebase-links.json"),
  JSON.stringify({ exportedAt: new Date().toISOString(), count: discovered.length, links: discovered }, null, 2),
  "utf8"
);

const articleLinks = discovered.filter((url) => /[?&]kbid=\d+/i.test(url));
console.log(`Fetching ${articleLinks.length} article pages`);

const articles = [];
await mapLimit(articleLinks, concurrency, async (url) => {
  const article = await fetchArticle(url);
  if (article && article.title && article.body) {
    articles.push(article);
  }
});

const uniqueArticles = uniqueBy(articles, (article) => article.url);
uniqueArticles.sort((a, b) => a.title.localeCompare(b.title, "el"));

const exportPath = path.join(outputDirectory, "knowledgebase-articles.json");
await writeFile(
  exportPath,
  JSON.stringify({ exportedAt: new Date().toISOString(), count: uniqueArticles.length, articles: uniqueArticles }, null, 2),
  "utf8"
);

console.log(`Wrote ${exportPath}`);
console.log(`Article count: ${uniqueArticles.length}`);

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

async function discoverKnowledgebaseLinks() {
  const seeds = [
    "/",
    "/default.aspx",
    "/helpdesk/default.aspx",
    "/helpdesk/",
    "/helpdesk/Knowledgebase.aspx",
    "/helpdesk/KnowledgeBase.aspx",
    "/helpdesk/KB.aspx",
    "/helpdesk/Kb.aspx",
    "/helpdesk/KBArticles.aspx",
    "/helpdesk/KBArticle.aspx",
    "/helpdesk/Article.aspx",
    "/helpdesk/Articles.aspx"
  ];

  const candidates = new Set();
  const queue = [...seeds];

  while (queue.length > 0 && visited.size < 250) {
    const url = queue.shift();
    if (!url || visited.has(url)) {
      continue;
    }

    visited.add(url);
    if (visited.size % 25 === 0) {
      console.log(`Visited ${visited.size} pages, candidates ${candidates.size}`);
    }

    const response = await request(url).catch(() => null);
    if (!response || !response.ok) {
      continue;
    }

    const html = await response.text();
    const links = extractLinks(html);
    for (const link of links) {
      if (isKnowledgebaseLink(link)) {
        candidates.add(link);
      }

      if (isDiscoveryLink(link) && !visited.has(link) && queue.length < 500) {
        queue.push(link);
      }
    }
  }

  return [...candidates];
}

async function fetchArticle(url) {
  const response = await request(url).catch(() => null);
  if (!response || !response.ok) {
    return null;
  }

  const html = await response.text();
  if (saveHtml) {
    await mkdir(path.join(outputDirectory, "kb-html"), { recursive: true });
    await writeFile(path.join(outputDirectory, "kb-html", `${safeFilename(url)}.html`), html, "utf8");
  }
  const title = articleTitle(html);
  const body = articleBody(html);
  if (!body || body.length < 40) {
    return null;
  }

  return {
    url: new URL(url, `${baseUrl}/`).toString(),
    title,
    body,
    links: extractLinks(html).filter((link) => isAttachmentLink(link)).map((link) => new URL(link, `${baseUrl}/`).toString())
  };
}

function articleTitle(html) {
  const kbHeader = html.match(/<h1\b[^>]*id=["']kbheader["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return cleanHtml(kbHeader ?? h1 ?? h2 ?? title ?? "Lansweeper knowledgebase article");
}

function articleBody(html) {
  const main =
    html.match(/<div\b[^>]*id=["']kbmess["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1] ??
    html.match(/<div\b[^>]*id=["']kbmessage["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ??
    html.match(/<div[^>]+class=["'][^"']*(?:kb|knowledge|article)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    html.match(/<form[^>]*>([\s\S]*?)<\/form>/i)?.[1] ??
    html;

  return cleanHtml(main)
    .replace(/\b(Edit|Delete|Created by|Last updated|Back to overview)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html) {
  const links = [];
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = decodeHtml(match[1]).trim();
    if (!href || href.startsWith("#") || /^javascript:/i.test(href) || /^mailto:/i.test(href)) {
      continue;
    }

    const url = new URL(href, `${baseUrl}/`);
    if (url.origin === new URL(baseUrl).origin) {
      links.push(`${url.pathname}${url.search}`);
    }
  }
  return unique(links);
}

function isDiscoveryLink(url) {
  return /helpdesk|kb|knowledge|article/i.test(url);
}

function isKnowledgebaseLink(url) {
  if (isAttachmentLink(url)) {
    return false;
  }

  return /(?:kb|knowledge|article)/i.test(url) && /(?:id|kid|kb|article|knowledge|cat|category)=|\/(?:kb|knowledge|article)/i.test(url);
}

function isAttachmentLink(url) {
  return /\.(?:pdf|docx?|xlsx?|txt|rtf|png|jpe?g)$/i.test(url) || /attachment|download|file/i.test(url);
}

async function request(url, options = {}) {
  const absoluteUrl = new URL(url, `${baseUrl}/`).toString();
  const headers = { ...(options.headers ?? {}) };
  const cookie = cookieHeader();
  if (cookie) {
    headers.cookie = cookie;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(absoluteUrl, { ...options, headers, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
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
  return decodeHtml(String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'");
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

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeFilename(value) {
  return value
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "page";
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}
