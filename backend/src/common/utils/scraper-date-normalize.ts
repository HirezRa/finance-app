import {
  endOfIsraelCivilDayInUtc,
  formatIsraelYmdIso,
  getIsraelYmd,
  isStrictIsoDateOnly,
  parseIsoYmdParts,
  startOfIsraelCivilDayInUtc,
} from './israel-calendar';

export type ScraperDateFields = {
  ymdIso: string;
  dayStart: Date;
  dayEnd: Date;
  dateForRow: Date;
};

function fallbackScraperDateSemantics(
  hint: string,
  warn: (message: string) => void,
): ScraperDateFields {
  const slice = hint.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) {
    const dayStart = new Date(`${slice}T00:00:00.000Z`);
    const dayEnd = new Date(`${slice}T23:59:59.999Z`);
    if (!Number.isNaN(dayStart.getTime())) {
      warn(`Scraper date "${hint}" — using UTC midnight bounds fallback for hash/dedup`);
      return { ymdIso: slice, dayStart, dayEnd, dateForRow: dayStart };
    }
  }
  const now = new Date();
  const { year, month, day } = getIsraelYmd(now);
  warn(`Unparseable scraper date "${hint}" — using today's Israel civil day for hash/dedup`);
  return {
    ymdIso: formatIsraelYmdIso(now),
    dayStart: startOfIsraelCivilDayInUtc(year, month, day),
    dayEnd: endOfIsraelCivilDayInUtc(year, month, day),
    dateForRow: startOfIsraelCivilDayInUtc(year, month, day),
  };
}

/**
 * אותה סמנטיקה כמו ב־ScraperService לפני שמירה: יום אזרחי בישראל + תחילת יום ב־UTC.
 */
export function normalizeScraperDateFromRaw(
  rawDate: string,
  onWarn?: (message: string) => void,
): ScraperDateFields {
  const warn = onWarn ?? (() => {});
  const trimmed = String(rawDate ?? '').trim();
  if (!trimmed) {
    return fallbackScraperDateSemantics('empty', warn);
  }
  // Prefer explicit DD/MM/YYYY before Date parsing to avoid locale-dependent MM/DD shifts.
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\b|$)/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (
      Number.isInteger(day) &&
      Number.isInteger(month) &&
      Number.isInteger(year) &&
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12
    ) {
      const ymdIso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        ymdIso,
        dayStart: startOfIsraelCivilDayInUtc(year, month, day),
        dayEnd: endOfIsraelCivilDayInUtc(year, month, day),
        dateForRow: startOfIsraelCivilDayInUtc(year, month, day),
      };
    }
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const { year, month, day } = getIsraelYmd(parsed);
    const ymdIso = formatIsraelYmdIso(parsed);
    return {
      ymdIso,
      dayStart: startOfIsraelCivilDayInUtc(year, month, day),
      dayEnd: endOfIsraelCivilDayInUtc(year, month, day),
      dateForRow: startOfIsraelCivilDayInUtc(year, month, day),
    };
  }
  const slice = trimmed.slice(0, 10);
  if (isStrictIsoDateOnly(slice)) {
    try {
      const { year, month, day } = parseIsoYmdParts(slice);
      return {
        ymdIso: slice,
        dayStart: startOfIsraelCivilDayInUtc(year, month, day),
        dayEnd: endOfIsraelCivilDayInUtc(year, month, day),
        dateForRow: startOfIsraelCivilDayInUtc(year, month, day),
      };
    } catch {
      /* fall through */
    }
  }
  return fallbackScraperDateSemantics(trimmed, warn);
}
