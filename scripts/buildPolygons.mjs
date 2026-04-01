#!/usr/bin/env node
/**
 * scripts/buildPolygons.mjs
 *
 * Generates public/countryPolygons.json from Natural Earth 10m data
 * (bundled in the world-atlas npm package).
 *
 * Run once after `npm install`:
 *   node scripts/buildPolygons.mjs
 *
 * The output file is committed to the repo so the app never fetches external data.
 * Re-run only if you need to update the underlying geographic data.
 */

import { feature } from 'topojson-client';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load topology via require (works cross-package-manager: npm, Yarn, pnpm)
const topology = require('world-atlas/countries-10m.json');

// ---------------------------------------------------------------------------
// ISO 3166-1 alpha-2 → numeric mapping for all 196 countries in the app
// ---------------------------------------------------------------------------
const ISO_MAP = {
  af: 4,   al: 8,   dz: 12,  ad: 20,  ao: 24,  ag: 28,  ar: 32,  am: 51,
  au: 36,  at: 40,  az: 31,  bs: 44,  bh: 48,  bd: 50,  bb: 52,  by: 112,
  be: 56,  bz: 84,  bj: 204, bt: 64,  bo: 68,  ba: 70,  bw: 72,  br: 76,
  bn: 96,  bg: 100, bf: 854, bi: 108, kh: 116, cm: 120, ca: 124, cv: 132,
  cf: 140, td: 148, cl: 152, cn: 156, co: 170, km: 174, cg: 178, cd: 180,
  cr: 188, hr: 191, cu: 192, cy: 196, cz: 203, dk: 208, dj: 262, dm: 212,
  do: 214, ec: 218, eg: 818, sv: 222, gq: 226, er: 232, ee: 233, sz: 748,
  et: 231, fj: 242, fi: 246, fr: 250, ga: 266, gm: 270, ge: 268, de: 276,
  gh: 288, gr: 300, gd: 308, gt: 320, gn: 324, gw: 624, gy: 328, ht: 332,
  hn: 340, hu: 348, is: 352, in: 356, id: 360, ir: 364, iq: 368, ie: 372,
  il: 376, it: 380, ci: 384, jm: 388, jp: 392, jo: 400, kz: 398, ke: 404,
  ki: 296, xk: -99, kw: 414, kg: 417, la: 418, lv: 428, lb: 422, ls: 426,
  lr: 430, ly: 434, li: 438, lt: 440, lu: 442, mg: 450, mw: 454, my: 458,
  mv: 462, ml: 466, mt: 470, mh: 584, mr: 478, mu: 480, mx: 484, fm: 583,
  md: 498, mc: 492, mn: 496, me: 499, ma: 504, mz: 508, mm: 104, na: 516,
  nr: 520, np: 524, nl: 528, nz: 554, ni: 558, ne: 562, ng: 566, kp: 408,
  mk: 807, no: 578, om: 512, pk: 586, pw: 585, pa: 591, pg: 598, py: 600,
  pe: 604, ph: 608, pl: 616, pt: 620, qa: 634, ro: 642, ru: 643, rw: 646,
  kn: 659, lc: 662, vc: 670, ws: 882, sm: 674, st: 678, sa: 682, sn: 686,
  rs: 688, sc: 690, sl: 694, sg: 702, sk: 703, si: 705, sb: 90,  so: 706,
  za: 710, kr: 410, ss: 728, es: 724, lk: 144, sd: 729, sr: 740, se: 752,
  ch: 756, sy: 760, tw: 158, tj: 762, tz: 834, th: 764, tl: 626, tg: 768,
  to: 776, tt: 780, tn: 788, tr: 792, tm: 795, tv: 798, ug: 800, ua: 804,
  ae: 784, gb: 826, us: 840, uy: 858, uz: 860, vu: 548, va: 336, ve: 862,
  vn: 704, ye: 887, zm: 894, zw: 716,
};

// ---------------------------------------------------------------------------
// Centroid fallbacks [lat, lng] for nations too small for 10m resolution.
// These produce a small dot polygon — excluded from the answer pool but still
// valid as guesses (distance uses the centroid).
// ---------------------------------------------------------------------------
const FALLBACKS = {
  va: [41.9022,  12.4539],  // Vatican City  (~0.44 km²)
  mc: [43.7333,   7.4167],  // Monaco        (~2 km²)
  nr: [-0.5228, 166.9316],  // Nauru         (~21 km²)
  tv: [-8.5167, 179.2167],  // Tuvalu        (~26 km²)
  xk: [42.6026,  20.9030],  // Kosovo        (disputed, id=-99 in Natural Earth)
};

// Build a small hexagonal polygon to represent a tiny/missing country.
// Marked with _dot:true so the game excludes it from the answer pool.
function makeDotPolygon(lat, lng) {
  const r = 0.3; // ~33 km visual radius — visible in the SVG
  const ring = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * 2 * Math.PI;
    ring.push([round4(lng + r * Math.cos(a)), round4(lat + r * Math.sin(a))]);
  }
  return { type: 'Polygon', coordinates: [ring], _dot: true };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function roundRing(ring) {
  return ring.map(([lng, lat]) => [round4(lng), round4(lat)]);
}

function roundGeom(geom) {
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geom.coordinates.map(roundRing) };
  }
  return {
    type: 'MultiPolygon',
    coordinates: geom.coordinates.map(poly => poly.map(roundRing)),
  };
}

// ---------------------------------------------------------------------------
// Convert TopoJSON → GeoJSON and index by numeric ID
// ---------------------------------------------------------------------------
const fc = feature(topology, topology.objects.countries);

const byNumeric = new Map();
for (const f of fc.features) {
  if (f.id != null && f.geometry) {
    byNumeric.set(Number(f.id), f.geometry);
  }
}
console.log(`Topology contains ${byNumeric.size} features.`);

// ---------------------------------------------------------------------------
// Build output object keyed by alpha-2 code
// ---------------------------------------------------------------------------
const output = {};
let fullCount = 0;
let dotCount = 0;
const noData = [];

for (const [alpha2, numericId] of Object.entries(ISO_MAP)) {
  const geom = byNumeric.get(numericId);
  if (geom) {
    output[alpha2] = roundGeom(geom);
    fullCount++;
  } else if (FALLBACKS[alpha2]) {
    const [lat, lng] = FALLBACKS[alpha2];
    output[alpha2] = makeDotPolygon(lat, lng);
    dotCount++;
    console.log(`  Centroid dot: ${alpha2}`);
  } else {
    noData.push(`${alpha2}(${numericId})`);
    console.warn(`  MISSING — no polygon and no fallback: ${alpha2} (numeric ${numericId})`);
  }
}

if (noData.length > 0) {
  console.warn(`\nStill missing: ${noData.join(', ')}`);
  console.warn('Add an entry to FALLBACKS with a [lat, lng] centroid.');
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
const publicDir = resolve(__dirname, '../public');
mkdirSync(publicDir, { recursive: true });
const outPath = resolve(publicDir, 'countryPolygons.json');
writeFileSync(outPath, JSON.stringify(output));

const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(output)) / 1024);
console.log(`\nWritten: ${outPath}`);
console.log(`  ${fullCount} full polygons + ${dotCount} centroid dots = ${fullCount + dotCount} total`);
console.log(`  File size: ${sizeKb} KB (uncompressed)`);
