from __future__ import annotations

import argparse
import collections
import datetime as dt
import email
import getpass
import html
import imaplib
import json
import mailbox
import os
import re
import ssl
import sys
import unicodedata
import zipfile
from email.header import decode_header
from html.parser import HTMLParser
from pathlib import Path
from typing import BinaryIO, Iterable


DEFAULT_OUTPUT = Path("knowledge/it-gmail-knowledge.txt")
DEFAULT_REPORT = Path("dist/gmail-it/gmail-import-report.json")


FINANCIAL_TERMS = [
    "τιμολογιο",
    "τιμολογηση",
    "πληρωμη",
    "πληρωμές",
    "iban",
    "τραπεζ",
    "λογαριασμοσ τραπεζ",
    "πιστωτικ",
    "χρεωστικ",
    "οικονομικ",
    "δαπανη",
    "προμηθεια",
    "invoice",
    "payment",
    "bank",
]

ADMIN_TERMS = [
    "domain controller",
    "active directory",
    "group policy",
    "gpo",
    "firewall rule",
    "router config",
    "switch config",
    "vlan",
    "nat",
    "sql",
    "database restore",
    "backup job",
    "registry",
    "powershell",
    "sudo",
    "root password",
    "administrator password",
    "service account",
    "credential",
    "credentials",
    "κωδικοι admin",
    "διαχειριστησ",
]


