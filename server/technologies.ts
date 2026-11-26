import type { Page } from "../src/types.js";

/** Passive hints only. A CDN or hidden backend can prevent reliable identification. */
export function detectTechnologies(html: string, headers = new Headers()): NonNullable<Page["technologies"]> {
  const results: NonNullable<Page["technologies"]> = [];
  const add = (name: string, confidence: "strong" | "possible", evidence: string) => results.push({ name, confidence, evidence });
  if (/\/(wp-content|wp-includes)\//i.test(html) || /name=["']generator["'][^>]*wordpress/i.test(html)) add("WordPress", "strong", "WordPress asset path or generator marker in response HTML");
  if (/cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i.test(html)) add("Shopify", "strong", "Shopify asset or storefront marker in response HTML");
  if (/\/_next\/static\/|id=["']__NEXT_DATA__["']/i.test(html) || /next\.js/i.test(headers.get("x-powered-by") || "")) add("Next.js", "strong", "Next.js build assets, data marker or response header");
  if (/laravel_session/i.test(headers.get("set-cookie") || "")) add("Laravel", "strong", "Laravel session cookie name observed; cookie values are not retained");
  else if (/laravel/i.test(html.match(/<meta[^>]*name=["']generator["'][^>]*>/i)?.[0] || "")) add("Laravel", "possible", "Laravel generator hint");
  if (/php/i.test(headers.get("x-powered-by") || "")) add("PHP", "strong", "PHP identified by x-powered-by response header");
  else if (/href=["'][^"']+\.php(?:[?"'])/i.test(html)) add("PHP", "possible", "A linked .php route; this does not establish the backend language");
  if (/data-wf-page=|data-wf-site=/i.test(html)) add("Webflow", "strong", "Webflow document attributes");
  if (/static\.wixstatic\.com|wix-code/i.test(html)) add("Wix", "possible", "Wix asset marker");
  if (/id=["']__nuxt["']|\/_nuxt\//i.test(html)) add("Nuxt", "strong", "Nuxt build or root marker");
  if (/ng-version=["']/i.test(html)) add("Angular", "strong", "Angular version attribute");
  return results;
}
