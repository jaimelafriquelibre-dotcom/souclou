export function toCsvCell(value: string) {
  const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function toCsvRow(values: readonly string[]) {
  return values.map(toCsvCell).join(";");
}
