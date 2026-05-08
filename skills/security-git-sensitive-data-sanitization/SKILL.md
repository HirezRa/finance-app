# Security Skill: Git Sensitive Data Sanitization and Leak Prevention

## סיכום מנהלים

מידע רגיש ב-Git הוא סיכון גבוה: ההיסטוריה נשמרת, העתקים מפוזרים (מפתחים, CI, artifacts), וחשיפה עלולה להישאר גם אחרי תיקון קוד נוכחי. מחיקת קובץ אינה מספיקה — commits קודמים עדיין מכילים תוכן מלא. נדרשים ניקוי היסטוריה מבוקר ומניעה (hooks, CI, הגנות GitHub) נגד דליפות של secrets, PII, מידע פיננסי, תשתית ושמות מערכות.

## מודל סיווג מידע רגיש

| חומרה | סוג מידע | דוגמאות גנריות | פעולה נדרשת |
|--------|----------|------------------|--------------|
| Critical | private keys; passwords; tokens; API keys; live credentials | `<REDACTED_SECRET>`, `<REDACTED_TOKEN>` | הסרה מהמאגר, ניקוי היסטוריה, rotation מיידי, incident לפי מדיניות |
| High | PII; פרטים בנקאיים; פרטי כרטיסים; מזהים אישיים | `<REDACTED_PERSON_NAME>`, `<REDACTED_EMAIL>`, `<REDACTED_ACCOUNT_ID>`, `<REDACTED_CARD_LABEL>` | הסרה, בדיקת חובת דיווח, מניעה ב-CI |
| Medium | IP פנימי; hostname; container ID; system name; namespace; cluster | `<REDACTED_INTERNAL_IP>`, `<REDACTED_HOSTNAME>`, `<REDACTED_CONTAINER_ID>`, `<REDACTED_CLUSTER>` | החלפה ב-placeholders, מדיניות תיעוד, סינון ב-pre-commit |
| Low | תיעוד עמום; שמות סביבות לא מזהים | תיאור גנרי בלבד ללא מיפוי לזהות טכנית | עקביות במינוח, ביקורת תקופתית |

כל secret שנחשף לציבור או לצוות רחב יותר מהמותר ייחשב compromised וידרוש rotation/ביטול והנפקה מחדש, גם אם נמחק מה-working tree.

## ניתוח וזיהוי Secrets, PII ומידע תשתיתי

הטבלה הבאה מספקת דפוסי Regex גנריים לזיהוי ראשוני. תוצאות חייבות לעבור אימות אנושי או כללי validation כדי להפחית false positives.

| קטגוריה | Regex גנרי | הערות |
|---------|------------|--------|
| Secrets וסיסמאות | `(?i)\b(pass(word)?|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?[^"'\s]{8,}` | עלול לתפוס מחרוזות לגיטימיות; יש לצמצם לפי הקשר וכללי ארגון |
| Private keys | `-----BEGIN [A-Z ]*PRIVATE KEY-----` | Critical — חסימה מיידית ב-hooks |
| אימייל | `(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b` | PII; נדרש הקשר ארגוני |
| טלפון גנרי | `\b(?:\+\d{1,3}[- ]?)?\d{2,4}[- ]?\d{6,8}\b` | רגישות תלויה במדיניות; ייתכנו false positives |
| מזהה אישי מספרי גנרי | `\b\d{8,10}\b` | חובה checksum/validation ארצי כדי להפחית false positives |
| IBAN-like | `\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b` | דורש אלגוריתם checksum תקני לפני חסימה אוטומטית |
| מספר דמוי כרטיס | `\b(?:\d[ -]*?){13,19}\b` | חסימה אמינה דורשת Luhn validation — Regex בלבד אינו מספיק |
| כתובת IPv4 | `\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b` | להבחין בין ציבורי לפנימי לפי מדיניות |
| IP פנימי | `\b(?:10|127|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b` | Medium/High לפי הקשר |
| שמות קונטיינרים / instances | `(?i)\b(?:container|ct|instance|node|host)[-_]?[a-z0-9][a-z0-9._-]{2,63}\b` | להימנע מתיעוד שמות אמיתיים |
| מזהי קונטיינרים / VM / instance | `(?i)\b(?:container[_-]?id|instance[_-]?id|ctid|vmid)\s*[:=]\s*["']?\d{2,10}` | לא לשמור מזהים אמיתיים במאגר |
| Hostnames פנימיים | `(?i)\b[a-z0-9][a-z0-9-]{1,63}\.(?:internal|local|corp|lan|intra)\b` | החלפה ב-`<REDACTED_HOSTNAME>` |
| שמות מערכות, סביבות ו-clusters | `(?i)\b(?:prod|production|staging|uat|dr|backup|vault|db|cluster|namespace)[-_][a-z0-9._-]{2,64}\b` | עשוי לכלול שמות רגישים — סינון לפי הקשר |
| רשימת מונחים ארגונית אסורה | `(?i)\b(?:<BANK_TERM_1>|<BANK_TERM_2>|<CARD_LABEL_1>|<SYSTEM_ALIAS_1>|<PLATFORM_ALIAS_1>)\b` | placeholders לדוגמה בלבד |

