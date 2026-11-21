'use strict';
/* =========================================================
   UNDERGROWTH - core game: world, player, survival, camp
   ========================================================= */
const $ = s => document.querySelector(s);
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
function lerpAng(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }
const mixC = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

const SAVE_KEY = 'undergrowth_save_v1';
const DAY_LEN = 480;            // seconds per full day
const NIGHT_A = 0.56, NIGHT_B = 0.98; // fraction of the day that is night
const BHP = {};                 // hit points of breakable blocks
const BASIC_RESPAWN = new Set(['stick', 'stone', 'leaf', 'mushroom', 'mushroom_red', 'liana', 'herb', 'banana']);
const SOFT_CUT = ['LEAVES', 'LEAVES_D', 'LEAVES_L', 'PALM', 'VINE', 'LOG', 'LOG_P', 'BAMBOO', 'THATCH', 'TARP', 'WALL_LOG', 'PLANK_D', 'RUIN', 'RUIN_D', 'MOSS', 'HULL', 'METAL', 'METAL_R', 'GLASS', 'CANVAS', 'STAKE', 'BONE', 'RED', 'WALL_STONE'];
// extra item looks on the ground
Object.assign(ITEM_LOOK, {
  berries: [[0, 0.06, 0, 0.16, 0.12, 0.16, [0.55, 0.12, 0.35]]], fish_raw: ITEM_LOOK.fish, fish_cooked: [[0, 0.06, 0, 0.36, 0.1, 0.12, [0.7, 0.5, 0.3]]],
  meat_cooked: [[0, 0.06, 0, 0.3, 0.12, 0.2, [0.5, 0.3, 0.16]]], meat_dried: [[0, 0.04, 0, 0.3, 0.06, 0.18, [0.4, 0.2, 0.12]]],
  flesh_raw: [[0, 0.06, 0, 0.3, 0.12, 0.2, [0.62, 0.24, 0.24]]], flesh_cooked: [[0, 0.06, 0, 0.3, 0.12, 0.2, [0.45, 0.28, 0.2]]],
  log: [[0, 0.18, 0, 0.36, 0.36, 1.1, [0.36, 0.25, 0.15]]], bamboo: [[0, 0.06, 0, 0.1, 0.1, 1.2, [0.55, 0.62, 0.25]]],
  rope: [[0, 0.04, 0, 0.26, 0.08, 0.26, [0.6, 0.5, 0.3]]], cloth: [[0, 0.03, 0, 0.3, 0.05, 0.3, [0.72, 0.68, 0.6]]],
  pack: [[0, 0.2, 0, 0.5, 0.4, 0.3, [0.3, 0.26, 0.16]], [0, 0.42, 0, 0.52, 0.08, 0.32, [0.24, 0.2, 0.12]]],
  bandage: [[0, 0.04, 0, 0.2, 0.08, 0.14, [0.9, 0.88, 0.82]]], club: [[0, 0.06, 0, 0.12, 0.12, 0.7, [0.36, 0.25, 0.14]]],
  bone_spear: [[0, 0.04, 0, 0.06, 0.06, 1.5, [0.88, 0.84, 0.72]]], spear: [[0, 0.04, 0, 0.06, 0.06, 1.5, [0.45, 0.32, 0.18]]],
  snack: [[0, 0.04, 0, 0.2, 0.06, 0.08, [0.75, 0.55, 0.25]]]
});

