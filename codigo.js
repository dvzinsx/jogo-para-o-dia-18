(() => {
'use strict';

/* ---------- Constantes e mapas ---------- */
const COLS = 19, ROWS = 20, T = 28, TUNNEL = 9, W = COLS * T, H = ROWS * T;
const HOME = { c: 9, r: 9 }, EXIT = { c: 9, r: 7 };
const DIRS = [{x:0,y:-1},{x:-1,y:0},{x:0,y:1},{x:1,y:0}];
const WR = '#'.repeat(COLS);
const CENTER = [
  '####.#.......#.####',
  '####.#.##-##.#.####',
  '.......#GGG#.......',
  '####.#.#####.#.####',
  '####.#.......#.####'
];
/* # parede · . bolinha · o super bolinha · P início · G casa dos vilões · - porta */
const MAPS = [
  [WR,
   '#........#........#',
   '#o##.###.#.###.##o#',
   '#.................#',
   '#.##.#.#####.#.##.#',
   '#....#...#...#....#',
   '####.###.#.###.####',
   ...CENTER,
   '#........#........#',
   '#o##.###.#.###.##o#',
   '#..#.....P.....#..#',
   '##.#.#.#####.#.#.##',
   '#....#...#...#....#',
   '#.######.#.######.#',
   '#.................#',
   WR],
  [WR,
   '#o.......#.......o#',
   '#.###.##.#.##.###.#',
   '#.................#',
   '#.###.#.###.#.###.#',
   '#.....#.....#.....#',
   '####.##.#.#.##.####',
   ...CENTER,
   '#........#........#',
   '#.###.##.#.##.###.#',
   '#........P........#',
   '#.###.#.###.#.###.#',
   '#.....#.....#.....#',
   '#.###.##.#.##.###.#',
   '#o...............o#',
   WR],
  [WR,
   '#o...#.......#...o#',
   '#.#.###.###.###.#.#',
   '#.................#',
   '#.#.#.#.###.#.#.#.#',
   '#.#...#.....#...#.#',
   '####.###.#.###.####',
   ...CENTER,
   '#........#........#',
   '#.#.###.#.#.###.#.#',
   '#........P........#',
   '#.#.#.#.###.#.#.#.#',
   '#.#...#.....#...#.#',
   '#.#.###.###.###.#.#',
   '#o...............o#',
   WR]
];

const LEVELS = [
  { name:'Fase 1', sub:'Labirinto clássico',  map:MAPS[0], nGhosts:3, gSpeed:5.0, pSpeed:6.4, fright:8,   sched:[7,20,7,20,5,999], relScale:1.0,  wall:'#4a67ff', fruitEvery:[8,12] },
  { name:'Fase 2', sub:'Corredores sombrios', map:MAPS[1], nGhosts:4, gSpeed:5.6, pSpeed:6.6, fright:6,   sched:[6,20,5,25,4,999], relScale:0.85, wall:'#b455ff', fruitEvery:[7,11] },
  { name:'Fase 3', sub:'A torre final',       map:MAPS[2], nGhosts:5, gSpeed:6.2, pSpeed:6.8, fright:4.5, sched:[5,25,4,30,3,999], relScale:0.7,  wall:'#ff4d6d', fruitEvery:[6,10] }
];

const GHOST_DEFS = [
  { kind:'chase',  color:'#ff3b30', sc:9,  sr:7, corner:{c:17,r:0},  delay:0  },
  { kind:'ambush', color:'#ff8fd8', sc:9,  sr:9, corner:{c:1,r:0},   delay:2  },
  { kind:'flank',  color:'#34e0ff', sc:8,  sr:9, corner:{c:17,r:19}, delay:5  },
  { kind:'shy',    color:'#ffa53a', sc:10, sr:9, corner:{c:1,r:19},  delay:8  },
  { kind:'rear',   color:'#b57bff', sc:9,  sr:9, corner:{c:9,r:19},  delay:11 }
];

const FRUITS = [
  { key:'turbo',  emoji:'🍒', name:'Cereja',   desc:'Turbo: você corre 45% mais rápido por 7 segundos', dur:7,  w:3 },
  { key:'shield', emoji:'🍓', name:'Morango',  desc:'Escudo: bloqueia o próximo vilão que tocar em você', dur:12, w:3 },
  { key:'freeze', emoji:'🍊', name:'Laranja',  desc:'Gelo: congela todos os vilões por 5 segundos', dur:5,  w:2 },
  { key:'double', emoji:'🍇', name:'Uva',      desc:'Pontos em dobro por 10 segundos', dur:10, w:3 },
  { key:'life',   emoji:'🍎', name:'Maçã',     desc:'Vida extra (máximo de 5)', dur:0,  w:1 }
];
const FXINFO = { turbo:['🍒','Turbo',7], shield:['🍓','Escudo',12], freeze:['🍊','Gelo',5], double:['🍇','Pontos x2',10] };

/* ---------- Estado ---------- */
const S = {
  mode:'menu', levelIdx:0, score:0, hi:0, lives:3, nextExtra:10000,
  cells:[], pelletsLeft:0, start:{c:9,r:14}, player:null, ghosts:[], fruits:[], fruitTimer:5,
  fx:{turbo:0,shield:0,freeze:0,double:0}, time:0, playTime:0,
  modeTimer:0, modeIdx:0, ghostMode:'scatter', frightTimer:0, combo:0,
  stateTimer:0, popups:[]
};
try { S.hi = +localStorage.getItem('comilao_hi') || 0; } catch(e) {}

/* ---------- Elementos e canvas ---------- */
const $ = id => document.getElementById(id);
const el = { score:$('score'), hi:$('hi'), lvl:$('lvl'), lives:$('lives') };
const ov = { root:$('overlay'), title:$('ovTitle'), text:$('ovText'), btn:$('ovBtn'), hint:$('ovHint') };
const canvas = $('game'), ctx = canvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr; canvas.height = H * dpr;
ctx.scale(dpr, dpr);
let wallCv = null, ovAction = null;

/* ---------- Áudio ---------- */
let AC = null, muted = false, chompFlip = false;
function ensureAudio(){
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(f, d, type='square', v=0.05, slide=0, delay=0){
  if (muted || !AC) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + d + 0.03);
  } catch(e) {}
}
const sfx = {
  chomp(){ chompFlip = !chompFlip; tone(chompFlip ? 440 : 330, 0.06, 'square', 0.025); },
  power(){ tone(180, 0.35, 'sawtooth', 0.05, 420); },
  ghost(){ tone(300, 0.25, 'square', 0.06, 900); },
  fruit(){ [523,659,784,1046].forEach((f,i) => tone(f, 0.1, 'triangle', 0.07, 0, i*0.07)); },
  death(){ tone(520, 0.9, 'sawtooth', 0.06, -460); },
  level(){ [523,659,784,1046,1318].forEach((f,i) => tone(f, 0.16, 'square', 0.05, 0, i*0.12)); },
  life(){ [660,880,1320].forEach((f,i) => tone(f, 0.12, 'triangle', 0.07, 0, i*0.09)); },
  start(){ [392,523,659,784].forEach((f,i) => tone(f, 0.14, 'square', 0.05, 0, i*0.13)); },
  shield(){ tone(900, 0.2, 'triangle', 0.07, -500); }
};

/* ---------- Mapa e níveis ---------- */
function cellAt(c, r){
  if (r < 0 || r >= ROWS) return 0;
  if (c < 0 || c >= COLS) return r === TUNNEL ? 1 : 0;
  return S.cells[r][c];
}
function canEnter(c, r, door){
  const v = cellAt(c, r);
  return v === 1 || v === 2 || v === 3 || (v === 4 && !!door);
}

function loadLevel(i){
  const L = LEVELS[i];
  S.levelIdx = i; S.cells = []; S.pelletsLeft = 0;
  for (let r = 0; r < ROWS; r++){
    const row = (L.map[r] || '').padEnd(COLS, '#'), arr = [];
    for (let c = 0; c < COLS; c++){
      const ch = row[c]; let v = 1;
      if (ch === '#') v = 0;
      else if (ch === '.') { v = 2; S.pelletsLeft++; }
      else if (ch === 'o') { v = 3; S.pelletsLeft++; }
      else if (ch === '-') v = 4;
      else if (ch === 'P') S.start = { c, r };
      arr.push(v);
    }
    S.cells.push(arr);
  }
  buildWalls(L);
  resetActors();
  hud();
}

function buildWalls(L){
  wallCv = document.createElement('canvas');
  wallCv.width = W * dpr; wallCv.height = H * dpr;
  const g = wallCv.getContext('2d'); g.scale(dpr, dpr);
  g.fillStyle = '#05071a'; g.fillRect(0, 0, W, H);
  const isW = (c, r) => {
    if (r < 0 || r >= ROWS) return true;
    if (c < 0 || c >= COLS) return r !== TUNNEL;
    return S.cells[r][c] === 0;
  };
  g.globalAlpha = 0.16; g.fillStyle = L.wall;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (S.cells[r][c] === 0) g.fillRect(c*T, r*T, T, T);
  g.globalAlpha = 1;
  g.strokeStyle = L.wall; g.lineWidth = 2.5; g.lineCap = 'round';
  g.shadowColor = L.wall; g.shadowBlur = 8;
  g.beginPath();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    if (S.cells[r][c] !== 0) continue;
    const x = c*T, y = r*T;
    if (!isW(c, r-1)) { g.moveTo(x, y);     g.lineTo(x+T, y); }
    if (!isW(c, r+1)) { g.moveTo(x, y+T);   g.lineTo(x+T, y+T); }
    if (!isW(c-1, r)) { g.moveTo(x, y);     g.lineTo(x, y+T); }
    if (!isW(c+1, r)) { g.moveTo(x+T, y);   g.lineTo(x+T, y+T); }
  }
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = '#ffb8de';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (S.cells[r][c] === 4) g.fillRect(c*T + 2, r*T + T/2 - 2, T - 4, 4);
}