CATEGORIES = [
    {
        "id": "gmail-mailbox-send-receive",
        "title": "Υπηρεσιακό email δεν στέλνει ή δεν λαμβάνει μηνύματα",
        "keywords": [
            "gmail",
            "haf mail",
            "υπηρεσιακό email",
            "υπηρεσιακο email",
            "outlook",
            "δεν στέλνει email",
            "δεν στελνει email",
            "δεν λαμβάνει email",
            "δεν λαμβανει email",
            "mailbox",
        ],
        "priority": 3,
        "patterns": ["gmail", "outlook", "mail", "email", "μηνυμα", "αλληλογραφ"],
        "answer": (
            "Για πρόβλημα υπηρεσιακού email, ξεχωρίζουμε αν δεν ανοίγει ο λογαριασμός, "
            "αν δεν στέλνονται μηνύματα ή αν δεν λαμβάνονται νέα email. Ο χρήστης δεν πρέπει "
            "να κοινοποιεί κωδικούς ή περιεχόμενο μηνυμάτων στο chatbot."
        ),
        "actions": [
            "Ελέγξτε αν ανοίγει το email από browser και αν υπάρχει σύνδεση στο Internet ή στο κατάλληλο δίκτυο.",
            "Δοκιμάστε αποστολή απλού δοκιμαστικού μηνύματος χωρίς συνημμένα.",
            "Αν υπάρχει μήνυμα σφάλματος, κρατήστε μόνο τον κωδικό ή την ακριβή διατύπωση, χωρίς περιεχόμενο αλληλογραφίας.",
        ],
        "followups": [
            "step=1 | keywords=browser, outlook, δεν ανοίγει | answer=Αν το email ανοίγει από browser αλλά όχι από Outlook, το πρόβλημα αφορά πιθανότατα την εφαρμογή ή το προφίλ Outlook. | actions=Δοκιμάστε browser, Κλείστε και ανοίξτε το Outlook, Κρατήστε το μήνυμα σφάλματος",
            "step=2 | keywords=συνημμένο, attachment, μεγάλο | answer=Αν αποτυγχάνει μόνο με συνημμένο, δοκιμάστε μικρότερο αρχείο ή συμπίεση σύμφωνα με την πολιτική του νοσοκομείου. | actions=Μη στέλνετε ευαίσθητα αρχεία χωρίς έγκριση, Δοκιμάστε μικρό συνημμένο, Αναφέρετε μέγεθος αρχείου",
        ],
    },
    {
        "id": "gmail-phishing-suspicious",
        "title": "Ύποπτο email ή πιθανό phishing",
        "keywords": [
            "ύποπτο email",
            "υποπτο email",
            "phishing",
            "spam",
            "ύποπτο μήνυμα",
            "υποπτο μηνυμα",
            "κακόβουλο email",
            "κακοβουλο email",
            "περίεργο link",
            "περιεργο link",
        ],
        "priority": 5,
        "patterns": ["phishing", "spam", "υποπτο", "κακοβουλ", "περιεργο link", "link", "συνδεσμο"],
        "answer": (
            "Σε ύποπτο email ο χρήστης δεν ανοίγει συνδέσμους ή συνημμένα και δεν απαντά με προσωπικά "
            "ή υπηρεσιακά στοιχεία. Η αξιολόγηση γίνεται από το IT ή την αρμόδια υπηρεσία ασφάλειας."
        ),
        "actions": [
            "Μην πατήσετε link και μην ανοίξετε συνημμένο.",
            "Μην απαντήσετε στο μήνυμα και μη δώσετε κωδικούς ή στοιχεία λογαριασμού.",
            "Κρατήστε αποστολέα, ώρα και θέμα χωρίς να αντιγράφετε ευαίσθητο περιεχόμενο.",
        ],
        "followups": [
            "step=1 | keywords=πάτησα, ανοιξα, link | answer=Αν πατήσατε ήδη σύνδεσμο ή ανοίξατε συνημμένο, σταματήστε την ενέργεια και ενημερώστε άμεσα το IT. | actions=Μην πληκτρολογήσετε κωδικό, Κλείστε τη σελίδα, Ενημερώστε άμεσα το IT",
        ],
    },
    {
        "id": "gmail-medico-cases",
        "title": "Medico: συχνά περιστατικά από αλληλογραφία IT",
        "keywords": [
            "medico",
            "εφαρμογή ασθενών",
            "εφαρμογη ασθενων",
            "παραγγελία medico",
            "παραγγελια medico",
            "εξέταση medico",
            "εξεταση medico",
            "βιοψία medico",
            "βιοψια medico",
        ],
        "priority": 3,
        "patterns": ["medico", "ασθεν", "παραγγελι", "εξεταση", "βιοψ"],
        "answer": (
            "Στα περιστατικά Medico ο χρήστης δίνει μόνο λειτουργική περιγραφή και ασφαλή στοιχεία "
            "όπως εφαρμογή, τμήμα, ώρα και μήνυμα σφάλματος. Δεν καταχωρεί διπλές παραγγελίες και "
            "δεν στέλνει στοιχεία ασθενή στο chatbot."
        ),
        "actions": [
            "Περιγράψτε αν το θέμα αφορά σύνδεση, εμφάνιση ασθενή, παραγγελία, εξέταση ή εκτύπωση.",
            "Κρατήστε το ακριβές μήνυμα σφάλματος και την ώρα εμφάνισης.",
            "Μη στέλνετε ονοματεπώνυμο, ΑΜΚΑ ή κλινικά δεδομένα ασθενή στο chatbot.",
        ],
        "followups": [
            "step=1 | keywords=παραγγελία, εξέταση, βιοψία, χρέωση | answer=Αν αφορά παραγγελία, εξέταση, βιοψία ή χρέωση, μη δημιουργήσετε δεύτερη εγγραφή χωρίς οδηγία αρμόδιου χρήστη. | actions=Κρατήστε τύπο ενέργειας, Κρατήστε μήνυμα σφάλματος, Ζητήστε αρμόδιο έλεγχο",
        ],
    },
    {
        "id": "gmail-rispacs-imaging",
        "title": "AGFA RIS/PACS: συχνά περιστατικά από αλληλογραφία IT",
        "keywords": [
            "agfa",
            "ris",
            "pacs",
            "απεικονιστικό",
            "απεικονιστικο",
            "ακτινολογικό",
            "ακτινολογικο",
            "εικόνες εξέτασης",
            "εικονες εξετασης",
        ],
        "priority": 3,
        "patterns": ["agfa", "ris", "pacs", "απεικον", "ακτινολογ", "dicom"],
        "answer": (
            "Για θέμα AGFA RIS/PACS ο χρήστης ξεχωρίζει αν δεν ανοίγει η εφαρμογή, αν δεν εμφανίζεται "
            "εξέταση ή αν υπάρχει θέμα προβολής/εγγραφής εικόνων. Δεν αποστέλλονται εικόνες ή στοιχεία ασθενών στο chatbot."
        ),
        "actions": [
            "Ελέγξτε αν ανοίγει η εφαρμογή και αν επηρεάζεται ένας σταθμός ή περισσότεροι.",
            "Κρατήστε μόνο ασφαλή στοιχεία: τμήμα, ώρα, τύπο ενέργειας και μήνυμα σφάλματος.",
            "Μην επισυνάπτετε εικόνες εξέτασης ή προσωπικά στοιχεία ασθενών.",
        ],
        "followups": [],
    },
    {
        "id": "gmail-access-rights",
        "title": "Αίτημα πρόσβασης ή δικαιωμάτων σε εφαρμογή",
        "keywords": [
            "δικαίωμα πρόσβασης",
            "δικαιωμα προσβασης",
            "δεν έχω πρόσβαση",
            "δεν εχω προσβαση",
            "access denied",
            "άδεια χρήστη",
            "αδεια χρηστη",
            "ρόλος χρήστη",
            "ρολος χρηστη",
        ],
        "priority": 4,
        "patterns": ["προσβαση", "δικαιωμα", "access denied", "permission", "role", "ρολο", "αδεια"],
        "answer": (
            "Όταν λείπει πρόσβαση ή δικαίωμα σε εφαρμογή, ο χρήστης δεν επιχειρεί παράκαμψη. "
            "Χρειάζεται σαφής περιγραφή εφαρμογής, τμήματος και λειτουργίας που δεν ανοίγει."
        ),
        "actions": [
            "Αναφέρετε εφαρμογή και λειτουργία που δεν ανοίγει.",
            "Σημειώστε αν εμφανίζεται μήνυμα μη εξουσιοδοτημένης πρόσβασης.",
            "Μην χρησιμοποιείτε λογαριασμό άλλου χρήστη.",
        ],
        "followups": [
            "step=3 | keywords=άλλος χρήστης, δανεικός λογαριασμός, shared password | answer=Η χρήση λογαριασμού άλλου χρήστη δεν είναι ασφαλής πρακτική. Το δικαίωμα πρέπει να δοθεί στον σωστό λογαριασμό. | actions=Μην δανείζεστε κωδικούς, Αναφέρετε το τμήμα και τη λειτουργία, Περιμένετε έλεγχο δικαιωμάτων",
        ],
    },
    {
        "id": "gmail-printer-scan",
        "title": "Εκτύπωση ή σάρωση: συχνά περιστατικά από αλληλογραφία IT",
        "keywords": [
            "εκτυπωτής",
            "εκτυπωτησ",
            "printer",
            "σάρωση",
            "σαρωση",
            "scanner",
            "scan",
            "πολυμηχάνημα",
            "πολυμηχανημα",
            "ουρά εκτύπωσης",
            "ουρα εκτυπωσης",
        ],
        "priority": 3,
        "patterns": ["εκτυπω", "printer", "scanner", "σαρωση", "scan", "toner", "χαρτι", "ουρα εκτυπω"],
        "answer": (
            "Για εκτύπωση ή σάρωση ξεκινάμε από ασφαλείς ελέγχους συσκευής, χαρτιού, toner και προορισμού. "
            "Δεν αλλάζουμε IP, θύρες ή τεχνικές ρυθμίσεις συσκευής."
        ),
        "actions": [
            "Ελέγξτε τροφοδοσία, χαρτί, toner και εμφανές μήνυμα στη συσκευή.",
            "Δοκιμάστε μία απλή σελίδα ή μία σελίδα σάρωσης.",
            "Αν αποτυγχάνει μόνο από μία εφαρμογή, αναφέρετε την εφαρμογή και το μήνυμα σφάλματος.",
        ],
        "followups": [],
    },
    {
        "id": "gmail-network-internet",
        "title": "Δίκτυο, Internet ή πρόσβαση σε ιστοσελίδα",
        "keywords": [
            "δίκτυο",
            "δικτυο",
            "internet",
            "ιστοσελίδα",
            "ιστοσελιδα",
            "δεν ανοίγει site",
            "δεν ανοιγει site",
            "φιλιππος",
            "mis",
            "wifi",
        ],
        "priority": 3,
        "patterns": ["internet", "δικτυ", "wifi", "site", "ιστοσελ", "φιλιππο", "mis", "vpn"],
        "answer": (
            "Για πρόβλημα δικτύου ξεχωρίζουμε αν αφορά το εσωτερικό δίκτυο ΦΙΛΙΠΠΟΣ, το MIS ή το Internet. "
            "Αν δεν είναι σαφές, πρέπει πρώτα να διευκρινιστεί ποιο δίκτυο ή ποια εφαρμογή επηρεάζεται."
        ),
        "actions": [
            "Δοκιμάστε μία εσωτερική εφαρμογή και μία εξωτερική ιστοσελίδα για σύγκριση.",
            "Ελέγξτε αν επηρεάζεται μόνο ο δικός σας σταθμός ή και άλλοι στον ίδιο χώρο.",
            "Μην κάνετε επανεκκίνηση σε switch, router ή άλλο δικτυακό εξοπλισμό.",
        ],
        "followups": [],
    },
    {
        "id": "gmail-shared-files",
        "title": "Κοινόχρηστος φάκελος ή αρχείο δεν ανοίγει",
        "keywords": [
            "κοινόχρηστος φάκελος",
            "κοινοχρηστος φακελος",
            "shared folder",
            "network drive",
            "αρχείο δεν ανοίγει",
            "αρχειο δεν ανοιγει",
            "δεν βρίσκω αρχείο",
            "δεν βρισκω αρχειο",
        ],
        "priority": 3,
        "patterns": ["κοινοχρηστ", "shared folder", "network drive", "αρχειο", "φακελο", "δισκο δικτυ"],
        "answer": (
            "Για κοινόχρηστο φάκελο ή αρχείο διαχωρίζουμε πρόβλημα πρόσβασης, δικαιωμάτων και διαθεσιμότητας "
            "δικτύου. Ο χρήστης δεν πρέπει να διαγράφει ή να μετακινεί αρχεία για δοκιμή."
        ),
        "actions": [
            "Ελέγξτε αν ανοίγει άλλος κοινόχρηστος φάκελος.",
            "Δοκιμάστε αποσύνδεση και νέα σύνδεση στα Windows.",
            "Αναφέρετε αν άλλοι χρήστες του ίδιου τμήματος βλέπουν τον φάκελο.",
        ],
        "followups": [],
    },
    {
        "id": "gmail-office-files",
        "title": "Word, Excel, PDF ή έγγραφο δεν ανοίγει σωστά",
        "keywords": [
            "word",
            "excel",
            "pdf",
            "office",
            "έγγραφο",
            "εγγραφο",
            "αρχείο office",
            "αρχειο office",
            "libreoffice",
        ],
        "priority": 3,
        "patterns": ["word", "excel", "pdf", "office", "libreoffice", "εγγραφο"],
        "answer": (
            "Για πρόβλημα εγγράφου, ο χρήστης ελέγχει αν αφορά ένα συγκεκριμένο αρχείο ή όλα τα αρχεία "
            "του ίδιου τύπου. Δεν πρέπει να στέλνει ευαίσθητο περιεχόμενο εγγράφου στο chatbot."
        ),
        "actions": [
            "Δοκιμάστε δεύτερο μη ευαίσθητο αρχείο ίδιου τύπου.",
            "Κλείστε και ανοίξτε ξανά την εφαρμογή Office ή PDF viewer.",
            "Αναφέρετε αν το αρχείο βρίσκεται τοπικά, σε κοινόχρηστο φάκελο ή σε email.",
        ],
        "followups": [],
    },
    {
        "id": "gmail-workstation-peripherals",
        "title": "Υπολογιστής ή περιφερειακό δεν λειτουργεί σωστά",
        "keywords": [
            "υπολογιστής",
            "υπολογιστησ",
            "pc",
            "σταθμός εργασίας",
            "σταθμοσ εργασιασ",
            "οθόνη",
            "οθονη",
            "πληκτρολόγιο",
            "πληκτρολογιο",
            "ποντίκι",
            "ποντικι",
        ],
        "priority": 3,
        "patterns": ["υπολογισ", "pc", "σταθμο", "οθον", "πληκτρολογ", "ποντικ", "κολλαει", "αργει"],
        "answer": (
            "Για σταθμό εργασίας ή περιφερειακό, ο χρήστης κάνει μόνο βασικούς ελέγχους σύνδεσης, "
            "τροφοδοσίας και επανεκκίνησης όταν δεν διακόπτεται κρίσιμη εργασία."
        ),
        "actions": [
            "Ελέγξτε τροφοδοσία και εμφανή καλώδια χωρίς να ανοίξετε εξοπλισμό.",
            "Κάντε επανεκκίνηση σταθμού εργασίας αν είναι ασφαλές για την εργασία σας.",
            "Αναφέρετε αν το πρόβλημα αφορά έναν σταθμό ή πολλούς στον ίδιο χώρο.",
        ],
        "followups": [],
    },
    {
        "id": "gmail-public-services",
        "title": "Ηλεκτρονική συνταγογράφηση ή εξωτερική δημόσια υπηρεσία δεν λειτουργεί",
        "keywords": [
            "ηλεκτρονική συνταγογράφηση",
            "ηλεκτρονικη συνταγογραφηση",
            "e-prescription",
            "οπσυεδ",
            "opssyed",
            "gov",
            "δημόσια υπηρεσία",
            "δημοσια υπηρεσια",
        ],
        "priority": 3,
        "patterns": ["συνταγογραφ", "opsyed", "οπσυεδ", "gov", "δημοσι", "e-prescription"],
        "answer": (
            "Για εξωτερικές δημόσιες υπηρεσίες διαχωρίζουμε αν δεν ανοίγει η ιστοσελίδα, αν υπάρχει θέμα "
            "πιστοποιητικού/κωδικού ή αν η ίδια η υπηρεσία εμφανίζει βλάβη."
        ),
        "actions": [
            "Δοκιμάστε μία δεύτερη γνωστή εξωτερική ιστοσελίδα.",
            "Κρατήστε το ακριβές μήνυμα που εμφανίζει η υπηρεσία.",
            "Μη στέλνετε προσωπικά στοιχεία ή στοιχεία ασθενών στο chatbot.",
        ],
        "followups": [],
    },
]


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data)

    def text(self) -> str:
        return " ".join(self.parts)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Local-only Gmail importer that creates sanitized user-facing knowledge entries."
    )
    parser.add_argument("--user", default=os.getenv("GMAIL_USER"), help="Gmail address. Prefer env GMAIL_USER.")
    parser.add_argument("--password", default=os.getenv("GMAIL_PASSWORD"), help="Gmail app password. Prefer env GMAIL_PASSWORD.")
    parser.add_argument("--mbox", type=Path, default=None, help="Optional local Gmail/Takeout .mbox file. When set, no Gmail login is used.")
    parser.add_argument("--takeout-zip", type=Path, action="append", default=[], help="Optional Google Takeout zip. Reads .mbox entries directly from the zip without extracting them.")
    parser.add_argument("--mailbox", default=os.getenv("GMAIL_MAILBOX", ""), help="Mailbox/label to scan. Default auto-picks All Mail or INBOX.")
    parser.add_argument("--since", default=os.getenv("GMAIL_SINCE", ""), help="IMAP SINCE date, e.g. 01-Jan-2024.")
    parser.add_argument("--limit", type=int, default=int(os.getenv("GMAIL_LIMIT", "0")), help="Max messages to scan; 0 scans all.")
    parser.add_argument("--max-message-bytes", type=int, default=int(os.getenv("GMAIL_MAX_MESSAGE_BYTES", str(25 * 1024 * 1024))), help="Skip single messages larger than this many bytes when streaming zip/mbox.")
    parser.add_argument("--min-count", type=int, default=int(os.getenv("GMAIL_MIN_TOPIC_COUNT", "1")), help="Minimum hits before writing a topic.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Generated knowledge file.")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT, help="Sanitized aggregate report JSON.")
    parser.add_argument("--dry-run", action="store_true", help="Only write the report, not the knowledge file.")
    args = parser.parse_args()

    try:
        if args.takeout_zip:
            report, knowledge = import_takeout_zips(args)
        elif args.mbox:
            report, knowledge = import_mbox(args)
        else:
            if not args.user:
                args.user = input("Gmail user: ").strip()
            if not args.password:
                args.password = getpass.getpass("Gmail app password: ")
            report, knowledge = import_gmail(args)
    except imaplib.IMAP4.error as error:
        print(
            "Gmail authentication failed. Enable Gmail IMAP and use a Gmail app password, "
            "or export Gmail with Google Takeout and rerun with --mbox. Raw mail was not stored.",
            file=sys.stderr,
        )
        return 2
    write_report(args.report, report)
    if not args.dry_run:
        write_knowledge(args.output, knowledge)

    print(
        json.dumps(
            {
                "scanned": report["scanned"],
                "matchedMessages": report["matchedMessages"],
                "writtenTopics": len(knowledge),
                "skippedFinancial": report["skipped"].get("financial", 0),
                "skippedAdminOnly": report["skipped"].get("adminOnly", 0),
                "report": str(args.report),
                "knowledge": "" if args.dry_run else str(args.output),
            },
            ensure_ascii=False,
        )
    )
    return 0


