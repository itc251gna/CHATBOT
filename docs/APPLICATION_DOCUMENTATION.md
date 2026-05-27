# Πλήρης Τεκμηρίωση Εφαρμογής

## Σκοπός

Το Hospital Intranet Chatbot είναι self-hosted deterministic chatbot για εσωτερικές εφαρμογές νοσοκομείου. Δίνει ασφαλείς οδηγίες πρώτου επιπέδου σε απλούς χρήστες, χωρίς cloud AI, χωρίς εξωτερικά APIs και χωρίς αποθήκευση ιστορικού συνομιλιών.

Η τρέχουσα αρχιτεκτονική είναι:

- καθαρή συνομιλία μέσω `/api/chat`,
- γνωσιακή βάση από `.txt` αρχεία,
- συνέχεια συνομιλίας με `conversationState`,
- κλείδωμα στο ενεργό γνωσιακό θέμα μέχρι ρητή αλλαγή,
- γενικά conversation controls για τέλος, ακύρωση και reset συνομιλίας,
- ουδέτερο `/api/termination` για handoff όταν η συνομιλία δεν μπορεί να βοηθήσει άλλο.
- τοπικό αποπροσωποποιημένο learning log για ελεγχόμενη βελτίωση,
- έξυπνη αναζήτηση portal μέσω `/api/search`,
- read-only έλεγχο γνωσιακής βάσης μέσω `/api/knowledge/audit`.

Δεν υπάρχει ενσωματωμένη ροή δημιουργίας εξωτερικού αιτήματος. Το chatbot δεν συλλέγει δομημένα πεδία για τέτοια ροή. Η host εφαρμογή λαμβάνει μόνο termination signal και περίληψη, και αποφασίζει μόνη της την επόμενη ενέργεια.

## Gmail IT Knowledge Import

Υπάρχει ξεχωριστό local-only εργαλείο για παραγωγή γνώσης από το Gmail του τμήματος IT:

```powershell
npm run gmail:import -- --limit 1000
```

Το εργαλείο διαβάζει τα email τοπικά στον υπολογιστή που τρέχει την εντολή, δεν γράφει raw email περιεχόμενο και δεν αποθηκεύει δείγματα μηνυμάτων. Απορρίπτει οικονομικά και admin-only θέματα, κάνει redaction σε IP, email, τηλέφωνα, μεγάλα αναγνωριστικά, URL και πιθανά μυστικά, και γράφει μόνο ασφαλείς user-facing κατηγορίες στο `knowledge/it-gmail-knowledge.txt`.

Το aggregate report γράφεται στο:

```text
dist/gmail-it/gmail-import-report.json
```

Για Gmail IMAP απαιτείται ενεργό IMAP και Gmail app password. Αν δεν επιτρέπεται IMAP, χρησιμοποιείται export από Google Takeout:

```powershell
npm run gmail:import -- --takeout-zip C:\path\to\takeout.zip
```

ή απευθείας `.mbox`:

```powershell
npm run gmail:import -- --mbox C:\path\to\All-mail-Including-Spam-and-Trash.mbox
```

## Project Structure

```text
CHATTY/
  server.js
  package.json
  README.md
  AGENTS.MD
  src/
    chat-engine.js
    knowledge-base.js
    knowledge-audit.js
    termination-service.js
    text-normalizer.js
  public/
    index.html
    chatbot-widget.js
  knowledge/
    it-knowledge.txt
    it-gmail-knowledge.txt
    facilities-issues.txt
  test/
    chat-engine.test.js
    knowledge-base.test.js
    knowledge-content.test.js
    termination-service.test.js
  docs/
    APPLICATION_DOCUMENTATION.md
    PRODUCTION_INSTALLATION.md
    EMBEDDING_GUIDE.md
    FUTURE_IMPROVEMENTS.md
    DEPLOYMENT_STATUS.md
```

## Runtime Flow

