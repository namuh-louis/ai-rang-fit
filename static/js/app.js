
const API = '';
let currentUser = null;
let currentBabyId = null;
let currentFamilyCode = null;
let feedTimerInterval = null;
let feedTimerSeconds = 0;

async function login(phone, password) {
    try {
        const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
        const data = await res.json();
        if (res.ok) { localStorage.setItem('auth_token', data.user_id); currentUser = data; showToast('로그인 완료! 🎉', 'success'); loadDashboard(); }
        else showToast(data.error || '로그인 실패', 'error');
    } catch (e) { showToast('네트워크 오류', 'error'); }
}

async function register(phone, name, password) {
    try {
        const res = await fetch(`${API}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, name, password }) });
        const data = await res.json();
        if (res.ok) { localStorage.setItem('auth_token', data.user_id); currentUser = data; showToast('가입 완료! 🎉', 'success'); loadDashboard(); }
        else showToast(data.error, 'error');
    } catch (e) { showToast('네트워크 오류', 'error'); }
}

async function me() {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    try { const res = await fetch(`${API}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) return await res.json(); } catch (e) {}
    return null;
}

function getToken() { return localStorage.getItem('auth_token') || ''; }
function authHeaders() { return { 'Authorization': `Bearer ${getToken()}` }; }

// ============================================================
// 홈 대시보드 — v1/v2 전환
// localStorage 'home_ui': 'v1' (레거시) | 'v2' (기본)
// 레거시 파일: static/js/home-dashboard.legacy.js
// ============================================================
function getHomeUiVersion() {
    return localStorage.getItem('home_ui') || 'v2';
}

async function loadDashboard() {
    if (getHomeUiVersion() === 'v1' && typeof loadDashboardV1 === 'function') {
        return loadDashboardV1();
    }
    if (typeof loadDashboardV2 === 'function') {
        return loadDashboardV2();
    }
    return loadDashboardV1();
}

async function loadMilestones(babyId) {
    try {
        const res = await fetch(API + '/api/milestones?baby_id=' + babyId, { headers: authHeaders() });
        const items = await res.json();
        const container = document.getElementById('milestone-items');
        if (!container) return;
        const icons = { motor:'motor', language:'language', social:'social', cognitive:'cognitive' };
        container.innerHTML = items.slice(0, 5).map(m =>
            '<div class="record-item"><div class="record-icon dash-green" data-icon="' + (icons[m.category]||'milestone') + '" data-icon-size="28"></div>' +
            '<div class="record-info"><div class="record-title">' + m.description + '</div>' +
            '<div class="record-meta">' + m.category + ' · ' + (m.achieved_date||'').slice(0,10) + '</div></div>' +
            '<span data-icon="check" data-icon-size="20"></span></div>').join('') ||
            '<p style="text-align:center;color:var(--color-text-secondary);padding:10px;">아직 마일스톤이 없습니다</p>';
        if (typeof enhanceIcons3d === 'function') enhanceIcons3d(container);
    } catch (e) {}
}

function showBabyForm() {
    document.getElementById('main-content').innerHTML =
        '<div class="section-title">아기 등록</div><div class="card">' +
        '<div class="form-group"><label class="form-label">아기 이름</label><input class="form-input" id="baby-name" placeholder="아기 이름을 입력하세요"></div>' +
        '<div class="form-group"><label class="form-label">생년월일</label><input class="form-input" id="baby-birthdate" type="date"></div>' +
        '<div class="form-group"><label class="form-label">성별</label><div class="toggle-group" id="baby-gender-group"><button class="toggle-btn active" data-gender="male" onclick="selectGender(this,\'male\')">👦 남자</button><button class="toggle-btn" data-gender="female" onclick="selectGender(this,\'female\')">👧 여자</button></div></div>' +
        '<button class="btn btn-primary btn-full" onclick="createBaby()">아기 등록하기</button></div>';
}
function selectGender(el, gender) { el.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active')); el.classList.add('active'); el.dataset.gender = gender; }
async function createBaby() {
    const name = document.getElementById('baby-name').value;
    const birthdate = document.getElementById('baby-birthdate').value;
    if (!name || !birthdate) { showToast('이름과 생일을 입력하세요', 'error'); return; }
    const activeGenderBtn = document.querySelector('#baby-gender-group .toggle-btn.active');
    const gender = activeGenderBtn ? (activeGenderBtn.dataset.gender || 'male') : 'male';
    const res = await fetch(API + '/api/babies', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name, birthdate, gender }) });
    const data = await res.json();
    if (data.id) { currentBabyId = data.id; localStorage.setItem('baby_id', data.id); showToast('아기가 등록되었습니다! 🎉', 'success'); loadDashboard(); }
}
async function getDefaultBabyId() {
    if (currentBabyId) return currentBabyId;
    const cached = localStorage.getItem('baby_id');
    if (cached) { currentBabyId = cached; return cached; }
    try {
        const res = await fetch(API + '/api/babies', { headers: authHeaders() });
        if (!res.ok) return null;
        const babies = await res.json();
        if (babies.length > 0) { currentBabyId = babies[0].id; localStorage.setItem('baby_id', currentBabyId); return currentBabyId; }
    } catch(e) {}
    return null;
}


// 아기 미등록 안내 공통 HTML
function goRegisterBaby() { navigateTo("home"); setTimeout(showBabyForm, 50); }
function noBabyHtml() {
    return '<div style="text-align:center;padding:48px 20px;">' +
        '<div style="font-size:64px;margin-bottom:16px;">👶</div>' +
        '<div style="font-size:16px;font-weight:600;margin-bottom:8px;color:var(--color-text-primary);">아기를 먼저 등록해 주세요</div>' +
        '<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:24px;">등록 후 모든 기능을 사용할 수 있어요</div>' +
        '<button class="btn btn-primary" onclick="goRegisterBaby()" style="padding:12px 32px;font-size:15px;">아기 등록하기</button></div>';
}

// 추억·발달·금융 — 홈/기록과 동일한 허브 헤더 (상단바 아래, 둥근 카드)
function hubPageHeader(title, sub) {
    return '<div class="hub-page-head">' +
        '<h2 class="hub-page-title">' + title + '</h2>' +
        (sub ? '<p class="hub-page-sub">' + sub + '</p>' : '') +
        '</div>';
}
function pageHeader(icon, title, sub) {
    const t = (icon ? icon + ' ' : '') + title;
    return hubPageHeader(t, sub);
}
function sectionCard(content, mb) {
    mb = mb !== undefined ? mb : '12px';
    return '<div class="hub-card" style="margin-bottom:' + mb + '">' + content + '</div>';
}
function setHubTabActive(prefix, tab) {
    document.querySelectorAll('[id^="' + prefix + '"]').forEach(function (b) {
        const id = b.id || '';
        const key = id.replace(prefix, '');
        b.classList.toggle('hub-tab-btn-active', key === tab);
    });
}
function setHubChipActive(prefix, activeId) {
    document.querySelectorAll('[id^="' + prefix + '"]').forEach(function (b) {
        b.classList.toggle('hub-chip-active', b.id === activeId);
    });
}


// ============================================================
// 기록/통계 통합 페이지 (BabyTime + MamiTalk 스타일)
// ============================================================
function showRecordStatsPage() {
    document.getElementById('main-content').innerHTML =
        '<div class="rs-page">' +
        '<div class="rs-page-head hub-page-head">' +
        '<h2 class="hub-page-title">기록 · 통계</h2>' +
        '<p class="hub-page-sub rs-quick-head-label">빠른 기록</p>' +
        '<div class="rs-quick-row rs-quick-row-5">' +
        '<button type="button" class="rs-quick-btn" onclick="showFeedingPage()"><span data-icon="feeding" data-icon-size="24"></span><span>수유</span></button>' +
        '<button type="button" class="rs-quick-btn" onclick="showSleepPage()"><span data-icon="sleep" data-icon-size="24"></span><span>수면</span></button>' +
        '<button type="button" class="rs-quick-btn" onclick="quickBowelCurrent()"><span data-icon="diaper" data-icon-size="24"></span><span>기저귀</span></button>' +
        '<button type="button" class="rs-quick-btn" onclick="showBowelLogPage()"><span data-icon="stool" data-icon-size="24"></span><span>대변</span></button>' +
        '<button type="button" class="rs-quick-btn" onclick="showGrowthPage()"><span data-icon="growth" data-icon-size="24"></span><span>성장</span></button>' +
        '</div></div>' +
        '<div class="tab-bar" id="rs-tabs">' +
        '<button class="tab-item active" onclick="switchRsTab(\'today\',this)">오늘</button>' +
        '<button class="tab-item" onclick="switchRsTab(\'stats\',this)">통계</button>' +
        '<button class="tab-item" onclick="switchRsTab(\'growth\',this)">성장</button>' +
        '<button class="tab-item" onclick="switchRsTab(\'monthly\',this)">월별</button>' +
        '<button class="tab-item" onclick="switchRsTab(\'checkup\',this)">검진/접종</button>' +
        '</div>' +
        '<div id="rs-content"><div class="loading"><div class="spinner"></div></div></div></div>';
    setTimeout(function () {
        switchRsTab('today', document.querySelector('#rs-tabs .tab-item'));
        if (typeof enhanceIcons3d === 'function') enhanceIcons3d(document.getElementById('main-content'));
    }, 50);
}

function rsWhoIconHtml(iconKey) {
    return '<div class="rs-who-icon" data-icon="' + iconKey + '" data-icon-size="22"></div>';
}

function formatSleepMinutes(min) {
    min = Math.round(min || 0);
    if (min <= 0) return '0분';
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h > 0 && m > 0) return h + '시간 ' + m + '분';
    if (h > 0) return h + '시간';
    return m + '분';
}

function deltaSleepMin(curr, prev) {
    if (!prev && prev !== 0) return '';
    var diff = Math.round((curr || 0) - (prev || 0));
    if (diff === 0) return '<span style="color:var(--color-text-tertiary);font-size:11px;">→ 어제와 동일</span>';
    var sign = diff > 0 ? '▲' : '▼';
    var col = diff > 0 ? '#34D399' : '#F87171';
    return '<span style="color:' + col + ';font-size:11px;">' + sign + ' ' + formatSleepMinutes(Math.abs(diff)) + '</span>';
}

function weekSeriesAvg(items, key) {
    key = key || 'val';
    const n = Math.max(items.length, 1);
    return items.reduce(function (s, it) { return s + (it[key] != null ? it[key] : it.v || 0); }, 0) / n;
}

function miniBarChart(label, color, values, fmtVal, avgVal, fmtAvg) {
    const maxV = Math.max.apply(null, values.map(function (v) { return v.val; }).concat([1]));
    const MAX_H = 60;
    const bars = values.map(function (item, i) {
        const h = Math.max(item.val > 0 ? Math.round((item.val / maxV) * MAX_H) : 0, item.val > 0 ? 3 : 0);
        const isToday = i === values.length - 1;
        const barColor = isToday ? color : color + '99';
        return '<div style="display:flex;flex-direction:column;align-items:center;width:24px;flex-shrink:0;">' +
            '<div style="font-size:11px;color:' + (isToday ? color : 'transparent') + ';height:14px;line-height:14px;font-weight:600;">' + (item.val > 0 ? fmtVal(item.val) : '') + '</div>' +
            '<div style="height:' + MAX_H + 'px;display:flex;align-items:flex-end;">' +
            '<div style="width:18px;height:' + h + 'px;background:' + barColor + ';border-radius:4px 4px 0 0;min-height:' + (item.val > 0 ? 3 : 0) + 'px;"></div></div>' +
            '<div style="font-size:11px;color:' + (isToday ? color : 'var(--color-text-secondary)') + ';font-weight:' + (isToday ? '600' : '400') + ';margin-top:3px;">' + item.lbl + '</div>' +
            '</div>';
    }).join('');
    const avgHtml = (avgVal != null && fmtAvg)
        ? '<div class="rs-bar-avg" style="color:' + color + ';">7일 평균 <strong>' + fmtAvg(avgVal) + '</strong></div>'
        : '';
    return '<div class="rs-mini-bar-card" style="background:var(--color-border-light,#F3F4F6);border-radius:14px;padding:12px;min-width:140px;flex-shrink:0;">' +
        '<div style="font-size:12px;font-weight:600;color:var(--color-text-secondary);margin-bottom:8px;">' + label + '</div>' +
        '<div class="rs-mini-bar-bars" style="display:flex;gap:4px;align-items:flex-end;justify-content:center;">' + bars + '</div>' + avgHtml + '</div>';
}

function weekBarChart(label, color, vals, fmt, avgVal, fmtAvg, compact) {
    const maxV = Math.max.apply(null, vals.map(function (v) { return v.v; }).concat([1]));
    const H = compact ? 48 : 56;
    const colW = compact ? 20 : 26;
    const barW = compact ? 15 : 20;
    const bars = vals.map(function (item, i) {
        const h = Math.max(item.v > 0 ? Math.round((item.v / maxV) * H) : 0, item.v > 0 ? 3 : 0);
        const isLast = i === vals.length - 1;
        return '<div style="display:flex;flex-direction:column;align-items:center;width:' + colW + 'px;flex-shrink:0;max-width:100%;">' +
            '<div style="font-size:11px;color:' + (isLast ? color : 'transparent') + ';height:12px;line-height:12px;">' + (item.v > 0 ? fmt(item.v) : '') + '</div>' +
            '<div style="height:' + H + 'px;display:flex;align-items:flex-end;">' +
            '<div style="width:' + barW + 'px;height:' + h + 'px;background:' + color + ';opacity:' + (isLast ? '1' : '0.55') + ';border-radius:4px 4px 0 0;min-height:' + (item.v > 0 ? 3 : 0) + 'px;"></div></div>' +
            '<div style="font-size:11px;color:' + (isLast ? color : 'var(--color-text-secondary)') + ';font-weight:' + (isLast ? '600' : '400') + ';margin-top:2px;">' + item.l + '</div>' +
            '</div>';
    }).join('');
    const avgHtml = (avgVal != null && fmtAvg)
        ? '<div class="rs-bar-avg" style="color:' + color + ';">7일 평균 <strong>' + fmtAvg(avgVal) + '</strong></div>'
        : '';
    const cardCls = 'rs-mini-bar-card' + (compact ? ' rs-mini-bar-card--grid' : '');
    return '<div class="' + cardCls + '">' +
        '<div class="rs-mini-bar-card-title">' + label + '</div>' +
        '<div class="rs-mini-bar-bars">' + bars + '</div>' + avgHtml + '</div>';
}

function formatDailyCountAvg(n) {
    if (n == null || isNaN(n)) return '0';
    if (n % 1 === 0) return String(Math.round(n));
    return n.toFixed(1);
}

function computePatternWeekAverages(weekDays, patternEventDays) {
    const n = Math.max(weekDays.length, 1);
    var feedMl = 0, feedCnt = 0, sleepMin = 0, playMin = 0, diaperCnt = 0, stoolCnt = 0;
    weekDays.forEach(function (d, i) {
        feedMl += d.feeding_ml || 0;
        feedCnt += d.feeding_count || 0;
        sleepMin += d.sleep_min || 0;
        diaperCnt += d.diaper_count != null ? d.diaper_count : 0;
        stoolCnt += d.stool_count != null ? d.stool_count : 0;
        var evs = (patternEventDays[i] && patternEventDays[i].events) || [];
        buildPatternDayEvents(evs).forEach(function (ev) {
            if (ev.type === 'play') playMin += ev.duration_min || 0;
        });
    });
    return {
        feedCount: Math.round(feedCnt / n * 10) / 10,
        feedMl: Math.round(feedMl / n),
        sleepH: Math.round(sleepMin / n / 60 * 10) / 10,
        playH: Math.round(playMin / n / 60 * 10) / 10,
        diaperCount: Math.round(diaperCnt / n * 10) / 10,
        stoolCount: Math.round(stoolCnt / n * 10) / 10,
    };
}

function formatPatternPeriodRange(dates) {
    if (!dates || !dates.length) return '';
    var start = new Date(dates[0] + 'T12:00:00');
    var end = new Date(dates[dates.length - 1] + 'T12:00:00');
    function fmt(d) {
        return (d.getMonth() + 1) + '/' + d.getDate();
    }
    return fmt(start) + ' ~ ' + fmt(end);
}

function patternChartPeriodHeaderHtml(dates) {
    var range = formatPatternPeriodRange(dates);
    return '<div class="pattern-chart-period-header">' +
        '<span class="pattern-chart-period-title">최근 7일</span>' +
        (range ? '<span class="pattern-chart-period-range">' + range + '</span>' : '') +
        '</div>';
}

function patternWeekAvgHtml() {
    var weekDays = window._patternWeekDays || [];
    var allEvents = window._patternEvents || [];
    if (!weekDays.length) return '';
    var dates = window._patternDates || [];
    var range = formatPatternPeriodRange(dates);
    var a = computePatternWeekAverages(weekDays, allEvents);
    return '<div class="pattern-week-avg">' +
        '<div class="pattern-week-avg-title"><span>최근 7일 일평균</span>' + (range ? '<span class="pattern-week-avg-range">' + range + '</span>' : '') + '</div>' +
        '<div class="pattern-week-avg-items">' +
        '<span><em style="color:#FF6B9D;font-style:normal;font-weight:700;">먹</em> ' + formatDailyCountAvg(a.feedCount) + '회 · ' + a.feedMl + 'ml</span>' +
        '<span><em style="color:#FBBF24;font-style:normal;font-weight:700;">놀</em> ' + a.playH + '시간</span>' +
        '<span><em style="color:#A78BFA;font-style:normal;font-weight:700;">잠</em> ' + a.sleepH + '시간</span>' +
        '<span class="pattern-week-avg-icon-item"><span data-icon="diaper" data-icon-size="12"></span> 기저귀 ' + formatDailyCountAvg(a.diaperCount) + '회</span>' +
        '<span class="pattern-week-avg-icon-item"><span data-icon="stool" data-icon-size="12"></span> 대변 ' + formatDailyCountAvg(a.stoolCount) + '회</span>' +
        '</div></div>';
}

function isPatternPointEvent(ev) {
    return ev.type === 'diaper' || ev.type === 'stool' || ev.type === 'bowel';
}

function whoRow(iconKey, label, val, unit, ref, pct, comment) {
    const p = Math.max(0, Math.min(100, pct || 0));
    const lc = comment?.level === 'good' ? '#34D399' : comment?.level === 'caution' ? '#FBBF24' : '#F87171';
    const status = comment?.level === 'good' ? '정상' : comment?.level === 'caution' ? '주의' : '확인필요';
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--color-border-light);">' +
        rsWhoIconHtml(iconKey) +
        '<div style="flex:1;">' +
        '<div style="font-size:13px;font-weight:500;color:var(--color-text-primary);">' + label + '</div>' +
        '<div style="font-size:11px;color:var(--color-text-secondary);">' + (typeof val === 'number' ? val.toFixed(val >= 10 ? 0 : 1) : val) + unit + ' · 권장 ' + (ref?.min || '?') + '~' + (ref?.max || '?') + unit + '</div>' +
        '<div style="height:5px;border-radius:99px;background:#E5E7EB;margin-top:5px;"><div style="height:100%;width:' + p + '%;background:' + lc + ';border-radius:99px;"></div></div>' +
        '</div>' +
        '<div style="font-size:12px;font-weight:600;color:' + lc + ';">' + status + '</div>' +
        '</div>';
}

function mergeMinuteIntervals(intervals) {
    if (!intervals.length) return [];
    intervals.sort(function (a, b) { return a[0] - b[0]; });
    const merged = [intervals[0].slice()];
    for (let i = 1; i < intervals.length; i++) {
        const cur = intervals[i];
        const last = merged[merged.length - 1];
        if (cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1]);
        else merged.push(cur.slice());
    }
    return merged;
}

function complementMinuteIntervals(merged, dayStart, dayEnd, minGap) {
    minGap = minGap || 8;
    const out = [];
    let t = dayStart;
    merged.forEach(function (pair) {
        const s = pair[0];
        const e = pair[1];
        if (s > t && s - t >= minGap) out.push([t, s]);
        t = Math.max(t, e);
    });
    if (dayEnd > t && dayEnd - t >= minGap) out.push([t, dayEnd]);
    return out;
}