function resetActors(){
  const L = LEVELS[S.levelIdx], st = S.start;
  S.player = { c:st.c, r:st.r, dx:-1, dy:0, t:0, speed:L.pSpeed, want:{x:-1,y:0}, face:{x:-1,y:0}, anim:0, inv:0 };
  S.ghosts = GHOST_DEFS.slice(0, L.nGhosts).map((d, i) => {
    const g = { i, c:d.sc, r:d.sr, dx:0, dy:0, t:0, speed:L.gSpeed, color:d.color, kind:d.kind, corner:d.corner,
                state: d.sr === 7 ? 'normal' : 'house', fright:false, stun:0, release:d.delay * L.relScale };
    if (g.state === 'normal') g.dx = -1;
    return g;
  });
  S.fx = { turbo:0, shield:0, freeze:0, double:0 };
  S.frightTimer = 0; S.ghostMode = 'scatter'; S.modeIdx = 0; S.modeTimer = L.sched[0];
  S.playTime = 0; S.fruits = []; S.fruitTimer = 5; S.popups = [];
}

/* ---------- Movimento ---------- */
function reverse(e){
  e.c += e.dx; e.r += e.dy; e.dx = -e.dx; e.dy = -e.dy; e.t = 1 - e.t;
}
function advance(e, dt, decide, onArrive){
  let d = e.speed * dt, guard = 0;
  while (d > 1e-9 && guard++ < 6){
    if (!e.dx && !e.dy){
      decide(e);
      if (!e.dx && !e.dy) { e.t = 0; return; }
    }
    const need = 1 - e.t;
    if (d < need) { e.t += d; return; }
    d -= need; e.t = 0;
    e.c += e.dx; e.r += e.dy;
    if (e.c < 0 && e.dx < 0) e.c = COLS;
    else if (e.c >= COLS && e.dx > 0) e.c = -1;
    if (onArrive) onArrive(e);
    decide(e);
    if (!e.dx && !e.dy) { e.t = 0; return; }
  }
}

