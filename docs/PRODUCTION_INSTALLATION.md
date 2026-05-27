# Οδηγός παραγωγικής εγκατάστασης

## Γρήγορο deploy σε Linux VM

Από Windows workstation με SSH πρόσβαση στο VM:

```powershell
.\deploy\deploy-to-linux.ps1 `
  -HostName linux-srv-01 `
  -User <ssh-user> `
  -AppDir "/home/kmh251/deployment/chatty" `
  -Port 3000 `
  -AllowedOrigins "*"
```

Το script πακετάρει την εφαρμογή, την αντιγράφει στο VM, εκτελεί το `deploy/linux/install-chatty.sh` με `sudo`, δημιουργεί `systemd` service `chatty.service`, ρυθμίζει `/etc/chatty/chatty.env` και κάνει health check στο τέλος.

Η τρέχουσα παραγωγική εγκατάσταση λειτουργεί με Docker Compose πίσω από Nginx. Το native `chatty.service` είναι χρήσιμο σαν rollback, ενώ το Compose project `chatty` εκθέτει μόνο local upstream στο `127.0.0.1:13000`. Τα δημόσια `3000` και `3443` τα κρατά το Nginx.

```bash
cd /home/kmh251/deployment/chatty
docker compose -p chatty up -d --build
docker compose -p chatty ps
sudo nginx -t
sudo systemctl reload nginx
curl -k https://127.0.0.1:3443/api/health
```

Για δοκιμή χωρίς σύγκρουση με τα production ports:

```bash
cd /home/kmh251/deployment/chatty
CHATTY_UPSTREAM_PORT=13080 docker compose -p chatty_test up -d --build
curl -fsS http://127.0.0.1:13080/api/health
docker compose -p chatty_test down
```

Persistent paths στο Docker:

- `/var/lib/chatty` γίνεται read-write mount για το learning log.
- Το knowledge base περιλαμβάνεται στο image και απαιτεί rebuild για αλλαγές.
- Τα TLS certificates τα διαβάζει το Nginx από `/etc/chatty/certs`, όχι το container.

Αν το `3000` χρησιμοποιείται ήδη στο VM, αλλάξτε μόνο την παράμετρο `-Port`:

```powershell
.\deploy\deploy-to-linux.ps1 `
  -HostName linux-srv-01 `
  -User <ssh-user> `
  -AppDir "/home/kmh251/deployment/chatty" `
  -Port 3010 `
  -AllowedOrigins "*"
```

Αν το hostname δεν λύνεται από DNS, χρησιμοποιήστε IP ή FQDN:

```powershell
.\deploy\deploy-to-linux.ps1 -HostName 10.x.x.x -User <ssh-user> -AppDir "/home/kmh251/deployment/chatty" -AllowedOrigins "*"
```

## Στόχος εγκατάστασης

Να στηθεί ένας εσωτερικός chatbot server στο ιδιωτικό δίκτυο του νοσοκομείου, διαθέσιμος από εσωτερικές web εφαρμογές μέσω script widget.

Προτεινόμενο production URL:

```text
https://chatty.251gh.local
```

ή, αν δεν υπάρχει ακόμη εσωτερικό TLS:

```text
http://intranet-chatbot.local:3000
```

Για παραγωγή προτιμάται HTTPS.

## Προαπαιτούμενα

- Windows Server ή Linux server μέσα στο ιδιωτικό δίκτυο.
- Node.js `>= 20`.
- Σταθερό hostname ή DNS alias.
- Firewall rule ώστε οι εσωτερικές εφαρμογές να βλέπουν τον chatbot server.
- Λογαριασμός υπηρεσίας με δικαίωμα ανάγνωσης στον φάκελο εφαρμογής και γνώσης.
- Προαιρετικά reverse proxy: IIS, Nginx ή Apache.

## Βήμα 1: Αντιγραφή εφαρμογής

Αντιγράψτε τον φάκελο project σε σταθερό path, π.χ.:

```text
C:\Services\hospital-intranet-chatbot
```

Περιεχόμενα που πρέπει να υπάρχουν:

```text
server.js
package.json
src\
public\
knowledge\
docs\
README.md
AGENTS.md
```

## Βήμα 2: Έλεγχος Node.js

