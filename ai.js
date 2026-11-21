'use strict';
/* =========================================================
   UNDERGROWTH - creatures, the Painted tribes and the Hollow
   ========================================================= */
const TRIBES = {
  red: { name: 'the Painted', village: 'villageW', col: [0.75, 0.12, 0.1] },
  bone: { name: 'the Bone tribe', village: 'villageN', col: [0.88, 0.84, 0.72] }
};
const ANIMALS = {
  boar: { hp: 45, spd: 2.2, drops: [['meat_raw', 2], ['bone', 1]] },
  jaguar: { hp: 75, spd: 2.6, drops: [['meat_raw', 3], ['bone', 2]] },
  snake: { hp: 14, spd: 1.2, drops: [['meat_raw', 1]] },
  caiman: { hp: 90, spd: 2.0, drops: [['meat_raw', 3], ['bone', 1]] },
  bird: { hp: 1, spd: 6 }
};

const AI = {
  list: [], spawnT: 0, waveT: 0, hollowT: 0, beatT: 0, drumT: 0,
  ents() { return this.list; },
  reset() {
    this.list = []; this.spawnT = 1; this.waveT = 0; this.hollowT = 0;
    for (const tr in TRIBES) this.spawnVillage(tr);
    if (Game.isNight()) this.onNight(Game.S.night, true);
  },

  /* ---------- spawning ---------- */
  mk(type, x, y, z, o) {
    const A = ANIMALS[type] || {};
    const e = Object.assign({ type, x, y, z, face: Math.random() * 6.28, hp: A.hp || 50, state: 'idle', st: 0, phase: 0, moving: false, hitT: 0, dead: false, deadT: 0, atkCD: 0, wx: x, wz: z, seed: Math.random() * 100 }, o || {});
    e.maxhp = e.hp; this.list.push(e); return e;
  },
  painted(tribe, x, z, role, o) {
    const y = Game.groundY(x, z, Game.M.gy(x, z));
    const bone = tribe === 'bone', archer = Math.random() < (role === 'village' ? 0.25 : 0.3);
    const look = bone ? { skin: 3, hair: 'bald', paint: true, mask: 2, feather: Math.random() < 0.5 } : { skin: Math.random() < 0.5 ? 2 : 3, hair: Math.random() < 0.5 ? 'long' : 'bald', hairCol: 0, paint: true, mask: Math.random() < 0.4 ? 1 : 0, feather: Math.random() < 0.3 };
    const weapon = archer ? 'bow' : bone ? (Math.random() < 0.5 ? 'club' : 'bone_spear') : (Math.random() < 0.5 ? 'spear' : 'club');
    return this.mk('painted', x, y, z, Object.assign({ tribe, role, look, archer, weapon, hp: bone ? 65 : 50, hostile: true, swing: 0 }, o || {}));
  },
  spawnVillage(tr) {
    const S = Game.S, P = POI[TRIBES[tr].village];
    const alive = this.list.filter(e => e.tribe === tr && e.role === 'village' && !e.dead).length;
    const want = Math.min(S.pop[tr], 5) - alive;
    for (let i = 0; i < want; i++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 6; this.painted(tr, P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 'village', { home: { x: P.x, z: P.z } }); }
  },
  liveTribes() { return Object.keys(TRIBES).filter(t => Game.S.pop[t] > 0); },
  spawnRaid(tr, n, ang) {
    const F = Game.fire;
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * 0.5, r = 34 + Math.random() * 6;
      const x = clamp(F.x + Math.cos(a) * r, 6, MW - 7), z = clamp(F.z + Math.sin(a) * r, 6, MD - 7);
      this.painted(tr, x, z, 'raid', { state: 'march' });
    }
    this.drumT = 25;
  },
  onNight(n, resume) {
    const tribes = this.liveTribes();
    if (n >= 2 && tribes.length) {
      const size = Math.min(2 + Math.floor(n / 2), 8);
      const tr = tribes[Math.floor(Math.random() * tribes.length)];
      this.spawnRaid(tr, resume ? Math.ceil(size / 2) : size, Math.random() * 6.28);
      if (tribes.length === 2 && n >= 6 && Math.random() < 0.35) this.spawnRaid(tribes.find(t => t !== tr), Math.ceil(size / 2), Math.random() * 6.28);
      if (n >= 8) this.waveT = 70;
      if (!resume) UI.toast('Drums. A raiding party is coming for your camp.', 'bad');
    }
    if (n >= 3 || n === 1) this.hollowT = n === 1 ? 70 : 18;
  },
  clearNight(wipe) {
    this.waveT = 0; this.hollowT = 0;
    for (const e of this.list) {
      if (e.type === 'hollow') e.remove = true;
      if (e.role === 'raid' || e.role === 'scout') { if (wipe) e.remove = true; else { e.state = 'retreat'; } }
    }
    this.list = this.list.filter(e => !e.remove);
    for (const tr in TRIBES) this.spawnVillage(tr);
  },
  spawnHollow() {
    const P = Game.P;
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * 6.28, r = 26 + Math.random() * 8, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (x < 4 || z < 4 || x > MW - 5 || z > MD - 5) continue;
      if (Game.inLight(x, z, true)) continue;
      const y = Game.M.gy(x, z); if (y <= SEA) continue;
      const n = Game.S.night;
      this.mk('hollow', x, y, z, { hp: 380 + n * 12, hostile: true, state: 'hunt', shy: n <= 1, life: 45 });
      if (!this._hollowSeen) { this._hollowSeen = 1; UI.toast('Something tall is moving in the dark.', 'bad'); }
      return;
    }
  },
  ambientSpawn() {
    const P = Game.P, night = Game.isNight(), W = Game.W;
    const cnt = t => this.list.filter(e => e.type === t && !e.dead).length;
    const caps = { boar: night ? 2 : 3, jaguar: night ? 2 : 1, snake: 2, bird: night ? 0 : 5, caiman: 2 };
    const types = Object.keys(caps).filter(t => cnt(t) < caps[t]);
    if (!types.length) return;
    const type = types[Math.floor(Math.random() * types.length)];
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * 6.28, r = 26 + Math.random() * 18, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (x < 4 || z < 4 || x > MW - 5 || z > MD - 5) continue;
      const F = Game.fire; if (Math.hypot(x - F.x, z - F.z) < 18) continue;
      if (Object.values(POI).some(p => p !== POI.lake && Math.hypot(x - p.x, z - p.z) < p.r + 3)) continue;
      if (type === 'caiman') { const wy = this.waterTop(x, z, SEA); if (wy === null || this.waterDepth(x, wy, z) < 2) continue; this.mk('caiman', x, wy - 0.3, z, { hostile: true, state: 'lurk', submerged: true }); return; }
      const y = Game.M.gy(x, z); if (y <= SEA + 1 && type !== 'bird') continue;
      if (W.get(Math.floor(x), y, Math.floor(z)) === B.WATER) continue;
      if (type === 'bird') { this.mk('bird', x, y + 9 + Math.random() * 5, z, { col: [[0.75, 0.15, 0.1], [0.15, 0.4, 0.7], [0.9, 0.75, 0.15], [0.1, 0.1, 0.1]][k % 4], cx: x, cz: z, cr: 4 + Math.random() * 6 }); return; }
      this.mk(type, x, y, z, { hostile: type !== 'boar', state: type === 'snake' ? 'coil' : 'wander', aggro: type === 'boar' && Math.random() < 0.35 });
      return;
    }
  },
  waterTop(x, z, yHint) { const W = Game.W, cx = Math.floor(x), cz = Math.floor(z); for (let y = Math.round(yHint) + 4; y > Math.round(yHint) - 8; y--) if (W.get(cx, y, cz) === B.WATER && W.get(cx, y + 1, cz) !== B.WATER) return y + 1; return null; },
  waterDepth(x, top, z) { const W = Game.W; let d = 0; for (let y = top - 1; y > 0 && W.get(Math.floor(x), y, Math.floor(z)) === B.WATER; y--) d++; return d; },

  /* ---------- update ---------- */
  update(dt) {
    const G = Game, S = G.S, P = G.P, night = G.isNight();
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawnT = 3; this.ambientSpawn(); }
    if (this.hollowT > 0) { this.hollowT -= dt; if (this.hollowT <= 0 && night) { const n = S.night, want = n === 1 ? 1 : n >= 25 ? 3 : n >= 10 ? 2 : 1; for (let i = this.list.filter(e => e.type === 'hollow').length; i < want; i++) this.spawnHollow(); } }
    if (this.waveT > 0) { this.waveT -= dt; if (this.waveT <= 0 && night) { const tr = this.liveTribes(); if (tr.length) { this.spawnRaid(tr[0], Math.min(3 + Math.floor(S.night / 4), 6), Math.random() * 6.28); UI.toast('More drums. A second wave.', 'bad'); } } }
    if (!night && S.night >= 1) { S.scoutT -= dt; if (S.scoutT <= 0) { S.scoutT = 150 + Math.random() * 120; const tr = this.liveTribes(); if (tr.length && Math.random() < 0.5) { const a = Math.random() * 6.28; for (let i = 0; i < 2; i++) this.painted(tr[0], clamp(P.x + Math.cos(a) * 30 + i, 6, MW - 7), clamp(P.z + Math.sin(a) * 30, 6, MD - 7), 'scout', { state: 'watch', st: 70 }); } } }
    if (this.drumT > 0) { this.drumT -= dt; Sfx.drums(dt); }
    let nearHollow = 99;
    for (const e of this.list) {
      if (e.hitT > 0) e.hitT -= dt;
      if (e.atkCD > 0) e.atkCD -= dt;
      if (e.dead) { e.deadT += dt; continue; }
      const dx = P.x - e.x, dz = P.z - e.z, dp = Math.hypot(dx, dz);
      e.dp = dp;
      switch (e.type) {
        case 'boar': this.boar(e, dt, dp); break;
        case 'jaguar': this.jaguar(e, dt, dp); break;
        case 'snake': this.snake(e, dt, dp); break;
        case 'caiman': this.caiman(e, dt, dp); break;
        case 'bird': this.bird(e, dt); break;
        case 'painted': this.human(e, dt, dp); break;
        case 'hollow': this.hollow(e, dt, dp); nearHollow = Math.min(nearHollow, dp); break;
      }
      if (e.swing > 0) { e.swing += dt / 0.55; if (e.swing >= 1) e.swing = 0; }
      if (e.moving) e.phase += dt * 9;
      // despawn far wildlife
      if (dp > 70 && e.role !== 'village' && e.type !== 'hollow') e.remove = true;
      if (e.state === 'retreat' && dp > 42) e.remove = true;
    }
    this.list = this.list.filter(e => !e.remove && !(e.dead && e.deadT > 25));
    // the Hollow presses on your mind
    if (nearHollow < 18) { S.p.sanity = Math.max(0, S.p.sanity - dt * 0.9 * (1 - nearHollow / 18)); this.beatT -= dt; if (this.beatT <= 0) { this.beatT = 0.45 + nearHollow / 18 * 0.8; Sfx.play('beat'); } }
    G.nearHollow = nearHollow;
    // traps
    for (const p of S.pieces) if (p.type === 'trap' && !p.sprung) for (const e of this.list) if (!e.dead && e.type !== 'bird' && e.type !== 'hollow' && Math.hypot(e.x - p.x, e.z - p.z) < 0.8) { p.sprung = true; this.damage(e, 70, 'trap'); Sfx.play('trap'); break; }
  },
  // shared movement: steer toward a point; humans hit walls that block them
  go(e, tx, tz, spd, dt, breaker) {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d < 0.2) { e.moving = false; return true; }
    let mx = dx / d, mz = dz / d;
    if (e.detour > 0) { e.detour -= dt; const s = e.detourS; const nx = mx * Math.cos(s) - mz * Math.sin(s), nz = mx * Math.sin(s) + mz * Math.cos(s); mx = nx; mz = nz; }
    e.face = lerpAng(e.face, Math.atan2(mx, mz), Math.min(1, dt * 8));
    const ok = Game.stepEnt(e, mx, mz, Math.min(d, spd * dt), dt, 0.3);
    e.moving = ok;
    if (!ok) {
      e.blockT = (e.blockT || 0) + dt;
      if (breaker && e.atkCD <= 0) {
        // smash player-built walls in the way
        const W = Game.W;
        for (const h of [1, 0, 2]) { const bx = Math.floor(e.x + mx * 0.9), bz = Math.floor(e.z + mz * 0.9), by = Math.round(e.y) + h - 1 + 1; if (BHP[W.get(bx, by, bz)] && Game.S.edits[W.idx(bx, by, bz)]) { e.atkCD = 1.1; e.swing = 0.0001; if (W.get(bx, by, bz) === B.STAKE) this.damage(e, 6, 'stakes'); Game.hitBlock(bx, by, bz, 12, false); return false; } }
      }
      if (e.blockT > 0.5) { e.blockT = 0; e.detour = 0.8 + Math.random() * 0.8; e.detourS = (Math.random() < 0.5 ? 1 : -1) * (1.0 + Math.random() * 0.6); }
    } else e.blockT = 0;
    return false;
  },
  wander(e, dt, spd, R) {
    e.st -= dt;
    if (e.st <= 0) { e.st = 3 + Math.random() * 5; const a = Math.random() * 6.28, r = Math.random() * (R || 8); e.tx = (e.home ? e.home.x : e.wx) + Math.cos(a) * r; e.tz = (e.home ? e.home.z : e.wz) + Math.sin(a) * r; e.pause = Math.random() < 0.4; }
    if (e.pause) { e.moving = false; return; }
    if (this.go(e, e.tx, e.tz, spd, dt)) e.pause = true;
  },
  fearFire(e, dt) {
    const F = Game.fire, r = Game.fireR();
    if (r && Math.hypot(e.x - F.x, e.z - F.z) < r + 1.5) { const a = Math.atan2(e.x - F.x, e.z - F.z); this.go(e, e.x + Math.sin(a) * 4, e.z + Math.cos(a) * 4, 3, dt); return true; }
    return false;
  },
  playerHidden() { return Game.mode !== 'play' || Game.S.p.hp <= 0; },
  boar(e, dt, dp) {
    const P = Game.P;
    if (e.hp < 15) { e.state = 'flee'; }
    if (e.state === 'flee') { const a = Math.atan2(e.x - P.x, e.z - P.z); this.go(e, e.x + Math.sin(a) * 5, e.z + Math.cos(a) * 5, 4.5, dt); return; }
    if (e.state === 'wander') { this.wander(e, dt, 1.4); if (e.aggro && dp < 7 && !this.playerHidden()) { e.state = 'charge'; e.st = 3; Sfx.play('grunt'); } return; }
    if (e.state === 'charge') {
      e.st -= dt; this.go(e, P.x, P.z, 6.2, dt);
      if (dp < 1.1 && e.atkCD <= 0) { e.atkCD = 1.6; Game.hurt(12, 'a wild boar', { bleed: 0.2 }); e.state = 'back'; e.st = 1.4; }
      if (e.st <= 0 || dp > 16) { e.state = 'back'; e.st = 1.5; }
      return;
    }
    if (e.state === 'back') { e.st -= dt; const a = Math.atan2(e.x - P.x, e.z - P.z); this.go(e, e.x + Math.sin(a) * 3, e.z + Math.cos(a) * 3, 3, dt); if (e.st <= 0) e.state = dp < 9 ? 'charge' : 'wander', e.st = 3; }
  },
  jaguar(e, dt, dp) {
    const P = Game.P, night = Game.isNight();
    if (this.fearFire(e, dt)) return;
    if (Game.S.equip === 'torch' && dp < 6 && e.state !== 'pounce') { e.state = 'retreat2'; e.st = 3; }
    if (e.hp < 25) e.state = 'flee';
    switch (e.state) {
      case 'flee': case 'retreat2': { e.st -= dt; const a = Math.atan2(e.x - P.x, e.z - P.z); this.go(e, e.x + Math.sin(a) * 5, e.z + Math.cos(a) * 5, 5, dt); if (e.state === 'retreat2' && e.st <= 0) e.state = 'wander'; if (e.state === 'flee' && dp > 35) e.remove = true; break; }
      case 'wander': this.wander(e, dt, 1.6, 12); if (dp < (night ? 24 : 16) && !this.playerHidden()) { e.state = 'stalk'; e.st = 5 + Math.random() * 5; } break;
      case 'stalk': {
        e.st -= dt;
        const a = Math.atan2(e.x - P.x, e.z - P.z) + dt * 0.4, R = 8;
        this.go(e, P.x + Math.sin(a) * R, P.z + Math.cos(a) * R, 2.2, dt); e.face = Math.atan2(P.x - e.x, P.z - e.z);
        if (e.st <= 0 || dp < 4.5) { e.state = 'pounce'; e.st = 2.5; Sfx.play('growl'); }
        if (dp > 34) e.state = 'wander';
        break;
      }
      case 'pounce': {
        e.st -= dt; this.go(e, P.x, P.z, 7.5, dt);
        if (dp < 1.3 && e.atkCD <= 0) { e.atkCD = 1.2; Game.hurt(20, 'a jaguar', { bleed: 0.6 }); e.state = 'retreat2'; e.st = 2.5; }
        if (e.st <= 0) { e.state = 'stalk'; e.st = 4 + Math.random() * 4; }
        break;
      }
    }
  },
  snake(e, dt, dp) {
    const P = Game.P;
    if (e.state === 'coil') {
      e.moving = false; if (dp < 7) e.face = lerpAng(e.face, Math.atan2(P.x - e.x, P.z - e.z), dt * 3);
      if (dp < 2.0 && e.atkCD <= 0 && Math.abs(P.y - e.y) < 1.5) { e.atkCD = 2.2; Sfx.play('hiss'); Game.hurt(7, 'a snake bite', { poison: 45 }); }
      e.st -= dt; if (e.st <= 0) { e.st = 10 + Math.random() * 10; if (Math.random() < 0.4) { e.state = 'slither'; e.st = 3; e.tx = e.x + (Math.random() - 0.5) * 8; e.tz = e.z + (Math.random() - 0.5) * 8; } }
    } else { e.st -= dt; if (this.go(e, e.tx, e.tz, 1.2, dt) || e.st <= 0) { e.state = 'coil'; e.st = 10; } }
  },
  caiman(e, dt, dp) {
    const P = Game.P, W = Game.W;
    const inWater = (x, z) => { const t = this.waterTop(x, z, e.y + 0.3); return t !== null && Math.abs(t - (e.y + 0.3)) < 1.6 ? t : null; };
    const moveW = (tx, tz, spd) => {
      const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d < 0.3) { e.moving = false; return true; }
      const nx = e.x + dx / d * Math.min(d, spd * dt), nz = e.z + dz / d * Math.min(d, spd * dt), t = inWater(nx, nz);
      e.face = lerpAng(e.face, Math.atan2(dx, dz), dt * 5);
      if (t !== null) { e.x = nx; e.z = nz; e.y += (t - 0.3 - e.y) * dt * 4; e.moving = true; return false; }
      e.moving = false; return true;
    };
    if (e.state === 'lurk') {
      e.submerged = true; e.st -= dt;
      if (e.st <= 0) { e.st = 4 + Math.random() * 4; e.tx = e.x + (Math.random() - 0.5) * 10; e.tz = e.z + (Math.random() - 0.5) * 10; }
      if (e.tx !== undefined && moveW(e.tx, e.tz, 1.2)) e.tx = undefined;
      if (dp < 7 && Game.waterNear() && !this.playerHidden()) { e.state = 'lunge'; e.st = 2.2; e.submerged = false; Sfx.play('growl'); }
    } else if (e.state === 'lunge') {
      e.st -= dt; moveW(P.x, P.z, 5.5);
      if (dp < 1.8 && e.atkCD <= 0) { e.atkCD = 2; Game.hurt(24, 'a caiman', { bleed: 0.5 }); e.state = 'lurk'; e.st = 3; }
      if (e.st <= 0) { e.state = 'lurk'; e.st = 3; }
    }
  },
  bird(e, dt) {
    e.ang = (e.ang || e.seed) + dt * (6 / (e.cr || 6));
    const nx = e.cx + Math.cos(e.ang) * e.cr, nz = e.cz + Math.sin(e.ang) * e.cr;
    e.face = Math.atan2(nx - e.x, nz - e.z); e.x = nx; e.z = nz;
    if (e.flee) { e.y += dt * 4; if (e.y > 40) e.remove = true; }
    if (e.dp < 6) e.flee = true;
  },
  human(e, dt, dp) {
    const G = Game, P = G.P, night = G.isNight(), W = G.W;
    if (e.hp < e.maxhp * 0.2 && e.role !== 'village' && !e.fled) { e.state = 'retreat'; e.fled = 1; }
    // rival tribe nearby?
    if (!e.foe || e.foe.dead || Math.hypot(e.foe.x - e.x, e.foe.z - e.z) > 14) {
      e.foe = null;
      if (Math.random() < dt * 2) for (const o of this.list) if (o.type === 'painted' && !o.dead && o.tribe !== e.tribe && Math.hypot(o.x - e.x, o.z - e.z) < 10) { e.foe = o; break; }
    }
    const engage = (tx, tz, ty, target) => {
      const d = Math.hypot(tx - e.x, tz - e.z);
      if (e.archer) {
        if (d > 13) this.go(e, tx, tz, 3.2, dt, true);
        else if (d < 6) { const a = Math.atan2(e.x - tx, e.z - tz); this.go(e, e.x + Math.sin(a) * 3, e.z + Math.cos(a) * 3, 3, dt); }
        else e.moving = false;
        e.face = lerpAng(e.face, Math.atan2(tx - e.x, tz - e.z), dt * 8);
        if (e.atkCD <= 0 && d < 16 && W.los([e.x, e.y + 1.5, e.z], [tx, ty + 1.2, tz])) {
          e.atkCD = 2.4 + Math.random(); e.aimT = 0.4;
          const dy = ty + 1.1 - (e.y + 1.5), dir = V3.norm([tx - e.x + (Math.random() - 0.5) * 1.2, dy + d * 0.12, tz - e.z + (Math.random() - 0.5) * 1.2]);
          G.proj.push({ x: e.x + dir[0] * 0.6, y: e.y + 1.5, z: e.z + dir[2] * 0.6, vx: dir[0] * 20, vy: dir[1] * 20, vz: dir[2] * 20, life: 2, from: 'enemy', dmg: 9, src: e, tgt: target });
          Sfx.play('bow', 0.5);
        }
      } else {
        if (d > 1.5) this.go(e, tx, tz, night || e.role !== 'village' ? 4.4 : 4, dt, true); else { e.moving = false; e.face = Math.atan2(tx - e.x, tz - e.z); }
        if (d < 1.8 && e.atkCD <= 0) {
          e.atkCD = 1.3 + Math.random() * 0.4; e.swing = 0.0001;
          const dmg = (e.tribe === 'bone' ? 13 : 10) + Math.random() * 5;
          setTimeout(() => {
            if (e.dead) return;
            if (target === 'player') { if (Math.hypot(P.x - e.x, P.z - e.z) < 2.2) G.hurt(dmg, e.tribe === 'bone' ? 'the Bone tribe' : 'the Painted', { bleed: 0.3 }); }
            else if (target && !target.dead) this.damage(target, dmg, e);
          }, 250);
        }
      }
    };
    if (e.foe) { engage(e.foe.x, e.foe.z, e.foe.y, e.foe); return; }
    const sees = dp < (night ? 16 : 11) && !this.playerHidden() && (dp < 5 || W.los([e.x, e.y + 1.6, e.z], [P.x, P.y + 1.6, P.z]));
    switch (e.state) {
      case 'idle': case 'wander':
        this.wander(e, dt, 1.4, 8);
        if (sees || (e.hitBy && dp < 30)) { e.state = 'chase'; if (!this._warned) { this._warned = 1; } Sfx.play('shout'); }
        break;
      case 'chase': {
        engage(P.x, P.z, P.y, 'player');
        const home = e.home; if (home && Math.hypot(e.x - home.x, e.z - home.z) > 32) e.state = 'return';
        if (dp > 34) e.state = home ? 'return' : 'retreat';
        break;
      }
      case 'return': if (this.go(e, e.home.x, e.home.z, 3, dt)) e.state = 'wander'; if (sees && dp < 8) e.state = 'chase'; break;
      case 'march': {
        // head for the camp, fight you on sight, kick the fire
        const F = G.fire;
        if (dp < 18 && !this.playerHidden()) { e.state = 'chase'; Sfx.play('shout'); break; }
        if (Math.hypot(e.x - F.x, e.z - F.z) < 2.2) { e.moving = false; if (e.atkCD <= 0) { e.atkCD = 2; e.swing = 0.0001; F.fuel = Math.max(0, F.fuel - 35); if (!this._kick) { this._kick = 1; UI.toast('Raiders are scattering your campfire', 'bad'); } setTimeout(() => this._kick = 0, 8000); } }
        else this.go(e, F.x, F.z, 3.4, dt, true);
        break;
      }
      case 'watch': {
        e.st -= dt; e.face = lerpAng(e.face, Math.atan2(P.x - e.x, P.z - e.z), dt * 4);
        if (dp < 10) { if (G.S.night > 4) e.state = 'chase'; else e.state = 'retreat'; }
        else if (dp > 26) this.go(e, P.x, P.z, 2, dt); else e.moving = false;
        if (e.st <= 0) e.state = 'retreat';
        break;
      }
      case 'retreat': { const a = Math.atan2(e.x - P.x, e.z - P.z); this.go(e, e.x + Math.sin(a) * 5, e.z + Math.cos(a) * 5, 4.2, dt); break; }
    }
  },
  hollow(e, dt, dp) {
    const G = Game, P = G.P;
    if (!G.isNight()) { e.remove = true; return; }
    for (const fl of G.flares) if (Math.hypot(e.x - fl.x, e.z - fl.z) < 16) { e.state = 'flee'; e.st = 6; }
    if (e.hp <= 0 && e.state !== 'flee') { e.state = 'flee'; e.st = 8; }
    if (e.shy) { // the first night it only watches you from the trees
      e.life -= dt; e.moving = false; e.face = lerpAng(e.face, Math.atan2(P.x - e.x, P.z - e.z), dt * 3);
      if (dp > 22) { const a = Math.atan2(P.x - e.x, P.z - e.z); e.x += Math.sin(a) * dt * 3; e.z += Math.cos(a) * dt * 3; e.y += (G.M.gy(e.x, e.z) - e.y) * dt * 4; e.moving = true; }
      if (dp < 11 || e.life <= 0 || G.inLight(e.x, e.z, true)) e.remove = true;
      return;
    }
    if (e.state === 'flee') { e.st -= dt; const a = Math.atan2(e.x - P.x, e.z - P.z); const nx = e.x + Math.sin(a) * dt * 6, nz = e.z + Math.cos(a) * dt * 6; e.x = nx; e.z = nz; e.y += (G.M.gy(nx, nz) - e.y) * dt * 4; e.moving = true; if (e.st <= 0) { if (e.hp <= 0) e.remove = true; else e.state = 'hunt'; } return; }
    // glide toward the player, never entering light
    const spd = dp > 24 ? 4.2 : 2.5;
    const a = Math.atan2(P.x - e.x, P.z - e.z);
    let nx = e.x + Math.sin(a) * spd * dt, nz = e.z + Math.cos(a) * spd * dt;
    if (G.inLight(nx, nz, true)) {
      // circle at the edge of the light
      const t = a + Math.PI / 2 * (e.seed > 50 ? 1 : -1);
      nx = e.x + Math.sin(t) * 1.4 * dt; nz = e.z + Math.cos(t) * 1.4 * dt;
      if (G.inLight(nx, nz, true)) { nx = e.x - Math.sin(a) * 2 * dt; nz = e.z - Math.cos(a) * 2 * dt; }
      e.state = 'wait';
    } else e.state = 'hunt';
    e.x = nx; e.z = nz; e.face = lerpAng(e.face, a, dt * 3); e.moving = true;
    e.y += (G.M.gy(nx, nz) - e.y) * Math.min(1, dt * 5);
    if (dp < 2.0 && e.atkCD <= 0 && !G.inLight(P.x, P.z, true)) { e.atkCD = 2; e.state = 'attack'; Sfx.play('shriek'); G.hurt(26, 'the Hollow', { sanity: 15, bleed: 0.3 }); }
  },

  /* ---------- combat ---------- */
  bodyBox(e) {
    const t = e.type, r = t === 'hollow' ? 0.5 : t === 'snake' ? 0.5 : t === 'bird' ? 0.3 : t === 'caiman' ? 0.9 : t === 'boar' || t === 'jaguar' ? 0.65 : 0.4;
    const h = t === 'hollow' ? 3.3 : t === 'snake' ? 0.4 : t === 'caiman' ? 0.6 : t === 'boar' ? 0.9 : t === 'jaguar' ? 1 : t === 'bird' ? 0.3 : 1.9;
    return [[e.x - r, e.y - (t === 'caiman' ? 0.4 : 0), e.z - r], [e.x + r, e.y + h, e.z + r]];
  },
  hitTest(x, y, z, f, reach, cone) {
    let best = null, bd = 1e9;
    for (const e of this.list) {
      if (e.dead || e.type === 'bird') continue;
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz), pad = e.type === 'caiman' || e.type === 'jaguar' || e.type === 'boar' ? 0.5 : 0.2;
      if (d > reach + pad || Math.abs(e.y - y) > 2.5) continue;
      if (d > 0.6 && (dx * f[0] + dz * f[1]) / d < cone) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },
  pointHit(x, y, z) { for (const e of this.list) { if (e.dead || e.type === 'bird') continue; const [a, b] = this.bodyBox(e); if (x > a[0] && x < b[0] && y > a[1] && y < b[1] && z > a[2] && z < b[2]) return e; } return null; },
  rayPick(r) { let best = null, bt = 1e9; for (const e of this.list) { if (e.dead) continue; const [a, b] = this.bodyBox(e); const t = rayAABB(r.o, r.d, a, b); if (t >= 0 && t < bt) { bt = t; best = e; } } return best; },
  nearestHostile(x, z, r, ranged) {
    let best = null, bd = r;
    for (const e of this.list) { if (e.dead || e.type === 'bird' || (e.type === 'boar' && !ranged && e.state === 'wander' && !e.aggro && false)) continue; const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } }
    return best;
  },
  damage(e, dmg, src, dir, stagger) {
    if (e.dead) return;
    e.hp -= dmg; e.hitT = 0.2;
    if (dir && e.type !== 'hollow' && e.type !== 'caiman') { Game.stepEnt(e, dir[0], dir[2] !== undefined ? dir[2] : dir[1], stagger ? 0.7 : 0.3, 0.1, 0.3); }
    Game.fxBurst(e.x, e.y + 0.8, e.z, e.type === 'hollow' ? [0.05, 0.05, 0.05] : [0.6, 0.05, 0.05], 5);
    if (src === 'player') e.hitBy = true;
    if (e.type === 'boar' && e.state === 'wander') { e.state = 'charge'; e.st = 3; e.aggro = true; }
    if (e.type === 'jaguar' && e.state !== 'flee') { e.state = 'pounce'; e.st = 2; }
    if (e.type === 'snake') { e.state = 'coil'; }
    if (e.type === 'painted' && src && src.type === 'painted') e.foe = src;
    if (e.type === 'painted' && src === 'player' && e.state !== 'chase') e.state = 'chase';
    if (e.type === 'hollow') { if (e.hp <= 0) { e.state = 'flee'; e.st = 8; Sfx.play('shriek'); UI.toast('The Hollow recoils into the dark'); } return; }
    if (e.hp <= 0) this.kill(e, src);
    else if (e.type === 'painted') Sfx.play('grunt', 0.6);
  },
  kill(e, src) {
    const G = Game, S = G.S;
    e.dead = true; e.deadT = 0; e.moving = false;
    if (src === 'player' || src === 'trap') S.stats.kills++;
    const drops = e.type === 'painted' ? [['bone', 1], Math.random() < 0.5 ? ['cloth', 1] : null, Math.random() < 0.45 ? ['flesh_raw', 1] : null, e.archer ? ['arrows', 3] : null, Math.random() < 0.15 ? [e.weapon === 'bow' ? 'bow' : e.weapon, 1] : null].filter(Boolean) : (ANIMALS[e.type] && ANIMALS[e.type].drops) || [];
    for (const [id, n] of drops) if (ITEMS[id]) for (let i = 0; i < n; i++) G.dropItem(id, 1, e.x, e.y, e.z);
    if (e.type === 'painted') {
      Sfx.play('die');
      const tr = e.tribe; S.pop[tr] = Math.max(0, S.pop[tr] - 1);
      if (S.pop[tr] === 0) {
        UI.banner(`${POI[TRIBES[tr].village].name} has fallen`, `${TRIBES[tr].name[0].toUpperCase() + TRIBES[tr].name.slice(1)} will raid no more`);
        for (const o of this.list) if (o.tribe === tr && !o.dead) o.state = 'retreat';
        if (!this.liveTribes().length) setTimeout(() => UI.toast('The drums have stopped. Only the Hollow remains.', 'good'), 4000);
      }
    } else Sfx.play('animaldie');
  },

  /* ---------- drawing ---------- */
  draw(t) {
    const P = Game.P;
    for (const e of this.list) {
      if (Math.abs(e.x - P.x) > 45 || Math.abs(e.z - P.z) > 45) continue;
      const y0 = e.y; e.y = Game.visY(e.x, e.z, y0);
      switch (e.type) {
        case 'boar': drawBoar(e, t); break;
        case 'jaguar': drawJaguar(e, t); break;
        case 'snake': drawSnake(e, t); break;
        case 'caiman': drawCaiman(e, t); break;
        case 'bird': drawBird(e, t); break;
        case 'hollow': drawHollow(e, t); break;
        case 'painted': drawPerson(e.x, e.y, e.z, e.face, e.look, { walk: e.moving, phase: e.phase, swing: e.swing, hold: e.weapon, aim: e.aimT > 0 && (e.aimT -= 0.016) > 0, dead: e.dead, deadK: Math.min(1, e.deadT * 3), t }, e.hitT > 0 ? [1, 0.2, 0.2, 0.4] : null); break;
      }
      e.y = y0;
    }
  }
};
