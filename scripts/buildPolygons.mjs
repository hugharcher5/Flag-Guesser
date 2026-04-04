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
// High-detail polygon overrides
// Applied after topology extraction — replaces low-detail Natural Earth data
// for countries too small to be well-represented at 10m/50m resolution.
// Coordinates are [lng, lat], WGS84.
// ---------------------------------------------------------------------------
const POLYGON_OVERRIDES = {
  // Vatican City: Natural Earth rounds all 4 polygon vertices to the same longitude
  // (12.4543) at 4 d.p. precision, producing geoW=0 which renders as an empty SVG path.
  // Replaced with a simple rectangular approximation of Vatican's known extent.
  va: { type: 'Polygon', coordinates: [[[12.4513,41.9002],[12.4584,41.9002],[12.4584,41.9071],[12.4513,41.9071],[12.4513,41.9002]]] },
  // Kosovo: Natural Earth 10m contains Kosovo's polygon but with id=undefined,
  // which the extraction loop skips (it guards on f.id != null). Extracted
  // manually and stored here so rebuilds produce the correct polygon.
  // Without this override Kosovo falls back to a tiny centroid dot (_dot:true),
  // which causes it to be excluded from the answer pool and never highlights.
  xk: { type: 'Polygon', coordinates: [[[20.0648,42.5459],[20.0756,42.5595],[20.0792,42.573],[20.0756,42.5865],[20.0756,42.6034],[20.0792,42.6118],[20.09,42.627],[20.1044,42.6523],[20.1008,42.6574],[20.0936,42.6675],[20.036,42.7081],[20.0252,42.7233],[20.0252,42.7435],[20.036,42.752],[20.054,42.7638],[20.0648,42.7688],[20.0756,42.7739],[20.1116,42.7672],[20.1512,42.7503],[20.1836,42.7418],[20.2088,42.7638],[20.2088,42.7722],[20.2088,42.7824],[20.2088,42.7925],[20.216,42.8026],[20.2268,42.806],[20.2628,42.8178],[20.3456,42.8279],[20.4284,42.8415],[20.4752,42.855],[20.5004,42.8786],[20.4932,42.887],[20.4896,42.8989],[20.468,42.909],[20.45,42.9225],[20.4608,42.9495],[20.4752,42.9664],[20.4932,42.9698],[20.5112,42.9698],[20.5292,42.9748],[20.54,42.9799],[20.5436,42.9867],[20.5544,43.0019],[20.5616,43.0103],[20.5724,43.0086],[20.5832,43.0069],[20.5976,43.0069],[20.6156,43.0221],[20.6444,43.0525],[20.666,43.0846],[20.6696,43.1099],[20.6624,43.1167],[20.6516,43.1167],[20.6408,43.115],[20.6336,43.1167],[20.6264,43.1234],[20.6192,43.1336],[20.612,43.1555],[20.6012,43.1741],[20.5976,43.1842],[20.6048,43.1977],[20.612,43.2028],[20.6444,43.2028],[20.666,43.2096],[20.7452,43.2535],[20.7704,43.2602],[20.7956,43.2636],[20.81,43.2602],[20.8208,43.2568],[20.8388,43.245],[20.8496,43.2383],[20.8568,43.2315],[20.864,43.218],[20.8604,43.218],[20.8532,43.2197],[20.8388,43.2112],[20.8424,43.2062],[20.8388,43.1927],[20.8352,43.1792],[20.8316,43.1792],[20.8388,43.1707],[20.9108,43.1386],[20.9936,43.1049],[21.0044,43.0998],[21.026,43.093],[21.0908,43.0914],[21.1088,43.0812],[21.1232,43.0576],[21.1376,43.0052],[21.1484,42.9934],[21.1664,42.985],[21.1808,42.99],[21.1916,42.9985],[21.2096,42.9951],[21.224,42.9732],[21.2276,42.9428],[21.2312,42.9107],[21.26,42.887],[21.2708,42.8837],[21.296,42.8837],[21.3068,42.882],[21.3176,42.8769],[21.3356,42.8651],[21.3464,42.86],[21.3788,42.855],[21.4004,42.855],[21.4076,42.8465],[21.4076,42.8415],[21.4076,42.8212],[21.404,42.8043],[21.3896,42.7705],[21.386,42.7553],[21.3824,42.7503],[21.3788,42.7469],[21.3788,42.7435],[21.3896,42.7384],[21.404,42.7351],[21.4184,42.7351],[21.4436,42.7368],[21.5408,42.7266],[21.566,42.7199],[21.5804,42.7097],[21.6128,42.681],[21.6308,42.6726],[21.6452,42.6726],[21.6884,42.6861],[21.71,42.6878],[21.7388,42.6827],[21.746,42.6793],[21.764,42.6692],[21.7712,42.6473],[21.7676,42.6388],[21.7568,42.6338],[21.746,42.6304],[21.7352,42.6236],[21.7352,42.6219],[21.7316,42.6017],[21.728,42.5983],[21.728,42.5966],[21.7208,42.5932],[21.7172,42.5915],[21.7208,42.5865],[21.728,42.578],[21.728,42.5747],[21.7172,42.551],[21.6668,42.4902],[21.6272,42.4598],[21.62,42.4497],[21.6164,42.4345],[21.6236,42.4024],[21.6164,42.3872],[21.5984,42.372],[21.5372,42.3585],[21.5156,42.3416],[21.5156,42.318],[21.5552,42.2741],[21.5624,42.2471],[21.5192,42.2386],[21.4976,42.2386],[21.4832,42.2471],[21.4724,42.2386],[21.4688,42.2353],[21.458,42.2369],[21.4472,42.2437],[21.4364,42.2471],[21.4184,42.2403],[21.422,42.2319],[21.4292,42.2217],[21.4292,42.2167],[21.4184,42.215],[21.386,42.2251],[21.368,42.2234],[21.3608,42.2201],[21.3536,42.2167],[21.296,42.1491],[21.2924,42.1407],[21.296,42.1356],[21.2996,42.1289],[21.2996,42.1204],[21.2996,42.1002],[21.2996,42.0985],[21.2996,42.0917],[21.2888,42.09],[21.2456,42.0968],[21.2384,42.0968],[21.2276,42.1035],[21.224,42.1069],[21.2168,42.1204],[21.1988,42.1407],[21.1628,42.1677],[21.1268,42.1897],[21.1124,42.1947],[21.1052,42.1964],[21.098,42.1964],[21.0728,42.1846],[21.0404,42.1593],[21.0296,42.1508],[21.0044,42.1424],[20.9756,42.1339],[20.9036,42.1171],[20.81,42.0934],[20.7848,42.0816],[20.7668,42.0647],[20.756,42.0428],[20.7416,41.9938],[20.7416,41.9701],[20.7524,41.9398],[20.756,41.9313],[20.7524,41.911],[20.7488,41.906],[20.7416,41.8874],[20.7236,41.8671],[20.7128,41.8587],[20.702,41.8503],[20.6804,41.8435],[20.6732,41.8486],[20.6516,41.8688],[20.6444,41.8739],[20.6372,41.8705],[20.6264,41.8553],[20.6192,41.8503],[20.6012,41.8503],[20.5904,41.8553],[20.5688,41.8739],[20.5688,41.8807],[20.5616,41.8925],[20.5616,41.9009],[20.5688,41.9127],[20.5724,41.9178],[20.5796,41.9212],[20.5904,41.9296],[20.5976,41.9482],[20.5976,41.96],[20.594,41.9735],[20.5904,41.9938],[20.558,42.0546],[20.5508,42.0731],[20.5508,42.1052],[20.5508,42.1238],[20.54,42.1508],[20.5004,42.2116],[20.4824,42.2302],[20.4752,42.2369],[20.4572,42.2504],[20.3348,42.318],[20.3168,42.3197],[20.2484,42.318],[20.2376,42.3197],[20.2304,42.3264],[20.2196,42.3433],[20.2196,42.3501],[20.2196,42.3636],[20.2196,42.372],[20.2124,42.3771],[20.198,42.3872],[20.1944,42.394],[20.1944,42.4007],[20.2052,42.4126],[20.2052,42.4193],[20.198,42.4277],[20.1872,42.4379],[20.18,42.4429],[20.1512,42.4936],[20.1368,42.5088],[20.0864,42.5308],[20.0648,42.5459]]] },
  // Singapore: 120-point outline (OSM relation 536780, ODbL licence).
  // Natural Earth 10m only has 40 points, which looks very blocky.
  sg: { type: 'Polygon', coordinates: [[[103.5656,1.1957],[103.5667,1.1955],[103.5723,1.1987],[103.6607,1.1882],[103.6707,1.1794],[103.7407,1.1304],[103.805,1.1714],[103.8262,1.1809],[103.8598,1.196],[103.8808,1.2072],[103.9166,1.2219],[104.0256,1.2664],[104.0333,1.2695],[104.0379,1.273],[104.1184,1.2761],[104.1236,1.2735],[104.1258,1.2731],[104.129,1.2726],[104.0864,1.3469],[104.0814,1.3576],[104.0838,1.3686],[104.09,1.3846],[104.0932,1.394],[104.0937,1.3999],[104.0932,1.4061],[104.0915,1.4126],[104.0902,1.4157],[104.0892,1.4177],[104.0777,1.4313],[104.0714,1.4356],[104.0576,1.4402],[104.0407,1.4466],[104.0222,1.4422],[103.9999,1.4277],[103.995,1.4256],[103.9929,1.425],[103.9891,1.4249],[103.9862,1.4249],[103.9835,1.4247],[103.9799,1.4244],[103.9725,1.4225],[103.9668,1.4222],[103.9607,1.4244],[103.9576,1.4244],[103.9525,1.4254],[103.9425,1.4278],[103.9377,1.4305],[103.9334,1.4304],[103.9233,1.4283],[103.92,1.4274],[103.9168,1.4274],[103.9128,1.4275],[103.9021,1.4278],[103.8982,1.4284],[103.8861,1.4351],[103.8779,1.4454],[103.875,1.449],[103.8682,1.4565],[103.865,1.4589],[103.8587,1.4629],[103.8542,1.4651],[103.852,1.4662],[103.8342,1.473],[103.8222,1.4767],[103.8126,1.4788],[103.8036,1.4767],[103.7939,1.4681],[103.7902,1.4654],[103.7803,1.4597],[103.7709,1.4534],[103.7694,1.4527],[103.7693,1.4526],[103.7691,1.4526],[103.7691,1.4526],[103.769,1.4525],[103.7689,1.4525],[103.7604,1.4489],[103.7448,1.451],[103.7429,1.4522],[103.7401,1.4539],[103.7395,1.4546],[103.7389,1.4552],[103.7283,1.46],[103.7138,1.4579],[103.7034,1.4509],[103.697,1.4441],[103.6922,1.441],[103.6821,1.4374],[103.6729,1.4284],[103.6684,1.4161],[103.6633,1.4106],[103.6565,1.4005],[103.6535,1.3913],[103.652,1.3872],[103.6484,1.3801],[103.6462,1.374],[103.6397,1.3632],[103.6352,1.3553],[103.6333,1.3508],[103.6332,1.3508],[103.6332,1.3507],[103.6331,1.3505],[103.6296,1.3443],[103.6262,1.338],[103.6164,1.3216],[103.615,1.3179],[103.6146,1.3168],[103.6139,1.3146],[103.6135,1.3136],[103.6122,1.3091],[103.6111,1.3059],[103.6094,1.3008],[103.6068,1.293],[103.6046,1.2864],[103.6034,1.2831],[103.6033,1.2829],[103.6016,1.2804],[103.5857,1.2693],[103.5774,1.2636],[103.5656,1.1957]]] },
};

