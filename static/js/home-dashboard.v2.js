/**
 * 아이랑 핏 — 홈 대시보드 v2
 * 기본 홈 UI. 레거시로 복구: localStorage.setItem('home_ui','v1'); location.reload();
 */

function homeFormatElapsed(minutes) {
    if (minutes === null || minutes === undefined) return '--';
    if (minutes < 60) return minutes + '분 전';
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return m > 0 ? h + '시간 ' + m + '분 전' : h + '시간 전';
}

function homePctPercent(pct) {
    if (pct == null || pct === undefined) return null;
    return Math.round(pct);
}

/** 출생 대비 성장 — 자연스러운 한글 표현 (15cm · 30% 성장 / 1.5배 등) */
function homeGrowthCompareText(birthVal, currentVal, unit) {
    if (birthVal == null || currentVal == null || birthVal <= 0) return '';
    const delta = currentVal - birthVal;
    if (delta < 0.05) return '거의 변화 없음';
    const pctGrowth = Math.round((delta / birthVal) * 100);
    const ratio = currentVal / birthVal;
    let absStr;
    if (unit === 'cm') {
        absStr = (delta >= 10 ? Math.round(delta) : Math.round(delta * 10) / 10) + 'cm';
    } else {
        absStr = (Math.round(delta * 10) / 10) + 'kg';
    }
    const ratioRounded = Math.round(ratio * 10) / 10;
    const ratioClean = ratioRounded % 1 === 0 ? String(ratioRounded.toFixed(0)) : ratioRounded.toFixed(1);
    if (ratio >= 1.2 && ratio < 3 && Math.abs(ratio - ratioRounded) < 0.06) {
        return absStr + ' · ' + ratioClean + '배';
    }
    if (pctGrowth >= 100) {
        return absStr + ' · ' + ratioClean + '배';
    }
    return absStr + ' · ' + pctGrowth + '% 성장';
}

