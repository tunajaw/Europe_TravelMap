import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

export async function readCsv<T extends object>(filePath: string): Promise<T[]> {
  const source = await readFile(filePath, 'utf8');
  return parse(source, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: false,
  }) as T[];
}

export async function readNotionExportCsv<T extends object>(filePath: string): Promise<T[]> {
  const source = await readFile(filePath, 'utf8');
  const rows = parse(source, { bom: true, skip_empty_lines: true }) as string[][];
  const headers = rows[1];
  if (!headers) throw new Error(`Missing second-row headers: ${filePath}`);

  return rows.slice(2).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${rowIndex + 3} has ${values.length} fields; expected ${headers.length}`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])) as T;
  });
}
