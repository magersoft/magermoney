import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapAccounts } from '../../scripts/import/accounts-mapper.js';

/** Synthetic rows in the sheet's column order; no real data. */
const HEADER =
  'Название банка,Страна,Сумма,Валюта,в USD,в EUR,Платежная система,Тип,Номер карты,Срок действия,BIN Type,Оплата,Снятие,Обслуживание,Лимиты,Именная,Привилегии,ApplePay,NFS,Переводы,СИМ,Паспорт,Подробности,Бонусы';
const CSV = [
  HEADER,
  'Demo Bank,🇷🇺 Россия,"1 234,56",RUB,$1,€1,Mir,Elite,************5520,07/27,DEBIT,0%,2%,$0,,Да,Нет,Нет,Есть,P2P,70000000000,РФ,"Multi\nline",',
  'Demo Bank Вклад,🇷🇺 Россия,"0,00",RUB,$0,€0,,Account,-,-,,,,,,,,,,,,,,',
  'Demo Broker,🇰🇿 Казахстан,"10,00",USD,$10,€9,,Investing,,,,,,,,,,,,,,,,',
  'Demo Exchange,🪙 Crypto,"0,33",ETH,$800,€700,,Investing,,,,,,,,,,,,,,,,',
  'Cash EUR,💰 Cash,"310,00",EUR,$359,€310,,Account,,,,,,,,,,,,,,,,',
  'Twin Bank,🇬🇪 Грузия,"0,00",USD,$0,€0,VISA,Platinum,************2236,08/28,DEBIT,,,,,,,,,,,,,',
  'Twin Bank,🇬🇪 Грузия,"5,00",USD,$5,€4,MasterCard,Digital,************9827,08/28,CREDIT,,,,,,,,,,,,,',
  'Demo Bank USD,🇷🇺 Россия,"100,00",USD,$100,€90,,Account,,,,,,,,,,,,,,,,',
  'Twin Acc,🇰🇿 Казахстан,"1,00",USD,$1,€1,,Account,,,,,,,,,,,,,,,,',
  'Twin Acc,🇰🇿 Казахстан,"2,00",USD,$2,€2,,Account,,,,,,,,,,,,,,,,',
  ',,,,$1 000,€900,,,,,,,,,,,,,,,,,,',
].join('\n');

describe('mapAccounts', () => {
  const rows = parseCsv(CSV);
  const result = mapAccounts(rows, { known: new Set(['RUB', 'USD', 'ETH', 'EUR']) });
  const accounts = result._unsafeUnwrap();

  it('maps every non-empty row and skips the totals row', () => {
    expect(accounts).toHaveLength(10);
  });
  it('maps a card with its fields and a markdown note', () => {
    const card = accounts[0]!;
    expect(card).toMatchObject({
      name: 'Demo Bank',
      bank: 'Demo Bank',
      country: 'RU',
      currency: 'RUB',
      kind: 'card',
      cardType: 'debit',
      cardNetwork: 'Mir',
      cardTier: 'Elite',
      cardLast4: '5520',
      cardExpires: '2027-07-31',
      balance: '1234.56',
      sortOrder: 0,
    });
    expect(card.note).toContain('- Снятие: 2%');
    expect(card.note).toContain('- Паспорт: РФ');
    expect(card.note).toContain('- Подробности: Multi\nline');
    expect(card.note).not.toContain('Лимиты');
  });
  it('recognises deposits, brokers, crypto coins and cash', () => {
    expect(accounts[1]).toMatchObject({
      kind: 'deposit',
      bank: 'Demo Bank',
      name: 'Demo Bank Вклад',
      note: null,
    });
    expect(accounts[2]).toMatchObject({ kind: 'broker', country: 'KZ' });
    expect(accounts[3]).toMatchObject({
      kind: 'crypto_wallet',
      country: 'XX',
      currency: 'ETH',
      balance: '0.33',
    });
    expect(accounts[4]).toMatchObject({ kind: 'cash', country: 'XX', bank: 'Cash EUR' });
  });
  it('disambiguates two accounts of one bank in one currency by tier and keeps the card type', () => {
    expect(accounts[5]!.name).toBe('Twin Bank · Platinum');
    expect(accounts[6]).toMatchObject({ name: 'Twin Bank · Digital', cardType: 'credit' });
  });
  it('groups a non-cash account under its provider by stripping a trailing currency code', () => {
    expect(accounts[7]).toMatchObject({
      name: 'Demo Bank USD',
      bank: 'Demo Bank',
      currency: 'USD',
      kind: 'bank_account',
    });
  });
  it('numbers still-duplicate names after the tier suffix, in row order', () => {
    expect(accounts[8]).toMatchObject({ name: 'Twin Acc · Account', currency: 'USD' });
    expect(accounts[9]).toMatchObject({ name: 'Twin Acc · Account 2', currency: 'USD' });
  });
  it('gives every mapped account a unique name', () => {
    expect(new Set(accounts.map((a) => a.name)).size).toBe(accounts.length);
  });
  it('fails on an unknown currency, naming it', () => {
    const r = mapAccounts(rows, { known: new Set(['RUB', 'USD', 'EUR']) });
    expect(r._unsafeUnwrapErr().message).toContain('ETH');
  });
  it('fails on an unknown country', () => {
    const r = mapAccounts(
      parseCsv(`${HEADER}\nX,🇫🇷 Франция,"1,00",EUR,,,,Account,,,,,,,,,,,,,,,,`),
      { known: new Set(['EUR']) },
    );
    expect(r._unsafeUnwrapErr().message).toContain('Франция');
  });
});
