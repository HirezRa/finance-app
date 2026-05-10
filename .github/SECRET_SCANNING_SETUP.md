# הגדרות אבטחה וסריקת סודות ב-GitHub

מדריך קצר למנהל המאגר — להפעלה ידנית ב-GitHub (לא ניתן להגדיר מהקוד בלבד).

## Secret scanning ומגן דחיפות

1. פתח את המאגר ב-GitHub → **Settings**.
2. תחת **Security**:
   - **Code security and analysis**
   - הפעל **Secret scanning** (זמין ברמת ארגון/תוכנית — אם מוצג).
   - הפעל **Push protection** לסודות כדי לחסום דחיפות עם מפתחות גלויים לפני שהן נכנסות להיסטוריה.

אם האפשרויות לא זמינות, בדוק את תוכנית GitHub (Free/Team/Enterprise) והגדרות הארגון.

## מה כבר קיים במאגר

| רכיב | תיאור |
|------|--------|
| `.gitleaks.toml` | כללי סריקה מורחבים + החרגות (כולל IP מלא בן־4 אוקטטות כדי לא לתפוס semver) |
| `.gitleaksignore` | טביעות אצבע (`Fingerprint`) של התאמות היסטוריות ידועות כשווא־חיוביות — **דליפות חדשות עדיין ייכשלו** |
| `.github/workflows/ci-security.yml` | Gitleaks, TruffleHog (verified), `verify-sensitive-repo-patterns` |
| `scripts/git-hooks/pre-commit-sensitive-scan.sh` | סריקת קבצים staged לפני קומיט (דורש התקנה מקומית) |

### חידוש `.gitleaksignore` (מתוחזקים)

אם הרצת `gitleaks detect` ויש רק שווא־חיוביים חדשים:

```bash
gitleaks detect --config .gitleaks.toml --report-format json --report-path gitleaks-report.json
# הוסף ל-.gitleaksignore רק שורות Fingerprint חדשות, או מחק ערכים אם תיקנת בקוד/בכללים
```

`gitleaks-report.json` ב־`.gitignore` — לא לדחוף ל־Git.

### התקנת pre-commit מקומית

```bash
# מ-Linux/macOS Git Bash או WSL
bash scripts/install-git-hooks.sh
```

ב-Windows PowerShell:

```powershell
.\scripts\install-git-hooks.ps1
```

מומלץ להתקין גם את [Gitleaks](https://github.com/gitleaks/gitleaks) ב-PATH כדי שה-hook וה-CI יתאימו.
