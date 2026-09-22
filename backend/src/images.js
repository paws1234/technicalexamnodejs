// Product images: searched by the product's own name from a free photo index, stored in Supabase.
//
// Openverse is keyless and exposes a licence filter, which is what makes publishing the result
// defensible: only licences allowing commercial use and modification are requested, and each row
// keeps the creator and the licence. The bytes are stored rather than the URL, because the sync has
// to hand Shopify a file and a re-run must not search again.
// ponytail: Openverse's anonymous limit is 20 req/min and 200/day (measured 2026-09-20), fine for a
// one-time fetch of ten SKUs. Upgrade: a registered client, or a longer-lived provider cache.
import { createHash } from 'node:crypto';
import { pool } from './db.js';

const SEARCH_ENDPOINT = 'https://api.openverse.org/v1/images/';
const PROVIDER = 'openverse';
const LICENSES = 'cc0,pdm,by,by-sa'; // commercial use + modification; excludes nd/nc
// Openverse asks for a descriptive User-Agent rather than a default one.
const USER_AGENT = 'price-sync-demo/1.0 (technical exam; contact: pawsmedz@gmail.com)';
// Below this on the shorter edge a result is a thumbnail crop or an icon, not a product photo.
const MIN_EDGE = 400;
// Trailing words that carry no image-search meaning: "Ceramic Pour-Over Set" has to search
// "pour-over", because "set" matches little but sunset, dataset and set theory.
const GENERIC = new Set(['set', 'kit', 'pack', 'bundle', 'piece', 'pieces']);
// A museum scan or a diagram can satisfy a word search while showing no product at all — the Met's
// engraving "Design Gothic Desk Tray" and NASA's labelled satellite maps both arrive that way, and
// they carry the tag that gives them away.
const NOT_A_PHOTO = new Set([
  'drawing', 'drawings', 'sketch', 'sketches', 'engraving', 'engravings', 'illustration',
  'illustrations', 'artwork', 'diagram', 'diagrams', 'map', 'maps', 'poster', 'painting',
  'vector', 'clipart', 'cartoon', 'logo', 'screenshot',
]);

// "Aero Travel Mug" -> ["Travel Mug", "Mug"]: the leading brand adjective is what makes an image
// search miss ("Aero" is a vacuum-insulated brand; photographs are titled with the noun phrase), so
// the last two words are searched first and the last one alone is the fallback. Parentheticals,
// digits and a trailing generic noun drop out with them.
export function searchTerms(name) {
  const words = name.replace(/\(.*?\)/g, ' ').split(/\s+/).filter((word) => /^[a-z][a-z-]{2,}$/i.test(word));
  while (words.length > 1 && GENERIC.has(words.at(-1).toLowerCase())) words.pop();
  return [...new Set([words.slice(-2).join(' '), words.at(-1)])].filter(Boolean);
}

// Whole words only: "set" must not match "Sunset", which is how a satellite photo of Alaska was
// once picked for a coffee set. A hyphenated word also matches the squashed form, so "pour-over"
// finds the tag "pourover".
function hasWords(text, words) {
  const lowered = text.toLowerCase();
  const tokens = new Set(lowered.replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean));
  const squashed = lowered.replace(/[^a-z0-9]+/g, '');
  return words.every(
    (word) =>
      tokens.has(word) ||
      tokens.has(word.replace(/s$/, '')) ||
      (word.includes('-') && squashed.includes(word.replace(/-/g, ''))),
  );
}

// The title and the photographer's tags together, or the tags alone. The two are worth keeping
// apart: a title can name something the photo does not show (Openverse's top hit for "travel mug"
// is titled "Canon Zoom Lens EF 70-200mm f/4 L USM Travel Mug" and photographs a lens), and tags
// can describe the scene rather than the subject ("please give me water" is tagged as an insulated
// bottle).
export function mentions(result, term, { tagsOnly = false } = {}) {
  const words = term.toLowerCase().split(' ');
  if (tagsOnly) return hasWords((result.tags ?? []).map((tag) => tag.name ?? tag).join(' '), words);
  return hasWords(
    `${result.title ?? ''} ${(result.tags ?? []).map((tag) => tag.name ?? tag).join(' ')}`,
    words,
  );
}

// A mention in the title alone — the stronger kind, since it names the object.
const mentionsTitle = (result, term) => hasWords(result.title ?? '', term.toLowerCase().split(' '));