function playerDecide(p){
  if (p.c < 0 || p.c >= COLS) return;
  const w = p.want;
  if ((w.x || w.y) && canEnter(p.c + w.x, p.r + w.y, false)) {
    p.dx = w.x; p.dy = w.y; p.face = { x:w.x, y:w.y };
  } else if (!(p.dx || p.dy) || !canEnter(p.c + p.dx, p.r + p.dy, false)) {
    p.dx = 0; p.dy = 0;
  }
}
function playerArrive(p){
  if (p.c < 0 || p.c >= COLS) return;
  const v = S.cells[p.r][p.c];
  if (v === 2) { S.cells[p.r][p.c] = 1; S.pelletsLeft--; addScore(10); sfx.chomp(); }
  else if (v === 3) { S.cells[p.r][p.c] = 1; S.pelletsLeft--; addScore(50); startFright(); }
}

function bfs(sc, sr, tc, tr){
  if (sc === tc && sr === tr) return null;
  const seen = new Set([sr*100 + sc]), q = [];
  for (const d of DIRS){
    const c = sc + d.x, r = sr + d.y;
    if (c < 0 || c >= COLS) continue;
    if (canEnter(c, r, true)) { seen.add(r*100 + c); q.push({ c, r, d }); }
  }
  for (let i = 0; i < q.length; i++){
    const n = q[i];
    if (n.c === tc && n.r === tr) return n.d;
    for (const d of DIRS){
      const c = n.c + d.x, r = n.r + d.y;
      if (c < 0 || c >= COLS || !canEnter(c, r, true)) continue;
      const k = r*100 + c;
      if (seen.has(k)) continue;
      seen.add(k); q.push({ c, r, d:n.d });
    }
  }
  return null;
}

function ghostTarget(g){
  if (S.ghostMode === 'scatter') return g.corner;
  const p = S.player, f = p.face;
  switch (g.kind){
    case 'chase':  return { c:p.c, r:p.r };
    case 'ambush': return { c:p.c + f.x*4, r:p.r + f.y*4 };
    case 'flank': {
      const b = S.ghosts[0], px = p.c + f.x*2, py = p.r + f.y*2;
      return { c:px*2 - b.c, r:py*2 - b.r };
    }
    case 'shy':    return Math.hypot(g.c - p.c, g.r - p.r) > 7 ? { c:p.c, r:p.r } : g.corner;
    case 'rear':   return { c:p.c - f.x*3, r:p.r - f.y*3 };
  }
  return { c:p.c, r:p.r };
}
function ghostDecide(g){
  if (g.c < 0 || g.c >= COLS) return;
  if (g.state === 'eyes' || g.state === 'leaving'){
    const tg = g.state === 'eyes' ? HOME : EXIT;
    const d = bfs(g.c, g.r, tg.c, tg.r);
    if (d) { g.dx = d.x; g.dy = d.y; } else { g.dx = 0; g.dy = 0; }
    return;
  }
  const moving = g.dx || g.dy, opts = [];
  for (const d of DIRS){
    if (moving && d.x === -g.dx && d.y === -g.dy) continue;
    if (canEnter(g.c + d.x, g.r + d.y, false)) opts.push(d);
  }
  if (!opts.length){
    const d = { x:-g.dx, y:-g.dy };
    if ((d.x || d.y) && canEnter(g.c + d.x, g.r + d.y, false)) opts.push(d);
    else { g.dx = 0; g.dy = 0; return; }
  }
  let pick = opts[0];
  if (g.fright) pick = opts[Math.floor(Math.random() * opts.length)];
  else {
    const tg = ghostTarget(g); let best = Infinity;
    for (const d of opts){
      const nx = g.c + d.x, ny = g.r + d.y, dist = (nx - tg.c)**2 + (ny - tg.r)**2;
      if (dist < best) { best = dist; pick = d; }
    }
  }
  g.dx = pick.x; g.dy = pick.y;
}
function ghostArrive(g){
  if (g.c < 0 || g.c >= COLS) return;
  if (g.state === 'leaving' && g.c === EXIT.c && g.r === EXIT.r) g.state = 'normal';
  else if (g.state === 'eyes' && g.c === HOME.c && g.r === HOME.r) { g.state = 'leaving'; g.fright = false; g.dx = 0; g.dy = 0; }
}