1. Η host εφαρμογή φορτώνει `public/chatbot-widget.js`.
2. Το widget ανοίγει συνομιλία σε Shadow DOM.
3. Ο χρήστης γράφει ή υπαγορεύει κείμενο.
4. Το widget καλεί `POST /api/chat` με `message`, `interactionCount` και προαιρετικό `conversationState`.
5. Το `chat-engine` βρίσκει την καλύτερη εγγραφή γνώσης ή ζητά διευκρίνιση.
6. Το widget κρατά το ενεργό θέμα μόνο στη μνήμη της τρέχουσας σελίδας.
7. Όσο υπάρχει ενεργό θέμα, ασαφείς απαντήσεις όπως `δεν διορθώθηκε` ή `ακόμα έχω πρόβλημα` μένουν στο ίδιο θέμα.
8. Γενικές φράσεις όπως `τέλος συνομιλίας`, `άκυρο`, `ξεκίνα από την αρχή`, `reset`, `bye` εκτελούνται ως conversation controls πριν γίνει matching στη γνώση.
9. Το θέμα αλλάζει μόνο αν ο χρήστης γράψει ρητά `αλλαγή θέματος: ...` ή αν κλείσει και ανοίξει ξανά το widget.
10. Αν υπάρχουν αρκετές προσπάθειες χωρίς λύση, εμφανίζεται κουμπί `Δεν λύθηκε`.
11. Το κουμπί καλεί `POST /api/termination` και εκπέμπει `hospital-chatbot-termination`.

## API Endpoints

### `GET /api/health`

Health check.

```json
{ "ok": true }
```

### `GET /api/topics`

Επιστρέφει προτεινόμενα θέματα από τη γνωσιακή βάση.

### `GET /api/search`

Read-only αναζήτηση για το Portal. Συνδυάζει keyword scoring με τοπικό semantic fallback χωρίς cloud κλήσεις.

```text
/api/search?q=δεν%20ανοίγει%20το%20PACS&limit=5
```

Επιστρέφει αποτελέσματα με:

- `confidence`,
- `matchType` (`lexical`, `semantic`, `hybrid`),
- `matchedKeywords`,
- `answerPreview`,
- `actionsPreview`,
- `requiresDisambiguation` όταν τα πρώτα αποτελέσματα είναι κοντά.

### `GET /api/knowledge/audit`

Read-only audit της γνωσιακής βάσης. Επιστρέφει score, totals και issues για:

- διπλά keywords,
- πολύ γενικά high-priority keywords,
- κοντινά/επικαλυπτόμενα entries,
- missing owner ή last reviewed,
- entries με `admin only` ή `user safe: no`.

### `POST /api/chat`

Request:

```json
{
  "message": "δεν ανοίγει η εφαρμογή ασθενών",
  "interactionCount": 1,
  "conversationState": null
}
```

Response types:

- `help`: γενική βοήθεια και προτεινόμενα θέματα.
- `match`: βρέθηκε σχετική εγγραφή.
- `followup`: συνέχεια πάνω στο ενεργό θέμα ή βήμα.
- `control`: γενικός έλεγχος συνομιλίας, π.χ. τέλος, ακύρωση ή reset.
- `clarification`: χρειάζεται διευκρίνιση, π.χ. για ΦΙΛΙΠΠΟΣ/MIS/Internet.
- `fallback`: δεν βρέθηκε αρκετά αξιόπιστη οδηγία.

Το `/api/chat` επιστρέφει μόνο απαντήσεις γνωσιακής βάσης. Δεν επιστρέφει handoff signal.

### `POST /api/termination`

Χρησιμοποιείται όταν το widget χρειάζεται να παραδώσει τη ροή στη host εφαρμογή.

Request:

```json
{
  "reason": "unable_to_resolve_after_attempts",
  "lastResponseType": "followup",
  "conversationState": {
    "activeEntryId": "it-knowledge-123",
    "activeTitle": "Εκτυπωτής δεν τυπώνει",
    "actionCount": 4,
    "lastStep": 2
  },
  "messages": [
    { "role": "user", "text": "Δεν δουλεύει ο εκτυπωτής" },
    { "role": "bot", "title": "Εκτυπωτής δεν τυπώνει", "text": "Ελέγξτε χαρτί και toner" },
    { "role": "user", "text": "Το έκανα αλλά πάλι δεν τυπώνει" }
  ]
}
```

Response:

```json
{
  "type": "termination",
  "schemaVersion": "2.0",
  "signal": "CHATBOT_HANDOFF_REQUESTED",
  "reason": "unable_to_resolve_after_attempts",
  "summary": {
    "title": "Εκτυπωτής δεν τυπώνει",
    "problem": "Αρχικό πρόβλημα: Δεν δουλεύει ο εκτυπωτής. Τελευταία ενημέρωση χρήστη: Το έκανα αλλά πάλι δεν τυπώνει.",
    "lastKnownTopic": "Εκτυπωτής δεν τυπώνει",
    "lastUserMessage": "Το έκανα αλλά πάλι δεν τυπώνει",
    "userMessages": ["Δεν δουλεύει ο εκτυπωτής", "Το έκανα αλλά πάλι δεν τυπώνει"],
    "botTopics": ["Εκτυπωτής δεν τυπώνει"],
    "attemptedSteps": ["Το έκανα αλλά πάλι δεν τυπώνει"],
    "unresolvedIndicators": ["δεν λύθηκε"],
    "messageCount": 3
  },
  "context": {
    "conversationState": {
      "activeEntryId": "it-knowledge-123",
      "activeTitle": "Εκτυπωτής δεν τυπώνει",
      "actionCount": 4,
      "lastStep": 2
    },
    "lastResponseType": "followup"
  },
  "handoff": {
    "status": "needs_host_handoff",
    "topic": {
      "id": "it-knowledge-123",
      "title": "Εκτυπωτής δεν τυπώνει",
      "source": "it-knowledge.txt",
      "domain": "it-devices"
    },
    "resolutionState": {
      "lastResponseType": "followup",
      "lastStep": 2,
      "unresolvedIndicators": ["δεν λύθηκε"]
    },
    "routingHints": {
      "preferredNextStep": "host_application_route",
      "suggestedQueue": "it-support"
    }
  },
  "recommendedAction": "host-application-decide-next-step"
}
```

## Widget Contract

Το widget δέχεται ρυθμίσεις είτε με `data-*` attributes είτε με `window.HospitalChatbot`.

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

Browser events:

- `hospital-chatbot-ready`: το widget φορτώθηκε.
- `hospital-chatbot-termination`: ο χρήστης πάτησε `Δεν λύθηκε` και υπάρχει signal.

Public methods:

```js
window.HospitalChatbotWidget.open();
window.HospitalChatbotWidget.close();
window.HospitalChatbotWidget.send("δεν ανοίγει το Medico");
window.HospitalChatbotWidget.requestTermination();
window.HospitalChatbotWidget.getTerminationSignal();
window.HospitalChatbotWidget.isListening();
```

## Knowledge Base

Τα αρχεία γνώσης είναι plain text και χωρίζονται με `---`.

```text
# Τίτλος
keywords: λέξη, φράση, συνώνυμο
priority: 5
owner: IT
domain: it-devices
category: printing
risk level: normal
last reviewed: 2026-05-22
user safe: yes
admin only: no
examples: ο εκτυπωτής δεν τυπώνει
negative examples: εγκατάσταση driver εκτυπωτή
actions:
- Ασφαλής ενέργεια χρήστη.
followups:
- step=1 | keywords=τι μπορεί να πει ο χρήστης | answer=Συνέχεια για το βήμα. | actions=Προαιρετικές ενέργειες
answer:
Σύντομη απάντηση για απλό χρήστη.
---
```

Βασικοί κανόνες:

- απαντήσεις μόνο για απλό χρήστη,
- όχι admin credentials, server IPs, SQL, registry, services ή backend διαδικασίες,
- όχι προσωπικά δεδομένα ασθενών,
- ειδικά keywords για ειδικά συστήματα,
- γενικά keywords σε χαμηλό priority,
- χρήση `followups:` για συχνά σημεία όπου ο χρήστης μπορεί να κολλήσει.
- χρήση `examples` και `negative examples` για ασφαλέστερο search tuning και audit.

## Knowledge Audit

```powershell
npm run kb:analyze
```

Το εργαλείο γράφει:

```text
dist/kb-analysis/knowledge-audit.json
dist/kb-analysis/knowledge-audit.md
```

Δεν τροποποιεί αρχεία γνώσης. Τα ευρήματα πρέπει να ελέγχονται από άνθρωπο πριν αλλάξουν keywords, priorities ή περιεχόμενο.

