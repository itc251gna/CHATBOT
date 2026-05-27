# AGENTS.MD

## Project

Workspace:

```text
C:\Users\vmarkopoulos\Documents\dev_projects\CHATTY
```

Hospital Intranet Chatbot is a self-hosted deterministic chatbot for internal hospital applications. It is embedded as a small widget and gives safe first-level guidance for ordinary users.

## Current State

The app is a Node.js server with no npm dependencies:

- `server.js`: HTTP/HTTPS server, static files, API endpoints.
- `src/knowledge-base.js`: parses `.txt` knowledge files.
- `src/chat-engine.js`: keyword matching, scoring, clarification, follow-up handling.
- `src/termination-service.js`: creates neutral handoff termination signals with conversation summaries.
- `src/knowledge-audit.js`: read-only conflict/governance analysis for knowledge entries.
- `src/text-normalizer.js`: Greek-friendly text normalization.
- `public/chatbot-widget.js`: embeddable Shadow DOM widget.
- `public/index.html`: central Chatbot AI Portal.
- `knowledge/it-knowledge.txt`: IT, Medico, LIS, RIS/PACS, ΦΙΛΙΠΠΟΣ, MIS, Internet knowledge.
- `knowledge/facilities-issues.txt`: facilities knowledge.
- `test/*.test.js`: Node test suite.
- `docs/`: operational documentation.

## Latest Product Decision

Ticketing logic and the ticket service were removed.

The chatbot now does only Q&A and follow-up guidance. When the user has tried enough and the widget judges that the conversation is no longer resolving the issue, it shows a `Δεν λύθηκε` button. Pressing it calls:

```text
POST /api/termination
```

The widget then emits:

```text
hospital-chatbot-termination
```

The event detail contains `signal: "CHATBOT_HANDOFF_REQUESTED"` plus a compact problem summary and `schemaVersion: "2.0"` structured `handoff` data. The host application decides the next flow. Do not reintroduce internal ticket collection into the chat engine or widget unless the user explicitly changes this architecture again.

The portal page now includes smart KB search and knowledge review. `/api/search` combines keyword scoring with local semantic fallback and BM25-style local ranking, accepts optional non-sensitive `applicationContext` / `appContext` / `departmentContext`, and returns confidence, alternatives, matched keywords, and snippets. `/api/knowledge/audit` is read-only and reports duplicate keywords, broad high-priority keywords, overlapping entries, missing governance metadata, and user-safety flags. `/api/learning/report` is read-only and summarizes the local redacted learning log for admin review.

Host applications can pass non-sensitive context to the widget with `data-app-context`, `data-application-context`, or `window.HospitalChatbot.applicationContext`. This only nudges initial matching; sticky conversation state still prevents casual topic drift.

Context is sticky. Once a specific knowledge topic is detected, vague follow-up messages must stay on that topic. The engine should switch topics when the user explicitly writes a context switch phrase such as `αλλαγή θέματος: ...`, when the widget has been closed/reopened and starts a new session, or when the user clearly corrects/refocuses inside the same knowledge family. Examples: `δεν αφορά παραγγελία, αφορά αποθέματα`, `λάθος θέμα`, or a specific SAP transaction such as `MB21`, `MIGO`, `MIRO` after a broad SAP context. Do not allow casual cross-domain drift such as printer to account access without explicit switch wording.

Conversation controls are global and run before sticky context and knowledge matching. Phrases such as `τέλος συνομιλίας`, `τέλος`, `bye`, `exit` end the conversation; `άκυρο`, `ακύρωση συνομιλίας`, `cancel` clear the active context; `ξεκίνα από την αρχή`, `νέα συνομιλία`, `reset` start fresh. Keep technical uses such as `ακύρωση παραγγελίας στο Medico` routed to knowledge, not to chat cancellation.

SAP MM manuals from the department manuals folder were summarized into user-oriented knowledge only. The knowledge covers broad SAP MM areas: general SAP problem triage, αποθέματα/κρατήσεις/κινήσεις υλικών, αγορές/αιτήσεις/εντολές/συμβάσεις, τιμολόγια/πιστωτικά, βασικό αρχείο υλικών, and φυσική απογραφή/περίοδος καταχώρισης. Do not expose procedural admin steps, financial details, credentials, backend paths, or raw manual content; keep responses focused on safe user checks and safe diagnostic details.

