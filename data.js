'use strict';
/* =========================================================
   UNDERGROWTH - items, recipes, building, survivors, story
   ========================================================= */
// type: res | food | drink | tool | weapon | med | place | misc
const ITEMS = {
  stick: { name: 'Stick', icon: 'stick', type: 'res', stack: 30, fuel: 12 },
  log: { name: 'Log', icon: 'log', type: 'res', stack: 12, fuel: 60 },
  stone: { name: 'Stone', icon: 'stone', type: 'res', stack: 30 },
  leaf: { name: 'Palm Leaf', icon: 'leaf', type: 'res', stack: 30, fuel: 4 },
  liana: { name: 'Liana', icon: 'vine', type: 'res', stack: 20 },
  rope: { name: 'Rope', icon: 'rope', type: 'res', stack: 20 },
  bamboo: { name: 'Bamboo', icon: 'stick', type: 'res', stack: 20, fuel: 8 },
  bone: { name: 'Bone', icon: 'bone', type: 'res', stack: 20 },
  cloth: { name: 'Cloth', icon: 'cloth', type: 'res', stack: 20, fuel: 6 },
  herb: { name: 'Medicinal Herb', icon: 'herb', type: 'res', stack: 20 },
  coconut: { name: 'Coconut', icon: 'coconut', type: 'food', stack: 10, food: 8, water: 22, needsTool: true },
  banana: { name: 'Banana', icon: 'banana', type: 'food', stack: 10, food: 14, sanity: 2 },
  berries: { name: 'Berries', icon: 'berry', type: 'food', stack: 20, food: 7, water: 3 },
  mushroom: { name: 'Brown Mushroom', icon: 'mushroom', type: 'food', stack: 10, food: 7, sick: 0.12 },
  mushroom_red: { name: 'Red Mushroom', icon: 'mushroom', type: 'food', stack: 10, food: 4, sanity: -18, poison: 1, desc: 'Useful for antidotes. Do not eat.' },
  meat_raw: { name: 'Raw Meat', icon: 'meat', type: 'food', stack: 10, food: 12, sick: 0.55, cook: 'meat_cooked', spoil: 600 },
  meat_cooked: { name: 'Cooked Meat', icon: 'meat', type: 'food', stack: 10, food: 34, energy: 6, sanity: 3, spoil: 900 },
  meat_dried: { name: 'Dried Meat', icon: 'meat', type: 'food', stack: 10, food: 26, sanity: 2 },
  fish_raw: { name: 'Raw Fish', icon: 'fish', type: 'food', stack: 10, food: 10, sick: 0.45, cook: 'fish_cooked', spoil: 500 },
  fish_cooked: { name: 'Cooked Fish', icon: 'fish', type: 'food', stack: 10, food: 26, water: 4, sanity: 3, spoil: 800 },
  flesh_raw: { name: 'Strange Meat', icon: 'meat', type: 'food', stack: 10, food: 14, sick: 0.6, sanity: -30, cook: 'flesh_cooked', desc: 'Taken from one of the Painted. You know what it is.' },
  flesh_cooked: { name: 'Cooked Strange Meat', icon: 'meat', type: 'food', stack: 10, food: 38, sanity: -30, flesh: 1 },
  snack: { name: 'Granola Bar', icon: 'food', type: 'food', stack: 10, food: 18, sanity: 6 },
  canteen: { name: 'Canteen', icon: 'drop', type: 'drink', stack: 1, cap: 4 },
  bandage: { name: 'Bandage', icon: 'bandage', type: 'med', stack: 10, heal: 8, stopBleed: 1 },
  poultice: { name: 'Herb Poultice', icon: 'herb', type: 'med', stack: 10, heal: 20, cureInfect: 1, stopBleed: 1 },
  antidote: { name: 'Antidote', icon: 'flask', type: 'med', stack: 5, curePoison: 1, cureSick: 1 },
  medkit: { name: 'First-Aid Kit', icon: 'cross', type: 'med', stack: 3, heal: 60, stopBleed: 1, curePoison: 1, cureInfect: 1 },
  stone_axe: { name: 'Stone Axe', icon: 'axe', type: 'tool', stack: 1, dmg: 14, chop: 1, dur: 120, reach: 1.8, speed: 0.7 },
  axe: { name: 'Steel Axe', icon: 'axe', type: 'tool', stack: 1, dmg: 22, chop: 2, dur: 400, reach: 1.9, speed: 0.6 },
  knife: { name: 'Pocket Knife', icon: 'knife', type: 'weapon', stack: 1, dmg: 12, dur: 300, reach: 1.5, speed: 0.38, cut: 1 },
  spear: { name: 'Wooden Spear', icon: 'spear', type: 'weapon', stack: 1, dmg: 20, dur: 80, reach: 2.6, speed: 0.75, fish: 1 },
  bone_spear: { name: 'Bone Spear', icon: 'spear', type: 'weapon', stack: 1, dmg: 30, dur: 160, reach: 2.7, speed: 0.72, fish: 1 },
  club: { name: 'War Club', icon: 'club', type: 'weapon', stack: 1, dmg: 28, dur: 150, reach: 1.9, speed: 0.9, stagger: 1 },
  bow: { name: 'Bow', icon: 'bow', type: 'weapon', stack: 1, dmg: 38, dur: 200, ranged: 1, speed: 0.8 },
  arrows: { name: 'Arrows', icon: 'arrow', type: 'res', stack: 40 },
  torch: { name: 'Torch', icon: 'fire', type: 'tool', stack: 5, burn: 150, dmg: 8, reach: 1.7, speed: 0.6, light: 1 },
  flare: { name: 'Signal Flare', icon: 'flare', type: 'tool', stack: 5, desc: 'Burns bright red. The Hollow will not come near it.' },
  // placeables (crafted, then placed in the world)
  p_bench: { name: 'Workbench', icon: 'hammer', type: 'place', stack: 1, place: 'bench' },
  p_bed: { name: 'Leaf Bed', icon: 'bed', type: 'place', stack: 1, place: 'bed' },
  p_storage: { name: 'Storage Box', icon: 'box', type: 'place', stack: 1, place: 'storage' },
  p_rack: { name: 'Drying Rack', icon: 'rack', type: 'place', stack: 1, place: 'rack' },
  p_collector: { name: 'Rain Collector', icon: 'drop', type: 'place', stack: 1, place: 'collector' },
  p_torchpost: { name: 'Torch Post', icon: 'fire', type: 'place', stack: 5, place: 'torchpost' },
  p_trap: { name: 'Spike Trap', icon: 'trap', type: 'place', stack: 5, place: 'trap' },
  p_shelter: { name: 'Lean-to Shelter', icon: 'tent', type: 'place', stack: 1, place: 'shelter' },
  p_signal: { name: 'Signal Fire', icon: 'flare', type: 'place', stack: 3, place: 'signal' }
};

