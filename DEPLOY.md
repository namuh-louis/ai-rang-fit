# 배포 가이드 (GitHub → Vercel)

## 1단계: GitHub에 푸시

```bash
cd /Users/louis84/AI/Curosr/Ai-rang-fit
```

### 저장소가 없을 때

1. https://github.com/new → 이름 `ai-rang-fit`, Public, README 추가 안 함
2. 터미널:

```bash
git remote add origin https://github.com/<YOUR_USER>/ai-rang-fit.git
git push -u origin main
```

### GitHub CLI (선택)

```bash
brew install gh
gh auth login
./scripts/push-github.sh
```

---

## 2단계: Vercel 배포

### A. 대시보드 (추천)

1. https://vercel.com 로그인 → **Add New** → **Project**
2. **Import** Git Repository → `ai-rang-fit` 선택
3. Framework Preset: **Other** (자동 감지되면 그대로)
4. Root Directory: `.` (기본값)
5. **Deploy** → 완료 후 URL 확인 (예: `https://ai-rang-fit.vercel.app`)

### B. CLI

```bash
npm i -g vercel   # 또는: npx vercel
cd /Users/louis84/AI/Curosr/Ai-rang-fit
vercel login
vercel link      # 프로젝트 연결
vercel --prod    # 프로덕션 배포
```

이후 `git push` 시 Vercel이 자동 재배포합니다 (Git 연동 시).

---

## 3단계: 지인 테스트 URL

- Vercel 프로덕션 URL 복사
- 로그인: `010-0000-0000` / `1234`
- 첫 로딩이 느리면 **시크릿 모드** 또는 강력 새로고침

---

## Vercel 참고

| 항목 | 설명 |
|------|------|
| DB | 서버리스 `/tmp` SQLite — 재배포·콜드스타트 시 초기화될 수 있음 |
| 데모 | `init_demo_data()`로 빈 DB 시 데모 계정 자동 생성 |
| 환경변수 | Vercel → Settings → Environment Variables → `OPENAI_API_KEY` (택일·작명) |

---

## 문제 해결

| 증상 | 조치 |
|------|------|
| 404 on API | `vercel.json` rewrites 확인, 재배포 |
| 빌드 실패 | Vercel Logs에서 `pip install` 오류 확인 |
| 금융 가이드 안 보임 | 로그인 후 금융 탭, 캐시 삭제 |