function homeModernTrendChart(values, opts) {
    opts = opts || {};
    const color = opts.color || '#6366F1';
    const gradId = opts.gradId || 'hg' + Math.random().toString(36).slice(2, 8);
    const w = opts.w || 168;
    const h = opts.h || 80;
    const unit = opts.unit || '';
    const birthVal = values && values.length ? values[0] : null;
    const currentVal = opts.currentValue != null ? opts.currentValue : (values && values.length ? values[values.length - 1] : null);
    if (!values || values.length < 2) {
        return '<div class="home-chart-empty"><span>기록 추가 시 추이 표시</span></div>';
    }
    const max = Math.max.apply(null, values);
    const min = Math.min.apply(null, values);
    const range = max - min || 1;
    const padX = 14;
    const padY = 8;
    const innerW = w - padX * 2;
    const innerH = h - padY * 2;
    const coords = values.map(function (v, i) {
        return {
            x: padX + (i / (values.length - 1)) * innerW,
            y: padY + (1 - (v - min) / range) * innerH,
            v: v,
        };
    });
    const linePts = coords.map(function (c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' ');
    const areaPts = coords.map(function (c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' ');
    const baseY = (h - 10).toFixed(1);
    const first = coords[0];
    const last = coords[coords.length - 1];
    const gridY1 = (padY + innerH * 0.33).toFixed(1);
    const gridY2 = (padY + innerH * 0.66).toFixed(1);
    const fmt = function (v) { return v != null ? v + unit : '--'; };
    const compareText = homeGrowthCompareText(birthVal, currentVal, unit);
    const svg = '<svg class="home-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
        '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.4"/>' +
        '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.04"/></linearGradient></defs>' +
        '<line x1="' + padX + '" y1="' + gridY1 + '" x2="' + (w - padX) + '" y2="' + gridY1 + '" class="home-chart-grid"/>' +
        '<line x1="' + padX + '" y1="' + gridY2 + '" x2="' + (w - padX) + '" y2="' + gridY2 + '" class="home-chart-grid"/>' +
        '<polygon points="' + first.x.toFixed(1) + ',' + baseY + ' ' + areaPts + ' ' + last.x.toFixed(1) + ',' + baseY + '" fill="url(#' + gradId + ')"/>' +
        '<polyline points="' + linePts + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="' + first.x.toFixed(1) + '" cy="' + first.y.toFixed(1) + '" r="4" fill="#fff" stroke="' + color + '" stroke-width="2"/>' +
        '<circle cx="' + last.x.toFixed(1) + '" cy="' + last.y.toFixed(1) + '" r="5" fill="' + color + '" stroke="#fff" stroke-width="2.5"/>' +
        '</svg>';
    const compareOverlay = compareText
        ? '<div class="home-chart-center-badge">' + compareText + '</div>'
        : '';
    return '<div class="home-chart-stack" style="--chart-color:' + color + '">' +
        '<div class="home-chart-meta home-chart-meta-top">' +
        '<span class="home-chart-meta-end"><span class="home-chart-meta-tag">현재</span><strong>' + fmt(currentVal) + '</strong></span></div>' +
        '<div class="home-chart-svg-wrap">' + svg + compareOverlay + '</div>' +
        '<div class="home-chart-meta home-chart-meta-bottom">' +
        '<span class="home-chart-meta-start"><span class="home-chart-meta-tag">출생</span><strong>' + fmt(birthVal) + '</strong></span>' +
        '</div></div>';
}

function homeGrowthPanel(type, gr) {
    const isHeight = type === 'height';
    const values = isHeight ? gr.spark_height : gr.spark_weight;
    const color = isHeight ? '#6366F1' : '#FF6B9D';
    const gradId = 'homeGrad' + type;
    const val = isHeight ? gr.height_cm : gr.weight_kg;
    const pct = isHeight ? gr.height_pct : gr.weight_pct;
    const unit = isHeight ? 'cm' : 'kg';
    const status = isHeight ? gr.height_status : gr.weight_status;
    const label = isHeight ? '오늘의 키' : '오늘의 몸무게';
    const pctNum = homePctPercent(pct);
    const chart = homeModernTrendChart(values, {
        color: color,
        gradId: gradId,
        unit: unit,
        currentValue: val,
    });
    const metricLine = val != null
        ? '<div class="home-metric-row">' +
          '<span class="home-metric-value">' + val + '<small>' + unit + '</small></span>' +
          (pctNum != null ? '<span class="home-metric-peer">또래 <strong>' + pctNum + '%</strong></span>' : '') +
          homeStatusInline(status) +
          '</div>'
        : '<div class="home-metric-row"><span class="home-metric-value home-metric-muted">--</span></div>';
    return '<div class="home-growth-panel home-growth-panel-' + type + '">' +
        '<div class="home-panel-header"><span class="home-panel-label">' + label + '</span></div>' +
        '<div class="home-chart-wrap">' + chart + '</div>' +
        metricLine + '</div>';
}

function homeStatusShort(status) {
    if (status === 'good') return '표준';
    if (status === 'caution') return '주의';
    if (status === 'warning') return '상담';
    if (status === 'unknown') return '';
    return '';
}

function homeStatusInline(status) {
    const text = homeStatusShort(status);
    if (!text) return '';
    return '<span class="home-status-inline home-status-inline-' + status + '">' + text + '</span>';
}

function homeStatusBadge(status) {
    if (status === 'good') return '<span class="home-status home-status-good">표준</span>';
    if (status === 'caution') return '<span class="home-status home-status-caution">주의</span>';
    if (status === 'warning') return '<span class="home-status home-status-warning">상담</span>';
    return '<span class="home-status home-status-muted">—</span>';
}

function homeIssueIconKey(iss) {
    const map = {
        '💉': 'vaccine', '🍼': 'feeding', '😴': 'sleep', '⚠️': 'warning',
        '💛': 'warning', '✅': 'check', '📏': 'growth'
    };
    return map[iss.icon] || 'warning';
}

function homeRenderIssueChip(iss) {
    return '<button type="button" class="home-issue-chip home-issue-' + iss.level + '" onclick="navigateTo(\'' + iss.page + '\')">' +
        '<span data-icon="' + homeIssueIconKey(iss) + '" data-icon-size="26"></span><span>' + iss.text + '</span></button>';
}

function homeRenderIssues(issues) {
    if (!issues || !issues.length) {
        return '<div class="home-issues home-issues-clear">' +
            '<span class="home-issues-icon" data-icon="check" data-icon-size="28"></span>' +
            '<span>오늘 확인할 긴급 이슈가 없어요</span></div>';
    }
    const chips = issues.map(homeRenderIssueChip).join('');
    return '<div class="home-issues-marquee" aria-label="오늘 확인할 이슈">' +
        '<div class="home-issues-track">' +
        '<div class="home-issues-track-inner">' + chips + '</div>' +
        '<div class="home-issues-track-inner" aria-hidden="true">' + chips + '</div>' +
        '</div></div>';
}

/** 이슈 바 — 오른쪽→왼쪽 흐름 (개수에 따라 속도 조절) */
function initHomeIssuesMarquee(root) {
    root = root || document;
    root.querySelectorAll('.home-issues-marquee').forEach(function (wrap) {
        const track = wrap.querySelector('.home-issues-track');
        const inner = wrap.querySelector('.home-issues-track-inner');
        if (!track || !inner) return;
        const width = inner.scrollWidth;
        const count = inner.querySelectorAll('.home-issue-chip').length;
        const sec = Math.max(14, Math.min(36, width / 28 + count * 4));
        track.style.setProperty('--marquee-duration', sec + 's');
    });
}

function formatHeaderAgeLabel(age) {
    if (age.years > 0) {
        return age.years + '세 ' + age.months + '개월';
    }
    if (age.total_months > 0) {
        return age.total_months + '개월';
    }
    return age.total_days + '일';
}

/** 상단 고정 헤더 — 아기 사진·이름·일수·개월 */
function updateAppHeaderBaby(baby, age) {
    if (typeof updateAppHeaderBabyIcon === 'function') {
        updateAppHeaderBabyIcon(baby);
    }
    const titleEl = document.getElementById('header-title');
    const daysEl = document.getElementById('header-days');
    const ageEl = document.getElementById('header-age');
    if (titleEl) titleEl.textContent = baby.name;
    if (daysEl) daysEl.textContent = '태어난 지 ' + age.total_days + '일';
    if (ageEl) ageEl.textContent = formatHeaderAgeLabel(age);
}

function homeRenderMilestones(items) {
    const icons = { motor: 'motor', language: 'language', social: 'social', cognitive: 'cognitive' };
    if (!items || !items.length) {
        return '<p class="home-milestone-empty">아직 성장 스탬프가 없습니다</p>';
    }
    return items.map(function (m) {
        return '<div class="home-milestone-row">' +
            '<span class="home-milestone-icon" data-icon="' + (icons[m.category] || 'milestone') + '" data-icon-size="28"></span>' +
            '<div class="home-milestone-text"><div>' + m.description + '</div>' +
            '<div class="home-milestone-meta">' + (m.achieved_date || '').slice(0, 10) + '</div></div>' +
            '<span data-icon="check" data-icon-size="22"></span></div>';
    }).join('');
}

async function loadDashboardV2() {
    const main = document.getElementById('main-content');
    try {
        const babyId = currentBabyId || await getDefaultBabyId();
        const res = await fetch(API + '/api/dashboard?baby_id=' + babyId, { headers: authHeaders() });
        if (!res.ok) throw new Error('API 오류 ' + res.status);
        const data = await res.json();
        if (!data.baby) {
            main.innerHTML = '<div style="text-align:center;padding:60px 20px;"><div style="margin-bottom:16px;">' + icon3d('baby', 'icon-3d-xl') + '</div>' +
                '<p style="font-size:16px;font-weight:600;margin-bottom:8px;">아기를 먼저 등록해 주세요</p>' +
                '<button class="btn btn-primary" onclick="showBabyForm()">아기 등록하기</button></div>';
            return;
        }

        const age = data.baby.age;
        const gr = data.growth_report || {};
        const live = data.today_live || {};
        updateAppHeaderBaby(data.baby, age);
        window._babyAgeMonths = age.total_months;

        main.innerHTML =
            '<div class="home-v2">' +
            homeRenderIssues(data.issues) +

            '<div class="home-growth-card">' +
            '<div class="home-growth-head">' +
            '<div class="home-growth-title">' + icon3d('chart', 'icon-3d-inline', 26) + ' 성장 리포트</div>' +
            '<button type="button" class="home-growth-more" onclick="navigateTo(\'growth\')">전체 →</button></div>' +
            '<div class="home-growth-grid">' +
            homeGrowthPanel('height', gr) +
            homeGrowthPanel('weight', gr) +
            '</div>' +
            '<div class="home-live-head">' +
            '<span class="home-live-head-title">오늘 기록</span>' +
            '<button type="button" class="home-growth-more" onclick="navigateTo(\'record-stats\')">기록·통계 →</button></div>' +
            '<div class="home-live-row home-live-row-4">' +
            '<button type="button" class="home-live-chip" onclick="showFeedingPage()">' +
            '<span class="home-live-icon" data-icon="feeding" data-icon-size="32"></span><div><div class="home-live-label">수유</div>' +
            '<div class="home-live-value">' + homeFormatElapsed(live.last_feeding_min) + '</div>' +
            '<div class="home-live-sub">오늘 ' + (live.feeding_count || 0) + '회 · ' + (live.feeding_total_ml || 0) + 'ml</div></div></button>' +
            '<button type="button" class="home-live-chip" onclick="navigateTo(\'sleep\')">' +
            '<span class="home-live-icon" data-icon="sleep" data-icon-size="32"></span><div><div class="home-live-label">수면</div>' +
            '<div class="home-live-value">' + (live.last_sleep_min != null ? homeFormatElapsed(live.last_sleep_min) + ' 기상' : '진행중') + '</div>' +
            '<div class="home-live-sub">오늘 ' + Math.floor((live.sleep_total_min || 0) / 60) + '시간 ' + ((live.sleep_total_min || 0) % 60) + '분</div></div></button>' +
            '<button type="button" class="home-live-chip" onclick="quickBowel(\'' + babyId + '\')">' +
            '<span class="home-live-icon" data-icon="diaper" data-icon-size="32"></span><div><div class="home-live-label">기저귀</div>' +
            '<div class="home-live-value">오늘 ' + (live.diaper_count != null ? live.diaper_count : live.bowel_count || 0) + '회</div>' +
            '<div class="home-live-sub home-live-action">+ 빠른 기록</div></div></button>' +
            '<button type="button" class="home-live-chip" onclick="navigateTo(\'bowel-log\')">' +
            '<span class="home-live-icon" data-icon="stool" data-icon-size="32"></span><div><div class="home-live-label">대변</div>' +
            '<div class="home-live-value">' + (live.last_bowel_min != null ? homeFormatElapsed(live.last_bowel_min) : '--') + '</div>' +
            '<div class="home-live-sub">오늘 ' + (live.stool_count != null ? live.stool_count : 0) + '회 · 상세기록</div></div></button>' +
            '</div></div>' +

            '<div id="home-ad-mount" class="home-ad-mount" aria-hidden="true"></div>' +

            (data.next_vaccination && data.next_vaccination.name ?
                '<div class="home-schedule-card" onclick="navigateTo(\'vaccination\')">' +
                '<span data-icon="vaccine" data-icon-size="36"></span><div><div class="home-schedule-title">다음 예방접종</div>' +
                '<div class="home-schedule-text">' + data.next_vaccination.name + ' · ' + (data.next_vaccination.date || '').slice(0, 10) + '</div></div>' +
                '<span class="home-schedule-arrow">→</span></div>' : '') +

            '<div class="home-section-head"><span>최근 성장 스탬프</span>' +
            '<button type="button" onclick="navigateTo(\'milestone\')">전체 →</button></div>' +
            '<div class="home-milestone-card">' + homeRenderMilestones(data.milestones_preview) + '</div>' +

            '</div>';
        enhanceIcons3d(main);
        initHomeIssuesMarquee(main);
        if (typeof loadHomeAdCarousel === 'function') loadHomeAdCarousel(babyId);
    } catch (e) {
        if (main) {
            main.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--color-text-secondary);">' +
                '<div style="margin-bottom:12px;">' + icon3d('warning', 'icon-3d-lg') + '</div>' +
                '<p style="font-size:14px;">홈 로딩 오류: ' + e.message + '</p>' +
                '<button class="btn btn-outline" style="margin-top:16px;" onclick="loadDashboard()">다시 시도</button></div>';
        }
    }
}


