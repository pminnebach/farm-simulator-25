export const LOCALE = "nl-BE";

export function formatNumber(n: number, options?: Intl.NumberFormatOptions) {
  return n.toLocaleString(LOCALE, options);
}
