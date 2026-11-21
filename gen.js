'use strict';
/* =========================================================
   UNDERGROWTH - island generation
   Dark jungle island: beach, dense canopy, river, lake,
   temple ruins, the Ostrand research station, two villages
   of the Painted, and the crash site where it all starts.
   ========================================================= */
const MW = 144, MH = 40, MD = 144, SEA = 7;

function hash2(x, z, s) { let h = (x * 374761393 + z * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, s, oct) { let t = 0, a = 1, f = 1, n = 0; for (let i = 0; i < (oct || 4); i++) { t += vnoise(x * f, z * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2; } return t / n; }

const POI = {
  crash: { x: 72, z: 122, r: 10, name: 'Crash Site' },
  camp: { x: 70, z: 108, r: 9, name: 'Your Camp' },
  station: { x: 112, z: 30, r: 13, name: 'Ostrand Station' },
  temple: { x: 66, z: 62, r: 12, name: 'Sunken Temple' },
  villageW: { x: 24, z: 70, r: 12, name: 'Painted Village' },
  villageN: { x: 56, z: 20, r: 11, name: 'Bone Village' },
  lake: { x: 34, z: 108, r: 9, name: 'Black Lake' },
  falls: { x: 104, z: 66, r: 6, name: 'River Falls' }
};

function genIsland(seed) {
  const w = new World(MW, MH, MD), rng = RNG(seed);
  const hm = new Float32Array(MW * MD);
  const at = (x, z) => hm[z * MW + x];
  // --- heightmap
  for (let z = 0; z < MD; z++) for (let x = 0; x < MW; x++) {
    const dx = (x - MW / 2) / (MW / 2), dz = (z - MD / 2) / (MD / 2);
    const wob = fbm(x * 0.05, z * 0.05, seed + 3, 3) * 0.35;
    const d = Math.sqrt(dx * dx + dz * dz) + wob - 0.12;
    const land = Math.max(0, Math.min(1, (0.92 - d) * 3.2));
    const hills = fbm(x * 0.035, z * 0.035, seed, 4);
    const ridge = Math.max(0, 1 - Math.abs(fbm(x * 0.02, z * 0.02, seed + 9, 3) - 0.5) * 4);
    let h = SEA - 4 + land * (5 + hills * 11 + ridge * 6);
    // north-east highland for the station
    const hx = (x - 108) / 40, hz = (z - 34) / 40; h += Math.max(0, 1 - Math.sqrt(hx * hx + hz * hz)) * 7 * land;
    hm[z * MW + x] = h;
  }
  const flatten = (p, h, r, soft) => {
    r = r || p.r; soft = soft || 6;
    for (let z = Math.max(0, p.z - r - soft); z < Math.min(MD, p.z + r + soft); z++) for (let x = Math.max(0, p.x - r - soft); x < Math.min(MW, p.x + r + soft); x++) {
      const d = Math.hypot(x - p.x, z - p.z); if (d > r + soft) continue;
      const k = d <= r ? 1 : 1 - (d - r) / soft, i = z * MW + x;
      hm[i] = hm[i] * (1 - k) + h * k;
    }
  };
  const hAt = p => Math.round(at(p.x, p.z));
  flatten(POI.crash, Math.max(SEA + 1, hAt(POI.crash)));
  flatten(POI.camp, Math.max(SEA + 2, hAt(POI.camp)));
  flatten(POI.station, Math.max(SEA + 10, hAt(POI.station)));
  flatten(POI.temple, Math.max(SEA + 4, hAt(POI.temple)));
  flatten(POI.villageW, Math.max(SEA + 3, hAt(POI.villageW)));
  flatten(POI.villageN, Math.max(SEA + 4, hAt(POI.villageN)));
  flatten(POI.lake, SEA - 3, POI.lake.r, 7);
  // --- voxelise terrain
  let topY = 0;
  const H = new Int16Array(MW * MD);
  for (let z = 0; z < MD; z++) for (let x = 0; x < MW; x++) {
    const h = Math.max(1, Math.min(MH - 12, Math.round(at(x, z)))); H[z * MW + x] = h;
    w.set(x, 0, z, B.BEDROCK);
    for (let y = 1; y < h - 3; y++) w.set(x, y, z, B.STONE);
    const beach = h <= SEA + 1, wet = h <= SEA - 1;
    for (let y = Math.max(1, h - 3); y < h; y++) w.set(x, y, z, beach || wet ? B.SAND : B.DIRT);
    let top = beach || wet ? B.SAND : fbm(x * 0.08, z * 0.08, seed + 5, 2) > 0.58 ? B.MUD : fbm(x * 0.1, z * 0.1, seed + 6, 2) > 0.5 ? B.GRASS_D : B.GRASS;
    if (h > SEA + 13 && fbm(x * 0.15, z * 0.15, seed + 8, 2) > 0.55) top = B.STONE;
    w.set(x, h, z, top);
    for (let y = h + 1; y <= SEA; y++) w.set(x, y, z, B.WATER);
    topY = Math.max(topY, h);
  }
  const ground = (x, z) => H[Math.max(0, Math.min(MD - 1, z)) * MW + Math.max(0, Math.min(MW - 1, x))];
  // --- river: from the highland down to the east coast, with little falls
  const river = [];
  {
    let x = 100, z = 44, y = ground(x, z);
    for (let i = 0; i < 220; i++) {
      river.push([Math.round(x), Math.round(z)]);
      const a = (fbm(i * 0.05, 3, seed + 21, 2) - 0.5) * 2.4 + 1.25;
      x += Math.sin(a) * 0.9 + 0.15; z += Math.cos(a) * 0.9 + 0.3;
      if (x < 2 || z < 2 || x >= MW - 2 || z >= MD - 2) break;
      if (ground(Math.round(x), Math.round(z)) <= SEA - 1) { river.push([Math.round(x), Math.round(z)]); break; }
    }
    let lvl = ground(river[0][0], river[0][1]) - 1;
    for (const [rx, rz] of river) {
      lvl = Math.max(SEA, Math.min(lvl, ground(rx, rz) - 1));
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const x2 = rx + dx, z2 = rz + dz; if (!w.in(x2, 1, z2)) continue;
        const d = Math.hypot(dx, dz); if (d > 2.3) continue;
        const g = ground(x2, z2), bed = d < 1.6 ? lvl - 1 : lvl;
        for (let y = bed + 1; y <= g + 2; y++) w.set(x2, y, z2, y <= lvl ? B.WATER : 0);
        w.set(x2, bed, z2, d < 1.6 ? B.SAND : B.MUD);
        H[z2 * MW + x2] = Math.min(g, d < 1.6 ? bed : lvl);
      }
    }
  }
  const M = { world: w, seed, trees: [], items: [], crates: [], pois: POI, river, structs: [], cages: [], pages: [], parts: [], totems: [], huts: [], spawn: null, camp: null, H, SEA };
  const gy = (x, z) => { const h = H[z * MW + x]; return h + 1; };
  // ground level: start at the terrain and climb past anything built on it (never onto the canopy)
  M.gy = (x, z) => { x = Math.max(0, Math.min(MW - 1, Math.floor(x))); z = Math.max(0, Math.min(MD - 1, Math.floor(z))); const y0 = H[z * MW + x] + 1; let y = y0; while (y < MH - 3 && y < y0 + 6 && (w.solid(x, y, z) || w.solid(x, y + 1, z))) y++; return y < y0 + 6 ? y : y0; };
  const clearAbove = (x0, z0, x1, z1, y) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) for (let yy = y; yy < y + 10; yy++) w.set(x, yy, z, 0); };
  const box = (x0, y0, z0, x1, y1, z1, t) => w.fill(x0, y0, z0, x1, y1, z1, t);

  // --- crash site: broken fuselage on the beach
  {
    const p = POI.crash, y = gy(p.x, p.z);
    clearAbove(p.x - 9, p.z - 6, p.x + 9, p.z + 6, y);
    for (let i = -7; i <= 4; i++) { const yy = y + (i > 1 ? 0 : 0); box(p.x + i, yy, p.z - 1, p.x + i, yy + 2, p.z + 1, B.HULL); box(p.x + i, yy + 1, p.z, p.x + i, yy + 1, p.z, 0); if (i < 3 && i > -6) w.set(p.x + i, yy + 2, p.z, 0); }
    for (let i = -6; i <= 3; i += 3) w.set(p.x + i, y + 1, p.z - 1, B.GLASS);
    box(p.x - 3, y, p.z + 2, p.x - 1, y, p.z + 7, B.HULL); box(p.x - 2, y, p.z + 6, p.x - 2, y, p.z + 6, B.METAL_R);
    box(p.x + 6, y, p.z - 3, p.x + 7, y + 1, p.z - 2, B.METAL_R);
    for (const [dx, dz] of [[-9, 3], [5, 4], [8, 1], [-5, -4], [2, -5]]) w.set(p.x + dx, gy(p.x + dx, p.z + dz), p.z + dz, rng() < 0.5 ? B.METAL_R : B.HULL);
    M.structs.push({ type: 'wreck', x: p.x, z: p.z });
    M.crates.push({ x: p.x - 2.5, y, z: p.z + 0.5, loot: ['bandage', 'bandage', 'flare', 'rope', 'canteen'], kind: 'case', name: 'Luggage' });
    M.crates.push({ x: p.x + 2.5, y, z: p.z + 0.5, loot: ['knife', 'cloth', 'cloth', 'snack'], kind: 'case', name: 'Luggage' });
    M.parts.push({ id: 'battery', x: p.x - 6.5, y: y + 0.2, z: p.z + 0.5, name: 'Radio Battery', hint: 'In the cockpit of the wreck' });
  }
  // --- your camp: clearing with the campfire
  {
    const p = POI.camp, y = gy(p.x, p.z);
    clearAbove(p.x - 8, p.z - 8, p.x + 8, p.z + 8, y);
    for (let z = p.z - 7; z <= p.z + 7; z++) for (let x = p.x - 7; x <= p.x + 7; x++) if (Math.hypot(x - p.x, z - p.z) < 7.5) { w.set(x, y - 1, z, Math.hypot(x - p.x, z - p.z) < 2.2 ? B.ASH : B.DIRT); }
    M.camp = { x: p.x + 0.5, y, z: p.z + 0.5 };
    M.spawn = [p.x + 0.5, y, p.z + 4.5];
    for (const [dx, dz] of [[-4, -3], [3, -4], [5, 2]]) M.items.push({ id: 'stick', x: p.x + dx + 0.5, y, z: p.z + dz + 0.5 });
    M.items.push({ id: 'stone', x: p.x - 2.5, y, z: p.z + 5.5 }, { id: 'stone', x: p.x + 4.5, y, z: p.z + 5.5 });
  }
  // --- Ostrand research station: huts on stilts and a radio mast
  {
    const p = POI.station, y = gy(p.x, p.z);
    clearAbove(p.x - 12, p.z - 12, p.x + 12, p.z + 12, y);
    const hut = (hx, hz, wdt, dep) => {
      for (const [sx, sz] of [[hx, hz], [hx + wdt, hz], [hx, hz + dep], [hx + wdt, hz + dep]]) box(sx, y, sz, sx, y + 1, sz, B.LOG);
      box(hx, y + 2, hz, hx + wdt, y + 2, hz + dep, B.PLANK);
      for (let x = hx; x <= hx + wdt; x++) { box(x, y + 3, hz, x, y + 5, hz, B.PLANK_D); box(x, y + 3, hz + dep, x, y + 5, hz + dep, B.PLANK_D); }
      for (let z = hz; z <= hz + dep; z++) { box(hx, y + 3, z, hx, y + 5, z, B.PLANK_D); box(hx + wdt, y + 3, z, hx + wdt, y + 5, z, B.PLANK_D); }
      box(hx + 1, y + 4, hz, hx + 1, y + 4, hz, B.GLASS); box(hx + wdt - 1, y + 4, hz + dep, hx + wdt - 1, y + 4, hz + dep, B.GLASS);
      const dz = hz + Math.floor(dep / 2); box(hx, y + 3, dz, hx, y + 4, dz, 0);
      box(hx - 1, y + 6, hz - 1, hx + wdt + 1, y + 6, hz + dep + 1, B.TARP);
      // steps
      w.set(hx - 1, y, dz, B.PLANK); w.set(hx - 1, y + 1, dz, B.PLANK); w.set(hx - 2, y, dz, B.PLANK);
      M.huts.push({ x: hx + wdt / 2, y: y + 3, z: hz + dep / 2 });
      return { x: hx + wdt / 2, y: y + 3, z: hz + dep / 2 };
    };
    const h1 = hut(p.x - 9, p.z - 6, 6, 5), h2 = hut(p.x + 2, p.z - 8, 5, 5), h3 = hut(p.x - 4, p.z + 3, 7, 5);
    // radio mast
    const mx = p.x + 6, mz = p.z + 5;
    for (let yy = y; yy < y + 16; yy++) { w.set(mx, yy, mz, B.METAL); if (yy % 3 === 0) { w.set(mx + 1, yy, mz, B.METAL); w.set(mx - 1, yy, mz, B.METAL); w.set(mx, yy, mz + 1, B.METAL); w.set(mx, yy, mz - 1, B.METAL); } }
    w.set(mx, y + 16, mz, B.LAMP);
    box(mx - 2, y, mz - 3, mx + 1, y + 2, mz - 3, B.METAL_R);
    M.radio = { x: mx - 0.5, y, z: mz - 2, name: 'Station Radio' };
    M.station = { x: p.x, y, z: p.z, mast: [mx, y + 16, mz] };
    M.pages.push({ n: 1, x: h1.x, y: h1.y, z: h1.z }, { n: 2, x: h2.x, y: h2.y, z: h2.z });
    M.crates.push({ x: h3.x, y: h3.y, z: h3.z, loot: ['medkit', 'antidote', 'cloth', 'rope', 'arrows'], kind: 'crate', name: 'Supply Crate' });
    M.cages.push({ id: 'jun', x: h3.x + 1.5, y: h3.y, z: h3.z + 1, hidden: true });
  }
  // --- sunken temple: a stepped ruin with a chamber
  {
    const p = POI.temple, y = gy(p.x, p.z);
    clearAbove(p.x - 12, p.z - 12, p.x + 12, p.z + 12, y);
    for (let s = 0; s < 5; s++) {
      const r = 8 - s * 1.5 | 0;
      for (let z = p.z - r; z <= p.z + r; z++) for (let x = p.x - r; x <= p.x + r; x++) {
        const edge = Math.abs(x - p.x) === r || Math.abs(z - p.z) === r;
        box(x, y + s * 2, z, x, y + s * 2 + 1, z, edge && hash2(x, z, s) < 0.4 ? B.MOSS : hash2(x, z, s + 9) < 0.12 ? B.RUIN_D : B.RUIN);
      }
    }
    // stairs up the south face
    for (let s = 0; s < 10; s++) box(p.x - 1, y + s, p.z + 9 - s, p.x + 1, y + s, p.z + 9 - s, B.RUIN_D);
    // inner chamber
    box(p.x - 3, y, p.z - 3, p.x + 3, y + 3, p.z + 3, 0);
    box(p.x - 1, y, p.z + 4, p.x + 1, y + 2, p.z + 8, 0);
    box(p.x - 4, y - 1, p.z - 4, p.x + 4, y - 1, p.z + 4, B.RUIN_D);
    w.set(p.x, y, p.z - 3, B.LAMP);
    M.parts.push({ id: 'valve', x: p.x + 0.5, y, z: p.z - 1.5, name: 'Radio Valve', hint: 'Deep inside the Sunken Temple' });
    M.pages.push({ n: 3, x: p.x - 1.5, y, z: p.z + 0.5 });
    M.cages.push({ id: 'ellis', x: p.x + 2.5, y, z: p.z + 1.5, cage: true });
    M.temple = { x: p.x, y, z: p.z };
    for (const [dx, dz] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { const yy = gy(p.x + dx, p.z + dz); box(p.x + dx, yy, p.z + dz, p.x + dx, yy + 4, p.z + dz, B.MOSS); w.set(p.x + dx, yy + 5, p.z + dz, B.RUIN); }
  }
  // --- villages of the Painted
  const village = (p, survivor, extraPart, page) => {
    const y = gy(p.x, p.z);
    clearAbove(p.x - 11, p.z - 11, p.x + 11, p.z + 11, y);
    for (let z = p.z - 10; z <= p.z + 10; z++) for (let x = p.x - 10; x <= p.x + 10; x++) if (Math.hypot(x - p.x, z - p.z) < 10.5) w.set(x, y - 1, z, B.MUD);
    // palisade of stakes with gaps
    for (let a = 0; a < Math.PI * 2; a += 0.06) {
      if (Math.sin(a * 3) > 0.86) continue;
      const x = Math.round(p.x + Math.cos(a) * 11), z = Math.round(p.z + Math.sin(a) * 11), yy = gy(x, z);
      box(x, yy, z, x, yy + 2, z, B.STAKE);
    }
    const hutAt = (hx, hz) => {
      const hy = gy(hx, hz);
      for (let a = 0; a < 16; a++) { const ang = a / 16 * Math.PI * 2; if (a === 4) continue; const x = Math.round(hx + Math.cos(ang) * 2.6), z = Math.round(hz + Math.sin(ang) * 2.6); box(x, hy, z, x, hy + 2, z, B.WALL_LOG); }
      for (let r = 3; r >= 0; r--) { const yy = hy + 3 + (3 - r); for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) if (Math.hypot(x, z) <= r + 0.4) w.set(hx + x, yy, hz + z, B.THATCH); }
      M.huts.push({ x: hx + 0.5, y: hy, z: hz + 0.5, painted: true });
      return { x: hx + 0.5, y: hy, z: hz + 0.5 };
    };
    const huts = [hutAt(p.x - 6, p.z - 4), hutAt(p.x + 5, p.z - 5), hutAt(p.x + 5, p.z + 5), hutAt(p.x - 5, p.z + 6)];
    // fire pit and totems
    for (let a = 0; a < 8; a++) w.set(p.x + Math.round(Math.cos(a / 8 * 6.28) * 1.5), y, p.z + Math.round(Math.sin(a / 8 * 6.28) * 1.5), B.STONE);
    for (const [dx, dz] of [[-2, -8], [3, -8], [-9, 1], [9, 0]]) { const yy = gy(p.x + dx, p.z + dz); box(p.x + dx, yy, p.z + dz, p.x + dx, yy + 3, p.z + dz, B.LOG); w.set(p.x + dx, yy + 4, p.z + dz, B.BONE); w.set(p.x + dx, yy + 2, p.z + dz, B.RED); M.totems.push({ x: p.x + dx, y: yy, z: p.z + dz }); }
    M.structs.push({ type: 'village', x: p.x, z: p.z, y, fire: { x: p.x + 0.5, y, z: p.z + 0.5 }, huts, name: p.name });
    M.cages.push({ id: survivor, x: p.x + 0.5, y, z: p.z + 6.5, cage: true });
    // cage of stakes around the survivor
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) box(p.x + dx, y, p.z + 6 + dz, p.x + dx, y + 2, p.z + 6 + dz, B.STAKE);
    box(p.x - 1, y + 3, p.z + 5, p.x + 1, y + 3, p.z + 7, B.THATCH);
    if (extraPart) M.parts.push(Object.assign({ x: huts[1].x, y: huts[1].y, z: huts[1].z }, extraPart));
    if (page) M.pages.push({ n: page, x: huts[0].x, y: huts[0].y, z: huts[0].z });
    M.crates.push({ x: huts[2].x, y: huts[2].y, z: huts[2].z, loot: ['bone', 'bone', 'meat_raw', 'rope', 'arrows'], kind: 'basket', name: 'Woven Basket' });
  };
  village(POI.villageW, 'mara', null, 4);
  village(POI.villageN, 'tomas', { id: 'antenna', name: 'Radio Antenna', hint: 'In the chief\'s hut of the Bone Village' }, 5);
  // a lost explorer's camp by the falls
  {
    const fp = river[Math.min(river.length - 1, 30)], x = fp[0] + 4, z = fp[1] + 1, y = M.gy(x, z);
    clearAbove(x - 2, z - 2, x + 2, z + 2, y);
    box(x - 1, y, z - 1, x + 1, y, z - 1, B.CANVAS); box(x - 1, y + 1, z, x + 1, y + 1, z, B.CANVAS); box(x - 1, y, z + 1, x + 1, y, z + 1, B.CANVAS);
    w.set(x, y, z + 3, B.BONE);
    M.pages.push({ n: 6, x: x + 0.5, y, z: z + 2.5 });
    M.crates.push({ x: x + 2.5, y, z: z + 0.5, loot: ['flare', 'canteen', 'antidote'], kind: 'case', name: 'Explorer\'s Pack' });
  }
  // --- vegetation
  const busy = (x, z, pad) => { for (const k in POI) { const p = POI[k]; if (k === 'lake' || k === 'falls') continue; if (Math.hypot(x - p.x, z - p.z) < p.r + (pad || 2)) return true; } return false; };
  const isWater = (x, z) => w.get(x, H[z * MW + x] + 1, z) === B.WATER || w.get(x, H[z * MW + x], z) === B.WATER;
  const treeAt = (x, z, kind) => {
    const y = gy(x, z); if (w.get(x, y - 1, z) === B.WATER || w.get(x, y, z)) return;
    const cells = [], put = (xx, yy, zz, t) => { if (!w.in(xx, yy, zz) || w.get(xx, yy, zz)) return; w.set(xx, yy, zz, t); cells.push(w.idx(xx, yy, zz)); };
    let logs = 2;
    if (kind === 'palm') {
      const h = rng.int(6, 9); let ox = 0, oz = 0; const lean = rng() * 6.28;
      for (let i = 0; i < h; i++) { if (i > 2 && i % 2) { ox += Math.cos(lean) * 0.5; oz += Math.sin(lean) * 0.5; } put(x + Math.round(ox), y + i, z + Math.round(oz), B.LOG_P); }
      const tx = x + Math.round(ox), tz = z + Math.round(oz), ty = y + h;
      put(tx, ty, tz, B.PALM);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { put(tx + dx, ty, tz + dz, B.PALM); put(tx + dx * 2, ty - 1, tz + dz * 2, B.PALM); if (Math.abs(dx) + Math.abs(dz) === 1) put(tx + dx * 3, ty - 2, tz + dz * 3, B.PALM); }
      logs = 2; M.trees.push({ x: x + 0.5, y, z: z + 0.5, kind, cells, logs, hp: 4, fruit: rng() < 0.6 ? 'coconut' : null, tx, ty, tz });
      return;
    }
    if (kind === 'bamboo') {
      const stalks = [];
      for (let i = 0; i < 5; i++) { const bx = x + rng.int(-1, 1), bz = z + rng.int(-1, 1), by = gy(bx, bz); if (w.get(bx, by - 1, bz) === B.WATER || w.get(bx, by, bz)) continue; const h = rng.int(5, 9); for (let k = 0; k < h; k++) put(bx, by + k, bz, B.BAMBOO); put(bx, by + h, bz, B.LEAVES_L); stalks.push([bx, by, bz, h]); }
      M.trees.push({ x: x + 0.5, y, z: z + 0.5, kind, cells, logs: 0, bamboo: 3, hp: 2, stalks }); return;
    }
    const big = kind === 'kapok', h = big ? rng.int(12, 16) : rng.int(6, 10), r = big ? rng.int(4, 6) : rng.int(2, 3);
    for (let i = 0; i < h; i++) { put(x, y + i, z, B.LOG); if (big) { put(x + 1, y + i, z, B.LOG); put(x, y + i, z + 1, B.LOG); put(x + 1, y + i, z + 1, B.LOG); } }
    if (big) for (const [dx, dz] of [[-1, 0], [2, 1], [0, -1], [1, 2]]) { put(x + dx, y, z + dz, B.LOG); put(x + dx, y + 1, z + dz, B.LOG); }
    const ly = y + h - (big ? 2 : 1), lt = rng() < 0.5 ? B.LEAVES : B.LEAVES_D;
    for (let yy = -1; yy <= (big ? 3 : 2); yy++) {
      const rr = r - Math.max(0, yy) * (big ? 0.8 : 0.9) + (yy < 0 ? -1 : 0);
      for (let dz = -Math.ceil(rr); dz <= Math.ceil(rr); dz++) for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx++) {
        const d = Math.hypot(dx, dz); if (d > rr + 0.3) continue;
        if (hash2(x + dx, z + dz, yy + 7) < 0.12) continue;
        put(x + dx, ly + yy, z + dz, hash2(x + dx * 3, z + dz, yy) < 0.2 ? B.LEAVES_L : lt);
      }
    }
    // hanging vines
    for (let k = 0; k < (big ? 6 : 2); k++) { const vx = x + rng.int(-r, r), vz = z + rng.int(-r, r), len = rng.int(2, big ? 7 : 4); for (let i = 1; i <= len; i++) put(vx, ly - 1 - i, vz, B.VINE); }
    logs = big ? 8 : h > 8 ? 4 : 3;
    M.trees.push({ x: x + (big ? 1 : 0.5), y, z: z + (big ? 1 : 0.5), kind, cells, logs, hp: big ? 12 : 6, vines: big ? 3 : 1, h, r, ly });
  };
  for (let z = 3; z < MD - 3; z++) for (let x = 3; x < MW - 3; x++) {
    const h = H[z * MW + x]; if (h <= SEA - 1 || isWater(x, z)) continue;
    const dens = fbm(x * 0.06, z * 0.06, seed + 30, 3), r = hash2(x, z, seed + 31);
    const beach = h <= SEA + 1;
    if (busy(x, z, 1)) { if (r < 0.04 && !busy(x, z, -2)) w.set(x, gy(x, z), z, B.FERN); continue; }
    if (beach) { if (r < 0.025) treeAt(x, z, 'palm'); continue; }
    if (r < 0.0042 * (0.5 + dens)) treeAt(x, z, 'kapok');
    else if (r < 0.028 + dens * 0.035) treeAt(x, z, rng() < 0.08 ? 'palm' : 'tree');
    else if (r < 0.034 + dens * 0.035) { if (dens > 0.45) treeAt(x, z, 'bamboo'); }
    else if (r < 0.11 + dens * 0.12) { const y = gy(x, z); if (!w.get(x, y, z)) w.set(x, y, z, hash2(x, z, 77) < 0.08 ? B.FLOWER : hash2(x, z, 78) < 0.05 ? B.FLOWER_Y : B.FERN); }
    else if (r < 0.116 + dens * 0.12) { const y = gy(x, z); if (!w.get(x, y, z)) { w.set(x, y, z, B.LEAVES_D); if (hash2(x, z, 79) < 0.2) w.set(x, y + 1, z, B.LEAVES); } }
    else if (r < 0.128 + dens * 0.12) { const y = gy(x, z); if (!w.get(x, y, z)) { w.set(x, y, z, B.BERRY); M.items.push({ id: 'bush', x: x + 0.5, y, z: z + 0.5, bush: true, cell: w.idx(x, y, z) }); } }
  }
  // scattered loose items
  let placed = 0;
  for (let i = 0; i < 2600 && placed < 260; i++) {
    const x = rng.int(4, MW - 5), z = rng.int(4, MD - 5); const h = H[z * MW + x]; if (h <= SEA || isWater(x, z)) continue;
    const y = M.gy(x, z); if (w.get(x, y, z) && !BLOCKS[w.get(x, y, z)].soft) continue;
    const r = rng(), id = r < 0.36 ? 'stick' : r < 0.6 ? 'stone' : r < 0.7 ? 'leaf' : r < 0.78 ? 'mushroom' : r < 0.84 ? 'mushroom_red' : r < 0.9 ? 'liana' : r < 0.95 ? 'herb' : 'banana';
    M.items.push({ id, x: x + 0.5, y, z: z + 0.5 }); placed++;
  }
  // coconuts under palms
  for (const t of M.trees) if (t.fruit) M.items.push({ id: t.fruit, x: t.x + rng.int(-1, 1) * 0.6, y: M.gy(t.x, t.z), z: t.z + rng.int(-1, 1) * 0.6 });
  w.topY = topY + 18;
  return M;
}