Learning events are logged locally when `CHAT_LEARNING_LOG_ENABLED=true`, defaulting in production to `/var/lib/chatty/learning-events.jsonl`. They are redacted and must be reviewed before changing knowledge. Use `npm run learning:report -- /var/lib/chatty/learning-events.jsonl` to find repeated unresolved topics and low-confidence user messages. Use `npm run regression:candidates -- /var/lib/chatty/learning-events.jsonl dist/regression-candidates.json` to generate review-required candidate tests. Do not auto-write learned answers into the knowledge base.

Gmail-derived IT knowledge must be imported only through `tools/gmail_it_knowledge_import.py`. The importer is local-only, redacts sensitive values, discards financial/admin-only content, stores no raw email bodies or samples, and writes sanitized user-facing categories to `knowledge/it-gmail-knowledge.txt`. If Gmail IMAP auth fails, use Gmail Takeout zip streaming with `npm run gmail:import -- --takeout-zip <path>` or a local `.mbox` with `npm run gmail:import -- --mbox <path>`.

## Conversation Context

The user wanted a chatbot add-on for internal hospital network applications:

- ingest technical knowledge from `.txt`,
- use predefined keywords and answers,
- answer what an ordinary user can do,
- work inside private-network hospital apps.

Admin-oriented DOCX manuals about Medico/LIS/RIS/PACS and operations were transformed into user-safe knowledge. Admin-only/elevated content was excluded.

Important exclusion rule:

- Do not expose server IPs, admin credentials, SQL commands, registry edits, service restarts, DameWare procedures, Oracle/SAP/Linux commands, or backend operational procedures to ordinary users.

Facilities knowledge was added for:

- power,
- lighting,
- water leaks,
- HVAC,
- elevators,
- doors/access,
- medical gases,
- refrigerators,
- smoke/smell/noise,
- building/furniture damage.

Local terminology:

- `εφαρμογή ασθενών` means `Medico`.
- `δίκτυο` can mean `ΦΙΛΙΠΠΟΣ`, `MIS`, or `Internet`.
- `ΦΙΛΙΠΠΟΣ` is the hospital internal network.
- `MIS` is the classified Air Force network.
- `Internet` is external web access and should stay separate from internal hospital application connectivity.
- `απεικονιστικό σύστημα` means `AGFA RIS/PACS`.

The engine asks clarification for ambiguous network queries.

## Behavioral Principles

Preferred flow:

1. Identify the likely topic.
2. Give safe checks the user can perform.
3. Ask the user to report what happened.
4. Continue from the same topic when the user is stuck on a step.
5. Show handoff only after repeated unresolved attempts.

Immediate escalation wording is still allowed inside knowledge for safety-critical patterns:

- smoke,
- burnt smell,
- power,
- leak,
- elevator,
- medical gases/oxygen,
- vaccines/medicines/samples,
- clinical operation risk.

For non-critical problems, keep the answer focused on safe checks and follow-up questions.

## Knowledge Authoring Rules

Knowledge entries use:

```text
# Title
keywords: keyword, phrase, synonym
priority: 5
owner: IT
domain: it-devices
category: printing
risk level: normal
last reviewed: 2026-05-22
user safe: yes
admin only: no
examples: user phrasing
negative examples: query that should not route here
actions:
- Safe user action.
followups:
- step=1 | keywords=what user may say | answer=Safe continuation for this step. | actions=Optional next safe action
answer:
Short explanation for the ordinary user.
---
```

Rules:

- Keep answers for ordinary users.
- Use specific phrases for specific systems.
- Keep general topics at low priority.
- Keep system-specific topics at higher priority.
- Avoid personal data examples.
- Avoid admin procedures.
- Avoid credentials, IPs, backend paths, commands, registry, services, database operations.
- If unsure whether an action is elevated, omit it and ask the user for safe diagnostic information.
- Use `followups:` for step-specific continuation.
- Follow-up answers must stay ordinary-user safe.
- Use `examples` and `negative examples` to make future conflict checks and search tuning safer.
- Keep `admin only: yes` or `user safe: no` out of user-facing answers unless the content has been rewritten.

