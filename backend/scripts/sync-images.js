#!/usr/bin/env node
// Puts a product image on every SKU, in both stores, from the copy Supabase holds.
//
//   node backend/scripts/sync-images.js               # fetch what is missing, then sync both stores
//   node backend/scripts/sync-images.js --self-check  # offline: the search-term and matching logic
//
// Two properties make this re-runnable rather than once-only: an image is fetched once and then
// read from `product_images`, and a store already carrying the image (matched on the alt text,
// which is the product name) is left alone. So a second run is a verification pass — which is how
// "it synced" is checked, on a fresh read from each store rather than on this run's own output.
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { ensureImage, mentions, pickBest, searchTerms } from '../src/images.js';
import { listPrices } from '../src/queries.js';
import { addProductImage, findVariantBySku, productMedia, waitForMedia } from '../src/shopify.js';
import { stores } from '../src/stores.js';

// The image search the derived terms get wrong, because the keyless index holds no photograph of
// the object under those words: "Coasters" is roller coasters, "Field Notebook" is people writing
// in one, "Pour-Over" is iced coffee. This is the phrase a person would type instead. Every other
// product uses the derived terms, and the photo chosen under a phrase still has to mention it, so a
// phrase cannot smuggle in a wrong picture.
const SEARCH_PHRASES = {
  'SKU-002': 'paper notebook', // "notebook" alone is a laptop
  'SKU-005': 'coffee dripper',
  'SKU-007': 'drink coaster',
  'SKU-010': 'reading lamp', // "desk lamp" returned a blurry 29KB shot
};

// The pure half of the pipeline, asserted against the seed catalogue and the two bad matches this
// run actually produced. No network, no database.
function selfCheck() {
  assert.deepEqual(searchTerms('Aero Travel Mug'), ['Travel Mug', 'Mug'], 'brand adjective dropped');
  assert.deepEqual(searchTerms('Insulated Bottle 750ml'), ['Insulated Bottle', 'Bottle'], 'digits dropped');
  assert.deepEqual(searchTerms('Wool Felt Coasters (4-pack)'), ['Felt Coasters', 'Coasters'], 'parenthetical dropped');
  assert.deepEqual(searchTerms('Ceramic Pour-Over Set'), ['Ceramic Pour-Over', 'Pour-Over'], 'trailing "Set" dropped');
  assert.deepEqual(searchTerms('Apron'), ['Apron'], 'one word stays one term');

  // The satellite photo of Alaska that a "Pour-Over Set" search returned: "set" must not match
  // "Sunset", which is what whole-word matching is for.
  assert.equal(mentions({ title: 'Sunset over the Chukchi Sea', tags: [] }, 'pour-over set'), false);
  assert.equal(mentions({ title: 'Iced pour-over coffee', tags: [] }, 'pour-over'), true);
  // The lens photo titled "... Travel Mug": the title alone would pass, the photographer's tags
  // are what reject it. Tag-only matching is asked first for exactly this reason.
  const lens = { title: 'Canon Zoom Lens EF 70-200mm f/4 L USM Travel Mug', tags: [{ name: 'canon' }, { name: 'lens' }] };
  assert.equal(mentions(lens, 'travel mug'), true, 'the title does mention it');
  assert.equal(mentions(lens, 'travel mug', { tagsOnly: true }), false, 'the tags do not');
  assert.equal(mentions({ title: '', tags: [{ name: 'pourover' }] }, 'pour over'), false, 'hyphenated tags are not loose matches');
  assert.equal(mentions({ title: '', tags: [{ name: 'pourover' }] }, 'pour-over'), true, 'a hyphenated term matches its squashed tag');
  assert.equal(mentions({ title: '', tags: [{ name: 'sock' }] }, 'socks'), true, 'a plural term matches its singular tag');

  // Ranking: the shortest title that names the object wins over a longer one that merely mentions
  // it, and a title that names it beats a result whose tags alone do.
  const mug = { title: 'Travel mug', tags: [] };
  assert.equal(pickBest([lens, mug], 'travel mug'), mug, 'the photo titled "Travel mug" wins');
  const insulator = { title: 'old electric line insulators, bottle tree ranch', tags: [{ name: 'insulated' }, { name: 'bottle' }] };
  const flask = { title: 'HydroFlask Insulated Bottle', tags: [] };
  assert.equal(pickBest([insulator, flask], 'insulated bottle'), flask, 'a title match beats a tag-only one');
  assert.equal(pickBest([lens], 'insulated bottle'), null, 'no match is null, not a wrong photo');

  console.log('self-check ok: search terms + result matching');
}

if (process.argv.includes('--self-check')) {
  selfCheck();
  process.exit(0);
}

const rows = await listPrices();
const outcomes = [];
let failures = 0;

for (const { sku, name } of rows) {
  try {
    const image = await ensureImage(sku, name, SEARCH_PHRASES[sku] ?? null);
    // The extension follows the type the provider actually served: a WebP named `.jpg` is a lie
    // in the store's image URL, and the provider does mix formats (SKU-006 is WebP).
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[image.content_type] ?? 'jpg';
    // A filename that reads well: the file name survives into the store's image URL.
    const filename = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.${extension}`;
    console.log(
      `${sku} ${JSON.stringify(name)} <- "${image.search_term}" ${(image.bytes.length / 1024).toFixed(0)}KB ` +
        `${image.license}${image.creator ? ` by ${image.creator}` : ''} sha256:${image.sha256.slice(0, 12)}`,
    );

    for (const store of stores) {
      const { productId } = await findVariantBySku(sku, store);
      // Matched on the alt text, which is the product name. An image that is attached but still
      // processing is waited for rather than replaced — adding a second one would be a duplicate,
      // and the store is what decides when it is READY.
      const held = (await productMedia(store, productId)).find((node) => node.alt === name);
      if (held?.status === 'READY') {
        outcomes.push(`${sku} ${store.key}: already READY`);
        continue;
      }
      const node = held
        ? await waitForMedia(store, productId, held.id)
        : await addProductImage(store, productId, {
            filename,
            bytes: image.bytes,
            contentType: image.content_type,
            alt: name,
          });
      outcomes.push(`${sku} ${store.key}: ${held ? 'settled' : 'uploaded'} ${node.status} ${node.image?.width}x${node.image?.height}`);
    }
  } catch (error) {
    failures++;
    console.error(`${sku}: ${error.message}`);
  }
}

const {
  rows: [{ n }],
} = await pool.query('select count(*)::int as n from product_images');
for (const outcome of outcomes) console.log(outcome);

const pairs = rows.length * stores.length;
console.log(
  `\n${n} images in product_images for ${rows.length} SKUs; ` +
    `${outcomes.filter((outcome) => outcome.includes('READY')).length}/${pairs} store/SKU pairs now hold the image, ${failures} failed`,
);

await pool.end();
process.exit(failures > 0 ? 1 : 0);