/** 먹·잠 기록 + 그 외 시간(놀) + 입력한 대변/기저귀 그대로 */
function buildPatternDayEvents(rawEvents) {
    rawEvents = rawEvents || [];
    const feedingSleep = [];
    const pointEvents = [];
    rawEvents.forEach(function (ev) {
        const t = ev.type;
        if (t === 'diaper' || t === 'stool') {
            pointEvents.push(ev);
        } else if (t === 'bowel') {
            pointEvents.push(Object.assign({}, ev, { type: 'stool' }));
        } else if (t === 'feeding' || t === 'sleep') {
            feedingSleep.push(ev);
        }
    });
    const occupied = mergeMinuteIntervals(feedingSleep.map(function (ev) {
        const start = ev.hour * 60 + ev.minute;
        const dur = ev.duration_min || (ev.type === 'sleep' ? 60 : 15);
        return [start, Math.min(start + dur, 24 * 60)];
    }));
    const playGaps = complementMinuteIntervals(occupied, 0, 24 * 60, 8);
    const playEvents = playGaps.map(function (pair) {
        const start = pair[0];
        const end = pair[1];
        return {
            type: 'play',
            hour: Math.floor(start / 60),
            minute: start % 60,
            duration_min: end - start,
            label: '놀',
            color: '#FBBF24',
        };
    });
    const result = feedingSleep.concat(playEvents, pointEvents);
    result.sort(function (a, b) {
        return (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute);
    });
    return result;
}

function patternMarkerImageSvg(iconKey, cx, cy, size) {
    size = size || 11;
    var half = size / 2;
    var src = typeof icon3dSrc === 'function' ? icon3dSrc(iconKey) : '';
    if (!src) return '';
    return '<image href="' + src + '" x="' + (cx - half).toFixed(1) + '" y="' + (cy - half).toFixed(1) + '" width="' + size + '" height="' + size + '" opacity="0.98" filter="url(#icon3dDrop)"/>';
}

function patternDiaperIconSvg(cx, cy, size) {
    return patternMarkerImageSvg('diaper', cx, cy, size);
}

function patternPointMarkerSvg(ev, cx, cy, size) {
    if (ev.type === 'stool' || ev.type === 'bowel') {
        return typeof patternStoolIconSvg === 'function' ? patternStoolIconSvg(cx, cy, size) : '';
    }
    if (ev.type === 'diaper') return patternDiaperIconSvg(cx, cy, size);
    return '';
}

function rsMiniChartLabel(iconKey, text) {
    var stoolCls = iconKey === 'stool' ? ' rs-mini-stool' : '';
    return '<span class="rs-mini-chart-label' + stoolCls + '"><span data-icon="' + iconKey + '" data-icon-size="14"></span><span>' + text + '</span></span>';
}

function patternBaseLegend() {
    const items = [
        ['#FF6B9D', '먹', 'bar'],
        ['#FBBF24', '놀', 'bar'],
        ['#A78BFA', '잠', 'bar'],
        ['diaper', '기저귀', 'icon-key'],
        ['stool', '대변', 'icon-key'],
    ];
    return items.map(function (lg) {
        var swatch;
        if (lg[2] === 'icon-key') {
            swatch = typeof icon3dStool === 'function' && lg[0] === 'stool'
                ? '<span class="pattern-legend-3d">' + icon3dStool(14) + '</span>'
                : (typeof icon3d === 'function' ? '<span class="pattern-legend-3d">' + icon3d(lg[0], 'icon-3d icon-3d-anim', 14) + '</span>' : '');
        } else {
            swatch = '<div style="width:12px;height:8px;border-radius:2px;background:' + lg[0] + ';"></div>';
        }
        return '<div style="display:flex;align-items:center;gap:5px;">' + swatch +
            '<span style="font-size:12px;color:var(--color-text-secondary);">' + lg[1] + '</span></div>';
    }).join('');
}

async function switchRsTab(tab, el) {
    document.querySelectorAll('#rs-tabs .tab-item').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    const babyId = currentBabyId || await getDefaultBabyId();
    const c = document.getElementById('rs-content');
    if (!babyId) {
        if (c) c.innerHTML = noBabyHtml();
        return;
    }
    try {
        if (tab === 'today') await renderRsToday(babyId);
        else if (tab === 'stats') await renderRsStats(babyId);
        else if (tab === 'growth') await renderRsGrowth(babyId);
        else if (tab === 'monthly') await renderRsMonthly(babyId);
        else if (tab === 'checkup') await renderRsCheckup(babyId);
    } catch(e) {
        if (c) c.innerHTML = '<div style="text-align:center;padding:30px;"><p style="color:var(--color-danger);font-size:13px;">오류: ' + e.message + '</p></div>';
    }
}

// 오늘 탭
async function renderRsToday(babyId) {
    const c = document.getElementById('rs-content');
    c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    const today = new Date();
    const dates = Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10);});
    const [todayRes, weekRes, ...tlResults] = await Promise.all([
        fetch(API+'/api/stats/today/'+babyId, {headers:authHeaders()}),
        fetch(API+'/api/stats/weekly/'+babyId, {headers:authHeaders()}),
        ...dates.map(date=>fetch(API+'/api/stats/timeline/'+babyId+'?date='+date,{headers:authHeaders()}).then(r=>r.ok?r.json():{events:[]}))
    ]);

    const d = todayRes.ok ? await todayRes.json() : {};
    const weekDays = weekRes.ok ? await weekRes.json() : [];
    // 어제 데이터는 weekDays 마지막 2번째 항목에서 추출
    const yd = weekDays.length >= 2 ? weekDays[weekDays.length-2] : {};
    window._patternEvents = tlResults;
    window._patternDates = dates;
    window._patternWeekDays = weekDays;
    window._patternBabyId = babyId;

    // 어제 대비 델타
    function delta(curr, prev, unit) {
        if (!prev && prev !== 0) return '';
        const diff = curr - prev;
        if (diff === 0) return '<span style="color:var(--color-text-tertiary);font-size:11px;">→ 어제와 동일</span>';
        const sign = diff > 0 ? '▲' : '▼';
        const col  = diff > 0 ? '#34D399' : '#F87171';
        return '<span style="color:'+col+';font-size:11px;">'+sign+' '+Math.abs(diff)+unit+'</span>';
    }

    const fc=d.feeding_count||0, fml=d.feeding_total_ml||0;
    const stm=d.sleep_total_min||0;
    const dc=d.diaper_count!=null?d.diaper_count:0;
    const stc=d.stool_count!=null?d.stool_count:0;
    const yfc=yd.feeding_count||Math.round((yd.feeding_ml||0)/80)||0;
    const ydc=yd.diaper_count!=null?yd.diaper_count:0;
    const ystc=yd.stool_count!=null?yd.stool_count:0;
    const ystm=yd.sleep_min||0;

    // ── ① 오늘 요약 카드
    const summaryHtml =
        '<div style="background:var(--color-border-light,#F3F4F6);border-radius:16px;padding:14px;margin-bottom:14px;">' +
        '<div style="font-size:13px;font-weight:600;color:var(--color-text-secondary);margin-bottom:12px;">📅 오늘 요약 · 어제 대비</div>' +
        '<div class="rs-today-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">' +
        '<div class="rs-today-cell" style="text-align:center;">' +
        '<div class="rs-today-icon" onclick="showFeedingPage()"><span data-icon="feeding" data-icon-size="26"></span></div>' +
        '<div style="font-size:22px;font-weight:500;color:#FF6B9D;">'+fc+'회</div>' +
        '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">'+(fml>0?fml+'ml':'수유')+'</div>' +
        '<div style="margin-top:4px;">'+delta(fc,yfc,'회')+'</div></div>' +
        '<div class="rs-today-cell" style="text-align:center;cursor:pointer;" onclick="showSleepPage()">' +
        '<div class="rs-today-icon"><span data-icon="sleep" data-icon-size="26"></span></div>' +
        '<div class="rs-today-sleep-value" style="font-size:17px;font-weight:600;color:#A78BFA;line-height:1.3;">'+formatSleepMinutes(stm)+'</div>' +
        '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">수면</div>' +
        '<div style="margin-top:4px;">'+deltaSleepMin(stm,ystm)+'</div></div>' +
        '<div style="text-align:center;">' +
        '<div style="margin-bottom:2px;" onclick="quickBowelCurrent()"><span data-icon="diaper" data-icon-size="26"></span></div>' +
        '<div style="font-size:22px;font-weight:500;color:#38BDF8;">'+dc+'회</div>' +
        '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">기저귀</div>' +
        '<div style="margin-top:4px;">'+delta(dc,ydc,'회')+'</div></div>' +
        '<div class="rs-today-stool" style="text-align:center;" onclick="showBowelLogPage()">' +
        '<div style="margin-bottom:2px;"><span data-icon="stool" data-icon-size="26"></span></div>' +
        '<div style="font-size:22px;font-weight:500;color:#A16207;">'+stc+'회</div>' +
        '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">대변</div>' +
        '<div style="margin-top:4px;">'+delta(stc,ystc,'회')+'</div></div>' +
        '</div></div>';

    // ── ② 활동 패턴 (7일 비교·WHO는 통계 탭)
    const patternHtml =
        '<div style="background:var(--color-border-light,#F3F4F6);border-radius:16px;padding:12px;margin-bottom:14px;">' +
        '<div style="font-size:14px;font-weight:600;color:var(--color-text-primary);margin-bottom:10px;">⏱ 활동 패턴</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
        '<button id="btn-hori" onclick="switchPatternView(\'hori\')" style="flex:1;padding:8px;font-size:12px;font-weight:600;border-radius:10px;border:none;background:#FF6B9D;color:white;cursor:pointer;">가로차트</button>' +
        '<button id="btn-vert" onclick="switchPatternView(\'vert\')" style="flex:1;padding:8px;font-size:12px;font-weight:600;border-radius:10px;border:0.5px solid var(--color-border);background:transparent;color:var(--color-text-secondary);cursor:pointer;">세로차트</button>' +
        '</div>' +
        '<div id="pattern-chart-wrap" class="pattern-chart-wrap"></div>' +
        '</div>';

    c.innerHTML = summaryHtml + patternHtml;

    window._patternView = 'hori';
    switchPatternView('hori');
    if (typeof enhanceIcons3d === 'function') enhanceIcons3d(c);
}

function switchPatternView(view) {
    window._patternView = view;
    const btnH = document.getElementById('btn-hori');
    const btnV = document.getElementById('btn-vert');
    if (!btnH || !btnV) return;
    if (view === 'hori') {
        btnH.style.cssText = 'flex:1;padding:8px;font-size:12px;font-weight:600;border-radius:10px;border:none;background:#FF6B9D;color:white;cursor:pointer;';
        btnV.style.cssText = 'flex:1;padding:8px;font-size:12px;font-weight:600;border-radius:10px;border:0.5px solid var(--color-border);background:transparent;color:var(--color-text-secondary);cursor:pointer;';
        drawHorizontalPattern();
    } else {
        btnV.style.cssText = 'flex:1;padding:8px;font-size:12px;font-weight:600;border-radius:10px;border:none;background:#A78BFA;color:white;cursor:pointer;';
        btnH.style.cssText = 'flex:1;padding:8px;font-size:12px;font-weight:600;border-radius:10px;border:0.5px solid var(--color-border);background:transparent;color:var(--color-text-secondary);cursor:pointer;';
        drawVerticalPattern();
    }
}

function drawHorizontalPattern() {
    const wrap = document.getElementById('pattern-chart-wrap'); if (!wrap) return;
    const allEvents = window._patternEvents || [];
    const dates = window._patternDates || [];
    const show = [0,1,2,3,4,5,6].map(i=>({date:dates[i], events:(allEvents[i]?.events||[])}));

    const PL=34,PR=6,PT=4,PB=20,PW=264,PH=18,GAP=6;
    const VW=PL+PW+PR, VH=PT+(PH+GAP)*7+PB;
    const pxMin=PW/(24*60);
    const colors={feeding:'#FF6B9D',play:'#FBBF24',sleep:'#A78BFA',diaper:'#38BDF8',stool:'#A16207',bowel:'#A16207'};
    const dayL=['일','월','화','수','목','금','토'];
    const ICON_SZ=11;

    let svg='<svg viewBox="0 0 '+VW+' '+VH+'" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:100%;height:auto;display:block;">'+
        (typeof patternSvg3dDefs === 'function' ? patternSvg3dDefs() : '');
    [0,6,12,18,24].forEach(h=>{
        const x=PL+h*60*pxMin;
        svg+='<line x1="'+x.toFixed(1)+'" y1="'+PT+'" x2="'+x.toFixed(1)+'" y2="'+(VH-PB)+'" stroke="#E5E7EB" stroke-width="0.8"/>';
        svg+='<text x="'+x.toFixed(1)+'" y="'+(VH-PB+14)+'" font-size="9" fill="#9CA3AF" text-anchor="middle">'+(h===0?'0시':h===12?'12시':h+'시')+'</text>';
    });

    show.forEach((row,ri)=>{
        const y0=PT+ri*(PH+GAP);
        const yMid=y0+PH/2;
        const dObj=new Date(row.date);
        const isToday=ri===6, isYest=ri===5;
        const label=isToday?'오늘':isYest?'어제':(dayL[dObj.getDay()]+'.'+(dObj.getDate()));

        svg+='<rect x="'+PL+'" y="'+y0+'" width="'+PW+'" height="'+PH+'" fill="'+(isToday?'#FFF5F8':'#F9FAFB')+'" rx="3"/>';
        svg+='<text x="'+(PL-4)+'" y="'+(yMid+4)+'" font-size="10" fill="'+(isToday?'#FF6B9D':isYest?'#6B7280':'#C4C9D4')+'" text-anchor="end" font-weight="'+(isToday?'700':'400')+'">'+label+'</text>';

        var dayEvs=buildPatternDayEvents(row.events);
        dayEvs.forEach(function(ev){
            if(!isPatternPointEvent(ev)){
                const col=colors[ev.type];if(!col)return;
                const x=PL+(ev.hour*60+ev.minute)*pxMin;
                const w=Math.max((ev.duration_min||10)*pxMin,3);
                svg+='<rect x="'+x.toFixed(1)+'" y="'+y0+'" width="'+Math.min(w,PL+PW-x).toFixed(1)+'" height="'+PH+'" rx="2" fill="'+col+'" opacity="0.85"/>';
            }
        });
        dayEvs.forEach(function(ev){
            if(!isPatternPointEvent(ev))return;
            const x=PL+(ev.hour*60+ev.minute)*pxMin+3;
            svg+=patternPointMarkerSvg(ev,x,yMid,ICON_SZ);
        });
    });

    svg+='</svg>';
    const legHtml = '<div class="pattern-chart-legend">' + patternBaseLegend() + '</div>';
    wrap.innerHTML=patternChartPeriodHeaderHtml(dates)+svg+legHtml+patternWeekAvgHtml();
    if (typeof enhanceIcons3d === 'function') enhanceIcons3d(wrap);
}

function drawVerticalPattern() {
    const wrap = document.getElementById('pattern-chart-wrap'); if (!wrap) return;
    const allEvents = window._patternEvents || [];
    const dates = window._patternDates || [];
    const colors={feeding:'#FF6B9D',play:'#FBBF24',sleep:'#A78BFA',diaper:'#38BDF8',stool:'#A16207',bowel:'#A16207'};
    const dayL=['일','월','화','수','목','금','토'];

    const PL=22,PR=6,PT=26,PB=8,VW=310,VH=376;
    const chartW=VW-PL-PR, chartH=VH-PT-PB;
    const colW=chartW/7;
    const toY=(h,m)=>PT+(h*60+m)/(24*60)*chartH;

    const ICON_SZ_V=12;
    const cxCol=function(x){return x+colW/2;};

    let svg='<svg viewBox="0 0 '+VW+' '+VH+'" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:100%;height:auto;display:block;">'+
        (typeof patternSvg3dDefs === 'function' ? patternSvg3dDefs() : '');
    [0,3,6,9,12,15,18,21,24].forEach(h=>{
        const y=toY(h,0);
        svg+='<line x1="'+PL+'" y1="'+y.toFixed(1)+'" x2="'+(VW-PR)+'" y2="'+y.toFixed(1)+'" stroke="#E5E7EB" stroke-width="0.5"/>';
        if(h%3===0) svg+='<text x="'+(PL-3)+'" y="'+(y+3.5).toFixed(1)+'" font-size="9" fill="#9CA3AF" text-anchor="end">'+String(h).padStart(2,'0')+'</text>';
    });

    dates.forEach((date,di)=>{
        const x=PL+di*colW;
        const evs=(allEvents[di]?.events)||[];
        const dObj=new Date(date);
        const isToday=di===6;
        const isWeekend=dObj.getDay()===0||dObj.getDay()===6;

        svg+='<rect x="'+(x+1).toFixed(1)+'" y="'+PT+'" width="'+(colW-2).toFixed(1)+'" height="'+chartH+'" fill="'+(isToday?'#FFF5F8':'#F9FAFB')+'" rx="2"/>';

        const dStr=dObj.getDate()+'일';
        const dayStr=dayL[dObj.getDay()];
        svg+='<text x="'+cxCol(x).toFixed(1)+'" y="'+(PT-13)+'" font-size="9" fill="'+(isToday?'#FF6B9D':isWeekend?'#A78BFA':'#9CA3AF')+'" text-anchor="middle" font-weight="'+(isToday?'700':'400')+'">'+dStr+'</text>';
        svg+='<text x="'+cxCol(x).toFixed(1)+'" y="'+(PT-3)+'" font-size="8" fill="'+(isToday?'#FF6B9D':isWeekend?'#A78BFA':'#C4C9D4')+'" text-anchor="middle">'+dayStr+'</text>';

        var dayEvs=buildPatternDayEvents(evs);
        dayEvs.forEach(function(ev){
            if(isPatternPointEvent(ev))return;
            const col=colors[ev.type];if(!col)return;
            const y1=toY(ev.hour,ev.minute);
            const dur=ev.duration_min||15;
            const bh=Math.max((dur/(24*60))*chartH,2);
            svg+='<rect x="'+(x+2).toFixed(1)+'" y="'+y1.toFixed(1)+'" width="'+(colW-4).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+col+'" opacity="0.82" rx="1"/>';
        });
        dayEvs.forEach(function(ev){
            if(!isPatternPointEvent(ev))return;
            const y1=toY(ev.hour,ev.minute);
            svg+=patternPointMarkerSvg(ev,cxCol(x),y1+ICON_SZ_V/2,ICON_SZ_V);
        });
    });

    svg+='</svg>';

    const vLegHtml = '<div class="pattern-chart-legend">' + patternBaseLegend() + '</div>';
    wrap.innerHTML=patternChartPeriodHeaderHtml(dates)+svg+vLegHtml+patternWeekAvgHtml();
    if (typeof enhanceIcons3d === 'function') enhanceIcons3d(wrap);
}



