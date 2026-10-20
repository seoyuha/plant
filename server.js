/* 정원 대결 — 정원으로 가는 길을 막아라! (6학년 영어 9단원) 학생끼리 좀비 보내기 대결 서버
   Node.js 내장 모듈만 사용 (npm 설치 불필요). 실시간 전송은 SSE.
   게임 화면(식물·좀비 움직임)은 각 학생 기기에서 돌아가고, 서버는 방·순위·보낸 좀비만 전해 줘요. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');

const MAX_PLAYERS = 4;          // 한 방 최대 인원 (2명이면 1:1)
const TIME_LIMIT = 6 * 60;      // 한 판 시간 (초)
const COUNTDOWN = 4;            // 시작 전 카운트다운 (초)
const LIVES = 5;

/* ───────── 교사 비밀번호 ─────────
   1) Render 환경 변수 TEACHER_PASSWORD 가 있으면 그것을 써요 (서버가 다시 시작돼도 그대로, 추천)
   2) 없으면 교사 화면에 처음 들어갈 때 한 번 정하고, teacher_password.json 에 (암호화해서) 저장해요 */
const PASS_FILE = path.join(__dirname, 'teacher_password.json');
const ENV_PASS = process.env.TEACHER_PASSWORD ? String(process.env.TEACHER_PASSWORD) : '';
let passRec = null;   // { salt, hash }
try { passRec = JSON.parse(fs.readFileSync(PASS_FILE, 'utf8')); } catch (e) {}
const hashPass = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex');
const sameStr = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const passIsSet = () => !!ENV_PASS || !!passRec;
function checkPass(pw) {
  if (!pw) return false;
  if (ENV_PASS) return sameStr(pw, ENV_PASS);
  return !!passRec && sameStr(hashPass(pw, passRec.salt), passRec.hash);
}
function savePass(pw) {
  const salt = rid(16); passRec = { salt, hash: hashPass(pw, salt) };
  try { fs.writeFileSync(PASS_FILE, JSON.stringify(passRec)); } catch (e) {}
}
const failed = new Map();   // IP → { n, until } 비밀번호를 여러 번 틀리면 잠깐 막기
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

const rooms = new Map();        // 방 코드 → room
const records = new Map();      // 이름 → { name, games, wins, correct, wrong, sent }
const rid = n => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();
const clean = (s, n) => String(s == null ? '' : s).replace(/[<>&"'`\u0000-\u001f]/g, '').trim().slice(0, n);

function newCode() { let c; do { c = String(1000 + Math.floor(Math.random() * 9000)); } while (rooms.has(c)); return c; }

function makeRoom(stage) {
  const r = { code: newCode(), stage, host: null, players: {}, order: [], status: 'lobby', startAt: 0, endAt: 0,
    winner: null, ranking: [], feed: [], clients: new Map(), created: now(), touched: now(), round: 0 };
  rooms.set(r.code, r);
  return r;
}
function addPlayer(r, name) {
  const p = { pid: rid(6), key: rid(10), name, lives: LIVES, correct: 0, wrong: 0, sent: 0, got: 0, score: 0,
    alive: true, outAt: 0, conns: 0, lastSeen: now() };
  r.players[p.pid] = p; r.order.push(p.pid);
  if (!r.host) r.host = p.pid;
  return p;
}
function resetPlayers(r) {
  for (const p of Object.values(r.players)) Object.assign(p, { lives: LIVES, correct: 0, wrong: 0, sent: 0, got: 0, score: 0, alive: true, outAt: 0 });
}
const list = r => r.order.map(id => r.players[id]).filter(Boolean);
function feed(r, t) { r.feed.push(t); if (r.feed.length > 6) r.feed.shift(); }

function pub(r) {
  return {
    code: r.code, stage: r.stage, status: r.status, host: r.host, round: r.round,
    startAt: r.startAt, endAt: r.endAt, serverNow: now(), winner: r.winner, ranking: r.ranking, feed: r.feed,
    players: list(r).map(p => ({ pid: p.pid, name: p.name, lives: p.lives, correct: p.correct, wrong: p.wrong, sent: p.sent, got: p.got,
      score: p.score, alive: p.alive, online: p.conns > 0 })),
  };
}
function write(res, ev, data) { try { res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) {} }
function notify(r) { const d = pub(r); for (const res of r.clients.keys()) write(res, 'room', d); }
function sendTo(r, pid, ev, data) { for (const [res, id] of r.clients) if (id === pid) write(res, ev, data); }

function rank(r) {
  /* 늦게 탈락할수록, 목숨이 많을수록, 정답이 많을수록 위 */
  return list(r).slice().sort((a, b) =>
    (b.alive - a.alive) || ((b.outAt || Infinity) - (a.outAt || Infinity)) || (b.lives - a.lives) || (b.correct - a.correct) || (b.score - a.score));
}
function finish(r, why) {
  if (r.status !== 'playing') return;
  r.status = 'over';
  const rk = rank(r);
  r.winner = rk[0] ? rk[0].pid : null;
  r.ranking = rk.map(p => p.pid);
  feed(r, why === 'time' ? '⏰ 시간이 다 됐어요!' : '🏁 정원이 하나만 남았어요!');
  for (const p of rk) {
    const rec = records.get(p.name) || { name: p.name, games: 0, wins: 0, correct: 0, wrong: 0, sent: 0 };
    rec.games++; if (p.pid === r.winner) rec.wins++;
    rec.correct += p.correct; rec.wrong += p.wrong; rec.sent += p.sent;
    records.set(p.name, rec);
  }
  notify(r);
}
function checkEnd(r) {
  if (r.status !== 'playing') return;
  const alive = list(r).filter(p => p.alive);
  if (alive.length <= 1) finish(r, 'last');
}

/* 1초마다: 카운트다운 → 시작, 시간 끝, 연결 끊긴 학생 탈락, 오래된 방 정리 */
setInterval(() => {
  const t = now();
  for (const r of rooms.values()) {
    if (r.status === 'countdown' && t >= r.startAt) { r.status = 'playing'; notify(r); }
    if (r.status === 'playing') {
      if (t >= r.endAt) finish(r, 'time');
      for (const p of list(r)) if (p.alive && p.conns === 0 && t - p.lastSeen > 25000) {
        p.alive = false; p.outAt = t; feed(r, `📴 ${p.name} 연결이 끊겨 탈락했어요.`); notify(r);
      }
      checkEnd(r);
    }
    if (t - r.touched > 2 * 3600 * 1000 && r.clients.size === 0) rooms.delete(r.code);
  }
}, 1000);
/* 연결 유지용 신호 */
setInterval(() => { for (const r of rooms.values()) for (const res of r.clients.keys()) { try { res.write(': ping\n\n'); } catch (e) {} } }, 20000);

function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function body(req) {
  return new Promise((ok, bad) => { let d = ''; req.on('data', c => { d += c; if (d.length > 2e4) { bad(new Error('너무 커요')); req.destroy(); } });
    req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { bad(new Error('잘못된 요청')); } }); });
}
const auth = (r, b) => { const p = r && r.players[b.pid]; return p && p.key === b.key ? p : null; };

