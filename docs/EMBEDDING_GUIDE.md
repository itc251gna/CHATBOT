# Οδηγός Ενσωμάτωσης

Το widget μπορεί να μπει σε οποιαδήποτε εσωτερική web εφαρμογή. Η ροή του είναι καθαρά συνομιλιακή. Δεν συλλέγει στοιχεία για εξωτερική διαδικασία και δεν ανοίγει άλλη υπηρεσία από μόνο του.

## Βασική Ενσωμάτωση

Προσθέστε πριν το `</body>`:

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

Για development:

```html
<script
  src="http://localhost:3000/chatbot-widget.js"
  data-chatbot-api="http://localhost:3000/api/chat"
  data-chatbot-termination="http://localhost:3000/api/termination"
  data-chatbot-topics="http://localhost:3000/api/topics"
></script>
```

## Ρύθμιση Με JavaScript Object

```html
<script>
  window.HospitalChatbot = {
    apiUrl: "https://chatty.251gh.local/api/chat",
    terminationUrl: "https://chatty.251gh.local/api/termination",
    topicsUrl: "https://chatty.251gh.local/api/topics",
    title: "Τεχνική υποστήριξη",
    subtitle: "Εσωτερική καθοδήγηση",
    launcherLabel: "?"
  };
</script>
<script src="https://chatty.251gh.local/chatbot-widget.js"></script>
```

## Κεντρική Σελίδα Portal

Ο ίδιος server διαθέτει κεντρική σελίδα:

```text
http://10.4.51.232:3000/
https://10.4.51.232:3443/
https://chatty.251gh.local/
```

Η σελίδα δείχνει endpoints, snippet ενσωμάτωσης και βασική κατάσταση υπηρεσίας.

## Termination Signal

Όταν ο χρήστης έχει κάνει αρκετές προσπάθειες και το chatbot δεν μπορεί να συνεχίσει με χρήσιμη καθοδήγηση, το widget εμφανίζει κουμπί `Δεν λύθηκε`.

Με πάτημα του κουμπιού:

1. Το widget στέλνει την τρέχουσα συνομιλία στο `POST /api/termination`.
2. Το API επιστρέφει ουδέτερο signal, συμπυκνωμένη περίληψη και δομημένο `handoff` block.
3. Το widget εκπέμπει browser event `hospital-chatbot-termination`.
4. Η εφαρμογή που φιλοξενεί το widget αποφασίζει την επόμενη ροή.

Παράδειγμα listener:

```html
<script>
  window.addEventListener("hospital-chatbot-termination", (event) => {
    const signal = event.detail;

    if (signal.signal === "CHATBOT_HANDOFF_REQUESTED") {
      console.log(signal.summary);
      console.log(signal.handoff);
      // redirect, open modal, call another API, or continue with any host flow
    }
  });
</script>
```

Το τελευταίο signal διαβάζεται και με:

```js
window.HospitalChatbotWidget.getTerminationSignal();
```

## Context

Το widget κρατά ενεργό το πρώτο συγκεκριμένο γνωσιακό θέμα. Ασαφείς απαντήσεις όπως `δεν διορθώθηκε`, `ακόμα έχω πρόβλημα` ή `πάλι δεν δουλεύει` συνεχίζουν στο ίδιο θέμα και δεν ξαναδρομολογούνται σε γενικό IT.

Για νέο θέμα:

```text
αλλαγή θέματος: δεν ανοίγει ο εκτυπωτής
```

Εναλλακτικά, ο χρήστης μπορεί να κλείσει και να ανοίξει ξανά το widget. Το public API διαθέτει και:

```js
window.HospitalChatbotWidget.reset();
```

Παράδειγμα response:

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
    "attemptedSteps": ["Το έκανα αλλά πάλι δεν τυπώνει"],
    "unresolvedIndicators": ["δεν λύθηκε"]
  },
  "handoff": {
    "status": "needs_host_handoff",
    "topic": {
      "title": "Εκτυπωτής δεν τυπώνει",
      "domain": "it-devices",
      "source": "it-knowledge.txt"
    },
    "resolutionState": {
      "lastResponseType": "followup",
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

## Μικρόφωνο

Το κουμπί μικροφώνου χρησιμοποιεί Web Speech API όπου το υποστηρίζει ο browser, όπως Chrome ή Edge. Η υπαγόρευση γράφει το αναγνωρισμένο κείμενο απευθείας στο πεδίο εισαγωγής.

Δεν αποθηκεύεται ηχογράφηση και δεν στέλνεται audio στο API. Αν ο browser δεν υποστηρίζει Web Speech API ή δεν δοθεί άδεια μικροφώνου, το απλό πεδίο κειμένου παραμένει διαθέσιμο.

Για πραγματική χρήση σε σταθμούς εργασίας, η σελίδα πρέπει να φορτώνεται από `localhost` ή από HTTPS που ο browser εμπιστεύεται.

## CORS

Ο server πρέπει να επιτρέπει το origin της εφαρμογής που φιλοξενεί το widget:

```powershell
$env:ALLOWED_ORIGINS = "https://medico-portal.hospital.local,https://intranet.hospital.local"
```

Για δοκιμές μπορεί να χρησιμοποιηθεί `*`, αλλά σε παραγωγή προτιμάται συγκεκριμένη λίστα origins.

## CSP

Αν η host εφαρμογή έχει Content Security Policy, επιτρέψτε:

```text
script-src 'self' https://chatty.251gh.local;
connect-src 'self' https://chatty.251gh.local;
```

## Public API Του Widget

```js
window.HospitalChatbotWidget.open();
window.HospitalChatbotWidget.close();
window.HospitalChatbotWidget.send("ο εκτυπωτής δεν τυπώνει");
window.HospitalChatbotWidget.requestTermination();
window.HospitalChatbotWidget.getTerminationSignal();
window.HospitalChatbotWidget.isListening();
```

## Cache Busting

Ο server στέλνει `Cache-Control: no-store` στα static αρχεία. Αν η host εφαρμογή έχει δικό της cache, μπορείτε να βάλετε version query:

```html
<script src="https://chatty.251gh.local/chatbot-widget.js?v=2026-05-19"></script>
```