## Priority Guidance

- `priority: 1`: generic fallback-like guidance.
- `priority: 2`: generic meta guidance.
- `priority: 3`: non-critical specialized guidance.
- `priority: 4`: important system-specific guidance.
- `priority: 5`: high-confidence, common, or operationally important scenarios.

Priority is only a tie-breaker. Specific keyword phrases matter more.

## Tests

Run:

```powershell
npm test
```

Run knowledge audit:

```powershell
npm run kb:analyze
```

Run learning review:

```powershell
npm run learning:report -- /var/lib/chatty/learning-events.jsonl
```

Tests cover:

- parser behavior,
- matching,
- delayed escalation cleanup,
- follow-up conversations,
- local terminology,
- ΦΙΛΙΠΠΟΣ/MIS/Internet clarification,
- facilities vs IT routing,
- barcode over generic printer routing,
- termination signal generation.
- smart portal search and KB audit behavior.
- reviewed regression queries from `test/fixtures/regression-queries.json`.

When changing knowledge, add or update tests in `test/knowledge-content.test.js`.

## Production Notes

Production uses:

- Node.js >= 20,
- `/home/kmh251/deployment/chatty` on the VM at `10.4.51.232`,
- Docker Compose project `chatty` behind the unified KAI Docker Nginx edge,
- `chatty-chatty-1` is attached to `kai_app_default` with alias `chatty`,
- preferred public route is `https://chatty.251gh.local` through `kai-nginx` on `443`,
- unified Nginx upstream is `http://chatty:3000`,
- legacy system Nginx route is kept on public HTTP `3000` and HTTPS `3443`,
- legacy host-local container upstream is `127.0.0.1:13000`,
- previous native `chatty.service` kept disabled for rollback only,
- health check on `/api/health`,
- optional CORS restriction via `ALLOWED_ORIGINS`.

See:

- `docs/PRODUCTION_INSTALLATION.md`
- `docs/EMBEDDING_GUIDE.md`
- `docs/DEPLOYMENT_STATUS.md`

## Common Pitfalls

- Adding broad keywords like `πρόβλημα`, `σφάλμα`, `δίκτυο` to high-priority entries can steal matches.
- Adding early helpdesk-style wording may be stripped by delayed escalation logic.
- If a safety-critical entry must escalate immediately, include concrete risk words like `καπνός`, `ρεύμα`, `διαρροή`, `οξυγόνο`, `ιατρικά αέρια`.
- Do not add admin-only solutions from manuals into user-facing knowledge.
- Remember that the widget resolves relative API URLs against the chatbot script URL.
- Do not recreate a separate data-collection flow inside chat responses; use termination handoff only.

## Useful Commands

Start server:

```powershell
npm start
```

Run tests:

```powershell
npm test
```

API smoke test:

```powershell
$body = @{ message = "δεν ανοίγει η εφαρμογή ασθενών"; interactionCount = 1 } | ConvertTo-Json
Invoke-RestMethod `
  -Uri http://localhost:3000/api/chat `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Termination smoke test:

```powershell
$body = @{
  reason = "unable_to_resolve_after_attempts"
  messages = @(@{ role = "user"; text = "Το έκανα αλλά πάλι δεν λύθηκε" })
} | ConvertTo-Json -Depth 4
Invoke-RestMethod `
  -Uri http://localhost:3000/api/termination `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

## Maintenance Style

Prefer small, auditable changes.

When editing knowledge:

1. Add or refine keywords.
2. Preserve user-safe tone.
3. Add test queries.
4. Run `npm test`.
5. Smoke test API if behavior changed.

When editing frontend:

1. Keep widget isolated with Shadow DOM.
2. Avoid dependencies unless justified.
3. Test on the local portal page.
4. Avoid layout shifts and overlapping UI.

When editing server:

1. Keep APIs simple.
2. Avoid storing message history unless explicitly required.
3. Keep CORS behavior explicit.
4. Preserve local-only, no-cloud design.
5. Preserve security headers and API rate limiting unless deployment tuning is explicit.
