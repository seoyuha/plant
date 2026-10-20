# 🧭 정원으로 가는 길을 막아라! — 6학년 영어 9단원 복습 게임

**How Can I Get to the Museum?** 단원 복습용 식물 디펜스 게임이에요.
「과학 정원 지키기」의 화면·그림·규칙을 그대로 쓰고, 문제와 문구만 영어 9단원으로 바꿨어요.
`index.html` 하나에 그림과 문제가 모두 들어 있어서, 파일을 더블클릭해도 바로 열려요.

## 5단계 60문제 (9단원 지도서 내용 바탕)
| 단계 | 내용 | 예 |
|---|---|---|
| 1단계 · 교통수단과 장소 단어 | bus, subway, taxi, train, museum, library, zoo, get off … | "subway"의 뜻은? |
| 2단계 · 길 묻고 답하기 | How can I get to ~? / Take ~ and get off at ~. | 🚌 3번 버스 ➜ 🏛️ 박물관에서 내리기 |
| 3단계 · 위치 말하기 | behind, between, in front of, next to | 🏦 ⭐ 🏫 → It's between the bank and the school. |
| 4단계 · 대화와 문법 | Sorry?, Bus Number·Subway Line 앞 a/the 쓰지 않기, Let's ~ together. | Take ___ 3 → Bus Number |
| 5단계 · 읽기와 쓰기 | Sally's Travel, Job Land, Star Library 지문, 철자 | 기차를 타면 볼 수 있는 것은? |

- 단계마다 12문제씩, 보기 순서는 매번 섞여요.
- 문제 창의 **🔊 듣기**를 누르면 문제 속 영어를 읽어 줘요. 답을 고르면 정답 영어 문장을 읽어 줘요(효과음이 켜져 있을 때).
- 정답 ☀️ +50, 틀려도 해설을 읽으면 ☀️ +15 (원래 게임 규칙 그대로).
- 문제를 고치려면 `index.html`에서 `QUESTION_DATA`를 찾아 고치면 돼요. (`questions.json`은 같은 문제를 보기 좋게 정리한 보관용이에요.)

## 원래 게임에서 바꾼 것
- 제목·안내 문구·단계 이름·문제를 영어 9단원으로
- 문제 창 그림 5장을 9단원 내용(탈것, 길 묻기, 위치, 대화, 읽기 자료)으로 새로 그림
- 시작 화면 그림을 영어 퀴즈 그림으로 (과학 시작 그림은 빼서 파일 크기 그대로 유지)
- 문제 창에 🔊 듣기 버튼, 대화·지문이 줄바꿈되어 보이게
- 최고 기록 저장 이름을 바꿔 과학 게임 기록과 섞이지 않게
- 식물·좀비 그림, 배경, 게임 규칙, 화면 배치는 그대로

## 학생들에게 배포하는 방법

### 방법 1. GitHub Pages (추천, 무료)
1. github.com → **New repository** → 이름 예: `english-garden-9` → **Public** → Create
2. **uploading an existing file** → `index.html`, `.nojekyll` 를 끌어다 놓고 **Commit changes**
3. 저장소의 **Settings → Pages** → Branch를 `main` / `(root)`로 고르고 **Save**
4. 1~2분 뒤 `https://내아이디.github.io/english-garden-9/` 주소가 생겨요. 이 주소를 학생들에게 알려 주세요.

### 방법 2. Netlify Drop (가장 빠름)
1. app.netlify.com/drop 에 접속해 압축을 푼 **폴더를 통째로 끌어다 놓기**
2. 바로 주소가 생겨요. (로그인하면 주소 이름을 바꾸고 계속 쓸 수 있어요.)

### 방법 3. 파일로 나눠 주기
`index.html` 파일을 학급 게시판·패들렛 등에 올리면 학생 기기에서 내려받아 열 수 있어요. (약 3MB)

## ⚔️ 친구와 대결
첫 화면의 **⚔️ 친구와 대결** 버튼은 서버 버전(garden-battle-9.zip)을 Render에 올린 주소에서만 돼요.
이 파일만 GitHub Pages·Netlify에 올리거나 더블클릭해서 열면 "서버 주소에서 열어 주세요" 안내가 나와요. 혼자 모험은 어디서나 돼요.

## 수업에서
- 혼자 하는 게임이라 서버가 필요 없어요. 태블릿은 **가로로** 쓰면 정원이 크게 보여요.
- 키보드: 1~7 식물 고르기 · Q 문제 풀기 · P 멈춤
- 기록(최고 점수)은 각 기기에만 저장돼요.
