# 홈 화면 UI 버전

## 파일 구조

| 파일 | 설명 |
|------|------|
| `static/js/home-dashboard.legacy.js` | v1 원본 홈 (히어로 카드 + 4칸 그리드) |
| `static/js/home-dashboard.v2.js` | v2 새 홈 (성장 리포트 + 이슈 + AI 코칭) |
| `static/js/app.js` | `loadDashboard()` 라우터 |

## 버전 전환

**레거시(v1)로 복구**

브라우저 개발자 도구 콘솔에서:

```javascript
localStorage.setItem('home_ui', 'v1');
location.reload();
```

**새 홈(v2)으로 복귀 (기본값)**

```javascript
localStorage.setItem('home_ui', 'v2');
location.reload();
```

또는 `localStorage.removeItem('home_ui')` 후 새로고침 (기본 v2).

## API

`/api/dashboard` 응답에 v2 필드가 추가됩니다. v1은 기존 필드만 사용하므로 호환됩니다.

- `greeting` — 인사 문구
- `today_live` — 오늘 수유·수면·기저귀 + 마지막 기록 경과
- `growth_report` — WHO 백분위·스파크라인
- `issues` — 주요 이슈 (최대 3개)
- `coaching` — AI 코칭 메시지
- `milestones_preview` — 최근 스탬프 3개