/* ---------- Regras ---------- */
function addScore(n, raw){
  S.score += raw ? n : n * (S.fx.double > 0 ? 2 : 1);
  if (S.score > S.hi) { S.hi = S.score; try { localStorage.setItem('comilao_hi', String(S.hi)); } catch(e) {} }
  if (S.score >= S.nextExtra){
    S.nextExtra += 10000;
    if (S.lives < 5) { S.lives++; sfx.life(); popup('Vida extra!', S.player.c, S.player.r, '#ff7b9c'); }
  }
  hud();
}
function popup(text, c, r, color){ S.popups.push({ x:(c + .5)*T, y:(r + .5)*T, text:String(text), t:0, color:color || '#fff' }); }

function startFright(){
  sfx.power();
  S.frightTimer = LEVELS[S.levelIdx].fright; S.combo = 0;
  for (const g of S.ghosts){
    if (g.state === 'eyes') continue;
    if (g.state === 'normal' && (g.dx || g.dy) && g.c >= 0 && g.c < COLS) reverse(g);
    g.fright = true;
  }
}
function eatGhost(g){
  S.combo = Math.min(S.combo + 1, 4);
  const pts = 100 * Math.pow(2, S.combo);
  addScore(pts);
  popup(pts, g.c + g.dx*g.t, g.r + g.dy*g.t, '#5ff0ff');
  g.state = 'eyes'; g.fright = false; g.stun = 0;
  sfx.ghost();
}
function eatFruit(f){
  const ft = f.type;
  addScore(100);
  if (ft.key === 'life') { S.lives = Math.min(5, S.lives + 1); hud(); }
  else S.fx[ft.key] = ft.dur;
  popup(ft.emoji + ' ' + ft.name, f.c, f.r, '#ffe27a');
  sfx.fruit();
}
function spawnFruit(){
  if (S.fruits.length >= 2) return;
  const p = S.player, cand = [];
  for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++){
    const v = S.cells[r][c];
    if (v !== 1 && v !== 2 && v !== 3) continue;
    if (r >= 8 && r <= 10 && c >= 7 && c <= 11) continue;
    if (Math.hypot(c - p.c, r - p.r) < 5) continue;
    if (S.fruits.some(f => f.c === c && f.r === r)) continue;
    cand.push({ c, r });
  }
  if (!cand.length) return;
  const pool = FRUITS.filter(f => !(f.key === 'life' && S.lives >= 5));
  let total = pool.reduce((a, f) => a + f.w, 0), roll = Math.random() * total, type = pool[0];
  for (const f of pool){ roll -= f.w; if (roll <= 0) { type = f; break; } }
  const pos = cand[Math.floor(Math.random() * cand.length)];
  S.fruits.push({ c:pos.c, r:pos.r, type, ttl:14 });
}

function beginReady(t){ S.mode = 'ready'; S.stateTimer = t; sfx.start(); }
function killPlayer(){
  S.mode = 'dying'; S.stateTimer = 1.6; S.lives--; S.fx = { turbo:0, shield:0, freeze:0, double:0 };
  sfx.death(); hud();
}
function afterDeath(){
  if (S.lives <= 0) return gameOver();
  resetActors(); beginReady(1.6);
}
function levelClear(){
  S.mode = 'clear'; S.stateTimer = 3; sfx.level();
  addScore(1000 * (S.levelIdx + 1), true);
}
function afterClear(){
  if (S.levelIdx >= LEVELS.length - 1) return victory();
  loadLevel(S.levelIdx + 1); beginReady(2.6);
}
function gameOver(){
  S.mode = 'over';
  showOverlay('FIM DE JOGO', 'Os vilões venceram desta vez. Você chegou à <b>' + LEVELS[S.levelIdx].name.toLowerCase() + '</b> com <b>' + S.score + '</b> pontos.', 'Tentar de novo', startGame, 'Enter ou Espaço também funcionam');
  askNick();
}
function victory(){
  S.mode = 'won'; S.popups = [];
  showOverlay('VOCÊ ZEROU O JOGO! 🏆', 'Você limpou as 3 fases e derrotou os vilões.<br>Pontuação final: <b>' + S.score + '</b><br>Recorde: <b>' + S.hi + '</b>', 'Jogar de novo', startGame, 'Enter ou Espaço também funcionam');
  askNick();
}
function startGame(){
  ensureAudio(); renderRank();
  S.score = 0; S.lives = 3; S.nextExtra = 10000;
  loadLevel(0); hideOverlay(); beginReady(2.6);
}
function pauseGame(){
  if (S.mode !== 'playing') return;
  S.mode = 'paused';
  showOverlay('PAUSADO', 'O jogo está parado. Respire e volte quando quiser.', 'Continuar', resumeGame, 'P ou Esc também continuam o jogo');
}
function resumeGame(){ if (S.mode === 'paused') { S.mode = 'playing'; hideOverlay(); } }

