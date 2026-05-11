import moment, { type Moment } from 'moment';
import { type Page } from 'puppeteer';
import { SHEKEL_CURRENCY } from '../constants';
import {
  clickButton,
  elementPresentOnPage,
  pageEvalAll,
  waitUntilElementDisappear,
  waitUntilElementFound,
} from '../helpers/elements-interactions';
import { waitForNavigation } from '../helpers/navigation';
import { getRawTransaction } from '../helpers/transactions';
import { TransactionStatuses, TransactionTypes, type Transaction, type TransactionsAccount } from '../transactions';
import { BaseScraperWithBrowser, LoginResults, type PossibleLoginResults } from './base-scraper-with-browser';
import { type ScraperOptions } from './interface';

const LOGIN_URL = 'https://login.yahav.co.il/login/';
const BASE_URL = 'https://digital.yahav.co.il/BaNCSDigitalUI/app/index.html#/';
const INVALID_DETAILS_SELECTOR = '.ui-dialog-buttons';
const CHANGE_PASSWORD_OLD_PASS = 'input#ef_req_parameter_old_credential';
const BASE_WELCOME_URL = `${BASE_URL}main/home`;

const ACCOUNT_ID_SELECTOR = 'span.portfolio-value[ng-if="mainController.data.portfolioList.length === 1"]';
const ACCOUNT_DETAILS_SELECTOR = '.account-details';
const DATE_FORMAT = 'DD/MM/YYYY';

const USER_ELEM = '#username';
const PASSWD_ELEM = '#password';
const NATIONALID_ELEM = '#pinno';
const SUBMIT_LOGIN_SELECTOR = '.btn';

interface ScrapedTransaction {
  credit: string;
  debit: string;
  date: string;
  reference?: string;
  description: string;
  memo: string;
  status: TransactionStatuses;
}

async function runYahavStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Yahav stage '${stage}' failed: ${message}`);
  }
}

function getPossibleLoginResults(page: Page): PossibleLoginResults {
  // checkout file `base-scraper-with-browser.ts` for available result types
  const urls: PossibleLoginResults = {};
  urls[LoginResults.Success] = [`${BASE_WELCOME_URL}`];
  urls[LoginResults.InvalidPassword] = [
    async () => {
      return elementPresentOnPage(page, `${INVALID_DETAILS_SELECTOR}`);
    },
  ];

  urls[LoginResults.ChangePassword] = [
    async () => {
      return elementPresentOnPage(page, `${CHANGE_PASSWORD_OLD_PASS}`);
    },
  ];

  return urls;
}

async function getAccountID(page: Page): Promise<string> {
  try {
    const selectedSnifAccount = await page.$eval(ACCOUNT_ID_SELECTOR, (element: Element) => {
      return element.textContent as string;
    });

    return selectedSnifAccount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to retrieve account ID. Possible outdated selector '${ACCOUNT_ID_SELECTOR}: ${errorMessage}`,
    );
  }
}

function getAmountData(amountStr: string) {
  const amountStrCopy = amountStr.replace(',', '');
  return parseFloat(amountStrCopy);
}

function getTxnAmount(txn: ScrapedTransaction) {
  const credit = getAmountData(txn.credit);
  const debit = getAmountData(txn.debit);
  return (Number.isNaN(credit) ? 0 : credit) - (Number.isNaN(debit) ? 0 : debit);
}

type TransactionsTr = { id: string; innerDivs: string[] };

function convertTransactions(txns: ScrapedTransaction[], options?: ScraperOptions): Transaction[] {
  const out: Transaction[] = [];
  for (const txn of txns) {
    const m = moment(txn.date, DATE_FORMAT, true);
    if (!m.isValid()) {
      if (process.env.YAHAV_DEBUG_DOM === '1') {
        // eslint-disable-next-line no-console
        console.error(`[Yahav DEBUG] skipping row: invalid date ${JSON.stringify(txn.date)}`);
      }
      continue;
    }
    const convertedDate = m.toISOString();
    const convertedAmount = getTxnAmount(txn);
    const ref = (txn.reference ?? '').trim();
    /** `referenceNumber` נכנס ל-hash לפני `identifier` (scraper.service) — מחרוזת מלאה נמנעת מאיבוד אסמכתא (למשל parseInt על "25-…"). */
    const result = {
      type: TransactionTypes.Normal,
      referenceNumber: ref || undefined,
      date: convertedDate,
      processedDate: convertedDate,
      originalAmount: convertedAmount,
      originalCurrency: SHEKEL_CURRENCY,
      chargedAmount: convertedAmount,
      status: txn.status,
      description: txn.description,
      memo: txn.memo,
    } as Transaction;

    if (options?.includeRawTransaction) {
      result.rawTransaction = getRawTransaction(txn);
    }

    out.push(result);
  }
  return out;
}