// 통계 탭 — 서브탭 없이 한 화면 스크롤
async function renderRsStats(babyId) {
    const c = document.getElementById('rs-content');
    c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
        const [weekRes, whoRes] = await Promise.all([
            fetch(API+'/api/stats/weekly/'+babyId, {headers:authHeaders()}),
            fetch(API+'/api/stats/who-infant/'+babyId, {headers:authHeaders()})
        ]);
        const weekDays = weekRes.ok ? await weekRes.json() : [];
        const who = whoRes.ok ? await whoRes.json() : null;

        const wItems = weekDays.map(d=>({l:d.day_label,v:d.feeding_ml||0}));
        const sItems = weekDays.map(d=>({l:d.day_label,v:Math.round((d.sleep_min||0)/60*10)/10}));
        const dItems = weekDays.map(d=>({l:d.day_label,v:d.diaper_count||0}));
        const stItems = weekDays.map(d=>({l:d.day_label,v:d.stool_count||0}));
        const wItemsAvg = weekSeriesAvg(wItems.map(x=>({val:x.v})), 'val');
        const sItemsAvg = weekSeriesAvg(sItems.map(x=>({val:x.v})), 'val');
        const dItemsAvg = weekSeriesAvg(dItems.map(x=>({val:x.v})), 'val');
        const stItemsAvg = weekSeriesAvg(stItems.map(x=>({val:x.v})), 'val');
        const weekHtml =
            '<section class="rs-week-compare">' +
            '<div class="rs-week-compare-title">📊 7일 비교</div>' +
            '<div class="rs-week-compare-grid">' +
            weekBarChart('🍼 수유량(ml)', '#FF6B9D', wItems, v => v.toFixed(0), wItemsAvg, v => v.toFixed(0) + 'ml', true) +
            weekBarChart('😴 수면(h)', '#A78BFA', sItems, v => v + 'h', sItemsAvg, v => v.toFixed(1) + 'h', true) +
            weekBarChart(rsMiniChartLabel('diaper', '기저귀(회)'), '#38BDF8', dItems, v => v + '회', dItemsAvg, v => formatDailyCountAvg(v) + '회', true) +
            weekBarChart(rsMiniChartLabel('stool', '대변(회)'), '#A16207', stItems, v => v + '회', stItemsAvg, v => formatDailyCountAvg(v) + '회', true) +
            '</div></section>';

        // ② 히트맵 — 수유/수면/대변 3행 동시 표시 (토글 없음)
        let hmHtml = '<div style="font-size:15px;font-weight:600;color:var(--color-text-primary);margin-bottom:10px;">🗓 28일 패턴 히트맵</div>' +
            '<div id="combined-heatmap-wrap"><div class="loading"><div class="spinner"></div></div></div>';

        // ③ WHO 비교
        let whoHtml = '';
        if (who) {
            whoHtml =
                '<div style="font-size:15px;font-weight:600;color:var(--color-text-primary);margin-bottom:4px;">🏥 WHO 기준 비교</div>' +
                '<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:10px;">현재 '+who.age_months+'개월 · 최근 7일 평균</div>' +
                '<div style="background:var(--color-border-light,#F3F4F6);border-radius:16px;padding:2px 14px 8px;">' +
                whoRow('feeding','수유량',who.feeding?.avg_7d,'ml',who.feeding?.ref,who.feeding?.percentile,who.feeding?.comment) +
                whoRow('sleep','수면시간',who.sleep?.avg_7d,'h',who.sleep?.ref,who.sleep?.percentile,who.sleep?.comment) +
                whoRow('diaper','기저귀',(who.diaper||who.bowel)?.avg_7d,'회',(who.diaper||who.bowel)?.ref,(who.diaper||who.bowel)?.percentile,(who.diaper||who.bowel)?.comment) +
                whoRow('stool','대변',who.stool?.avg_7d,'회',who.stool?.ref,who.stool?.percentile,who.stool?.comment) +
                '</div>';
        }

        c.innerHTML = weekHtml + hmHtml + '<div style="margin-top:16px;">' + whoHtml + '</div>';
        if (typeof enhanceIcons3d === 'function') enhanceIcons3d(c);
        renderCombinedHeatmap(babyId);
    } catch(e) {
        c.innerHTML = '<p style="text-align:center;padding:30px;color:var(--color-danger);">'+e.message+'</p>';
    }
}

// 3개 활동 동시 히트맵 (토글 없음)
async function renderCombinedHeatmap(babyId) {
    const wrap = document.getElementById('combined-heatmap-wrap'); if (!wrap) return;
    const activities = [
        {type:'feeding', color:'#FF6B9D', label:'🍼 수유'},
        {type:'sleep',   color:'#A78BFA', label:'😴 수면'},
        {type:'bowel',   color:'#34D399', label:'<span class="heatmap-row-label"><span data-icon="diaper" data-icon-size="14"></span> 기저귀</span>'},
    ];
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
        const results = await Promise.all(activities.map(a=>
            fetch(API+'/api/stats/heatmap/'+babyId+'?type='+a.type+'&days=28',{headers:authHeaders()})
                .then(r=>r.ok?r.json():null)
        ));
        const CELL=11, GAP=2, LABEL_W=52;
        let html = '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;background:var(--color-border-light,#F3F4F6);border-radius:14px;padding:12px;">';
        // 시간 헤더
        html += '<div style="display:flex;margin-left:'+LABEL_W+'px;margin-bottom:4px;">';
        [0,3,6,9,12,15,18,21].forEach(h=>html+='<div style="width:'+(CELL+GAP)*3+'px;font-size:11px;color:var(--color-text-tertiary);">'+String(h).padStart(2,'0')+'시</div>');
        html += '</div>';
        activities.forEach((act,ai)=>{
            const data = results[ai]; if(!data) return;
            const grid = data.grid, maxVal = Math.max(...grid.flat(),1);
            html += '<div style="font-size:11px;color:'+act.color+';font-weight:600;margin-bottom:3px;margin-left:2px;">'+act.label+'</div>';
            data.day_labels.forEach((day,wi)=>{
                html += '<div style="display:flex;align-items:center;margin-bottom:'+GAP+'px;">' +
                    '<div style="width:'+LABEL_W+'px;font-size:11px;color:var(--color-text-secondary);">'+day+'</div>';
                for(let hi=0;hi<24;hi++){
                    const v=grid[wi][hi],op=v===0?0.06:0.15+(v/maxVal)*0.82;
                    html+='<div title="'+day+' '+hi+'시 '+v+'회" style="width:'+CELL+'px;height:'+CELL+'px;border-radius:2px;background:'+act.color+';opacity:'+op+';margin-right:'+GAP+'px;flex-shrink:0;"></div>';
                }
                html += '</div>';
            });
            if(ai<activities.length-1) html+='<div style="height:10px;"></div>';
        });
        html += '</div>';
        wrap.innerHTML = html;
        if (typeof enhanceIcons3d === 'function') enhanceIcons3d(wrap);
    } catch(e) { wrap.innerHTML = '<p style="color:var(--color-danger);font-size:12px;">히트맵 로딩 실패</p>'; }
}

// 성장 탭
async function renderRsGrowth(babyId) {
    const c = document.getElementById('rs-content');
    c.innerHTML = '<div id="who-compare-section"><div class="loading"><div class="spinner"></div></div></div>' +
        '<div class="card" style="margin-top:12px;"><div class="card-title" style="margin-bottom:12px;">새 측정 입력</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">' +
        '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">체중(kg)</label><input class="form-input" id="growth-weight" type="number" step="0.1" placeholder="9.5" style="padding:10px 8px;font-size:14px;"></div>' +
        '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">키(cm)</label><input class="form-input" id="growth-height" type="number" step="0.1" placeholder="75.5" style="padding:10px 8px;font-size:14px;"></div>' +
        '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">두위(cm)</label><input class="form-input" id="growth-head" type="number" step="0.1" placeholder="46.5" style="padding:10px 8px;font-size:14px;"></div>' +
        '</div><button class="btn btn-primary btn-full" onclick="recordGrowth()">측정 기록하기</button></div>';
    loadGrowthCompare();
}

// 월별 탭 (MamiTalk 스타일 성장 스탬프 + 통계)
async function renderRsMonthly(babyId) {
    const c = document.getElementById('rs-content');
    c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
        const [mRes, msRes] = await Promise.all([
            fetch(API + '/api/stats/monthly/' + babyId, { headers: authHeaders() }),
            fetch(API + '/api/milestones?baby_id=' + babyId, { headers: authHeaders() })
        ]);
        const monthDays = mRes.ok ? await mRes.json() : [];
        const milestones = msRes.ok ? await msRes.json() : [];
        const currentMonth = new Date().getMonth() + 1;
        const stampHtml = '<div class="card" style="margin-bottom:12px;"><div class="card-title" style="margin-bottom:10px;">⭐ 월별 성장 스탬프</div>' +
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">' +
            Array.from({length:12},(_,i)=>i+1).map(m => {
                const msInMonth = milestones.filter(ms => ms.achieved_date && parseInt(ms.achieved_date.slice(5,7)) === m);
                const hasStamp = msInMonth.length > 0;
                const isPast = m <= currentMonth;
                return '<div onclick="showToast(\'' + m + '월 스탬프 ' + (hasStamp ? msInMonth.length + '개\',\'success\')' : '없음\',\'\')')  + '" style="text-align:center;padding:10px 6px;border-radius:12px;background:' + (hasStamp ? 'linear-gradient(135deg,#FF6B9D22,#C45FD022)' : isPast ? 'var(--color-border-light)' : '#F9FAFB') + ';border:1.5px solid ' + (hasStamp ? '#FF6B9D' : 'var(--color-border)') + ';cursor:pointer;">' +
                    '<div style="font-size:20px;">' + (hasStamp ? '⭐' : '🌱') + '</div>' +
                    '<div style="font-size:11px;font-weight:700;margin-top:3px;">' + m + '월</div>' +
                    (hasStamp ? '<div style="font-size:11px;color:var(--color-primary);">' + msInMonth.length + '개 달성</div>' : '') +
                    '</div>';
            }).join('') + '</div></div>';

        const recentDays = monthDays.slice(-7);
        const avgFeeding = recentDays.reduce((a,b) => a+(b.feeding_ml||0), 0) / Math.max(recentDays.length, 1);
        const avgSleep = recentDays.reduce((a,b) => a+(b.sleep_hours||0), 0) / Math.max(recentDays.length, 1);
        const avgDiaper = Math.round(recentDays.reduce((a,b) => a+(b.diaper_count!=null?b.diaper_count:b.bowel_count||0), 0) / Math.max(recentDays.length, 1) * 10) / 10;
        const avgStool = Math.round(recentDays.reduce((a,b) => a+(b.stool_count||0), 0) / Math.max(recentDays.length, 1) * 10) / 10;
        const summaryHtml = '<div class="card" style="margin-bottom:12px;"><div class="card-title" style="margin-bottom:10px;">📈 최근 7일 평균</div>' +
            '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">' +
            '<div style="text-align:center;padding:10px;background:var(--color-primary-light);border-radius:10px;"><div style="font-size:18px;">🍼</div><div style="font-size:16px;font-weight:800;color:var(--color-primary);">' + avgFeeding.toFixed(0) + 'ml</div><div style="font-size:11px;color:var(--color-text-secondary);">일 평균 수유</div></div>' +
            '<div style="text-align:center;padding:10px;background:#EDE9FE;border-radius:10px;"><div style="font-size:18px;">😴</div><div style="font-size:16px;font-weight:800;color:#7C3AED;">' + avgSleep.toFixed(1) + 'h</div><div style="font-size:11px;color:var(--color-text-secondary);">일 평균 수면</div></div>' +
            '<div style="text-align:center;padding:10px;background:#E0F2FE;border-radius:10px;"><span data-icon="diaper" data-icon-size="22"></span><div style="font-size:16px;font-weight:800;color:#0369A1;margin-top:4px;">' + avgDiaper + '회</div><div style="font-size:11px;color:var(--color-text-secondary);">일 평균 기저귀</div></div>' +
            '<div style="text-align:center;padding:10px;background:#FEF3C7;border-radius:10px;"><span data-icon="stool" data-icon-size="22"></span><div style="font-size:16px;font-weight:800;color:#A16207;margin-top:4px;">' + avgStool + '회</div><div style="font-size:11px;color:var(--color-text-secondary);">일 평균 대변</div></div>' +
            '</div></div>';

        const icons = { motor:'🏃', language:'🗣️', social:'😊', cognitive:'🧠' };
        const msHtml = '<div class="card"><div class="card-title" style="margin-bottom:10px;">⭐ 전체 성장 스탬프</div>' +
            (milestones.length > 0 ? milestones.map(m =>
                '<div class="record-item"><div class="record-icon" style="background:var(--color-warning-light);font-size:18px;">' + (icons[m.category]||'⭐') + '</div>' +
                '<div class="record-info"><div class="record-title">' + m.description + '</div><div class="record-meta">' + m.category + ' · ' + (m.achieved_date||'').slice(0,10) + '</div></div></div>').join('') :
                '<p style="text-align:center;color:var(--color-text-secondary);padding:12px;">스탬프를 추가해 보세요!</p>') +
            '<button class="btn btn-outline btn-full" style="margin-top:10px;" onclick="showMilestoneForm()">+ 스탬프 추가</button></div>';

        c.innerHTML = stampHtml + summaryHtml + msHtml;
        if (typeof enhanceIcons3d === 'function') enhanceIcons3d(c);
    } catch(e) {
        c.innerHTML = '<div style="text-align:center;padding:30px;"><p style="color:var(--color-danger);font-size:13px;">' + e.message + '</p></div>';
    }
}

// 검진/접종 탭 (MamiTalk 스타일)
async function renderRsCheckup(babyId) {
    const c = document.getElementById('rs-content');
    c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
        const res = await fetch(API + '/api/vaccinations?baby_id=' + babyId, { headers: authHeaders() });
        const items = res.ok ? await res.json() : [];
        const scheduled = items.filter(v => v.status === 'scheduled').sort((a,b) => a.scheduled_date > b.scheduled_date ? 1 : -1);
        const completed = items.filter(v => v.status === 'completed');
        c.innerHTML =
            '<div class="card" style="margin-bottom:12px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
            '<div class="card-title">💉 예방접종 / 건강검진</div>' +
            '<button class="btn btn-sm btn-primary" onclick="showVaccinationForm()">+ 추가</button></div>' +
            (scheduled.length > 0 ?
                '<div style="margin-bottom:8px;font-size:12px;font-weight:700;color:var(--color-primary);">⏰ 예정 (' + scheduled.length + '건)</div>' +
                scheduled.map(v =>
                    '<div class="record-item"><div class="record-icon" style="background:var(--color-orange-light);">💉</div>' +
                    '<div class="record-info"><div class="record-title">' + v.name + ' <span class="tag tag-blue">예정</span></div>' +
                    '<div class="record-meta">예정일: ' + (v.scheduled_date||'').slice(0,10) + '</div></div>' +
                    '<button class="btn btn-sm btn-success" onclick="completeVaccination(\'' + v.id + '\')">완료</button></div>').join('') : '') +
            (completed.length > 0 ?
                '<div style="margin-top:10px;margin-bottom:8px;font-size:12px;font-weight:700;color:#065F46;">✅ 완료 (' + completed.length + '건)</div>' +
                completed.map(v =>
                    '<div class="record-item"><div class="record-icon" style="background:var(--color-secondary-light);">✅</div>' +
                    '<div class="record-info"><div class="record-title">' + v.name + ' <span class="tag tag-green">완료</span></div>' +
                    '<div class="record-meta">접종일: ' + (v.actual_date||v.scheduled_date||'').slice(0,10) + '</div></div></div>').join('') : '') +
            (items.length === 0 ? '<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">등록된 접종이 없습니다</p>' : '') +
            '</div>';
    } catch(e) {
        c.innerHTML = '<p style="text-align:center;padding:30px;color:var(--color-danger);">' + e.message + '</p>';
    }
}

