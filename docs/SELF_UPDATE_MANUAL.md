# עדכון ידני של Finance App (Docker / המארח)

עדכון מהממשק כותב טריגר ל־`/opt/finance-app/update-data/` ו־systemd מריץ את [`scripts/safe-update.sh`](../scripts/safe-update.sh). אם צריך לעדכן ידנית — להריץ **על המארח** (לא בתוך הקונטיינר בלבד).

## פקודות מהירות

מתיקיית המאגר (ברירת מחדל `/opt/finance-app`). **חשוב:** אם אחרי `git checkout` של תג או rollback אתם ב־**detached HEAD**, `git pull` לבד ייכשל — תמיד חזרו ל־`main` לפני ה־pull:

```bash
cd /opt/finance-app
git fetch origin main
git checkout main --force
git pull origin main
docker compose up -d --build
```

לאחר מכן בדקו תקינות (למשל דרך nginx — אותו נתיב health כמו ב־`HEALTH_CHECK_URL` ב־`scripts/safe-update.sh`). **הערה:** בקונטיינר ה־backend, `prisma migrate deploy` רץ **לפני** ש־Node פותח את פורט 3000; בדקות ראשונות או DB איטי, בקשות ל־API עלולות להיראות «תקועות» עד סיום המיגרציה (ראו `docker compose logs backend`).

## אם `git pull` אומר "You are not currently on a branch"

המאגר ב־**detached HEAD** (למשל אחרי `git checkout v2.0.xx` או rollback). להריץ:

```bash
cd /opt/finance-app
git fetch origin main
git checkout main --force
git pull origin main
```

ואז המשיכו לבנייה / `docker compose` לפי הסעיפים למעלה.

## פקודות מלאות (שקול ל-safe-update)

```bash
cd /opt/finance-app
git fetch origin main
git checkout main --force
git pull origin main
docker compose exec -T backend npx prisma migrate deploy
docker compose build --no-cache backend frontend nginx
docker compose up -d
```

ודאו שהאפליקציה עונה (health) דרך nginx על המארח.

## אחרי כישלון עדכון אוטומטי

**אבחון מהיר:** אם ב־`.update-status.json` מופיע `rolled-back` עם `error` שמכיל **«בנייה נכשלה»** — בדרך כלל נכשל `docker compose build` (זיכרון, רשת ל־npm, או שגיאת TypeScript/Nest), ולא הורדת קוד מ־Git.

```bash
sudo journalctl -u finance-app-updater.service -b --no-pager -n 120
tail -n 200 /opt/finance-app/logs/update.log
tail -n 200 /opt/finance-app/update-data/build.log
cat /opt/finance-app/update-data/.update-status.json
```

**עדכון ידני מאורח לינוקס (דרך מנהל וירטואלי):** אותן פקודות כמו ב־«פקודות מלאות» למעלה — אחרי התחברות SSH לאורח שבו רץ Docker. דוגמה לסקריפט מהמחשב המקומי דרך SSH לשרת הביניים: `scripts/rebuild_backend_guest.sh` (משתני סביבה — ראו `docs/DEPLOYMENT.md`). פקודות מדויקות לספק וירטואליזציה ספציפי מתועדות ב־[`LOGGING_GUIDE.md`](../LOGGING_GUIDE.md) (סעיף עדכון מאורח).

## אבחון נתיב טריגר (קונטיינר)

```bash
docker exec finance-backend printenv APP_DIR UPDATE_DATA_DIR
ls -la /opt/finance-app/update-data/.update-requested
```

ראו גם [`LOGGING_GUIDE.md`](../LOGGING_GUIDE.md) — ייצוא לוג אבחון ו־DEBUG לסקרייפר.
