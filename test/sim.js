// 모둠 1개를 봇 학생들로 끝까지 플레이해 보는 점검 도구 (실제 시간)
// 사용: node test/sim.js 포트 학생수 정답률   예) node test/sim.js 3000 5 0.75
const [PORT = 3000, N = 5, ACC = 0.75, RANDOM = 0] = process.argv.slice(2).map(Number);   // RANDOM=1: 아무 데나 세우는 학생처럼
const BANK = require('../questions.js');
const ans = Object.fromEntries(BANK.map(q => [q.q, q.opts[0]]));
const B = `http://localhost:${PORT}/api/`;
const post = (p, d) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json());
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const c = await post('class/create', { name: 'sim', teams: 1 });
  const kids = [];
  for (let i = 0; i < N; i++) kids.push(await post('join', { code: c.code, team: 1, name: 'bot' + i }));
  const room = kids[0].room;
  await sleep(20000);   // 시작 전 20초 동안 문제 풀기
  let done = false, st, started = 0;
  kids.forEach(async (k, i) => {
    await sleep(i * 1100);
    while (!done) {
      const q = await post('question', { room, pid: k.pid, key: k.key });
      await sleep(4000 + Math.random() * 5000);
      const right = q.opts.indexOf(ans[q.q]);
      const choice = Math.random() < ACC ? right : (right + 1) % 4;
      const r = await post('answer', { room, pid: k.pid, key: k.key, choice });
      if (r.lockLeft) await sleep(r.lockLeft + 100);
    }
  });
  const plan = [['sun', 0, 1], ['sun', 2, 1], ['pea', 2, 2], ['sun', 4, 1], ['pea', 0, 2], ['pea', 4, 2], ['sun', 1, 1], ['sun', 3, 1], ['pea', 1, 2], ['pea', 3, 2],
    ['ice', 2, 3], ['cactus', 0, 3], ['cactus', 4, 3], ['wall', 2, 6], ['fire', 1, 3], ['fire', 3, 3], ['wall', 0, 6], ['wall', 4, 6], ['cactus', 2, 4], ['wall', 1, 6], ['wall', 3, 6],
    ['ice', 0, 4], ['ice', 4, 4], ['fire', 2, 5], ['cactus', 1, 4], ['cactus', 3, 4], ['pea', 0, 5], ['pea', 4, 5], ['pea', 1, 5], ['pea', 3, 5]];
  const cost = { sun: 50, pea: 100, wall: 50, cactus: 125, ice: 150, fire: 175 };
  while (true) {
    st = await fetch(B + 'class/dash?code=' + c.code + '&token=' + c.token).then(r => r.json());
    const t = st.teams[0];
    if (t.status === 'waiting' && !started) { await post('class/control', { code: c.code, token: c.token, action: 'start' }); started = Date.now(); continue; }
    if (t.status === 'ended') break;
    if (RANDOM) { const ks = Object.keys(cost).filter(k => cost[k] <= t.tickets); if (ks.length && Math.random() < 0.6) await post('place', { room, pid: kids[0].pid, key: kids[0].key, row: Math.floor(Math.random() * 5), col: 1 + Math.floor(Math.random() * 7), kind: ks[Math.floor(Math.random() * ks.length)] }); }
    else for (const [k, r, col] of plan) { if (t.tickets >= cost[k]) { const res = await post('place', { room, pid: kids[0].pid, key: kids[0].key, row: r, col, kind: k }); if (res.ok) break; } }
    await sleep(1500);
  }
  done = true;
  const t = st.teams[0];
  const q = t.players.reduce((a, p) => a + p.correct + p.wrong, 0), ok = t.players.reduce((a, p) => a + p.correct, 0);
  console.log(JSON.stringify({ N, ACC, RANDOM, result: t.result, wave: t.wave, lives: t.lives, killed: t.defeated, minutes: ((Date.now() - started) / 60000).toFixed(1), answers: q, acc: Math.round(ok / q * 100) }));
  process.exit(0);
})();