// The results for one term with artwork and unusably small ones removed, so the caller only ever
// ranks results that could be a product image.
async function candidates(term) {
  const url = new URL(SEARCH_ENDPOINT);
  url.search = new URLSearchParams({ q: term, license: LICENSES, page_size: '20', mature: 'false' });

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`openverse search for "${term}" failed: HTTP ${response.status}`);
  }

  const { results = [] } = await response.json();
  const usable = results.filter(
    (result) => !(result.tags ?? []).some((tag) => NOT_A_PHOTO.has(String(tag.name ?? tag).toLowerCase())),
  );
  const large = usable.filter((result) => Math.min(result.width ?? 0, result.height ?? 0) >= MIN_EDGE);
  return large.length > 0 ? large : usable;
}

// Tags and titles use the singular ("Geometric Felt Coaster DIY"), and the plural term's own result
// list does not reliably contain that photo.
const singularize = (term) => term.split(' ').map((word) => word.replace(/s$/, '')).join(' ');

// Of the results that mention the term, the shortest title wins: a photo titled "Travel mug" is a
// travel mug, "Canon Zoom Lens EF … Travel Mug" is a lens. A title mention outranks a tag-only one,
// because tags may describe the scene rather than the subject; the provider's own order breaks ties
// and the sort is stable.
export function pickBest(pool, term) {
  const byTitleThenLength = (left, right) =>
    Number(!mentionsTitle(left, term)) - Number(!mentionsTitle(right, term)) ||
    (left.title?.length ?? 0) - (right.title?.length ?? 0);
  return pool.filter((result) => mentions(result, term)).sort(byTitleThenLength)[0] ?? null;
}

// The provider's own copy is the real photo (~1024px). The thumbnail is the safety net for a dead
// upstream link — the copyright holder's host is not ours to depend on, and a 600px JPEG beats
// failing the whole SKU.
async function download(primary, fallback) {
  for (const url of [primary, fallback].filter(Boolean)) {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const contentType = response.headers.get('content-type') ?? '';
    if (response.ok && contentType.startsWith('image/')) {
      return { bytes: Buffer.from(await response.arrayBuffer()), contentType, url };
    }
  }
  throw new Error(`image download failed for ${primary}`);
}

// One image per SKU, read from the database when it is already there, so re-running is free.
//
// `phrase` overrides the derived terms where the derivation gets them wrong (the index has no
// coaster under "Coasters" — only roller coasters — and "notebook" alone is a laptop). The chosen
// photo still has to mention the phrase it was found under, so a phrase cannot smuggle in an
// unrelated picture.
export async function ensureImage(sku, name, phrase = null) {
  const { rows } = await pool.query('select * from product_images where sku = $1', [sku]);
  if (rows[0]) return rows[0];

  // Each term and its singular, in order. The first term that matches anything wins, because a
  // later, weaker match is not an improvement.
  const terms = phrase
    ? [phrase, singularize(phrase)]
    : searchTerms(name).flatMap((candidate) => [candidate, singularize(candidate)]);

  let matched; // { result, term } — the best evidence found
  let weak; // { result, term } — the provider's own top result, if nothing matches at all
  let failure;
  for (const term of terms) {
    let pool;
    try {
      pool = await candidates(term);
    } catch (error) {
      failure = error; // a rate limit or a bad term — the next candidate may still answer
      continue;
    }
    weak ??= pool[0] && { result: pool[0], term };
    const result = pickBest(pool, term);
    if (result) {
      matched = { result, term };
      break;
    }
  }

  if (!matched) {
    if (!weak) {
      throw new Error(`no image for "${name}" (searched ${terms.join(', ')})${failure ? `: ${failure.message}` : ''}`);
    }
    // Nothing described the product: take what the provider ranked first and record its title in
    // the row, so the choice is visible and replaceable without repeating the search.
    console.warn(`${sku}: no confident image for "${name}" — taking the provider's top result "${weak.result.title ?? '?'}"`);
    matched = weak;
  }
  const { result: match, term } = matched;

  const file = await download(match.url, match.thumbnail);
  const sha256 = createHash('sha256').update(file.bytes).digest('hex');

  const { rows: inserted } = await pool.query(
    `insert into product_images
       (sku, provider, search_term, source_url, landing_url, source_title, license, creator, content_type, bytes, sha256)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (sku) do nothing
     returning *`,
    [
      sku,
      PROVIDER,
      term,
      file.url,
      match.foreign_landing_url ?? file.url,
      match.title ?? null,
      [match.license, match.license_version].filter(Boolean).join(' '),
      match.creator ?? null,
      file.contentType,
      file.bytes,
      sha256,
    ],
  );

  // `do nothing` means a concurrent run won the insert; its row is the one to use.
  if (inserted[0]) return inserted[0];
  const { rows: existing } = await pool.query('select * from product_images where sku = $1', [sku]);
  return existing[0];
}
