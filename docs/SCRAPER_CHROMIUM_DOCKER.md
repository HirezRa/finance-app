# Chromium / Puppeteer בסקרייפר (Docker)

## חתימת שגיאה (לפני התיקון)

דוגמאות מלוג ה-backend / Bull job:

- `Failed to launch the browser process! Failed to move to new namespace: PID namespaces supported, Network namespace supported, but failed: errno = Operation not permitted`
- `zygote_host_impl_linux.cc:... Check failed`
- `TROUBLESHOOTING: https://pptr.dev/troubleshooting`

## סיבה (תמצית)

Chromium (דרך Puppeteer ב-`israeli-bank-scrapers`) משתמש במודל **zygote / Linux namespaces**. בסביבות מבודדות (קונטיינר Docker, ולעיתים Docker בתוך סביבת וירטואליזציה):

1. **seccomp ברירת מחדל של Docker** עלול לחסום syscalls נדרשים.
2. גם עם `--no-sandbox`, Chromium עדיין עלול לנסות מסלולים שנחסמים עד שמוסיפים דגלים כמו `--no-zygote`.

הכשל אינו בהכרח "שגיאת בנק" אלא **הרשאות קרנל / בידוד קונטיינר**.

## מה מוגדר בפרויקט

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

**אבטחה:** מבטל סינון seccomp לקונטיינר ה-backend בלבד. מתאים לסביבות פרטיות/פיתוח כאשר חייבים להריץ דפדפן אוטומטי. בפרודקשן מומלץ worker ייעודי או פרופיל seccomp מותאם, לא `unconfined` גורף אם אפשר להימנע.

## אימות אחרי פריסה

1. מה-UI: **סנכרון** לחשבון מוגדר.
2. בשרת (בתיקיית הפרויקט):

   ```bash
   docker compose logs -f backend
   ```

   לוודא שאין יותר `Failed to move to new namespace` / `zygote_host_impl_linux`.

3. (אופציונלי) בתוך הקונטיינר:

   ```bash
   docker compose exec backend sh -c '/usr/bin/chromium --version'
   ```

## אם עדיין נכשל

1. ודא ש-Docker והקונטיינר תומכים בדרישות Chromium (זיכרון, `/dev/shm`, וכו').
2. אם Docker רץ בתוך סביבה מקוננת (למשל VM או קונטיינר הוסט), ייתכן שתידרש הרפיית מדיניות בידוד אצל ספק ההוסטינג.
3. רק אחרי בדיקה: `privileged: true` לקונטיינר — **חשיפה גבוהה**, שימוש אחרון.

## סיכום תהליך האבחון

1. זיהוי הלוג ככשל **הפעלת דפדפן** (namespaces / zygote), לא כשל לוגיקה של אתר הבנק.
2. שכבת אפליקציה: דגלי Chromium מתאימים לקונטיינר.
3. שכבת Docker: הרפיית seccomp **רק** ל-backend שמריץ Puppeteer.
4. במידת הצורך: שכבת המארח (VM / קונטיינר הורה).

## הפניות

- [Puppeteer troubleshooting](https://pptr.dev/troubleshooting)
- תיעוד Docker: `security_opt`, seccomp profiles
