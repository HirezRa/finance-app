# פריסה (Deployment)

## דרישות שרת

- Docker & Docker Compose
- מינימום 2GB RAM
- 10GB דיסק פנוי

## התקנה על שרת

### 1. Clone הפרויקט
```bash
git clone https://github.com/HirezRa/finance-app.git
cd finance-app
```

### 2. הגדרת משתני סביבה
```bash
cp .env.example .env
nano .env  # ערוך את הערכים
```

### 3. יצירת מפתחות
```bash
# JWT Secret
openssl rand -hex 32

# Encryption Key
openssl rand -hex 32
```

### 4. הפעלה
```bash
docker compose up -d
```

### 5. מיגרציות
```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### 6. גישה

פתח בדפדפן: `http://YOUR_SERVER_IP`

## עדכון גרסה
```bash
git pull
docker compose build --no-cache backend frontend
docker compose up -d
```

## פקודות שימושיות
```bash
# צפייה בלוגים
docker compose logs -f backend

# כניסה לקונטיינר
docker compose exec backend sh

# גיבוי Database
docker compose exec db pg_dump -U finance finance_app > backup.sql

# שחזור Database
docker compose exec -T db psql -U finance finance_app < backup.sql
```
