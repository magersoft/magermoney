import { err, ok, type Result } from 'neverthrow';
import { ImportError } from './accounts-mapper.js';

export interface SheetBlock {
  /** Index of the header row inside `rows`. */
  headerRow: number;
  /** Trimmed header label → column index, first occurrence wins. */
  columns: ReadonlyMap<string, number>;
}

/**
 * The owner's sheets put several tables side by side, separated by an empty
 * column. A block is the table whose header row starts with `firstLabel` in
 * column A; it ends at the first empty header cell, so the neighbours to the
 * right (which repeat labels such as "USD") never leak in.
 */
export function findBlock(rows: string[][], firstLabel: string): Result<SheetBlock, ImportError> {
  const headerRow = rows.findIndex((r) => (r[0] ?? '').trim() === firstLabel);
  if (headerRow < 0) return err(new ImportError(`No header row starting with "${firstLabel}"`));
  const columns = new Map<string, number>();
  const header = rows[headerRow]!;
  for (let i = 0; i < header.length; i++) {
    const label = header[i]!.trim();
    if (label === '') break;
    if (!columns.has(label)) columns.set(label, i);
  }
  return ok({ headerRow, columns });
}

/** The cell under `label`, trimmed; '' when the block has no such column or the row is short. */
export const cellOf = (block: SheetBlock, row: string[], label: string): string => {
  const i = block.columns.get(label);
  return i === undefined ? '' : (row[i] ?? '').trim();
};
