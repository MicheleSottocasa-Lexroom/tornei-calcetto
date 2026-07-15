/** Concatena classi condizionali senza dipendenze esterne. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
