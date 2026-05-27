# Hospital Intranet Chatbot

Self-hosted deterministic chatbot for hospital intranet applications. It reads `.txt` knowledge files, matches user text against keywords, and returns safe first-level guidance for ordinary users. It does not call cloud AI or external APIs.

The central page `/` works as a Chatbot AI Portal with smart knowledge search, knowledge audit, widget testing, and live termination-signal preview. The chat flow is intentionally separate from any external workflow. When the widget detects that the user has tried enough and the issue is still unresolved, it shows a `Δεν λύθηκε` button. That button calls `/api/termination` and emits a browser event with a compact summary, so the host application can decide what to do next.

The chat engine also supports global conversation controls before knowledge matching:

- `τέλος συνομιλίας`, `τέλος`, `bye`, `exit`: end the current conversation.
- `άκυρο`, `ακύρωση συνομιλίας`, `cancel`: cancel the active context.
- `ξεκίνα από την αρχή`, `νέα συνομιλία`, `reset`: clear context and start fresh.

Context remains sticky for vague follow-ups, but the engine can now refocus inside the same knowledge family when the user clearly corrects the topic, for example `δεν αφορά παραγγελία, αφορά αποθέματα`, or when a more specific transaction code such as `MB21`, `MIGO` or `MIRO` is provided inside the active SAP context.

## Documentation

- [Application documentation](docs/APPLICATION_DOCUMENTATION.md)
- [Production installation guide](docs/PRODUCTION_INSTALLATION.md)
- [Embedding guide](docs/EMBEDDING_GUIDE.md)
- [Current deployment status](docs/DEPLOYMENT_STATUS.md)
- [Future improvements](docs/FUTURE_IMPROVEMENTS.md)
- [AGENTS.MD](AGENTS.MD)

## Run

```powershell
npm start
```

Use another port:

```powershell
npm start -- --port 3010
```

Demo:

```text
http://localhost:3000
```

## API

Read-only smart search with lexical, semantic and BM25 scoring:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/search?q=δεν%20ανοίγει%20το%20PACS&limit=5"
```

Optional non-sensitive host context can be passed as `applicationContext`, `appContext`, or `departmentContext` to nudge the first ranking without changing sticky chat behavior:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/search?q=δεν%20ανοίγει&applicationContext=medico&limit=5"
```

Read-only knowledge audit:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/knowledge/audit
```

Read-only learning report from the local redacted learning log:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/learning/report
```

```powershell
$body = @{ message = "ο εκτυπωτής δεν τυπώνει" } | ConvertTo-Json
Invoke-RestMethod `
  -Uri http://localhost:3000/api/chat `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Termination signal:

```powershell
$body = @{
  reason = "unable_to_resolve_after_attempts"
  messages = @(
    @{ role = "user"; text = "Δεν δουλεύει ο εκτυπωτής" },
    @{ role = "bot"; title = "Εκτυπωτής δεν τυπώνει"; text = "Ελέγξτε χαρτί και toner" },
    @{ role = "user"; text = "Το έκανα αλλά πάλι δεν τυπώνει" }
  )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod `
  -Uri http://localhost:3000/api/termination `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

The termination response uses `schemaVersion: "2.0"` and keeps the stable `signal: "CHATBOT_HANDOFF_REQUESTED"` value. Host applications can read `handoff.topic`, `handoff.resolutionState`, `handoff.problemStatement`, and `handoff.routingHints`.

## Embed

```html
<script
  src="https://intranet-chatbot.local/chatbot-widget.js"
  data-chatbot-api="https://intranet-chatbot.local/api/chat"
  data-chatbot-termination="https://intranet-chatbot.local/api/termination"
  data-chatbot-topics="https://intranet-chatbot.local/api/topics"
  data-app-context="medico"
  data-department-context="clinical"
  data-title="Τεχνική υποστήριξη"
  data-subtitle="Εσωτερική καθοδήγηση"
></script>

<script>
  window.addEventListener("hospital-chatbot-termination", (event) => {
    console.log(event.detail.signal);
    console.log(event.detail.summary);
  });
</script>
```

Equivalent config object:

```html
<script>
  window.HospitalChatbot = {
    apiUrl: "https://intranet-chatbot.local/api/chat",
    terminationUrl: "https://intranet-chatbot.local/api/termination",
    topicsUrl: "https://intranet-chatbot.local/api/topics",
    applicationContext: "medico",
    departmentContext: "clinical",
    title: "Τεχνική υποστήριξη"
  };
</script>
<script src="https://intranet-chatbot.local/chatbot-widget.js"></script>
```