/** Yahav row cells sometimes repeat DD/MM/YYYY in nested divs — skip duplicates before mapping columns. */
const CELL_DATE_RE = /^\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/;

function digitDensity(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const digits = (t.match(/\d/g) || []).length;
  return digits / t.length;
}

/** Amount cells: digits with optional thousands commas and decimal part (Yahav statement table). */
function isLikelyAmountCell(s: string): boolean {
  const t = s.trim().replace(/\u200f|\u200e/g, '');
  if (!t || t === '—' || t === '-' || t === '–') return false;
  return /^-?[\d,]+(\.\d{1,2})?$/.test(t.replace(/\s/g, ''));
}

/**
 * Last two amount-like cells are debit then credit (legacy Yahav order).
 * Middle cells: reference vs description — prefer numeric-looking for אסמכתא.
 */
function mapMiddleToRefDesc(middle: string[]): { reference: string; description: string } {
  const regex = /\D+/gm;
  const cleaned = middle.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return { reference: '', description: '' };
  }
  if (cleaned.length === 1) {
    const only = cleaned[0];
    if (digitDensity(only) >= 0.55 && only.replace(/\D/g, '').length >= 4) {
      return { reference: only.replace(regex, ''), description: '' };
    }
    return { reference: '', description: only };
  }
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < cleaned.length; i++) {
    const sc = digitDensity(cleaned[i]);
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = i;
    }
  }
  const reference = cleaned[bestIdx].replace(regex, '');
  const description = cleaned.filter((_, i) => i !== bestIdx).join(' ').trim();
  return { reference, description };
}

function extractDebitCreditAndMiddle(cells: string[]): { middle: string[]; debit: string; credit: string } | null {
  if (cells.length < 2) return null;
  let end = cells.length - 1;
  while (end >= 0 && !isLikelyAmountCell(cells[end])) end--;
  if (end < 1) return null;
  let prev = end - 1;
  while (prev >= 0 && !isLikelyAmountCell(cells[prev])) prev--;
  if (prev < 0) return null;
  return {
    middle: cells.slice(0, prev),
    debit: cells[prev],
    credit: cells[end],
  };
}

function handleTransactionRow(txns: ScrapedTransaction[], txnRow: TransactionsTr) {
  const raw = txnRow.innerDivs.map((s) => s.trim()).filter((s) => s.length > 0);

  let i = 0;
  while (i < raw.length && !CELL_DATE_RE.test(raw[i])) i++;
  if (i >= raw.length) {
    if (process.env.YAHAV_DEBUG_DOM === '1') {
      // eslint-disable-next-line no-console
      console.error(`[Yahav DEBUG] row ${txnRow.id || '?'}: no DD/MM/YYYY cell among ${raw.length} fragments`);
    }
    return;
  }
  const date = raw[i].trim();
  i += 1;
  while (i < raw.length && CELL_DATE_RE.test(raw[i])) i += 1;

  const rest = raw.slice(i);
  const tail = extractDebitCreditAndMiddle(rest);
  if (!tail) {
    if (process.env.YAHAV_DEBUG_DOM === '1') {
      // eslint-disable-next-line no-console
      console.error(
        `[Yahav DEBUG] row ${txnRow.id || '?'}: could not find debit/credit amounts in ${JSON.stringify(rest)}`,
      );
    }
    return;
  }

  const { reference, description } = mapMiddleToRefDesc(tail.middle);

  const tx: ScrapedTransaction = {
    date,
    reference,
    memo: '',
    description,
    debit: tail.debit,
    credit: tail.credit,
    status: TransactionStatuses.Completed,
  };

  txns.push(tx);
}