/* ---------- Atualização ---------- */
function updatePlaying(dt){
  const L = LEVELS[S.levelIdx], p = S.player;
  S.playTime += dt;
  for (const k in S.fx) S.fx[k] = Math.max(0, S.fx[k] - dt);

  if (S.frightTimer > 0){
    S.frightTimer -= dt;
    if (S.frightTimer <= 0) { S.frightTimer = 0; S.ghosts.forEach(g => g.fright = false); }
  } else {
    S.modeTimer -= dt;
    if (S.modeTimer <= 0){
      S.modeIdx = Math.min(S.modeIdx + 1, L.sched.length - 1);
      S.ghostMode = S.modeIdx % 2 === 0 ? 'scatter' : 'chase';
      S.modeTimer = L.sched[S.modeIdx];
      for (const g of S.ghosts) if (g.state === 'normal' && (g.dx || g.dy) && g.c >= 0 && g.c < COLS) reverse(g);
    }
  }

  p.speed = L.pSpeed * (S.fx.turbo > 0 ? 1.45 : 1);
  advance(p, dt, playerDecide, playerArrive);
  if (p.dx || p.dy) p.anim += dt * 16;
  p.inv = Math.max(0, p.inv - dt);
  if (S.pelletsLeft <= 0) return levelClear();

  for (const g of S.ghosts){
    g.stun = Math.max(0, g.stun - dt);
    if (g.state === 'house') { if (S.playTime >= g.release) g.state = 'leaving'; else continue; }
    const frozen = S.fx.freeze > 0 || g.stun > 0;
    if (frozen && g.state !== 'eyes') continue;
    if (g.state === 'eyes') g.speed = 10;
    else {
      let s = L.gSpeed;
      if (g.fright) s *= 0.55;
      if (g.state === 'leaving') s = Math.min(s, 4);
      if (g.r === TUNNEL && (g.c < 4 || g.c > 14)) s *= 0.6;
      g.speed = s;
    }
    advance(g, dt, ghostDecide, ghostArrive);
  }

  const px = p.c + p.dx * p.t, py = p.r + p.dy * p.t;

  for (let i = S.fruits.length - 1; i >= 0; i--){
    const f = S.fruits[i];
    f.ttl -= dt;
    if (f.ttl <= 0) { S.fruits.splice(i, 1); continue; }
    if (Math.hypot(f.c - px, f.r - py) < 0.6) { eatFruit(f); S.fruits.splice(i, 1); }
  }
  S.fruitTimer -= dt;
  if (S.fruitTimer <= 0){
    spawnFruit();
    const [a, b] = L.fruitEvery; S.fruitTimer = a + Math.random() * (b - a);
  }

  for (const g of S.ghosts){
    if (g.state === 'house' || g.state === 'eyes') continue;
    const gx = g.c + g.dx * g.t, gy = g.r + g.dy * g.t;
    if (Math.hypot(gx - px, gy - py) >= 0.62) continue;
    if (g.fright) { eatGhost(g); continue; }
    if (S.fx.freeze > 0 || g.stun > 0 || p.inv > 0) continue;
    if (S.fx.shield > 0){
      S.fx.shield = 0; g.stun = 2.5; p.inv = 1.2; sfx.shield();
      popup('🛡️ Bloqueado!', p.c, p.r, '#7fe9ff');
      continue;
    }
    killPlayer(); break;
  }
}

function update(dt){
  S.time += dt;
  for (const po of S.popups) po.t += dt;
  S.popups = S.popups.filter(po => po.t < 1.2);
  if (S.mode === 'ready') { S.stateTimer -= dt; if (S.stateTimer <= 0) S.mode = 'playing'; }
  else if (S.mode === 'playing') updatePlaying(dt);
  else if (S.mode === 'dying') { S.stateTimer -= dt; if (S.stateTimer <= 0) afterDeath(); }
  else if (S.mode === 'clear') { S.stateTimer -= dt; if (S.stateTimer <= 0) afterClear(); }
  renderFx();
}

/* ---------- Desenho ---------- */
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const PX_FONT = '"Press Start 2P",ui-monospace,Menlo,Consolas,monospace';

