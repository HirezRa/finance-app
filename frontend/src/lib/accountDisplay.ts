/** שם תצוגה לחשבון: כינוי אם הוגדר, אחרת שם המוסד */
export function getAccountDisplayName(account: {
  nickname?: string | null;
  institutionName: string;
}): string {
  const n = account.nickname?.trim();
  return n || account.institutionName;
}
