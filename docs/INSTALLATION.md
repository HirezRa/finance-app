# התקנה

## דרישות

### שרת
- מערכת הפעלה: Linux (Ubuntu/Debian מומלץ)
- Docker & Docker Compose v2+
- מינימום 2GB RAM
- 10GB דיסק פנוי

### פיתוח מקומי
- Node.js 22+
- npm או yarn
- Git

## התקנה מהירה (Docker)
```bash
# Clone
git clone https://github.com/HirezRa/finance-app.git
cd finance-app

# הגדרות
cp .env.example .env
# ערוך את .env עם הערכים שלך

# הפעלה
docker compose up -d

# מיגרציות
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

## התקנה לפיתוח
```bash
# Clone
git clone https://github.com/HirezRa/finance-app.git
cd finance-app

# Backend
cd backend
npm install
cp .env.example .env
npm run dev

# Frontend (בטרמינל נפרד)
cd frontend
npm install
npm run dev
```

## יצירת מפתחות אבטחה
```bash
# JWT Secret (64 תווים hex)
openssl rand -hex 32

# Encryption Key (64 תווים hex)
openssl rand -hex 32
```

## בדיקת התקנה

1. פתח `http://localhost` (Docker) או `http://localhost:5173` (פיתוח)
2. צור משתמש חדש
3. הוסף חשבון בנק/אשראי
4. בצע סנכרון
