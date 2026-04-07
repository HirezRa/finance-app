# Runbook: Chromium / Puppeteer בסקרייפר (Docker בתוך LXC)

## חתימת שגיאה (לפני התיקון)

דוגמאות מלוג ה-backend / Bull job:

- `Failed to launch the browser process! Failed to move to new namespace: PID namespaces supported, Network namespace supported, but failed: errno = Operation not permitted`
- `zygote_host_impl_linux.cc:... Check failed`
- `TROUBLESHOOTING: https://pptr.dev/troubleshooting`

## סיבה (תמצית)

Chromium (דרך Puppeteer ב-`israeli-bank-scrapers`) משתמש במודל **zygote / Linux namespaces**. בסביבה של **Docker בתוך LXC** (במיוחד CT לא-פריבילגי):

1. **seccomp ברירת מחדל של Docker** עלול לחסום syscalls נדרשים.
2. גם עם `--no-sandbox`, Chromium עדיין עלול לנסות מסלולים שנחסמים עד שמוסיפים דגלים כמו `--no-zygote`.

הכשל אינו בהכרח "שגיאת בנק" אלא **הרשאות קרנל / בידוד קונטיינר**.

## מה שינינו בפרויקט

### 1) `browserArgs` ב-`runScraper`

קובץ: `backend/src/modules/scraper/scraper.service.ts`

בנוסף ל-`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`:

- `--no-zygote` — מפחית כשלי `zygote_host_impl_linux` בקונטיינרים.
- `--disable-namespace-sandbox` — משלים את ביטול שכבות sandbox הקשורות ל-namespaces.

### 2) `security_opt` לשירות `backend` בלבד

קובץ: `docker-compose.yml`

```yaml
security_opt:
  - seccomp:unconfined
```

**אבטחה:** מבטל סינון seccomp לקונטיינר ה-backend בלבד. מתאים ל-homelab כאשר חייבים להריץ דפדפן אוטומטי. בפרודקשן מומלץ worker ייעודי או פרופיל seccomp מותאם, לא `unconfined` גורף אם אפשר להימנע.

## אימות אחרי פריסה

1. מה-UI: **סנכרון** לחשבון מוגדר.
2. ב-LXC (בתוך `/opt/finance-app`):

   ```bash
   docker compose logs -f backend
   ```

   לוודא שאין יותר `Failed to move to new namespace` / `zygote_host_impl_linux`.

3. (אופציונלי) בתוך הקונטיינר:

   ```bash
   docker compose exec backend sh -c '/usr/bin/chromium --version'
   ```

## אם עדיין נכשל

1. **Proxmox CT (למשל 115):** ודא ש-Docker בתוך LXC נתמך — לרוב נדרש `features: nesting=1` (ובמקרים מסוימים הגדרות נוספות לפי גרסת Proxmox).
2. רק אחרי בדיקה: שקילת CT פריבילגי או `privileged: true` לקונטיינר — **חשיפה גבוהה**, שימוש אחרון.

## סיכום תהליך האבחון

1. זיהוי הלוג ככשל **הפעלת דפדפן** (namespaces / zygote), לא כשל לוגיקה של אתר הבנק.
2. שכבת אפליקציה: דגלי Chromium מתאימים לקונטיינר.
3. שכבת Docker: הרפיית seccomp **רק** ל-backend שמריץ Puppeteer.
4. במידת הצורך: שכבת LXC/Proxmox (nesting וכו').

## הפניות

- [Puppeteer troubleshooting](https://pptr.dev/troubleshooting)
- תיעוד Docker: `security_opt`, seccomp profiles