function drawPellets(){
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    const v = S.cells[r][c];
    if (v === 2){
      ctx.fillStyle = '#ffe9c2'; ctx.beginPath(); ctx.arc((c+.5)*T, (r+.5)*T, 2.6, 0, Math.PI*2); ctx.fill();
    } else if (v === 3){
      const pulse = 6.5 + Math.sin(S.time * 8) * 1.6;
      ctx.fillStyle = 'rgba(255,233,194,.22)'; ctx.beginPath(); ctx.arc((c+.5)*T, (r+.5)*T, pulse + 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc((c+.5)*T, (r+.5)*T, pulse, 0, Math.PI*2); ctx.fill();
    }
  }
}
function drawFruits(){
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of S.fruits){
    if (f.ttl < 3 && Math.floor(S.time * 6) % 2 === 0) continue;
    const x = (f.c + .5)*T, y = (f.r + .5)*T, bob = Math.sin(S.time * 5 + f.c) * 1.5;
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.arc(x, y, 13 + Math.sin(S.time*6)*1.5, 0, Math.PI*2); ctx.fill();
    ctx.font = '21px ' + EMOJI_FONT; ctx.fillText(f.type.emoji, x, y + 1 + bob);
  }
}
function drawGhost(g){
  const x = (g.c + g.dx * g.t + .5)*T;
  let y = (g.r + g.dy * g.t + .5)*T;
  if (g.state === 'house') y += Math.sin(S.time * 8 + g.i) * 2;
  const R = T * 0.44, frozen = S.fx.freeze > 0 || g.stun > 0;
  const lookX = g.dx * R * 0.14, lookY = g.dy * R * 0.14;

  if (g.state !== 'eyes'){
    let color = g.color;
    if (g.fright) color = (S.frightTimer < 2 && Math.floor(S.time * 6) % 2 === 0) ? '#ffffff' : '#2f45ff';
    if (frozen && !g.fright) color = '#a8ecff';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 1, R, Math.PI, 0);
    ctx.lineTo(x + R, y + R - 1);
    const steps = 6, sw = 2*R/steps, ph = Math.floor(S.time * 8) % 2;
    for (let i = 1; i <= steps; i++) ctx.lineTo(x + R - i*sw, y + R - 1 - (((i + ph) % 2) ? 5 : 0));
    ctx.closePath(); ctx.fill();
    if (frozen){ ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  if (g.fright && g.state !== 'eyes'){
    ctx.fillStyle = '#ffe8c4';
    ctx.beginPath(); ctx.arc(x - R*.32, y - R*.2, R*.14, 0, Math.PI*2); ctx.arc(x + R*.32, y - R*.2, R*.14, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ffe8c4'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i <= 6; i++){ const px = x - R*.6 + i*(R*1.2/6), py = y + R*.35 + (i % 2 ? -2.5 : 1); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x - R*.36, y - R*.2, R*.3, R*.36, 0, 0, Math.PI*2); ctx.ellipse(x + R*.36, y - R*.2, R*.3, R*.36, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a2cff';
    ctx.beginPath(); ctx.arc(x - R*.36 + lookX, y - R*.2 + lookY, R*.15, 0, Math.PI*2); ctx.arc(x + R*.36 + lookX, y - R*.2 + lookY, R*.15, 0, Math.PI*2); ctx.fill();
  }
}
function drawPlayer(){
  const p = S.player, x = (p.c + p.dx * p.t + .5)*T, y = (p.r + p.dy * p.t + .5)*T, R = T * 0.43;
  const ang = Math.atan2(p.face.y, p.face.x);
  let m = 0.08 + 0.62 * Math.abs(Math.sin(p.anim));
  if (S.mode === 'dying'){
    m = 0.1 + (Math.PI - 0.1) * (1 - S.stateTimer / 1.6);
    if (m >= Math.PI - 0.04) return;
  }
  if (S.fx.turbo > 0 && S.mode !== 'dying'){
    ctx.strokeStyle = 'rgba(255,120,60,.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++){
      const ox = -p.face.x * (R + 4 + Math.random()*8), oy = -p.face.y * (R + 4 + Math.random()*8);
      const px = -p.face.y * i * 6, py = p.face.x * i * 6;
      ctx.beginPath(); ctx.moveTo(x + px + ox, y + py + oy); ctx.lineTo(x + px + ox*2.1, y + py + oy*2.1); ctx.stroke();
    }
  }
  if (S.fx.double > 0){ ctx.fillStyle = 'rgba(255,210,63,.22)'; ctx.beginPath(); ctx.arc(x, y, R + 6, 0, Math.PI*2); ctx.fill(); }
  const blink = p.inv > 0 && Math.floor(S.time * 14) % 2 === 0;
  ctx.globalAlpha = blink ? 0.45 : 1;
  ctx.fillStyle = '#ffe135';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, R, ang + m, ang + Math.PI*2 - m); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  if (S.fx.shield > 0 && S.mode !== 'dying'){
    ctx.strokeStyle = 'rgba(110,235,255,' + (0.6 + Math.sin(S.time * 10) * 0.3) + ')'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, R + 5, 0, Math.PI*2); ctx.stroke();
  }
}
function drawPopups(){
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '10px ' + PX_FONT;
  for (const po of S.popups){
    ctx.globalAlpha = Math.max(0, 1 - po.t / 1.2);
    ctx.fillStyle = '#05071a'; const w = ctx.measureText(po.text).width + 8;
    ctx.fillRect(po.x - w/2, po.y - po.t*26 - 8, w, 16);
    ctx.fillStyle = po.color; ctx.fillText(po.text, po.x, po.y - po.t*26);
  }
  ctx.globalAlpha = 1;
}
function banner(l1, l2, l3, color){
  const bw = 300, bh = 100, x = W/2 - bw/2, y = 11.5*T - bh/2;
  ctx.fillStyle = 'rgba(4,6,24,.86)'; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, 14); else ctx.rect(x, y, bw, bh);
  ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color; ctx.font = '16px ' + PX_FONT; ctx.fillText(l1, W/2, y + 26);
  ctx.fillStyle = '#c9d0ff'; ctx.font = '9px ' + PX_FONT; ctx.fillText(l2, W/2, y + 53);
  if (l3){ ctx.fillStyle = '#ffd23f'; ctx.font = '13px ' + PX_FONT; ctx.fillText(l3, W/2, y + 78); }
}
function draw(){
  ctx.fillStyle = '#05071a'; ctx.fillRect(0, 0, W, H);
  if (wallCv) ctx.drawImage(wallCv, 0, 0, W, H);
  if (!S.player) return;
  drawPellets(); drawFruits();
  if (S.mode !== 'dying' || S.stateTimer > 1.2) S.ghosts.forEach(drawGhost);
  drawPlayer(); drawPopups();
  const L = LEVELS[S.levelIdx];
  if (S.mode === 'ready') banner(L.name.toUpperCase(), L.sub.toUpperCase(), 'PRONTO!', L.wall);
  else if (S.mode === 'clear') banner('FASE COMPLETA!', 'BÔNUS +' + (1000 * (S.levelIdx + 1)), S.levelIdx >= 2 ? 'VITÓRIA!' : 'PRÓXIMA FASE...', '#7dffb0');
}