async function getAccountTransactions(page: Page, options?: ScraperOptions): Promise<Transaction[]> {
  // Wait for transactions.
  await waitUntilElementFound(page, '.under-line-txn-table-header', true);

  const txns: ScrapedTransaction[] = [];
  const transactionsDivs = await pageEvalAll<TransactionsTr[]>(
    page,
    '.list-item-holder .entire-content-ctr',
    [],
    divs => {
      return (divs as HTMLElement[]).map(div => ({
        id: div.getAttribute('id') || '',
        innerDivs: Array.from(div.getElementsByTagName('div')).map(el => (el as HTMLElement).innerText),
      }));
    },
  );

  if (process.env.YAHAV_DEBUG_DOM === '1') {
    const statementHref = await page.evaluate(() => window.location.href).catch(() => '');
    // eslint-disable-next-line no-console
    console.error(
      `[Yahav DEBUG] transaction rows from DOM: ${transactionsDivs.length} container(s), href=${statementHref}`,
    );
  }

  for (const txnRow of transactionsDivs) {
    handleTransactionRow(txns, txnRow);
  }

  const converted = convertTransactions(txns, options);
  if (process.env.YAHAV_DEBUG_DOM === '1') {
    // eslint-disable-next-line no-console
    console.error(`[Yahav DEBUG] parsed scrap rows=${txns.length}, valid transactions=${converted.length}`);
  }

  return converted;
}

function getPageActionTimeoutMs(page: Page): number {
  try {
    const getter = (page as unknown as { getDefaultTimeout?: () => number }).getDefaultTimeout;
    const ms = getter?.call(page);
    if (typeof ms === 'number' && ms > 0) {
      return ms;
    }
  } catch {
    /* ignore */
  }
  return 30000;
}

const LOADING_SPINNER = '.loading-bar-spinner';

/** If the spinner is absent, `waitForSelector(..., { hidden: true })` can burn the full default timeout. */
async function waitYahavLoadingSpinnerGoneIfPresent(page: Page) {
  const timeoutMs = getPageActionTimeoutMs(page);
  if (await elementPresentOnPage(page, LOADING_SPINNER)) {
    await waitUntilElementDisappear(page, LOADING_SPINNER, timeoutMs);
  }
}

/**
 * Opens the "from" date control.
 * Waits for a date-picker in the statement area (DOM presence), scrolls it into view, then clicks.
 * Avoids `visible: true` on the compound selector — Yahav often keeps the control in DOM before Puppeteer
 * considers it "visible", which caused `Waiting for selector div.date-options-cell date-picker failed`.
 */
