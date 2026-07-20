// Fetches a URL and returns cleaned readable text.
// Uses native fetch (Node 18+) and cheerio to strip nav/scripts/boilerplate.
import * as cheerio from "cheerio";

export async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ClearCartResearch/0.1; academic research pipeline)",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const html = await res.text();

  const $ = cheerio.load(html);
  // Remove noise
  $("script, style, nav, header, footer, iframe, noscript, form").remove();

  const title = $("title").text().trim();
  // Prefer <article>/<main> if present, else body
  const root = $("article").length ? $("article") : $("main").length ? $("main") : $("body");
  const text = root
    .text()
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return { url, title, text: text.slice(0, 60000) }; // cap to stay within context budget
}
