/**
 * Ambient types when the installed fork ships without full .d.ts in node_modules.
 */
declare module 'israeli-bank-scrapers' {
  export enum CompanyTypes {
    hapoalim = 'hapoalim',
    beinleumi = 'beinleumi',
    union = 'union',
    amex = 'amex',
    isracard = 'isracard',
    visaCal = 'visaCal',
    max = 'max',
    otsarHahayal = 'otsarHahayal',
    discount = 'discount',
    mercantile = 'mercantile',
    mizrahi = 'mizrahi',
    leumi = 'leumi',
    massad = 'massad',
    yahav = 'yahav',
    behatsdaa = 'behatsdaa',
    beyahadBishvilha = 'beyahadBishvilha',
    oneZero = 'oneZero',
    pagi = 'pagi',
  }

  export type ScraperCredentials = Record<string, unknown>;

  export type ScraperOptions = {
    companyId: CompanyTypes;
    startDate: Date;
    combineInstallments?: boolean;
    showBrowser?: boolean;
    verbose?: boolean;
    executablePath?: string;
    timeout?: number;
    [key: string]: unknown;
  };

  export interface ScraperScrapingResult {
    success: boolean;
    accounts?: Array<{
      accountNumber: string;
      balance?: number;
      txns?: Array<Record<string, unknown>>;
    }>;
    errorType?: string;
    errorMessage?: string;
  }

  export interface Scraper {
    scrape(credentials: ScraperCredentials): Promise<ScraperScrapingResult>;
  }

  export function createScraper(options: ScraperOptions): Scraper;

  export const SCRAPERS: Record<string, unknown>;
}