def import_gmail(args: argparse.Namespace) -> tuple[dict, list[dict]]:
    context = ssl.create_default_context()
    with imaplib.IMAP4_SSL("imap.gmail.com", 993, ssl_context=context) as imap:
        imap.login(args.user, args.password)
        mailboxes = list_mailboxes(imap)
        mailbox = args.mailbox or choose_mailbox(mailboxes)
        select_status, _ = imap.select(mailbox, readonly=True)
        if select_status != "OK":
            raise RuntimeError(f"Could not select mailbox: {mailbox}")

        search_query = build_search_query(args.since)
        status, data = imap.search(None, *search_query)
        if status != "OK":
            raise RuntimeError("Gmail search failed")

        message_ids = data[0].split()
        if args.limit > 0:
            message_ids = message_ids[-args.limit :]

        def texts():
            for message_id in message_ids:
                status, fetched = imap.fetch(message_id, "(RFC822)")
                if status != "OK" or not fetched:
                    yield None
                    continue

                raw_payload = next((part[1] for part in fetched if isinstance(part, tuple) and len(part) > 1), b"")
                if not raw_payload:
                    yield ""
                    continue

                yield message_to_text(email.message_from_bytes(raw_payload))

        return analyze_texts(
            texts(),
            total=len(message_ids),
            args=args,
            source="gmail-local-import",
            mailbox_name=mailbox,
        )