async function api(req, res, url) {
  const P = url.pathname.slice(5);
  const b = req.method === 'POST' ? await body(req) : {};

  /* 교사: 비밀번호 */
  if (P === 'teacher/state') return send(res, 200, { set: passIsSet(), env: !!ENV_PASS });
  if (P === 'teacher/setup') {
    if (passIsSet()) return send(res, 400, { error: '비밀번호가 이미 정해져 있어요.' });
    const pw = String(b.password || '');
    if (pw.length < 4 || pw.length > 40) return send(res, 400, { error: '비밀번호는 4~40글자로 정해 주세요.' });
    savePass(pw); return send(res, 200, { ok: true });
  }
  if (P === 'overview' || P === 'clear' || P === 'teacher/login' || P === 'teacher/change') {
    const ip = ipOf(req), f = failed.get(ip);
    if (f && f.until > now()) return send(res, 429, { error: `비밀번호를 여러 번 틀렸어요. ${Math.ceil((f.until - now()) / 1000)}초 뒤에 다시 해 주세요.` });
    if (!passIsSet()) return send(res, 401, { error: '먼저 비밀번호를 정해 주세요.', setup: true });
    const pw = req.headers['x-teacher-pass'] ? decodeURIComponent(req.headers['x-teacher-pass']) : b.password;
    if (!checkPass(pw)) {
      const g = f || { n: 0, until: 0 }; g.n++;
      if (g.n >= 5) { g.until = now() + 60000; g.n = 0; }
      failed.set(ip, g);
      return send(res, 401, { error: '비밀번호가 맞지 않아요.' });
    }
    failed.delete(ip);
  }
  if (P === 'teacher/login') return send(res, 200, { ok: true });
  if (P === 'teacher/change') {
    if (ENV_PASS) return send(res, 400, { error: 'Render 환경 변수(TEACHER_PASSWORD)로 정한 비밀번호는 Render에서 바꿔요.' });
    const np = String(b.newPassword || '');
    if (np.length < 4 || np.length > 40) return send(res, 400, { error: '새 비밀번호는 4~40글자로 정해 주세요.' });
    savePass(np); return send(res, 200, { ok: true });
  }

  /* 교사: 전체 방과 기록 보기 */
  if (P === 'overview') {
    return send(res, 200, {
      rooms: [...rooms.values()].sort((a, b) => b.created - a.created).map(pub),
      records: [...records.values()].sort((a, b) => b.wins - a.wins || b.correct - a.correct),
    });
  }
  if (P === 'clear') {
    if (b.what === 'records') records.clear();
    if (b.what === 'rooms') for (const [c, r] of rooms) if (r.status !== 'playing') rooms.delete(c);
    return send(res, 200, { ok: true });
  }

  /* 학생: 방 만들기 / 들어가기 */
  if (P === 'create' || P === 'join') {
    const name = clean(b.name, 10);
    if (!name) return send(res, 400, { error: '이름을 써 주세요.' });
    let r;
    if (P === 'create') {
      const st = Number(b.stage);
      r = makeRoom(st >= 0 && st <= 5 ? st : 0);
    } else {
      r = rooms.get(clean(b.code, 4));
      if (!r) return send(res, 404, { error: '방 번호를 찾을 수 없어요. 숫자 4개를 다시 확인해 주세요.' });
      const same = list(r).find(p => p.name === name);
      if (same && b.pid === same.pid && b.key === same.key) { r.touched = now(); return send(res, 200, { code: r.code, pid: same.pid, key: same.key }); }
      if (same) return send(res, 400, { error: '이 방에 같은 이름이 있어요. 이름 뒤에 번호를 붙여 주세요.' });
      if (r.status !== 'lobby') return send(res, 400, { error: '이미 대결이 시작된 방이에요. 끝나면 다시 들어와 주세요.' });
      if (r.order.length >= MAX_PLAYERS) return send(res, 400, { error: `방이 가득 찼어요 (${MAX_PLAYERS}명).` });
    }
    const p = addPlayer(r, name);
    r.touched = now(); notify(r);
    return send(res, 200, { code: r.code, pid: p.pid, key: p.key });
  }

  const r = rooms.get(clean(b.code || url.searchParams.get('code'), 4));
  if (!r) return send(res, 404, { error: '방이 없어졌어요. 서버가 다시 시작되었을 수 있어요. 처음 화면에서 다시 들어가 주세요.' });
  r.touched = now();

  if (P === 'stream') {
    const p = r.players[url.searchParams.get('pid')];
    if (!(p && p.key === url.searchParams.get('key'))) return send(res, 403, { error: '권한이 없어요.' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\n');
    r.clients.set(res, p.pid); p.conns++; p.lastSeen = now();
    /* 대결 중에 새로고침하면 정원이 처음으로 돌아가므로 탈락으로 처리해요 */
    if (r.status === 'playing' && p.alive && url.searchParams.get('fresh') === '1') {
      p.alive = false; p.lives = 0; p.outAt = now(); feed(r, `🔄 ${p.name} 새로고침으로 탈락했어요.`); checkEnd(r);
    }
    write(res, 'room', pub(r)); notify(r);
    req.on('close', () => { r.clients.delete(res); p.conns = Math.max(0, p.conns - 1); p.lastSeen = now(); notify(r); });
    return;
  }

  const p = auth(r, b);
  if (!p) return send(res, 403, { error: '먼저 방에 들어가 주세요.' });
  p.lastSeen = now();

  if (P === 'leave') {
    if (r.status === 'playing' && p.alive) { p.alive = false; p.outAt = now(); feed(r, `🚪 ${p.name} 나갔어요.`); checkEnd(r); }
    if (r.status !== 'playing') {
      delete r.players[p.pid]; r.order = r.order.filter(id => id !== p.pid);
      if (r.host === p.pid) r.host = r.order[0] || null;
      if (!r.order.length) rooms.delete(r.code);
    }
    notify(r); return send(res, 200, { ok: true });
  }
  if (P === 'start') {
    if (r.host !== p.pid) return send(res, 403, { error: '방을 만든 친구가 시작해요.' });
    if (r.status === 'playing' || r.status === 'countdown') return send(res, 400, { error: '이미 시작했어요.' });
    const online = list(r).filter(x => x.conns > 0);
    if (online.length < 2) return send(res, 400, { error: '친구가 한 명 이상 들어와야 시작할 수 있어요.' });
    /* 접속이 끊긴 친구는 빼고 시작 */
    for (const x of list(r)) if (x.conns === 0) { delete r.players[x.pid]; r.order = r.order.filter(id => id !== x.pid); }
    if (b.stage != null && Number(b.stage) >= 0 && Number(b.stage) <= 5) r.stage = Number(b.stage);
    resetPlayers(r); r.round++;
    r.status = 'countdown'; r.startAt = now() + COUNTDOWN * 1000; r.endAt = r.startAt + TIME_LIMIT * 1000;
    r.winner = null; r.ranking = []; r.feed = [];
    notify(r); return send(res, 200, { ok: true });
  }
  if (P === 'stage') {
    if (r.host !== p.pid || r.status === 'playing' || r.status === 'countdown') return send(res, 400, { error: '지금은 바꿀 수 없어요.' });
    const st = Number(b.stage); if (st >= 0 && st <= 5) r.stage = st;
    notify(r); return send(res, 200, { ok: true });
  }
  if (P === 'answer') {
    if (r.status !== 'playing' || !p.alive) return send(res, 200, { ok: true });
    if (!b.good) { p.wrong++; notify(r); return send(res, 200, { ok: true }); }
    p.correct++;
    /* 정답 = 살아 있는 상대 한 명에게 좀비 보내기 (상대가 여럿이면 좀비를 가장 적게 받은 친구에게) */
    const foes = list(r).filter(x => x.alive && x.pid !== p.pid);
    if (!foes.length) { notify(r); return send(res, 200, { ok: true }); }
    const minGot = Math.min(...foes.map(x => x.got));
    const pool = foes.filter(x => x.got === minGot);
    const t = pool[Math.floor(Math.random() * pool.length)];
    const streak = Math.max(0, Number(b.streak) || 0);
    const kind = streak > 0 && streak % 3 === 0 ? 'bucket' : 'zombie';   // 3문제 연속 정답이면 양동이 좀비
    p.sent++; t.got++;
    sendTo(r, t.pid, 'attack', { from: p.name, kind });
    if (kind === 'bucket') feed(r, `🪣 ${p.name} → ${t.name} 양동이 좀비!`);
    notify(r);
    return send(res, 200, { ok: true, to: t.name, kind });
  }
  if (P === 'status') {
    if (r.status !== 'playing' || !p.alive) return send(res, 200, { ok: true });
    const lives = Math.max(0, Math.min(LIVES, Number(b.lives) | 0));
    p.lives = lives; p.score = Math.max(0, Number(b.score) | 0);
    if (lives <= 0) { p.alive = false; p.outAt = now(); feed(r, `💥 ${p.name}의 정원이 무너졌어요!`); checkEnd(r); }
    notify(r); return send(res, 200, { ok: true });
  }
  if (P === 'again') {
    if (r.status !== 'over') return send(res, 400, { error: '대결이 끝난 뒤에 할 수 있어요.' });
    r.status = 'lobby'; r.winner = null; r.ranking = []; r.feed = [];
    if (!r.players[r.host]) r.host = r.order[0];
    resetPlayers(r); notify(r); return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: '알 수 없는 요청이에요.' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    try { await api(req, res, url); } catch (e) { if (!res.headersSent) send(res, 400, { error: e.message }); }
    return;
  }
  if (url.pathname === '/health') { res.end('ok'); return; }
  /* 주소 끝에 / 가 붙거나 .html 을 붙여도 열리게 */
  let pn = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  if (pn === '/' || pn === '/index' || pn === '/index.html') pn = '/index.html';
  else if (pn.toLowerCase() === '/teacher' || pn.toLowerCase() === '/teacher.html') pn = '/teacher.html';
  /* public 폴더에 없으면 server.js 옆(맨 바깥)에서도 찾아요 — GitHub에 폴더 없이 올렸을 때 대비 */
  let file = null;
  for (const dir of [PUB, __dirname]) {
    const f = path.normalize(path.join(dir, pn));
    if (!f.startsWith(dir + path.sep)) continue;
    if (dir === __dirname && !/\.(html|png|jpg|ico|css)$/i.test(f)) continue;   // server.js 같은 파일은 보여 주지 않아요
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { file = f; break; }
  }
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<meta charset="utf-8"><body style="font-family:sans-serif;padding:24px;line-height:1.7"><h2>페이지를 찾을 수 없어요</h2>
<p>찾은 주소: <code>${pn.replace(/[<>&]/g, '')}</code></p>
<p>GitHub 저장소에 <b>public/index.html</b>, <b>public/teacher.html</b>이 있는지 확인해 주세요.</p>
<p>지금 서버에 있는 파일: <code>${[...(fs.existsSync(PUB) ? fs.readdirSync(PUB).map(x => 'public/' + x) : ['(public 폴더 없음)']), ...fs.readdirSync(__dirname).filter(x => !x.startsWith('.') && x !== 'node_modules' && x !== 'public')].join(', ').replace(/[<>&]/g, '')}</code></p>
<p>학생 주소: <a href="/">/</a> · 교사 주소: <a href="/teacher">/teacher</a></p></body>`);
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`정원 대결 서버: http://localhost:${PORT}  (교사: /teacher)`));
