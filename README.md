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

## Render로 배포 (GitHub 연동)

1. [Render](https://render.com) 가입 → **New** → **Blueprint**
2. 방금 푸시한 **GitHub 저장소** 연결
3. `render.yaml` 인식 후 **Apply** → 배포 완료까지 5~10분
4. 생성된 URL 예: `https://ai-rang-fit.onrender.com` → 지인에게 전달

### 무료 플랜 참고

- 15분 미사용 시 슬립 → 첫 접속 30초~1분 지연 가능 (지인 테스트 시 미리 한 번 열어두기)
- DB·업로드는 재배포 시 초기화될 수 있음 → 데모 계정으로 테스트 권장

### 환경 변수 (선택)

Render 대시보드 → Service → Environment:

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
render.yaml         # Render 배포 설정
```