## Knowledge Files

Knowledge files live in `knowledge/`. Entries are separated with `---`.

- `it-knowledge.txt`: IT, Medico, LIS, RIS/PACS, ΦΙΛΙΠΠΟΣ, MIS, Internet.
- `facilities-issues.txt`: facilities issues and safe user actions.
- `it-gmail-knowledge.txt`: generated locally from the IT mailbox when `tools/gmail_it_knowledge_import.py` runs successfully.

Local terminology:

- `εφαρμογή ασθενών` means `Medico`.
- `απεικονιστικό σύστημα` means `AGFA RIS/PACS`.
- `δίκτυο` may mean `ΦΙΛΙΠΠΟΣ`, `MIS`, or `Internet`; ambiguous cases trigger clarification.

```text
# Εκτυπωτής δεν τυπώνει
keywords: εκτυπωτής, printer, δεν τυπώνει, ουρά εκτύπωσης
priority: 5
owner: IT
domain: it-devices
category: printing
risk level: normal
last reviewed: 2026-05-22
user safe: yes
admin only: no
examples: ο εκτυπωτής δεν τυπώνει, μένει στην ουρά
negative examples: εγκατάσταση driver εκτυπωτή
actions:
- Ελέγξτε ότι ο εκτυπωτής είναι ανοικτός.
- Ελέγξτε χαρτί, toner και εμπλοκή χαρτιού.
answer:
Για πρόβλημα εκτύπωσης ξεκινήστε από τους βασικούς ελέγχους συσκευής και δικτύου.
---
```

Optional metadata is backwards-compatible. Use it for review and audit; the user-facing answer still comes only from `answer`, `actions`, and safe `followups`.

## Knowledge Review

Run the conflict/governance analyzer:

```powershell
npm run kb:analyze
```

It writes:

```text
dist/kb-analysis/knowledge-audit.json
dist/kb-analysis/knowledge-audit.md
```

The analyzer reports duplicate keywords, broad high-priority keywords, overlapping entries, stale/missing review metadata, and entries flagged as not user-safe. It does not modify knowledge files.

## Local Gmail Knowledge Import

The Gmail importer processes mail locally and writes only sanitized, user-facing knowledge categories. It does not store raw email content, message samples, IPs, credentials, financial content, or admin-only instructions.

Gmail IMAP usually requires IMAP to be enabled and an app password. You can also use a local Gmail/Takeout `.mbox` export.

```powershell
$env:GMAIL_USER = "it-department@example.local"
$env:GMAIL_PASSWORD = "<gmail-app-password>"
npm run gmail:import -- --limit 1000
```

Local Takeout `.zip` import, without extracting raw mail permanently:

```powershell
npm run gmail:import -- --takeout-zip C:\path\to\takeout.zip
```

Local `.mbox` fallback:

```powershell
npm run gmail:import -- --mbox C:\path\to\All-mail-Including-Spam-and-Trash.mbox
```

## Server Settings

```powershell
$env:PORT = "3000"
$env:KNOWLEDGE_DIR = "C:\path\to\knowledge"
$env:ALLOWED_ORIGINS = "https://intranet-app.local"
$env:KNOWLEDGE_CACHE_MS = "2000"
$env:HTTPS_PORT = "3443"
$env:HTTPS_CERT_PATH = "C:\path\to\chatty.crt"
$env:HTTPS_KEY_PATH = "C:\path\to\chatty.key"
$env:RATE_LIMIT_WINDOW_MS = "60000"
$env:RATE_LIMIT_MAX = "240"
npm start
```

Microphone dictation uses the browser Web Speech API. It writes recognized text into the input field only; it does not store audio. Browsers require `localhost` or trusted HTTPS.

## Tests

```powershell
npm test
```

Learning analytics from production logs:

```powershell
npm run learning:report -- /var/lib/chatty/learning-events.jsonl
```

Generate reviewed-regression candidates from learning logs:

```powershell
npm run regression:candidates -- /var/lib/chatty/learning-events.jsonl dist/regression-candidates.json
```

Promoted, reviewed regression queries live in `test/fixtures/regression-queries.json` and are checked by `npm test`.
