// ponytail: keyless Openverse, 20 req/min and 200/day anonymously.
import { createHash } from 'node:crypto';
import { pool } from './db.js';

const SEARCH_ENDPOINT = 'https://api.openverse.org/v1/images/';
const PROVIDER = 'openverse';
const LICENSES = 'cc0,pdm,by,by-sa'; // commercial use + modification; excludes nd/nc
const USER_AGENT = 'price-sync-demo/1.0 (technical exam; contact: pawsmedz@gmail.com)';
const MIN_EDGE = 400;
const GENERIC = new Set(['set', 'kit', 'pack', 'bundle', 'piece', 'pieces']);
const NOT_A_PHOTO = new Set([
  'drawing', 'drawings', 'sketch', 'sketches', 'engraving', 'engravings', 'illustration',
  'illustrations', 'artwork', 'diagram', 'diagrams', 'map', 'maps', 'poster', 'painting',
  'vector', 'clipart', 'cartoon', 'logo', 'screenshot',
]);

export function sniffImageType(bytes) {
  const hex = bytes.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (hex.startsWith('474946383761') || hex.startsWith('474946383961')) return 'image/gif';
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp';
  return null;
}

export function imageFilename(name, contentType) {
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[contentType] ?? 'jpg';
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.${extension}`;
}

export function searchTerms(name) {
  const words = name.replace(/\(.*?\)/g, ' ').split(/\s+/).filter((word) => /^[a-z][a-z-]{2,}$/i.test(word));
  while (words.length > 1 && GENERIC.has(words.at(-1).toLowerCase())) words.pop();
  return [...new Set([words.slice(-2).join(' '), words.at(-1)])].filter(Boolean);
}

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

export function mentions(result, term, { tagsOnly = false } = {}) {
  const words = term.toLowerCase().split(' ');
  if (tagsOnly) return hasWords((result.tags ?? []).map((tag) => tag.name ?? tag).join(' '), words);
  return hasWords(
    `${result.title ?? ''} ${(result.tags ?? []).map((tag) => tag.name ?? tag).join(' ')}`,
    words,
  );
}

const mentionsTitle = (result, term) => hasWords(result.title ?? '', term.toLowerCase().split(' '));

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

const singularize = (term) => term.split(' ').map((word) => word.replace(/s$/, '')).join(' ');

export function pickBest(pool, term) {
  const byTitleThenLength = (left, right) =>
    Number(!mentionsTitle(left, term)) - Number(!mentionsTitle(right, term)) ||
    (left.title?.length ?? 0) - (right.title?.length ?? 0);
  return pool.filter((result) => mentions(result, term)).sort(byTitleThenLength)[0] ?? null;
}

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

export async function ensureImage(sku, name, phrase = null) {
  const { rows } = await pool.query('select * from product_images where sku = $1', [sku]);
  if (rows[0]) return rows[0];

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

  if (inserted[0]) return inserted[0];
  const { rows: existing } = await pool.query('select * from product_images where sku = $1', [sku]);
  return existing[0];
}
