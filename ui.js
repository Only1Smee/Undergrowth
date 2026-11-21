'use strict';
/* =========================================================
   UNDERGROWTH - HUD, menus, map
   ========================================================= */
const OBJECTIVES = [
  { t: 'Gather 3 sticks and 2 stones', d: G => G.count('stick') >= 3 && G.count('stone') >= 2 || G.count('stone_axe') || G.count('axe') },
  { t: 'Pull lianas from vines on trees, then craft Rope', d: G => G.count('rope') || G.count('stone_axe') || G.count('axe') },
  { t: 'Craft a Stone Axe (Bag, Craft)', d: G => G.count('stone_axe') || G.count('axe') || G.S.flags.felled },
  { t: 'Chop down a tree and feed a log to the campfire', d: G => G.S.flags.fed },
  { t: 'Craft a Workbench and place it at camp', d: G => G.S.pieces.some(p => p.type === 'bench') },
  { t: 'Upgrade the campfire to a Stone Ring', d: G => G.fire.level >= 2 },
  { t: 'Find the Ostrand research station in the north-east', d: G => G.S.found.station },
  { t: 'Recover the 3 radio parts (check the journal)', d: G => Object.keys(G.S.parts).length >= 3 },
  { t: 'Repair the radio at the station mast', d: G => G.S.radioFixed },
  { t: 'Light a Signal Fire by the crash site and survive the night', d: () => false }
];
const UI = {
  modal: null, toastQ: [],
  init() {
    $('#btnAtk').addEventListener('pointerdown', e => { e.preventDefault(); if (Game.place) Game.confirmPlace(); else Game.attack(); this._atkHold = setInterval(() => { if (!Game.place) Game.attack(); }, 160); });
    const stop = () => clearInterval(this._atkHold);
    $('#btnAtk').addEventListener('pointerup', stop); $('#btnAtk').addEventListener('pointercancel', stop); $('#btnAtk').addEventListener('pointerleave', stop);
    $('#btnUse').onclick = () => { Game.use(); };
    $('#btnBag').onclick = () => this.bag();
    $('#btnBuild').onclick = () => this.build();
    $('#bView').onclick = () => { Controls.cycle(); };
    $('#btnMenu').onclick = () => this.pause();
    $('#mini').onclick = () => this.bigMap();
    $('#pPlace').onclick = () => Game.confirmPlace();
    $('#pRot').onclick = () => { if (Game.place) Game.place.r = (Game.place.r || 0) + Math.PI / 2; };
    $('#pCancel').onclick = () => Game.cancelPlace();
    $('#sheet').addEventListener('pointerdown', e => { if (e.target.id === 'sheet') this.close(); });
    document.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });
  },
  /* ---------- screens ---------- */
  show(id, on) { $(id).classList.toggle('hidden', !on); },
  title() {
    Game.mode = 'title';
    ['#hud', '#lookpad', '#stickzone'].forEach(x => this.show(x, false));
    const t = $('#title'); t.classList.remove('hidden');
    const has = Game.hasSave();
    let sv = null; try { sv = has ? JSON.parse(localStorage.getItem(SAVE_KEY)) : null; } catch (e) { }
    t.innerHTML = `<div class="tbox">
      <div class="logo">UNDERGROWTH</div>
      <div class="tag">Survive the island. Keep the fire burning.</div>
      <div class="tbtns">
        ${sv ? `<button class="btn big" id="tCont">{i:play} Continue <small>Day ${Math.floor(sv.time) + 1}${sv.hard ? ' / Hardcore' : ''}</small></button>` : ''}
        <button class="btn big ${sv ? 'ghost' : ''}" id="tNew">{i:fire} New Game</button>
        <button class="btn ghost" id="tHard">{i:skull} Hardcore <small>one life</small></button>
        <div class="trow"><button class="btn ghost sm" id="tHow">{i:book} How to play</button><button class="btn ghost sm" id="tSet">{i:cog} Settings</button></div>
      </div></div>`;
    if (sv) $('#tCont').onclick = () => { t.classList.add('hidden'); Game.continueGame(); };
    const nw = hard => { if (sv && !confirm('Start a new game? Your current island will be lost.')) return; Game.wipe(); t.classList.add('hidden'); Game.newGame(hard); };
    $('#tNew').onclick = () => nw(false); $('#tHard').onclick = () => nw(true);
    $('#tHow').onclick = () => this.howto(); $('#tSet').onclick = () => this.settingsSheet();
    if (!Game.M) { Game.S = Game.fresh(424242, false); Game.loadWorld(true); }
  },
  story(lines, cb) {
    const s = $('#story'); let i = 0; s.classList.remove('hidden');
    const nx = () => {
      if (i >= lines.length) { s.classList.add('hidden'); cb && cb(); return; }
      s.innerHTML = `<div class="stxt">${lines[i]}</div><div class="snext">${i < lines.length - 1 ? 'Tap to continue' : 'Tap to begin'}</div><button class="btn ghost sm sskip">Skip</button>`;
      s.querySelector('.sskip').onclick = e => { e.stopPropagation(); i = lines.length; nx(); };
      i++;
    };
    s.onclick = nx; nx();
  },
  howto() {
    this.open(`<h2>{i:book} How to survive</h2><div class="how">
      <p><b>Move</b> with the stick on the left (or WASD). Push it all the way to run. <b>Drag</b> anywhere on the right to look around. <b>Pinch</b> to zoom.</p>
      <p><b>ATTACK</b> swings what you hold: chop trees with an axe, fight with spears and clubs, shoot with a bow. <b>USE</b> picks up, opens, drinks, talks and works camp pieces. You can also tap things on screen.</p>
      <p><b>BAG</b> holds your items, crafting, the journal and your camp. <b>BUILD</b> places walls, stakes, floors, roofs and camp pieces.</p>
      <p><b>The campfire</b> is your safe zone. Feed it logs, sticks and leaves, and upgrade it to grow its light. The Hollow cannot enter firelight. Torches and flares keep it back too.</p>
      <p><b>Vitals:</b> eat, drink, rest and stay sane. Raw meat can make you sick and spoils overnight. Cook it on the fire or dry it on a rack. Bandages stop bleeding, antidotes cure poison and sickness, poultices cure infection.</p>
      <p><b>The Painted</b> raid your camp at night from night 2. Wall it in with log walls and defensive stakes, and set spike traps. Clear a village by defeating its people and its raids end.</p>
      <p><b>Escape:</b> rescue the four survivors, find the journal pages and three radio parts, repair the radio at the Ostrand Station, then keep a signal fire burning by the crash site through one more night. Or survive 99 nights.</p>
      <p class="dim">Keyboard: E use, F or Space attack, Tab bag, C craft, N build, M map, V camera, Q flare, 1-6 hotbar.</p></div>
      <div class="brow"><button class="btn" data-close>Got it</button></div>`);
  },
  /* ---------- HUD ---------- */
  hud(force) {
    const G = Game, S = G.S; if (!S || G.mode !== 'play') return;
    this.show('#hud', true); this.show('#lookpad', true); this.show('#stickzone', true);
    const p = S.p;
    const set = (id, v) => { const e = $(id); e.style.width = clamp(v, 0, 100) + '%'; e.parentNode.parentNode.classList.toggle('low', v < 25); };
    set('#vHp', p.hp); set('#vFood', p.food); set('#vWater', p.water); set('#vEnergy', p.energy); set('#vSan', p.sanity);
    const conds = [];
    if (p.bleed > 0) conds.push(['drop', 'Bleeding']); if (p.poison > 0) conds.push(['poison', 'Poisoned']); if (p.sick > 0) conds.push(['sick', 'Sick']); if (p.infect) conds.push(['warn', 'Infected']);
    if (S.rain > 0) conds.push(['drop', 'Rain']); if (p.energy < 15) conds.push(['zz', 'Exhausted']);
    const ch = conds.map(c => c[1]).join();
    if (ch !== this._conds || force) { this._conds = ch; $('#conds').innerHTML = conds.map(c => `<span class="cond ${c[1] === 'Rain' ? 'n' : ''}">{i:${c[0]}}${c[1]}</span>`).join(''); }
    const night = G.isNight();
    $('#dayLbl').innerHTML = `${night ? '{i:moon}' : '{i:sun}'}<b>${night ? 'NIGHT ' + S.night : 'DAY ' + G.dayNum()}</b><span>${G.clock()}</span>`;
    const F = G.fire, fmax = FIRE_LEVELS[F.level].max;
    $('#fireBar').style.width = clamp(F.fuel / fmax * 100, 0, 100) + '%';
    $('#fireBox').classList.toggle('low', F.fuel < 40);
    const ob = OBJECTIVES.find(o => !o.d(G));
    $('#obj').textContent = ob ? ob.t : '';
    // hotbar
    const hb = this.hotbarItems(), key = hb.join() + '|' + S.equip + '|' + (S.equip ? Math.round((S.dur[S.equip] || 0) / ((ITEMS[S.equip].dur) || 1) * 10) : '') + '|' + G.count('arrows') + G.count('torch');
    if (key !== this._hb || force) {
      this._hb = key;
      $('#hotbar').innerHTML = hb.map((id, i) => { const it = ITEMS[id], d = it.dur ? (S.dur[id] || it.dur) / it.dur : 1; return `<button class="hs ${S.equip === id ? 'on' : ''}" data-id="${id}">{i:${it.icon}}${this.count(id) > 1 ? `<i>${this.count(id)}</i>` : ''}${it.dur ? `<u style="width:${Math.round(d * 100)}%"></u>` : ''}${id === 'bow' ? `<em>${G.count('arrows')}</em>` : ''}</button>`; }).join('');
      $('#hotbar').querySelectorAll('.hs').forEach(b => b.onclick = () => Game.equip(b.dataset.id));
    }
    // effects
    const low = clamp((35 - p.sanity) / 35, 0, 1), hl = G.nearHollow < 16 ? 1 - G.nearHollow / 16 : 0;
    $('#vig').style.opacity = Math.max(low * 0.8, hl * 0.7, p.hp < 25 ? 0.5 : 0).toFixed(2);
    $('#vig').classList.toggle('pulse', hl > 0.3 || p.hp < 25);
    MapView.mini();
    if (force) $('#placeBar').classList.toggle('hidden', !G.place);
  },
  count(id) { return Game.count(id); },
  hotbarItems() { const S = Game.S; return Object.keys(S.inv).filter(id => ['tool', 'weapon'].includes(ITEMS[id].type)).slice(0, 6); },
  useBtn(t) {
    const b = $('#btnUse'); b.classList.toggle('dim', !t);
    $('#useLbl').textContent = t ? t.lbl : 'USE';
  },
  toast(msg, kind) {
    const box = $('#toasts'), e = el('div', 'toast ' + (kind || ''), msg);
    box.appendChild(e); while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 400); }, 3200);
  },
  pickup(id, n) { this.toast(`{i:${ITEMS[id].icon}} +${n} ${ITEMS[id].name}`, 'pk'); },
  hint(msg) { if (!Game.settings.hints) return; const h = $('#hint'); h.innerHTML = `{i:bulb}<span>${msg}</span>`; h.classList.remove('hidden'); clearTimeout(this._ht); this._ht = setTimeout(() => h.classList.add('hidden'), 7000); h.onclick = () => h.classList.add('hidden'); },
  banner(t, sub) { const b = $('#banner'); b.innerHTML = `<b>${t}</b>${sub ? `<span>${sub}</span>` : ''}`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); },
  flash() { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); },
  fade(cb) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { cb(); setTimeout(() => f.classList.remove('on'), 300); }, 900); },
  placeMode(on) { $('#placeBar').classList.toggle('hidden', !on); $('#btnAtk').classList.toggle('placing', on); this.hud(true); },
  /* ---------- modal sheets ---------- */
  open(html, cls) { const s = $('#sheet'); s.innerHTML = `<div class="panel ${cls || ''}">${html}</div>`; s.classList.remove('hidden'); this.modal = true; s.querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.close()); Sfx.play('click'); return s.firstChild; },
  close() { $('#sheet').classList.add('hidden'); this.modal = null; if (Game.paused && Game.mode === 'play') Game.paused = false; this.hud(true); },
  pause() {
    if (Game.mode !== 'play') return; Game.paused = true;
    const p = this.open(`<h2>{i:pause} Paused</h2><div class="pmenu">
      <button class="btn" data-close>{i:play} Resume</button>
      <button class="btn ghost" id="pmSet">{i:cog} Settings</button>
      <button class="btn ghost" id="pmHow">{i:book} How to play</button>
      <button class="btn ghost" id="pmQuit">{i:save} Save and quit</button></div>`);
    p.querySelector('#pmSet').onclick = () => this.settingsSheet(true);
    p.querySelector('#pmHow').onclick = () => this.howto();
    p.querySelector('#pmQuit').onclick = () => { Game.save(); this.close(); Game.paused = false; Game.M = null; this.title(); };
  },
  settingsSheet(inGame) {
    const s = Game.settings;
    const p = this.open(`<h2>{i:cog} Settings</h2><div class="pmenu">
      <button class="btn ghost" id="sView">{i:eye} Camera: ${VIEW_NAMES[s.view]}</button>
      <button class="btn ghost" id="sInv">Camera drag: ${s.invLook ? 'Inverted' : 'Normal'}</button>
      <button class="btn ghost" id="sQ">Graphics: ${{ high: 'High (shadows)', med: 'Medium', lite: 'Battery saver' }[s.quality]}</button>
      <button class="btn ghost" id="sSfx">{i:speaker} Sound effects: ${s.sfx ? 'On' : 'Off'}</button>
      <button class="btn ghost" id="sMus">{i:music} Ambience: ${s.music ? 'On' : 'Off'}</button>
      <button class="btn ghost" id="sHint">{i:bulb} Hints: ${s.hints ? 'On' : 'Off'}</button>
      <button class="btn" id="sBack">Back</button></div>`);
    const re = () => { Game.saveSettings(); this.settingsSheet(inGame); };
    p.querySelector('#sView').onclick = () => { s.view = s.view === 'third' ? 'first' : 'third'; if (Game.mode === 'play') Controls.setView(s.view); re(); };
    p.querySelector('#sInv').onclick = () => { s.invLook = !s.invLook; re(); };
    p.querySelector('#sQ').onclick = () => { const o = ['high', 'med', 'lite']; s.quality = o[(o.indexOf(s.quality) + 1) % 3]; Engine.quality = s.quality; Engine.viewDist = s.quality === 'lite' ? 56 : 76; Engine.resize(); re(); };
    p.querySelector('#sSfx').onclick = () => { s.sfx = !s.sfx; Sfx.apply(); re(); };
    p.querySelector('#sMus').onclick = () => { s.music = !s.music; Sfx.apply(); re(); };
    p.querySelector('#sHint').onclick = () => { s.hints = !s.hints; re(); };
    p.querySelector('#sBack').onclick = () => inGame ? this.pause() : this.close();
  },
  /* ---------- bag ---------- */
  bag(tab, sel) {
    tab = tab || this._tab || 'items'; this._tab = tab;
    const G = Game, S = G.S;
    const tabs = [['items', 'bag', 'Items'], ['craft', 'hammer', 'Craft'], ['journal', 'book', 'Journal'], ['camp', 'fire', 'Camp']];
    let body = '';
    if (tab === 'items') body = this.itemsTab(sel);
    if (tab === 'craft') body = this.craftTab();
    if (tab === 'journal') body = this.journalTab();
    if (tab === 'camp') body = this.campTab();
    const p = this.open(`<div class="tabs">${tabs.map(t => `<button class="tab ${t[0] === tab ? 'on' : ''}" data-t="${t[0]}">{i:${t[1]}}<span>${t[2]}</span></button>`).join('')}<button class="tab x" data-close>{i:x}</button></div><div class="tbody">${body}</div>`, 'wide');
    p.querySelectorAll('.tab[data-t]').forEach(b => b.onclick = () => this.bag(b.dataset.t));
    if (tab === 'items') this.bindItems(p, sel);
    if (tab === 'craft') p.querySelectorAll('[data-rc]').forEach(b => b.onclick = () => { const rc = RECIPES.find(r => r.id === b.dataset.rc); if (G.craft(rc)) this.bag('craft'); });
  },
  itemsTab(sel) {
    const G = Game, S = G.S, ids = Object.keys(S.inv).sort((a, b) => ['tool', 'weapon', 'med', 'food', 'drink', 'place', 'res'].indexOf(ITEMS[a].type) - ['tool', 'weapon', 'med', 'food', 'drink', 'place', 'res'].indexOf(ITEMS[b].type));
    sel = sel && S.inv[sel] ? sel : ids[0];
    const grid = ids.length ? ids.map(id => `<button class="slot ${id === sel ? 'on' : ''} ${S.equip === id ? 'eq' : ''}" data-id="${id}">{i:${ITEMS[id].icon}}<i>${S.inv[id]}</i><small>${ITEMS[id].name}</small></button>`).join('') : '<div class="empty">Your bag is empty. Pick up sticks, stones and leaves.</div>';
    let det = '';
    if (sel) {
      const it = ITEMS[sel], acts = [];
      if (it.type === 'food') acts.push(['eat', 'Eat']);
      if (it.type === 'med') acts.push(['heal', 'Use']);
      if (sel === 'canteen') acts.push(['drink', `Drink (${S.canteen}/4)`]);
      if (it.type === 'tool' || it.type === 'weapon') acts.push(['equip', S.equip === sel ? 'Unequip' : 'Equip']);
      if (sel === 'flare') acts.push(['flare', 'Light flare']);
      if (it.type === 'place') acts.push(['place', 'Place']);
      if (it.fuel && G.nearPiece('campfire', 4)) acts.push(['fuel', 'Add to fire']);
      acts.push(['drop', 'Drop one']);
      const stats = [];
      if (it.food) stats.push(`Food +${it.food}`); if (it.water) stats.push(`Water +${it.water}`); if (it.sanity) stats.push(`Sanity ${it.sanity > 0 ? '+' : ''}${it.sanity}`);
      if (it.sick) stats.push(`${Math.round(it.sick * 100)}% chance of sickness`); if (it.heal) stats.push(`Health +${it.heal}`);
      if (it.dmg) stats.push(`Damage ${it.dmg}`); if (it.dur) stats.push(`Condition ${Math.round((S.dur[sel] || it.dur) / it.dur * 100)}%`); if (it.chop) stats.push('Chops trees');
      if (it.cook) stats.push('Cook it at the campfire'); if (it.fuel) stats.push(`Fuel ${it.fuel}`);
      det = `<div class="det"><div class="dh">{i:${it.icon}}<b>${it.name}</b></div><div class="ds">${stats.join(' / ')}</div>${it.desc ? `<div class="dd">${it.desc}</div>` : ''}<div class="dacts">${acts.map(a => `<button class="btn sm ${a[0] === 'drop' ? 'ghost' : ''}" data-a="${a[0]}">${a[1]}</button>`).join('')}</div></div>`;
    }
    return `<div class="items"><div class="grid">${grid}</div>${det}</div>`;
  },
  bindItems(p, sel) {
    const G = Game;
    p.querySelectorAll('.slot').forEach(b => b.onclick = () => this.bag('items', b.dataset.id));
    const s = p.querySelector('.slot.on'); const id = s && s.dataset.id;
    p.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'eat') G.eat(id); if (a === 'heal') G.heal(id); if (a === 'drink') G.drinkCanteen();
      if (a === 'equip') G.equip(id); if (a === 'flare') { G.useFlare(); return this.close(); }
      if (a === 'place') { this.close(); G.startPlace(id); return; }
      if (a === 'fuel') G.addFuel(id);
      if (a === 'drop') { G.remove(id, 1); G.dropItem(id, 1, G.P.x, G.P.y, G.P.z); }
      this.bag('items', id);
    });
  },
  needStr(need, mul) { return Object.keys(need).map(k => { const n = Game.cost(need[k], mul), h = Game.count(k); return `<span class="nd ${h >= n ? 'ok' : ''}">{i:${ITEMS[k].icon}}${ITEMS[k].name} ${h}/${n}</span>`; }).join(''); },
  craftTab() {
    const G = Game, bench = !!G.nearPiece('bench');
    const cats = [...new Set(RECIPES.map(r => r.cat))];
    return `<div class="craft">${bench ? '<div class="cnote ok">{i:hammer} At the workbench: all recipes available</div>' : '<div class="cnote">{i:hammer} Recipes marked BENCH need you to stand at a workbench</div>'}` + cats.map(c => `<h3>${c}</h3>` + RECIPES.filter(r => r.cat === c).map(r => {
      const it = ITEMS[r.out], ok = G.canCraft(r);
      return `<div class="rc ${ok ? 'ok' : ''}"><div class="ri">{i:${it.icon}}</div><div class="rm"><b>${it.name}${r.n > 1 ? ' x' + r.n : ''}</b>${r.where === 'bench' ? '<em>BENCH</em>' : ''}<div class="rn">${this.needStr(r.need)}</div></div><button class="btn sm" data-rc="${r.id}" ${ok ? '' : 'disabled'}>Craft</button></div>`;
    }).join('')).join('') + '</div>';
  },
  journalTab() {
    const S = Game.S;
    let h = '<div class="journal"><h3>Radio parts</h3>' + Game.M.parts.map(p => `<div class="jp ${S.parts[p.id] ? 'ok' : ''}">{i:${S.parts[p.id] ? 'check' : 'antenna'}}<b>${p.name}</b><span>${S.parts[p.id] ? 'Recovered' : (S.pages[5] || S.rescued.ellis ? p.hint : 'Location unknown')}</span></div>`).join('');
    h += `<div class="jp ${S.radioFixed ? 'ok' : ''}">{i:${S.radioFixed ? 'check' : 'chat'}}<b>Station radio</b><span>${S.radioFixed ? 'Repaired. Light a signal fire by the crash site.' : 'Broken'}</span></div>`;
    h += '<h3>Ostrand Expedition journal</h3>';
    for (let n = 1; n <= 6; n++) h += S.pages[n] ? `<div class="page"><b>${PAGES[n].title}</b><p>${PAGES[n].text}</p></div>` : `<div class="page miss"><b>Page ${n}</b><p>Not found yet.</p></div>`;
    return h + '</div>';
  },
  campTab() {
    const G = Game, S = G.S;
    let h = '<div class="campt"><h3>Survivors</h3><div class="survs">' + Object.keys(SURVIVORS).map(id => { const s = SURVIVORS[id], r = S.rescued[id]; return `<div class="sv ${r ? 'ok' : ''}">{i:person}<b>${r ? s.name : 'Unknown survivor'}</b><span>${r ? s.role + ': ' + s.perk : 'Somewhere on the island.'}</span></div>`; }).join('') + '</div>';
    h += '<h3>The tribes</h3>' + Object.keys(TRIBES).map(t => `<div class="jp ${S.pop[t] ? '' : 'ok'}">{i:${S.pop[t] ? 'mask' : 'check'}}<b>${POI[TRIBES[t].village].name}</b><span>${S.pop[t] ? `${S.pop[t]} warriors remain` : 'Fallen'}</span></div>`).join('');
    h += `<h3>Record</h3><div class="stats"><span>Day <b>${G.dayNum()}</b></span><span>Nights survived <b>${S.night}</b></span><span>Kills <b>${S.stats.kills}</b></span><span>Crafted <b>${S.stats.crafted}</b></span><span>Built <b>${S.stats.built}</b></span><span>Deaths <b>${S.stats.deaths}</b></span></div>`;
    h += `<div class="dim">${S.hard ? 'Hardcore: one life.' : 'Normal: if you die you wake at camp and must recover your pack.'}</div></div>`;
    return h;
  },
  /* ---------- build ---------- */
  build() {
    const G = Game;
    const places = Object.keys(G.S.inv).filter(id => ITEMS[id].type === 'place');
    const p = this.open(`<div class="tabs"><span class="tab on">{i:wall}<span>Build</span></span><button class="tab x" data-close>{i:x}</button></div><div class="tbody"><div class="craft">
      ${places.length ? '<h3>Camp pieces in your bag</h3>' + places.map(id => `<div class="rc ok"><div class="ri">{i:${ITEMS[id].icon}}</div><div class="rm"><b>${ITEMS[id].name} x${G.count(id)}</b><div class="rn">Ready to place</div></div><button class="btn sm" data-pl="${id}">Place</button></div>`).join('') : '<div class="cnote">Craft camp pieces like the bed, storage and traps in the Craft tab, then place them here.</div>'}
      <h3>Structures</h3>${BUILD.map(b => { const ok = G.has(b.need, true); return `<div class="rc ${ok ? 'ok' : ''}"><div class="ri">{i:${b.icon}}</div><div class="rm"><b>${b.name}</b>${b.bench ? '<em>BENCH</em>' : ''}<div class="rn">${this.needStr(b.need, true)}</div></div><button class="btn sm" data-b="${b.id}">Build</button></div>`; }).join('')}
      <div class="dim">Structures snap to the ground in front of you. Walls are three blocks tall. Break your own builds with an axe.${G.S.rescued.jun ? ' Jun cuts every cost.' : ''}</div></div></div>`, 'wide');
    p.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { this.close(); G.startPlace(b.dataset.pl); });
    p.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { this.close(); G.startBuild(BUILD.find(x => x.id === b.dataset.b)); });
  },
  /* ---------- camp pieces ---------- */
  piece(pc) {
    const G = Game, S = G.S;
    if (pc.type === 'campfire') return this.campfire();
    if (pc.type === 'bench') return this.bag('craft');
    if (pc.type === 'storage') return this.storage();
    const lbl = PIECE_LBL[pc.type];
    let body = '', acts = [];
    if (pc.type === 'bed' || pc.type === 'shelter') { body = 'Rest here to recover energy. At night, sleep through to dawn if you are inside the firelight and no enemies are near.'; acts.push(['sleep', '{i:zz} Sleep']); }
    if (pc.type === 'rack') {
      const n = pc.meat || 0, ready = (pc.dryT || []).filter(t => t <= 0).length;
      body = `${n}/4 hanging. ${ready} ready.${n - ready > 0 ? ` Next ready in ${Math.ceil(Math.min(...pc.dryT.filter(t => t > 0)))}s.` : ''} Dried meat never spoils.`;
      if (n < 4 && (G.count('meat_raw') || G.count('fish_raw'))) acts.push(['hang', 'Hang raw meat']);
      if (ready) acts.push(['collect', `Collect ${ready}`]);
    }
    if (pc.type === 'collector') { body = `Clean rainwater: ${pc.water || 0}/4. Fills faster in rain.`; if (pc.water) { acts.push(['drinkc', 'Drink']); if (G.count('canteen') && S.canteen < 4) acts.push(['fill', 'Fill canteen']); } }
    if (pc.type === 'torchpost') { body = pc.lit ? 'Burning. Torch posts light up at dusk and keep the Hollow back a few steps.' : 'Unlit.'; acts.push(['toggle', pc.lit ? 'Put out' : 'Light']); }
    if (pc.type === 'trap') { body = pc.sprung ? 'Sprung. Reset it to arm it again.' : 'Armed. Anything that steps on it gets hurt badly.'; if (pc.sprung) acts.push(['reset', 'Reset trap']); }
    if (pc.type === 'signal') {
      const C = POI.crash, near = Math.hypot(pc.x - C.x, pc.z - C.z) < 24;
      body = (pc.lit ? 'Burning bright.' : 'Unlit.') + (near ? ' It can be seen from the sea.' : ' Too far from the crash site for a helicopter to spot.');
      if (!pc.lit) acts.push(['light', G.count('log') ? 'Light it (1 log)' : 'Light it (needs 1 log)']);
    }
    acts.push(['pick', 'Pick up']);
    const p = this.open(`<h2>{i:${(ITEMS['p_' + pc.type] || {}).icon || 'box'}} ${lbl}</h2><p class="pbody">${body}</p><div class="pmenu">${acts.map(a => `<button class="btn ${a[0] === 'pick' ? 'ghost' : ''}" data-a="${a[0]}">${a[1]}</button>`).join('')}<button class="btn ghost" data-close>Close</button></div>`);
    p.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'sleep') { this.close(); G.sleep(pc); return; }
      if (a === 'hang') { const id = G.count('meat_raw') ? 'meat_raw' : 'fish_raw'; G.remove(id, 1); pc.meat = (pc.meat || 0) + 1; pc.dryT.push(150); pc.dried = pc.dryT.map(t => t <= 0); Sfx.play('pick'); }
      if (a === 'collect') { const keep = pc.dryT.filter(t => t > 0); const n = pc.dryT.length - keep.length; pc.dryT = keep; pc.meat = keep.length; pc.dried = []; G.add('meat_dried', n); }
      if (a === 'drinkc') { pc.water--; S.p.water = clamp(S.p.water + 30, 0, 100); Sfx.play('drink'); }
      if (a === 'fill') { const k = Math.min(pc.water, 4 - S.canteen); pc.water -= k; S.canteen += k; S.flags.dirtyCanteen = false; Sfx.play('drink'); }
      if (a === 'toggle') pc.lit = !pc.lit;
      if (a === 'reset') { pc.sprung = false; Sfx.play('trap'); }
      if (a === 'light') { if (!G.count('log')) return this.toast('You need a log'); G.remove('log', 1); pc.lit = true; Sfx.play('fuel'); }
      if (a === 'pick') { G.pickupPiece(pc); this.close(); return; }
      if (pc.type === 'rack') pc.dried = (pc.dryT || []).map(t => t <= 0);
      this.piece(pc); this.hud(true);
    });
  },
  campfire() {
    const G = Game, F = G.fire, L = FIRE_LEVELS[F.level], nx = FIRE_LEVELS[F.level + 1];
    const raw = Object.keys(G.S.inv).filter(id => ITEMS[id].cook).reduce((a, id) => a + G.count(id), 0);
    const fuels = ['log', 'stick', 'bamboo', 'leaf', 'cloth'].filter(id => G.count(id));
    const p = this.open(`<h2>{i:fire} Campfire: ${L.name}</h2>
      <div class="fuelbar"><div style="width:${clamp(F.fuel / L.max * 100, 0, 100)}%"></div><span>${F.fuel > 0 ? `Fuel ${Math.ceil(F.fuel)}s` : 'Out'}</span></div>
      <p class="pbody">Light radius ${L.r} blocks. Inside the light you are safe from the Hollow, and you slowly regain sanity.</p>
      <div class="fuels">${fuels.length ? fuels.map(id => `<button class="btn sm" data-f="${id}">{i:${ITEMS[id].icon}} ${ITEMS[id].name} (${G.count(id)}) +${ITEMS[id].fuel}</button>`).join('') : '<span class="dim">No fuel in your bag. Logs burn longest.</span>'}</div>
      <div class="pmenu">${raw ? `<button class="btn" id="cfCook">{i:meat} Cook raw food (${raw})</button>` : ''}
      ${nx ? `<div class="upg"><b>Upgrade: ${nx.name}</b> <span class="dim">radius ${nx.r}, burns longer</span><div class="rn">${this.needStr(nx.need, true)}</div><button class="btn" id="cfUp" ${G.has(nx.need, true) ? '' : 'disabled'}>{i:up} Upgrade</button></div>` : '<div class="dim">The fire is at its greatest.</div>'}
      <button class="btn ghost" data-close>Close</button></div>`);
    p.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { G.addFuel(b.dataset.f); this.campfire(); });
    const ck = p.querySelector('#cfCook'); if (ck) ck.onclick = () => { G.cookAll(); this.campfire(); };
    const up = p.querySelector('#cfUp'); if (up) up.onclick = () => { G.upgradeFire(); this.campfire(); };
  },
  storage() {
    const G = Game, S = G.S;
    const col = (src, from) => Object.keys(src).map(id => `<button class="slot sm" data-${from}="${id}">{i:${ITEMS[id].icon}}<i>${src[id]}</i><small>${ITEMS[id].name}</small></button>`).join('') || '<div class="empty">Empty</div>';
    const p = this.open(`<h2>{i:box} Storage</h2><div class="store"><div><h3>Bag</h3><div class="grid">${col(S.inv, 'b')}</div></div><div><h3>Storage</h3><div class="grid">${col(S.store, 's')}</div></div></div><div class="dim">Tap an item to move the whole stack. All storage boxes share their contents.</div><div class="brow"><button class="btn" data-close>Done</button></div>`, 'wide');
    p.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const id = b.dataset.b, n = G.count(id); S.store[id] = (S.store[id] || 0) + n; G.remove(id, n); this.storage(); });
    p.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const id = b.dataset.s, n = S.store[id], got = G.add(id, n, true); if (got >= n) delete S.store[id]; else S.store[id] = n - got; this.storage(); });
  },
  talk(s) {
    const sv = SURVIVORS[s.id], S = Game.S;
    const lines = { mara: 'Stay close to camp when you are hurt. I can stop bleeding, draw out poison and clean infection.', tomas: 'I hunt at dawn. The meat will be by the fire. Dry what you cannot eat or it will rot.', jun: 'Feed me the materials and I will make them go further. The fire burns slower with my ring of stones too.', ellis: 'The whole island is on your map now. I marked everything I know.' };
    this.dialog(sv.name, lines[s.id], `${sv.role}: ${sv.perk}`);
  },
  dialog(title, text, sub) { this.open(`<h2>${title}</h2><p class="quote">${text}</p>${sub ? `<p class="pbody">${sub}</p>` : ''}<div class="brow"><button class="btn" data-close>Continue</button></div>`); },
  page(n) { const pg = PAGES[n]; this.open(`<div class="paper"><div class="pn">Journal page ${n} of 6</div><h2>${pg.title}</h2><p>${pg.text}</p><div class="sig">Dr Hanna Ostrand</div></div><div class="brow"><button class="btn" data-close>Close</button></div>`, 'paperw'); },
  /* ---------- end screens ---------- */
  dead(src, hard) {
    const S = Game.S;
    ['#hud', '#lookpad', '#stickzone'].forEach(x => this.show(x, false));
    const d = $('#endscr'); d.className = 'end dead';
    d.innerHTML = `<div class="ebox"><div class="et">YOU DIED</div><div class="es">Killed by ${src} on day ${Game.dayNum()}.</div>
      ${hard ? `<div class="stats"><span>Nights survived <b>${S.night}</b></span><span>Kills <b>${S.stats.kills}</b></span><span>Crafted <b>${S.stats.crafted}</b></span></div><button class="btn big" id="eBtn">Main menu</button>` : `<div class="es dim">Your pack lies where you fell.</div><button class="btn big" id="eBtn">{i:fire} Wake at camp</button>`}</div>`;
    d.querySelector('#eBtn').onclick = () => { d.className = 'end hidden'; if (hard) { Game.M = null; this.title(); } else Game.respawn(); };
  },
  win(kind) {
    const S = Game.S;
    ['#hud', '#lookpad', '#stickzone'].forEach(x => this.show(x, false));
    const d = $('#endscr'); d.className = 'end won';
    const txt = kind === 'rescue' ? `The helicopter lifts off the beach as the sun comes up. ${Object.keys(S.rescued).length ? `Beside you: ${Object.keys(S.rescued).map(id => SURVIVORS[id].name.split(' ')[0]).join(', ')}.` : 'You leave alone.'} Below, the canopy closes over the island like a hand.` : 'Ninety-nine nights. The fire never went out. You have stopped counting the days, and the island has stopped trying to kill you. Perhaps it has decided you belong to it.';
    d.innerHTML = `<div class="ebox"><div class="et">${kind === 'rescue' ? 'RESCUED' : 'UNDERGROWTH'}</div><div class="es">${txt}</div>
      <div class="stats"><span>Days <b>${Game.dayNum()}</b></span><span>Nights <b>${S.night}</b></span><span>Survivors <b>${Object.keys(S.rescued).length}/4</b></span><span>Pages <b>${Object.keys(S.pages).length}/6</b></span><span>Kills <b>${S.stats.kills}</b></span><span>Deaths <b>${S.stats.deaths}</b></span></div>
      <button class="btn big" id="eBtn">Main menu</button></div>`;
    d.querySelector('#eBtn').onclick = () => { d.className = 'end hidden'; Game.M = null; this.title(); };
  },
  bigMap() {
    const p = this.open(`<div class="mapw"><canvas id="bigmap" width="576" height="576"></canvas><div class="mlegend"><span class="lg f"></span>Camp <span class="lg p"></span>You <span class="lg o"></span>Objective <span class="lg e"></span>Danger</div></div><div class="brow"><button class="btn" data-close>Close</button></div>`, 'mapp');
    MapView.big(p.querySelector('#bigmap'));
    p.querySelector('#bigmap').onclick = () => this.close();
  }
};

