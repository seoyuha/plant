/* Garden Road Defense — 정원으로 가는 길을 막아라! (6학년 영어 9단원 복습)
   Node.js 내장 모듈만 사용 (npm 설치 불필요). 실시간 전송은 SSE. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const BANK = require('./questions.js');
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');

/* ───────── 게임 수치 ───────── */
const UNITS = {
  sun: { cost: 50, hp: 90, cd: 0 },                          // 🌻 태양꽃: 12초마다 태양 +25
  pea: { cost: 100, hp: 100, cd: 1.35, damage: 22 },          // 🌱 완두콩: 기본 공격
  wall: { cost: 50, hp: 460, cd: 0 },                         // 🪵 방어벽: 튼튼한 벽
  cactus: { cost: 125, hp: 100, cd: 1.6, damage: 36 },        // 🌵 선인장: 강한 공격
  ice: { cost: 150, hp: 100, cd: 2.1, damage: 12, slow: 3 },   // 🍄 얼음버섯: 느리게
  fire: { cost: 175, hp: 90, cd: 2.6, damage: 55, splash: 20 }, // 🌶️ 불꽃고추: 주변까지 피해
};
const WAVES = 6, LIVES = 5, COLS = 9, ROWS = 5;
const waveTarget = w => 6 + w * 2;          // 8, 10, 12, 14, 16대
const START_TICKETS = 150, FIRST_DELAY = 15, WAVE_BREAK = 8;

/* ───────── 저장소 (메모리) ───────── */
const classes = new Map();   // 반 코드 → { code, token, name, teams:[roomId], createdAt, last, questions }
const rooms = new Map();     // 방 id → room
const rid = n => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();

