/** מחרוזת קצרה לתצוגה וללוגים; השגיאה המלאה נשמרת ב-meta / DB לפי הצורך */
export function shortenSyncErrorMessage(message: string): string {
  const m = message ?? '';
  if (m.includes('Block Automation')) {
    return 'הבנק חסם גישה אוטומטית - נסה שוב מאוחר יותר';
  }
  if (
    m.includes('Invalid credentials') ||
    m.toLowerCase().includes('wrong credentials') ||
    m.includes('invalid credentials')
  ) {
    return 'שם משתמש או סיסמה שגויים';
  }
  if (m.includes('timeout') || m.includes('ETIMEDOUT')) {
    return 'תם הזמן - הבנק לא הגיב';
  }
  if (m.includes('ECONNREFUSED') || m.includes('ENOTFOUND')) {
    return 'לא ניתן להתחבר לבנק';
  }
  if (m.includes('OTP') || m.includes('verification')) {
    return 'נדרש אימות נוסף - היכנס לאתר הבנק';
  }
  if (m.includes('maintenance') || m.includes('unavailable')) {
    return 'אתר הבנק בתחזוקה';
  }
  if (m.includes('fetchPostWithinPage parse error')) {
    return 'שגיאת תקשורת עם הבנק';
  }
  if (m.length > 100) {
    return `${m.slice(0, 100)}...`;
  }
  return m;
}
