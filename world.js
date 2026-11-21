'use strict';
/* ---------------- Blocks ---------------- */
const BLOCKS = [null];
const B = {};
function defB(key, col, pat, o) { const id = BLOCKS.length; BLOCKS.push(Object.assign({ key, col, pat }, o || {})); B[key] = id; return id; }
// pat: 0 plain,1 brick,2 planks,3 tile,4 marble,5 grass,6 glass,7 carpet,8 roof,9 metal,10 water,11 leaves,12 asphalt,13 neon,14 windows,15 stripes,16 railing,17 lamp,18 sand
defB('GRASS', [0.24, 0.42, 0.16], 5, { jit: 0.16 });
defB('GRASS_D', [0.16, 0.32, 0.12], 5, { jit: 0.16 });
defB('DIRT', [0.36, 0.25, 0.15], 0, { jit: 0.12 });
defB('MUD', [0.25, 0.18, 0.11], 0, { jit: 0.1 });
defB('SAND', [0.84, 0.76, 0.55], 18);
defB('STONE', [0.45, 0.46, 0.44], 0, { jit: 0.16 });
defB('MOSS', [0.28, 0.4, 0.22], 1, { jit: 0.2 });
defB('RUIN', [0.55, 0.52, 0.44], 1, { jit: 0.18 });
defB('RUIN_D', [0.33, 0.33, 0.3], 1, { jit: 0.16 });
defB('CLAY', [0.62, 0.36, 0.22], 0);
defB('LOG', [0.32, 0.22, 0.13], 0, { jit: 0.1 });
defB('LOG_P', [0.5, 0.4, 0.27], 0, { jit: 0.1 });
defB('BAMBOO', [0.55, 0.62, 0.25], 2, { jit: 0.1 });
defB('LEAVES', [0.16, 0.38, 0.14], 11, { cutout: 1, jit: 0.25 });
defB('LEAVES_D', [0.09, 0.25, 0.1], 11, { cutout: 1, jit: 0.25 });
defB('LEAVES_L', [0.3, 0.52, 0.18], 11, { cutout: 1, jit: 0.25 });
defB('PALM', [0.28, 0.5, 0.17], 11, { cutout: 1, jit: 0.2 });
defB('FERN', [0.22, 0.48, 0.16], 19, { cutout: 1, jit: 0.3, soft: 1, cross: 0.85 });
defB('VINE', [0.2, 0.38, 0.12], 19, { cutout: 1, jit: 0.3, soft: 1, cross: 1 });
defB('FLOWER', [0.85, 0.25, 0.3], 19, { cutout: 1, soft: 1, cross: 0.55, tip: 1 });
defB('FLOWER_Y', [0.95, 0.75, 0.2], 19, { cutout: 1, soft: 1, cross: 0.55, tip: 1 });
defB('BERRY', [0.5, 0.14, 0.3], 19, { cutout: 1, soft: 1, cross: 0.8, tip: 1 });
defB('WATER', [0.1, 0.3, 0.32], 10, { trans: 1, seeThrough: 1 });
defB('PLANK', [0.52, 0.38, 0.22], 2);
defB('PLANK_D', [0.34, 0.24, 0.14], 2);
defB('THATCH', [0.62, 0.52, 0.28], 8, { jit: 0.14 });
defB('WALL_LOG', [0.4, 0.28, 0.16], 2, { jit: 0.12 });
defB('WALL_STONE', [0.5, 0.5, 0.47], 1, { jit: 0.14 });
defB('STAKE', [0.45, 0.33, 0.2], 16, { cutout: 1, seeThrough: 1 });
defB('BONE', [0.86, 0.82, 0.7], 0);
defB('METAL', [0.5, 0.52, 0.55], 9);
defB('METAL_R', [0.45, 0.3, 0.2], 9, { jit: 0.25 });
defB('HULL', [0.82, 0.82, 0.8], 9);
defB('GLASS', [0.55, 0.7, 0.75], 6, { trans: 1, seeThrough: 1 });
defB('TARP', [0.25, 0.42, 0.55], 7);
defB('CANVAS', [0.6, 0.55, 0.42], 7);
defB('RED', [0.65, 0.12, 0.1], 0);
defB('ASH', [0.2, 0.19, 0.18], 12);
defB('LAMP', [1.0, 0.85, 0.55], 17, { jit: 0 });
defB('BEDROCK', [0.2, 0.2, 0.2], 0);
// compatibility with the shared engine code
B.POOLW = -1;

