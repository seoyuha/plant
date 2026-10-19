/* 6학년 영어 9단원 How Can I Get to the Museum? — 복습 문제
   지도서의 핵심 표현·단어·위치 표현·읽기 지문(Sally's Travel, Job Land, Star Library)·문법 유의점 기반
   { q:문제, ko:도움말(선택), opts:[정답, 오답, 오답, 오답], cat:분류 }  ← 정답은 항상 첫 번째로 적고, 서버가 섞어서 냅니다 */
const Q = [];
const add = (cat, q, opts, ko) => Q.push({ cat, q, ko: ko || '', opts });

/* 1. 단어 뜻 */
const WORDS = [
  ['bus', '버스'], ['subway', '지하철'], ['taxi', '택시'], ['train', '기차'], ['museum', '박물관'], ['library', '도서관'],
  ['zoo', '동물원'], ['park', '공원'], ['bank', '은행'], ['hospital', '병원'], ['market', '시장'], ['restaurant', '식당'],
  ['toy store', '장난감 가게'], ['flower shop', '꽃집'], ['behind', '~ 뒤에'], ['between', '~ 사이에'], ['in front of', '~ 앞에'],
  ['next to', '~ 옆에'], ['get off', '(차에서) 내리다'], ['travel', '여행하다'], ['cheap', '(값이) 싼'], ['palace', '궁전'],
  ['land', '땅, 육지'], ['top', '꼭대기, 맨 위'], ['together', '함께'],
];
const pick3 = (arr, not) => { const c = arr.filter(x => x !== not); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c.slice(0, 3); };
const meanings = WORDS.map(w => w[1]), engs = WORDS.map(w => w[0]);
WORDS.forEach(([en, ko]) => add('단어', `"${en}"의 뜻은?`, [ko, ...pick3(meanings, ko)]));
WORDS.filter((_, i) => i % 2 === 0).forEach(([en, ko]) => add('단어', `"${ko}"을(를) 영어로 하면?`, [en, ...pick3(engs, en)]));

/* 2. 그림 보고 교통수단 문장 고르기 */
const PL = { zoo: ['🦁', '동물원'], museum: ['🏛️', '박물관'], library: ['📚', '도서관'], park: ['🌳', '공원'], bank: ['🏦', '은행'], hospital: ['🏥', '병원'], market: ['🧺', '시장'], 'toy store': ['🧸', '장난감 가게'] };
[['🚌 3번 버스', 'Bus Number 3', 'museum'], ['🚇 지하철 4호선', 'Subway Line 4', 'zoo'], ['🚌 5번 버스', 'Bus Number 5', 'park'],
 ['🚇 지하철 2호선', 'Subway Line 2', 'library'], ['🚌 8번 버스', 'Bus Number 8', 'hospital'], ['🚇 지하철 1호선', 'Subway Line 1', 'bank'],
 ['🚌 10번 버스', 'Bus Number 10', 'market'], ['🚌 2번 버스', 'Bus Number 2', 'toy store']].forEach(([lab, en, p]) => {
  const other = Object.keys(PL).find(x => x !== p && x.length !== p.length) || 'park';
  const wrongNum = en.replace(/\d+/, n => String(Number(n) + 1));
  add('그림 보고 말하기', `${lab} ➜ ${PL[p][0]} ${PL[p][1]}에서 내리기`, [
    `Take ${en} and get off at the ${p}.`,
    `Take ${wrongNum} and get off at the ${p}.`,
    `Take ${en} and get off at the ${other}.`,
    `Take ${en} and get on at the ${p}.`,
  ], '그림에 맞게 길을 알려 주는 문장을 골라요.');
});
add('그림 보고 말하기', '🚕 택시 ➜ 🧸 장난감 가게에서 내리기', ['Take a taxi and get off at the toy store.', 'Take taxi number and get off at the toy store.', 'Take a taxi and get on at the toy store.', 'Take the subway and get off at the toy store.'], '택시는 a taxi라고 해요.');
add('그림 보고 말하기', '🚆 기차 ➜ 🏛️ 박물관에서 내리기', ['Take the train and get off at the museum.', 'Take a Bus Number and get off at the museum.', 'Take the train and get off at the zoo.', 'Take the train and get up at the museum.']);