def import_mbox(args: argparse.Namespace) -> tuple[dict, list[dict]]:
    source = mailbox.mbox(args.mbox)
    messages = list(source)
    if args.limit > 0:
        messages = messages[-args.limit :]

    return analyze_texts(
        (message_to_text(message) for message in messages),
        total=len(messages),
        args=args,
        source="local-mbox-import",
        mailbox_name=str(args.mbox),
    )


def import_takeout_zips(args: argparse.Namespace) -> tuple[dict, list[dict]]:
    mbox_entries = []
    for zip_path in args.takeout_zip:
        with zipfile.ZipFile(zip_path) as archive:
            for entry in archive.infolist():
                if entry.filename.lower().endswith(".mbox"):
                    mbox_entries.append((zip_path, entry.filename, entry.file_size))

    def texts():
        remaining = args.limit if args.limit > 0 else None
        for zip_path, entry_name, _size in mbox_entries:
            if remaining is not None and remaining <= 0:
                return
            with zipfile.ZipFile(zip_path) as archive:
                with archive.open(entry_name) as stream:
                    for item in iter_mbox_message_texts(stream, args.max_message_bytes):
                        if remaining is not None and remaining <= 0:
                            return
                        yield item
                        remaining = None if remaining is None else remaining - 1

    total = args.limit if args.limit > 0 else 0
    report, topics = analyze_texts(
        texts(),
        total=total,
        args=args,
        source="takeout-zip-stream-import",
        mailbox_name=", ".join(f"{path.name}:{entry}" for path, entry, _size in mbox_entries) or "no-mbox-found",
    )
    report["takeoutZipEntries"] = [
        {"zip": str(path), "entry": entry, "uncompressedBytes": size}
        for path, entry, size in mbox_entries
    ]
    return report, topics