// recipes: where 'hand' | 'bench'
const RECIPES = [
  { id: 'rope', cat: 'Basics', out: 'rope', n: 1, need: { liana: 2 }, where: 'hand' },
  { id: 'stone_axe', cat: 'Tools', out: 'stone_axe', n: 1, need: { stick: 1, stone: 1, rope: 1 }, where: 'hand' },
  { id: 'spear', cat: 'Weapons', out: 'spear', n: 1, need: { stick: 2, rope: 1 }, where: 'hand' },
  { id: 'torch', cat: 'Tools', out: 'torch', n: 1, need: { stick: 1, leaf: 2 }, where: 'hand' },
  { id: 'bandage', cat: 'Medicine', out: 'bandage', n: 1, need: { leaf: 2, rope: 1 }, where: 'hand' },
  { id: 'bandage2', cat: 'Medicine', out: 'bandage', n: 2, need: { cloth: 1 }, where: 'hand' },
  { id: 'p_bench', cat: 'Camp', out: 'p_bench', n: 1, need: { log: 3, stick: 4, rope: 2 }, where: 'hand' },
  { id: 'p_shelter', cat: 'Camp', out: 'p_shelter', n: 1, need: { stick: 6, leaf: 8, rope: 2 }, where: 'hand' },
  { id: 'p_torchpost', cat: 'Camp', out: 'p_torchpost', n: 1, need: { stick: 3, leaf: 2 }, where: 'hand' },
  { id: 'club', cat: 'Weapons', out: 'club', n: 1, need: { log: 1, stone: 2, rope: 1 }, where: 'bench' },
  { id: 'bone_spear', cat: 'Weapons', out: 'bone_spear', n: 1, need: { stick: 2, bone: 2, rope: 1 }, where: 'bench' },
  { id: 'bow', cat: 'Weapons', out: 'bow', n: 1, need: { bamboo: 2, rope: 2 }, where: 'bench' },
  { id: 'arrows', cat: 'Weapons', out: 'arrows', n: 6, need: { stick: 3, stone: 1, leaf: 1 }, where: 'bench' },
  { id: 'arrows2', cat: 'Weapons', out: 'arrows', n: 10, need: { stick: 3, bone: 1, leaf: 1 }, where: 'bench' },
  { id: 'poultice', cat: 'Medicine', out: 'poultice', n: 1, need: { herb: 2, leaf: 1 }, where: 'bench' },
  { id: 'antidote', cat: 'Medicine', out: 'antidote', n: 1, need: { herb: 2, mushroom_red: 1 }, where: 'bench' },
  { id: 'canteen', cat: 'Basics', out: 'canteen', n: 1, need: { bamboo: 2, rope: 1 }, where: 'bench' },
  { id: 'p_bed', cat: 'Camp', out: 'p_bed', n: 1, need: { log: 2, leaf: 10, rope: 2 }, where: 'bench' },
  { id: 'p_storage', cat: 'Camp', out: 'p_storage', n: 1, need: { log: 4, rope: 2 }, where: 'bench' },
  { id: 'p_rack', cat: 'Camp', out: 'p_rack', n: 1, need: { stick: 8, rope: 3 }, where: 'bench' },
  { id: 'p_collector', cat: 'Camp', out: 'p_collector', n: 1, need: { stick: 4, leaf: 6, log: 1 }, where: 'bench' },
  { id: 'p_trap', cat: 'Camp', out: 'p_trap', n: 1, need: { stick: 10, rope: 1 }, where: 'bench' },
  { id: 'p_signal', cat: 'Camp', out: 'p_signal', n: 1, need: { log: 4, leaf: 6, cloth: 1 }, where: 'bench' }
];