async function openYahavFromDatePicker(page: Page): Promise<'calendar' | 'input'> {
  const timeoutMs = getPageActionTimeoutMs(page);

  await waitYahavLoadingSpinnerGoneIfPresent(page);
  try {
    await page.waitForFunction(
      () => {
        return !!(
          document.querySelector('div.date-options-cell date-picker') ||
          document.querySelector('div.date-options-cell input') ||
          document.querySelector('div.date-options-cell [role="button"]') ||
          document.querySelector('.date-options-cell span')
        );
      },
      { timeout: timeoutMs },
    );
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const statement = document.querySelector('.statement-options');
      return {
        statementOptionsPresent: !!statement,
        dateOptionsCellCount: document.querySelectorAll('div.date-options-cell').length,
        datePickerCount: document.querySelectorAll('date-picker').length,
        dateInputCount: document.querySelectorAll('div.date-options-cell input, input[type="date"]').length,
        roleButtonCount: document.querySelectorAll('div.date-options-cell [role="button"]').length,
      };
    });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Yahav date trigger not found in DOM before timeout. diagnostics=${JSON.stringify(diagnostics)}. original=${message}`,
    );
  }

  const triggerSelectors = [
    'div.date-options-cell date-picker > div:nth-child(1) > span:nth-child(2)',
    'div.date-options-cell date-picker span:nth-child(2)',
    'div.date-options-cell date-picker',
    '.statement-options date-picker > div:nth-child(1) > span:nth-child(2)',
    '.statement-options date-picker span:nth-child(2)',
    '.statement-options date-picker',
    'div.date-options-cell input',
    'div.date-options-cell [role="button"]',
  ];

  const calendarSelector = '.pmu-days > div:nth-child(1)';
  const shortTimeout = Math.min(timeoutMs, 7000);
  for (const selector of triggerSelectors) {
    const clicked = await page.evaluate((s: string) => {
      const el = document.querySelector(s);
      if (!(el instanceof HTMLElement)) {
        return false;
      }
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      el.click();
      return true;
    }, selector);

    if (!clicked) {
      continue;
    }

    try {
      await waitUntilElementFound(page, calendarSelector, true, shortTimeout);
      return 'calendar';
    } catch {
      // Try next trigger in case this click did not open the calendar.
    }
  }

  const hasDateInput = await page.evaluate(() => {
    return !!document.querySelector(
      'div.date-options-cell input, .statement-options input[type="date"], .statement-options input',
    );
  });
  if (hasDateInput) {
    return 'input';
  }

  throw new Error(
    'Yahav: failed to open from-date picker. No known trigger opened calendar and no date input was found.',
  );
}

async function setYahavFromDateInput(page: Page, dateValue: string): Promise<boolean> {
  const selectors = [
    'div.date-options-cell input',
    '.statement-options input[type="date"]',
    '.statement-options input',
  ];

  for (const selector of selectors) {
    const changed = await page.evaluate(
      (s: string, value: string) => {
        const input = document.querySelector(s);
        if (!(input instanceof HTMLInputElement)) {
          return false;
        }
        input.scrollIntoView({ block: 'center', inline: 'nearest' });
        input.focus();
        input.value = '';
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      },
      selector,
      dateValue,
    );

    if (changed) {
      return true;
    }
  }

  return false;
}

// Manipulate the calendar drop down to choose the txs start date.
async function searchByDates(page: Page, startDate: Moment) {
  // Get the day number from startDate. 1-31 (usually 1)
  const startDateDay = startDate.format('D');
  const startDateMonth = startDate.format('M');
  const startDateYear = startDate.format('Y');

  const pickerMode = await runYahavStage('open from-date picker', () => openYahavFromDatePicker(page));
  if (pickerMode === 'input') {
    const formattedDate = startDate.format(DATE_FORMAT);
    const setInput = await runYahavStage('set from-date input', () => setYahavFromDateInput(page, formattedDate));
    if (!setInput) {
      throw new Error('Yahav: fallback input mode selected but failed to set from-date input.');
    }
    return;
  }

  // Open Months options.
  const monthFromPick = '.pmu-month';
  await runYahavStage('wait month picker', () => waitUntilElementFound(page, monthFromPick, true));
  await runYahavStage('open month options', () => clickButton(page, monthFromPick));
  await runYahavStage('wait month grid', () => waitUntilElementFound(page, '.pmu-months > div:nth-child(1)', true));

  // Open Year options.
  // Use same selector... Yahav knows why...
  await runYahavStage('wait month picker for year switch', () => waitUntilElementFound(page, monthFromPick, true));
  await runYahavStage('open year options', () => clickButton(page, monthFromPick));
  await runYahavStage('wait year grid', () => waitUntilElementFound(page, '.pmu-years > div:nth-child(1)', true));

  // Select year from a 12 year grid.
  for (let i = 1; i < 13; i += 1) {
    const selector = `.pmu-years > div:nth-child(${i})`;
    const year = await page.$eval(selector, y => {
      return (y as HTMLElement).innerText;
    });
    if (startDateYear === year) {
      await runYahavStage(`select year ${startDateYear}`, () => clickButton(page, selector));
      break;
    }
  }

  // Select Month.
  await runYahavStage('wait month grid before selecting month', () =>
    waitUntilElementFound(page, '.pmu-months > div:nth-child(1)', true),
  );
  // The first element (1) is January.
  const monthSelector = `.pmu-months > div:nth-child(${startDateMonth})`;
  await runYahavStage(`select month ${startDateMonth}`, () => clickButton(page, monthSelector));

  // Select Day.
  // The calendar grid shows 7 days and 6 weeks = 42 days.
  // In theory, the first day of the month will be in the first row.
  // Let's check everything just in case...
  for (let i = 1; i < 42; i += 1) {
    const selector = `.pmu-days > div:nth-child(${i})`;
    const day = await page.$eval(selector, d => {
      return (d as HTMLElement).innerText;
    });

    if (startDateDay === day) {
      await runYahavStage(`select day ${startDateDay}`, () => clickButton(page, selector));
      break;
    }
  }
}

async function fetchAccountData(
  page: Page,
  startDate: Moment,
  accountID: string,
  options?: ScraperOptions,
): Promise<TransactionsAccount> {
  await runYahavStage('pre-search spinner wait', () => waitYahavLoadingSpinnerGoneIfPresent(page));
  await runYahavStage('search by dates', () => searchByDates(page, startDate));
  await runYahavStage('post-search spinner wait', () => waitYahavLoadingSpinnerGoneIfPresent(page));
  const txns = await runYahavStage('fetch account transactions', () => getAccountTransactions(page, options));

  return {
    accountNumber: accountID,
    txns,
  };
}

async function fetchAccounts(page: Page, startDate: Moment, options?: ScraperOptions): Promise<TransactionsAccount[]> {
  const accounts: TransactionsAccount[] = [];

  // TODO: get more accounts. Not sure is supported.
  const accountID = await getAccountID(page);
  const accountData = await fetchAccountData(page, startDate, accountID, options);
  accounts.push(accountData);

  return accounts;
}

async function waitReadinessForAll(page: Page) {
  await waitUntilElementFound(page, `${USER_ELEM}`, true);
  await waitUntilElementFound(page, `${PASSWD_ELEM}`, true);
  await waitUntilElementFound(page, `${NATIONALID_ELEM}`, true);
  await waitUntilElementFound(page, `${SUBMIT_LOGIN_SELECTOR}`, true);
}

async function redirectOrDialog(page: Page) {
  // Click on bank messages if any.
  await waitForNavigation(page);
  await waitYahavLoadingSpinnerGoneIfPresent(page);
  const hasMessage = await elementPresentOnPage(page, '.messaging-links-container');
  if (hasMessage) {
    await clickButton(page, '.link-1');
  }

  const promise1 = page.waitForSelector(ACCOUNT_DETAILS_SELECTOR, { timeout: 30000 });
  const promise2 = page.waitForSelector(CHANGE_PASSWORD_OLD_PASS, { timeout: 30000 });
  const promises = [promise1, promise2];

  await Promise.race(promises);
  await waitYahavLoadingSpinnerGoneIfPresent(page);
}

type ScraperSpecificCredentials = { username: string; password: string; nationalID: string };

class YahavScraper extends BaseScraperWithBrowser<ScraperSpecificCredentials> {
  getLoginOptions(credentials: ScraperSpecificCredentials) {
    return {
      loginUrl: `${LOGIN_URL}`,
      fields: [
        { selector: `${USER_ELEM}`, value: credentials.username },
        { selector: `${PASSWD_ELEM}`, value: credentials.password },
        { selector: `${NATIONALID_ELEM}`, value: credentials.nationalID },
      ],
      submitButtonSelector: `${SUBMIT_LOGIN_SELECTOR}`,
      checkReadiness: async () => waitReadinessForAll(this.page),
      postAction: async () => redirectOrDialog(this.page),
      possibleResults: getPossibleLoginResults(this.page),
    };
  }

  async fetchData() {
    // Goto statements page
    await runYahavStage('wait account details card', () =>
      waitUntilElementFound(this.page, ACCOUNT_DETAILS_SELECTOR, true),
    );
    await runYahavStage('open account details', () => clickButton(this.page, ACCOUNT_DETAILS_SELECTOR));
    await runYahavStage('wait statement options', () =>
      waitUntilElementFound(this.page, '.statement-options .selected-item-top', true),
    );
    await runYahavStage('statement spinner wait', () => waitYahavLoadingSpinnerGoneIfPresent(this.page));

    const defaultStartMoment = moment().subtract(3, 'months').add(1, 'day');
    const startDate = this.options.startDate || defaultStartMoment.toDate();
    const startMoment = moment.max(defaultStartMoment, moment(startDate));

    const accounts = await runYahavStage('fetch accounts', () => fetchAccounts(this.page, startMoment, this.options));

    return {
      success: true,
      accounts,
    };
  }
}

export default YahavScraper;
