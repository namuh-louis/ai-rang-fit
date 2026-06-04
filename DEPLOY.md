# 배포 가이드 (GitHub → Render)

## 1단계: GitHub에 푸시

로컬에서 이미 `git init` + 첫 커밋이 되어 있습니다.

### A. GitHub 웹에서 저장소 만들기

1. https://github.com/new 접속
2. Repository name: `ai-rang-fit`
3. **Public** 선택 (Render 무료 연동에 유리)
4. README / .gitignore 추가 **하지 않음** (이미 있음)
5. **Create repository**

### B. 터미널에서 푸시

`<YOUR_USER>`를 본인 GitHub 아이디로 바꿉니다.

```bash
cd /Users/louis84/AI/Curosr/Ai-rang-fit
git remote add origin https://github.com/<YOUR_USER>/ai-rang-fit.git
git push -u origin main
```

### (선택) GitHub CLI

```bash
brew install gh
gh auth login
chmod +x scripts/push-github.sh
./scripts/push-github.sh
```

---

## 2단계: Render에 배포

1. https://dashboard.render.com 로그인 (GitHub 계정 연동)
2. **New +** → **Blueprint**
3. 방금 만든 `ai-rang-fit` 저장소 선택 → **Connect**
4. `render.yaml`이 보이면 **Apply**
5. 배포 로그에서 `Build successful` / `Live` 확인 (약 5~10분)
6. 상단 URL 복사 예: `https://ai-rang-fit-xxxx.onrender.com`

### 지인에게 보낼 메시지 예시

```
아이랑 핏 테스트 부탁해요 (5~10분)
URL: https://xxxx.onrender.com
로그인: 010-0000-0000 / 1234
(첫 접속은 30초 정도 걸릴 수 있어요 — 무료 서버 슬립)
의견: [구글폼 링크]
```

---

## 3단계: 이후 자동 배포

`main` 브랜치에 `git push` 할 때마다 Render가 자동으로 다시 배포합니다.

```bash
git add .
git commit -m "설명"
git push
```

---

## 문제 해결

| 증상 | 조치 |
|------|------|
| Render 빌드 실패 | Dashboard → Logs에서 `pip install` 오류 확인 |
| 첫 접속 매우 느림 | 무료 플랜 슬립 — 테스트 전에 URL 한 번 열기 |
| 금융 가이드 안 보임 | 강력 새로고침 / 시크릿 모드 (서비스워커 캐시) |
| 401 로그인 | 데모 번호 `010-0000-0000` / `1234` 확인 |

---

## 환경 변수 (Render Dashboard)

| Key | 필수 | 설명 |
|-----|------|------|
| `OPENAI_API_KEY` | 아니오 | 출산택일·작명 LLM |