// ---------------------------------------------------------------------------
// Core build function — works for any resolution topology + fallbacks map
// ---------------------------------------------------------------------------
function buildOutput(topology, fallbacks, label) {
  const fc = feature(topology, topology.objects.countries);

  const byNumeric = new Map();
  for (const f of fc.features) {
    if (f.id != null && f.geometry) {
      const n = Number(f.id);
      const existing = byNumeric.get(n);
      if (!existing) {
        byNumeric.set(n, f.geometry);
      } else {
        // Multiple topology features share the same numeric id (e.g. Australia id=36
        // includes both the mainland MultiPolygon and the tiny Ashmore Islands Polygon).
        // Keep whichever has the most outer-ring vertices — that's the main territory.
        const existingPts = existing.type === 'Polygon'
          ? existing.coordinates[0].length
          : existing.coordinates[0][0].length;
        const newPts = f.geometry.type === 'Polygon'
          ? f.geometry.coordinates[0].length
          : f.geometry.coordinates[0][0].length;
        if (newPts > existingPts) byNumeric.set(n, f.geometry);
      }
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

  // Apply high-detail overrides (both resolutions get the same override).
  // Unconditionally set — overrides apply whether or not the topology had an entry,
  // so countries like Kosovo (id=undefined in topology, skipped by extraction loop)
  // still get a correct polygon.
  for (const [alpha2, geom] of Object.entries(POLYGON_OVERRIDES)) {
    output[alpha2] = geom;
    console.log(`  [${label}] Override applied: ${alpha2} (${geom.coordinates[0].length} pts)`);
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