/* ---------- Interface ---------- */
function hud(){
  el.score.textContent = S.score; el.hi.textContent = S.hi;
  el.lvl.textContent = (S.levelIdx + 1) + '/' + LEVELS.length;
  el.lives.textContent = S.lives > 0 ? '❤'.repeat(S.lives) : '—';
}
function showOverlay(title, html, btn, action, hint){
  ov.title.textContent = title; ov.text.innerHTML = html; ov.btn.textContent = btn;
  nickForm.hidden = true; nickPending = false; ov.btn.classList.remove('ghost');
  ov.hint.textContent = hint || ''; ovAction = action; ov.root.classList.add('show');
}
function hideOverlay(){ ov.root.classList.remove('show'); ovAction = null; }
ov.btn.addEventListener('click', () => { ov.btn.blur(); if (ovAction) ovAction(); });

const fxBox = $('fx'), fxEls = {};
const fxHint = document.createElement('span');
fxHint.className = 'hintfx'; fxHint.textContent = 'Pegue frutas para ganhar poderes';
fxBox.appendChild(fxHint);
for (const k of Object.keys(FXINFO)){
  const d = document.createElement('div');
  d.className = 'chip';
  d.innerHTML = '<span class="e">' + FXINFO[k][0] + '</span><span>' + FXINFO[k][1] + '</span><i><b></b></i>';
  fxBox.appendChild(d);
  fxEls[k] = { box:d, bar:d.querySelector('b'), on:false };
}
function renderFx(){
  let any = false;
  for (const k in fxEls){
    const v = S.fx[k], on = v > 0, e = fxEls[k];
    if (on !== e.on) { e.on = on; e.box.classList.toggle('on', on); }
    if (on) { any = true; e.bar.style.width = Math.min(100, v / FXINFO[k][2] * 100) + '%'; }
  }
  fxHint.style.display = any ? 'none' : '';
}

const legend = $('legend');
FRUITS.forEach(f => {
  const li = document.createElement('li');
  li.innerHTML = '<span class="e" style="color:inherit">' + f.emoji + '</span><div><b>' + f.name + '</b><br><span>' + f.desc + '</span></div>';
  legend.appendChild(li);
});

/* ---------- Rank ---------- */
const RANK_KEY = 'comilao_rank', NICK_KEY = 'comilao_nick', RANK_MAX = 10;
const rankList = $('rankList'), nickForm = $('nickForm'), nickInput = $('nick'), nickErr = $('nickErr');
let rank = [], lastNick = '', nickPending = false;
try {
  const saved = JSON.parse(localStorage.getItem(RANK_KEY));
  if (Array.isArray(saved)) rank = saved.filter(x => x && typeof x.n === 'string' && Number.isFinite(x.s)).slice(0, RANK_MAX);
  lastNick = localStorage.getItem(NICK_KEY) || '';
} catch(e) {}