// building pieces placed into the voxel world
const BUILD = [
  { id: 'wall_log', name: 'Log Wall', icon: 'wall', need: { log: 2 }, cells: [[0, 0], [0, 1], [0, 2]], block: 'WALL_LOG', hp: 60 },
  { id: 'door', name: 'Doorway', icon: 'door', need: { log: 1 }, cells: [[0, 2]], block: 'WALL_LOG', hp: 60 },
  { id: 'wall_stone', name: 'Stone Wall', icon: 'wall', need: { stone: 5 }, cells: [[0, 0], [0, 1], [0, 2]], block: 'WALL_STONE', hp: 150, bench: 1 },
  { id: 'stakes', name: 'Defensive Stakes', icon: 'trap', need: { stick: 3 }, cells: [[0, 0], [0, 1]], block: 'STAKE', hp: 40, spikes: 1 },
  { id: 'floor', name: 'Plank Floor', icon: 'floor', need: { log: 1 }, cells: [[0, -1]], block: 'PLANK', hp: 50, floor: 1 },
  { id: 'step', name: 'Step', icon: 'floor', need: { log: 1 }, cells: [[0, 0]], block: 'PLANK_D', hp: 50 },
  { id: 'roof', name: 'Thatch Roof', icon: 'roof', need: { leaf: 3 }, cells: [[0, 3]], block: 'THATCH', hp: 30 }
];