function newCode() { let c; do { c = String(1000 + Math.floor(Math.random() * 9000)); } while (classes.has(c)); return c; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function makeRoom(opts) {
  const id = rid(3).toUpperCase();
  const r = {
    id, mode: opts.mode, classCode: opts.classCode || null, team: opts.team || 0, max: opts.mode === 'solo' ? 1 : 6,
    players: {}, tickets: START_TICKETS, units: [], robots: [], shots: [], fx: [],
    wave: 1, elapsed: 0, spawnT: -FIRST_DELAY, spawned: 0, defeated: 0, lives: LIVES,
    status: 'waiting', result: '', events: [], clients: new Set(), last: now(), touched: now(),
    soloKey: opts.soloKey || null,
  };
  rooms.set(id, r);
  return r;
}
const bankOf = r => (r.classCode && classes.get(r.classCode) && classes.get(r.classCode).questions) || BANK;

function resetRoom(r) {
  Object.assign(r, { tickets: START_TICKETS, units: [], robots: [], shots: [], fx: [], wave: 1, elapsed: 0, spawnT: -FIRST_DELAY, spawned: 0, defeated: 0, lives: LIVES, status: 'waiting', result: '', events: [] });
}
function log(r, t) { r.events.push(t); if (r.events.length > 12) r.events.shift(); }

/* ───────── 게임 진행 ───────── */
function tick(r, dt) {
  if (r.status !== 'playing') return;
  r.elapsed += dt; r.spawnT += dt;
  const target = waveTarget(r.wave), interval = Math.max(1.5, 4.8 - r.wave * 0.65);
  if (r.spawnT >= interval && r.spawned < target) {
    r.spawnT = 0; r.spawned++;
    const kind = r.wave > 1 && Math.random() < Math.min(0.1 + r.wave * 0.09, 0.55) ? 'bucket' : 'zombie';
    const hp = r.wave === 1 ? 75 : Math.round((kind === 'bucket' ? 170 : 95) * (1 + 0.25 * (r.wave - 1)));
    r.robots.push({ id: rid(5), row: Math.floor(Math.random() * ROWS), x: 9.2, hp, max: hp, speed: kind === 'bucket' ? 0.25 : 0.34, kind, bite: 0, slow: 0, hitAt: 0 });
  }
  const t = now();
  for (const u of r.units) {
    const T = UNITS[u.kind];
    u.cdLeft -= dt;
    if (u.kind === 'sun') { u.produce = (u.produce || 0) + dt; if (u.produce >= 12) { u.produce = 0; r.tickets = Math.min(999, r.tickets + 25); r.fx.push({ k: 'sun', row: u.row, x: u.col + 0.5, t }); } }
    if (!T.damage || u.cdLeft > 0) continue;
    const targets = r.robots.filter(z => z.row === u.row && z.x > u.col + 0.15 && z.x < COLS + 0.1).sort((a, b) => a.x - b.x);
    if (!targets.length) continue;
    const z = targets[0];
    z.hp -= T.damage; z.hitAt = t;
    if (T.slow) z.slow = T.slow;
    if (T.splash) for (const z2 of r.robots) if (z2 !== z && z2.row === u.row && Math.abs(z2.x - z.x) < 1.2) { z2.hp -= T.splash; z2.hitAt = t; }
    r.shots.push({ row: u.row, from: u.col, to: z.x, t, kind: u.kind });
    u.cdLeft = T.cd; u.firedAt = t;
  }
  r.robots = r.robots.filter(z => { if (z.hp <= 0) { r.defeated++; r.fx.push({ k: 'boom', row: z.row, x: z.x, t }); return false; } return true; });
  for (const z of r.robots) {
    z.slow = Math.max(0, z.slow - dt);
    const u = r.units.find(p => p.row === z.row && Math.abs(z.x - (p.col + 0.5)) < 0.52);
    if (u) { z.biting = true; z.bite += dt; if (z.bite >= 1) { u.hp -= 25; u.hurtAt = t; z.bite = 0; } }
    else { z.biting = false; z.x -= z.speed * dt * (z.slow > 0 ? 0.45 : 1); }
    if (z.x < 0) { r.lives--; z.hp = -999; r.fx.push({ k: 'alarm', row: z.row, x: 0.2, t }); log(r, '🚨 좀비가 정원에 들어왔어요!'); }
  }
  r.units = r.units.filter(u => { if (u.hp <= 0) { r.fx.push({ k: 'poof', row: u.row, x: u.col + 0.5, t }); return false; } return true; });
  r.robots = r.robots.filter(z => z.hp > -999);
  r.shots = r.shots.filter(s => t - s.t < 400);
  r.fx = r.fx.filter(f => t - f.t < 1200);
  if (r.lives <= 0) { r.lives = 0; r.status = 'ended'; r.result = 'defeat'; log(r, '💀 정원을 지키지 못했어요…'); }
  else if (r.spawned >= target && r.robots.length === 0) {
    if (r.wave >= WAVES) { r.status = 'ended'; r.result = 'victory'; log(r, '🏆 정원을 지켜 냈어요!'); }
    else { r.wave++; r.spawned = 0; r.spawnT = -WAVE_BREAK; r.tickets = Math.min(999, r.tickets + 75); log(r, `🌊 ${r.wave}번째 공격! 보너스 태양 +75`); }
  }
}
setInterval(() => {
  const t = now();
  for (const r of rooms.values()) {
    const dt = Math.min((t - r.last) / 1000, 0.5); r.last = t;
    tick(r, dt);
    if (r.clients.size) notify(r);
  }
}, 250);
// 3시간 동안 쓰지 않은 방·반 정리
setInterval(() => {
  const lim = now() - 3 * 3600e3;
  for (const [id, r] of rooms) if (r.touched < lim && !r.clients.size) rooms.delete(id);
  for (const [c, k] of classes) if (k.last < lim && !k.teams.some(id => rooms.has(id))) classes.delete(c);
}, 10 * 60e3);

/* ───────── 공개 정보 ───────── */
function playerPub(p) { return { name: p.name, correct: p.correct, wrong: p.wrong, earned: p.earned, online: p.conns > 0 }; }
function roomPub(r) {
  return {
    id: r.id, mode: r.mode, team: r.team, classCode: r.classCode, max: r.max,
    players: Object.values(r.players).map(playerPub), tickets: r.tickets,
    units: r.units.map(u => ({ id: u.id, row: u.row, col: u.col, kind: u.kind, hp: u.hp, max: UNITS[u.kind].hp, owner: u.owner, fired: now() - (u.firedAt || 0) < 350, hurt: now() - (u.hurtAt || 0) < 350 })),
    robots: r.robots.map(z => ({ id: z.id, row: z.row, x: +z.x.toFixed(3), kind: z.kind, hp: z.hp, max: z.max, slow: z.slow > 0, biting: z.biting, hurt: now() - z.hitAt < 300 })),
    shots: r.shots, fx: r.fx, wave: r.wave, waves: WAVES, target: waveTarget(r.wave), spawned: r.spawned,
    defeated: r.defeated, lives: r.lives, status: r.status, result: r.result, elapsed: Math.floor(r.elapsed), events: r.events.slice(-5),
  };
}
function notify(r) {
  const msg = 'data: ' + JSON.stringify(roomPub(r)) + '\n\n';
  for (const c of r.clients) { try { c.write(msg); } catch (e) { r.clients.delete(c); } }
}

/* ───────── 문제 출제 (학생별) ───────── */
function nextQuestion(r, p) {
  const bank = bankOf(r);
  if (!p.queue.length) p.queue = shuffle(bank.map((_, i) => i));
  let i = -1;
  const due = p.retry.findIndex(x => x.due <= p.asked);
  if (due >= 0) i = p.retry.splice(due, 1)[0].i;
  if (i < 0 || !bank[i]) i = p.queue.pop();
  const q = bank[i];
  const order = shuffle([0, 1, 2, 3]);
  p.pending = { i, order, at: now() };
  p.asked++;
  return { q: q.q, ko: q.ko || '', cat: q.cat || '', opts: order.map(k => q.opts[k]), n: p.asked };
}

/* ───────── HTTP ───────── */
function send(res, status, obj) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function body(req) {
  return new Promise((ok, bad) => {
    let s = ''; req.on('data', c => { s += c; if (s.length > 2e6) { bad(Error('보낸 내용이 너무 커요.')); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { bad(Error('잘못된 요청이에요.')); } });
  });
}
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
function auth(r, b) { const p = r && r.players[b.pid]; return p && p.key === b.key ? p : null; }
function isTeacher(r, b) { const c = r.classCode && classes.get(r.classCode); return (c && b.token === c.token) || (r.mode === 'solo' && auth(r, b)); }
function addPlayer(r, name) {
  const pid = rid(6), key = rid(10);
  r.players[pid] = { pid, key, name, correct: 0, wrong: 0, earned: 0, conns: 0, joinedAt: now(), queue: [], retry: [], asked: 0, pending: null, lockUntil: 0, log: [] };
  return r.players[pid];
}

async function api(req, res, url) {
  const b = req.method === 'POST' ? await body(req) : {};
  const P = url.pathname.slice(5);

  /* 교사: 반 만들기 (모둠 방 여러 개를 한 번에) */
  if (P === 'class/create') {
    const n = Math.max(1, Math.min(8, Number(b.teams) || 6));
    const code = newCode(), token = rid(12);
    const c = { code, token, name: clean(b.name, 30) || '우리 반', teams: [], createdAt: now(), last: now(), questions: null };
    for (let t = 1; t <= n; t++) c.teams.push(makeRoom({ mode: 'team', classCode: code, team: t }).id);
    classes.set(code, c);
    return send(res, 200, { code, token });
  }
  if (P === 'class/info') {   // 학생 입장 화면: 모둠 목록
    const c = classes.get(clean(url.searchParams.get('code'), 6));
    if (!c) return send(res, 404, { error: '반 코드를 찾을 수 없어요. 선생님께 다시 확인해 주세요.' });
    return send(res, 200, { name: c.name, teams: c.teams.map(id => rooms.get(id)).filter(Boolean).map(r => ({ team: r.team, id: r.id, count: Object.keys(r.players).length, max: r.max, status: r.status })) });
  }
  if (P === 'class/dash') {
    const c = classes.get(clean(url.searchParams.get('code'), 6));
    if (!c || url.searchParams.get('token') !== c.token) return send(res, 403, { error: '교사 권한이 없어요.' });
    c.last = now();
    const teams = c.teams.map(id => rooms.get(id)).filter(Boolean).map(r => {
      r.touched = now();
      const pub = roomPub(r);
      return { team: r.team, id: r.id, status: r.status, result: r.result, wave: r.wave, waves: WAVES, lives: r.lives, tickets: r.tickets, defeated: r.defeated, elapsed: pub.elapsed, units: r.units.length, robots: r.robots.length,
        players: Object.values(r.players).map(p => ({ ...playerPub(p), log: p.log.slice(-400) })) };
    });
    return send(res, 200, { code: c.code, name: c.name, teams, custom: !!c.questions, qCount: (c.questions || BANK).length });
  }
  if (P === 'class/control') {
    const c = classes.get(clean(b.code, 6));
    if (!c || b.token !== c.token) return send(res, 403, { error: '교사 권한이 없어요.' });
    const list = c.teams.map(id => rooms.get(id)).filter(r => r && (!b.team || r.team === Number(b.team)));
    for (const r of list) {
      if ((b.action === 'start') && r.status !== 'ended') r.status = 'playing';
      if (b.action === 'pause' && r.status === 'playing') r.status = 'paused';
      if (b.action === 'reset') resetRoom(r);
      if (b.action === 'resetScores') for (const p of Object.values(r.players)) { p.correct = 0; p.wrong = 0; p.earned = 0; p.log = []; }
      r.touched = now(); notify(r);
    }
    return send(res, 200, { ok: true });
  }
  if (P === 'class/questions') {
    const c = classes.get(clean(b.code, 6));
    if (!c || b.token !== c.token) return send(res, 403, { error: '교사 권한이 없어요.' });
    if (b.reset) { c.questions = null; }
    else {
      if (!Array.isArray(b.questions) || !b.questions.length || b.questions.length > 1000) return send(res, 400, { error: '문제 목록이 비어 있어요.' });
      const qs = b.questions.map(x => ({ q: clean(x.q, 300), ko: '', cat: '업로드', opts: (x.opts || []).map(o => clean(o, 120)), answer: Number(x.answer) }));
      if (qs.some(x => !x.q || x.opts.length !== 4 || x.opts.some(o => !o) || !(x.answer >= 0 && x.answer <= 3))) return send(res, 400, { error: '모든 문제에 보기 4개와 정답 번호(1~4)가 있어야 해요.' });
      c.questions = qs.map(x => ({ q: x.q, ko: '', cat: '업로드', opts: [x.opts[x.answer], ...x.opts.filter((_, i) => i !== x.answer)] }));
    }
    for (const id of c.teams) { const r = rooms.get(id); if (r) for (const p of Object.values(r.players)) { p.queue = []; p.retry = []; p.pending = null; } }
    return send(res, 200, { count: (c.questions || BANK).length });
  }

  /* 학생: 모둠 들어가기 / 혼자 연습 */
  if (P === 'join') {
    const name = clean(b.name, 12);
    if (!name) return send(res, 400, { error: '이름을 써 주세요.' });
    let r;
    if (b.solo) { r = makeRoom({ mode: 'solo' }); }
    else {
      const c = classes.get(clean(b.code, 6));
      if (!c) return send(res, 404, { error: '반 코드를 찾을 수 없어요.' });
      r = c.teams.map(id => rooms.get(id)).find(x => x && x.team === Number(b.team));
      if (!r) return send(res, 404, { error: '모둠을 골라 주세요.' });
    }
    // 같은 이름으로 다시 들어오면(새로고침·기기 바꿈) 기존 기록을 이어 받음
    let p = Object.values(r.players).find(x => x.name === name);
    if (p && b.pid === p.pid && b.key === p.key) { /* 그대로 */ }
    else if (p) { p.key = rid(10); }
    else {
      if (Object.keys(r.players).length >= r.max) return send(res, 400, { error: `이 모둠은 가득 찼어요 (${r.max}명). 다른 모둠을 골라 주세요.` });
      p = addPlayer(r, name);
    }
    r.touched = now(); notify(r);
    return send(res, 200, { room: r.id, pid: p.pid, key: p.key, solo: r.mode === 'solo', team: r.team });
  }
  if (P === 'rejoin') {
    const r = rooms.get(clean(b.room, 8)); const p = auth(r, b);
    if (!p) return send(res, 404, { error: '다시 들어가지 못했어요.' });
    return send(res, 200, { room: r.id, solo: r.mode === 'solo', team: r.team });
  }

  const r = rooms.get(clean(b.room || url.searchParams.get('room'), 8));
  if (!r) return send(res, 404, { error: '방을 찾을 수 없어요. 서버가 다시 시작되었을 수 있어요. 처음 화면에서 다시 들어가 주세요.' });
  r.touched = now();

  if (P === 'stream') {
    const p = r.players[url.searchParams.get('pid')];
    const isT = r.classCode && classes.get(r.classCode) && url.searchParams.get('token') === classes.get(r.classCode).token;
    if (!(p && p.key === url.searchParams.get('key')) && !isT) return send(res, 403, { error: '권한이 없어요.' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\ndata: ' + JSON.stringify(roomPub(r)) + '\n\n');
    r.clients.add(res); if (p) p.conns++;
    req.on('close', () => { r.clients.delete(res); if (p) p.conns = Math.max(0, p.conns - 1); });
    return;
  }
  const p = auth(r, b);
  if (P === 'control') {
    if (!isTeacher(r, b)) return send(res, 403, { error: '시작은 선생님이 해요.' });
    if (b.action === 'start' && r.status !== 'ended') r.status = 'playing';
    if (b.action === 'pause' && r.status === 'playing') r.status = 'paused';
    if (b.action === 'reset') resetRoom(r);
    notify(r); return send(res, 200, { ok: true });
  }
  if (!p) return send(res, 403, { error: '먼저 들어가 주세요.' });
  if (P === 'question') {
    if (b.skip && p.pending) { p.retry.push({ i: p.pending.i, due: p.asked + 4 }); }
    else if (p.pending && !b.skip) {   // 새로고침해도 같은 문제를 다시 보여 줌
      const q = bankOf(r)[p.pending.i];
      if (q) return send(res, 200, { q: q.q, ko: q.ko || '', cat: q.cat || '', opts: p.pending.order.map(k => q.opts[k]), n: p.asked, lockLeft: Math.max(0, p.lockUntil - now()) });
    }
    return send(res, 200, Object.assign(nextQuestion(r, p), { lockLeft: Math.max(0, p.lockUntil - now()) }));
  }
  if (P === 'answer') {
    if (!p.pending) return send(res, 400, { error: '새 문제를 받아 주세요.' });
    if (now() < p.lockUntil) return send(res, 429, { error: '잠깐! 조금 뒤에 다시 풀 수 있어요.', lockLeft: p.lockUntil - now() });
    const q = bankOf(r)[p.pending.i];
    const chosen = Number(b.choice);
    if (!(chosen >= 0 && chosen <= 3) || !q) return send(res, 400, { error: '보기를 골라 주세요.' });
    const ok = p.pending.order[chosen] === 0;
    const answerIdx = p.pending.order.indexOf(0);
    const rec = { t: now(), q: q.q.split('\n')[0].slice(0, 120), cat: q.cat, answer: q.opts[0], chosen: q.opts[p.pending.order[chosen]], ok, ms: now() - p.pending.at };
    p.log.push(rec); if (p.log.length > 600) p.log.shift();
    let reward = 0;
    if (ok) {
      p.correct++;
      if (r.status !== 'ended') { reward = 50; p.earned += reward; r.tickets = Math.min(999, r.tickets + reward); }
    } else {
      p.wrong++; p.lockUntil = now() + 3000;
      p.retry.push({ i: p.pending.i, due: p.asked + 3 });   // 틀린 문제는 3문제 뒤에 다시
    }
    p.pending = null;
    notify(r);
    return send(res, 200, { correct: ok, answer: answerIdx, answerText: q.opts[0], reward, tickets: r.tickets, lockLeft: Math.max(0, p.lockUntil - now()) });
  }
  if (P === 'place') {
    if (r.status !== 'playing') return send(res, 400, { error: r.status === 'ended' ? '게임이 끝났어요.' : '시작하면 놓을 수 있어요.' });
    const row = Number(b.row), col = Number(b.col), kind = String(b.kind);
    if (!Number.isInteger(row) || row < 0 || row >= ROWS || !Number.isInteger(col) || col < 0 || col > COLS - 2 || !UNITS[kind]) return send(res, 400, { error: '그곳에는 놓을 수 없어요.' });
    if (r.units.some(u => u.row === row && u.col === col)) return send(res, 400, { error: '이미 다른 것이 있어요.' });
    if (r.tickets < UNITS[kind].cost) return send(res, 400, { error: '태양이 부족해요. 문제를 풀어 태양을 모아요!' });
    r.tickets -= UNITS[kind].cost;
    r.units.push({ id: rid(5), row, col, kind, hp: UNITS[kind].hp, cdLeft: 0, produce: 0, owner: p.name });
    notify(r); return send(res, 200, { ok: true });
  }
  if (P === 'remove') {
    const i = r.units.findIndex(u => u.row === Number(b.row) && u.col === Number(b.col));
    if (i < 0) return send(res, 400, { error: '치울 것이 없어요.' });
    const u = r.units.splice(i, 1)[0];
    r.tickets = Math.min(999, r.tickets + Math.floor(UNITS[u.kind].cost / 2));
    notify(r); return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: '알 수 없는 요청이에요.' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    try { await api(req, res, url); } catch (e) { if (!res.headersSent) send(res, 400, { error: e.message }); }
    return;
  }
  if (url.pathname === '/health') { res.end('ok'); return; }
  let f = url.pathname === '/' ? '/index.html' : url.pathname === '/teacher' ? '/teacher.html' : url.pathname;
  const file = path.normalize(path.join(PUB, decodeURIComponent(f)));
  if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('페이지를 찾을 수 없어요.'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Garden Road Defense: http://localhost:${PORT}  (교사: /teacher)`));
