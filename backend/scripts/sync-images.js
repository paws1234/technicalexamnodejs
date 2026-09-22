#!/usr/bin/env node
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { ensureImage, imageFilename, mentions, pickBest, searchTerms, sniffImageType } from '../src/images.js';
import { listPrices } from '../src/queries.js';
import { addProductImage, findVariantBySku, productMedia, waitForMedia } from '../src/shopify.js';
import { stores } from '../src/stores.js';

const SEARCH_PHRASES = {
  'SKU-002': 'paper notebook', // "notebook" alone is a laptop
  'SKU-005': 'coffee dripper',
  'SKU-007': 'drink coaster',
  'SKU-010': 'reading lamp', // "desk lamp" returned a blurry 29KB shot
};

function selfCheck() {
  assert.deepEqual(searchTerms('Aero Travel Mug'), ['Travel Mug', 'Mug'], 'brand adjective dropped');
  assert.deepEqual(searchTerms('Insulated Bottle 750ml'), ['Insulated Bottle', 'Bottle'], 'digits dropped');
  assert.deepEqual(searchTerms('Wool Felt Coasters (4-pack)'), ['Felt Coasters', 'Coasters'], 'parenthetical dropped');
  assert.deepEqual(searchTerms('Ceramic Pour-Over Set'), ['Ceramic Pour-Over', 'Pour-Over'], 'trailing "Set" dropped');
  assert.deepEqual(searchTerms('Apron'), ['Apron'], 'one word stays one term');

  assert.equal(mentions({ title: 'Sunset over the Chukchi Sea', tags: [] }, 'pour-over set'), false);
  assert.equal(mentions({ title: 'Iced pour-over coffee', tags: [] }, 'pour-over'), true);
  const lens = { title: 'Canon Zoom Lens EF 70-200mm f/4 L USM Travel Mug', tags: [{ name: 'canon' }, { name: 'lens' }] };
  assert.equal(mentions(lens, 'travel mug'), true, 'the title does mention it');
  assert.equal(mentions(lens, 'travel mug', { tagsOnly: true }), false, 'the tags do not');
  assert.equal(mentions({ title: '', tags: [{ name: 'pourover' }] }, 'pour over'), false, 'hyphenated tags are not loose matches');
  assert.equal(mentions({ title: '', tags: [{ name: 'pourover' }] }, 'pour-over'), true, 'a hyphenated term matches its squashed tag');
  assert.equal(mentions({ title: '', tags: [{ name: 'sock' }] }, 'socks'), true, 'a plural term matches its singular tag');

  const mug = { title: 'Travel mug', tags: [] };
  assert.equal(pickBest([lens, mug], 'travel mug'), mug, 'the photo titled "Travel mug" wins');
  const insulator = { title: 'old electric line insulators, bottle tree ranch', tags: [{ name: 'insulated' }, { name: 'bottle' }] };
  const flask = { title: 'HydroFlask Insulated Bottle', tags: [] };
  assert.equal(pickBest([insulator, flask], 'insulated bottle'), flask, 'a title match beats a tag-only one');
  assert.equal(pickBest([lens], 'insulated bottle'), null, 'no match is null, not a wrong photo');

  assert.equal(sniffImageType(Buffer.from('ffd8ffdb', 'hex')), 'image/jpeg');
  assert.equal(sniffImageType(Buffer.from('89504e470d0a1a0a0000000d', 'hex')), 'image/png');
  assert.equal(sniffImageType(Buffer.from('474946383961', 'hex')), 'image/gif');
  assert.equal(sniffImageType(Buffer.from('524946462400000057454250565038', 'hex')), 'image/webp');
  assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null, 'svg is not an image the store takes');
  assert.equal(imageFilename('Wool Felt Coasters (4-pack)', 'image/webp'), 'wool-felt-coasters-4-pack.webp');

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
    const filename = imageFilename(name, image.content_type);
    console.log(
      `${sku} ${JSON.stringify(name)} <- "${image.search_term}" ${(image.bytes.length / 1024).toFixed(0)}KB ` +
        `${image.license}${image.creator ? ` by ${image.creator}` : ''} sha256:${image.sha256.slice(0, 12)}`,
    );

    for (const store of stores) {
      const { productId } = await findVariantBySku(sku, store);
      const held = (await productMedia(store, productId)).find((node) => node.mediaContentType === 'IMAGE');
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