/* 3. 길 묻기 */
Object.entries(PL).forEach(([p, [e, ko]]) => add('길 묻기', `${e} ${ko}에 가는 방법을 물어볼 때 알맞은 말은?`, [
  `How can I get to the ${p}?`, `What can I get to the ${p}?`, `How can I get off the ${p}?`, `Where is the ${p} number?`]));

/* 4. 위치 표현 (그림) */
const POS = [
  ['🏦 ⭐ 🏫', '⭐는 은행(bank)과 학교(school) 사이에 있어요.', "It's between the bank and the school."],
  ['⭐ 🏥', '⭐는 병원(hospital) 옆에 있어요.', "It's next to the hospital."],
  ['🏛️ 아래에 ⭐', '⭐는 박물관(museum) 앞에 있어요.', "It's in front of the museum."],
  ['📚 건물 뒤로 ⭐가 보여요', '⭐는 도서관(library) 뒤에 있어요.', "It's behind the library."],
  ['🌳 ⭐ 🦁', '⭐는 공원(park)과 동물원(zoo) 사이에 있어요.', "It's between the park and the zoo."],
  ['⭐ 🧸', '⭐는 장난감 가게(toy store) 옆에 있어요.', "It's next to the toy store."],
];
POS.forEach(([pic, ko, ans]) => {
  const all = ["It's between the bank and the school.", "It's next to the hospital.", "It's in front of the museum.", "It's behind the library.", "It's between the park and the zoo.", "It's next to the toy store.", "It's behind the bank.", "It's in front of the zoo."];
  add('위치 표현', `${pic}\n⭐는 어디에 있나요?`, [ans, ...pick3(all.filter(x => x !== ans), null)], ko);
});
[['behind', '~ 뒤에'], ['between', '~ 사이에'], ['in front of', '~ 앞에'], ['next to', '~ 옆에']].forEach(([en, ko]) =>
  add('위치 표현', `"${ko}"라는 뜻의 위치 표현은?`, [en, ...['behind', 'between', 'in front of', 'next to', 'get off'].filter(x => x !== en).slice(0, 3)]));

/* 5. 빈칸 채우기 (핵심 표현·문법) */
[
  ['How can I ___ to the zoo?', 'get', ['go', 'take', 'come'], '~에 어떻게 가나요? = How can I get to ~?'],
  ['___ can I get to the museum?', 'How', ['What', 'Who', 'Where'], '가는 "방법"을 물을 때는 How를 써요.'],
  ['___ Bus Number 5 and get off at the park.', 'Take', ['Get', 'Go', 'Ride'], 'Take ~ = ~을 타세요'],
  ['Take Subway Line 4 and get ___ at the zoo.', 'off', ['on', 'in', 'up'], 'get off = 내리다'],
  ['Take ___ taxi and get off at the toy store.', 'a', ['the', 'an', 'two'], '택시는 a taxi라고 해요.'],
  ['Take ___ 3 and get off at the bank.', 'Bus Number', ['the Bus Number', 'a Bus Number', 'Bus Numbers'], 'Bus Number, Subway Line 앞에는 a나 the를 쓰지 않아요.'],
  ['Take ___ 2 and get off at the library.', 'Subway Line', ['a Subway Line', 'the Subway Line', 'Subway Lines'], 'Subway Line 앞에는 a나 the를 쓰지 않아요.'],
  ["It's between the bank ___ the school.", 'and', ['or', 'to', 'at'], 'between A and B = A와 B 사이에'],
  ["It's in ___ of the museum.", 'front', ['back', 'next', 'top'], 'in front of = ~ 앞에'],
  ["It's next ___ the park.", 'to', ['of', 'at', 'on'], 'next to = ~ 옆에'],
  ['I want to go to Job Land. I ___ learn about many jobs.', 'can', ['am', 'do', 'is'], 'I can ~ = 나는 ~할 수 있어요'],
  ['___ go to Robot Museum together.', "Let's", ['Let', "Lets'", 'Let us to'], "Let's ~ together. = 함께 ~하자."],
  ['You can sit on the ___ floor of the big red bus.', 'top', ['land', 'cheap', 'line'], 'top floor = 꼭대기 층'],
  ['The amphibious bus runs on ___. It runs on water, too.', 'land', ['top', 'line', 'sky'], 'land = 땅, 육지'],
  ['It is ___ and fast. (값이 싸고 빨라요)', 'cheap', ['top', 'land', 'behind'], 'cheap = 값이 싼'],
].forEach(([q, a, w, ko]) => add('빈칸 채우기', q, [a, ...w], ko));

