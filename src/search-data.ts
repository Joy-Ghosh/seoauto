import { strFromU8, unzipSync } from "fflate";
export interface SearchRow { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }
export interface SearchBreakdown { dimension: string; value: string; clicks: number; impressions: number; ctr: number; position: number }
export interface SearchDataset { site: string; start: string; end: string; importedAt: string; source: "csv" | "google" | "zip"; rows: SearchRow[]; queryRows?: SearchRow[]; breakdowns?: Record<string, SearchBreakdown[]>; files?: string[]; warnings: string[] }
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

function parseBreakdownCsv(text: string, dimension: string): SearchBreakdown[] {
  const [headers, ...data] = csvRows(text); if (!headers) return [];
  const keys = headers.map(h => h.trim().toLowerCase());
  const column = (...names: string[]) => keys.findIndex(key => names.includes(key));
  const valueIndex = column(dimension, dimension.replaceAll("_", " "), "country", "device", "search appearance", "search_appearance");
  const clicks = column("clicks"), impressions = column("impressions"), ctr = column("ctr"), position = column("position", "average position");
  if ([valueIndex, clicks, impressions, ctr, position].some(index => index < 0)) return [];
  const number = (cells: string[], index: number) => Number((cells[index] || "").trim().replace(/,/g, "").replace(/%$/, ""));
  return data.slice(0, 5000).map(cells => {
    const rawCtr = number(cells, ctr); const shown = (cells[ctr] || "").includes("%");
    return { dimension, value: (cells[valueIndex] || "").trim(), clicks: number(cells, clicks), impressions: number(cells, impressions), ctr: rawCtr / (shown ? 100 : 1), position: number(cells, position) };
  }).filter(row => row.value && [row.clicks, row.impressions, row.ctr, row.position].every(Number.isFinite));
}

export async function parseSearchZip(file: Blob, site: string, start: string, end: string): Promise<SearchDataset> {
  if (file.size > 15_000_000) throw new Error("Use a Search Console ZIP smaller than 15 MB.");
  if (!validSearchDate(start) || !validSearchDate(end) || start > end) throw new Error("Choose a valid start and end date for this export.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const selected = new Set<string>(), reportNames = new Set<string>();
  let entries = 0, expandedBytes = 0;
  // First pass reads directory metadata only. Validate the entire archive before
  // allocating any decompressed output, including entries we will skip.
  unzipSync(bytes, { filter: entry => {
    if (++entries > 32) throw new Error("This ZIP contains too many entries. Export a single Search Console report bundle.");
    const name = entry.name;
    if (name.length > 500 || /[\\\u0000-\u001f]/.test(name) || name.startsWith("/") || /^[a-z]:/i.test(name) || name.split("/").some(part => part === "." || part === "..")) throw new Error("This ZIP contains an unsafe file path.");
    if (!Number.isSafeInteger(entry.originalSize) || entry.originalSize < 0 || entry.originalSize > 3_000_000) throw new Error("Each expanded ZIP entry must be smaller than 3 MB.");
    expandedBytes += entry.originalSize;
    if (expandedBytes > 12_000_000) throw new Error("The expanded ZIP exceeds the 12 MB limit.");
    if (name.endsWith("/")) return false;
    if (!name.toLowerCase().endsWith(".csv")) throw new Error("Only CSV reports are allowed in a Search Console ZIP.");
    const basename = name.split("/").pop()!.toLowerCase();
    if (["pages.csv", "queries.csv", "countries.csv", "devices.csv", "search appearance.csv", "search_appearance.csv"].includes(basename)) {
      const report = basename.replace("_", " ");
      if (reportNames.has(report)) throw new Error("This ZIP contains duplicate reports. Export a single report bundle.");
      reportNames.add(report); selected.add(name);
    }
    return false;
  } });
  const archive = unzipSync(bytes, { filter: entry => selected.has(entry.name) });
  const files = Object.keys(archive).filter(name => name.toLowerCase().endsWith(".csv"));
  if (!files.length) throw new Error("This ZIP does not contain any CSV reports.");
  let pages: SearchRow[] = [], queries: SearchRow[] = []; const breakdowns: Record<string, SearchBreakdown[]> = {}; const warnings: string[] = [];
  for (const name of files) {
    const lower = name.toLowerCase(); const text = strFromU8(archive[name]);
    try {
      if (lower.includes("pages")) pages = parseSearchCsv(text, site, start, end).rows;
      else if (lower.includes("queries")) queries = parseSearchCsv(text, site, start, end).rows;
      else if (lower.includes("countries")) breakdowns.country = parseBreakdownCsv(text, "country");
      else if (lower.includes("devices")) breakdowns.device = parseBreakdownCsv(text, "device");
      else if (lower.includes("search appearance") || lower.includes("search_appearance")) breakdowns.appearance = parseBreakdownCsv(text, "search appearance");
    } catch (error) { warnings.push(`${name}: ${(error as Error).message}`); }
  }
  if (!pages.length && !queries.length) throw new Error("The ZIP did not contain valid Pages.csv or Queries.csv data for this website.");
  return { site, start, end, importedAt: new Date().toISOString(), source: "zip", rows: pages.length ? pages : queries, queryRows: pages.length ? queries : undefined, breakdowns, files, warnings: ["ZIP provenance and dates are supplied by you; Google ownership was not checked.", "Separate exports do not establish query-to-page associations. Chart, Filters and unrecognized CSV reports are not loaded.", ...warnings, ...(pages.length && queries.length ? ["Pages and Queries are kept as separate dimensions; they are not added together."] : [])] };
}

export function searchDatasetLabels(dataset: SearchDataset) {
  const dimension = dataset.rows.every(row => Boolean(row.page) && Boolean(row.query)) ? "query/page" : dataset.rows.every(row => Boolean(row.page)) ? "page" : dataset.rows.every(row => Boolean(row.query)) ? "query" : "loaded";
  return { dimension, provenance: dataset.source === "google" ? "Google API snapshot" : "Imported evidence" };
}

export function searchSummary(rows: SearchRow[]) {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0), impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? rows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions : 0 };
}

export function searchOpportunities(dataset: SearchDataset) {
  const pageRows = dataset.rows.filter(row => row.page);
  const queryRows = (dataset.queryRows || dataset.rows).filter(row => row.query);
  return {
    lowCtrPages: pageRows.filter(row => row.impressions >= 100 && row.ctr < 0.02).sort((a, b) => b.impressions - a.impressions).slice(0, 5),
    nearPageOne: pageRows.filter(row => row.impressions >= 50 && row.position > 4 && row.position <= 20).sort((a, b) => a.position - b.position).slice(0, 5),
    queryGaps: queryRows.filter(row => row.impressions >= 50 && row.position > 10).sort((a, b) => b.impressions - a.impressions).slice(0, 5)
  };
}