// ============================================================
// 수유
// ============================================================
function showFeedingPage() {
    document.getElementById('main-content').innerHTML =
        '<div class="section-title">🍼 수유 기록</div>' +
        '<div class="toggle-group"><button class="toggle-btn active" id="type-breast" onclick="setFeedingType(\'breast\')">모유 수유</button><button class="toggle-btn" id="type-formula" onclick="setFeedingType(\'formula\')">분유 수유</button></div>' +
        '<div class="card"><div class="timer-display"><div class="timer-time" id="timer-display">00:00</div><div class="timer-label">수유 타이머</div></div>' +
        '<div class="form-group"><label class="form-label">분량 (ml)</label><input class="form-input" type="number" id="feeding-amount" value="0" placeholder="120"></div>' +
        '<div class="timer-buttons"><button class="btn btn-start" onclick="startFeedingTimer()">시작</button><button class="btn btn-stop" onclick="stopFeedingTimer()">종료</button></div></div>' +
        '<div class="section-header"><span class="section-title">수유 기록</span></div>' +
        '<div class="card" id="feedings-list"><div class="loading">로딩중...</div></div>';
    loadFeedings();
}
let feedingType = 'breast';
function setFeedingType(type) { feedingType = type; document.querySelectorAll('#type-breast, #type-formula').forEach(b => b.classList.remove('active')); document.getElementById('type-'+type).classList.add('active'); }
function startFeedingTimer() {
    feedTimerSeconds = 0; if (feedTimerInterval) clearInterval(feedTimerInterval);
    feedTimerInterval = setInterval(() => { feedTimerSeconds++; const m=String(Math.floor(feedTimerSeconds/60)).padStart(2,'0'); const s=String(feedTimerSeconds%60).padStart(2,'0'); const el=document.getElementById('timer-display'); if(el) el.textContent=m+':'+s; }, 1000);
    showToast('타이머 시작! ⏱️', 'success');
}
async function stopFeedingTimer() {
    if (feedTimerInterval) clearInterval(feedTimerInterval);
    const babyId = await getDefaultBabyId(); if (!babyId) { showToast('아기를 먼저 등록해주세요', 'error'); return; }
    const amt = parseFloat(document.getElementById('feeding-amount').value) || 0;
    await fetch(API+'/api/feedings', { method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'}, body:JSON.stringify({baby_id:babyId,type:feedingType,amount_ml:amt,notes:'타이머 '+Math.floor(feedTimerSeconds/60)+'분 '+(feedTimerSeconds%60)+'초'}) });
    showToast('수유 기록 완료! ✅', 'success'); loadFeedings();
}
async function loadFeedings() {
    const babyId = currentBabyId || await getDefaultBabyId(); if (!babyId) return;
    try {
        const res = await fetch(API+'/api/feedings?baby_id='+babyId+'&days=7', { headers: authHeaders() });
        const items = await res.json();
        const container = document.getElementById('feedings-list'); if (!container) return;
        container.innerHTML = items.length === 0 ?
            '<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">오늘 기록된 수유가 없습니다</p>' :
            items.map(f => '<div class="record-item"><div class="record-icon" style="background:'+(f.type==='breast'?'var(--color-secondary-light)':'var(--color-primary-light)')+';font-size:20px;">'+(f.type==='breast'?'🤱':'🍼')+'</div><div class="record-info"><div class="record-title">'+(f.type==='breast'?'모유 수유':'분유 수유')+' · '+f.amount_ml+'ml</div><div class="record-meta">⏱ '+(f.duration_min?.toFixed(0)||'--')+'분</div></div><div class="record-time">'+(f.start_time||'').slice(11,16)+'</div></div>').join('');
    } catch (e) {}
}

// ============================================================
// 수면
// ============================================================
function showSleepPage() {
    document.getElementById('main-content').innerHTML =
        '<div class="section-title">😴 수면 기록</div>' +
        '<div class="card"><div class="form-group"><label class="form-label">수면 질</label>' +
        '<div class="toggle-group"><button class="toggle-btn" onclick="setSleepQuality(this,\'good\')">😴 잘 잤음</button><button class="toggle-btn active" onclick="setSleepQuality(this,\'normal\')">🙂 보통</button><button class="toggle-btn" onclick="setSleepQuality(this,\'poor\')">😣 잘 못 잤음</button></div></div>' +
        '<button class="btn btn-primary btn-full" onclick="recordSleep()">수면 기록하기</button></div>' +
        '<div class="section-header"><span class="section-title">최근 수면 기록</span></div>' +
        '<div class="card" id="sleeps-list"></div>';
    loadSleeps();
}
let sleepQuality = 'normal';
function setSleepQuality(el, q) { el.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active')); el.classList.add('active'); sleepQuality = q; }
async function recordSleep() {
    const babyId = await getDefaultBabyId(); if (!babyId) return;
    await fetch(API+'/api/sleeps', { method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'}, body:JSON.stringify({baby_id:babyId,quality:sleepQuality}) });
    showToast('수면 기록 완료! 😴', 'success'); loadSleeps();
}
async function loadSleeps() {
    const babyId = currentBabyId || await getDefaultBabyId(); if (!babyId) return;
    try {
        const res = await fetch(API+'/api/sleeps?baby_id='+babyId+'&days=7', { headers: authHeaders() });
        const items = await res.json();
        const container = document.getElementById('sleeps-list'); if (!container) return;
        container.innerHTML = items.map(s => '<div class="record-item"><div class="record-icon" style="background:var(--color-primary-light);">😴</div><div class="record-info"><div class="record-title">'+(s.quality==='good'?'잘 잤음':s.quality==='poor'?'잘 못 잤음':'보통')+'</div><div class="record-meta">⏱ '+(s.duration_min?.toFixed(0)||'--')+'분</div></div><div class="record-time">'+(s.start_time||'').slice(11,16)+'</div></div>').join('') || '<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">기록 없음</p>';
    } catch (e) {}
}

// ============================================================
// 대변
// ============================================================
function showBowelLogPage() {
    const main = document.getElementById('main-content');
    main.innerHTML =
        '<div class="section-title section-title-with-icon"><span data-icon="stool" data-icon-size="24"></span> 대변 기록</div><div class="card">' +
        '<div class="form-group"><label class="form-label">유형</label><div class="toggle-group"><button class="toggle-btn active" onclick="selectBowelType(this,\'normal\')">보통</button><button class="toggle-btn" onclick="selectBowelType(this,\'diarrhea\')">설사</button><button class="toggle-btn" onclick="selectBowelType(this,\'constipation\')">변비</button></div></div>' +
        '<div class="form-group"><label class="form-label">색깔</label><div class="toggle-group"><button class="toggle-btn active" onclick="selectBowelColor(this,\'yellow\')">노란색</button><button class="toggle-btn" onclick="selectBowelColor(this,\'brown\')">갈색</button><button class="toggle-btn" onclick="selectBowelColor(this,\'green\')">초록색</button></div></div>' +
        '<button class="btn btn-primary btn-full btn-with-icon" onclick="recordBowel()"><span data-icon="stool" data-icon-size="18"></span> 대변 기록</button></div>' +
        '<div class="section-header"><span class="section-title">최근 대변 기록</span></div>' +
        '<div class="card" id="bowels-list"></div>';
    if (typeof enhanceIcons3d === 'function') enhanceIcons3d(main);
    loadBowels();
}
let bowelType='normal', bowelColor='yellow';
function selectBowelType(el,t){el.parentElement.querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');bowelType=t;}
function selectBowelColor(el,c){el.parentElement.querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');bowelColor=c;}
async function recordBowel(){
    const babyId=await getDefaultBabyId();if(!babyId)return;
    await fetch(API+'/api/bowels/quick?baby_id='+babyId+'&type='+bowelType+'&color='+bowelColor,{method:'POST',headers:authHeaders()});
    showToast('대변 기록 완료!','success');loadBowels();
}
async function loadBowels(){
    const babyId=currentBabyId||await getDefaultBabyId();if(!babyId)return;
    const container=document.getElementById('bowels-list');
    try{
        const res=await fetch(API+'/api/bowels?baby_id='+babyId+'&days=7',{headers:authHeaders()});
        if(!res.ok){if(container)container.innerHTML='<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">기록 없음</p>';return;}
        const items=await res.json();
        if(container) container.innerHTML=items.map(b=>'<div class="record-item"><div class="record-icon record-icon-3d" data-icon="stool" data-icon-size="28" style="background:#FEF3C7;"></div><div class="record-info"><div class="record-title">'+(b.type||'보통')+' · '+(b.color||'노란색')+'</div><div class="record-meta">'+(b.recorded_at||'').slice(0,16)+'</div></div></div>').join('')||'<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">기록 없음</p>';
        if (typeof enhanceIcons3d === 'function') enhanceIcons3d(container);
    }catch(e){if(container)container.innerHTML='<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">기록 없음</p>';}
}

// ============================================================
// 성장 기록 & WHO 곡선
// ============================================================
function showGrowthPage() {
    document.getElementById('main-content').innerHTML =
        '<div class="section-title">📏 성장 기록</div>' +
        '<div class="card"><div class="card-title" style="margin-bottom:12px;">새 측정 입력</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">' +
        '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">체중(kg)</label><input class="form-input" id="growth-weight" type="number" step="0.1" placeholder="9.5" style="padding:10px 8px;font-size:14px;"></div>' +
        '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">키(cm)</label><input class="form-input" id="growth-height" type="number" step="0.1" placeholder="75.5" style="padding:10px 8px;font-size:14px;"></div>' +
        '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:11px;">두위(cm)</label><input class="form-input" id="growth-head" type="number" step="0.1" placeholder="46.5" style="padding:10px 8px;font-size:14px;"></div>' +
        '</div><button class="btn btn-primary btn-full" onclick="recordGrowth()">측정 기록하기</button></div>' +
        '<div id="who-compare-section"><div class="loading"><div class="spinner"></div></div></div>';
    loadGrowthCompare();
}
async function recordGrowth() {
    const babyId = await getDefaultBabyId(); if (!babyId) return;
    const w=parseFloat(document.getElementById('growth-weight').value)||null;
    const h=parseFloat(document.getElementById('growth-height').value)||null;
    const hc=parseFloat(document.getElementById('growth-head').value)||null;
    if (!w && !h) { showToast('체중 또는 키를 입력하세요', 'error'); return; }
    await fetch(API+'/api/growths', { method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'}, body:JSON.stringify({baby_id:babyId,weight_kg:w,height_cm:h,head_circumference_cm:hc}) });
    showToast('성장 기록 완료! 📏', 'success'); loadGrowthCompare();
}
function growthWhoIndex(data, month) {
    const months = data.who_months || [];
    for (var i = 0; i < months.length; i++) {
        if (months[i] === month) return i;
    }
    return Math.min(month, Math.max((data.who_ref?.weight?.p50?.length || 1) - 1, 0));
}

function formatGrowthPct(pct) {
    if (pct == null || isNaN(pct)) return null;
    return Math.round(pct) + '%';
}

function growthP50Value(data, metric, month) {
    const whoRef = data.who_ref?.[metric];
    if (!whoRef || !whoRef.p50) return null;
    return whoRef.p50[growthWhoIndex(data, month)];
}

function growthPctBadgeHtml(metric, data) {
    const isWeight = metric === 'weight';
    const pct = isWeight ? data.latest?.weight_pct : data.latest?.height_pct;
    const pctStr = formatGrowthPct(pct);
    if (pctStr == null) return '';
    const p50val = growthP50Value(data, metric, data.baby?.age_months ?? 0);
    const unit = isWeight ? 'kg' : 'cm';
    const records = data.records || [];
    const last = records[records.length - 1];
    const val = isWeight ? last?.weight_kg : last?.height_cm;
    const warn = pct < 15 || pct > 85;
    const bg = isWeight
        ? (warn ? 'var(--color-warning-light)' : 'var(--color-secondary-light)')
        : (warn ? 'var(--color-warning-light)' : 'var(--color-accent-light)');
    const color = warn ? '#92400E' : (isWeight ? 'var(--color-secondary-dark)' : 'var(--color-accent-dark)');
    const peerLine = p50val != null
        ? '<div class="pct-badge-peer">또래 P50 <strong>' + p50val.toFixed(1) + unit + '</strong></div>'
        : '';
    const valLine = val != null ? '<div class="pct-badge-baby">' + val + unit + '</div>' : '';
    return '<div class="pct-badge" style="background:' + bg + ';">' +
        '<div class="pct-badge-value" style="color:' + color + ';">' + pctStr + '</div>' +
        valLine + peerLine +
        '<div class="pct-badge-label">' + (isWeight ? '체중' : '키') + '</div></div>';
}

function growthChartCompareHtml(data, metric, latest, whoRef) {
    if (!latest || !whoRef) return '';
    const val = metric === 'weight' ? latest.weight_kg : latest.height_cm;
    if (val == null) return '';
    const pct = metric === 'weight' ? latest.weight_pct : latest.height_pct;
    const pctStr = formatGrowthPct(pct);
    const unit = metric === 'weight' ? 'kg' : 'cm';
    const p50val = whoRef.p50[growthWhoIndex(data, latest.month)];
    const diff = (val - p50val).toFixed(1);
    const diffBg = Math.abs(parseFloat(diff)) < 0.5 ? 'var(--color-secondary-light)' : 'var(--color-warning-light)';
    const diffCol = parseFloat(diff) >= 0 ? 'var(--color-secondary-dark)' : '#92400E';
    return '<div class="growth-compare-row">' +
        '<div class="growth-compare-cell growth-compare-baby">' +
        '<div class="growth-compare-value">' + val + unit + '</div>' +
        (pctStr ? '<div class="growth-compare-pct">' + pctStr + '</div>' : '') +
        '<div class="growth-compare-label">우리 아이</div></div>' +
        '<div class="growth-compare-cell growth-compare-peer">' +
        '<div class="growth-compare-value">' + p50val.toFixed(1) + unit + '</div>' +
        '<div class="growth-compare-pct">P50</div>' +
        '<div class="growth-compare-label">또래 평균</div></div>' +
        '<div class="growth-compare-cell growth-compare-diff" style="background:' + diffBg + ';">' +
        '<div class="growth-compare-value" style="color:' + diffCol + ';">' + (parseFloat(diff) >= 0 ? '+' : '') + diff + unit + '</div>' +
        '<div class="growth-compare-label">평균 대비</div></div></div>';
}

async function loadGrowthCompare() {
    const babyId = currentBabyId || await getDefaultBabyId(); if (!babyId) return;
    const section = document.getElementById('who-compare-section'); if (!section) return;
    try {
        const res = await fetch(API+'/api/growth/compare/'+babyId, { headers: authHeaders() });
        const data = await res.json();
        if (!data.records) { section.innerHTML = '<p style="text-align:center;padding:20px;color:var(--color-text-secondary);">성장 기록 없음</p>'; return; }
        const commentHtml = (data.comments||[]).map(cm => '<div class="growth-comment '+cm.level+'"><span class="growth-comment-icon">'+cm.icon+'</span><span class="growth-comment-text">'+cm.text+'</span></div>').join('');
        const badgeHtml = '<div class="growth-pct-badges">' +
            growthPctBadgeHtml('weight', data) +
            growthPctBadgeHtml('height', data) +
            '<div class="pct-badge pct-badge-age"><div class="pct-badge-value" style="color:var(--color-text);">' + data.baby?.age_months + '개월</div><div class="pct-badge-label">현재 나이</div></div></div>';
        section.innerHTML =
            '<div class="card" style="padding:14px;"><div class="card-title" style="margin-bottom:10px;">WHO 성장 곡선 비교</div>'+badgeHtml+commentHtml+'</div>' +
            '<div class="card" id="growth-svg-weight" style="padding:12px 8px;overflow:hidden;"></div>' +
            '<div class="card" id="growth-svg-height" style="padding:12px 8px;overflow:hidden;margin-top:4px;"></div>' +
            '<div class="card"><div class="card-title" style="margin-bottom:10px;">측정 기록</div><div id="growths-list"></div></div>';
        window._growthData = data;
        drawGrowthChartTo(data,'weight','growth-svg-weight');
        drawGrowthChartTo(data,'height','growth-svg-height');
        renderGrowthList(data.records);
    } catch(e) { section.innerHTML='<p style="text-align:center;padding:20px;color:var(--color-text-secondary);">데이터를 불러올 수 없습니다</p>'; }
}
function drawGrowthChartTo(data,metric,containerId){
    const orig=document.getElementById('growth-svg-container');
    // 임시로 컨테이너 id를 교체해서 기존 drawGrowthChart 재사용
    const target=document.getElementById(containerId); if(!target)return;
    target.id='growth-svg-container';
    drawGrowthChart(data,metric);
    target.id=containerId;
}
function switchGrowthChart(metric,el){}
function drawGrowthChart(data,metric){
    const container=document.getElementById('growth-svg-container');if(!container)return;
    const whoRef=data.who_ref[metric],months=data.who_months;
    const records=data.records.filter(r=>r[metric==='weight'?'weight_kg':'height_cm']!==null);
    if(!whoRef||months.length===0){container.innerHTML='<p style="color:var(--color-text-secondary);text-align:center;padding:20px;">데이터 없음</p>';return;}
    const VW=320,VH=200,PL=34,PR=10,PT=10,PB=28,W=VW-PL-PR,H=VH-PT-PB;
    const xMax=Math.max(...months);
    const allVals=[...whoRef.p3,...whoRef.p97,...records.map(r=>metric==='weight'?r.weight_kg:r.height_cm).filter(Boolean)];
    const yMin=Math.min(...allVals)*0.97,yMax=Math.max(...allVals)*1.02;
    const xS=m=>PL+(m/xMax)*W, yS=v=>PT+H-((v-yMin)/(yMax-yMin))*H;
    const pathFor=(key,color,width,dash)=>{const pts=months.map((m,i)=>xS(m).toFixed(1)+','+yS(whoRef[key][i]).toFixed(1)).join(' ');return'<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" stroke-dasharray="'+(dash||'')+'"/>';};
    const p15pts=months.map((m,i)=>xS(m).toFixed(1)+','+yS(whoRef.p15[i]).toFixed(1)).join(' ');
    const p85pts=[...months].reverse().map((m,i)=>xS(m).toFixed(1)+','+yS(whoRef.p85[months.length-1-i]).toFixed(1)).join(' ');
    const babyPts=records.map(r=>{const val=metric==='weight'?r.weight_kg:r.height_cm;return xS(r.month).toFixed(1)+','+yS(val).toFixed(1);}).join(' ');
    let yTicks='';for(let i=0;i<=5;i++){const v=yMin+(yMax-yMin)*i/5,y=yS(v);yTicks+='<line x1="'+PL+'" y1="'+y.toFixed(1)+'" x2="'+(PL+W)+'" y2="'+y.toFixed(1)+'" stroke="#F3F4F6" stroke-width="1"/><text x="'+(PL-3)+'" y="'+(y+3.5).toFixed(1)+'" font-size="7" fill="#9CA3AF" text-anchor="end">'+(metric==='weight'?v.toFixed(1):v.toFixed(0))+'</text>';}
    let xTicks='';const xStep=xMax<=12?3:6;for(let m=0;m<=xMax;m+=xStep){xTicks+='<text x="'+xS(m).toFixed(1)+'" y="'+(PT+H+16).toFixed(1)+'" font-size="7" fill="#9CA3AF" text-anchor="middle">'+m+'m</text>';}
    const curX=xS(Math.min(data.baby.age_months,xMax));
    const dots=records.map(r=>{const val=metric==='weight'?r.weight_kg:r.height_cm;return'<circle cx="'+xS(r.month).toFixed(1)+'" cy="'+yS(val).toFixed(1)+'" r="3.5" fill="#FF6B9D" stroke="white" stroke-width="1.5"><title>'+r.month+'개월: '+val+(metric==='weight'?'kg':'cm')+'</title></circle>';}).join('');
    const svg='<svg viewBox="0 0 '+VW+' '+VH+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:100%;">'+yTicks+'<polygon points="'+p15pts+' '+p85pts+'" fill="#A78BFA" opacity="0.08"/>'+pathFor('p3','#D1D5DB',1,'3,2')+pathFor('p15','#A78BFA',1,'')+pathFor('p50','#6B7280',1.5,'')+pathFor('p85','#A78BFA',1,'')+pathFor('p97','#D1D5DB',1,'3,2')+(records.length>1?'<polyline points="'+babyPts+'" fill="none" stroke="#FF6B9D" stroke-width="2"/>':'')+dots+'<line x1="'+curX.toFixed(1)+'" y1="'+PT+'" x2="'+curX.toFixed(1)+'" y2="'+(PT+H)+'" stroke="#FF6B9D" stroke-width="1.5" stroke-dasharray="3,2"/><text x="'+curX.toFixed(1)+'" y="'+(PT-2)+'" font-size="7" fill="#FF6B9D" text-anchor="middle">현재</text><line x1="'+PL+'" y1="'+PT+'" x2="'+PL+'" y2="'+(PT+H)+'" stroke="#E5E7EB" stroke-width="1"/><line x1="'+PL+'" y1="'+(PT+H)+'" x2="'+(PL+W)+'" y2="'+(PT+H)+'" stroke="#E5E7EB" stroke-width="1"/>'+xTicks+'</svg>';
    const latest=records[records.length-1];
    const compareHtml = growthChartCompareHtml(data, metric, latest, whoRef);
    const chartTitle = metric === 'weight' ? '체중 곡선' : '키 곡선';
    container.innerHTML = '<div class="growth-chart-title">' + chartTitle + '</div>' + svg + compareHtml;
}
function renderGrowthList(records){
    const container=document.getElementById('growths-list');if(!container)return;
    const data = window._growthData;
    container.innerHTML=[...records].reverse().map(function(g){
        var meta = g.month + '개월 · ' + (g.date || '').slice(0, 10);
        if (g.weight_pct != null && data) {
            var wP50 = growthP50Value(data, 'weight', g.month);
            meta += ' · 체중 <b style="color:var(--color-primary);">' + formatGrowthPct(g.weight_pct) + '</b>';
            if (wP50 != null) meta += ' · 또래P50 <b>' + wP50.toFixed(1) + 'kg</b>';
        }
        if (g.height_pct != null && data) {
            var hP50 = growthP50Value(data, 'height', g.month);
            meta += ' · 키 <b style="color:var(--color-accent-dark);">' + formatGrowthPct(g.height_pct) + '</b>';
            if (hP50 != null) meta += ' · 또래P50 <b>' + hP50.toFixed(1) + 'cm</b>';
        }
        return '<div class="record-item"><div class="record-icon" style="background:var(--color-secondary-light);">📏</div><div class="record-info"><div class="record-title">' +
            (g.weight_kg ? g.weight_kg + 'kg' : '') + ' ' + (g.height_cm ? '· ' + g.height_cm + 'cm' : '') + ' ' + (g.head_cm ? '· 두위 ' + g.head_cm + 'cm' : '') +
            '</div><div class="record-meta">' + meta + '</div></div></div>';
    }).join('')||'<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">기록 없음</p>';
}

// ============================================================
// 예방접종
// ============================================================
function showVaccinationPage(){document.getElementById('main-content').innerHTML='<div class="section-title">💉 예방접종 관리</div><button class="btn btn-outline" style="margin-bottom:12px;" onclick="showVaccinationForm()">접종 등록하기</button><div class="card" id="vaccinations-list"></div>';loadVaccinations();}
function showVaccinationForm(){document.getElementById('main-content').innerHTML='<div class="section-title">💉 접종 등록</div><div class="card"><div class="form-group"><label class="form-label">접종 이름</label><input class="form-input" id="vac-name" placeholder="B형간염 1차"></div><div class="form-group"><label class="form-label">예정일</label><input class="form-input" id="vac-date" type="date"></div><div class="form-group"><label class="form-label">병원</label><input class="form-input" id="vac-clinic" placeholder="서울아산병원"></div><button class="btn btn-primary btn-full" onclick="createVaccination()">등록하기</button><button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="showVaccinationPage()">취소</button></div>';}
async function createVaccination(){const babyId=await getDefaultBabyId();if(!babyId)return;await fetch(API+'/api/vaccinations',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({baby_id:babyId,name:document.getElementById('vac-name').value,scheduled_date:document.getElementById('vac-date').value,clinic:document.getElementById('vac-clinic').value})});showToast('예방접종 등록 완료! 💉','success');showVaccinationPage();}
async function loadVaccinations(){const babyId=currentBabyId||await getDefaultBabyId();if(!babyId)return;try{const res=await fetch(API+'/api/vaccinations?baby_id='+babyId,{headers:authHeaders()});const items=await res.json();const container=document.getElementById('vaccinations-list');if(!container)return;container.innerHTML=items.map(v=>'<div class="record-item"><div class="record-icon" style="background:var(--color-orange-light);">💉</div><div class="record-info"><div class="record-title">'+v.name+' '+(v.status==='completed'?'<span class="tag tag-green">완료</span>':'<span class="tag tag-blue">예정</span>')+'</div><div class="record-meta">'+(v.status==='completed'?'접종일: '+(v.actual_date||'').slice(0,10):'예정: '+(v.scheduled_date||'').slice(0,10))+'</div></div>'+(v.status==='scheduled'?'<button class="btn btn-sm btn-success" onclick="completeVaccination(\''+v.id+'\')">완료</button>':'')+'</div>').join('')||'<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">등록된 접종이 없습니다</p>';}catch(e){}}
async function completeVaccination(id){await fetch(API+'/api/vaccinations/'+id+'/complete',{method:'POST',headers:authHeaders()});showToast('접종 완료! ✅','success');showVaccinationPage();}

// ============================================================
// 성장 스탬프 (마일스톤)
// ============================================================
function showMilestonePage(){document.getElementById('main-content').innerHTML='<div class="section-title">⭐ 성장 스탬프</div><button class="btn btn-outline" style="margin-bottom:12px;" onclick="showMilestoneForm()">스탬프 추가</button><div class="card" id="milestone-list"></div>';loadMilestonesList();}
function showMilestoneForm(){document.getElementById('main-content').innerHTML='<div class="section-title">⭐ 스탬프 추가</div><div class="card"><div class="form-group"><label class="form-label">카테고리</label><div class="toggle-group"><button class="toggle-btn active" onclick="selectMilestoneCat(this,\'motor\')">🏃 운동</button><button class="toggle-btn" onclick="selectMilestoneCat(this,\'language\')">🗣️ 언어</button><button class="toggle-btn" onclick="selectMilestoneCat(this,\'social\')">😊 사회</button><button class="toggle-btn" onclick="selectMilestoneCat(this,\'cognitive\')">🧠 인지</button></div></div><div class="form-group"><label class="form-label">내용</label><input class="form-input" id="ms-desc" placeholder="고개 들기"></div><button class="btn btn-primary btn-full" onclick="createMilestone()">기록하기</button><button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="showMilestonePage()">취소</button></div>';}
let milestoneCategory='motor';
function selectMilestoneCat(el,cat){el.parentElement.querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');milestoneCategory=cat;}
async function createMilestone(){const babyId=await getDefaultBabyId();if(!babyId)return;await fetch(API+'/api/milestones',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({baby_id:babyId,category:milestoneCategory,description:document.getElementById('ms-desc').value})});showToast('스탬프 기록 완료! ⭐','success');showMilestonePage();}
async function loadMilestonesList(){const babyId=currentBabyId||await getDefaultBabyId();if(!babyId)return;try{const res=await fetch(API+'/api/milestones?baby_id='+babyId,{headers:authHeaders()});const items=await res.json();const container=document.getElementById('milestone-list');if(!container)return;const icons={motor:'motor',language:'language',social:'social',cognitive:'cognitive'};container.innerHTML=items.map(m=>'<div class="record-item"><div class="record-icon" data-icon="'+(icons[m.category]||'milestone')+'" data-icon-size="28"></div><div class="record-info"><div class="record-title">'+m.description+'</div><div class="record-meta">'+m.category+' · '+(m.achieved_date||'').slice(0,10)+'</div></div></div>').join('')||'<p style="text-align:center;color:var(--color-text-secondary);padding:20px;">기록 없음</p>';if(typeof enhanceIcons3d==='function')enhanceIcons3d(container);}catch(e){}}

// ============================================================
// 추억 & 공유 통합 페이지
// ============================================================
// ============================================================
// 추억 & 공유 — 목적 중심 3카드 구조
// ============================================================
function showMemoriesPage() {
    const main = document.getElementById('main-content');
    main.innerHTML =
        '<div class="hub-page">' +
        hubPageHeader('추억 & 공유', '소중한 순간을 가족과 함께') +
        '<div class="hub-mem-grid">' +
        _memCard('👨‍👩‍👧', '가족공유', 'FamilyAlbum', 'showFamilySharePage()') +
        _memCard('🎬', '성장앨범', '영상 제작', 'showGrowthAlbumPage()') +
        _memCard('🎨', 'AI 사진', '자동 생성', 'showAIPhotoPage()') +
        '</div>' +
        '<div id="mem-section-content"></div></div>';
    showFamilySharePage();
}
function _memCard(icon, title, sub, onclick) {
    return '<div class="hub-mem-tile" onclick="' + onclick + '">' +
        '<div class="hub-mem-tile-icon">' + icon + '</div>' +
        '<div class="hub-mem-tile-title">' + title + '</div>' +
        '<div class="hub-mem-tile-sub">' + sub + '</div></div>';
}
function _setActiveMemCard(idx) {
    const cards = document.querySelectorAll('#main-content [onclick]');
    // 상단 3카드 강조는 border로 표현
}

// ── 1. 가족 공유 (FamilyAlbum 스타일) ─────────────────────────
function showFamilySharePage() {
    const c = document.getElementById('mem-section-content'); if (!c) return;
    c.innerHTML =
        sectionCard(
        '<div class="mem-album-head">' +
        '<div class="hub-card-title">우리 가족 앨범</div>' +
        '<button type="button" class="btn btn-sm btn-primary" onclick="showPhotoUpload()">사진 추가</button></div>' +
        '<div id="family-member-row" class="hub-member-row mem-member-compact">' +
        '<div class="hub-avatar" style="background:#FFE4E8;">👩</div>' +
        '<div class="hub-avatar" style="background:#E4EEFF;">👨</div>' +
        '<div class="hub-avatar" style="background:#E4FFE8;">👴</div>' +
        '<div style="margin-left:4px;min-width:0;"><div class="mem-member-label">가족과 함께 보는 중</div>' +
        '<div class="mem-member-sub" id="family-member-count">구성원 확인 중…</div></div></div>' +
        '<div id="photos-grid" class="mem-photos-grid">' +
        '<div class="mem-photo-add" onclick="showPhotoUpload()">+</div></div>' +
        '<p class="mem-photo-hint">촬영일 기준 D+N이 왼쪽 상단에 표시됩니다. 탭하여 수정할 수 있어요.</p>' +
        '<button type="button" class="mem-more-btn" id="mem-invite-toggle" onclick="toggleMemInvite()" aria-expanded="false">' +
        '<span>가족 초대 · 링크 공유</span><span class="mem-more-chevron" aria-hidden="true">▼</span></button>' +
        '<div id="mem-invite-panel" class="mem-invite-panel" hidden>' +
        '<p class="mem-invite-desc">초대 링크는 자주 쓰지 않아도 됩니다. 필요할 때 펼쳐서 공유하세요.</p>' +
        '<div class="hub-invite-box">' +
        '<div><div class="mem-invite-label">초대 코드</div>' +
        '<div id="family-code-display" class="hub-code">불러오는 중…</div></div>' +
        '<button type="button" class="btn btn-sm btn-primary" onclick="createAndCopyFamily()">링크 복사</button></div></div>'
        ) +
        '<div id="photo-edit-modal" class="photo-edit-modal" hidden></div>';
    loadFamilyCode();
    loadPhotosGrid();
}

function toggleMemInvite() {
    const panel = document.getElementById('mem-invite-panel');
    const btn = document.getElementById('mem-invite-toggle');
    if (!panel || !btn) return;
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.classList.toggle('mem-more-btn-open', open);
}

async function loadFamilyCode() {
    const babyId = currentBabyId || await getDefaultBabyId();
    if (!babyId) return;
    try {
        const res = await fetch(API + '/api/family/code?baby_id=' + babyId, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (data.family_code) currentFamilyCode = data.family_code;
        const el = document.getElementById('family-code-display');
        if (el) el.textContent = data.family_code || '아직 없음';
        const cnt = document.getElementById('family-member-count');
        if (cnt) cnt.textContent = (data.member_count || 0) + '명 참여 중';
    } catch (e) {}
}

let _memPhotosCache = [];

function photoTakenDateInputValue(iso) {
    if (!iso) return new Date().toISOString().slice(0, 10);
    return iso.slice(0, 10);
}

async function loadPhotosGrid() {
    const babyId = currentBabyId || await getDefaultBabyId(); if (!babyId) return;
    try {
        const res = await fetch(API+'/api/photos/'+babyId, {headers:authHeaders()});
        if (!res.ok) return;
        const items = await res.json();
        _memPhotosCache = items;
        const container = document.getElementById('photos-grid'); if (!container) return;
        const cells = items.map(function (p) {
            const thumb = p.thumbnail_url || p.file_url;
            const label = p.day_label || '';
            return '<button type="button" class="mem-photo-cell" onclick="openPhotoEdit(\'' + p.id + '\')">' +
                (label ? '<span class="mem-photo-day">' + label + '</span>' : '') +
                (thumb ? '<img src="' + thumb + '" alt="" loading="lazy">' : '<span class="mem-photo-placeholder">📷</span>') +
                '</button>';
        }).join('');
        container.innerHTML = cells +
            '<button type="button" class="mem-photo-add" onclick="showPhotoUpload()">+</button>';
    } catch(e) {}
}

function openPhotoEdit(photoId) {
    const p = _memPhotosCache.find(function (x) { return x.id === photoId; });
    if (!p) return;
    const takenDate = photoTakenDateInputValue(p.taken_date || p.date);
    const caption = (p.caption || '').replace(/"/g, '&quot;');
    const modal = document.getElementById('photo-edit-modal');
    if (!modal) return;
    modal.hidden = false;
    modal.innerHTML =
        '<div class="photo-edit-backdrop" onclick="closePhotoEdit()"></div>' +
        '<div class="photo-edit-sheet" role="dialog" aria-label="사진 정보 수정">' +
        '<div class="photo-edit-title">사진 정보 수정</div>' +
        '<p class="photo-edit-note">업로드일과 촬영일이 다를 수 있어요. D+N은 촬영일 기준입니다.</p>' +
        (p.day_label ? '<p class="photo-edit-day-preview">현재 라벨: <strong>' + p.day_label + '</strong></p>' : '') +
        '<div class="form-group"><label class="form-label">촬영일</label>' +
        '<input class="form-input" type="date" id="photo-edit-date" value="' + takenDate + '"></div>' +
        '<div class="form-group"><label class="form-label">메모</label>' +
        '<input class="form-input" id="photo-edit-caption" value="' + caption + '"></div>' +
        '<button type="button" class="btn btn-primary btn-full" onclick="savePhotoEdit(\'' + photoId + '\')">저장</button>' +
        '<button type="button" class="btn btn-outline btn-full" style="margin-top:8px;" onclick="closePhotoEdit()">닫기</button></div>';
}

function closePhotoEdit() {
    const modal = document.getElementById('photo-edit-modal');
    if (modal) { modal.hidden = true; modal.innerHTML = ''; }
}

async function savePhotoEdit(photoId) {
    const taken = document.getElementById('photo-edit-date')?.value;
    const caption = document.getElementById('photo-edit-caption')?.value ?? '';
    try {
        const res = await fetch(API + '/api/photos/' + photoId, {
            method: 'PATCH',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ taken_date: taken, caption: caption }),
        });
        if (!res.ok) throw new Error('저장 실패');
        showToast('사진 정보가 저장됐어요', 'success');
        closePhotoEdit();
        loadPhotosGrid();
    } catch (e) {
        showToast('저장에 실패했어요', 'error');
    }
}

async function createAndCopyFamily() {
    const babyId = currentBabyId || await getDefaultBabyId();
    if (!babyId) return;
    try {
        const res = await fetch(API + '/api/family/code?baby_id=' + babyId, { method: 'POST', headers: authHeaders() });
        const data = await res.json();
        const code = data.family_code;
        currentFamilyCode = code;
        const el = document.getElementById('family-code-display');
        if (el) el.textContent = code;
        const text = data.invite_url || ('우리 아이 앨범 초대: ' + code);
        await navigator.clipboard.writeText(text);
        showToast('초대 링크가 복사됐어요', 'success');
        const panel = document.getElementById('mem-invite-panel');
        if (panel && panel.hidden) toggleMemInvite();
    } catch (e) {
        showToast('링크 복사에 실패했어요', 'error');
    }
}

function showPhotoUpload() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('main-content').innerHTML =
        '<div class="hub-page">' + hubPageHeader('사진 추가', '추억 앨범에 저장') +
        '<div class="hub-card">' +
        '<div class="form-group"><label class="form-label">사진 선택</label>' +
        '<input type="file" accept="image/*" capture="environment" id="photo-file" class="form-input" style="padding:10px;"></div>' +
        '<div class="form-group"><label class="form-label">촬영일</label>' +
        '<input class="form-input" type="date" id="photo-taken-date" value="' + today + '">' +
        '<p class="form-hint">업로드일과 다르면 실제 찍은 날로 바꿔주세요.</p></div>' +
        '<div class="form-group"><label class="form-label">메모</label>' +
        '<input class="form-input" id="photo-caption" placeholder="오늘의 순간을 기록하세요"></div>' +
        '<button class="btn btn-primary btn-full" onclick="uploadPhoto()">업로드</button>' +
        '<button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="showMemoriesPage()">취소</button></div></div>';
}
async function uploadPhoto() {
    const babyId = currentBabyId || await getDefaultBabyId();
    const fileInput = document.getElementById('photo-file');
    if (!fileInput.files.length) { showToast('파일을 선택하세요','error'); return; }
    const formData = new FormData();
    formData.append('baby_id', babyId);
    formData.append('caption', document.getElementById('photo-caption').value);
    formData.append('taken_date', document.getElementById('photo-taken-date')?.value || '');
    formData.append('file', fileInput.files[0]);
    await fetch(API+'/api/photos/upload', {method:'POST', headers:authHeaders(), body:formData});
    showToast('사진 업로드 완료! 📸','success');
    showMemoriesPage();
}

// ── 2. 성장 앨범 (스냅스 스타일) ───────────────────────────────
function showGrowthAlbumPage() {
    const c = document.getElementById('mem-section-content'); if (!c) return;
    const milestones = [
        { icon:'🐣', title:'신생아 ~ 50일', desc:'출생 후 첫 50일의 기록', day:50,  price:'9,900' },
        { icon:'🎀', title:'100일 기념',    desc:'소중한 100일 기념 영상', day:100, price:'9,900' },
        { icon:'🌸', title:'200일 기념',    desc:'하루하루 성장한 기록',   day:200, price:'12,900' },
        { icon:'🎂', title:'돌 기념',       desc:'첫 번째 생일 성장 영상', day:365, price:'14,900' },
    ];
    c.innerHTML =
        sectionCard(
        '<div class="hub-card-title">🎬 성장 앨범 영상</div>' +
        '<p class="hub-card-desc">업로드한 사진으로 3분 영상 자동 제작 · 음악 포함</p>' +
        milestones.map(function (m, i) {
            const status = i < 2 ? { label: '준비완료', color: 'var(--color-secondary-dark)' } : i === 2 ? { label: '진행중', color: 'var(--color-warning)' } : { label: 'D-87', color: 'var(--color-text-secondary)' };
            return '<div class="hub-list-item">' +
                '<div class="hub-list-icon">' + m.icon + '</div>' +
                '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:14px;font-weight:600;">' + m.title + '</div>' +
                '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">' + m.desc + '</div></div>' +
                '<div style="text-align:right;flex-shrink:0;">' +
                '<div style="font-size:12px;font-weight:600;color:' + status.color + ';">' + status.label + '</div>' +
                (i < 2 ? '<button type="button" class="btn btn-sm btn-primary" style="margin-top:4px;" onclick="orderGrowthVideo(\'' + m.title + '\')">₩' + m.price + '</button>' : '') +
                '</div></div>';
        }).join('')
        ) +
        '<div class="hub-callout hub-callout-tip">' +
        '<div class="hub-callout-title">💡 이렇게 만들어져요</div>' +
        '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.7;">' +
        '① 업로드한 사진이 날짜순으로 자동 정렬<br>' +
        '② 성장 배경음악 + 자막 자동 생성<br>' +
        '③ 제작 완료 후 카카오톡으로 전송<br>' +
        '④ 가족 모두와 공유 가능</div></div>';
}
function orderGrowthVideo(title) {
    showToast(title + ' 영상 제작 신청! 곧 서비스 오픈 예정입니다 🎬', 'success');
}

// ── 3. AI 사진 (템플릿 선택, 프롬프트 없음) ─────────────────────
const AI_STYLES = [
    { id:'ghibli',   icon:'🌿', name:'지브리',    desc:'수채화 느낌',   color:'#E8F5E9' },
    { id:'pixar',    icon:'🎬', name:'픽사',      desc:'3D 캐릭터',    color:'#E8EAF6' },
    { id:'hanbok',   icon:'👘', name:'한복',      desc:'전통 의상',    color:'#FFF3E0' },
    { id:'cartoon',  icon:'🎨', name:'만화',      desc:'귀여운 일러스트', color:'#FCE4EC' },
    { id:'watercolor',icon:'💧', name:'수채화',   desc:'부드러운 터치', color:'#E1F5FE' },
    { id:'chibi',    icon:'🧸', name:'치비',      desc:'미니 캐릭터',  color:'#F3E5F5' },
];
const AI_SIZES = [
    { id:'1:1',  label:'1:1',  sub:'정사각형' },
    { id:'9:16', label:'9:16', sub:'세로형' },
    { id:'4:3',  label:'4:3',  sub:'가로형' },
];
let _aiSelectedStyle = 'ghibli';
let _aiSelectedSize  = '1:1';

function showAIPhotoPage() {
    const c = document.getElementById('mem-section-content'); if (!c) return;
    c.innerHTML =
        sectionCard(
        '<div class="hub-card-title">🎨 AI 사진 자동 생성</div>' +
        '<p class="hub-card-desc">스타일 선택 → 사진 업로드만 하면 완성!</p>' +
        // 스타일 카드 2열 그리드
        '<div id="ai-style-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">' +
        AI_STYLES.map(s =>
            '<div id="ai-card-'+s.id+'" onclick="selectAIStyleCard(\''+s.id+'\')" style="border-radius:12px;padding:12px 8px;text-align:center;cursor:pointer;background:'+s.color+';border:1.5px solid '+(_aiSelectedStyle===s.id?'#FF6B9D':'transparent')+';">' +
            '<div style="font-size:26px;">'+s.icon+'</div>' +
            '<div style="font-size:12px;font-weight:600;margin-top:4px;color:var(--color-text-primary);">'+s.name+'</div>' +
            '<div style="font-size:10px;color:var(--color-text-secondary);margin-top:1px;">'+s.desc+'</div>' +
            '<div style="font-size:10px;font-weight:600;color:#C2410C;margin-top:5px;">₩1,900/장</div>' +
            '</div>'
        ).join('') +
        '</div>' +
        // 사이즈 선택
        '<div style="margin-bottom:12px;">' +
        '<div style="font-size:13px;font-weight:600;color:var(--color-text-primary);margin-bottom:8px;">📐 출력 사이즈</div>' +
        '<div style="display:flex;gap:6px;" id="ai-size-btns">' +
        AI_SIZES.map(sz =>
            '<div id="ai-size-'+sz.id.replace(':','-')+'" onclick="selectAISize(\''+sz.id+'\')" style="flex:1;padding:8px 6px;border-radius:10px;text-align:center;cursor:pointer;background:'+(_aiSelectedSize===sz.id?'#FF6B9D':'var(--color-background-primary)')+';color:'+(_aiSelectedSize===sz.id?'white':'var(--color-text-secondary)')+';border:1.5px solid '+(_aiSelectedSize===sz.id?'#FF6B9D':'var(--color-border-tertiary)')+';">' +
            '<div style="font-size:13px;font-weight:600;">'+sz.label+'</div>' +
            '<div style="font-size:10px;margin-top:1px;">'+sz.sub+'</div></div>'
        ).join('') +
        '</div></div>' +
        // 업로드 + 생성
        '<div style="background:#F9FAFB;border-radius:12px;padding:12px;margin-bottom:10px;">' +
        '<label class="form-label" style="font-size:13px;">아이 사진 업로드</label>' +
        '<input type="file" accept="image/*" id="ai-photo-input" class="form-input" style="padding:10px;margin-top:6px;"></div>' +
        '<button type="button" class="hub-btn-primary-inline" onclick="generateAIPhoto()">✨ AI 변환하기</button>'
        ) +
        '<div id="ai-result-wrap"></div>';
}

function selectAIStyleCard(id) {
    _aiSelectedStyle = id;
    document.querySelectorAll('[id^="ai-card-"]').forEach(el => {
        el.style.border = '1.5px solid transparent';
    });
    const sel = document.getElementById('ai-card-'+id);
    if (sel) sel.style.border = '1.5px solid #FF6B9D';
}
function selectAISize(id) {
    _aiSelectedSize = id;
    document.querySelectorAll('[id^="ai-size-"]').forEach(el => {
        el.style.background = 'var(--color-background-primary)';
        el.style.color = 'var(--color-text-secondary)';
        el.style.border = '1.5px solid var(--color-border-tertiary)';
    });
    const sid = 'ai-size-'+id.replace(':','-');
    const sel = document.getElementById(sid);
    if (sel) { sel.style.background='#FF6B9D'; sel.style.color='white'; sel.style.border='1.5px solid #FF6B9D'; }
}
async function generateAIPhoto() {
    const fileInput = document.getElementById('ai-photo-input');
    if (!fileInput || !fileInput.files.length) { showToast('사진을 먼저 선택해 주세요', 'error'); return; }
    const style = AI_STYLES.find(s=>s.id===_aiSelectedStyle);
    const wrap = document.getElementById('ai-result-wrap'); if (!wrap) return;
    wrap.innerHTML = '<div style="text-align:center;padding:24px;background:var(--color-background-secondary);border-radius:16px;">' +
        '<div class="spinner" style="margin:0 auto 12px;"></div>' +
        '<div style="font-size:14px;color:var(--color-text-secondary);">' + (style?.icon||'🎨') + ' '+style?.name+' 스타일로 변환 중...</div></div>';
    try {
        const styleObj = AI_STYLES.find(s=>s.id===_aiSelectedStyle) || AI_STYLES[0];
        const prompt = '아기 사진을 '+styleObj.name+' 스타일로 변환해줘. '+styleObj.desc+' 느낌으로.';
        const res = await fetch('/ai-images/generate?prompt='+encodeURIComponent(prompt)+'&style='+_aiSelectedStyle, {headers:authHeaders()});
        const data = await res.json();
        wrap.innerHTML = '<div style="background:var(--color-background-secondary);border-radius:16px;padding:14px;">' +
            '<div style="font-size:14px;font-weight:600;color:var(--color-text-primary);margin-bottom:10px;">✨ 생성 완료!</div>' +
            (data.output_path ? '<img src="'+data.output_path+'" style="width:100%;border-radius:10px;display:block;">' :
                '<div style="width:100%;aspect-ratio:1;background:linear-gradient(135deg,'+styleObj.color+',#fff);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:60px;">'+styleObj.icon+'</div>') +
            '<button onclick="downloadAIPhoto()" style="width:100%;margin-top:10px;padding:12px;border-radius:10px;border:none;background:#F3F4F6;font-size:14px;font-weight:600;cursor:pointer;color:var(--color-text-primary);">💾 저장하기</button>' +
            '<div style="font-size:11px;color:var(--color-text-secondary);text-align:center;margin-top:8px;">사이즈: '+_aiSelectedSize+' ('+AI_SIZES.find(s=>s.id===_aiSelectedSize)?.sub+')</div></div>';
        showToast('AI 변환 완료! 🎨','success');
    } catch(e) {
        wrap.innerHTML = '<p style="color:var(--color-danger);font-size:13px;text-align:center;padding:16px;">생성 중 오류가 발생했습니다</p>';
    }
}
function downloadAIPhoto() { showToast('저장 기능은 곧 서비스 오픈 예정입니다 💾','success'); }

function showFamilyPage(){ showMemoriesPage(); }
function showAIImagePage(){ showMemoriesPage(); }


let aiStyle='cartoon';
function selectAIStyle(el,style){el.parentElement.querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');aiStyle=style;}
async function generateAIImage(){const prompt=document.getElementById('ai-prompt').value;if(!prompt){showToast('프롬프트를 입력하세요','error');return;}const container=document.getElementById('ai-result');container.innerHTML='<div class="spinner"></div><p style="font-size:13px;">AI가 이미지를 생성중입니다...</p>';const res=await fetch('/ai-images/generate?prompt='+encodeURIComponent(prompt)+'&style='+aiStyle,{headers:authHeaders()});const data=await res.json();if(data.output_path)container.innerHTML='<img src="'+data.output_path+'" alt="AI 생성 이미지" style="max-width:100%;">';showToast('AI 이미지 생성 완료! 🎨','success');}

// ============================================================
// 발달 가이드
// ============================================================
// ============================================================
// 발달 가이드 데이터 (시기별)
// ============================================================
const DEV_STAGES = [
  {
    range: '0~2개월', icon: '🐣', color: '#FDA4AF',
    title: '신생아기',
    milestones: ['고개를 잠깐 들어요','소리 나는 쪽으로 눈을 돌려요','밝은 빛에 눈을 감아요','배를 채우면 잠들어요','첫 미소(반사적)가 나타나요'],
    cautions: ['목을 가누지 못하니 항상 머리를 받쳐주세요','수면 중 질식 위험: 엎드려 재우지 마세요','딱딱하고 평평한 곳에서 재워야 해요','방 온도 22~24℃, 과도한 포대기 주의'],
    tips: ['눈 맞춤하며 천천히 말 걸어주기','노래 불러주면 안정감을 느껴요','목욕 후 마사지로 애착 형성']
  },
  {
    range: '2~4개월', icon: '😊', color: '#FCA5A5',
    title: '사회적 미소기',
    milestones: ['진짜 미소(사회적 미소)가 생겨요','엎드리면 고개를 45~90도 들어요','옹알이를 시작해요','달랑달랑 소리 나는 장난감을 쳐다봐요','손을 입으로 가져가요'],
    cautions: ['아직 목을 완전히 못 가눠요 — 안을 때 받침 필수','소파 위 혼자 두지 마세요 (굴러 떨어짐 주의)','딸랑이 등 작은 부품 있는 장난감 삼킴 주의'],
    tips: ['배 붙이고 놀기(터미타임) 하루 3~5회씩','눈앞에서 장난감 천천히 움직여 시선 유도','까꿍 놀이 시작해도 좋아요']
  },
  {
    range: '4~6개월', icon: '🔄', color: '#FB923C',
    title: '뒤집기 시작',
    milestones: ['뒤집기를 해요 (배→등, 등→배)','양손으로 물건을 잡으려 해요','발을 들어 발가락을 빨아요','거울 속 자신에게 반응해요','이유식 시작 신호: 혀 내밀기 감소'],
    cautions: ['🚨 뒤집기 시작! 소파·침대 절대 혼자 두지 마세요','기저귀 갈 때 눈 한 순간도 떼지 마세요','침대 가드 설치 필수','이불·베개·인형 침대에서 치워주세요'],
    tips: ['4~6개월부터 이유식 준비 (소아과 상담 권장)','거울 보여주며 얼굴 표현 놀이','다양한 질감의 장난감으로 감각 자극']
  },
  {
    range: '6~8개월', icon: '🏊', color: '#FBBF24',
    title: '배밀이·앉기',
    milestones: ['배밀이로 이동해요','도움 받아 앉을 수 있어요','낯가림이 시작돼요','음절 옹알이(바바, 마마)가 나와요','손바닥으로 물건을 쥐어요'],
    cautions: ['🚨 배밀이 시작! 바닥 이물질 꼭 치워주세요','전기 콘센트 안전 커버 필수','서랍·문 손가락 끼임 주의','계단 있는 경우 안전문 설치'],
    tips: ['다양한 바닥 재질 탐색(카펫, 매트, 목재)','소리 나는 버튼 장난감으로 인과관계 자극','옹알이에 대화하듯 반응해 주세요']
  },
  {
    range: '8~10개월', icon: '🧸', color: '#A3E635',
    title: '기기·잡고 서기',
    milestones: ['네 발로 기기 시작해요','가구 잡고 일어서요','집게손가락으로 집어요','도리도리·짝짜꿍 모방해요','"안 돼"의 의미를 이해해요'],
    cautions: ['🚨 가구 모서리 보호대 부착 필수','키 큰 가구 벽에 고정(넘어짐 방지)','유리·날카로운 물건 손 닿는 곳에서 치우기','변기 뚜껑·욕조 물 주의(익수 사고)'],
    tips: ['장난감 숨기기 놀이(물체 영속성 발달)','공 굴리기로 대근육 자극','간단한 지시어 반복 연습("줘봐", "안돼")']
  },
  {
    range: '10~12개월', icon: '🚶', color: '#34D399',
    title: '첫 걸음마',
    milestones: ['잡고 걷다가 혼자 서기 시도해요','첫 단어가 나와요 (엄마, 아빠 등)','컵으로 마시기 시도해요','공을 던지려 해요','그림책을 넘겨요'],
    cautions: ['🚨 걷기 시작! 미끄럼 방지 양말·신발 착용','계단·문지방 낙상 주의','소형 물건 삼킴 사고 주의 (동전 크기 이하)','열탕·뜨거운 음식 닿지 않게'],
    tips: ['손 잡고 걷기 연습','그림책 읽어주며 단어 반복','간식으로 핑거푸드 시작 (작고 말랑한 것)']
  },
  {
    range: '12~18개월', icon: '🏃', color: '#60A5FA',
    title: '탐색·언어 폭발',
    milestones: ['혼자 잘 걸어요','단어 수가 빠르게 늘어요(10~50개)','뛰기 시작해요','스스로 먹으려 해요','끼적거리기를 좋아해요'],
    cautions: ['뛰다가 넘어짐 주의 — 머리 쿠션 바닥 유지','식탁 위 뜨거운 음식·그릇 주의','작은 장난감 삼킴 계속 주의','TV·스마트폰 시청 최소화 권장'],
    tips: ['"이게 뭐야?"로 단어 확장 유도','블록 쌓기·무너뜨리기 놀이','음악 틀어놓고 몸 흔들기(리듬감 발달)']
  },
  {
    range: '18~24개월', icon: '🌟', color: '#A78BFA',
    title: '자아 발달',
    milestones: ['두 단어 조합 (엄마 줘, 물 마셔)','계단을 잡고 올라가요','공을 발로 차요','분리불안이 생길 수 있어요','"내 거"라는 개념이 생겨요'],
    cautions: ['🚨 떼쓰기 시작 — 일관된 훈육이 중요해요','이는 중 — 과한 단 음식 주의','높은 곳 오르기 좋아해요 — 낙상 주의','이불·목 걸릴 수 있는 줄 있는 장난감 주의'],
    tips: ['역할놀이(소꿉놀이) 시작','같은 책 반복해서 읽어주기','친구와 놀면서 사회성 발달 시작']
  }
];

const RECIPES = {
  4: [
    { name: '쌀미음', ingredients: ['쌀 20g', '물 200ml'], steps: '쌀을 씻어 2시간 불린 뒤 믹서에 갈아 체에 거른 후 냄비에 넣고 약불로 저으며 끓여요.', tip: '가장 첫 번째로 시작하는 이유식이에요' },
    { name: '애호박미음', ingredients: ['쌀미음 베이스', '애호박 10g'], steps: '애호박 껍질·씨 제거 후 쪄서 곱게 갈아 쌀미음에 섞어요.', tip: '단맛이 있어 아이가 잘 먹어요' },
    { name: '브로콜리미음', ingredients: ['쌀미음 베이스', '브로콜리 10g'], steps: '브로콜리 꽃 부분만 쪄서 곱게 갈아 쌀미음에 섞어요.', tip: '비타민C 풍부 — 철분 흡수 도움' }
  ],
  5: [
    { name: '단호박죽', ingredients: ['쌀 20g', '단호박 30g', '물 180ml'], steps: '단호박 찐 뒤 쌀과 함께 믹서에 갈아 냄비에서 10분 끓여요.', tip: '비타민A·베타카로틴 풍부' },
    { name: '고구마죽', ingredients: ['쌀 20g', '고구마 30g', '물 180ml'], steps: '고구마 껍질 벗겨 쪄서 쌀과 같이 갈아 죽처럼 끓여요.', tip: '변비 예방에 도움돼요' },
    { name: '당근죽', ingredients: ['쌀 20g', '당근 20g', '물 200ml'], steps: '당근 쪄서 으깨고 쌀 불려 함께 갈아 끓여요.', tip: '베타카로틴·식이섬유 풍부' }
  ],
  6: [
    { name: '소고기죽', ingredients: ['쌀 25g', '소고기(안심) 20g', '물 200ml'], steps: '소고기 핏물 빼고 삶아 곱게 갈기. 쌀과 함께 끓여요.', tip: '철분 보충에 필수! 7개월부터 꼭 시작하세요' },
    { name: '두부죽', ingredients: ['쌀 25g', '연두부 30g', '물 180ml'], steps: '연두부 데쳐 으깨고 쌀 불려 같이 끓여요.', tip: '식물성 단백질 공급원' },
    { name: '완두콩죽', ingredients: ['쌀 25g', '완두콩 20g', '물 200ml'], steps: '완두콩 삶아 껍질 벗겨 곱게 갈아 쌀과 끓여요.', tip: '단백질·섬유질 풍부, 비린맛 없어요' },
    { name: '닭고기애호박죽', ingredients: ['쌀 25g', '닭고기(가슴살) 20g', '애호박 15g'], steps: '닭가슴살 삶아 곱게 갈기. 애호박도 갈아 쌀과 함께 끓여요.', tip: '지방 낮고 단백질 높은 이유식' }
  ],
  8: [
    { name: '소고기당근진밥', ingredients: ['불린 쌀 30g', '소고기 25g', '당근 20g', '물 150ml'], steps: '소고기·당근 잘게 다져 쌀과 함께 약불로 진밥 형태로 끓여요.', tip: '입자 크기를 조금씩 크게 늘려가요' },
    { name: '계란노른자죽', ingredients: ['쌀 30g', '계란 노른자 1개', '물 170ml'], steps: '계란 완숙 후 노른자만 분리해 으깨 쌀죽에 섞어요.', tip: '흰자는 알레르기 위험으로 돌 이후에' },
    { name: '연어채소진밥', ingredients: ['불린 쌀 30g', '연어 20g', '시금치 10g', '당근 10g'], steps: '연어 뼈 제거 후 쪄서 잘게 으깨기. 채소 다져 쌀과 끓여요.', tip: 'DHA·오메가3 풍부' },
    { name: '두부채소찜', ingredients: ['두부 50g', '당근 10g', '완두콩 10g'], steps: '두부 으깨 채소와 섞어 찜기에 10분 쪄요.', tip: '손으로 집어먹기 연습에 좋아요' }
  ],
  10: [
    { name: '소고기표고버섯진밥', ingredients: ['쌀 40g', '소고기 25g', '표고버섯 15g', '시금치 10g'], steps: '재료 모두 잘게 다져 밥솥에 물 조금 넣어 진밥 지어요.', tip: '표고버섯은 면역력 강화에 도움' },
    { name: '닭고기토마토리조또', ingredients: ['쌀 40g', '닭가슴살 25g', '방울토마토 3개', '치즈 5g'], steps: '닭가슴살 다지기. 토마토 껍질 벗겨 으깨기. 쌀과 함께 끓인 후 치즈 올려요.', tip: '치즈로 칼슘·단백질 추가' },
    { name: '두부스크램블', ingredients: ['두부 60g', '계란 1개', '애호박 15g'], steps: '두부 으깨 계란과 섞기. 애호박 다져 함께 팬에 볶아요.', tip: '핑거푸드로도 활용 가능' },
    { name: '고구마치즈볼', ingredients: ['고구마 60g', '치즈 10g', '쌀가루 10g'], steps: '고구마 쪄서 으깬 뒤 치즈·쌀가루 섞어 동그랗게 빚어 오븐 170도 15분.', tip: '간식으로 최고! 냉동 보관 가능' }
  ],
  12: [
    { name: '소고기채소볶음밥', ingredients: ['밥 60g', '소고기 30g', '당근·애호박·양파 각 15g', '참기름 약간'], steps: '소고기·채소 잘게 다져 볶다가 밥 넣어 함께 볶아요.', tip: '어른과 같은 식탁 문화 시작' },
    { name: '두부된장국', ingredients: ['두부 40g', '된장 3g', '다시마육수 150ml', '감자 20g'], steps: '감자 작게 썰어 육수에 끓이다 두부·된장 넣어 한소끔 끓여요.', tip: '염분 낮게 — 된장 적게 쓰세요' },
    { name: '아이 팬케이크', ingredients: ['바나나 1/2개', '계란 1개', '오트밀 30g'], steps: '바나나 으깨 계란·오트밀 섞어 팬에 작게 구워요.', tip: '설탕 없이도 달아요! 간식으로 완벽' },
    { name: '연두부과일샐러드', ingredients: ['연두부 60g', '사과 20g', '배 20g', '요거트 20g'], steps: '과일 작게 썰어 두부·요거트와 섞어요.', tip: '화려한 색으로 편식 예방 도움' }
  ]
};


function showPlayGuidesPage(){
    document.getElementById('main-content').innerHTML =
        '<div class="hub-page">' +
        hubPageHeader('발달 가이드', '시기별 발달 안내 · 놀이 · 이유식') +
        '<div class="hub-tab-bar">' +
        [['dev','발달안내'],['play','놀이가이드'],['diet','이유식']].map(function (t, i) {
            return '<button type="button" id="dev-tab-' + t[0] + '" class="hub-tab-btn' + (i === 0 ? ' hub-tab-btn-active' : '') + '" onclick="switchDevTab(\'' + t[0] + '\')">' + t[1] + '</button>';
        }).join('') +
        '</div>' +
        '<div id="dev-tab-content"></div></div>';
    switchDevTab('dev');
}

function switchDevTab(tab) {
    setHubTabActive('dev-tab-', tab);
    const c = document.getElementById('dev-tab-content'); if (!c) return;
    if (tab === 'dev')  renderDevGuide(c);
    else if (tab === 'play') renderPlayGuideTab(c);
    else if (tab === 'diet') renderDietTab(c);
}

// ── 발달 안내 탭 ─────────────────────────────────────────────
function renderDevGuide(c) {
    // 현재 아이 개월수 추정 (없으면 0)
    const ageMonths = window._babyAgeMonths || 0;
    let selectedIdx = 0;
    DEV_STAGES.forEach((s,i) => {
        const [from] = s.range.split('~').map(x=>parseInt(x));
        if (ageMonths >= from) selectedIdx = i;
    });

    c.innerHTML =
        '<div class="hub-chip-row" id="dev-stage-chips">' +
        DEV_STAGES.map(function (s, i) {
            const active = i === selectedIdx;
            return '<button type="button" onclick="showDevStage(' + i + ')" id="dev-chip-' + i + '" class="hub-chip hub-chip-stage' + (active ? ' hub-chip-active' : '') + '" data-stage-color="' + s.color + '" style="' + (active ? 'background:' + s.color + ';' : '') + '">' + s.icon + ' ' + s.range + '</button>';
        }).join('') +
        '</div>' +
        '<div id="dev-stage-detail"></div>';

    showDevStage(selectedIdx);
}

function showDevStage(idx) {
    const s = DEV_STAGES[idx];
    // 칩 색상 업데이트
    DEV_STAGES.forEach(function (_, i) {
        const chip = document.getElementById('dev-chip-' + i);
        if (!chip) return;
        const on = i === idx;
        chip.classList.toggle('hub-chip-active', on);
        chip.style.background = on ? DEV_STAGES[i].color : '';
        chip.style.color = on ? '#fff' : '';
    });

    const detail = document.getElementById('dev-stage-detail'); if (!detail) return;
    detail.innerHTML =
        '<div class="hub-card" style="border-left:4px solid ' + s.color + ';margin-bottom:12px;">' +
        '<div style="font-size:22px;margin-bottom:4px;">' + s.icon + '</div>' +
        '<div style="font-size:16px;font-weight:700;">' + s.range + ' · ' + s.title + '</div></div>' +
        sectionCard(
        '<div class="hub-card-title">✅ 이 시기 발달 포인트</div>' +
        s.milestones.map(function (m) {
            return '<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--color-border-light);">' +
                '<div style="width:20px;height:20px;border-radius:50%;background:var(--color-primary-light);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;color:var(--color-primary-dark);">✓</div>' +
                '<div style="font-size:14px;line-height:1.4;">' + m + '</div></div>';
        }).join('')
        ) +
        '<div class="hub-callout hub-callout-warn">' +
        '<div class="hub-callout-title">⚠️ 주의사항</div>' +
        s.cautions.map(function (c2) {
            return '<div style="font-size:13px;color:var(--color-text-secondary);line-height:1.5;padding:4px 0;">• ' + c2 + '</div>';
        }).join('') + '</div>' +
        '<div class="hub-callout hub-callout-tip">' +
        '<div class="hub-callout-title">💡 놀이 & 자극 팁</div>' +
        s.tips.map(function (t) {
            return '<div style="font-size:13px;color:var(--color-text-secondary);line-height:1.5;padding:4px 0;">→ ' + t + '</div>';
        }).join('') + '</div>';
}

// ── 놀이 가이드 탭 ────────────────────────────────────────────
const PG_CAT_LABEL = { motor: '대소근육', language: '언어', social: '사회성', sensory: '감각' };
const PG_DIFF_LABEL = { 1: '쉬움', 2: '보통', 3: '어려움' };

function getPlayGuideMonth() {
    return window._babyAgeMonths != null ? window._babyAgeMonths : 6;
}

function renderPlayGuideTab(c) {
    const month = getPlayGuideMonth();
    c.innerHTML =
        '<p class="hub-card-desc" style="margin-bottom:10px;">' +
        (month > 0 ? '우리 아이 <strong>' + month + '개월</strong>에 맞는 놀이를 추천해요' : '개월에 맞는 놀이를 골라보세요') +
        '</p>' +
        '<div class="hub-chip-row">' +
        [['all','전체'],['motor','대소근육'],['language','언어'],['social','사회성'],['sensory','감각']].map(function (cat, i) {
            return '<button type="button" id="pg-cat-' + cat[0] + '" class="hub-chip' + (i === 0 ? ' hub-chip-active' : '') + '" onclick="filterPlayGuides(\'' + cat[0] + '\',this)">' + cat[1] + '</button>';
        }).join('') + '</div>' +
        '<div id="playguides-list"></div>';
    loadPlayGuides();
}

function playGuideEscape(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function formatPlayMonths(months) {
    if (!months || !months.length) return '';
    const sorted = months.slice().sort(function (a, b) { return a - b; });
    if (sorted.length === 1) return sorted[0] + '개월';
    return sorted[0] + '~' + sorted[sorted.length - 1] + '개월';
}

async function loadPlayGuides(category) {
    category = category || 'all';
    const catColor = { all: '#34D399', motor: '#FB923C', language: '#60A5FA', social: '#F472B6', sensory: '#A78BFA' };
    const catIcon = { all: '🎯', motor: '🏃', language: '🗣️', social: '😊', sensory: '✋' };
    const container = document.getElementById('playguides-list');
    if (!container) return;
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    if (window._babyAgeMonths == null && typeof getDefaultBabyId === 'function') {
        try {
            const babyId = currentBabyId || await getDefaultBabyId();
            if (babyId) {
                const ageRes = await fetch(API + '/api/babies/' + babyId + '/age', { headers: authHeaders() });
                if (ageRes.ok) {
                    const age = await ageRes.json();
                    window._babyAgeMonths = age.total_months != null ? age.total_months : 6;
                }
            }
        } catch (e) { /* default month */ }
    }
    const month = getPlayGuideMonth();
    let url = API + '/api/playguides?month=' + month;
    if (category !== 'all') url += '&category=' + encodeURIComponent(category);
    try {
        const res = await fetch(url, { headers: authHeaders() });
        const items = await res.json();
        if (!items.length) {
            container.innerHTML = '<div class="playguide-empty">해당 조건의 놀이가 없습니다. 다른 카테고리를 선택해 보세요.</div>';
            return;
        }
        container.innerHTML = items.map(function (pg) {
            const ic = catIcon[pg.category] || '🎮';
            const col = catColor[pg.category] || '#34D399';
            const catLabel = PG_CAT_LABEL[pg.category] || pg.category;
            const diffLabel = PG_DIFF_LABEL[pg.difficulty] || '';
            return '<article class="hub-card playguide-card">' +
                '<div class="playguide-card-head">' +
                '<div class="hub-list-icon playguide-icon" style="background:' + col + '22;">' + ic + '</div>' +
                '<div class="playguide-meta">' +
                '<h3 class="playguide-title">' + playGuideEscape(pg.title) + '</h3>' +
                '<div class="playguide-tags">' +
                '<span class="playguide-tag" style="color:' + col + ';background:' + col + '22;">' + catLabel + '</span>' +
                '<span class="playguide-tag playguide-tag-muted">' + pg.duration_min + '분</span>' +
                (diffLabel ? '<span class="playguide-tag playguide-tag-muted">' + diffLabel + '</span>' : '') +
                '<span class="playguide-tag playguide-tag-muted">' + formatPlayMonths(pg.suitable_months) + '</span>' +
                '</div></div></div>' +
                '<p class="playguide-desc">' + playGuideEscape(pg.description) + '</p>' +
                (pg.material_needed ? '<p class="playguide-material">🧰 ' + playGuideEscape(pg.material_needed) + '</p>' : '') +
                '</article>';
        }).join('');
    } catch (e) {
        container.innerHTML = '<div class="playguide-empty">놀이 가이드를 불러오지 못했습니다.</div>';
    }
}

function filterPlayGuides(cat, el) {
    document.querySelectorAll('[id^="pg-cat-"]').forEach(function (b) {
        b.classList.remove('hub-chip-active');
    });
    if (el) el.classList.add('hub-chip-active');
    loadPlayGuides(cat);
}

// ── 이유식 탭 ─────────────────────────────────────────────────
function renderDietTab(c) {
    const months = [4,5,6,8,10,12];
    const labels = ['4~5개월','5~6개월','6~8개월','8~10개월','10~12개월','12개월+'];
    let sel = window._dietMonth || 6;
    c.innerHTML =
        '<p class="hub-card-desc" style="margin-bottom:10px;">개월수를 선택하면 맞춤 레시피를 보여드려요</p>' +
        '<div class="hub-chip-row" id="diet-month-chips">' +
        months.map(function (m, i) {
            return '<button type="button" onclick="selectDietMonth(' + m + ')" id="diet-chip-' + m + '" class="hub-chip' + (m === sel ? ' hub-chip-active' : '') + '">' + labels[i] + '</button>';
        }).join('') + '</div>' +
        '<div id="recipe-list"></div>' +
        '<div id="diet-brands-section"></div>';
    renderRecipes(sel);
    loadBabyFoodBrands();
}

function selectDietMonth(m) {
    window._dietMonth = m;
    [4, 5, 6, 8, 10, 12].forEach(function (v) {
        const chip = document.getElementById('diet-chip-' + v);
        if (chip) chip.classList.toggle('hub-chip-active', v === m);
    });
    renderRecipes(m);
}

function renderRecipes(month) {
    const c = document.getElementById('recipe-list'); if (!c) return;
    // 가장 가까운 월 데이터 찾기
    const keys = Object.keys(RECIPES).map(Number).sort((a,b)=>a-b);
    let key = keys[0];
    for (const k of keys) { if (month >= k) key = k; }
    const recipes = RECIPES[key] || [];
    if (!recipes.length) { c.innerHTML = '<p style="text-align:center;padding:24px;color:var(--color-text-secondary);">레시피 준비 중입니다</p>'; return; }
    c.innerHTML = recipes.map(function (r) {
        return '<div class="hub-card" style="margin-bottom:10px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
        '<div class="hub-list-icon">🍽️</div>' +
        '<div style="flex:1;"><div class="hub-card-title" style="margin:0;">' + r.name + '</div>' +
        '<span class="tag tag-green" style="margin-top:4px;display:inline-block;">' + month + '개월+</span></div></div>' +
        '<div style="background:#F9FAFB;border-radius:10px;padding:10px;margin-bottom:8px;">' +
        '<div style="font-size:12px;font-weight:600;color:var(--color-text-primary);margin-bottom:4px;">🥕 재료</div>' +
        '<div style="font-size:13px;color:var(--color-text-secondary);">'+r.ingredients.join(' · ')+'</div></div>' +
        '<div style="font-size:13px;color:var(--color-text-secondary);line-height:1.6;margin-bottom:8px;">'+
        '<span style="font-weight:600;color:var(--color-text-primary);">📝 만들기 </span>'+r.steps+'</div>' +
        '<div class="hub-callout hub-callout-tip" style="margin-bottom:0;padding:8px 10px;">' +
        '<span style="font-size:12px;">💡 ' + r.tip + '</span></div></div>';
    }).join('');
}

function dietBrandEscape(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

async function loadBabyFoodBrands() {
    const section = document.getElementById('diet-brands-section');
    if (!section) return;
    section.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
        const res = await fetch(API + '/api/baby-food-brands', { headers: authHeaders() });
        if (!res.ok) throw new Error('load brands');
        const data = await res.json();
        renderBabyFoodBrands(section, data);
    } catch (e) {
        section.innerHTML = '';
    }
}

function renderBabyFoodBrands(section, data) {
    const brands = data.brands || [];
    if (!brands.length) {
        section.innerHTML = '';
        return;
    }
    section.innerHTML =
        '<div class="diet-brands-block">' +
        '<div class="diet-brands-head">' +
        '<h3 class="diet-brands-title">이유식 전문 브랜드 TOP ' + brands.length + '</h3>' +
        '<p class="diet-brands-sub">직접 만들기 어려울 때, 검증된 배달·구독 서비스</p>' +
        '</div>' +
        '<div class="diet-brand-list">' +
        brands.map(function (b) {
            const rankClass = b.rank <= 3 ? ' diet-brand-rank-top' : '';
            return '<article class="diet-brand-card hub-card">' +
                '<div class="diet-brand-card-head">' +
                '<span class="diet-brand-rank' + rankClass + '">' + b.rank + '</span>' +
                '<div class="diet-brand-meta">' +
                '<h4 class="diet-brand-name">' + dietBrandEscape(b.name) + '</h4>' +
                (b.tagline ? '<span class="diet-brand-tag">' + dietBrandEscape(b.tagline) + '</span>' : '') +
                '</div></div>' +
                '<p class="diet-brand-desc">' + dietBrandEscape(b.description) + '</p>' +
                '<button type="button" class="btn btn-outline btn-sm diet-brand-btn" onclick="openBabyFoodBrand(\'' + dietBrandEscape(b.key) + '\')">공식 사이트 →</button>' +
                '</article>';
        }).join('') +
        '</div>' +
        (data.disclaimer ? '<p class="diet-brands-note">' + dietBrandEscape(data.disclaimer) + '</p>' : '') +
        '</div>';
}

async function openBabyFoodBrand(brandKey) {
    if (!brandKey) return;
    const babyId = typeof currentBabyId !== 'undefined' ? currentBabyId : null;
    try {
        const res = await fetch(API + '/api/baby-food-brands/click', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ brand_key: brandKey, slot: 'diet', baby_id: babyId }),
        });
        if (!res.ok) throw new Error('click');
        const data = await res.json();
        if (data.redirect_url) {
            window.open(data.redirect_url, '_blank', 'noopener,noreferrer');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('링크를 열 수 없습니다', 'error');
    }
}


async function loadDietQuick(){
    const month=parseInt(document.getElementById('diet-month-quick').value)||6;
    const res=await fetch(API+'/api/diet-guides?month='+month,{headers:authHeaders()});
    const data=await res.json();
    const container=document.getElementById('diet-quick-list');if(!container)return;
    if(!data.recipes?.length){
        container.innerHTML='<div style="text-align:center;padding:24px;color:var(--color-text-secondary);">해당 개월수 레시피가 없습니다</div>';return;
    }
    container.innerHTML=
        (data.tip?'<div style="background:#ECFDF5;border-radius:12px;padding:12px 14px;margin-bottom:10px;display:flex;gap:8px;align-items:flex-start;">'+
            '<span style="font-size:18px;">💡</span>'+
            '<span style="font-size:13px;color:#065F46;line-height:1.5;">'+data.tip+'</span></div>':'') +
        data.recipes.slice(0,3).map(r=>recipeCard(r)).join('');
}
function showDietPage(){
    document.getElementById('main-content').innerHTML=
        '<div class="hub-page">' +
        hubPageHeader('이유식 레시피', '개월수별 맞춤 레시피') +
        sectionCard(
        '<div style="display:flex;gap:8px;align-items:center;">'+
        '<input class="form-input" id="diet-month" type="number" value="6" min="5" max="12" style="width:72px;text-align:center;font-size:16px;font-weight:600;">'+
        '<span style="font-size:14px;color:var(--color-text-secondary);">개월</span>'+
        '<button type="button" class="btn btn-primary" style="flex:1;" onclick="loadDietRecipes()">레시피 보기</button></div>'
        ) +
        '<div id="diet-recipes"></div></div>';
}
function recipeCard(r){
    return '<div style="background:var(--color-background-secondary,#F9FAFB);border-radius:16px;padding:14px;margin-bottom:10px;">'+
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'+
        '<div style="width:40px;height:40px;border-radius:12px;background:#ECFDF5;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🍽️</div>'+
        '<div style="font-size:15px;font-weight:600;color:var(--color-text-primary);">'+r.name+'</div></div>'+
        '<div style="font-size:12px;color:var(--color-text-secondary);background:#F9FAFB;border-radius:8px;padding:8px;margin-bottom:6px;">'+
        '<span style="font-weight:600;color:var(--color-text-primary);">재료 </span>'+r.ingredients.join(', ')+'</div>'+
        '<div style="font-size:13px;color:var(--color-text-secondary);line-height:1.6;">'+r.steps+'</div></div>';
}
async function loadDietRecipes(){
    const month=parseInt(document.getElementById('diet-month').value)||6;
    const res=await fetch(API+'/api/diet-guides?month='+month,{headers:authHeaders()});
    const data=await res.json();
    const container=document.getElementById('diet-recipes');if(!container)return;
    if(!data.recipes?.length){container.innerHTML='<div style="text-align:center;padding:24px;color:var(--color-text-secondary);">'+data.message+'</div>';return;}
    container.innerHTML=
        (data.tip?'<div style="background:#ECFDF5;border-radius:12px;padding:12px 14px;margin-bottom:12px;display:flex;gap:8px;">'+
            '<span style="font-size:18px;">💡</span>'+
            '<span style="font-size:13px;color:#065F46;line-height:1.5;">'+data.tip+'</span></div>':'')+
        data.recipes.map(r=>recipeCard(r)).join('');
}

// ============================================================
// 금융 허브 (가이드)
// ============================================================
function showInsurancePage(initialTab){
    var tab = initialTab || 'insurance';
    var tabs = [['insurance','보험'],['securities','증권'],['bank','은행'],['gift','증여신고']];
    document.getElementById('main-content').innerHTML=
        '<div class="hub-page">' +
        hubPageHeader('금융 허브', '보험 · 증권 · 은행 · 증여신고 가이드') +
        '<div class="hub-tab-bar" id="finGuideTabs">' +
        tabs.map(function (t) {
            return '<button type="button" class="hub-tab-btn' + (t[0] === tab ? ' hub-tab-btn-active' : '') + '" data-fin-tab="' + t[0] + '">' + t[1] + '</button>';
        }).join('') +
        '</div><div id="finGuideContent"></div></div>';
    if (typeof initFinanceGuide === 'function') initFinanceGuide(tab);
}
function switchFinTab(tab, el){
    if (typeof switchFinGuideTab === 'function') switchFinGuideTab(tab);
}
function showGiftPlanPage(){showInsurancePage('gift');}
function showBankAccountsPage(){showInsurancePage('bank');}
function showNewBankForm(){document.getElementById('main-content').innerHTML='<div class="section-title">🏦 새 통장 개설</div><div class="card"><div class="form-group"><label class="form-label">은행명</label><select class="form-select" id="bank-name"><option>토스뱅크</option><option>카카오뱅크</option><option>새로운은행</option></select></div><div class="form-group"><label class="form-label">목표 금액 (원)</label><input class="form-input" id="bank-goal" type="number" placeholder="10000000"></div><button class="btn btn-primary btn-full" onclick="createBankAccount()">개설하기</button><button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="showInsurancePage()">취소</button></div>';}
async function createBankAccount(){const babyId=currentBabyId||await getDefaultBabyId();await fetch(API+'/api/bank-accounts',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({baby_id:babyId,bank_name:document.getElementById('bank-name').value,savings_goal:parseInt(document.getElementById('bank-goal').value)||null})});showToast('통장 개설 완료! 🏦','success');showInsurancePage();}
async function loadBankAccounts(){try{const res=await fetch(API+'/api/bank-accounts',{headers:authHeaders()});const items=await res.json();const container=document.getElementById('bank-accounts-list');if(!container)return;let total=0;container.innerHTML=items.map(b=>{total+=b.balance;return'<div class="card" style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:700;">'+b.bank_name+'</div><div style="font-size:12px;color:var(--color-text-secondary);">잔액 '+b.balance.toLocaleString()+'원</div></div><span class="tag tag-green">active</span></div><div style="margin-top:10px;"><button class="btn btn-sm btn-outline" onclick="showDepositForm(\''+b.id+'\')">입금</button> <button class="btn btn-sm btn-outline" onclick="showWithdrawalForm(\''+b.id+'\')">출금</button></div></div>';}).join('')||'<p style="text-align:center;color:var(--color-text-secondary);padding:10px;">개설된 통장이 없습니다</p>';const el=document.getElementById('total-balance');if(el)el.textContent=total.toLocaleString()+'원';}catch(e){}}
function showDepositForm(id){document.getElementById('main-content').innerHTML='<div class="section-title">💰 입금</div><div class="card"><div class="form-group"><label class="form-label">금액 (원)</label><input class="form-input" id="txn-amount" type="number" placeholder="50000"></div><div class="form-group"><label class="form-label">메모</label><input class="form-input" id="txn-memo" placeholder="축의금"></div><button class="btn btn-success btn-full" onclick="createTransaction(\''+id+'\',\'deposit\')">입금하기</button><button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="showInsurancePage()">취소</button></div>';}
function showWithdrawalForm(id){document.getElementById('main-content').innerHTML='<div class="section-title">💸 출금</div><div class="card"><div class="form-group"><label class="form-label">금액 (원)</label><input class="form-input" id="txn-amount" type="number" placeholder="10000"></div><button class="btn btn-primary btn-full" onclick="createTransaction(\''+id+'\',\'withdrawal\')">출금하기</button><button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="showInsurancePage()">취소</button></div>';}
async function createTransaction(accountId,type){const amount=parseInt(document.getElementById('txn-amount').value)||0;const memo=document.getElementById('txn-memo')?.value||'';await fetch(API+'/api/transactions',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({account_id:accountId,amount,type,category:'gift',memo})});showToast((type==='deposit'?'입금':'출금')+' 완료! 💰','success');showInsurancePage();}
function renderGiftTab(){const c=document.getElementById('fin-content');c.innerHTML=sectionCard('<div style="text-align:center;"><div style="font-size:48px;margin-bottom:12px;">🎁</div><div style="font-size:14px;color:var(--color-text-secondary);">10년 간 2천만원 비과세 증여</div><button class="btn btn-primary" style="margin-top:16px;" onclick="showGiftRecordForm()">증여 기록하기</button></div>')+'<div class="hub-card" id="gift-timeline"></div>';loadGiftPlan();}
function showGiftRecordForm(){document.getElementById('main-content').innerHTML='<div class="section-title">🎁 증여 기록</div><div class="card"><div class="form-group"><label class="form-label">날짜</label><input class="form-input" id="gift-date" type="date"></div><div class="form-group"><label class="form-label">금액 (원)</label><input class="form-input" id="gift-amount" type="number" placeholder="2000000"></div><button class="btn btn-primary btn-full" onclick="recordGift()">기록하기</button><button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="showInsurancePage()">취소</button></div>';}
async function recordGift(){await fetch(API+'/api/gift-plan/record',{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({date:document.getElementById('gift-date').value,amount:parseInt(document.getElementById('gift-amount').value)||0})});showToast('증여 기록 완료! 🎁','success');showInsurancePage();}
async function loadGiftPlan(){try{const res=await fetch(API+'/api/gift-plan',{headers:authHeaders()});const data=await res.json();const container=document.getElementById('gift-timeline');if(!container)return;container.innerHTML=data.timeline.map(t=>'<div class="record-item"><div class="record-icon" style="background:var(--color-green-light);">🎁</div><div class="record-info"><div class="record-title">'+t.amount.toLocaleString()+'원</div><div class="record-meta">'+(t.date||'').slice(0,10)+'</div></div></div>').join('')||'<p style="text-align:center;color:var(--color-text-secondary);padding:10px;">기록 없음</p>';}catch(e){}}

// ============================================================
// 통계 시각화
// ============================================================
function formatElapsed(minutes){if(minutes===null||minutes===undefined)return'--';if(minutes<60)return minutes+'분 전';const h=Math.floor(minutes/60),m=minutes%60;return m>0?h+'시간 '+m+'분 전':h+'시간 전';}

async function loadTodaySummary(babyId){
    try{const res=await fetch(API+'/api/stats/today/'+babyId,{headers:authHeaders()});const d=await res.json();const container=document.getElementById('today-summary');if(!container)return;
    container.innerHTML='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px;">'+
        '<div class="summary-chip" onclick="showFeedingPage()"><div class="summary-chip-icon" data-icon="feeding" data-icon-size="32"></div><div class="summary-chip-value">'+d.feeding_count+'회</div><div class="summary-chip-label">'+(d.feeding_total_ml>0?d.feeding_total_ml+'ml':'수유')+'</div><div class="summary-chip-elapsed">'+formatElapsed(d.last_feeding_min)+'</div></div>'+
        '<div class="summary-chip" onclick="navigateTo(\'sleep\')"><div class="summary-chip-icon" data-icon="sleep" data-icon-size="32"></div><div class="summary-chip-value">'+d.sleep_count+'회</div><div class="summary-chip-label">'+Math.floor(d.sleep_total_min/60)+'시간 '+(d.sleep_total_min%60)+'분</div><div class="summary-chip-elapsed">'+(d.last_sleep_min!==null?formatElapsed(d.last_sleep_min)+' 기상':'진행중')+'</div></div>'+
        '<div class="summary-chip" onclick="quickBowel(\''+babyId+'\')"><div class="summary-chip-icon" data-icon="diaper" data-icon-size="32"></div><div class="summary-chip-value">'+d.bowel_count+'회</div><div class="summary-chip-label">기저귀</div><div class="summary-chip-elapsed" style="color:var(--color-secondary-dark);font-weight:700;">+ 기록</div></div>'+
        '</div>';
        if (typeof enhanceIcons3d === 'function') enhanceIcons3d(container);
    }catch(e){}
}
async function quickBowel(babyId){try{await fetch(API+'/api/bowels/quick?baby_id='+babyId+'&type=normal&color=yellow',{method:'POST',headers:authHeaders()});showToast('💩 기저귀 교환 기록 완료!','success');loadDashboard();}catch(e){showToast('기록 실패','error');}}
async function quickBowelCurrent(){const id=currentBabyId||await getDefaultBabyId();if(!id){showToast('아기를 먼저 등록해주세요','error');return;}return quickBowel(id);}

// 주간 바차트
async function renderWeeklyChart(babyId, containerId) {
    containerId = containerId || 'stats-content';
    const container = document.getElementById(containerId); if (!container) return;
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const res = await fetch(API+'/api/stats/weekly/'+babyId, { headers: authHeaders() });
    if (!res.ok) throw new Error('API ' + res.status);
    const days = await res.json(); if (!Array.isArray(days)) throw new Error('잘못된 응답');
    const barCard = (title, icon, colorA, colorB, items, fmtLabel) => {
        const maxV = Math.max(...items.map(it=>it[1]), 1);
        const bars = items.map(it => {
            const [lbl,val] = it;
            const h = Math.max(val>0?Math.round((val/maxV)*72):0, val>0?3:0);
            return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;height:88px;justify-content:flex-end;">'+
                '<div style="font-size:11px;color:var(--color-text-secondary);height:14px;display:flex;align-items:center;">'+(val>0?fmtLabel(val):'')+'</div>'+
                '<div style="width:100%;height:'+h+'px;background:linear-gradient(180deg,'+colorA+','+colorB+');border-radius:4px 4px 0 0;min-height:'+(val>0?3:0)+'px;"></div>'+
                '<div style="font-size:11px;color:var(--color-text-secondary);font-weight:600;height:14px;display:flex;align-items:center;">'+lbl+'</div></div>';
        }).join('');
        const titleHtml = typeof icon === 'string' && icon.indexOf('data-icon') >= 0
            ? '<span class="bar-card-title-3d" style="display:inline-flex;align-items:center;gap:6px;">' + icon + ' <span>' + title + '</span></span>'
            : icon + ' ' + title;
        return '<div class="card"><div class="card-title" style="margin-bottom:10px;">'+titleHtml+'</div><div style="display:flex;gap:4px;align-items:flex-end;">'+bars+'</div></div>';
    };
    container.innerHTML =
        barCard('일별 수유량 (ml)', '🍼', '#FF6B9D', '#FFB3D0', days.map(d=>[d.day_label, d.feeding_ml]), v=>v.toFixed(0)) +
        barCard('일별 수면 시간', '😴', '#A78BFA', '#C4B5FD', days.map(d=>[d.day_label, d.sleep_min]), v=>Math.floor(v/60)+'h') +
        barCard('기저귀(회)', '<span data-icon="diaper" data-icon-size="18"></span>', '#38BDF8', '#7DD3FC', days.map(d=>[d.day_label, d.diaper_count||0]), v=>v+'회') +
        barCard('대변(회)', '<span data-icon="stool" data-icon-size="18"></span>', '#A16207', '#D4A574', days.map(d=>[d.day_label, d.stool_count||0]), v=>v+'회');
    if (typeof enhanceIcons3d === 'function') enhanceIcons3d(container);
}

// 히트맵
let _heatmapType = 'feeding';
async function renderHeatmapInner(babyId, containerId) {
    containerId = containerId || 'stats-content';
    const container = document.getElementById(containerId); if (!container) return;
    container.innerHTML = '<div class="toggle-group" style="margin-bottom:12px;">'+
        '<button class="toggle-btn active" onclick="changeHeatmapType2(\'feeding\',this)">🍼 수유</button>'+
        '<button class="toggle-btn" onclick="changeHeatmapType2(\'sleep\',this)">😴 수면</button>'+
        '<button class="toggle-btn heatmap-toggle-3d" onclick="changeHeatmapType2(\'bowel\',this)"><span data-icon="diaper" data-icon-size="14"></span> 기저귀</button>'+
        '</div><div class="card" id="heatmap-container2" style="overflow:hidden;"><div class="loading"><div class="spinner"></div></div></div>'+
        '<p style="font-size:11px;color:var(--color-text-secondary);text-align:center;margin-top:4px;">최근 28일 · 색이 진할수록 빈도 높음</p>';
    window._heatmapBabyId = babyId;
    await drawHeatmap2(babyId, 'feeding');
    if (typeof enhanceIcons3d === 'function') enhanceIcons3d(container);
}
async function changeHeatmapType2(type,el){_heatmapType=type;el.closest('.toggle-group').querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');const babyId=window._heatmapBabyId||currentBabyId||await getDefaultBabyId();await drawHeatmap2(babyId,type);}
async function drawHeatmap2(babyId, type) {
    const box = document.getElementById('heatmap-container2'); if (!box) return;
    const res = await fetch(API+'/api/stats/heatmap/'+babyId+'?type='+type+'&days=28', { headers: authHeaders() });
    if (!res.ok) throw new Error('히트맵 API ' + res.status);
    const data = await res.json();
    const grid = data.grid, maxVal = Math.max(...grid.flat(), 1);
    const clrs = { feeding:'#FF6B9D', sleep:'#A78BFA', bowel:'#34D399' };
    const baseColor = clrs[type] || '#FF6B9D', CELL=12, GAP=2;
    let html = '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><div style="min-width:'+(24*(CELL+GAP)+28)+'px;"><div style="display:flex;margin-left:28px;margin-bottom:3px;">';
    [0,3,6,9,12,15,18,21].forEach(h => html += '<div style="width:'+(CELL+GAP)*3+'px;font-size:11px;color:var(--color-text-tertiary);">'+String(h).padStart(2,'0')+'시</div>');
    html += '</div>';
    data.day_labels.forEach((day,wi) => {
        html += '<div style="display:flex;align-items:center;margin-bottom:'+GAP+'px;"><div style="width:24px;font-size:11px;color:var(--color-text-secondary);font-weight:600;">'+day+'</div>';
        for (let hi=0; hi<24; hi++) { const v=grid[wi][hi], op=v===0?0.07:0.15+(v/maxVal)*0.85; html += '<div title="'+day+'요일 '+hi+'시: '+v+'회" style="width:'+CELL+'px;height:'+CELL+'px;border-radius:2px;background:'+baseColor+';opacity:'+op+';margin-right:'+GAP+'px;"></div>'; }
        html += '</div>';
    });
    html += '</div></div>';
    box.innerHTML = html;
}

// WHO 비교
async function renderWhoCompare(babyId, containerId) {
    containerId = containerId || 'stats-content';
    const container = document.getElementById(containerId); if (!container) return;
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const res = await fetch(API+'/api/stats/who-infant/'+babyId, { headers: authHeaders() });
    if (!res.ok) throw new Error('WHO API ' + res.status);
    const d = await res.json();
    const gauge = (label, icon, avgVal, unit, ref, pct, comment) => {
        const p=Math.max(0,Math.min(99,pct)), lc=comment.level==='good'?'#34D399':comment.level==='caution'?'#FBBF24':'#F87171';
        const iconHtml = (icon === 'stool' || (typeof icon3dSrc === 'function' && icon3dSrc(icon)))
            ? '<span class="who-gauge-icon" data-icon="'+icon+'" data-icon-size="24"></span>'
            : '<span style="font-size:24px;">'+icon+'</span>';
        return '<div class="card">'+
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">'+iconHtml+
            '<div style="flex:1;"><div style="font-size:14px;font-weight:700;">'+label+'</div><div style="font-size:11px;color:var(--color-text-secondary);">최근 7일 평균 · '+(ref?.source||'WHO')+'</div></div>'+
            '<div style="text-align:right;"><div style="font-size:22px;font-weight:800;color:'+lc+';">'+(typeof avgVal==='number'?avgVal.toFixed(avgVal>=10?0:1):avgVal)+unit+'</div>'+
            '<div style="font-size:10px;color:var(--color-text-secondary);">권장 '+(ref?.min||'?')+'~'+(ref?.max||'?')+unit+'</div></div></div>'+
            '<div style="position:relative;padding-bottom:36px;margin-bottom:10px;">'+
            '<div style="height:12px;border-radius:99px;background:linear-gradient(to right,#BFDBFE 0%,#60A5FA 15%,#34D399 35%,#34D399 65%,#FDE68A 80%,#FCA5A5 100%);overflow:visible;position:relative;">'+
            '<div style="position:absolute;left:'+p+'%;top:-6px;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid '+lc+';filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2));"></div>'+
            '<div style="position:absolute;left:'+p+'%;top:14px;transform:translateX(-50%);font-size:10px;font-weight:800;color:'+lc+';white-space:nowrap;">'+p.toFixed(0)+'%ile</div></div>'+
            '<div style="display:flex;justify-content:space-between;margin-top:28px;font-size:8.5px;color:var(--color-text-tertiary);"><span>P3</span><span>P15</span><span style="font-weight:700;color:#6B7280;">P50</span><span>P85</span><span>P97</span></div></div>'+
            '<div class="growth-comment '+comment.level+'"><span class="growth-comment-icon">'+comment.icon+'</span><span class="growth-comment-text" style="font-size:12px;">'+comment.text+'</span></div></div>';
    };
    let growthHtml = '';
    try{const gr=await fetch(API+'/api/growth/compare/'+babyId,{headers:authHeaders()});if(gr.ok){const gd=await gr.json();const last=gd.records?.[gd.records.length-1];if(last){const ageM=gd.baby?.age_months;const wCmt=gd.comments?.find(c=>c.text.includes('체중'))||{level:'good',icon:'✅',text:'체중 정상 범위'};const hCmt=gd.comments?.find(c=>c.text.includes('키'))||{level:'good',icon:'✅',text:'키 정상 범위'};if(last.weight_pct!=null)growthHtml+=gauge('체중 (WHO·'+ageM+'개월)','⚖️',last.weight_kg,'kg',{min:'',max:'',source:'WHO Child Growth Standards'},last.weight_pct,wCmt);if(last.height_pct!=null)growthHtml+=gauge('키 (WHO·'+ageM+'개월)','📏',last.height_cm,'cm',{min:'',max:'',source:'WHO Child Growth Standards'},last.height_pct,hCmt);}}}catch(e){}
    container.innerHTML =
        '<div style="background:var(--color-accent-light);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:12px;">'+
        '<div style="font-size:13px;font-weight:700;color:var(--color-accent-dark);">🏥 WHO·대한소아과학회 기준 비교</div>'+
        '<div style="font-size:11px;color:var(--color-accent-dark);opacity:0.8;margin-top:2px;">현재 나이 <b>'+d.age_months+'개월</b> · 최근 7일 평균</div></div>'+
        gauge('일일 수유량','feeding',d.feeding.avg_7d,'ml',d.feeding.ref,d.feeding.percentile,d.feeding.comment)+
        gauge('일일 수면 시간','sleep',d.sleep.avg_7d,'h',d.sleep.ref,d.sleep.percentile,d.sleep.comment)+
        gauge('기저귀 교환 횟수','diaper',(d.diaper||d.bowel)?.avg_7d,'회',(d.diaper||d.bowel)?.ref,(d.diaper||d.bowel)?.percentile,(d.diaper||d.bowel)?.comment)+
        (d.stool ? gauge('대변 횟수','stool',d.stool.avg_7d,'회',d.stool.ref,d.stool.percentile,d.stool.comment) : '')+
        growthHtml;
    if (typeof enhanceIcons3d === 'function') enhanceIcons3d(container);
}
function showStatsPage(){navigateTo('record-stats');}

// ============================================================
// 네비게이션
// ============================================================
const pageMap = {
    home: loadDashboard,
    'record-stats': showRecordStatsPage,
    record: showRecordStatsPage,
    feeding: showFeedingPage,
    sleep: showSleepPage,
    'bowel-log': showBowelLogPage,
    bowel: showBowelLogPage,
    growth: showGrowthPage,
    vaccination: showVaccinationPage,
    milestone: showMilestonePage,
    memories: showMemoriesPage,
    album: showMemoriesPage,
    'special-days': showMemoriesPage,
    family: showFamilyPage,
    'family-feed': showFamilyPage,
    'ai-image': showAIImagePage,
    credits: showAIImagePage,
    playguides: showPlayGuidesPage,
    diet: showDietPage,
    insurance: showInsurancePage,
    'bank-accounts': showBankAccountsPage,
    'gift-plan': showGiftPlanPage,
    fortune: showFortunePage,
    'shopping-guide': showShoppingGuidePage,
    'nursing-room': showNursingRoomPage,
    profile: loadDashboard,
    stats: showRecordStatsPage,
    timeline: showRecordStatsPage,
    heatmap: showRecordStatsPage,
    monthly: showRecordStatsPage,
    who: showRecordStatsPage,
};

const recordPages = ['record','feeding','sleep','bowel','bowel-log','growth','vaccination','milestone','stats','timeline','heatmap','monthly','who','record-stats'];
const memoriesPages = ['album','special-days','family','family-feed','ai-image','credits','memories'];
const devPages = ['playguides','diet'];
const finPages = ['insurance','bank-accounts','gift-plan'];

function getNavTabKey(page) {
    if (page === 'home') return 'home';
    if (recordPages.includes(page)) return 'record-stats';
    if (memoriesPages.includes(page)) return 'memories';
    if (devPages.includes(page)) return 'playguides';
    if (finPages.includes(page)) return 'insurance';
    if (page === 'fortune') return 'fortune';
    if (page === 'shopping-guide') return 'shopping-guide';
    return null;
}

function updateBottomNavActive(page) {
    var tabKey = getNavTabKey(page);
    document.querySelectorAll('.nav-item').forEach(function (n) {
        n.classList.toggle('active', tabKey != null && n.dataset.page === tabKey);
    });
    scrollBottomNavIntoView(tabKey);
}

function scrollBottomNavIntoView(tabKey) {
    if (!tabKey || tabKey === 'home') return;
    var track = document.getElementById('nav-scroll-track');
    if (!track) return;
    var item = track.querySelector('.nav-item[data-page="' + tabKey + '"]');
    if (item) item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function initBottomNavScroll() {
    var track = document.getElementById('nav-scroll-track');
    var wrap = document.querySelector('.nav-scroll-wrap');
    if (!track || !wrap) return;
    function updateFade() {
        var canScroll = track.scrollWidth > track.clientWidth + 2;
        var atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
        wrap.classList.toggle('nav-scroll-can-scroll', canScroll);
        wrap.classList.toggle('nav-scroll-at-end', atEnd);
    }
    track.addEventListener('scroll', updateFade, { passive: true });
    window.addEventListener('resize', updateFade);
    updateFade();
}

function initTextSize() {
    var large = localStorage.getItem('text_size') === 'large';
    document.documentElement.classList.toggle('text-size-large', large);
    var label = document.getElementById('text-size-label');
    if (label) label.textContent = large ? '크게' : '보통';
}

function toggleTextSize() {
    var large = localStorage.getItem('text_size') !== 'large';
    localStorage.setItem('text_size', large ? 'large' : 'normal');
    initTextSize();
    showToast(large ? '글자 크기: 크게' : '글자 크기: 보통', 'success');
}

function navigateTo(page, options) {
    options = options || {};
    updateBottomNavActive(page);
    const fn = pageMap[page];
    if (fn) {
        if (page === 'insurance' && options.finTab) fn(options.finTab);
        else fn();
        window.scrollTo(0, 0);
        const main = document.getElementById('main-content');
        if (main && typeof enhanceIcons3d === 'function') {
            setTimeout(function () { enhanceIcons3d(main); }, 0);
        }
    }
    closeSideMenu();
}

function openSideMenu() { document.getElementById('side-menu-overlay').classList.add('open'); }
function closeSideMenu() { document.getElementById('side-menu-overlay').classList.remove('open'); }

document.getElementById('btn-menu')?.addEventListener('click', openSideMenu);
document.getElementById('btn-close-menu')?.addEventListener('click', closeSideMenu);
document.getElementById('side-menu-overlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSideMenu(); });
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        const finTab = item.dataset.finTab;
        if (!page) return;
        navigateTo(page, finTab ? { finTab: finTab } : undefined);
    });
});
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const page = item.dataset.page;
        const finTab = item.dataset.finTab;
        if (!page) return;
        navigateTo(page, finTab ? { finTab: finTab } : undefined);
    });
});
document.getElementById('btn-text-size')?.addEventListener('click', toggleTextSize);