**חשוב:** אין לשמור denylist אמיתי בתוך המאגר. רשימת מונחים ושמות רגישים אמיתיים תישמר ב-Vault או ב-Secrets Manager; CI יטען אותה בזמן ריצה בלבד מול משתני סביבה מאובטחים.

## סריקה של המאגר והיסטוריית Git

**כלים מומלצים:** gitleaks, trufflehog, git-secrets, ripgrep, `git grep`, חיפוש בהיסטוריה עם `git log -S` / `git log -G`, וסורק PII ייעודי (למשל Presidio או כלי DLP פנימי).

**פקודות לדוגמה (ערכים גנריים בלבד):**

```bash
gitleaks detect --source . --redact --verbose
trufflehog git file://. --only-verified
git grep -nE '<GENERIC_SENSITIVE_PATTERN>'
git log -S'<REDACTED_TERM>' --all --source --oneline
git log -G'<GENERIC_REGEX_PATTERN>' --all --source --patch
rg -n --hidden --glob '!vendor' --glob '!node_modules' '<GENERIC_SENSITIVE_PATTERN>'
```

**יומן ו-redaction:** בלוג CI/SIEM — לא ממצאים מלאים; רק נתיב, שורה, rule id, חומרה, hash חד-כיווני. בלוגי אפליקציה: mask/placeholder (`<REDACTED_TOKEN>`); לא request/response גולמיים; retention וגישה לפי least privilege.

## תוכנית לניקוי היסטוריית Git

תהליך ייעודי לאחר גיבוי ותיאום — **אין להריץ בפועל על מאגר חי ללא אישור וחלון תחזוקה**.

1. הקפאת עבודה; פתיחת incident/security ticket; חלון תחזוקה והודעה לבעלי עותקים.
2. mirror clone נפרד; backup branch/tag; קובץ replacements מאושר בלבד.
3. `git filter-repo` (מדויק) או BFG Repo-Cleaner; לאחר מכן `git reflog expire` ו-`git gc --prune=now --aggressive`.
4. סריקה חוזרת; force push מבוקר; הנחיית clone מחדש; ניקוי caches/artifacts; rotation לכל secret שנחשף.

**דוגמת replacements ו-filter-repo (גנרית):**

```bash
git clone --mirror <REPO_URL> repo-cleanup.git
cd repo-cleanup.git
git branch backup/pre-sanitization
cat > replacements.txt <<'EOF'
regex:\b(?:10|127|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b==><REDACTED_INTERNAL_IP>
regex:(?i)\b(?:container|ct|instance|node|host)[-_]?[a-z0-9][a-z0-9._-]{2,63}\b==><REDACTED_CONTAINER_NAME>
regex:(?i)\b(?:container[_-]?id|instance[_-]?id|ctid|vmid)\s*[:=]\s*["']?\d{2,10}==><REDACTED_CONTAINER_ID>
regex:(?i)\b(pass(word)?|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?[^"'\s]{8,}==><REDACTED_SECRET>
regex:\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b==><REDACTED_BANKING_IDENTIFIER>
EOF
git filter-repo --replace-text replacements.txt --force
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**חלופה עם BFG Repo-Cleaner:**

```bash
java -jar bfg.jar --replace-text replacements.txt repo-cleanup.git
cd repo-cleanup.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**הערות:** `git filter-repo` מתאים לניקוי מדויק ומתקדם; BFG נוח לניקוי מהיר של secrets וקבצים גדולים. לאחר rewrite חובה תיאום מלא: forks, clones ישנים, release artifacts ו-CI caches עלולים עדיין להכיל מידע ישן.

