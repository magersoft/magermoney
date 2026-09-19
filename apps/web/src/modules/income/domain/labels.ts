/** "10, 25" — empty for an irregular source, which the screen names in words instead. */
export const payDaysLabel = (days: readonly number[]): string =>
  [...days].sort((a, b) => a - b).join(', ');