```powershell
node --version
npm --version
```

Η εφαρμογή δεν χρειάζεται `npm install`, γιατί δεν έχει npm dependencies. Αν μελλοντικά προστεθούν dependencies, τότε:

```powershell
npm ci --omit=dev
```

## Βήμα 3: Ρυθμίσεις περιβάλλοντος

Ελάχιστες μεταβλητές:

```powershell
$env:PORT = "3000"
$env:KNOWLEDGE_DIR = "C:\Services\hospital-intranet-chatbot\knowledge"
$env:ALLOWED_ORIGINS = "https://intranet-app1.hospital.local,https://intranet-app2.hospital.local"
$env:KNOWLEDGE_CACHE_MS = "2000"
$env:HTTPS_PORT = "3443"
$env:HTTPS_CERT_PATH = "C:\Services\hospital-intranet-chatbot\certs\chatty.crt"
$env:HTTPS_KEY_PATH = "C:\Services\hospital-intranet-chatbot\certs\chatty.key"
```

Το port μπορεί επίσης να δοθεί προσωρινά από command line:

```powershell
npm start -- --port 3010
```

Αν το port είναι δεσμευμένο, ο server τερματίζει με καθαρό μήνυμα και προτείνει επόμενο διαθέσιμο υποψήφιο port.

Για δοκιμή μόνο:

```powershell
$env:ALLOWED_ORIGINS = "*"
```

Σε παραγωγή μη χρησιμοποιείτε `*` αν το widget θα καλείται από συγκεκριμένες εφαρμογές.

## Βήμα 4: Πρώτη εκκίνηση

```powershell
cd C:\Services\hospital-intranet-chatbot
npm start
```

Έλεγχος:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Αναμένεται:

```json
{ "ok": true }
```

## Βήμα 5: Έλεγχος API

```powershell
$body = @{ message = "δεν ανοίγει η εφαρμογή ασθενών"; interactionCount = 1 } | ConvertTo-Json
Invoke-RestMethod `
  -Uri http://localhost:3000/api/chat `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Περιμένετε τίτλο:

```text
Medico / εφαρμογή ασθενών δεν ανοίγει
```

## Βήμα 6: Εκτέλεση ως υπηρεσία σε Windows

Υπάρχουν δύο πρακτικές επιλογές.

### Επιλογή Α: Task Scheduler

1. Ανοίξτε Task Scheduler.
2. Create Task.
3. User: service account.
4. Trigger: At startup.
5. Action:

```text
Program/script: C:\Program Files\nodejs\node.exe
Arguments: server.js
Start in: C:\Services\hospital-intranet-chatbot
```

6. Στο περιβάλλον του service account ορίστε μόνιμες μεταβλητές:

```powershell
[Environment]::SetEnvironmentVariable("PORT", "3000", "Machine")
[Environment]::SetEnvironmentVariable("KNOWLEDGE_DIR", "C:\Services\hospital-intranet-chatbot\knowledge", "Machine")
[Environment]::SetEnvironmentVariable("ALLOWED_ORIGINS", "https://intranet-app1.hospital.local", "Machine")
[Environment]::SetEnvironmentVariable("KNOWLEDGE_CACHE_MS", "2000", "Machine")
```

7. Κάντε reboot ή start task.

### Επιλογή Β: NSSM

Αν επιτρέπεται εγκατάσταση NSSM:

```powershell
nssm install HospitalIntranetChatbot
```

Ρυθμίσεις:

```text
Path: C:\Program Files\nodejs\node.exe
Startup directory: C:\Services\hospital-intranet-chatbot
Arguments: server.js
```

Στην καρτέλα Environment προσθέστε:

```text
PORT=3000
KNOWLEDGE_DIR=C:\Services\hospital-intranet-chatbot\knowledge
ALLOWED_ORIGINS=https://intranet-app1.hospital.local,https://intranet-app2.hospital.local
KNOWLEDGE_CACHE_MS=2000
```

Εκκίνηση:

```powershell
nssm start HospitalIntranetChatbot
```

## Βήμα 7: Reverse proxy και HTTPS

Προτείνεται να μπει reverse proxy μπροστά από το Node app:

```text
https://chatty.251gh.local -> http://chatty:3000 through kai-nginx
```

Πλεονεκτήματα:

- TLS certificate,
- central logging,
- firewall isolation,
- πιο καθαρό URL για embedding,
- δυνατότητα authentication/rate limiting στο μέλλον.

Σε IIS χρειάζονται συνήθως:

- IIS ARR,
- URL Rewrite,
- εσωτερικό certificate,
- rule που προωθεί όλα τα paths στο `http://127.0.0.1:3000`.

Εναλλακτικά, ο ίδιος Node server μπορεί να σηκώσει δεύτερο HTTPS listener αν οριστούν `HTTPS_PORT`, `HTTPS_CERT_PATH` και `HTTPS_KEY_PATH`. Αυτό είναι χρήσιμο όταν χρειάζεται άμεσα secure origin για λειτουργίες browser όπως μικρόφωνο:

```powershell
$env:HTTPS_PORT = "3443"
$env:HTTPS_CERT_PATH = "C:\Services\hospital-intranet-chatbot\certs\chatty.crt"
$env:HTTPS_KEY_PATH = "C:\Services\hospital-intranet-chatbot\certs\chatty.key"
npm start
```

Το certificate πρέπει να είναι αξιόπιστο για τους σταθμούς εργασίας. Ο Linux installer, όταν δεν δοθούν δικά σας `HTTPS_CERT_PATH` και `HTTPS_KEY_PATH`, δημιουργεί τοπικό root CA στο `CERT_DIR` και server certificate για το `PUBLIC_HOST`. Για δοκιμή μπορεί να εγκατασταθεί το `chatty-root-ca.crt` στα trusted roots των σταθμών. Για κανονική παραγωγή προτιμήστε certificate από την εσωτερική CA του νοσοκομείου.

## Βήμα 8: Firewall

Αν δεν υπάρχει reverse proxy:

```powershell
New-NetFirewallRule `
  -DisplayName "Hospital Intranet Chatbot" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 3000 `
  -Action Allow
```

Αν υπάρχει reverse proxy, ανοίξτε μόνο `443` προς το proxy και κρατήστε το Node port τοπικό.

## Βήμα 9: Ενημέρωση γνώσης στην παραγωγή

1. Κάντε backup του φακέλου `knowledge`.
2. Επεξεργαστείτε `it-knowledge.txt` ή `facilities-issues.txt`.
3. Τρέξτε tests σε staging ή τοπικά:

```powershell
npm test
```

4. Αν το production server έχει `KNOWLEDGE_CACHE_MS=2000`, η νέα γνώση φορτώνει αυτόματα μετά από περίπου 2 δευτερόλεπτα.
5. Για αλλαγές σε κώδικα, κάντε restart υπηρεσίας.

## Βήμα 10: Monitoring

Προτεινόμενος health check:

```text
GET /api/health
```

Ελέγξτε:

- αν απαντά `ok: true`,
- αν ο server process τρέχει,
- αν το reverse proxy δίνει 200,
- αν οι εφαρμογές που φιλοξενούν το widget δεν έχουν CORS errors.

## Rollback

Για rollback γνώσης:

1. Επαναφέρετε προηγούμενο `knowledge` backup.
2. Περιμένετε το cache TTL ή κάντε restart.

Για rollback εφαρμογής:

1. Κρατήστε versioned φάκελο, π.χ.:

```text
C:\Services\hospital-intranet-chatbot-v1
C:\Services\hospital-intranet-chatbot-v2
```

2. Αλλάξτε το service path ή reverse proxy target.
3. Κάντε restart υπηρεσίας.

## Production checklist

- [ ] Node.js `>=20`.
- [ ] Dedicated service account.
- [ ] `ALLOWED_ORIGINS` περιορισμένο.
- [ ] HTTPS ή ελεγχόμενο εσωτερικό HTTP.
- [ ] Firewall περιορισμένο.
- [ ] `GET /api/health` σε monitoring.
- [ ] Backup για `knowledge`.
- [ ] Tests πριν από αλλαγή γνώσης.
- [ ] Καμία γνώση με προσωπικά δεδομένα ασθενών.
- [ ] Καμία γνώση με admin credentials, server commands ή elevated procedures.