function qualifies(score){ return score > 0 && (rank.length < RANK_MAX || score > rank[rank.length - 1].s); }
function addRank(name, score, level, won){
  const entry = { n:name, s:score, l:level, w:won, t:Date.now() };
  rank.push(entry);
  rank.sort((a, b) => b.s - a.s || a.t - b.t);
  rank = rank.slice(0, RANK_MAX);
  try { localStorage.setItem(RANK_KEY, JSON.stringify(rank)); } catch(e) {}
  renderRank(entry);
  return entry;
}
function renderRank(mark){
  rankList.textContent = '';
  for (let i = 0; i < RANK_MAX; i++){
    const r = rank[i], li = document.createElement('li');
    li.className = r ? (r === mark ? 'me' : '') : 'slot';
    const pos = document.createElement('span'); pos.className = 'pos'; pos.textContent = (i + 1) + 'º';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r ? r.n : 'Vaga livre';
    const pt = document.createElement('span'); pt.className = 'pt'; pt.textContent = r ? r.s : '—';
    li.append(pos, nm, pt);
    if (r){
      const sm = document.createElement('small'); sm.textContent = r.w ? 'Zerou o jogo 🏆' : 'Chegou à fase ' + r.l;
      li.append(sm);
    }
    rankList.appendChild(li);
  }
}
function askNick(){
  if (!qualifies(S.score)) return;
  nickForm.hidden = false; nickPending = true; nickErr.textContent = '';
  nickInput.value = lastNick;
  ov.btn.textContent = 'Pular e jogar de novo'; ov.btn.classList.add('ghost'); ov.hint.textContent = '';
  nickInput.focus(); nickInput.select();
}
nickForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = nickInput.value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  if (!name){ nickErr.textContent = 'Digite um nickname para salvar.'; nickInput.focus(); return; }
  lastNick = name;
  try { localStorage.setItem(NICK_KEY, name); } catch(err) {}
  const entry = addRank(name, S.score, S.levelIdx + 1, S.mode === 'won');
  ov.text.textContent = name + ', você ficou em ' + (rank.indexOf(entry) + 1) + 'º lugar no rank com ' + S.score + ' pontos.';
  nickForm.hidden = true; nickPending = false;
  ov.btn.textContent = 'Jogar de novo'; ov.btn.classList.remove('ghost');
  ov.hint.textContent = 'Enter ou Espaço também funcionam';
  ovAction = startGame; ov.btn.focus();
});
renderRank();

const resetBtn = $('rankReset');
let resetTimer = 0;
function resetLabel(){ resetBtn.textContent = 'Apagar rank e recorde'; resetBtn.classList.remove('armed'); }
resetBtn.addEventListener('click', () => {
  if (!resetBtn.classList.contains('armed')){
    if (S.mode === 'playing') pauseGame();
    resetBtn.textContent = 'Clique de novo para confirmar';
    resetBtn.classList.add('armed');
    clearTimeout(resetTimer); resetTimer = setTimeout(resetLabel, 4000);
    return;
  }
  clearTimeout(resetTimer); resetLabel();
  rank = []; S.hi = 0; lastNick = '';
  try { localStorage.removeItem(RANK_KEY); localStorage.removeItem(NICK_KEY); localStorage.removeItem('comilao_hi'); } catch(e) {}
  if (S.mode === 'menu' || S.mode === 'over' || S.mode === 'won') S.score = 0;
  if (nickPending){
    nickForm.hidden = true; nickPending = false;
    ov.btn.textContent = S.mode === 'won' ? 'Jogar de novo' : 'Tentar de novo'; ov.btn.classList.remove('ghost');
    ov.hint.textContent = 'Enter ou Espaço também funcionam';
  }
  hud(); renderRank(); resetBtn.blur();
});

/* ---------- Controles ---------- */
const KEYMAP = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0], w:[0,-1], s:[0,1], a:[-1,0], d:[1,0] };
function setDir(x, y){
  if (S.mode !== 'playing' && S.mode !== 'ready') return;
  const p = S.player; p.want = { x, y };
  if (S.mode === 'playing' && (p.dx || p.dy) && p.dx === -x && p.dy === -y) reverse(p);
}
window.addEventListener('keydown', e => {
  if (e.target === nickInput) return; /* digitar o nickname não aciona atalhos do jogo */
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (KEYMAP[k]){
    if (['ready','playing','dying','paused'].includes(S.mode)) e.preventDefault();
    setDir(KEYMAP[k][0], KEYMAP[k][1]);
  } else if (k === 'p' || k === 'Escape'){
    if (S.mode === 'playing') pauseGame(); else if (S.mode === 'paused') resumeGame();
  } else if (k === 'Enter' || k === ' '){
    if (e.target && e.target.tagName === 'BUTTON' && e.target !== ov.btn) return;
    if (nickPending && e.target !== ov.btn) { e.preventDefault(); nickInput.focus(); return; }
    if (ov.root.classList.contains('show') && ovAction) { e.preventDefault(); ovAction(); }
    else if (k === ' ' && S.mode === 'playing') { e.preventDefault(); pauseGame(); }
  } else if (k === 'm') toggleMute();
});
document.querySelectorAll('.pad button').forEach(b => {
  const map = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
  b.addEventListener('pointerdown', e => { e.preventDefault(); const d = map[b.dataset.d]; setDir(d[0], d[1]); });
});
let tx = 0, ty = 0;
canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; }, { passive:true });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
  if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0); else setDir(0, dy > 0 ? 1 : -1);
  tx = t.clientX; ty = t.clientY;
}, { passive:false });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

const muteBtn = $('mute');
function toggleMute(){ muted = !muted; muteBtn.textContent = muted ? '🔇 Mudo' : '🔊 Som'; }
muteBtn.addEventListener('click', () => { muteBtn.blur(); toggleMute(); });

/* ---------- Início ---------- */
loadLevel(0);
showOverlay('COMILÃO',
  'Coma todas as bolinhas de cada labirinto e fuja dos vilões. As super bolinhas deixam os vilões azuis e comestíveis, e as frutas dão poderes. Zere as 3 fases para vencer!',
  'Jogar', startGame, 'Recorde atual: ' + S.hi);

let last = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
