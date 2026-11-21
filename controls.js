'use strict';
/* =========================================================
   UNDERGROWTH - camera views and analogue controls
   third person (default) and first person
   ========================================================= */
const VIEW_NAMES = { third: 'Third person', first: 'First person' };
const Controls = {
  view: 'third', yaw: Math.PI, pitch: 0.32, dist: 5.2, cd: 5.2, stk: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, keys: {}, bob: 0, mag: 0,
  init() {
    const pad = $('#lookpad'), zone = $('#stickzone');
    // stick
    zone.addEventListener('pointerdown', e => {
      if (this.stk.id !== null) return;
      e.preventDefault(); zone.setPointerCapture(e.pointerId);
      const S = this.stk; S.id = e.pointerId; S.ox = e.clientX; S.oy = e.clientY; S.x = 0; S.y = 0;
      const b = $('#stickBase'); b.style.left = e.clientX + 'px'; b.style.top = e.clientY + 'px'; b.classList.add('on');
      $('#stickKnob').style.transform = 'translate(-50%,-50%)';
    });
    zone.addEventListener('pointermove', e => {
      const S = this.stk; if (e.pointerId !== S.id) return;
      const R = 54; let dx = e.clientX - S.ox, dy = e.clientY - S.oy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      S.x = dx / R; S.y = dy / R;
      $('#stickKnob').style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    });
    const end = e => { const S = this.stk; if (e.pointerId !== S.id) return; S.id = null; S.x = 0; S.y = 0; $('#stickBase').classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    // look pad: drag to look, tap to use what you tapped, pinch to zoom
    const pts = new Map();
    pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }); });
    pad.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this._pd) this.zoom(this._pd / d); this._pd = d; return;
      }
      const iv = Game.settings.invLook ? -1 : 1;
      this.yaw -= dx * 0.0058 * iv;
      this.pitch = clamp(this.pitch + dy * 0.0045 * iv, this.view === 'first' ? -1.2 : -0.15, this.view === 'first' ? 1.25 : 1.15);
    });
    const pend = e => {
      const p = pts.get(e.pointerId); if (!p) return; pts.delete(e.pointerId); this._pd = 0;
      if (p.moved < 12 && performance.now() - p.t < 350) Game.onTap(e.clientX, e.clientY);
    };
    pad.addEventListener('pointerup', pend); pad.addEventListener('pointercancel', e => { pts.delete(e.pointerId); this._pd = 0; });
    pad.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
    // keyboard
    addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase(); this.keys[k] = true;
      if (Game.mode !== 'play') return;
      if (k === 'escape') { if (UI.modal) UI.close(); else if (Game.place) Game.cancelPlace(); else UI.pause(); return; }
      if (UI.modal) { if (k === 'tab' || k === 'b' || k === 'i') { e.preventDefault(); UI.close(); } return; }
      if (k === 'v') this.cycle();
      if (k === 'e') { if (Game.place) Game.confirmPlace(); else Game.use(); }
      if (k === 'f' || k === ' ') { e.preventDefault(); if (Game.place) Game.confirmPlace(); else Game.attack(); }
      if (k === 'tab' || k === 'b' || k === 'i') { e.preventDefault(); UI.bag(); }
      if (k === 'c') UI.bag('craft');
      if (k === 'n') UI.build();
      if (k === 'm') UI.bigMap();
      if (k === 'r' && Game.place) Game.place.r = (Game.place.r || 0) + Math.PI / 2;
      if (k === 'q') Game.useFlare();
      if (k >= '1' && k <= '6') { const hb = UI.hotbarItems(); if (hb[+k - 1]) Game.equip(hb[+k - 1]); }
    });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    // landscape lock attempt
    addEventListener('pointerdown', () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }, { once: true });
    const mq = matchMedia('(orientation:portrait) and (pointer:coarse)');
    const chk = () => { if (mq.matches && Game.mode === 'play' && !Game.paused) UI.pause(); };
    if (mq.addEventListener) mq.addEventListener('change', chk); else if (mq.addListener) mq.addListener(chk);
  },
  zoom(k) { if (this.view === 'third') this.dist = clamp(this.dist * k, 2.4, 10); },
  moving() { return this.mag > 0.12; },
  fp() { return this.view === 'first' && Game.mode === 'play'; },
  cycle() { this.setView(this.view === 'third' ? 'first' : 'third'); UI.toast('Camera: ' + VIEW_NAMES[this.view]); },
  setView(v, silent) {
    if (v !== 'first') v = 'third';
    const prev = this.view; this.view = v; Game.settings.view = v; Game.saveSettings();
    if (Game.P && (prev !== v || silent)) { this.yaw = Game.P.face + Math.PI; }
    if (v === 'first') this.pitch = 0.1; else if (v === 'third') { this.pitch = 0.32; this.cd = 1; }
    $('#xhair').classList.toggle('hidden', v !== 'first');
    const b = $('#bView'); if (b) b.querySelector('small').textContent = v === 'third' ? '3RD' : '1ST';
  },
  move(dt) {
    const P = Game.P; if (!P) return;
    let sx = this.stk.x, sy = this.stk.y;
    const K = this.keys;
    if (K.w || K.arrowup) sy -= 1; if (K.s || K.arrowdown) sy += 1; if (K.a || K.arrowleft) sx -= 1; if (K.d || K.arrowright) sx += 1;
    let m = Math.hypot(sx, sy); this.mag = m;
    if (m < 0.12) { P.moving = false; P.run = false; return; }
    if (m > 1) { sx /= m; sy /= m; m = 1; }
    const yaw = this.yaw, mx = Math.cos(yaw) * sx + Math.sin(yaw) * sy, mz = -Math.sin(yaw) * sx + Math.cos(yaw) * sy;
    const run = m > 0.92 || K.shift;
    if (Game.playerMove(mx, mz, m, run, dt)) this.bob += dt * (run ? 13 : 9);
  },
  camera(dt) {
    const c = Engine.cam, P = Game.P, W = Game.W;
    if (this.view === 'first') {
      const bob = P.moving ? Math.sin(this.bob) * 0.04 : 0;
      const eye = [P.x, (P.vy || P.y) + 1.62 + bob, P.z];
      const cp = Math.cos(this.pitch), D = 5;
      const f = [-Math.sin(this.yaw) * cp, -Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
      c.fov += (1.02 - c.fov) * Math.min(1, dt * 6);
      c.yaw = this.yaw; c.pitch = this.pitch; c.dist = D;
      c.tx = eye[0] + f[0] * D; c.ty = eye[1] + f[1] * D; c.tz = eye[2] + f[2] * D;
      Engine.fadeTarget = null;
      P.face = this.yaw + Math.PI;
    } else {
      const right = [Math.cos(this.yaw), -Math.sin(this.yaw)];
      const t = [P.x + right[0] * 0.5, (P.vy || P.y) + 1.55, P.z + right[1] * 0.5];
      const cp = Math.cos(this.pitch), u = [Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp];
      let want = this.dist;
      const solidHit = (o, d, maxD) => { // ignore leaves so the camera does not jump in the canopy
        let tt = 0; const step = 0.25; while (tt < maxD) { tt += step; const x = o[0] + d[0] * tt, y = o[1] + d[1] * tt, z = o[2] + d[2] * tt; const b = W.get(Math.floor(x), Math.floor(y), Math.floor(z)); if (b && BLOCKS[b] && !BLOCKS[b].cutout && !BLOCKS[b].trans && !BLOCKS[b].soft) return tt; } return null;
      };
      const h = solidHit(t, u, want + 0.4);
      if (h !== null) want = Math.max(0.9, h - 0.35);
      this.cd += (want - this.cd) * Math.min(1, dt * (want < this.cd ? 20 : 4));
      c.fov += (0.85 - c.fov) * Math.min(1, dt * 6);
      const k = Math.min(1, dt * 16);
      c.tx += (t[0] - c.tx) * k; c.ty += (t[1] - c.ty) * k; c.tz += (t[2] - c.tz) * k;
      c.yaw = this.yaw; c.pitch = this.pitch; c.dist = this.cd;
      Engine.fadeTarget = [P.x, P.y, P.z]; Engine.fadeR = 0.12; Engine.fadeLift = 1.0;
    }
    Engine.cut = 999;
  }
};
