export interface SearchRow { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }
export interface SearchDataset { site: string; start: string; end: string; importedAt: string; source: "csv" | "google"; rows: SearchRow[]; warnings: string[] }
export const siteHost = (url: string) => new URL(url).hostname.replace(/^www\./, "").toLowerCase();
export function validSearchDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }

export function csvRows(text: string): string[][] {
  if (text.length > 3_000_000) throw new Error("Use a CSV smaller than 3 MB.");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ""; }
    else cell += char;
    if (rows.length > 5001) throw new Error("Import up to 5,000 data rows at a time.");
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
export function parseSearchCsv(text: string, site: string, start: string, end: string): SearchDataset {
  if (!validSearchDate(start) || !validSearchDate(end) || start > end) throw new Error("Choose a valid start and end date for this export.");
  const [headers, ...data] = csvRows(text);
  if (!headers) throw new Error("The CSV is empty.");
  if (data.length > 5000) throw new Error("Import up to 5,000 data rows at a time.");
  const keys = headers.map(h => h.trim().toLowerCase());
  const column = (...names: string[]) => keys.findIndex(key => names.includes(key));
  const q = column("query", "top queries", "queries"), p = column("page", "top pages", "pages", "url");
  const clicks = column("clicks"), impressions = column("impressions"), ctr = column("ctr"), position = column("position", "average position");
  if ((q < 0 && p < 0) || [clicks, impressions, ctr, position].some(index => index < 0)) throw new Error("Use an English Search Console Pages or Queries CSV with Clicks, Impressions, CTR and Position columns. Combined Query + Page CSV is also supported.");
  const rows: SearchRow[] = []; let rejected = 0;
  for (const cells of data) {
    const num = (index: number) => { const value = (cells[index] || "").trim(); return value ? Number(value.replace(/,/g, "").replace(/%$/, "")) : NaN; };
    const row: SearchRow = { query: q >= 0 ? (cells[q] || "").trim() : "", page: p >= 0 ? (cells[p] || "").trim() : "", clicks: num(clicks), impressions: num(impressions), ctr: num(ctr) / ((cells[ctr] || "").includes("%") ? 100 : 1), position: num(position) };
    let valid = [row.clicks, row.impressions, row.ctr, row.position].every(Number.isFinite) && row.clicks >= 0 && row.impressions >= row.clicks && row.ctr >= 0 && row.ctr <= 1 && row.position >= 0;
    if (row.page) { try { const url = new URL(row.page); valid &&= ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && siteHost(row.page) === siteHost(site); } catch { valid = false; } }
    if (!row.page && !row.query) valid = false;
    if (valid) rows.push(row); else rejected++;
  }
  if (!rows.length) throw new Error("No valid rows matched this website. Check the selected site, export format and numeric columns.");
  return { site, start, end, importedAt: new Date().toISOString(), source: "csv", rows, warnings: ["CSV provenance and dates are supplied by you; Google ownership was not checked.", ...(rejected ? [`Skipped ${rejected} invalid or different-site rows.`] : []), ...(q < 0 || p < 0 ? ["This export contains one dimension. Page-to-query associations cannot be inferred from separate exports."] : [])] };
}

export function searchSummary(rows: SearchRow[]) {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0), impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? rows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions : 0 };
}