## אימות לאחר ניקוי

```bash
gitleaks detect --source . --redact --verbose
trufflehog git file://. --only-verified
git log --all -p | grep -Ei '<GENERIC_SENSITIVE_PATTERN>' || true
git grep -nE '<GENERIC_SENSITIVE_PATTERN>' $(git rev-list --all) || true
git fsck --no-reflogs --full
```

**Checklist אימות:**

- אין התאמות ל-regexים קריטיים לאחר סינון ואימות ידני.
- אין private keys במאגר או בהיסטוריה שנסרקה.
- אין הקצאות password/token חשודות.
- אין PII או מידע פיננסי גולמי.
- אין IP פנימי או hostnames רגישים.
- אין שמות קונטיינרים או מערכות אמיתיים בתיעוד או קוד.
- אין שמות בנקים או תוויות כרטיס אמיתיים.
- כל secrets שנחשפו עברו rotation.
- כל המפתחים ביצעו clone מחדש לפי ההנחיה.

## מנגנון מניעה אוטומטי לדליפות עתידיות

**דוגמת pre-commit hook:**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Running staged sensitive-data scan..."

gitleaks protect \
  --staged \
  --config .gitleaks.toml \
  --redact \
  --verbose

STAGED_TEXT="$(git diff --cached --unified=0 -- '*.md' '*.txt' '*.yaml' '*.yml' '*.json' '*.env' '*.conf' '*.ini' '*.tf' '*.tfvars' || true)"

echo "$STAGED_TEXT" | grep -Eiq '-----BEGIN [A-Z ]*PRIVATE KEY-----' && {
  echo "Blocked: private key material detected."
  exit 1
}

echo "$STAGED_TEXT" | grep -Eiq '\b(?:10|127|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\.[0-9]{1,3}\b' && {
  echo "Blocked: private/internal IP detected."
  exit 1
}

echo "$STAGED_TEXT" | grep -Eiq '(password|passwd|pwd|secret|token|api_key|client_secret)\s*[:=]' && {
  echo "Blocked: possible hardcoded credential assignment."
  exit 1
}

echo "Sensitive-data scan passed."
```

**דוגמת `.gitleaks.toml`:**

```toml
title = "Organization Sensitive Data Rules"

[[rules]]
id = "org-generic-password-assignment"
description = "Potential hardcoded password, token, or API key assignment"
regex = '''(?i)\b(pass(word)?|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?[^"'\s]{8,}'''
keywords = ["password", "passwd", "pwd", "secret", "token", "api_key", "client_secret"]
tags = ["secret", "credential", "critical"]

[[rules]]
id = "org-private-ip"
description = "Private/internal IP address"
regex = '''\b(?:10|127|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b'''
tags = ["infrastructure", "network", "medium"]

[[rules]]
id = "org-container-or-instance-id"
description = "Potential container or instance identifier"
regex = '''(?i)\b(?:container[_-]?id|instance[_-]?id|ctid|vmid)\s*[:=]\s*["']?\d{2,10}'''
keywords = ["container", "instance", "ctid", "vmid"]
tags = ["infrastructure", "container", "medium"]

[[rules]]
id = "org-internal-hostname"
description = "Internal hostname or private domain"
regex = '''(?i)\b[a-z0-9][a-z0-9-]{1,63}\.(?:internal|local|corp|lan|intra)\b'''
tags = ["infrastructure", "hostname", "medium"]

[[rules]]
id = "org-payment-card-candidate"
description = "Potential payment card number candidate; requires Luhn validation outside regex"
regex = '''\b(?:\d[ -]*?){13,19}\b'''
tags = ["payment", "pii", "requires-validation"]
```

**דוגמת GitHub Actions:**

```yaml
name: Sensitive Data Scan

on:
  pull_request:
  push:
    branches: [ main ]

jobs:
  sensitive-data-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Run TruffleHog verified secrets scan
        run: |
          docker run --rm -v "$PWD:/repo" trufflesecurity/trufflehog:latest git file:///repo --only-verified --no-update

      - name: Run custom PII scan
        run: |
          python tools/security/pii_scan.py --path . --fail-on high