## Local Terminology

- `εφαρμογή ασθενών` σημαίνει `Medico`.
- `απεικονιστικό σύστημα` σημαίνει `AGFA RIS/PACS`.
- `ΦΙΛΙΠΠΟΣ` είναι το εσωτερικό δίκτυο νοσοκομείου.
- `MIS` είναι διαβαθμισμένο δίκτυο αεροπορίας.
- `Internet` είναι πρόσβαση σε εξωτερικές ιστοσελίδες ή web υπηρεσίες.
- Σκέτο `δίκτυο` θεωρείται ασαφές και προκαλεί ερώτηση διευκρίνισης.

## Conversation Follow-Ups

Το `conversationState` κρατά ενεργό θέμα, πλήθος ενεργειών και τελευταίο βήμα. Αν ο χρήστης γράψει `κόλλησα στο βήμα 2`, το engine προσπαθεί να απαντήσει πάνω στο ίδιο θέμα.

Αν υπάρχει explicit `followups:` εγγραφή για το βήμα, χρησιμοποιείται. Αν όχι, δημιουργείται ασφαλής γενική απάντηση που ζητά ακριβές μήνυμα ή περιγραφή οθόνης.

Το ενεργό θέμα είναι κλειδωμένο. Αν ο χρήστης γράψει ασαφείς συνέχειες όπως `δεν διορθώθηκε`, `ακόμα έχω πρόβλημα`, `πάλι δεν δουλεύει`, το chatbot δεν κάνει νέο γενικό matching αλλά συνεχίζει από το ίδιο γνωσιακό θέμα. Για αλλαγή θέματος υπάρχουν δύο τρόποι:

- να κλείσει και να ανοίξει ξανά το widget,
- να γράψει `αλλαγή θέματος:` και μετά το νέο πρόβλημα.

## Learning Log

Όταν `CHAT_LEARNING_LOG_ENABLED=true`, ο server γράφει τοπικά learning events σε JSONL αρχείο. Στην παραγωγική εγκατάσταση το default path είναι:

```text
/var/lib/chatty/learning-events.jsonl
```

Καταγράφονται:

- chat exchanges,
- τύπος απάντησης,
- τίτλος/context,
- termination signals.

Πριν τη γραφή γίνεται βασική αποπροσωποποίηση για ΑΜΚΑ, IP, email, τηλέφωνα και μυστικά. Το log δεν ενημερώνει αυτόματα το knowledgebase. Χρησιμοποιείται για περιοδική αξιολόγηση από υπεύθυνο IT/γνώσης, ώστε οι αλλαγές να μπαίνουν ελεγχόμενα.

Για report βελτίωσης:

```bash
npm run learning:report -- /var/lib/chatty/learning-events.jsonl
```

Το report δείχνει συχνά θέματα, unresolved topics, χαμηλής ακρίβειας ερωτήσεις, review queue και προτεινόμενα regression candidates που χρειάζονται αξιολόγηση πριν μετατραπούν σε νέα ή διορθωμένη γνώση.

## Microphone

Το μικρόφωνο βασίζεται στο browser Web Speech API. Η υπαγόρευση γράφει κείμενο στο input. Δεν αποθηκεύεται audio και δεν στέλνεται ηχογράφηση στο server.

Για να δουλέψει σε browser απαιτείται:

- `localhost`, ή
- HTTPS που ο browser θεωρεί αξιόπιστο.

Firefox δεν υποστηρίζει Web Speech API για αυτή τη χρήση, οπότε ο χρήστης πληκτρολογεί κανονικά.

## Security

- Δεν υπάρχει cloud integration.
- Δεν αποθηκεύεται ιστορικό συνομιλιών.
- Το termination summary δημιουργείται μόνο όταν ζητηθεί handoff.
- Το API πρέπει να προστατεύεται με δίκτυο, reverse proxy, CORS και HTTPS ανάλογα με την εγκατάσταση.
- Τα knowledge files πρέπει να περνούν έλεγχο πριν μπουν σε παραγωγή.

## Testing

```powershell
npm test
```

Τα tests καλύπτουν parser, matching, follow-ups, διευκρίνιση δικτύων, routing γνώσης, smart portal search, knowledge audit και termination service.
