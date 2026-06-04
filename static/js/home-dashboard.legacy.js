/**
 * 아이랑 핏 — 홈 대시보드 v1 (레거시)
 * 새 홈(v2) 적용 전 원본 UI. 복구 방법:
 *   localStorage.setItem('home_ui', 'v1'); location.reload();
 * 또는
 *   localStorage.removeItem('home_ui'); 후 기본값을 v1으로 바꿀 때
 */
async function loadDashboardV1() {
    const main = document.getElementById('main-content');
    try {
        const babyId = currentBabyId || await getDefaultBabyId();
        const res = await fetch(`${API}/api/dashboard?baby_id=${babyId}`, { headers: authHeaders() });
        if (!res.ok) throw new Error('API 오류 ' + res.status);
        const data = await res.json();
        if (!data.baby) {
            main.innerHTML = '<div style="text-align:center;padding:60px 20px;"><div style="font-size:64px;margin-bottom:16px;">👶</div><p style="font-size:16px;font-weight:600;margin-bottom:8px;">아기를 먼저 등록해 주세요</p><button class="btn btn-primary" onclick="showBabyForm()">아기 등록하기</button></div>';
            return;
        }
        const age = data.baby.age;
        const ageLabel = age.years > 0 ? (age.years + '세 ' + age.months + '개월') : (age.total_months > 0 ? age.total_months + '개월' : age.total_days + '일');
        if (typeof updateAppHeaderBaby === 'function') {
            updateAppHeaderBaby(data.baby, age);
        } else {
            const hTitle = document.getElementById('header-title');
            const hAge = document.getElementById('header-age');
            if (hTitle) hTitle.textContent = data.baby.name;
            if (hAge) hAge.textContent = ageLabel;
        }
        main.innerHTML =
            '<div class="hero-card"><div style="display:flex;align-items:center;gap:14px;position:relative;z-index:1;">' +
            '<div class="hero-baby-avatar">' + (data.baby.gender === 'male' ? '👦' : '👧') + '</div>' +
            '<div><div class="hero-name">' + data.baby.name + '</div>' +
            '<div class="hero-age">' + ageLabel + ' · ' + age.phase + '</div>' +
            '<div class="hero-days">🗓️ 태어난 지 ' + age.total_days + '일째</div></div></div></div>' +
            '<div class="section-header"><span class="section-title">오늘의 기록</span><button class="section-more" onclick="navigateTo(\'record-stats\')">📊 기록/통계 →</button></div>' +
            '<div id="today-summary" style="margin-bottom:12px;"></div>' +
            '<div class="dashboard-grid">' +
            '<div class="dash-card"><div class="dash-icon dash-blue" data-icon="feeding" data-icon-size="36"></div><div class="dash-value">' + data.today.feedings + '</div><div class="dash-label">수유</div></div>' +
            '<div class="dash-card"><div class="dash-icon dash-pink" data-icon="sleep" data-icon-size="36"></div><div class="dash-value">' + data.today.sleeps + '</div><div class="dash-label">수면</div></div>' +
            '<div class="dash-card"><div class="dash-icon dash-green" data-icon="stool" data-icon-size="36"></div><div class="dash-value">' + data.today.bowels + '</div><div class="dash-label">대변</div></div>' +
            '<div class="dash-card"><div class="dash-icon dash-orange" data-icon="growth" data-icon-size="36"></div><div class="dash-value">' + (data.last_growth.weight || '--') + '</div><div class="dash-label">체중(kg)</div></div>' +
            '</div>' +
            (data.next_vaccination.name ? '<div class="alert-card"><span class="alert-icon" data-icon="vaccine" data-icon-size="28"></span><span class="alert-text">다음 예방접종: ' + data.next_vaccination.name + ' (' + (data.next_vaccination.date || '').slice(5) + ')</span></div>' : '') +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
            '<span style="font-size:15px;font-weight:600;color:var(--color-text-primary);">빠른 기록</span>' +
            '<button onclick="navigateTo(\'record-stats\')" style="font-size:12px;color:var(--color-text-secondary);background:none;border:none;cursor:pointer;">전체보기 →</button></div>' +
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">' +
            [['showFeedingPage()','feeding','수유'],['navigateTo(\'sleep\')','sleep','수면'],['navigateTo(\'bowel-log\')','stool','대변'],['navigateTo(\'growth\')','growth','성장']].map(b =>
                '<button onclick="' + b[0] + '" style="background:var(--color-background-secondary);border:none;border-radius:14px;padding:14px 6px;cursor:pointer;text-align:center;"><span data-icon="' + b[1] + '" data-icon-size="32" style="display:block;margin:0 auto 4px;"></span><div style="font-size:12px;font-weight:500;color:var(--color-text-primary);">' + b[2] + '</div></button>'
            ).join('') +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
            '<span style="font-size:15px;font-weight:600;color:var(--color-text-primary);">최근 성장 스탬프</span>' +
            '<button onclick="navigateTo(\'milestone\')" style="font-size:12px;color:var(--color-text-secondary);background:none;border:none;cursor:pointer;">전체 →</button></div>' +
            '<div style="background:var(--color-background-secondary);border-radius:14px;padding:12px;"><div id="milestone-items"></div></div>';
        window._babyAgeMonths = age.total_months != null ? age.total_months : (age.years * 12 + age.months);
        loadMilestones(babyId);
        loadTodaySummary(babyId);
        if (typeof enhanceIcons3d === 'function') enhanceIcons3d(main);
    } catch (e) {
        if (main) main.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--color-text-secondary);"><div style="font-size:48px;margin-bottom:12px;">⚠️</div><p style="font-size:14px;">홈 로딩 오류: ' + e.message + '</p><button class="btn btn-outline" style="margin-top:16px;" onclick="loadDashboard()">다시 시도</button></div>';
    }
}