def iter_mbox_message_texts(stream: BinaryIO, max_message_bytes: int) -> Iterable[str | None]:
    buffer = bytearray()
    seen_first_separator = False
    skipped_current = False

    for line in stream:
        if line.startswith(b"From "):
            if seen_first_separator:
                if skipped_current:
                    yield None
                elif buffer:
                    yield message_to_text(email.message_from_bytes(bytes(buffer)))
            seen_first_separator = True
            buffer = bytearray()
            skipped_current = False
            continue

        if not seen_first_separator:
            continue

        if skipped_current:
            continue

        if len(buffer) + len(line) > max_message_bytes:
            buffer = bytearray()
            skipped_current = True
            continue

        buffer.extend(line)

    if seen_first_separator:
        if skipped_current:
            yield None
        elif buffer:
            yield message_to_text(email.message_from_bytes(bytes(buffer)))


def analyze_texts(texts: Iterable[str | None], total: int, args: argparse.Namespace, source: str, mailbox_name: str) -> tuple[dict, list[dict]]:
    counters = collections.Counter()
    scanned_count = 0
    matched_message_count = 0
    skipped = collections.Counter()
    redactions = collections.Counter()

    for index, text in enumerate(texts, start=1):
        scanned_count += 1
        if text is None:
            skipped["unreadableOrOversized"] += 1
            continue
        if not text:
            skipped["empty"] += 1
            continue

        normalized = normalize_text(text)

        if contains_any(normalized, FINANCIAL_TERMS):
            skipped["financial"] += 1
            continue

        if is_admin_only(normalized):
            skipped["adminOnly"] += 1
            continue

        sanitized, local_redactions = redact_sensitive(text)
        redactions.update(local_redactions)
        normalized_sanitized = normalize_text(sanitized)

        matched_any = False
        for category in CATEGORIES:
            if category_matches(category, normalized_sanitized):
                counters[category["id"]] += 1
                matched_any = True
        if matched_any:
            matched_message_count += 1
        else:
            skipped["unmatched"] += 1

        if index % 1000 == 0:
            print(json.dumps({"progress": index, "matchedMessages": matched_message_count}, ensure_ascii=False), file=sys.stderr)

    topics = []
    for category in CATEGORIES:
        count = counters[category["id"]]
        if count >= args.min_count:
            item = dict(category)
            item["count"] = count
            topics.append(item)

    report = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source": source,
        "mailbox": mailbox_name,
        "scanned": scanned_count,
        "plannedLimit": total,
        "matchedMessages": matched_message_count,
        "matchedCategoryHits": sum(counters.values()),
        "skipped": dict(skipped),
        "redactions": dict(redactions),
        "topics": [
            {
                "id": topic["id"],
                "title": topic["title"],
                "count": topic["count"],
                "priority": topic["priority"],
            }
            for topic in sorted(topics, key=lambda item: (-item["count"], item["title"]))
        ],
        "privacy": {
            "rawEmailStored": False,
            "messageSamplesStored": False,
            "financialContentStored": False,
            "adminOnlyContentStored": False,
            "sensitiveDataPolicy": "redact-before-classified-output",
        },
    }

    return report, sorted(topics, key=lambda item: (-item["count"], item["title"]))

