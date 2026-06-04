# 아이랑 핏 (Ai-rang-fit)

육아 기록 · 추억 · 발달 · 금융 · 쇼핑 가이드를 한곳에서 쓰는 모바일 웹 앱 (FastAPI + PWA).

## 로컬 실행

```bash
cd Ai-rang-fit
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

브라우저: http://127.0.0.1:8000/

**데모 로그인:** `010-0000-0000` / `1234`

## GitHub에 올리기

```bash
git init
git add .
git commit -m "Initial commit: 아이랑 핏 MVP"
gh repo create ai-rang-fit --public --source=. --remote=origin --push
```

`gh`가 없으면 GitHub에서 새 저장소를 만든 뒤:

```bash
git remote add origin https://github.com/<YOUR_USER>/ai-rang-fit.git
git branch -M main
git push -u origin main
```

## Vercel로 배포 (GitHub 연동)

1. GitHub에 `main` 브랜치 푸시 (아래 참고)
2. [Vercel](https://vercel.com) → **Add Project** → GitHub `ai-rang-fit` Import
3. **Deploy** → URL 예: `https://ai-rang-fit.vercel.app`

자세한 단계: [DEPLOY.md](./DEPLOY.md)

### 환경 변수 (선택)

Vercel → Project → Settings → Environment Variables:

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | 출산택일·작명 LLM (없으면 해당 기능만 제한) |

## 지인 모바일 테스트

1. Render URL + 데모 계정 안내 (카톡)
2. 시크릿 모드 또는 강력 새로고침 권장 (PWA 캐시)
3. 피드백은 구글 폼 등으로 수집 후 P0/P1 수정 → 2차 테스트

## 프로젝트 구조

```
app.py              # FastAPI 메인
data/               # JSON 가이드, SQLite(로컬)
templates/          # index.html
static/js/          # app.js, finance-guide.js, …
vercel.json         # Vercel 배포 설정
api/index.py        # Vercel serverless 진입점
```