// campfire upgrades (99-nights style: the fire grows your safe zone)
const FIRE_LEVELS = [
  null,
  { r: 9, max: 240, need: null, name: 'Embers' },
  { r: 12, max: 360, need: { log: 6, stone: 6 }, name: 'Stone Ring' },
  { r: 15, max: 480, need: { log: 10, rope: 4, stone: 4 }, name: 'Cooking Fire' },
  { r: 19, max: 640, need: { log: 16, stone: 12, bone: 6 }, name: 'Bonfire' },
  { r: 24, max: 820, need: { log: 24, bone: 10, rope: 8 }, name: 'Great Beacon' }
];

const SURVIVORS = {
  mara: { name: 'Mara Quill', role: 'Field Medic', perk: 'Heals you at camp and treats bleeding, poison and infection.', look: { skin: 1, hair: 'tied', hairCol: 4, shirt: 4, pants: 1, female: true }, line: 'You came back for me. I owe you everything. Let me patch you up.' },
  tomas: { name: 'Tomas Reyes', role: 'Hunter', perk: 'Brings back fresh meat every morning.', look: { skin: 2, hair: 'short', hairCol: 0, shirt: 1, pants: 3 }, line: 'They kept me in that cage for a week. I know these woods now. I will hunt for us.' },
  jun: { name: 'Jun Sato', role: 'Engineer', perk: 'Building costs less and the campfire burns longer.', look: { skin: 1, hair: 'buzz', hairCol: 0, shirt: 3, pants: 1 }, line: 'I hid in the station for days. That radio can work, I know it. Let me help you build.' },
  ellis: { name: 'Ellis Okafor', role: 'Scout', perk: 'Reveals the whole island map and marks what you are missing.', look: { skin: 4, hair: 'curly', hairCol: 0, shirt: 2, pants: 0 }, line: 'I mapped half this island before they caught me. Every path is in my head.' }
};

const PAGES = {
  1: { title: 'Ostrand Expedition, Day 3', text: 'The station is finished. Twelve of us, a radio mast, and more rain than I thought one place could hold. The locals the guides call the Painted watched us from the tree line all afternoon. They did not come closer.' },
  2: { title: 'Day 19', text: 'Kovacs went to check the traps and did not come back. We found his lantern by the river, still lit. The guides refuse to go out after dark. They say something walks between the trees at night. They say it hates fire.' },
  3: { title: 'Day 31', text: 'The temple is older than anything on the mainland. Carvings of a tall figure with a crown of bone, standing at the edge of a ring of fire. In every carving the people stay inside the ring. I took the radio valve down there to keep it dry. A mistake.' },
  4: { title: 'Day 40', text: 'The Painted took the antenna. They take anything that shines. They took Marsh too. I heard drums all night from the west. We keep the fires burning until dawn now. Nobody sleeps.' },
  5: { title: 'Day 52', text: 'If anyone finds this: the radio needs three things. The battery we lost with the supply plane, the valve in the temple, the antenna in the Bone Village. Fix it at the mast and call. Then light a fire on the beach and hold on until morning.' },
  6: { title: 'Last entry', text: 'I can see it from here. It is very tall. It does not cross the light of the fire, so I keep feeding it. I am running out of wood. Whoever you are, never let the fire go out.' }
};

const NIGHT_LINES = [
  'The jungle goes quiet. Keep the fire fed.',
  'Something is moving between the trees.',
  'Drums in the distance. The Painted are coming.',
  'Stay in the light.',
  'The Hollow walks tonight.'
];