// zones (unused, kept for the shared world code)
const Z_PUBLIC = 0, Z_BLOCK = 9;

/* ---------------- World ---------------- */
class World {
  constructor(W, H, D) {
    this.W = W; this.H = H; this.D = D;
    this.b = new Uint8Array(W * H * D);
    this.cutF = new Uint8Array(W * H * D);
    this.zone = new Uint8Array(W * H * D);
    this.cutMode = 0;
  }
  idx(x, y, z) { return (y * this.D + z) * this.W + x; }
  in(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.W && y < this.H && z < this.D; }
  get(x, y, z) { if (y < 0) return B.BEDROCK; if (!this.in(x, y, z)) return 0; return this.b[this.idx(x, y, z)]; }
  set(x, y, z, t) { if (!this.in(x, y, z)) return; const i = this.idx(x, y, z); this.b[i] = t; this.cutF[i] = this.cutMode; }
  fill(x0, y0, z0, x1, y1, z1, t) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
    for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) this.set(x, y, z, t);
  }
  setZone(x0, y0, z0, x1, y1, z1, zn) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      if (this.in(x, y, z)) this.zone[this.idx(x, y, z)] = zn;
  }
  zoneAt(x, y, z) { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (!this.in(x, y, z)) return 0; return this.zone[this.idx(x, y, z)]; }
  solid(x, y, z) { const t = this.get(x, y, z); return t !== 0 && t !== B.WATER && !(BLOCKS[t] && BLOCKS[t].soft); }
  opaqueSight(x, y, z) { const t = this.get(x, y, z); return t !== 0 && !BLOCKS[t].seeThrough && !BLOCKS[t].cutout; }
  walkable(x, y, z) {
    if (!this.in(x, y, z)) return false;
    if (this.solid(x, y, z) || this.solid(x, y + 1, z) || !this.solid(x, y - 1, z)) return false;
    const up = this.get(x, y + 1, z); if (up === B.WATER) return false;
    const below = this.get(x, y - 1, z);
    if (BLOCKS[below] && BLOCKS[below].cutout && !BLOCKS[below].soft && below !== B.STAKE) return false; // can't stand on leaves
    if (BLOCKS[this.get(x, y, z)] && BLOCKS[this.get(x, y, z)].cutout && !BLOCKS[this.get(x, y, z)].soft) return false;
    return this.zoneAt(x, y, z) !== Z_BLOCK;
  }
  // find standable y at column near y
  groundAt(x, z, yHint) {
    for (let d = 0; d < 6; d++) { for (const y of [yHint - d, yHint + d]) if (this.walkable(x, y, z)) return y; }
    return -1;
  }
  // A* over voxel cells (x,y,z). returns array of [x,y,z]
  path(sx, sy, sz, gx, gy, gz, maxN, blocked) {
    maxN = maxN || 24000;
    const W = this.W, D = this.D;
    const key = (x, y, z) => (y * D + z) * W + x;
    if (!this.walkable(gx, gy, gz)) { const ny = this.groundAt(gx, gz, gy); if (ny < 0) return null; gy = ny; }
    if (!this.walkable(sx, sy, sz)) { const ny = this.groundAt(sx, sz, sy); if (ny >= 0) sy = ny; }
    const sk = key(sx, sy, sz), gk = key(gx, gy, gz);
    if (sk === gk) return [[gx, gy, gz]];
    const N = W * this.H * D;
    if (!this._g) { this._g = new Float32Array(N); this._came = new Int32Array(N); this._st = new Uint32Array(N); this._cl = new Uint32Array(N); this._stamp = 0; }
    const gA = this._g, came = this._came, st = this._st, cl = this._cl; const stamp = ++this._stamp;
    const open = new BinHeap();
    const h = (x, y, z) => { const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return Math.max(dx, dz) + 0.41 * Math.min(dx, dz) + Math.abs(y - gy) * 1.5; };
    gA[sk] = 0; st[sk] = stamp; came[sk] = -1; open.push(sk, h(sx, sy, sz));
    let n = 0, found = false;
    const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (open.size) {
      const cur = open.pop(); if (cur === gk) { found = true; break; }
      if (cl[cur] === stamp) continue; cl[cur] = stamp;
      if (++n > maxN) return null;
      const x = cur % W, z = Math.floor(cur / W) % D, y = Math.floor(cur / (W * D));
      const gc = gA[cur];
      for (let i = 0; i < 8; i++) {
        const dx = N8[i][0], dz = N8[i][1], nx = x + dx, nz = z + dz;
        const diag = dx && dz;
        for (let j = 0; j < 3; j++) {
          const dy = j === 0 ? 0 : j === 1 ? 1 : -1;
          const ny = y + dy;
          if (!this.walkable(nx, ny, nz)) continue;
          if (diag && (dy !== 0 || !this.walkable(x + dx, y, z) || !this.walkable(x, y, z + dz))) continue;
          if (dy === 1 && this.solid(x, y + 2, z)) continue;
          if (dy === -1 && this.solid(nx, y + 1, nz)) continue;
          const nk = key(nx, ny, nz); if (cl[nk] === stamp) break;
          if (blocked && blocked.has(nk)) break;
          const cost = gc + (diag ? 1.414 : 1) + (dy ? 0.6 : 0);
          if (st[nk] !== stamp || cost < gA[nk]) { st[nk] = stamp; gA[nk] = cost; came[nk] = cur; open.push(nk, cost + h(nx, ny, nz)); }
          break;
        }
      }
    }
    if (!found) return null;
    const out = []; let c = gk;
    while (c !== sk && c >= 0) { out.push([c % W, Math.floor(c / (W * D)), Math.floor(c / W) % D]); c = came[c]; }
    out.reverse();
    return out;
  }
  // line of sight between points (float)
  los(a, b) {
    const d = V3.sub(b, a), L = V3.len(d); if (L < 0.01) return true;
    const steps = Math.ceil(L * 3);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = Math.floor(a[0] + d[0] * t), y = Math.floor(a[1] + d[1] * t), z = Math.floor(a[2] + d[2] * t);
      if (this.opaqueSight(x, y, z)) return false;
    }
    return true;
  }
  // DDA voxel raycast for picking; skip cut blocks above cutY
  raycast(o, d, maxD, cutY) {
    let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
    const sx = Math.sign(d[0]), sy = Math.sign(d[1]), sz = Math.sign(d[2]);
    const tdx = Math.abs(1 / (d[0] || 1e-9)), tdy = Math.abs(1 / (d[1] || 1e-9)), tdz = Math.abs(1 / (d[2] || 1e-9));
    let tx = ((sx > 0 ? x + 1 - o[0] : o[0] - x)) * tdx, ty = ((sy > 0 ? y + 1 - o[1] : o[1] - y)) * tdy, tz = ((sz > 0 ? z + 1 - o[2] : o[2] - z)) * tdz;
    let face = [0, 0, 0], t = 0;
    for (let i = 0; i < 600 && t < maxD; i++) {
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; face = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; face = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; face = [0, 0, -sz]; }
      if (!this.in(x, y, z)) { if (y < 0) return null; continue; }
      const bt = this.b[this.idx(x, y, z)];
      if (!bt) continue;
      if (this.cutF[this.idx(x, y, z)] && y + (face[1] > 0 ? 1 : 0) > cutY + 0.02 && y > cutY - 0.5) continue;
      if (BLOCKS[bt].trans && bt !== B.WATER) continue;
      if (BLOCKS[bt].soft && !this.pickSoft) continue;
      return { x, y, z, face, t, type: bt };
    }
    return null;
  }
}

class BinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p; K.push(k); P.push(p); let i = K.length - 1;
    while (i > 0) { const pa = (i - 1) >> 1; if (P[pa] <= P[i]) break;[K[pa], K[i]] = [K[i], K[pa]];[P[pa], P[i]] = [P[i], P[pa]]; i = pa; }
  }
  pop() {
    const K = this.k, P = this.p; const top = K[0]; const lk = K.pop(), lp = P.pop();
    if (K.length) {
      K[0] = lk; P[0] = lp; let i = 0;
      for (; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < K.length && P[l] < P[m]) m = l; if (r < K.length && P[r] < P[m]) m = r; if (m === i) break;[K[m], K[i]] = [K[i], K[m]];[P[m], P[i]] = [P[i], P[m]]; i = m; }
    }
    return top;
  }
}

// seeded RNG
function RNG(seed) {
  let s = seed >>> 0 || 1;
  const f = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return f;
}
