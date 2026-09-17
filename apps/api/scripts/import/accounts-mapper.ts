import { err, ok, type Result } from 'neverthrow';
import type { AccountKind, CardType } from '@magermoney/domain';
import type { NewAccount } from '../../src/modules/accounts/application/account-repository.js';
import { parseRuNumber } from './numbers.js';

export class ImportError extends Error {}
export type MappedAccount = NewAccount & { balance: string };

export const COUNTRY_BY_NAME: Record<string, string> = {
  Россия: 'RU',
  Португалия: 'PT',
  Узбекистан: 'UZ',
  Казахстан: 'KZ',
  Грузия: 'GE',
  Кыргызстан: 'KG',
  Индонезия: 'ID',
  Египет: 'EG',
  Турция: 'TR',
  Армения: 'AM',
  Сербия: 'RS',
  Таиланд: 'TH',
  Вьетнам: 'VN',
  ОАЭ: 'AE',
  Crypto: 'XX',
  Cash: 'XX',
};
const NOTE_COLUMNS = [
  'Оплата',
  'Снятие',
  'Обслуживание',
  'Лимиты',
  'Именная',
  'Привилегии',
  'ApplePay',
  'NFC',
  'NFS',
  'Переводы',
  'СИМ',
  'Паспорт',
  'Подробности',
  'Бонусы',
];
const TIERS = new Set(['Classic', 'Gold', 'Platinum', 'Elite', 'Digital']);
const NETWORKS: Record<string, string> = { VISA: 'Visa', MASTERCARD: 'MasterCard', MIR: 'Mir' };

const clean = (s: string | undefined) => (s ?? '').trim();
const blank = (s: string) => s === '' || s === '-' || s === '—';
/** Flags may arrive as mojibake; keep letters only and match the name. */
const countryName = (cell: string) => cell.replace(/[^A-Za-zА-Яа-яЁё ]/g, '').trim();

function kindOf(
  name: string,
  type: string,
  country: string,
  isCrypto: boolean,
): { kind: AccountKind; tier: string | null } {
  if (TIERS.has(type)) return { kind: 'card', tier: type };
  if (country === 'Cash') return { kind: 'cash', tier: null };
  if (/Вклад/i.test(name)) return { kind: 'deposit', tier: null };
  if (type === 'Investing') return { kind: isCrypto ? 'crypto_wallet' : 'broker', tier: null };
  if (country === 'Crypto') return { kind: 'crypto_wallet', tier: null };
  return { kind: 'bank_account', tier: null };
}

export function mapAccounts(
  rows: string[][],
  opts: { known: Set<string> },
): Result<MappedAccount[], ImportError> {
  const header = rows[0]?.map(clean) ?? [];
  const col = (name: string) => header.indexOf(name);
  const need = ['Название банка', 'Страна', 'Сумма', 'Валюта', 'Тип'].filter((n) => col(n) < 0);
  if (need.length > 0) return err(new ImportError(`Missing columns: ${need.join(', ')}`));

  const out: MappedAccount[] = [];
  for (const [i, raw] of rows.slice(1).entries()) {
    const cell = (name: string) => clean(raw[col(name)]);
    const name = cell('Название банка');
    if (name === '') continue; // totals row
    const rawCountry = countryName(cell('Страна'));
    const country = COUNTRY_BY_NAME[rawCountry];
    if (!country) return err(new ImportError(`Row ${i + 2}: unknown country "${rawCountry}"`));
    const currency = cell('Валюта');
    if (!opts.known.has(currency))
      return err(
        new ImportError(
          `Row ${i + 2}: unknown currency ${currency}; add it to the currencies table first`,
        ),
      );
    const balance = parseRuNumber(cell('Сумма'));
    if (balance === null)
      return err(new ImportError(`Row ${i + 2}: unreadable amount "${cell('Сумма')}"`));
    const { kind, tier } = kindOf(
      name,
      cell('Тип'),
      rawCountry,
      country === 'XX' && rawCountry === 'Crypto',
    );
    const isCard = kind === 'card';
    const bin = cell('BIN Type').toUpperCase();
    const expires = cell('Срок действия');
    const m = /^(\d{2})\/(\d{2})$/.exec(expires);
    const cardExpires = isCard && m ? lastDayOfMonth(2000 + Number(m[2]), Number(m[1])) : null;
    const last4 = cell('Номер карты').replace(/\D/g, '').slice(-4);
    const noteLines = NOTE_COLUMNS.filter((c) => col(c) >= 0 && !blank(cell(c))).map(
      (c) => `- ${c === 'NFS' ? 'NFC' : c}: ${cell(c)}`,
    );
    out.push({
      name,
      bank: name.replace(/\s+(Вклад|Инвест)$/i, ''),
      country,
      currency,
      kind,
      cardType: isCard
        ? ((bin === 'CREDIT' ? 'credit' : bin === 'DEBIT' ? 'debit' : null) as CardType | null)
        : null,
      isSpending: false,
      cardLast4: isCard && /^\d{4}$/.test(last4) ? last4 : null,
      cardNetwork: isCard
        ? (NETWORKS[cell('Платежная система').toUpperCase()] ?? (cell('Платежная система') || null))
        : null,
      cardTier: isCard ? tier : null,
      cardExpires,
      note: noteLines.length > 0 ? noteLines.join('\n') : null,
      sortOrder: out.length,
      balance,
    });
  }
  // Two accounts of one bank in one currency get a suffix so the list can tell them apart.
  const key = (a: MappedAccount) => `${a.name}|${a.currency}`;
  const counts = new Map<string, number>();
  for (const a of out) counts.set(key(a), (counts.get(key(a)) ?? 0) + 1);
  for (const a of out)
    if ((counts.get(key(a)) ?? 0) > 1)
      a.name = `${a.name} · ${a.cardTier ?? (a.kind === 'card' ? 'Card' : 'Account')}`;
  return ok(out);
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}
