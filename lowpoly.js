'use strict';
/* =========================================================
   UNDERGROWTH - smooth terrain and low-poly vegetation
   Geometry is baked into the world chunks, so it costs nothing extra per frame.
   Vertex layout matches the engine: pos3 nrm3 col3 uv2 ao1 pat1
   ========================================================= */
const LowPoly = {
  TERRAIN: null,
  prepare(world, H) {
    // natural terrain height and a smooth corner grid shared by the mesher and gameplay
    const W = world.W, D = world.D;
    world.Hn = H;
    const isWaterCol = (x, z) => world.get(x, H[z * W + x] + 1, z) === B.WATER;
    const waterTop = (x, z) => { let y = H[z * W + x] + 1; while (world.get(x, y, z) === B.WATER) y++; return y; };
    const C = new Float32Array((W + 1) * (D + 1)), CC = new Float32Array((W + 1) * (D + 1) * 3);
    for (let j = 0; j <= D; j++) for (let i = 0; i <= W; i++) {
      let land = 0, nl = 0, wet = 0, wt = 0, bed = 0, nw = 0, r = 0, g = 0, b = 0;
      for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const x = Math.min(W - 1, Math.max(0, i + dx)), z = Math.min(D - 1, Math.max(0, j + dz)), h = H[z * W + x];
        const top = world.get(x, h, z), bd = BLOCKS[top] || BLOCKS[B.DIRT];
        r += bd.col[0]; g += bd.col[1]; b += bd.col[2];
        if (isWaterCol(x, z)) { wet++; wt = Math.max(wt, waterTop(x, z)); bed += h + 1; nw++; } else { land += h + 1; nl++; }
      }
      let hh;
      if (nl && nw) hh = Math.min(land / nl, wt - 0.12);
      else if (nl) hh = land / nl;
      else hh = bed / nw;
      C[j * (W + 1) + i] = hh;
      const k = (j * (W + 1) + i) * 3; CC[k] = r / 4; CC[k + 1] = g / 4; CC[k + 2] = b / 4;
    }
    world.corner = C; world.cornerCol = CC;
    // which voxels belong to trees (drawn as models instead of cubes)
    world.treeCell = new Uint8Array(world.b.length);
  },
  markTrees(world, trees) {
    trees.forEach((t, i) => { t.id = i; for (const c of t.cells) world.treeCell[c] = 1; });
    world.trees = trees;
  },
  surfH(world, x, z) {
    const W = world.W, D = world.D, C = world.corner;
    x = Math.max(0, Math.min(W - 0.001, x)); z = Math.max(0, Math.min(D - 0.001, z));
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, s = W + 1;
    const a = C[j * s + i], b = C[j * s + i + 1], c = C[(j + 1) * s + i], d = C[(j + 1) * s + i + 1];
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  },
  /* ---------- helpers that write into a chunk's vertex/index lists ---------- */
  // ref: a point inside the solid; the face is wound and lit to face away from it
  tri(o, a, b, c, col, pat, ref) {
    let n = V3.norm(V3.cross(V3.sub(b, a), V3.sub(c, a)));
    if (ref) { const m = [(a[0] + b[0] + c[0]) / 3 - ref[0], (a[1] + b[1] + c[1]) / 3 - ref[1], (a[2] + b[2] + c[2]) / 3 - ref[2]]; if (V3.dot(n, m) < 0) { const t = b; b = c; c = t; n = V3.scale(n, -1); } }
    const base = o.n;
    for (const p of [a, b, c]) o.v.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], p[0] + p[2], p[1], 1, pat);
    o.n += 3; o.i.push(base, base + 1, base + 2);
  },
  tri2(o, a, b, c, col, pat) { this.tri(o, a, b, c, col, pat, null); this.tri(o, a, c, b, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], pat, null); },
  // tapered cylinder between two points
  cyl(o, p0, p1, r0, r1, sides, col, pat, rng) {
    const ax = V3.norm(V3.sub(p1, p0)), up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = V3.norm(V3.cross(ax, up)), v = V3.cross(ax, u);
    const ring = (p, r, k) => { const pts = []; for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2 + k; const rr = r * (rng ? 0.9 + rng() * 0.2 : 1); pts.push(V3.add(p, V3.add(V3.scale(u, Math.cos(a) * rr), V3.scale(v, Math.sin(a) * rr)))); } return pts; };
    const A = ring(p0, r0, 0), Bv = ring(p1, r1, 0.2);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides, sh = 0.85 + (i % 2) * 0.12, c = [col[0] * sh, col[1] * sh, col[2] * sh];
      const mid = V3.scale(V3.add(p0, p1), 0.5); this.tri(o, A[i], A[j], Bv[j], c, pat, mid); this.tri(o, A[i], Bv[j], Bv[i], c, pat, mid);
    }
    for (let i = 1; i < sides - 1; i++) this.tri(o, Bv[0], Bv[i + 1], Bv[i], col, pat, p0);
  },
  ico: null,
  icosphere() {
    if (this.ico) return this.ico;
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(V3.norm);
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const mid = {}, m = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (mid[k] === undefined) { mid[k] = V.length; V.push(V3.norm(V3.scale(V3.add(V[a], V[b]), 0.5))); } return mid[k]; };
    const F2 = []; for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    this.ico = { V, F: F2 };
    return this.ico;
  },
  // faceted blob: a lumpy low-poly sphere
  blob(o, c, rx, ry, rz, col, pat, rng, jit) {
    const { V, F } = this.icosphere();
    const P = V.map(v => { const k = 1 + (rng() - 0.5) * (jit || 0.3); return [c[0] + v[0] * rx * k, c[1] + v[1] * ry * k, c[2] + v[2] * rz * k]; });
    for (const [a, b, d] of F) {
      const sh = 0.88 + rng() * 0.2, y = (V[a][1] + V[b][1] + V[d][1]) / 3, lift = 0.8 + 0.3 * (y * 0.5 + 0.5);
      this.tri(o, P[a], P[b], P[d], [col[0] * sh * lift, col[1] * sh * lift, col[2] * sh * lift], pat, c);
    }
  },
  rngFor(seed) { let s = (seed * 2654435761 >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s % 10000) / 10000; }; },
  /* ---------- terrain ---------- */
  terrain(world, X0, Z0, X1, Z1, o) {
    const W = world.W, s = W + 1, C = world.corner, CC = world.cornerCol;
    const h = (i, j) => C[Math.min(world.D, Math.max(0, j)) * s + Math.min(W, Math.max(0, i))];
    const base = o.n;
    for (let j = Z0; j <= Z1; j++) for (let i = X0; i <= X1; i++) {
      const y = h(i, j), nx = h(i - 1, j) - h(i + 1, j), nz = h(i, j - 1) - h(i, j + 1), n = V3.norm([nx, 2, nz]);
      const k = (j * s + i) * 3; let hs = ((i * 73856093) ^ (j * 83492791)) >>> 0; hs = (hs % 1000) / 1000;
      const jt = 0.93 + hs * 0.12, slope = Math.min(1, Math.hypot(nx, nz) * 0.6);
      // steep ground shows as earth
      const r = (CC[k] * (1 - slope) + 0.36 * slope) * jt, g = (CC[k + 1] * (1 - slope) + 0.28 * slope) * jt, b = (CC[k + 2] * (1 - slope) + 0.18 * slope) * jt;
      o.v.push(i, y, j, n[0], n[1], n[2], r, g, b, i, j, 0.85 + 0.15 * (1 - slope), 0);
    }
    const cw = X1 - X0 + 1;
    for (let j = 0; j < Z1 - Z0; j++) for (let i = 0; i < X1 - X0; i++) {
      const a = base + j * cw + i, b = a + 1, c = a + cw, d = c + 1;
      o.i.push(a, c, b, b, c, d);
    }
    o.n += cw * (Z1 - Z0 + 1);
    // decorative boulders on stony ground
    for (let z = Z0; z < Z1; z++) for (let x = X0; x < X1; x++) {
      const hgt = world.Hn[z * W + x], top = world.get(x, hgt, z);
      if (world.get(x, hgt + 1, z)) continue;
      let hs = ((x * 9176) ^ (z * 31337)) >>> 0; hs = (hs % 1000) / 1000;
      if ((top === B.STONE && hs < 0.12) || (top === B.SAND && hs < 0.012) || ((top === B.GRASS || top === B.GRASS_D) && hs < 0.006)) {
        const rng = this.rngFor(x * 977 + z * 131), r = 0.35 + rng() * 0.55, yy = this.surfH(world, x + 0.5, z + 0.5);
        this.blob(o, [x + 0.5, yy + r * 0.25, z + 0.5], r, r * 0.65, r * (0.8 + rng() * 0.4), [0.42, 0.42, 0.4], 0, rng, 0.45);
      }
    }
  },
  /* ---------- trees ---------- */
  tree(world, t, o) {
    const rng = this.rngFor(t.id * 7919 + 13), cut = 100;
    const by = Math.min(t.y, this.surfH(world, t.x, t.z)) - 0.4;
    if (t.kind === 'palm') {
      const top = [t.tx + 0.5, t.ty + 0.2, t.tz + 0.5], base = [t.x, by, t.z], segs = 7;
      let prev = base;
      for (let i = 1; i <= segs; i++) {
        const k = i / segs, p = [base[0] + (top[0] - base[0]) * k * k, base[1] + (top[1] - base[1]) * k, base[2] + (top[2] - base[2]) * k * k];
        const sh = i % 2 ? 1 : 0.85;
        this.cyl(o, prev, p, 0.26 - k * 0.08, 0.24 - k * 0.08, 6, [0.5 * sh, 0.4 * sh, 0.26 * sh], cut);
        prev = p;
      }
      const fr = 9;
      for (let f = 0; f < fr; f++) {
        const a = f / fr * Math.PI * 2 + rng() * 0.4, L = 2.6 + rng() * 0.9, dir = [Math.cos(a), 0, Math.sin(a)], side = [-dir[2], 0, dir[0]];
        const droop = 1.0 + rng() * 0.8, steps = 6;
        let pl = null, pr = null;
        for (let s = 0; s <= steps; s++) {
          const d = s / steps, w = Math.sin(Math.PI * Math.min(1, d * 1.15)) * 0.42 + 0.02;
          const c = [top[0] + dir[0] * d * L, top[1] + Math.sin(d * Math.PI * 0.6) * 0.5 - d * d * droop, top[2] + dir[2] * d * L];
          const l = V3.add(c, V3.scale(side, w)), r = V3.add(c, V3.scale(side, -w)), cl = [0.2 + d * 0.12, 0.42 + d * 0.1, 0.12];
          if (pl) { this.tri2(o, pl, l, r, cl, cut); this.tri2(o, pl, r, pr, cl, cut); }
          pl = l; pr = r;
        }
      }
      if (t.fruit) for (let k = 0; k < 3; k++) { const a = k * 2.1; this.blob(o, [top[0] + Math.cos(a) * 0.3, top[1] - 0.35, top[2] + Math.sin(a) * 0.3], 0.18, 0.2, 0.18, [0.4, 0.3, 0.12], cut, rng, 0.1); }
      return;
    }
    if (t.kind === 'bamboo') {
      for (const [x, y, z, h] of t.stalks || []) {
        const b0 = [x + 0.5, Math.min(y, this.surfH(world, x + 0.5, z + 0.5)) - 0.3, z + 0.5];
        let p = b0;
        for (let s = 0; s < h; s += 1.5) {
          const q = [b0[0] + Math.sin(s * 0.3) * 0.05, y + Math.min(h, s + 1.5), b0[2]];
          this.cyl(o, p, q, 0.11, 0.1, 5, [0.52, 0.6, 0.24], cut);
          this.cyl(o, [q[0], q[1] - 0.05, q[2]], [q[0], q[1] + 0.05, q[2]], 0.13, 0.13, 5, [0.42, 0.48, 0.18], cut);
          p = q;
        }
        for (let k = 0; k < 6; k++) {
          const a = rng() * 6.28, yy = y + h - rng() * 2.5, c = [p[0], yy, p[2]], tip = [p[0] + Math.cos(a) * 1.0, yy - 0.3, p[2] + Math.sin(a) * 1.0], sd = [-Math.sin(a) * 0.14, 0, Math.cos(a) * 0.14];
          this.tri2(o, c, V3.add(V3.scale(V3.add(c, tip), 0.5), sd), tip, [0.35, 0.55, 0.2], cut);
          this.tri2(o, c, tip, V3.sub(V3.scale(V3.add(c, tip), 0.5), sd), [0.3, 0.5, 0.18], cut);
        }
      }
      return;
    }
    const big = t.kind === 'kapok', h = t.h || 8, r = t.r || 3, ly = t.ly || (t.y + h - 1);
    const bark = big ? [0.42, 0.34, 0.24] : [0.36, 0.26, 0.16];
    this.cyl(o, [t.x, by, t.z], [t.x, ly + 0.5, t.z], big ? 1.0 : 0.34, big ? 0.6 : 0.2, big ? 9 : 7, bark, cut, rng);
    if (big) for (let k = 0; k < 5; k++) { // buttress roots
      const a = k / 5 * Math.PI * 2 + rng(), d = [Math.cos(a), 0, Math.sin(a)], s = [-d[2] * 0.12, 0, d[0] * 0.12];
      const p0 = [t.x + d[0] * 0.6, by + 3.2, t.z + d[2] * 0.6], p1 = [t.x + d[0] * 2.4, by + 0.3, t.z + d[2] * 2.4], p2 = [t.x + d[0] * 0.6, by + 0.3, t.z + d[2] * 0.6];
      this.tri2(o, V3.add(p0, s), V3.add(p1, s), V3.add(p2, s), bark, cut); this.tri2(o, V3.sub(p0, s), V3.sub(p2, s), V3.sub(p1, s), bark, cut);
    }
    const greens = [[0.17, 0.4, 0.14], [0.21, 0.47, 0.17], [0.14, 0.34, 0.13], [0.24, 0.5, 0.2]];
    const nb = big ? 9 : 5;
    for (let k = 0; k < nb; k++) {
      const a = k / nb * Math.PI * 2 + rng() * 0.8, d = k === 0 ? 0 : r * (0.35 + rng() * 0.35);
      const c = [t.x + Math.cos(a) * d, ly + 0.6 + (k === 0 ? (big ? 1.6 : 1.0) : rng() * 1.2 - 0.3), t.z + Math.sin(a) * d];
      const rr = r * (k === 0 ? 0.75 : 0.5 + rng() * 0.25);
      if (k) this.cyl(o, [t.x, ly - 0.6, t.z], [c[0], c[1] - rr * 0.3, c[2]], big ? 0.28 : 0.12, big ? 0.14 : 0.06, 5, bark, cut);
      this.blob(o, c, rr, rr * 0.72, rr, greens[Math.floor(rng() * 4)], cut, rng, 0.35);
    }
  },
  bush(world, x, y, z, o) {
    const rng = this.rngFor(x * 31 + z * 1777 + y), g = world.Hn ? this.surfH(world, x + 0.5, z + 0.5) : y;
    const yy = Math.abs(y - g) < 1.5 ? g : y;
    this.blob(o, [x + 0.5, yy + 0.45, z + 0.5], 0.75 + rng() * 0.2, 0.6, 0.75 + rng() * 0.2, rng() < 0.5 ? [0.16, 0.38, 0.14] : [0.2, 0.44, 0.16], 100, rng, 0.35);
  },
  /* ---------- rounded box for every character, creature and prop ---------- */
  roundBox(N, r) {
    const v = [], ix = [];
    const faces = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    for (const [n, u, w] of faces) {
      const base = v.length / 13;
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const a = i / N * 2 - 1, b = j / N * 2 - 1;
        const p = [n[0] + u[0] * a + w[0] * b, n[1] + u[1] * a + w[1] * b, n[2] + u[2] * a + w[2] * b];
        const q = p.map(c => Math.max(-(1 - r), Math.min(1 - r, c)));
        const d = V3.sub(p, q), dl = Math.hypot(d[0], d[1], d[2]), nn = dl > 1e-5 ? V3.scale(d, 1 / dl) : n;
        const pos = V3.add(q, V3.scale(nn, r));
        v.push(pos[0] * 0.5, pos[1] * 0.5, pos[2] * 0.5, nn[0], nn[1], nn[2], 1, 1, 1, i / N, j / N, 1, -1);
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = base + j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; ix.push(a, b, d, a, d, c); }
    }
    return { v: new Float32Array(v), i: new Uint16Array(ix) };
  }
};