function showToast(message, type) {
    type = type || '';
    const toast = document.createElement('div'); toast.className = 'toast ' + type; toast.textContent = message;
    document.body.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2500);
}

async function init() {
    initTextSize();
    initBottomNavScroll();
    if (typeof initIcons3d === 'function') initIcons3d(document);
    currentUser = await me();
    if (currentUser) { currentBabyId = localStorage.getItem('baby_id') || null; loadDashboard(); }
    else {
        document.getElementById('main-content').innerHTML =
            '<div style="text-align:center;padding:60px 20px;">' +
            '<div style="margin-bottom:16px;">' + (typeof icon3d === 'function' ? icon3d('logo', 'icon-3d-xl') : '') + '</div>' +
            '<p style="font-size:18px;font-weight:700;margin-bottom:8px;">우리 아이 올인원 육아 파트너</p>' +
            '<p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:32px;">기록 + 추억 + 발달 + 금융 + AI</p>' +
            '<div class="card" style="max-width:320px;margin:0 auto;text-align:left;">' +
            '<div class="form-group"><label class="form-label">전화번호</label><input class="form-input" id="login-phone" placeholder="010-0000-0000" value="010-0000-0000"></div>' +
            '<div class="form-group"><label class="form-label">비밀번호</label><input class="form-input" id="login-password" type="password" placeholder="1234" value="1234"></div>' +
            '<button class="btn btn-primary btn-full" onclick="login(document.getElementById(\'login-phone\').value, document.getElementById(\'login-password\').value)">로그인</button>' +
            '<button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="register(\'010-\'+String(Math.floor(Math.random()*9999)).padStart(4,\'0\')+\'-\'+String(Math.floor(Math.random()*9999)).padStart(4,\'0\'),\'테스트사용자\',\'1234\')">회원가입</button></div>' +
            '<p style="font-size:11px;color:var(--color-text-secondary);margin-top:16px;">데모 계정: 010-0000-0000 / 1234</p></div>';
        if (typeof enhanceIcons3d === 'function') enhanceIcons3d(document.getElementById('main-content'));
    }
}

init();