const Game = {
  mode: 'title', S: null, M: null, W: null, P: null, ents: [], proj: [], fx: [], flares: [], surv: [],
  paused: false, t: 0, last: 0, hudT: 0, saveT: 0, useT: 0, target: null, place: null, msgQ: [], heli: null,
  settings: null,

  /* ---------------- boot ---------------- */
  boot() {
    this.settings = this.loadSettings();
    Engine.init($('#gl'));
    Engine.quality = this.settings.quality; Engine.viewDist = this.settings.quality === 'lite' ? 56 : 76;
    Engine.resize(); addEventListener('resize', () => Engine.resize());
    UI.init(); Controls.init();
    UI.title();
    requestAnimationFrame(t => this.loop(t));
  },
  loadSettings() {
    let s = {}; try { s = JSON.parse(localStorage.getItem(SAVE_KEY + '_set') || '{}'); } catch (e) { }
    const coarse = matchMedia('(pointer:coarse)').matches;
    const st = Object.assign({ view: 'third', invLook: false, quality: coarse ? 'med' : 'high', sfx: true, music: true, hints: true }, s);
    if (st.view !== 'first') st.view = 'third';
    return st;
  },
  saveSettings() { try { localStorage.setItem(SAVE_KEY + '_set', JSON.stringify(this.settings)); } catch (e) { } },
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },

  /* ---------------- state ---------------- */
  fresh(seed, hard) {
    return {
      v: 1, seed, hard: !!hard, time: 0.02, night: 0, wasNight: false,
      p: { x: 0, y: 0, z: 0, face: 0, hp: 100, food: 80, water: 80, energy: 90, sanity: 100, bleed: 0, poison: 0, sick: 0, infect: 0, bleedT: 0 },
      inv: {}, equip: null, dur: {}, canteen: 0, torchT: 0,
      edits: {}, felled: [], taken: [], opened: [], bush: {}, drops: [], pieces: [], store: {},
      parts: {}, pages: {}, rescued: {}, found: {}, seen: '', flags: {}, pop: { red: 14, bone: 14 },
      radioFixed: false, radioNight: 0, rain: 0, rainT: 90, scoutT: 120, stats: { kills: 0, crafted: 0, deaths: 0, built: 0 }
    };
  },
  newGame(hard) {
    const seed = (Math.random() * 1e9) | 0;
    this.S = this.fresh(seed, hard);
    this.loadWorld(true);
    UI.story(STORY_INTRO, () => { this.start(); UI.hint('Gather sticks and stones near camp. Your campfire is burning, keep it fed.'); });
  },
  continueGame() {
    let S; try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { S = null; }
    if (!S) return this.newGame(false);
    this.S = Object.assign(this.fresh(S.seed, S.hard), S);
    this.loadWorld(false);
    this.start();
  },
  start() {
    this.mode = 'play'; this.paused = false;
    UI.hud(true); Controls.setView(this.settings.view, true);
    Sfx.unlock(); Sfx.ambient(true);
  },
  save() {
    if (!this.S || this.mode !== 'play') return;
    const S = this.S, P = this.P;
    S.p.x = P.x; S.p.y = P.y; S.p.z = P.z; S.p.face = P.face;
    S.seen = this.seenStr();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { }
  },
  wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } },

  /* ---------------- world ---------------- */
  loadWorld(isNew) {
    const S = this.S, t0 = performance.now();
    const M = this.M = genIsland(S.seed), W = this.W = M.world;
    // blocks that fade around the player when they hide the view
    const fadeSet = new Uint8Array(BLOCKS.length); for (const k of SOFT_CUT) fadeSet[B[k]] = 1;
    for (let i = 0; i < W.b.length; i++) if (fadeSet[W.b[i]]) W.cutF[i] = 1;
    for (const k of ['WALL_LOG', 'WALL_STONE', 'STAKE', 'PLANK', 'PLANK_D', 'THATCH']) BHP[B[k]] = ({ WALL_LOG: 60, WALL_STONE: 150, STAKE: 40, PLANK: 50, PLANK_D: 50, THATCH: 30 })[k];
    W.cutMode = 1;
    // replay the player's changes
    for (const i of S.felled) { const t = M.trees[i]; if (t) { t.down = true; for (const c of t.cells) W.b[c] = 0; } }
    for (const k in S.edits) { const i = +k; W.b[i] = S.edits[k]; W.cutF[i] = S.edits[k] && fadeSet[S.edits[k]] ? 1 : 0; }
    M.items.forEach((it, i) => { it.i = i; });
    for (const i of S.taken) if (M.items[i]) M.items[i].gone = true;
    for (const k in S.bush) { const it = M.items[+k]; if (it && it.bush) { it.empty = true; W.b[it.cell] = B.FERN; } }
    for (const i of S.opened) if (M.crates[i]) M.crates[i].open = true;
    M.crates.forEach((c, i) => { c.i = i; });
    if (!S.pieces.length) S.pieces.push({ type: 'campfire', x: M.camp.x, y: M.camp.y, z: M.camp.z, level: 1, fuel: 160 });
    this.fire = S.pieces.find(p => p.type === 'campfire');
    // player
    const sp = isNew ? M.spawn : [S.p.x, S.p.y, S.p.z];
    this.P = { x: sp[0], y: sp[1], z: sp[2], face: isNew ? Math.PI : S.p.face, phase: 0, moving: false, swing: 0, swingDur: 0.5, hitDone: true, atkCD: 0, hurtT: 0, run: false };
    if (isNew) { S.p.x = sp[0]; S.p.y = sp[1]; S.p.z = sp[2]; }
    this.seen = new Uint8Array(36 * 36); if (S.seen) for (let i = 0; i < S.seen.length; i++) this.seen[i] = S.seen.charCodeAt(i) === 49 ? 1 : 0;
    this.ents = []; this.proj = []; this.fx = []; this.flares = []; this.heli = null;
    this.buildSurvivors();
    AI.reset();
    LowPoly.prepare(W, M.H); LowPoly.markTrees(W, M.trees);
    Engine.buildWorld(W);
    MapView.build();
    Engine.cam.tx = this.P.x; Engine.cam.ty = this.P.y; Engine.cam.tz = this.P.z;
    console.log('world ready in', Math.round(performance.now() - t0), 'ms');
  },
  setBlock(x, y, z, t, record) {
    const W = this.W; if (!W.in(x, y, z)) return;
    const i = W.idx(x, y, z); W.b[i] = t; W.cutF[i] = t ? 1 : 0;
    if (record !== false) this.S.edits[i] = t;
    Engine.markDirty(x, z);
  },
  // things standing on natural ground follow the smooth terrain surface
  visY(x, z, y) {
    const W = this.W; if (!W || !W.Hn) return y;
    const cx = Math.floor(x), cz = Math.floor(z); if (cx < 0 || cz < 0 || cx >= W.W || cz >= W.D) return y;
    const g = W.Hn[cz * W.W + cx];
    return (Math.round(y) - 1 <= g && y > g - 0.5) ? LowPoly.surfH(W, x, z) : y;
  },
  vy(o, fn) { const y0 = o.y; o.y = this.visY(o.x, o.z, y0); try { fn(o); } finally { o.y = y0; } },
  seenStr() { let s = ''; for (let i = 0; i < this.seen.length; i++) s += this.seen[i] ? '1' : '0'; return s; },
  reveal(x, z, r) {
    const cx = Math.floor(x / 4), cz = Math.floor(z / 4), rr = Math.ceil(r / 4);
    for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) { const a = cx + i, b = cz + j; if (a < 0 || b < 0 || a >= 36 || b >= 36 || i * i + j * j > rr * rr) continue; this.seen[b * 36 + a] = 1; }
  },

  /* ---------------- time ---------------- */
  dayFrac() { return this.S.time % 1; },
  isNight() { const f = this.dayFrac(); return f >= NIGHT_A && f < NIGHT_B; },
  dayNum() { return Math.floor(this.S.time) + 1; },
  clock() { const h = (6 + this.dayFrac() * 24) % 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60 / 10) * 10).padStart(2, '0')}`; },
  darkness() { // 0 day .. 1 deep night
    const f = this.dayFrac();
    if (f < 0.04) return 1 - f / 0.04;
    if (f < 0.5) return 0;
    if (f < NIGHT_A + 0.02) return (f - 0.5) / (NIGHT_A + 0.02 - 0.5);
    if (f < NIGHT_B - 0.01) return 1;
    return 1;
  },

  /* ---------------- items & inventory ---------------- */
  count(id) { return this.S.inv[id] || 0; },
  has(need, mul) {
    for (const k in need) if (this.count(k) < this.cost(need[k], mul)) return false; return true;
  },
  cost(n, mul) { return this.S.rescued.jun && mul ? Math.max(1, Math.ceil(n * 0.75)) : n; },
  take(need, mul) { for (const k in need) this.remove(k, this.cost(need[k], mul)); },
  add(id, n, quiet) {
    const it = ITEMS[id]; if (!it) return 0;
    const have = this.count(id), room = Math.max(0, it.stack - have), k = Math.min(room, n);
    if (k > 0) { this.S.inv[id] = have + k; if (it.dur && !this.S.dur[id]) this.S.dur[id] = it.dur; if (id === 'canteen' && !this.S.canteen) this.S.canteen = 0; }
    if (n - k > 0) { this.dropItem(id, n - k, this.P.x, this.P.y, this.P.z); if (!quiet) UI.toast(`No room for more ${it.name}`); }
    if (k > 0 && !quiet) UI.pickup(id, k);
    return k;
  },
  remove(id, n) {
    const v = this.count(id) - (n || 1);
    if (v <= 0) { delete this.S.inv[id]; if (this.S.equip === id) this.S.equip = null; delete this.S.dur[id]; } else this.S.inv[id] = v;
  },
  dropItem(id, n, x, y, z, extra) {
    const a = Math.random() * 6.28, r = 0.3 + Math.random() * 0.6;
    const d = Object.assign({ id, n: n || 1, x: x + Math.cos(a) * r, y: this.groundY(x + Math.cos(a) * r, z + Math.sin(a) * r, y), z: z + Math.sin(a) * r, r: Math.random() * 6 }, extra || {});
    this.S.drops.push(d); return d;
  },
  groundY(x, z, yHint) {
    const W = this.W, cx = Math.floor(x), cz = Math.floor(z), y0 = Math.round(yHint);
    for (let d = 0; d < 8; d++) for (const y of [y0 - d, y0 + d]) if (W.in(cx, y, cz) && !W.solid(cx, y, cz) && W.solid(cx, y - 1, cz)) return y;
    return yHint;
  },
  equipped() { return this.S.equip ? ITEMS[this.S.equip] : null; },
  useDur(n) {
    const S = this.S, id = S.equip; if (!id || !ITEMS[id].dur) return;
    S.dur[id] = (S.dur[id] || ITEMS[id].dur) - (n || 1);
    if (S.dur[id] <= 0) { UI.toast(`${ITEMS[id].name} broke`); Sfx.play('break'); const left = this.count(id) - 1; this.remove(id, 1); if (left > 0) { S.dur[id] = ITEMS[id].dur; S.equip = id; } }
  },
  equip(id) {
    const S = this.S;
    if (S.equip === id) S.equip = null; else if (this.count(id)) { S.equip = id; if (id === 'torch' && S.torchT <= 0) S.torchT = ITEMS.torch.burn; }
    Sfx.play('equip'); UI.hud(true);
  },

  /* ---------------- consume ---------------- */
  eat(id) {
    const it = ITEMS[id], p = this.S.p; if (!it || !this.count(id)) return;
    if (it.needsTool && !['knife', 'axe', 'stone_axe'].some(t => this.count(t))) return UI.toast('You need a blade or an axe to open it');
    this.remove(id, 1);
    p.food = clamp(p.food + (it.food || 0), 0, 100); p.water = clamp(p.water + (it.water || 0), 0, 100);
    p.energy = clamp(p.energy + (it.energy || 0), 0, 100); p.sanity = clamp(p.sanity + (it.sanity || 0), 0, 100);
    if (it.sick && Math.random() < it.sick) { p.sick = Math.max(p.sick, 120); UI.toast('Your stomach turns. You feel sick.', 'bad'); }
    if (it.poison) { p.poison = Math.max(p.poison, 50); UI.toast('Poisoned', 'bad'); }
    if (it.flesh) this.S.flags.flesh = (this.S.flags.flesh || 0) + 1;
    Sfx.play('eat'); UI.hud(true);
  },
  heal(id) {
    const it = ITEMS[id], p = this.S.p; if (!it || !this.count(id)) return;
    this.remove(id, 1);
    p.hp = clamp(p.hp + (it.heal || 0), 0, 100);
    if (it.stopBleed) { p.bleed = 0; p.bleedT = 0; }
    if (it.curePoison) p.poison = 0; if (it.cureSick) p.sick = 0; if (it.cureInfect) p.infect = 0;
    Sfx.play('heal'); UI.toast(`Used ${it.name}`); UI.hud(true);
  },
  drinkCanteen() {
    const S = this.S; if (!this.count('canteen')) return;
    if (S.canteen <= 0) return UI.toast('The canteen is empty. Fill it at a rain collector or river.');
    S.canteen--; S.p.water = clamp(S.p.water + 28, 0, 100);
    if (S.flags.dirtyCanteen && Math.random() < 0.18) { S.p.sick = Math.max(S.p.sick, 90); UI.toast('The river water made you sick', 'bad'); }
    if (S.canteen <= 0) S.flags.dirtyCanteen = false;
    Sfx.play('drink'); UI.hud(true);
  },
  useFlare() {
    if (!this.count('flare')) return; this.remove('flare', 1);
    this.flares.push({ x: this.P.x, y: this.P.y, z: this.P.z, t: 40 });
    Sfx.play('flare'); UI.toast('The flare burns red. Nothing will come near it.'); UI.hud(true);
  },

  /* ---------------- crafting ---------------- */
  nearPiece(type, r) { const P = this.P; return this.S.pieces.find(p => p.type === type && Math.hypot(p.x - P.x, p.z - P.z) < (r || 4)); },
  canCraft(rc) { return this.has(rc.need) && (rc.where !== 'bench' || this.nearPiece('bench')); },
  craft(rc) {
    if (!this.canCraft(rc)) return false;
    if (this.count(rc.out) + rc.n > ITEMS[rc.out].stack) { UI.toast('You cannot carry more of that'); return false; }
    this.take(rc.need); this.add(rc.out, rc.n, true); this.S.stats.crafted++;
    if (rc.out === 'canteen') this.S.canteen = 0;
    Sfx.play('craft'); UI.toast(`Crafted ${ITEMS[rc.out].name}${rc.n > 1 ? ' x' + rc.n : ''}`);
    return true;
  },

  /* ---------------- player ---------------- */
  standY(x, z, yb, fx, fz) {
    const W = this.W, cx = Math.floor(x), cz = Math.floor(z);
    for (const dy of [0, 1, -1, -2, -3]) {
      const y = yb + dy;
      if (!W.walkable(cx, y, cz)) continue;
      if (dy === 1 && W.solid(Math.floor(fx), yb + 2, Math.floor(fz))) continue;
      if (dy < 0 && (W.solid(cx, yb, cz) || W.solid(cx, yb + 1, cz))) continue;
      return y;
    }
    return null;
  },
  canGo(e, x, z, mx, mz, r) {
    const yb = Math.round(e.y), y = this.standY(x, z, yb, e.x, e.z); if (y === null) return null;
    r = r || 0.26;
    if (mx && this.standY(x + Math.sign(mx) * r, z, yb, e.x, e.z) === null) return null;
    if (mz && this.standY(x, z + Math.sign(mz) * r, yb, e.x, e.z) === null) return null;
    return y;
  },
  // move an entity, sliding along walls. returns true if it moved
  stepEnt(e, mx, mz, dist, dt, r) {
    let nx = e.x + mx * dist, nz = e.z + mz * dist, y = this.canGo(e, nx, nz, mx, mz, r);
    if (y === null) { y = this.canGo(e, nx, e.z, mx, 0, r); if (y !== null) nz = e.z; else { y = this.canGo(e, e.x, nz, 0, mz, r); if (y !== null) nx = e.x; } }
    if (y === null) return false;
    e.x = nx; e.z = nz; e.y += (y - e.y) * Math.min(1, dt * 14); if (Math.abs(y - e.y) < 0.02) e.y = y;
    return true;
  },
  playerMove(mx, mz, m, run, dt) {
    const P = this.P, p = this.S.p;
    if (this.place && this.place.sleeping) return;
    const wading = this.W.get(Math.floor(P.x), Math.round(P.y), Math.floor(P.z)) === B.WATER;
    const tired = p.energy < 12 ? 0.7 : 1;
    run = run && p.energy > 5;
    const spd = (run ? 5.4 : 3.3) * Math.max(0.4, m) * (wading ? 0.6 : 1) * tired * (P.swing > 0 ? 0.6 : 1);
    P.run = run;
    const ok = this.stepEnt(P, mx, mz, spd * dt, dt);
    P.moving = ok; if (ok) P.phase += dt * spd * 3.0;
    if (ok && run) p.energy = Math.max(0, p.energy - dt * 0.35);
    if (Controls.view !== 'first' && !this.aimLock) P.face = lerpAng(P.face, Math.atan2(mx, mz), Math.min(1, dt * 12));
    this.stepT = (this.stepT || 0) - dt * spd; if (ok && this.stepT <= 0) { this.stepT = 2.2; Sfx.play(wading ? 'splash' : 'step'); }
    return ok;
  },
  fwd() { // direction the player acts in
    if (Controls.view === 'first') return [-Math.sin(Controls.yaw), -Math.cos(Controls.yaw)];
    return [Math.sin(this.P.face), Math.cos(this.P.face)];
  },

  /* ---------------- interaction targets ---------------- */
  interactables() {
    const M = this.M, S = this.S, P = this.P, out = [];
    const near = (x, y, z, r) => Math.abs(x - P.x) < r && Math.abs(z - P.z) < r && Math.abs(y - P.y) < 2.5;
    M.items.forEach(it => { if (it.gone || !near(it.x, it.y, it.z, 3)) return; if (it.bush) { if (!it.empty) out.push({ k: 'bush', o: it, x: it.x, y: it.y, z: it.z, lbl: 'Pick Berries' }); } else out.push({ k: 'item', o: it, x: it.x, y: it.y, z: it.z, lbl: 'Take ' + ITEMS[it.id].name }); });
    S.drops.forEach(d => { if (near(d.x, d.y, d.z, 3)) out.push({ k: 'drop', o: d, x: d.x, y: d.y, z: d.z, lbl: d.id === 'pack' ? 'Recover your pack' : 'Take ' + ITEMS[d.id].name + (d.n > 1 ? ' x' + d.n : '') }); });
    M.crates.forEach(c => { if (!c.open && near(c.x, c.y, c.z, 3)) out.push({ k: 'crate', o: c, x: c.x, y: c.y, z: c.z, lbl: 'Search ' + c.name }); });
    M.parts.forEach(pt => { if (!S.parts[pt.id] && near(pt.x, pt.y, pt.z, 3)) out.push({ k: 'part', o: pt, x: pt.x, y: pt.y, z: pt.z, lbl: 'Take ' + pt.name }); });
    M.pages.forEach(pg => { if (!S.pages[pg.n] && near(pg.x, pg.y, pg.z, 3)) out.push({ k: 'page', o: pg, x: pg.x, y: pg.y, z: pg.z, lbl: 'Read journal page' }); });
    M.cages.forEach(c => { if (!S.rescued[c.id] && near(c.x, c.y, c.z, 3)) out.push({ k: 'cage', o: c, x: c.x, y: c.y, z: c.z, lbl: (c.hidden ? 'Talk to ' : 'Free ') + SURVIVORS[c.id].name.split(' ')[0] }); });
    if (M.radio && near(M.radio.x, M.radio.y, M.radio.z, 3.2)) out.push({ k: 'radio', o: M.radio, x: M.radio.x, y: M.radio.y, z: M.radio.z, lbl: S.radioFixed ? 'Station Radio' : 'Repair the Radio' });
    S.pieces.forEach(p => { if (near(p.x, p.y, p.z, p.type === 'campfire' ? 3.6 : 3)) out.push({ k: 'piece', o: p, x: p.x, y: p.y, z: p.z, lbl: PIECE_LBL[p.type] || p.type }); });
    this.surv.forEach(s => { if (near(s.x, s.y, s.z, 3)) out.push({ k: 'surv', o: s, x: s.x, y: s.y, z: s.z, lbl: 'Talk to ' + SURVIVORS[s.id].name.split(' ')[0] }); });
    M.trees.forEach(t => { if (t.down || !near(t.x, t.y, t.z, 2.4)) return; const l = t.kind === 'bamboo' ? 'Cut Bamboo' : t.vines > 0 ? 'Pull Liana' : t.fruit ? 'Shake for Coconuts' : 'Search tree'; out.push({ k: 'tree', o: t, x: t.x, y: t.y, z: t.z, lbl: l }); });
    if (this.waterNear()) out.push({ k: 'water', o: null, x: P.x, y: P.y, z: P.z, lbl: this.S.equip && ITEMS[this.S.equip].fish ? 'Spear Fish' : 'Drink Water', far: 1.3 });
    return out;
  },
  waterNear() {
    const W = this.W, P = this.P, x0 = Math.floor(P.x), z0 = Math.floor(P.z), y0 = Math.round(P.y);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const dy of [0, -1]) if (W.get(x0 + dx, y0 + dy, z0 + dz) === B.WATER) return true;
    return false;
  },
  pickTarget() {
    const P = this.P, f = this.fwd(); let best = null, bs = 1e9;
    for (const c of this.interactables()) {
      const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz) + (c.far || 0);
      const dot = d > 0.05 ? (dx * f[0] + dz * f[1]) / Math.hypot(dx, dz) : 1;
      const s = d - dot * 1.1 + (c.k === 'tree' ? 0.6 : 0);
      if (d < 2.9 && s < bs) { bs = s; best = c; }
    }
    this.target = best;
    return best;
  },
  use(c) {
    c = c || this.target; if (!c) return;
    const S = this.S, M = this.M, P = this.P, o = c.o;
    switch (c.k) {
      case 'item': { const got = this.add(o.id, 1); if (got) { o.gone = true; S.taken.push(o.i); Sfx.play('pick'); } break; }
      case 'drop': {
        if (o.id === 'pack') { for (const k in o.contents) this.add(k, o.contents[k], true); S.equip = o.equip || null; UI.toast('You recovered your pack'); }
        else { const got = this.add(o.id, o.n); if (got < o.n) { o.n -= got; break; } }
        S.drops.splice(S.drops.indexOf(o), 1); Sfx.play('pick'); break;
      }
      case 'bush': { this.add('berries', 2 + (Math.random() < 0.4 ? 1 : 0)); o.empty = true; S.bush[o.i] = this.S.time + 1.5; this.W.b[o.cell] = B.FERN; Engine.markDirty(Math.floor(o.x), Math.floor(o.z)); Sfx.play('rustle'); break; }
      case 'crate': {
        o.open = true; S.opened.push(o.i); Sfx.play('open');
        const got = {}; for (const id of o.loot) { got[id] = (got[id] || 0) + 1; }
        for (const id in got) this.add(id, got[id]);
        if (o.loot.includes('canteen')) S.canteen = Math.max(S.canteen, 2);
        break;
      }
      case 'part': { S.parts[o.id] = 1; Sfx.play('part'); UI.toast(`Found the ${o.name} (${Object.keys(S.parts).length}/3)`, 'good'); if (Object.keys(S.parts).length === 3) UI.hint('You have all three radio parts. Take them to the radio mast at the Ostrand Station.'); break; }
      case 'page': { S.pages[o.n] = 1; Sfx.play('page'); UI.page(o.n); break; }
      case 'cage': this.freeSurvivor(o); break;
      case 'radio': this.useRadio(); break;
      case 'piece': UI.piece(o); break;
      case 'surv': UI.talk(o); break;
      case 'tree': this.useTree(o); break;
      case 'water': {
        if (S.equip && ITEMS[S.equip].fish) { this.swingStart(true); if (Math.random() < 0.38) { this.add('fish_raw', 1); Sfx.play('splash'); } else UI.toast('Missed. Try again.'); break; }
        S.p.water = clamp(S.p.water + 22, 0, 100); Sfx.play('drink');
        if (Math.random() < 0.08) { S.p.sick = Math.max(S.p.sick, 80); UI.toast('The water tasted wrong. You feel sick.', 'bad'); }
        if (this.count('canteen') && S.canteen < 4) { S.canteen = 4; S.flags.dirtyCanteen = true; UI.toast('Canteen filled with river water'); }
        break;
      }
    }
    UI.hud(true);
  },
  useTree(t) {
    const S = this.S;
    t.cd = t.cd || 0; if (this.t < t.cd) return UI.toast('Nothing more here for now');
    if (t.kind === 'bamboo') {
      if (!['knife', 'axe', 'stone_axe'].some(k => this.count(k))) return UI.toast('You need a blade to cut bamboo');
      this.add('bamboo', 1); t.bamboo = (t.bamboo || 3) - 1; Sfx.play('chop'); if (t.bamboo <= 0) this.fell(t, true); return;
    }
    if (t.vines > 0) { t.vines--; this.add('liana', 2); Sfx.play('rustle'); return; }
    if (t.fruit) { this.dropItem(t.fruit, 1, t.x, t.y, t.z); if (Math.random() < 0.5) t.fruit = null; t.cd = this.t + 20; Sfx.play('rustle'); return; }
    t.cd = this.t + 30;
    if (Math.random() < 0.6) this.add(Math.random() < 0.5 ? 'stick' : 'leaf', 1); else UI.toast('You need an axe to chop trees');
    Sfx.play('rustle');
  },
  fell(t, quiet) {
    const S = this.S, W = this.W, i = this.M.trees.indexOf(t);
    t.down = true; S.felled.push(i);
    const cols = new Set();
    for (const c of t.cells) { W.b[c] = 0; const x = c % W.W, z = Math.floor(c / W.W) % W.D; cols.add(x + ',' + z); }
    for (const k of cols) { const [x, z] = k.split(',').map(Number); Engine.markDirty(x, z); }
    if (!quiet) {
      for (let k = 0; k < t.logs; k++) this.dropItem('log', 1, t.x, t.y, t.z);
      this.dropItem('stick', 2, t.x, t.y, t.z); this.dropItem('leaf', t.kind === 'palm' ? 4 : 2, t.x, t.y, t.z);
      if (t.kind === 'bamboo') this.dropItem('bamboo', 3, t.x, t.y, t.z);
      if (t.fruit) this.dropItem(t.fruit, 2, t.x, t.y, t.z);
      Sfx.play('fall'); Engine.shakeAmt = 0.25;
    }
  },

  /* ---------------- combat (player side) ---------------- */
  swingStart(silent) {
    const P = this.P, it = this.equipped();
    if (P.swing > 0 || P.atkCD > 0) return false;
    P.swingDur = it && it.speed ? it.speed : 0.45; P.swing = 0.0001; P.hitDone = !!silent; P.atkCD = P.swingDur * 0.9;
    if (!silent) Sfx.play('swing');
    return true;
  },
  attack() {
    if (this.mode !== 'play' || this.paused) return;
    const P = this.P, S = this.S, it = this.equipped(), p = S.p;
    if (p.energy < 3) return UI.toast('Too exhausted to fight');
    if (it && it.ranged) return this.shoot();
    if (Controls.view !== 'first') {
      const e = AI.nearestHostile(P.x, P.z, ((it && it.reach) || 1.4) + 2.2);
      if (e) P.face = Math.atan2(e.x - P.x, e.z - P.z);
      else if (Controls.view === 'third' && !Controls.moving()) P.face = Controls.yaw + Math.PI;
    }
    if (this.swingStart()) p.energy = Math.max(0, p.energy - 0.8);
  },
  resolveHit() {
    const P = this.P, it = this.equipped(), f = this.fwd();
    const reach = (it && it.reach) || 1.4, dmg = (it && it.dmg) || 6;
    // creatures and people
    const e = AI.hitTest(P.x, P.y, P.z, f, reach + 0.4, 0.55);
    if (e) { AI.damage(e, dmg * (0.85 + Math.random() * 0.3), 'player', f, it && it.stagger); this.useDur(1); Sfx.play('hit'); return; }
    // trees
    if (it && it.chop) {
      let best = null, bd = 1e9;
      for (const t of this.M.trees) {
        if (t.down) continue; const dx = t.x - P.x, dz = t.z - P.z, d = Math.hypot(dx, dz), big = t.kind === 'kapok' ? 1 : 0;
        if (d > reach + 0.8 + big || Math.abs(t.y - P.y) > 2.5) continue;
        if (d > 0.9 + big && (dx * f[0] + dz * f[1]) / d < 0.35) continue;
        if (d < bd) { bd = d; best = t; }
      }
      if (best) {
        best.hp -= it.chop; Sfx.play('chop'); this.useDur(1); this.fxBurst(best.x, P.y + 1.1, best.z, [0.45, 0.32, 0.18], 5);
        if (best.hp <= 0) { this.fell(best); if (!this.S.flags.felled) { this.S.flags.felled = 1; UI.hint('Timber. Pick up the logs, then feed one to the campfire.'); } }
        return;
      }
    }
    // breakable blocks in front
    const h = this.W.raycast([P.x, P.y + 1.1, P.z], [f[0], -0.15, f[1]], reach + 0.3, 999);
    if (h && BHP[h.type]) { this.hitBlock(h.x, h.y, h.z, dmg * (it && it.chop ? 2 : 0.7), true); this.useDur(1); return; }
    if (h && (h.type === B.STONE || h.type === B.RUIN || h.type === B.RUIN_D) && Math.random() < 0.15 && it && it.chop) { this.add('stone', 1); Sfx.play('hit'); }
  },
  hitBlock(x, y, z, dmg, byPlayer) {
    const S = this.S, W = this.W, i = W.idx(x, y, z), t = W.b[i]; if (!BHP[t]) return false;
    S.bhp = S.bhp || {};
    const hp = (S.bhp[i] === undefined ? BHP[t] : S.bhp[i]) - dmg;
    this.fxBurst(x + 0.5, y + 0.5, z + 0.5, BLOCKS[t].col, 4);
    Sfx.play(t === B.WALL_STONE ? 'hit' : 'chop', 0.6);
    if (hp <= 0) {
      delete S.bhp[i]; this.setBlock(x, y, z, 0);
      if (byPlayer) { if (t === B.WALL_STONE) this.dropItem('stone', 2, x + 0.5, y, z + 0.5); else if (t === B.THATCH) this.dropItem('leaf', 1, x + 0.5, y, z + 0.5); else if (t !== B.STAKE) this.dropItem('stick', 2, x + 0.5, y, z + 0.5); else this.dropItem('stick', 1, x + 0.5, y, z + 0.5); }
      return true;
    }
    S.bhp[i] = hp; return false;
  },
  shoot() {
    const P = this.P, S = this.S;
    if (!this.count('arrows')) return UI.toast('No arrows. Craft them at the workbench.');
    if (P.atkCD > 0) return;
    P.atkCD = 0.8; P.aimT = 0.5;
    let dir;
    if (Controls.view === 'first') { const cp = Math.cos(Controls.pitch); dir = [-Math.sin(Controls.yaw) * cp, -Math.sin(Controls.pitch) + 0.04, -Math.cos(Controls.yaw) * cp]; }
    else {
      const e = AI.nearestHostile(P.x, P.z, 26, true);
      if (e) { const dx = e.x - P.x, dz = e.z - P.z, dy = e.y + (e.type === 'hollow' ? 2.5 : 0.9) - (P.y + 1.4), d = Math.hypot(dx, dz); dir = V3.norm([dx, dy + d * 0.03, dz]); P.face = Math.atan2(dx, dz); }
      else { const f = Controls.view === 'third' ? [-Math.sin(Controls.yaw), -Math.cos(Controls.yaw)] : this.fwd(); dir = V3.norm([f[0], 0.05, f[1]]); P.face = Math.atan2(f[0], f[1]); }
    }
    this.remove('arrows', 1); this.useDur(1);
    const sp = 30;
    this.proj.push({ x: P.x + dir[0] * 0.6, y: P.y + 1.4, z: P.z + dir[2] * 0.6, vx: dir[0] * sp, vy: dir[1] * sp, vz: dir[2] * sp, life: 2.5, from: 'player', dmg: ITEMS.bow.dmg });
    Sfx.play('bow');
  },
  hurt(dmg, src, opts) {
    const p = this.S.p, P = this.P; if (this.mode !== 'play' || p.hp <= 0) return;
    p.hp -= dmg; P.hurtT = 0.4; Engine.shakeAmt = Math.min(0.5, 0.12 + dmg * 0.012);
    if (opts && opts.bleed && Math.random() < opts.bleed) { if (!p.bleed) UI.toast('You are bleeding. Use a bandage.', 'bad'); p.bleed = 45; }
    if (opts && opts.poison) { p.poison = Math.max(p.poison, opts.poison); UI.toast('Poisoned', 'bad'); }
    if (opts && opts.sanity) p.sanity = Math.max(0, p.sanity - opts.sanity);
    Sfx.play('hurt'); UI.flash();
    if (p.hp <= 0) this.die(src);
  },
  fxBurst(x, y, z, col, n) { for (let i = 0; i < n; i++) this.fx.push({ x, y, z, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3, t: 0.5 + Math.random() * 0.3, col }); },

  /* ---------------- survivors & story ---------------- */
  buildSurvivors() {
    const S = this.S, F = this.fire; this.surv = [];
    let k = 0;
    for (const id in S.rescued) {
      const a = 0.9 + k * 1.15, r = 3.2;
      this.surv.push({ id, x: F.x + Math.cos(a) * r, y: F.y, z: F.z + Math.sin(a) * r, face: Math.atan2(-Math.cos(a), -Math.sin(a)) }); k++;
    }
  },
  freeSurvivor(c) {
    const S = this.S, sv = SURVIVORS[c.id];
    if (!c.hidden && !['knife', 'axe', 'stone_axe'].some(k => this.count(k))) return UI.toast('The bindings are tight. You need a blade or an axe.');
    const guard = AI.ents().find(e => e.tribe && !e.dead && Math.hypot(e.x - c.x, e.z - c.z) < 12);
    if (guard) return UI.toast('Deal with the guards first.', 'bad');
    S.rescued[c.id] = 1;
    // break the stakes around village captives
    const W = this.W;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy < 3; dy++) {
      const x = Math.floor(c.x) + dx, z = Math.floor(c.z) + dz - (c.cage ? 0 : 0), y = Math.floor(c.y) + dy;
      if (W.get(x, y, z) === B.STAKE) this.setBlock(x, y, z, 0);
    }
    Sfx.play('rescue'); this.buildSurvivors();
    UI.dialog(sv.name, sv.line, `${sv.role}: ${sv.perk}<br><br>${sv.name.split(' ')[0]} heads back to your camp.`);
    if (c.id === 'ellis') { this.seen.fill(1); for (const k in POI) S.found[k] = 1; }
  },
  useRadio() {
    const S = this.S, n = Object.keys(S.parts).length;
    if (S.radioFixed) return UI.dialog('Station Radio', 'Static, then a voice: "We have your position. Keep that signal fire burning on the beach. We come at first light."', S.radioNight > S.night ? 'Survive the night with a lit signal fire by the crash site.' : 'Light a signal fire near the crash site and survive until dawn.');
    if (n < 3) {
      const miss = this.M.parts.filter(p => !S.parts[p.id]).map(p => `<b>${p.name}</b>: ${S.pages[5] || S.rescued.ellis ? p.hint : 'location unknown'}`).join('<br>');
      return UI.dialog('Station Radio', 'The set is dead. Wires hang out of the back where parts have been pulled.', `Missing parts:<br>${miss}`);
    }
    S.radioFixed = true; S.radioNight = S.night + 1; Sfx.play('radio');
    UI.dialog('Station Radio', 'The valve glows. The needle jumps. "...Ostrand Station, is anyone there? ...We read you. We cannot land in that canopy. Light a fire on the beach by the wreck. We fly at dawn."', 'Build a Signal Fire near the crash site, light it, and survive one more night.');
    this.save();
  },

  /* ---------------- camp pieces ---------------- */
  fireR() { const F = this.fire; return F.fuel > 0 ? FIRE_LEVELS[F.level].r : 0; },
  addFuel(id) {
    const F = this.fire, it = ITEMS[id]; if (!it || !it.fuel || !this.count(id)) return;
    const max = FIRE_LEVELS[F.level].max; if (F.fuel >= max - 2) return UI.toast('The fire is full');
    this.remove(id, 1); F.fuel = Math.min(max, F.fuel + it.fuel * (this.S.rescued.jun ? 1.25 : 1));
    if (!this.S.flags.fed && id === 'log') this.S.flags.fed = 1;
    Sfx.play('fuel'); this.fxBurst(F.x, F.y + 0.6, F.z, [1, 0.6, 0.2], 8);
  },
  upgradeFire() {
    const F = this.fire, nx = FIRE_LEVELS[F.level + 1]; if (!nx) return;
    if (!this.has(nx.need, true)) return UI.toast('Not enough materials');
    this.take(nx.need, true); F.level++; F.fuel = Math.max(F.fuel, nx.max * 0.6);
    Sfx.play('upgrade'); UI.toast(`Campfire upgraded: ${nx.name}`, 'good'); Engine.shakeAmt = 0.2;
  },
  cookAll() {
    const F = this.fire; if (F.fuel <= 0) return UI.toast('The fire is out');
    let n = 0;
    for (const id of Object.keys(this.S.inv)) { const it = ITEMS[id]; if (it.cook) { const c = this.count(id); this.remove(id, c); this.add(it.cook, c, true); n += c; } }
    if (n) { Sfx.play('sizzle'); UI.toast(`Cooked ${n} item${n > 1 ? 's' : ''}`); } else UI.toast('Nothing raw to cook');
  },
  startPlace(id) {
    const it = ITEMS[id]; if (!it || !this.count(id)) return;
    this.place = { kind: 'piece', id, type: it.place, r: 0 };
    UI.placeMode(true);
  },
  startBuild(b) { this.place = { kind: 'block', b }; UI.placeMode(true); },
  placeGhost() {
    const pl = this.place, P = this.P, f = this.fwd(); if (!pl) return null;
    if (pl.kind === 'piece') {
      const d = pl.type === 'shelter' ? 2.6 : pl.type === 'bed' ? 2 : 1.8;
      const x = P.x + f[0] * d, z = P.z + f[1] * d, y = this.groundY(x, z, P.y);
      const ok = this.W.walkable(Math.floor(x), y, Math.floor(z)) && Math.abs(y - P.y) < 3 && !this.S.pieces.some(p => Math.hypot(p.x - x, p.z - z) < 1.2);
      return { x, y, z, r: Math.atan2(f[0], f[1]) + Math.PI + pl.r, ok };
    }
    const b = pl.b, tx = Math.floor(P.x + f[0] * 1.8), tz = Math.floor(P.z + f[1] * 1.8), py = Math.round(P.y);
    let base = this.standY(tx + 0.5, tz + 0.5, py, P.x, P.z); if (base === null || b.floor) base = py;
    const cells = b.cells.map(c => [tx, base + c[1], tz]);
    const ok = cells.every(([x, y, z]) => { const t = this.W.get(x, y, z); return this.W.in(x, y, z) && (!t || (BLOCKS[t] && BLOCKS[t].soft)); }) && !(tx === Math.floor(P.x) && tz === Math.floor(P.z) && !b.floor && !b.cells.every(c => c[1] >= 2));
    return { cells, ok };
  },
  confirmPlace() {
    const pl = this.place, g = this.placeGhost(); if (!pl || !g) return;
    if (!g.ok) { Sfx.play('deny'); return UI.toast('Cannot place here'); }
    if (pl.kind === 'piece') {
      const p = { type: pl.type, x: g.x, y: g.y, z: g.z, r: g.r };
      if (pl.type === 'torchpost') p.lit = true; if (pl.type === 'collector') p.water = 1; if (pl.type === 'rack') { p.meat = 0; p.dried = []; p.dryT = []; }
      if (pl.type === 'signal') p.lit = false;
      this.S.pieces.push(p); this.remove(pl.id, 1); Sfx.play('place'); this.S.stats.built++;
      if (!this.count(pl.id)) this.cancelPlace(); else UI.hud(true);
      return;
    }
    const b = pl.b; if (b.bench && !this.nearPiece('bench', 10)) return UI.toast('Stone walls need a workbench nearby');
    if (!this.has(b.need, true)) { Sfx.play('deny'); return UI.toast('Not enough materials'); }
    this.take(b.need, true);
    for (const [x, y, z] of g.cells) this.setBlock(x, y, z, B[b.block]);
    Sfx.play('build'); this.S.stats.built++; UI.hud(true);
  },
  cancelPlace() { this.place = null; UI.placeMode(false); },
  pickupPiece(p) {
    if (p.type === 'campfire') return;
    const id = 'p_' + p.type; this.S.pieces.splice(this.S.pieces.indexOf(p), 1); this.add(id, 1); Sfx.play('pick');
  },

  /* ---------------- sleep ---------------- */
  sleep(p) {
    const S = this.S, P = this.P;
    if (AI.ents().some(e => e.hostile && !e.dead && Math.hypot(e.x - P.x, e.z - P.z) < (e.type === 'painted' || e.type === 'hollow' || e.type === 'jaguar' ? 22 : 7))) return UI.toast('You cannot sleep with enemies close by', 'bad');
    const night = this.isNight();
    if (night && Math.hypot(this.fire.x - P.x, this.fire.z - P.z) > this.fireR() + 1) return UI.toast('Too dangerous. Sleep within the light of the campfire.', 'bad');
    if (!night && S.p.energy > 70) return UI.toast('You are not tired');
    let target;
    const f = this.dayFrac(), day = Math.floor(S.time);
    if (night) target = f >= NIGHT_A ? day + 1 + 0.001 : day + 0.001;
    else target = Math.min(day + NIGHT_A - 0.01, S.time + 0.2);
    const dt = (target - S.time) * DAY_LEN;
    UI.fade(() => {
      S.time = target;
      const k = dt / DAY_LEN;
      S.p.energy = 100; S.p.food = Math.max(0, S.p.food - 30 * k); S.p.water = Math.max(0, S.p.water - 40 * k);
      S.p.sanity = clamp(S.p.sanity + (p.type === 'bed' ? 25 : 15), 0, 100); S.p.hp = clamp(S.p.hp + 20, 0, 100);
      this.fire.fuel = Math.max(0, this.fire.fuel - dt * 0.6);
      for (const r of S.pieces) if (r.type === 'rack') for (let i = 0; i < (r.dryT || []).length; i++) r.dryT[i] -= dt;
      for (const r of S.pieces) if (r.type === 'collector') r.water = Math.min(4, (r.water || 0) + 2);
      AI.clearNight(true);
      this.save();
      UI.toast(night ? `Day ${this.dayNum()}. You made it through the night.` : 'You feel rested');
    });
  },

  /* ---------------- death ---------------- */
  die(src) {
    const S = this.S, P = this.P; S.stats.deaths++;
    Sfx.play('death');
    if (S.hard) { this.mode = 'dead'; this.wipe(); UI.dead(src, true); return; }
    // drop the pack and wake at camp
    if (Object.keys(S.inv).length) { this.dropItem('pack', 1, P.x, P.y, P.z, { contents: Object.assign({}, S.inv), equip: S.equip }); }
    S.inv = {}; S.equip = null;
    this.mode = 'dead'; UI.dead(src, false);
  },
  respawn() {
    const S = this.S, P = this.P, F = this.fire;
    P.x = F.x + 2; P.z = F.z + 2; P.y = this.groundY(P.x, P.z, F.y);
    Object.assign(S.p, { hp: 60, food: Math.max(S.p.food, 40), water: Math.max(S.p.water, 40), energy: 60, sanity: Math.max(S.p.sanity, 50), bleed: 0, poison: 0, sick: 0, infect: 0 });
    S.time = Math.floor(S.time) + (this.isNight() ? 1 : 0) + 0.02; AI.clearNight(true);
    this.mode = 'play'; UI.hud(true); this.save();
    UI.toast('You wake by the fire. Your pack is where you fell.');
  },

  /* ---------------- update ---------------- */
  loop(ts) {
    const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000); this.last = ts;
    try {
      if (this.mode === 'play' && !this.paused && !UI.modal) this.update(dt);
      if (this.M) this.render(dt);
    } catch (e) { console.error(e); }
    requestAnimationFrame(t => this.loop(t));
  },
  update(dt) {
    const S = this.S, P = this.P, p = S.p;
    this.t += dt;
    S.time += dt / DAY_LEN;
    // night transitions
    const night = this.isNight();
    if (night && !S.wasNight) { S.night++; this.onNight(); }
    if (!night && S.wasNight) this.onDawn();
    S.wasNight = night;
    Controls.move(dt);
    // swing
    if (P.atkCD > 0) P.atkCD -= dt;
    if (P.swing > 0) { P.swing += dt / P.swingDur; if (!P.hitDone && P.swing > 0.45) { P.hitDone = true; this.resolveHit(); } if (P.swing >= 1) P.swing = 0; }
    if (P.aimT > 0) P.aimT -= dt;
    if (P.hurtT > 0) P.hurtT -= dt;
    this.survival(dt);
    this.camp(dt);
    this.weather(dt);
    AI.update(dt);
    this.updateProj(dt);
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t -= dt; f.vy -= 9 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; if (f.t <= 0) this.fx.splice(i, 1); }
    for (let i = this.flares.length - 1; i >= 0; i--) { this.flares[i].t -= dt; if (this.flares[i].t <= 0) this.flares.splice(i, 1); }
    // exploration
    this.reveal(P.x, P.z, 13);
    for (const k in POI) if (!S.found[k] && Math.hypot(P.x - POI[k].x, P.z - POI[k].z) < POI[k].r + 5) { S.found[k] = 1; UI.banner(POI[k].name); }
    // interaction target
    this.useT -= dt; if (this.useT <= 0) { this.useT = 0.15; this.pickTarget(); UI.useBtn(this.target); }
    if (this.heli) this.updateHeli(dt);
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.25; UI.hud(); }
    this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 30; this.save(); }
  },
  inLight(x, z, forHollow) {
    const F = this.fire, r = this.fireR();
    if (r && Math.hypot(x - F.x, z - F.z) < r) return true;
    for (const fl of this.flares) if (Math.hypot(x - fl.x, z - fl.z) < 14) return true;
    if (this.isNight()) for (const p of this.S.pieces) if (p.type === 'torchpost' && p.lit && Math.hypot(x - p.x, z - p.z) < 4) return true;
    if (forHollow && this.S.equip === 'torch' && Math.hypot(x - this.P.x, z - this.P.z) < 5) return true;
    return false;
  },
  survival(dt) {
    const S = this.S, p = S.p, P = this.P, night = this.isNight();
    const sick = p.sick > 0 ? 1.8 : 1, heat = night ? 0.85 : 1.1;
    p.food = Math.max(0, p.food - dt * 0.075 * sick);
    p.water = Math.max(0, p.water - dt * 0.11 * sick * heat);
    p.energy = Math.max(0, p.energy - dt * 0.035 * (p.sick > 0 ? 1.5 : 1));
    // sanity
    const lit = this.inLight(P.x, P.z, true);
    if (night && !lit) p.sanity -= dt * 0.22; else if (lit) p.sanity += dt * 0.12; else p.sanity += dt * 0.04;
    if (this.surv.length && Math.hypot(P.x - this.fire.x, P.z - this.fire.z) < 9) p.sanity += dt * 0.1;
    if (S.rain > 0 && !lit) p.sanity -= dt * 0.03;
    p.sanity = clamp(p.sanity, 0, 100);
    // conditions
    if (p.bleed > 0) { p.bleed -= dt; p.hp -= dt * 0.55; p.bleedT += dt; if (p.bleedT > 25 && !p.infect && Math.random() < dt * 0.05) { p.infect = 1; UI.toast('The wound is infected. You need a herb poultice.', 'bad'); } if (Math.random() < dt * 3) this.fx.push({ x: P.x, y: P.y + 0.8, z: P.z, vx: 0, vy: -1, vz: 0, t: 0.5, col: [0.6, 0.05, 0.05] }); }
    else p.bleedT = 0;
    if (p.poison > 0) { p.poison -= dt; p.hp -= dt * 0.4; }
    if (p.sick > 0) p.sick -= dt;
    if (p.infect) p.hp -= dt * 0.12;
    if (p.food <= 0) p.hp -= dt * 0.45;
    if (p.water <= 0) p.hp -= dt * 0.6;
    if (p.sanity <= 5) p.hp -= dt * 0.25;
    const healthy = p.food > 45 && p.water > 45 && !p.bleed && !p.poison && !p.infect;
    if (healthy) p.hp += dt * (p.energy > 30 ? 0.18 : 0.08);
    // Mara treats you at camp
    if (S.rescued.mara && Math.hypot(P.x - this.fire.x, P.z - this.fire.z) < 7) { p.hp += dt * 0.5; if (p.bleed || p.poison || p.infect) { p.bleed = 0; p.poison = 0; p.infect = 0; UI.toast('Mara treats your wounds'); } }
    p.hp = Math.min(100, p.hp);
    // torch burning
    if (S.equip === 'torch') { S.torchT -= dt * (S.rain > 0 ? 1.6 : 1); if (S.torchT <= 0) { this.remove('torch', 1); UI.toast('Your torch burned out'); if (this.count('torch')) { S.equip = 'torch'; S.torchT = ITEMS.torch.burn; } UI.hud(true); } }
    if (p.hp <= 0) this.die(p.food <= 0 ? 'starvation' : p.water <= 0 ? 'thirst' : p.bleed ? 'blood loss' : p.poison ? 'poison' : p.sanity <= 5 ? 'madness' : 'wounds');
  },
  camp(dt) {
    const S = this.S, F = this.fire;
    if (F.fuel > 0) { F.fuel -= dt * (S.rescued.jun ? 0.75 : 1) * (S.rain > 0 && F.level < 3 ? 1.5 : 1); if (F.fuel <= 0) { F.fuel = 0; UI.toast('The campfire went out', 'bad'); Sfx.play('douse'); } else if (F.fuel < 40 && !this._lowWarn) { this._lowWarn = 1; UI.toast('The campfire is burning low'); } }
    if (F.fuel > 60) this._lowWarn = 0;
    for (const p of S.pieces) {
      if (p.type === 'rack' && p.dryT) for (let i = 0; i < p.dryT.length; i++) if (p.dryT[i] > 0) p.dryT[i] -= dt * (S.rain > 0 ? 0.5 : 1);
      if (p.type === 'collector') { p.acc = (p.acc || 0) + dt * (S.rain > 0 ? 1 / 30 : 1 / 200); if (p.acc >= 1) { p.acc = 0; p.water = Math.min(4, (p.water || 0) + 1); } }
    }
    // bushes regrow
    for (const k in S.bush) if (S.time > S.bush[k]) { const it = this.M.items[+k]; delete S.bush[k]; if (it) { it.empty = false; this.W.b[it.cell] = B.BERRY; Engine.markDirty(Math.floor(it.x), Math.floor(it.z)); } }
  },
  weather(dt) {
    const S = this.S;
    if (S.rain > 0) { S.rain -= dt; if (S.rain <= 0) { S.rainT = 150 + Math.random() * 300; Sfx.rain(false); } }
    else { S.rainT -= dt; if (S.rainT <= 0) { S.rain = 50 + Math.random() * 90; Sfx.rain(true); UI.toast('Rain sweeps in over the canopy'); } }
  },
  onNight() {
    const S = this.S;
    UI.banner(`Night ${S.night}`, NIGHT_LINES[Math.min(NIGHT_LINES.length - 1, Math.floor(Math.random() * NIGHT_LINES.length))]);
    Sfx.play('dusk');
    for (const p of S.pieces) if (p.type === 'torchpost') p.lit = true;
    AI.onNight(S.night);
    this.save();
  },
  onDawn() {
    const S = this.S, inv = S.inv;
    AI.clearNight(false);
    // food spoils
    let lost = 0;
    for (const id of ['meat_raw', 'fish_raw', 'flesh_raw']) if (inv[id]) { const k = Math.ceil(inv[id] / 2); lost += k; this.remove(id, k); }
    for (const id of ['meat_cooked', 'fish_cooked']) if (inv[id] >= 2) { const k = Math.floor(inv[id] / 4); lost += k; if (k) this.remove(id, k); }
    if (lost) UI.toast(`${lost} food item${lost > 1 ? 's' : ''} spoiled in the heat. Dry meat on a rack to keep it.`);
    // loose resources respawn
    S.taken = S.taken.filter(i => { const it = this.M.items[i]; if (it && BASIC_RESPAWN.has(it.id) && Math.random() < 0.3) { it.gone = false; return false; } return true; });
    // Tomas hunts
    if (S.rescued.tomas) { this.dropItem('meat_raw', 2, this.fire.x + 1.5, this.fire.y, this.fire.z); UI.toast('Tomas left fresh meat by the fire'); }
    UI.banner(`Day ${this.dayNum()}`, S.night >= 1 ? `You survived ${S.night} night${S.night > 1 ? 's' : ''}` : '');
    Sfx.play('dawn');
    // rescue
    if (S.radioFixed && S.night >= S.radioNight) {
      const C = POI.crash, sig = S.pieces.find(p => p.type === 'signal' && p.lit && Math.hypot(p.x - C.x, p.z - C.z) < 24);
      if (sig) { this.startHeli(sig); return; }
      S.radioNight = S.night + 1; UI.dialog('Rotor noise', 'A helicopter sweeps along the coast at first light, searching... then turns back out to sea.', 'They could not find you. Light a signal fire near the crash site and survive another night.');
    }
    if (S.night >= 99) { this.win('nights'); return; }
    this.save();
  },
  startHeli(sig) {
    this.heli = { x: sig.x + 40, y: sig.y + 26, z: sig.z - 30, tx: sig.x + 4, ty: sig.y, tz: sig.z + 2, face: 0, t: 0 };
    UI.banner('Rotor noise', 'They found the signal. Get to the beach.'); Sfx.play('heli');
  },
  updateHeli(dt) {
    const h = this.heli, P = this.P; h.t += dt;
    const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz);
    if (d > 0.5) { h.x += dx / d * Math.min(d, dt * 12); h.z += dz / d * Math.min(d, dt * 12); h.face = lerpAng(h.face, Math.atan2(dx, dz), dt * 2); }
    h.y += ((d < 6 ? h.ty : h.ty + 14) - h.y) * Math.min(1, dt * 0.8);
    if (Math.abs(h.y - h.ty) < 0.6 && Math.hypot(P.x - h.x, P.z - h.z) < 5) this.win('rescue');
  },
  win(kind) {
    this.mode = 'won'; this.wipe(); Sfx.play('win');
    UI.win(kind);
  },

  /* ---------------- projectiles ---------------- */
  updateProj(dt) {
    const W = this.W, P = this.P;
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const a = this.proj[i]; a.life -= dt; a.vy -= 6 * dt;
      const steps = 3; let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        a.x += a.vx * dt / steps; a.y += a.vy * dt / steps; a.z += a.vz * dt / steps;
        if (W.solid(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)) && !BLOCKS[W.get(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))].cutout) { hit = true; if (a.from === 'player' && Math.random() < 0.5) this.dropItem('arrows', 1, a.x, a.y, a.z); break; }
        if (a.from === 'player') { const e = AI.pointHit(a.x, a.y, a.z, 0.5); if (e) { AI.damage(e, a.dmg, 'player', V3.norm([a.vx, 0, a.vz])); hit = true; Sfx.play('hit'); } }
        else if (Math.hypot(a.x - P.x, a.z - P.z) < 0.45 && a.y > P.y && a.y < P.y + 1.9) { this.hurt(a.dmg, 'an arrow', { bleed: 0.35 }); hit = true; }
      }
      if (hit || a.life <= 0) this.proj.splice(i, 1);
    }
  },

  /* ---------------- rendering ---------------- */
  env() {
    const S = this.S, f = this.dayFrac(), dk = this.darkness(), rain = S.rain > 0 ? 1 : 0;
    const ang = (f / NIGHT_A) * Math.PI; // sun arc across the day
    const sun = f < NIGHT_A ? [Math.cos(ang) * 0.8, Math.max(0.15, Math.sin(ang)), 0.35] : [-0.4, 0.8, -0.3];
    const dusk = f > 0.42 && f < NIGHT_A + 0.03 ? Math.sin((f - 0.42) / (NIGHT_A + 0.03 - 0.42) * Math.PI) : f < 0.06 ? 1 - f / 0.06 : 0;
    const dayFog = mixC([0.52, 0.62, 0.5], [0.4, 0.44, 0.42], rain), nightFog = [0.02, 0.035, 0.04];
    let fog = mixC(dayFog, nightFog, dk); fog = mixC(fog, [0.62, 0.38, 0.22], dusk * 0.5 * (1 - dk));
    const sunCol = mixC(mixC([1.0, 0.93, 0.78], [1.0, 0.55, 0.3], dusk), [0.18, 0.22, 0.35], dk);
    const lowSan = clamp((40 - S.p.sanity) / 40, 0, 1);
    Engine.setEnv({
      sun, sunCol: V3.scale(sunCol, rain ? 0.55 : 1), sky: mixC([0.45, 0.6, 0.5], [0.05, 0.07, 0.12], dk), ground: mixC([0.25, 0.22, 0.15], [0.03, 0.03, 0.04], dk),
      amb: lerp(rain ? 0.6 : 0.75, 0.2, dk), fog: mixC(fog, [0.25, 0.02, 0.02], lowSan * 0.4), fogN: lerp(rain ? 14 : 24, 6, dk), fogF: lerp(rain ? 52 : 74, 30, dk) * (1 - lowSan * 0.3),
      skyTop: mixC(mixC([0.32, 0.5, 0.55], [0.35, 0.3, 0.45], dusk), [0.01, 0.015, 0.03], dk), skyBot: fog, night: dk > 0.6 ? 1 : 0
    });
    Engine.expoMul = lerp(1, 0.85, dk);
  },
  lights() {
    const S = this.S, P = this.P, L = [], dk = this.darkness(), F = this.fire;
    const add = (x, y, z, r, c) => L.push({ x, y, z, r, c, d: Math.hypot(x - P.x, z - P.z) });
    if (F.fuel > 0) { const fl = 1 + Math.sin(this.t * 13) * 0.05 + Math.sin(this.t * 7.3) * 0.04; add(F.x, F.y + 1.2, F.z, (FIRE_LEVELS[F.level].r + 3) * fl, [1.0, 0.58, 0.22]); }
    if (S.equip === 'torch') add(P.x, P.y + 1.8, P.z, 9 + Math.sin(this.t * 17) * 0.4, [1, 0.6, 0.25]);
    for (const fl of this.flares) add(fl.x, fl.y + 1, fl.z, 16, [1, 0.2, 0.15]);
    for (const p of S.pieces) { if (p.type === 'torchpost' && p.lit && dk > 0.1) add(p.x, p.y + 1.6, p.z, 7, [1, 0.6, 0.25]); if (p.type === 'signal' && p.lit) add(p.x, p.y + 1.5, p.z, 12, [1, 0.5, 0.15]); }
    if (this.M.station && dk > 0.3) { const m = this.M.station.mast; add(m[0] + 0.5, m[1] + 0.5, m[2] + 0.5, 6, [1, 0.3, 0.2]); }
    if (this.M.temple) add(this.M.temple.x + 0.5, this.M.temple.y + 1, this.M.temple.z - 2.5, 7, [1, 0.7, 0.4]);
    for (const s of this.M.structs) if (s.type === 'village' && dk > 0.2 && S.pop[s.name === 'Bone Village' ? 'bone' : 'red'] > 0) add(s.fire.x, s.fire.y + 1, s.fire.z, 10, [1, 0.45, 0.15]);
    for (const e of AI.ents()) if (e.type === 'hollow' && !e.dead) add(e.x, e.y + 3, e.z, 3, [1, 0.1, 0.05]);
    if (dk < 0.5) add(P.x, P.y + 12, P.z, 0.01, [0, 0, 0]);
    L.sort((a, b) => a.d - b.d);
    Engine.lights = L.slice(0, 10);
  },
  render(dt) {
    if (this.mode === 'title' || !this.P) { this.titleCam(dt); Engine.render(dt); return; }
    const S = this.S, P = this.P, t = this.t;
    this.env(); this.lights();
    P.vy = this.visY(P.x, P.z, P.y);
    Controls.camera(dt);
    const R = 40, near = (x, z) => Math.abs(x - P.x) < R && Math.abs(z - P.z) < R;
    // player
    if (!Controls.fp()) {
      const hold = S.equip ? (S.equip === 'bone_spear' ? 'bone_spear' : S.equip) : null;
      drawPerson(P.x, P.vy, P.z, P.face, PLAYER_LOOK, { walk: P.moving, phase: P.phase, swing: P.swing, hold, aim: P.aimT > 0, t, crouch: false }, P.hurtT > 0 ? [1, 0.2, 0.2, 0.4] : null);
    } else this.drawFPHands();
    // items
    for (const it of this.M.items) if (!it.gone && !it.bush && near(it.x, it.z)) this.vy(it, o => drawItem(o, t));
    for (const d of S.drops) if (near(d.x, d.z)) this.vy(d, o => drawItem(o, t));
    for (const pg of this.M.pages) if (!S.pages[pg.n] && near(pg.x, pg.z)) drawItem({ id: 'page', x: pg.x, y: this.visY(pg.x, pg.z, pg.y), z: pg.z, r: 0.4, glow: true }, t);
    for (const pt of this.M.parts) if (!S.parts[pt.id] && near(pt.x, pt.z)) this.vy(pt, o => drawPart(o, t));
    for (const c of this.M.crates) if (near(c.x, c.z)) this.vy(c, o => drawCrate(o, t, this.target && this.target.o === c));
    for (const c of this.M.cages) if (!S.rescued[c.id] && near(c.x, c.z)) { const sv = SURVIVORS[c.id]; drawPerson(c.x, c.y, c.z, 0, sv.look, { sit: true, t }); if (c.cage && c.id === 'ellis') drawCage(c, t); }
    for (const p of S.pieces) if (near(p.x, p.z)) this.vy(p, o => drawCampPiece(o, t, this.target && this.target.o === o));
    for (const s0 of this.surv) { const s = { x: s0.x, z: s0.z, face: s0.face, id: s0.id, y: this.visY(s0.x, s0.z, s0.y) }; const sv = SURVIVORS[s.id]; drawPerson(s.x, s.y, s.z, s.face, sv.look, { sit: true, t }); Engine.box(M4.mul(M4.T(s.x, s.y + 0.14, s.z), M4.mul(M4.RY(s.face + Math.PI / 2), M4.S(0.9, 0.28, 0.32))), [0.36, 0.25, 0.15]); }
    AI.draw(t);
    for (const a of this.proj) { const m = M4.mul(M4.T(a.x, a.y, a.z), M4.mul(M4.RY(Math.atan2(a.vx, a.vz)), M4.S(0.04, 0.04, 0.7))); Engine.box(m, [0.5, 0.36, 0.2]); }
    for (const f of this.fx) Engine.box(M4.mul(M4.T(f.x, f.y, f.z), M4.S(0.08, 0.08, 0.08)), f.col);
    for (const fl of this.flares) Engine.box(M4.mul(M4.T(fl.x, fl.y + 0.1, fl.z), M4.S(0.08, 0.2 + Math.sin(t * 30) * 0.03, 0.08)), [1, 0.2, 0.1], [1, 0.2, 0.1, 1]);
    if (this.heli) drawHeli(this.heli, t);
    this.drawGhost(t);
    if (S.rain > 0) this.drawRain(t);
    this.drawFireflies(t);
    Engine.render(dt);
  },
  drawFPHands() {
    const P = this.P, S = this.S;
    if (!S.equip) return;
    const yaw = Controls.yaw, pitch = Controls.pitch, sw = P.swing > 0 ? Math.sin(P.swing * Math.PI) : 0;
    const eye = [P.x, (P.vy || P.y) + 1.64, P.z];
    let m = M4.mul(M4.T(eye[0], eye[1], eye[2]), M4.RY(yaw + Math.PI));
    m = M4.mul(m, M4.RX(-pitch));
    m = M4.mul(m, M4.T(0.3, -0.34 - sw * 0.1, 0.62 + sw * 0.2));
    m = M4.mul(m, M4.RX(-0.4 - sw * 1.2));
    const col = { axe: [0.6, 0.62, 0.66], stone_axe: [0.45, 0.45, 0.43], torch: [1, 0.6, 0.2], bone_spear: [0.88, 0.84, 0.72], spear: [0.45, 0.45, 0.43], knife: [0.7, 0.72, 0.76], club: [0.36, 0.25, 0.14], bow: [0.4, 0.27, 0.15] }[S.equip] || [0.6, 0.55, 0.45];
    Engine.box(M4.mul(m, M4.mul(M4.T(0, 0, 0), M4.S(0.05, 0.05, 0.5))), [0.42, 0.3, 0.18]);
    Engine.box(M4.mul(m, M4.mul(M4.T(0, 0.06, 0.26), M4.S(0.06, 0.16, 0.14))), col, S.equip === 'torch' ? [1, 0.55, 0.15, 1] : null);
    Engine.box(M4.mul(m, M4.mul(M4.T(0, -0.02, -0.18), M4.S(0.1, 0.1, 0.14))), SKIN[PLAYER_LOOK.skin]);
  },
  drawGhost(t) {
    const g = this.placeGhost(); if (!g) return;
    const col = g.ok ? [0.4, 1, 0.5] : [1, 0.3, 0.25];
    if (this.place.kind === 'piece') { Engine.box(M4.mul(M4.T(g.x, g.y + 0.6, g.z), M4.S(1.2, 1.2, 1.2)), col, [col[0], col[1], col[2], 0.6], 0.35); return; }
    for (const [x, y, z] of g.cells) Engine.box(M4.mul(M4.T(x + 0.5, y + 0.5, z + 0.5), M4.S(1.01, 1.01, 1.01)), col, [col[0], col[1], col[2], 0.5], 0.4);
  },
  drawRain(t) {
    const e = Engine.eye, c = Engine.cam;
    const fx = c.tx - e[0], fz = c.tz - e[2], fl = Math.hypot(fx, fz) || 1;
    for (let i = 0; i < 160; i++) {
      const h1 = (i * 0.618) % 1, h2 = (i * 0.377) % 1;
      const along = 2 + h1 * 16, side = (h2 - 0.5) * 20;
      const x = e[0] + fx / fl * along - fz / fl * side, z = e[2] + fz / fl * along + fx / fl * side;
      const y = c.ty + 9 - ((t * 16 + i * 1.7) % 14);
      Engine.box(M4.mul(M4.T(x, y, z), M4.S(0.025, 0.5, 0.025)), [0.65, 0.72, 0.8], null, 0.45);
    }
  },
  drawFireflies(t) {
    if (this.darkness() < 0.5) return;
    const P = this.P;
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39 + t * 0.15, r = 4 + (i % 5) * 2.2;
      const x = P.x + Math.cos(a) * r + Math.sin(t * 0.7 + i) * 0.8, z = P.z + Math.sin(a) * r, y = P.y + 0.8 + Math.sin(t * 1.3 + i * 3) * 0.6 + (i % 3) * 0.5;
      if (Math.sin(t * 2 + i * 7) < 0.2) continue;
      Engine.box(M4.mul(M4.T(x, y, z), M4.S(0.05, 0.05, 0.05)), [0.8, 1, 0.4], [0.75, 1, 0.35, 1]);
    }
  },
  titleCam(dt) {
    if (!this.M) return;
    const c = Engine.cam; this._tt = (this._tt || 0) + dt * 0.05;
    const F = this.M.camp;
    c.tx = F.x; c.ty = F.y + 1.2; c.tz = F.z; c.dist = 10; c.pitch = 0.22; c.yaw = this._tt; c.fov = 0.85; Engine.cut = 999;
    Engine.fadeTarget = null;
    this.env(); this.lights();
    drawCampPiece(this.fire, performance.now() / 1000, false);
  },
  // tap on the 3D view: use what you tapped
  onTap(sx, sy) {
    if (this.mode !== 'play') return;
    if (this.place) return this.confirmPlace();
    const r = Engine.ray(sx, sy); let best = null, bt = 1e9;
    for (const c of this.interactables()) {
      const tt = rayAABB(r.o, r.d, [c.x - 0.7, c.y - 0.2, c.z - 0.7], [c.x + 0.7, c.y + (c.k === 'tree' ? 4 : 1.6), c.z + 0.7]);
      if (tt >= 0 && tt < bt) { bt = tt; best = c; }
    }
    if (best && Math.hypot(best.x - this.P.x, best.z - this.P.z) < 3.2) { this.P.face = Math.atan2(best.x - this.P.x, best.z - this.P.z); this.use(best); return; }
    const e = AI.rayPick(r);
    if (e && Math.hypot(e.x - this.P.x, e.z - this.P.z) < 4) { this.P.face = Math.atan2(e.x - this.P.x, e.z - this.P.z); this.attack(); }
  }
};

const PLAYER_LOOK = { skin: 1, hair: 'short', hairCol: 1, shirt: 0, pants: 0, pack: true };
const PIECE_LBL = { campfire: 'Campfire', bench: 'Workbench', bed: 'Leaf Bed', storage: 'Storage Box', rack: 'Drying Rack', collector: 'Rain Collector', torchpost: 'Torch Post', trap: 'Spike Trap', shelter: 'Shelter', signal: 'Signal Fire' };
const STORY_INTRO = [
  'The supply flight to the Ostrand Expedition never made it. Somewhere over the reef the engines failed, and the jungle swallowed the plane.',
  'You are the only one who walked away. Above the beach someone has already made a clearing and a fire. It is still warm.',
  'The expedition went silent a year ago. Their research station is somewhere on the high ground to the north-east.',
  'Survive. Find the others. Repair the radio. Whatever you do, keep the fire burning when the sun goes down.'
];