def list_mailboxes(imap: imaplib.IMAP4_SSL) -> list[str]:
    status, data = imap.list()
    if status != "OK":
        return ["INBOX"]

    mailboxes = []
    for raw in data:
        text = raw.decode("utf-8", errors="ignore")
        match = re.search(r'"([^"]+)"\s*$', text)
        if match:
            mailboxes.append(match.group(1))
    return mailboxes or ["INBOX"]


def choose_mailbox(mailboxes: Iterable[str]) -> str:
    candidates = list(mailboxes)
    for term in ("[Gmail]/All Mail", "All Mail", "Όλα τα μηνύματα", "Ολα τα μηνυματα"):
        for mailbox in candidates:
            if term.lower() in mailbox.lower():
                return mailbox
    return "INBOX"


def build_search_query(since: str) -> list[str]:
    if since:
        return ["SINCE", since]
    return ["ALL"]


def message_to_text(message: email.message.Message) -> str:
    subject = decode_mime_header(message.get("subject", ""))
    parts = [subject]

    if message.is_multipart():
        for part in message.walk():
            if part.get_content_maintype() == "multipart":
                continue
            if part.get_content_disposition() == "attachment":
                continue
            content_type = part.get_content_type()
            if content_type not in {"text/plain", "text/html"}:
                continue
            parts.append(decode_part(part))
    else:
        parts.append(decode_part(message))

    return collapse_spaces(" ".join(parts))