/* ---------------- maps ---------------- */
const MapView = {
  base: null,
  build() {
    const G = Game, W = G.W, c = document.createElement('canvas'); c.width = MW; c.height = MD;
    const x2 = c.getContext('2d'), img = x2.createImageData(MW, MD);
    for (let z = 0; z < MD; z++) for (let x = 0; x < MW; x++) {
      let col = [20, 40, 50];
      for (let y = Math.min(MH - 1, W.topY || MH - 1); y > 0; y--) {
        const b = W.get(x, y, z); if (!b) continue; const bd = BLOCKS[b]; if (bd.soft) continue;
        const k = 0.55 + y / MH * 0.7;
        col = b === B.WATER ? [40, 80, 95] : [bd.col[0] * 255 * k, bd.col[1] * 255 * k, bd.col[2] * 255 * k]; break;
      }
      const i = (z * MW + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    x2.putImageData(img, 0, 0); this.base = c;
  },
  markers(ctx, s, ox, oz) {
    const G = Game, S = G.S, P = G.P, F = G.fire;
    const pt = (x, z, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc((x - ox) * s, (z - oz) * s, r, 0, 6.29); ctx.fill(); };
    pt(F.x, F.z, 4, '#ff9a3c');
    const know = S.pages[5] || S.rescued.ellis;
    if (know) for (const p of G.M.parts) if (!S.parts[p.id]) pt(p.x, p.z, 3.5, '#5fe0ff');
    if (S.rescued.ellis) { for (const c of G.M.cages) if (!S.rescued[c.id]) pt(c.x, c.z, 3.5, '#5fe0ff'); for (const pg of G.M.pages) if (!S.pages[pg.n]) pt(pg.x, pg.z, 2.5, '#e8dcb0'); }
    if (S.radioFixed) pt(POI.crash.x, POI.crash.z, 4, '#5fe0ff');
    if (G.M.radio && S.found.station) pt(G.M.radio.x, G.M.radio.z, 3, '#5fe0ff');
    for (const p of S.pieces) if (p.type === 'signal') pt(p.x, p.z, 3, p.lit ? '#ff6a3c' : '#aa7744');
    for (const d of S.drops) if (d.id === 'pack') pt(d.x, d.z, 3.5, '#ffffff');
    for (const e of AI.ents()) if (!e.dead && e.hostile && Math.hypot(e.x - P.x, e.z - P.z) < 26) pt(e.x, e.z, 2.5, e.type === 'hollow' ? '#ff2a1a' : '#e04a3a');
    // player arrow
    ctx.save(); ctx.translate((P.x - ox) * s, (P.z - oz) * s); ctx.rotate(-P.face + Math.PI);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  },
  fog(ctx, s, ox, oz, w, h) {
    const sn = Game.seen; ctx.fillStyle = 'rgba(6,10,8,0.94)';
    for (let j = 0; j < 36; j++) for (let i = 0; i < 36; i++) if (!sn[j * 36 + i]) { const x = (i * 4 - ox) * s, y = (j * 4 - oz) * s; if (x > w || y > h || x + 4 * s < 0 || y + 4 * s < 0) continue; ctx.fillRect(x - 0.5, y - 0.5, 4 * s + 1, 4 * s + 1); }
  },
  mini() {
    const cv = $('#mini'); if (!cv || !this.base) return;
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height, P = Game.P, R = 26, s = w / (R * 2);
    const ox = P.x - R, oz = P.z - R;
    ctx.fillStyle = '#0a1210'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.base, ox, oz, R * 2, R * 2, 0, 0, w, h);
    const dk = Game.darkness(); if (dk > 0) { ctx.fillStyle = `rgba(0,5,15,${dk * 0.45})`; ctx.fillRect(0, 0, w, h); }
    this.fog(ctx, s, ox, oz, w, h);
    this.markers(ctx, s, ox, oz);
  },
  big(cv) {
    const ctx = cv.getContext('2d'), s = cv.width / MW, S = Game.S;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(this.base, 0, 0, cv.width, cv.height);
    this.fog(ctx, s, 0, 0, cv.width, cv.height);
    ctx.font = 'bold 13px ctext, sans-serif'; ctx.textAlign = 'center';
    for (const k in POI) if (S.found[k]) { const p = POI[k]; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(p.name, p.x * s + 1, (p.z - p.r - 1) * s + 1); ctx.fillStyle = '#efe6c8'; ctx.fillText(p.name, p.x * s, (p.z - p.r - 1) * s); }
    this.markers(ctx, s, 0, 0);
  }
};
