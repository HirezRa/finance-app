import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategoryDefinition {
  name: string;
  nameHe: string;
  icon: string;
  color: string;
  isIncome: boolean;
  isFixed: boolean;
  isTracked: boolean;
  keywords: string[];
}

const systemCategories: CategoryDefinition[] = [
  // === הכנסות ===
  {
    name: 'salary',
    nameHe: 'משכורת',
    icon: '💰',
    color: '#22c55e', // green-500
    isIncome: true,
    isFixed: true,
    isTracked: false,
    keywords: ['משכורת', 'שכר', 'העברה מ', 'העברת משכורת', 'SALARY'],
  },
  {
    name: 'rent_income',
    nameHe: 'שכירות',
    icon: '🏠',
    color: '#10b981', // emerald-500
    isIncome: true,
    isFixed: true,
    isTracked: false,
    keywords: ['שכירות', 'שכ"ד', 'דמי שכירות', 'הכנסה משכירות'],
  },
  {
    name: 'other_income',
    nameHe: 'הכנסה אחרת',
    icon: '📈',
    color: '#14b8a6', // teal-500
    isIncome: true,
    isFixed: false,
    isTracked: false,
    keywords: ['החזר', 'זיכוי', 'בונוס', 'מתנה'],
  },

  // === הוצאות קבועות ===
  {
    name: 'mortgage',
    nameHe: 'משכנתא',
    icon: '🏦',
    color: '#6366f1', // indigo-500
    isIncome: false,
    isFixed: true,
    isTracked: false,
    keywords: ['משכנתא', 'משכנתה', 'הלוואה לדיור', 'MORTGAGE'],
  },
  {
    name: 'rent',
    nameHe: 'שכר דירה',
    icon: '🔑',
    color: '#8b5cf6', // violet-500
    isIncome: false,
    isFixed: true,
    isTracked: false,
    keywords: ['שכר דירה', 'שכ"ד', 'דמי שכירות'],
  },
  {
    name: 'utilities',
    nameHe: 'חשמל, מים וארנונה',
    icon: '💡',
    color: '#f59e0b', // amber-500
    isIncome: false,
    isFixed: true,
    isTracked: true,
    keywords: ['חשמל', 'חברת החשמל', 'מים', 'מקורות', 'ארנונה', 'עירייה', 'גז', 'פזגז', 'סופרגז'],
  },
  {
    name: 'phone',
    nameHe: 'סלולר ותקשורת',
    icon: '📱',
    color: '#3b82f6', // blue-500
    isIncome: false,
    isFixed: true,
    isTracked: true,
    keywords: ['סלקום', 'פרטנר', 'הוט', 'בזק', 'פלאפון', 'גולן טלקום', '012', '013', '019', 'HOT', 'YES', 'CELLCOM', 'PARTNER'],
  },
  {
    name: 'insurance',
    nameHe: 'ביטוח',
    icon: '🛡️',
    color: '#0ea5e9', // sky-500
    isIncome: false,
    isFixed: true,
    isTracked: true,
    keywords: ['ביטוח', 'הראל', 'מגדל', 'כלל', 'הפניקס', 'איילון', 'מנורה', 'הכשרה', 'שירביט', 'AIG'],
  },
  {
    name: 'loan',
    nameHe: 'הלוואה',
    icon: '🏛️',
    color: '#64748b', // slate-500
    isIncome: false,
    isFixed: true,
    isTracked: false,
    keywords: ['הלוואה', 'החזר הלוואה', 'אוטו קאש', 'שרותי בנק'],
  },

  // === הוצאות במעקב ===
  {
    name: 'groceries',
    nameHe: 'מכולת וסופר',
    icon: '🛒',
    color: '#22c55e', // green-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['רמי לוי', 'שופרסל', 'מגה', 'ויקטורי', 'יוחננוף', 'חצי חינם', 'סופר', 'מכולת', 'פירות', 'ירקות', 'יינות ביתן', 'אושר עד', 'טיב טעם', 'AM:PM', 'סופר פארם'],
  },
  {
    name: 'restaurants',
    nameHe: 'מסעדות',
    icon: '🍽️',
    color: '#f97316', // orange-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['מסעדה', 'קפה', 'מקדונלד', 'בורגר', 'פיצה', 'סושי', 'שווארמה', 'פלאפל', 'CAFE', 'RESTAURANT', 'COFFEE', 'ארומה', 'קפה קפה', 'גרג', 'לנדוור', 'רולדין'],
  },
  {
    name: 'fuel',
    nameHe: 'דלק',
    icon: '⛽',
    color: '#ef4444', // red-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['דלק', 'סונול', 'פז', 'דור אלון', 'תדיר', 'TEN', 'YELLOW', 'DELEK', 'SONOL', 'PAZ', 'אלון', 'דור'],
  },
  {
    name: 'transportation',
    nameHe: 'תחבורה',
    icon: '🚌',
    color: '#06b6d4', // cyan-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['רכבת', 'אגד', 'דן', 'מטרופולין', 'רב קו', 'אוטובוס', 'קווים', 'נתיב אקספרס', 'מונית', 'GETT', 'YANGO'],
  },
  {
    name: 'shopping',
    nameHe: 'קניות',
    icon: '🛍️',
    color: '#ec4899', // pink-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['קניון', 'H&M', 'זארה', 'ZARA', 'FOX', 'גולף', 'קסטרו', 'אמריקן איגל', 'PULL&BEAR', 'TERMINAL X', 'עזריאלי', 'SHEIN', 'ALIEXPRESS', 'AMAZON'],
  },
  {
    name: 'health',
    nameHe: 'בריאות',
    icon: '🏥',
    color: '#14b8a6', // teal-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['קופת חולים', 'מכבי', 'כללית', 'מאוחדת', 'לאומית', 'בית מרקחת', 'סופר פארם', 'רופא', 'מרפאה', 'בית חולים', 'NEW PHARM'],
  },
  {
    name: 'kids',
    nameHe: 'ילדים',
    icon: '👶',
    color: '#a855f7', // purple-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['גן ילדים', 'צהרון', 'חוגים', 'בייביסיטר', 'משמרת', 'טויס', 'שילב', 'באגס', 'TOYS'],
  },
  {
    name: 'pets',
    nameHe: 'בעלי חיים',
    icon: '🐕',
    color: '#d946ef', // fuchsia-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['וטרינר', 'פט', 'כרמלי', 'PET', 'חיות', 'מזון לחיות'],
  },
  {
    name: 'entertainment',
    nameHe: 'בידור',
    icon: '🎬',
    color: '#f43f5e', // rose-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['סינמה', 'קולנוע', 'יס פלאנט', 'נטפליקס', 'NETFLIX', 'SPOTIFY', 'אפל', 'APPLE', 'הופעה', 'כרטיסים', 'לאן', 'סלקום TV'],
  },
  {
    name: 'travel',
    nameHe: 'נסיעות וחופשות',
    icon: '✈️',
    color: '#0891b2', // cyan-600
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['טיסה', 'מלון', 'BOOKING', 'AIRBNB', 'אל על', 'ישראייר', 'ELAL', 'HOTEL', 'חופשה'],
  },
  {
    name: 'education',
    nameHe: 'חינוך ולימודים',
    icon: '🎓',
    color: '#4f46e5', // indigo-600
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['אוניברסיטה', 'מכללה', 'קורס', 'שכר לימוד', 'ספרים', 'סטימצקי', 'UDEMY', 'COURSERA'],
  },
  {
    name: 'fitness',
    nameHe: 'ספורט וכושר',
    icon: '🏃',
    color: '#84cc16', // lime-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['חדר כושר', 'הולמס פלייס', 'גו אקטיב', 'פיטנס', 'יוגה', 'בריכה', 'GYM'],
  },
  {
    name: 'home',
    nameHe: 'בית ותחזוקה',
    icon: '🔨',
    color: '#78716c', // stone-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['איקאה', 'IKEA', 'ACE', 'הום סנטר', 'HOME CENTER', 'מר בריקולאז', 'ריהוט', 'חשמל', 'אינסטלטור'],
  },
  {
    name: 'car',
    nameHe: 'רכב',
    icon: '🚗',
    color: '#71717a', // zinc-500
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['טסט', 'רישיון', 'ביטוח רכב', 'מוסך', 'צמיגים', 'חניה', 'כביש 6', 'אגרה'],
  },

  // === אחר ===
  {
    name: 'uncategorized',
    nameHe: 'לא מסווג',
    icon: '❓',
    color: '#6b7280', // gray-500
    isIncome: false,
    isFixed: false,
    isTracked: false,
    keywords: [],
  },
  {
    name: 'atm',
    nameHe: 'משיכת מזומן',
    icon: '💵',
    color: '#059669', // emerald-600
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['משיכה', 'מזומן', 'כספומט', 'ATM', 'משיכת מזומן'],
  },
  {
    name: 'transfer',
    nameHe: 'העברה',
    icon: '🔄',
    color: '#0284c7', // sky-600
    isIncome: false,
    isFixed: false,
    isTracked: false,
    keywords: ['העברה ל', 'BIT', 'PAYBOX', 'ביט', 'פייבוקס', 'PEPPER'],
  },
  {
    name: 'fees',
    nameHe: 'עמלות בנק',
    icon: '🏦',
    color: '#dc2626', // red-600
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: ['עמלה', 'עמלות', 'דמי ניהול', 'ריבית', 'הוצאות בנק'],
  },
];

async function main() {
  console.log('Seeding system categories with icons and colors...');

  for (const cat of systemCategories) {
    const existing = await prisma.category.findFirst({
      where: {
        name: cat.name,
        isSystem: true,
        userId: null,
      },
    });

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          nameHe: cat.nameHe,
          icon: cat.icon,
          color: cat.color,
          isIncome: cat.isIncome,
          isFixed: cat.isFixed,
          isTracked: cat.isTracked,
          keywords: cat.keywords,
        },
      });
      console.log(`✓ Updated: ${cat.icon} ${cat.nameHe}`);
    } else {
      await prisma.category.create({
        data: {
          name: cat.name,
          nameHe: cat.nameHe,
          icon: cat.icon,
          color: cat.color,
          isSystem: true,
          isIncome: cat.isIncome,
          isFixed: cat.isFixed,
          isTracked: cat.isTracked,
          keywords: cat.keywords,
          userId: null,
        },
      });
      console.log(`+ Created: ${cat.icon} ${cat.nameHe}`);
    }
  }

  const count = await prisma.category.count({ where: { isSystem: true } });
  console.log(`\nTotal system categories: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