def decode_mime_header(value: str) -> str:
    decoded = []
    for chunk, encoding in decode_header(value):
        if isinstance(chunk, bytes):
            decoded.append(safe_decode(chunk, encoding))
        else:
            decoded.append(chunk)
    return "".join(decoded)


def decode_part(part: email.message.Message) -> str:
    payload = part.get_payload(decode=True)
    if not payload:
        return ""
    charset = part.get_content_charset() or "utf-8"
    text = safe_decode(payload, charset)
    if part.get_content_type() == "text/html":
        return html_to_text(text)
    return text


def safe_decode(payload: bytes, encoding: str | None) -> str:
    for candidate in (encoding, "utf-8", "windows-1253", "iso-8859-7", "latin-1"):
        if not candidate:
            continue
        try:
            return payload.decode(candidate, errors="replace")
        except LookupError:
            continue
    return payload.decode("utf-8", errors="replace")


def html_to_text(value: str) -> str:
    parser = TextExtractor()
    parser.feed(html.unescape(value))
    return parser.text()


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFD", value.lower())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.replace("ς", "σ")
    text = re.sub(r"[^a-z0-9α-ω]+", " ", text)
    return collapse_spaces(text)


def collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def contains_any(normalized_text: str, terms: Iterable[str]) -> bool:
    return any(normalize_text(term) in normalized_text for term in terms)


