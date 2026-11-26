import type { Area, Site } from './types';
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i+1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('Unclosed quoted field in CSV.');
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function loadCSV(text: string, kind: 'areas'): Area[];
export function loadCSV(text: string, kind: 'sites'): Site[];
export function loadCSV(text: string, kind: 'areas'|'sites'): Area[] | Site[] {
  const [headers, ...rows] = parseCSV(text);
  const required = kind === 'areas' ? ['id','name','lat','lon','kg'] : ['id','name','lat','lon','radius','cost'];
  if (!headers || required.some(k => !headers.includes(k))) throw new Error(`Required columns: ${required.join(', ')}.`);
  if (!rows.length || rows.length > (kind === 'areas' ? 500 : 200)) throw new Error(`Provide 1–${kind === 'areas' ? 500 : 200} records.`);
  const ids = new Set<string>();
  return rows.map((row, index) => {
    if (row.length !== headers.length) throw new Error(`Row ${index+2}: column count does not match header.`);
    const record: Record<string, string|number> = {};
    for (const key of required) {
      const value = row[headers.indexOf(key)];
      if (!value) throw new Error(`Row ${index+2}: ${key} is empty.`);
      record[key] = ['id','name'].includes(key) ? value : Number(value);
      if (typeof record[key] === 'number' && !Number.isFinite(record[key])) throw new Error(`Row ${index+2}: ${key} must be a number.`);
    }
    if (ids.has(String(record.id))) throw new Error(`Duplicate ID: ${record.id}.`);
    ids.add(String(record.id));
    if (Math.abs(Number(record.lat)) > 90 || Math.abs(Number(record.lon)) > 180) throw new Error(`Row ${index+2}: invalid coordinates.`);
    if (kind === 'areas' ? Number(record.kg) < 0 : Number(record.radius) <= 0 || Number(record.cost) <= 0) throw new Error(`Row ${index+2}: quantities must be nonnegative; radius and cost must be positive.`);
    return record;
  }) as unknown as Area[] | Site[];
}
export function csv(rows: (string|number)[][]) { return rows.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n'); }
export function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