/* 6. 대화 */
add('대화', 'A: Take Bus Number 8 and get off at the bank.\nB: ___ (잘 못 들었을 때)', ['Sorry?', 'Thank you.', 'Hello.', 'Good job.'], '다시 말해 달라고 할 때 Sorry?라고 해요.');
add('대화', 'A: How can I get to the library?\nB: ___', ['Take Subway Line 3 and get off at the library.', "It's sunny today.", "I'd like to have pizza.", 'I like spring.']);
add('대화', 'A: Where is the toy store?\nB: ___', ["It's next to the bank.", 'Take a taxi.', 'I want to go.', 'Yes, I do.']);
add('대화', 'A: Take Subway Line 1 and get off at the park.\nB: Sorry?\nA: ___', ['Take Subway Line 1 and get off at the park.', 'Thank you.', 'Get on the park.', 'No, I can’t.']);
add('대화', 'A: Let’s go to the museum together.\nB: ___', ['Sounds good!', "It's behind.", 'Take the bus.', 'How can I get?']);

/* 7. 읽기 지문 */
add('읽기', 'Sally: How can I get to the night market?\nDriver: Take this taxi and get off at the market. It is a small colorful car. It is cheap and fast.\n\n이 택시는 어떤가요?', ['cheap and fast', 'big and red', 'slow and old', 'on water']);
add('읽기', 'Sally: How can I get to the palace?\nDriver: Take this bus and get off at the palace. It runs on land. It runs on water, too.\n\n이 버스의 특징은?', ['It runs on land and water.', 'It is a big red bus.', 'It is a small colorful car.', 'It is very cheap.']);
add('읽기', 'Sally: How can I get to the park?\nDriver: Take this train and get off at the park. It is small. It is fun. You can see a beautiful sky.\n\n기차를 타면 볼 수 있는 것은?', ['a beautiful sky', 'many robots', 'a big red bus', 'the top floor']);
add('읽기', 'Sally: How can I get to the museum?\nDriver: Take this bus and get off at the museum. It is a big red bus. You can sit on the top floor.\n\n버스에서 앉을 수 있는 곳은?', ['the top floor', 'the water', 'the sky', 'the market']);
add('읽기', 'I want to go to Job Land. Take Bus Number 2 and get off at ABC Library. It’s between the library and the flower shop.\n\nJob Land는 어디에 있나요?', ['between the library and the flower shop', 'behind the library', 'next to the bank', 'in front of the school']);
add('읽기', 'I want to go to Job Land. Take Bus Number 2 and get off at ABC Library.\n\nJob Land에 가려면 무엇을 타나요?', ['Bus Number 2', 'Subway Line 2', 'a taxi', 'the train']);
add('읽기', 'Star Library: You can read books. You can watch movies, too. Take Bus Number 10 and get off at the market. It’s behind the market.\n\nStar Library는 어디에 있나요?', ['behind the market', 'next to the market', 'between the bank and the market', 'in front of the bank']);
add('읽기', 'Star Library: You can read books. You can watch movies, too.\n\nStar Library에서 할 수 있는 것은?', ['read books and watch movies', 'ride a bike and swim', 'see robots', 'eat pizza']);

/* 8. 철자 */
[['subway', '지하철', ['subwey', 'sabway', 'subwy']], ['between', '~ 사이에', ['betwen', 'bitween', 'betweeen']], ['behind', '~ 뒤에', ['behaind', 'bihind', 'behine']],
 ['museum', '박물관', ['musium', 'museom', 'mueseum']], ['library', '도서관', ['libary', 'liberary', 'librery']], ['hospital', '병원', ['hospitel', 'hosipital', 'hospitle']],
 ['restaurant', '식당', ['restorant', 'restaurent', 'resturant']], ['palace', '궁전', ['palase', 'pallace', 'palece']], ['front', '앞 (in ___ of)', ['frunt', 'fornt', 'frontt']]]
  .forEach(([a, ko, w]) => add('철자', `"${ko}"을(를) 바르게 쓴 것은?`, [a, ...w]));

module.exports = Q;