def is_admin_only(normalized_text: str) -> bool:
    hits = sum(1 for term in ADMIN_TERMS if normalize_text(term) in normalized_text)
    credential_risk = re.search(r"\b(password|pass|κωδικοσ|κωδικοι|credential|token|secret)\b", normalized_text) and hits >= 1
    return hits >= 3 or bool(credential_risk)


def category_matches(category: dict, normalized_text: str) -> bool:
    return any(normalize_text(pattern) in normalized_text for pattern in category["patterns"])


def redact_sensitive(value: str) -> tuple[str, collections.Counter]:
    redactions = collections.Counter()
    text = value
    replacements = [
        ("email", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE), "[EMAIL]"),
        ("ipv4", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), "[IP]"),
        ("mac", re.compile(r"\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b", re.IGNORECASE), "[MAC]"),
        ("amka_or_long_id", re.compile(r"\b\d{11}\b"), "[ID]"),
        ("phone", re.compile(r"\b(?:\+?30)?(?:2\d{9}|69\d{8})\b"), "[PHONE]"),
        ("url", re.compile(r"https?://\S+", re.IGNORECASE), "[URL]"),
        ("secret", re.compile(r"(?i)\b(password|pass|pwd|token|secret|κωδικ(?:ός|ος|οι|οσ))\b\s*[:=]\s*\S+"), r"\1=[SECRET]"),
    ]

    for label, pattern, replacement in replacements:
        text, count = pattern.subn(replacement, text)
        if count:
            redactions[label] += count

    return text, redactions


def write_report(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def write_knowledge(path: Path, topics: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    generated = dt.datetime.now(dt.timezone.utc).isoformat()
    lines = [
        "# Gmail IT user-facing knowledge",
        "# Generated locally from the IT department Gmail mailbox.",
        "# Raw email content, credentials, IPs, financial data and admin-only instructions are not stored here.",
        f"# generated_at: {generated}",
        "",
    ]

    for topic in topics:
        lines.extend(render_topic(topic))
        lines.append("---")
        lines.append("")

    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def render_topic(topic: dict) -> list[str]:
    lines = [
        f"# {topic['title']}",
        f"keywords: {', '.join(topic['keywords'])}",
        f"priority: {topic['priority']}",
        "actions:",
    ]
    lines.extend(f"- {action}" for action in topic["actions"])
    if topic["followups"]:
        lines.append("followups:")
        lines.extend(f"- {followup}" for followup in topic["followups"])
    lines.extend(
        [
            "answer:",
            topic["answer"],
            "",
            "Η οδηγία αυτή προέκυψε από επαναλαμβανόμενα ασφαλή μοτίβα στην αλληλογραφία του τμήματος IT. Δεν περιέχει στοιχεία email, IP, διαπιστευτήρια, οικονομικά στοιχεία ή admin-only ενέργειες.",
        ]
    )
    return lines


if __name__ == "__main__":
    raise SystemExit(main())