```

**המלצות נוספות:** להפעיל GitHub Secret Scanning ו-Push Protection; להגדיר branch protection rules ו-required status checks; להגדיר CODEOWNERS על קבצי CI/CD, תיעוד וקונפיגורציה; לאמץ pre-commit framework; לשמור baseline חתום; ולהגדיר תהליך חריגים (exceptions) עם אישור Security Owner בלבד.

## ניהול סודות ומידע רגיש

אין לשמור סודות בקוד או ב-`.env` במאגר; אין denylist אמיתי או שמות בנקים/לקוחות/מערכות/קונטיינרים אמיתיים. להשתמש ב-Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager או GitHub Actions Secrets לפי תקן הארגון; rotation תקופתי, credentials קצרי חיים, least privilege; בתיעוד רק placeholders (`<REDACTED_SECRET>`, `<REDACTED_VENDOR>`).

## הנחיות לתיעוד בטוח של תשתיות, קונטיינרים ומערכות

בתיעוד ציבורי אין לפרט סוגי runtime ספציפיים, host, IP פנימי, cluster/namespace אמיתיים, שמות מערכות, instance/container ID או vendor/platform רגיש.

**מונחים חלופיים בטוחים:** isolated runtime; containerized workload; managed execution environment; internal compute unit; sandboxed service runtime; restricted execution unit; internal workload runtime.

מיפוי גנרי↔משאב אמיתי רק במערכת פנימית עם RBAC, audit והצפנה; בקוד ובתיעוד חיצוני רק placeholders.

## תגובה לאירוע דליפה

**Playbook קצר:** עצירת merge/push; incident עם אבטחה ומנהל מאגר; זיהוי scope (קבצים, commits, forks); rotation מלא; ניקוי היסטוריית Git מאושר; מחיקת caches/artifacts; force push מבוקר אם נדרש; clone מחדש לצוות; סריקה חוזרת; post-mortem ועדכון חוקי סריקה ו-hooks.

| סוג ממצא | חומרה | פעולה |
|----------|--------|--------|
| Private key | Critical | Rotation מיידי, ניקוי Git, incident |
| Password/token | Critical | ביטול והחלפה, בדיקת שימוש לרעה |
| PII | High | הסרה, בדיקת חובת דיווח, review משפטי |
| מידע בנקאי | High | חסימה, הסרה, בדיקת חשיפה |
| IP/hostname פנימי | Medium | החלפה ב-placeholder, עדכון policy |
| שם מערכת/קונטיינר | Medium | החלפה במונח גנרי |

## תנאי קבלה

- [ ] ה-SKILL נוצר בנתיב הנכון.
- [ ] המסמך בעברית, מקצועי וברור.
- [ ] המסמך מכסה secrets, PII, מידע פיננסי, בנקים, כרטיסים, סיסמאות, קונטיינרים, מערכות ותשתיות.
- [ ] יש Regex לכל קטגוריית מידע רגיש.
- [ ] יש הסבר שמזהים פיננסיים דורשים checksum/Luhn ולא Regex בלבד.
- [ ] יש הנחיות לשימוש ב-gitleaks.
- [ ] יש הנחיות לשימוש ב-trufflehog.
- [ ] יש פקודות git לחיפוש בהיסטוריה.
- [ ] יש תוכנית ניקוי עם git filter-repo.
- [ ] יש חלופה עם BFG Repo-Cleaner.
- [ ] יש שלב garbage collection.
- [ ] יש תהליך אימות לאחר ניקוי.
- [ ] יש pre-commit hook.
- [ ] יש דוגמת GitHub Actions.
- [ ] יש דוגמת .gitleaks.toml.
- [ ] יש הנחיות לניהול secrets.
- [ ] יש הנחיות לתיעוד בטוח של תשתיות.
- [ ] יש הנחיות תגובה לאירוע.
- [ ] כל הדוגמאות גנריות בלבד.
- [ ] אין שמות אמיתיים של בנקים, כרטיסים, מערכות, קונטיינרים או IP.
- [ ] אין secrets אמיתיים או דוגמאות שנראות פעילות.

## מסקנות והמלצות להמשך

לבצע inventory למאגרים ו-artifacts; scanning מקומי ו-CI; denylist מחוץ למאגר; rotation לערכים שנחשפו; Push Protection; CODEOWNERS; drill לדליפות; review רבעוני לכללים וחריגים — יחד עם תיעוד בטוח וניהול סודות מרכזי מפחיתים זליגת מידע רגיש מ-Git.
