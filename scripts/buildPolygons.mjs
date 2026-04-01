#!/usr/bin/env node
/**
 * scripts/buildPolygons.mjs
 *
 * Generates:
 *   public/countryPolygons.json    — 10m resolution (used by Shape Guesser + distance calc)
 *   public/countryPolygons50m.json — 50m resolution (used by Globe Guesser, ~1/5 the size)
 *
 * Run once after `npm install`:
 *   node scripts/buildPolygons.mjs
 *
 * Both output files are committed to the repo so the app never fetches external data.
 * Re-run only if you need to update the underlying geographic data.
 */

import { feature } from 'topojson-client';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

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
// Centroid fallbacks [lat, lng] — used when a country is absent from the
// topology. Produces a small dot polygon (_dot: true), excluded from the
// answer pool but valid as a guess.
// ---------------------------------------------------------------------------

/** Fallbacks needed for 10m resolution data. */
const FALLBACKS_10m = {
  va: [41.9022,  12.4539],  // Vatican City  (~0.44 km²)
  mc: [43.7333,   7.4167],  // Monaco        (~2 km²)
  nr: [-0.5228, 166.9316],  // Nauru         (~21 km²)
  tv: [-8.5167, 179.2167],  // Tuvalu        (~26 km²)
  xk: [42.6026,  20.9030],  // Kosovo        (disputed, id=-99)
};

/**
 * Fallbacks for 50m resolution — a superset of 10m fallbacks.
 * Includes countries whose area is too small to appear in the 50m topology
 * (~< 1 000 km²).
 */
const FALLBACKS_50m = {
  ...FALLBACKS_10m,
  sm: [ 43.9424,  12.4578],  // San Marino      (~61 km²)
  li: [ 47.1660,   9.5554],  // Liechtenstein   (~160 km²)
  mh: [  7.1316, 171.1845],  // Marshall Islands (~181 km²)
  kn: [ 17.3578, -62.7830],  // St. Kitts & Nevis (~261 km²)
  gd: [ 12.1165, -61.6790],  // Grenada         (~344 km²)
  mt: [ 35.8997,  14.5147],  // Malta           (~316 km²)
  vc: [ 13.2528, -61.1971],  // St. Vincent     (~389 km²)
  bb: [ 13.1939, -59.5432],  // Barbados        (~430 km²)
  sc: [ -4.6796,  55.4920],  // Seychelles      (~452 km²)
  pw: [  7.5150, 134.5825],  // Palau           (~459 km²)
  lc: [ 13.9094, -60.9789],  // St. Lucia       (~616 km²)
  dm: [ 15.4150, -61.3710],  // Dominica        (~751 km²)
  to: [-21.1789,-175.1982],  // Tonga           (~747 km²)
  ag: [ 17.0608, -61.7964],  // Antigua & Barbuda (~440 km²)
  fm: [  6.8879, 158.2150],  // Micronesia      (~702 km²)
  st: [  0.1864,   6.6131],  // São Tomé        (~964 km²)
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

/** Build a small hexagonal polygon to represent a tiny/missing country. */
function makeDotPolygon(lat, lng) {
  const r = 0.3; // ~33 km visual radius
  const ring = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * 2 * Math.PI;
    ring.push([round4(lng + r * Math.cos(a)), round4(lat + r * Math.sin(a))]);
  }
  return { type: 'Polygon', coordinates: [ring], _dot: true };
}

// ---------------------------------------------------------------------------
// Core build function — works for any resolution topology + fallbacks map
// ---------------------------------------------------------------------------
function buildOutput(topology, fallbacks, label) {
  const fc = feature(topology, topology.objects.countries);

  const byNumeric = new Map();
  for (const f of fc.features) {
    if (f.id != null && f.geometry) {
      byNumeric.set(Number(f.id), f.geometry);
    }
  }
  console.log(`[${label}] Topology contains ${byNumeric.size} features.`);

  const output = {};
  let fullCount = 0;
  let dotCount = 0;
  const noData = [];

  for (const [alpha2, numericId] of Object.entries(ISO_MAP)) {
    const geom = byNumeric.get(numericId);
    if (geom) {
      output[alpha2] = roundGeom(geom);
      fullCount++;
    } else if (fallbacks[alpha2]) {
      const [lat, lng] = fallbacks[alpha2];
      output[alpha2] = makeDotPolygon(lat, lng);
      dotCount++;
      console.log(`  [${label}] Centroid dot: ${alpha2}`);
    } else {
      noData.push(`${alpha2}(${numericId})`);
      console.warn(`  [${label}] MISSING — no polygon and no fallback: ${alpha2} (numeric ${numericId})`);
    }
  }

  if (noData.length > 0) {
    console.warn(`\n[${label}] Still missing: ${noData.join(', ')}`);
    console.warn('Add an entry to the appropriate FALLBACKS with a [lat, lng] centroid.');
  }

  console.log(`[${label}] ${fullCount} full polygons + ${dotCount} centroid dots = ${fullCount + dotCount} total`);
  return output;
}

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------
const publicDir = resolve(__dirname, '../public');
mkdirSync(publicDir, { recursive: true });

// 10m — high resolution for Shape Guesser and distance calculations
const topology10m = require('world-atlas/countries-10m.json');
const output10m = buildOutput(topology10m, FALLBACKS_10m, '10m');
const path10m = resolve(publicDir, 'countryPolygons.json');
writeFileSync(path10m, JSON.stringify(output10m));
const size10m = Math.round(Buffer.byteLength(JSON.stringify(output10m)) / 1024);
console.log(`Written: ${path10m}  (${size10m} KB uncompressed)\n`);

// 50m — lighter resolution for Globe Guesser (~1/5 the size)
const topology50m = require('world-atlas/countries-50m.json');
const output50m = buildOutput(topology50m, FALLBACKS_50m, '50m');
const path50m = resolve(publicDir, 'countryPolygons50m.json');
writeFileSync(path50m, JSON.stringify(output50m));
const size50m = Math.round(Buffer.byteLength(JSON.stringify(output50m)) / 1024);
console.log(`Written: ${path50m}  (${size50m} KB uncompressed)`);
