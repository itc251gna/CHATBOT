# Production Deployment Status

## Current VM

- Last verified deployment: `2026-05-27`
- Host/IP: `10.4.51.232`
- Hostname reported by VM: `linuxsrv01`
- OS: Ubuntu 24.04.4 LTS
- Runtime: Node.js `v20.20.2`, npm `10.8.2`
- Container runtime: Docker `29.5.2`, Docker Compose `v5.1.4`
- Application path: `/home/kmh251/deployment/chatty`
- Service: Docker Compose project `chatty` behind the unified KAI Docker Nginx edge
- Previous native service: `chatty.service` disabled after Docker switch
- Preferred public HTTPS endpoint: `https://chatty.251gh.local`
- Preferred Nginx container: `kai-nginx` on public `443`
- KAI Docker network: `kai_app_default`
- Chatty Docker alias on KAI network: `chatty`
- Container upstream for unified Nginx: `http://chatty:3000`
- Legacy host-local upstream: `127.0.0.1:13000`
- Legacy public HTTP redirect: `http://10.4.51.232:3000`
- Legacy public HTTPS endpoint: `https://10.4.51.232:3443`

## Verified Endpoints

```text
GET  http://10.4.51.232:3000/
GET  http://10.4.51.232:3000/chatbot-widget.js
GET  http://10.4.51.232:3000/api/health
GET  http://10.4.51.232:3000/api/topics
GET  http://10.4.51.232:3000/api/search
GET  http://10.4.51.232:3000/api/knowledge/audit
POST http://10.4.51.232:3000/api/chat
POST http://10.4.51.232:3000/api/termination
GET  https://10.4.51.232:3443/
GET  https://10.4.51.232:3443/chatbot-widget.js
GET  https://10.4.51.232:3443/api/health
GET  https://10.4.51.232:3443/api/topics
GET  https://10.4.51.232:3443/api/search
GET  https://10.4.51.232:3443/api/knowledge/audit
POST https://10.4.51.232:3443/api/chat
POST https://10.4.51.232:3443/api/termination
GET  https://chatty.251gh.local/
GET  https://chatty.251gh.local/chatbot-widget.js
GET  https://chatty.251gh.local/api/health
GET  https://chatty.251gh.local/api/topics
GET  https://chatty.251gh.local/api/search
GET  https://chatty.251gh.local/api/knowledge/audit
POST https://chatty.251gh.local/api/chat
POST https://chatty.251gh.local/api/termination
```

## Embed Snippet

```html
<script
  src="https://chatty.251gh.local/chatbot-widget.js"
  data-chatbot-api="https://chatty.251gh.local/api/chat"
  data-chatbot-termination="https://chatty.251gh.local/api/termination"
  data-chatbot-topics="https://chatty.251gh.local/api/topics"
  data-title="Τεχνική υποστήριξη"
  data-subtitle="Εσωτερική καθοδήγηση"
></script>
```

## Handoff Event

```html
<script>
  window.addEventListener("hospital-chatbot-termination", (event) => {
    const signal = event.detail;
    console.log(signal.signal);
    console.log(signal.summary);
    console.log(signal.handoff);
  });
</script>
```

## HTTPS

The HTTPS endpoint uses a server certificate signed by `/etc/chatty/certs/chatty-root-ca.crt`. The root CA must be trusted on workstations for the browser to open without warning and for microphone dictation to be available.

## Operations

```bash
cd /home/kmh251/deployment/chatty
docker compose -p chatty ps
docker compose -p chatty logs -f
docker compose -p chatty restart
docker compose -p chatty up -d --build
docker compose -p chatty down
sudo nginx -t
sudo systemctl reload nginx
```

Runtime settings:

```text
/etc/chatty
/var/lib/chatty
```

The current deployment allows all origins with `ALLOWED_ORIGINS=*`, so any intranet web application can call the widget/API. For tighter production control, set `ALLOWED_ORIGINS` when starting the Compose project.

Rollback to the previous native service is possible from the restore archive kept under `/home/kmh251/deployment/`, then `sudo systemctl enable --now chatty.service`.

Latest restore point before the Nginx cutover:

```text
/home/kmh251/deployment/chatty-pre-nginx-20260527-164113.tar.gz
```

## Current Nginx Summary

The preferred production edge is the KAI Docker Nginx container `kai-nginx`, which owns public `80` and `443`. Chatty is attached to the shared Docker network `kai_app_default` with alias `chatty`, so `kai-nginx` proxies the host-based route directly to `http://chatty:3000`.

The active KAI Nginx config is `/home/kmh251/deployment/kai_app/nginx.conf`:

- default `443`: routes `https://10.4.51.232/` to the Server App Monitor.
- `server_name kai-app kai-app.251gh.local`: routes KAI and Guacamole.
- `server_name chatty chatty.251gh.local chatbot chatbot.251gh.local`: routes Chatty to `http://chatty:3000`.
- default `80`: redirects to HTTPS.

The reusable Chatty server block is kept in `deploy/nginx/kai-nginx-chatty-server.conf`.

Legacy direct Chatty access is intentionally still enabled for compatibility. System Nginx routes `3000` and `3443` to the host-local upstream on `127.0.0.1:13000`.

The active Chatty Nginx site is `/etc/nginx/sites-enabled/chatty.conf`:

- `listen 3000`: redirects to `https://$host:3443$request_uri`.
- `listen 3443 ssl http2`: terminates TLS with `/etc/chatty/certs/chatty.crt` and `/etc/chatty/certs/chatty.key`.
- Proxies `/` to `http://127.0.0.1:13000`.
- Sets `X-Frame-Options SAMEORIGIN`, `X-Content-Type-Options nosniff`, and `Referrer-Policy same-origin`.
- Uses `client_max_body_size 8m` and proxy timeouts of `120s`.

The existing KAI/DNY Nginx site remains `/etc/nginx/sites-enabled/dny-portal.conf`:

- `listen 5080`: redirects to `https://$host:5443$request_uri`.
- `listen 5443 ssl http2`: terminates TLS with `/etc/ssl/dny-portal/dny-portal.crt` and `/etc/ssl/dny-portal/dny-portal.key`.
- Proxies `/` to `http://127.0.0.1:5000`.
- Sets `X-Frame-Options SAMEORIGIN`, `X-Content-Type-Options nosniff`, and `Referrer-Policy same-origin`.
- Uses `client_max_body_size 64m` and proxy timeouts of `120s`.
