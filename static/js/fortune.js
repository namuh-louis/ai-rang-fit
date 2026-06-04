/**
 * 출산택일 · 작명 (명리학·부모 사주 기반)
 */
let _fortuneTab = 'birthday';
let _shiChenOptions = [];
const _hanjaLookupTimers = new WeakMap();

const FORTUNE_SHI_CHEN_FALLBACK = [
    { value: '자시', label: '자시 (23:00~01:00)' },
    { value: '축시', label: '축시 (01:00~03:00)' },
    { value: '인시', label: '인시 (03:00~05:00)' },
    { value: '묘시', label: '묘시 (05:00~07:00)' },
    { value: '진시', label: '진시 (07:00~09:00)' },
    { value: '사시', label: '사시 (09:00~11:00)' },
    { value: '오시', label: '오시 (11:00~13:00)' },
    { value: '미시', label: '미시 (13:00~15:00)' },
    { value: '신시', label: '신시 (15:00~17:00)' },
    { value: '유시', label: '유시 (17:00~19:00)' },
    { value: '술시', label: '술시 (19:00~21:00)' },
    { value: '해시', label: '해시 (21:00~23:00)' },
];

function showFortunePage() {
    const main = document.getElementById('main-content');
    main.innerHTML =
        '<div class="fortune-page fortune-compact">' +
        '<div class="fortune-head">' +
        '<div class="section-title fortune-title">출산택일 · 작명</div>' +
        '<p class="fortune-notice-inline">명리·사주 참고용 AI · 하루 3회 · 전문 상담 대체 불가</p>' +
        '</div>' +
        '<div class="fortune-tabs">' +
        '<button type="button" class="fortune-tab fortune-tab-active" data-tab="birthday" onclick="switchFortuneTab(\'birthday\')">출산택일</button>' +
        '<button type="button" class="fortune-tab" data-tab="naming" onclick="switchFortuneTab(\'naming\')">작명</button>' +
        '</div>' +
        '<div class="card fortune-form-card">' +
        '<details class="fortune-details" id="fortune-parents-details" open>' +
        '<summary class="fortune-details-summary">부모 사주 (명리 분석 필수) <span class="fortune-details-hint">이름·한자·생년월일·시진</span></summary>' +
        '<p class="fortune-parents-desc">이름(한글) 입력 시 한자가 자동 채워지며, 글자마다 다른 한자를 선택할 수 있습니다. 생년월일은 연·월·일을 선택하세요.</p>' +
        '<div id="fortune-parents-form" class="fortune-parents-grid"></div>' +
        '<button type="button" class="btn btn-outline fortune-save-btn" onclick="saveFortuneParents()">부모 사주 저장</button>' +
        '</details>' +
        '<div id="fortune-tab-panel" class="fortune-tab-panel"></div>' +
        '</div>' +
        '<div id="fortune-result"></div>' +
        '</div>';
    loadShiChenOptions().then(function () {
        renderFortuneParentsForm();
        switchFortuneTab('birthday');
        loadFortuneParents();
    });
}

async function loadShiChenOptions() {
    try {
        const res = await fetch(API + '/api/fortune/shi-chen', { headers: authHeaders() });
        if (res.ok) {
            const data = await res.json();
            _shiChenOptions = data.items || FORTUNE_SHI_CHEN_FALLBACK;
            return;
        }
    } catch (e) { /* ignore */ }
    _shiChenOptions = FORTUNE_SHI_CHEN_FALLBACK;
}

function shiChenSelectHtml(selected) {
    const opts = _shiChenOptions.length ? _shiChenOptions : FORTUNE_SHI_CHEN_FALLBACK;
    let html = '<option value="">모름</option>';
    opts.forEach(function (s) {
        const sel = selected === s.value ? ' selected' : '';
        html += '<option value="' + s.value + '"' + sel + '>' + s.label + '</option>';
    });
    return html;
}

function switchFortuneTab(tab) {
    _fortuneTab = tab;
    document.querySelectorAll('.fortune-tab').forEach(function (b) {
        b.classList.toggle('fortune-tab-active', b.dataset.tab === tab);
    });
    const panel = document.getElementById('fortune-tab-panel');
    if (!panel) return;
    if (tab === 'birthday') {
        const dueDefault = defaultDueDate();
        panel.innerHTML =
            '<div class="fortune-panel-label">택일 조건</div>' +
            '<p class="fortune-panel-desc">예정 출산일과 아기 성별만 입력합니다. 분석은 저장된 부모 사주(명리)를 바탕으로 합니다.</p>' +
            '<div class="fortune-grid fortune-grid-2">' +
            '<label class="fortune-field"><span>예정 출산일</span><input class="form-input form-input-sm" type="date" id="fortune-due-date" value="' + dueDefault + '"></label>' +
            '<div class="fortune-field fortune-field-gender">' +
            '<span>아기 성별</span>' +
            '<div class="toggle-group toggle-group-sm" id="fortune-baby-gender" data-gender="male">' +
            '<button type="button" class="toggle-btn active" onclick="selectFortuneBabyGender(this,\'male\')">남</button>' +
            '<button type="button" class="toggle-btn" onclick="selectFortuneBabyGender(this,\'female\')">여</button></div></div>' +
            '</div>' +
            '<button type="button" class="btn btn-primary btn-full fortune-submit-btn" onclick="runFortuneBirthday()">택일 분석 (우선순위 5일)</button>';
    } else {
        panel.innerHTML =
            '<div class="fortune-panel-label">작명 조건</div>' +
            '<p class="fortune-panel-desc">돌림자·형제 이름·오행·획수 등 일반적으로 많이 고려하는 조건을 반영합니다.</p>' +
            '<div class="fortune-grid fortune-grid-2 fortune-grid-naming">' +
            '<label class="fortune-field"><span>성(한글)</span><input class="form-input form-input-sm" id="fortune-surname" placeholder="김"></label>' +
            '<div class="fortune-field fortune-field-gender">' +
            '<span>아기 성별</span>' +
            '<div class="toggle-group toggle-group-sm" id="fortune-naming-gender" data-gender="male">' +
            '<button type="button" class="toggle-btn active" onclick="selectFortuneGender(this,\'male\')">남</button>' +
            '<button type="button" class="toggle-btn" onclick="selectFortuneGender(this,\'female\')">여</button></div></div>' +
            '<label class="fortune-field"><span>돌림자 (선택)</span><input class="form-input form-input-sm" id="fortune-dolimja" placeholder="예: 종, 鍾"></label>' +
            '<label class="fortune-field"><span>돌림자 위치</span>' +
            '<select class="form-select form-select-sm" id="fortune-dolimja-pos">' +
            '<option value="">없음</option><option value="first">이름 첫 글자</option><option value="second">이름 둘째 글자</option><option value="last">이름 마지막 글자</option></select></label>' +
            '<label class="fortune-field fortune-field-full"><span>형제·자매 이름 (선택)</span><input class="form-input form-input-sm" id="fortune-siblings" placeholder="예: 김민준, 김서연"></label>' +
            '<label class="fortune-field fortune-field-full"><span>희망 뜻·느낌 (선택)</span><input class="form-input form-input-sm" id="fortune-meaning" placeholder="예: 밝고 건강한, 지혜로운"></label>' +
            '<label class="fortune-field"><span>보완 오행 (선택)</span>' +
            '<select class="form-select form-select-sm" id="fortune-five-element">' +
            '<option value="none">특별히 없음</option><option value="wood">목(木)</option><option value="fire">화(火)</option>' +
            '<option value="earth">토(土)</option><option value="metal">금(金)</option><option value="water">수(水)</option></select></label>' +
            '<label class="fortune-field"><span>이름 글자 수</span>' +
            '<select class="form-select form-select-sm" id="fortune-syllable-count">' +
            '<option value="any">상관없음</option><option value="2">2글자 (성 제외)</option><option value="3">3글자 (성 제외)</option></select></label>' +
            '<label class="fortune-field"><span>끝소리(받침)</span>' +
            '<select class="form-select form-select-sm" id="fortune-end-sound">' +
            '<option value="any">상관없음</option><option value="no_batchim">받침 없음</option><option value="batchim">받침 있음</option></select></label>' +
            '<label class="fortune-field"><span>획수·음양 (선택)</span><input class="form-input form-input-sm" id="fortune-stroke" placeholder="예: 총획 30획 내외"></label>' +
            '<label class="fortune-field"><span>기피 한자 (선택)</span><input class="form-input form-input-sm" id="fortune-avoid" placeholder="쓰지 않을 한자"></label>' +
            '<label class="fortune-field"><span>발음·소리 (선택)</span><input class="form-input form-input-sm" id="fortune-pronunciation" placeholder="예: 부드러운 발음"></label>' +
            '<label class="fortune-field fortune-field-check">' +
            '<span class="fortune-check-row"><input type="checkbox" id="fortune-legal-hanja" checked> 인명용 한자 위주</span></label>' +
            '</div>' +
            '<button type="button" class="btn btn-primary btn-full fortune-submit-btn" onclick="runFortuneNaming()">작명 분석</button>';
    }
}

function collectFortuneNamingPayload() {
    return {
        surname: document.getElementById('fortune-surname')?.value?.trim(),
        baby_gender: document.getElementById('fortune-naming-gender')?.dataset.gender || 'male',
        dolimja: document.getElementById('fortune-dolimja')?.value?.trim() || null,
        dolimja_position: document.getElementById('fortune-dolimja-pos')?.value || null,
        sibling_names: document.getElementById('fortune-siblings')?.value?.trim() || null,
        meaning_preference: document.getElementById('fortune-meaning')?.value?.trim() || null,
        five_element_need: document.getElementById('fortune-five-element')?.value || 'none',
        syllable_count: document.getElementById('fortune-syllable-count')?.value || 'any',
        end_sound: document.getElementById('fortune-end-sound')?.value || 'any',
        stroke_preference: document.getElementById('fortune-stroke')?.value?.trim() || null,
        avoid_characters: document.getElementById('fortune-avoid')?.value?.trim() || null,
        pronunciation_notes: document.getElementById('fortune-pronunciation')?.value?.trim() || null,
        use_legal_hanja_only: document.getElementById('fortune-legal-hanja')?.checked !== false,
    };
}

function defaultDueDate() {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
}

function selectFortuneGender(el, g) {
    el.parentElement.querySelectorAll('.toggle-btn').forEach(function (b) { b.classList.remove('active'); });
    el.classList.add('active');
    el.parentElement.dataset.gender = g;
}

function selectFortuneBabyGender(el, g) {
    selectFortuneGender(el, g);
}

function parseFortuneBirthDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return { y: '', m: '', d: '' };
    const m = dateStr.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return { y: '', m: '', d: '' };
    return { y: m[1], m: String(parseInt(m[2], 10)), d: String(parseInt(m[3], 10)) };
}

function padFortuneDatePart(n) {
    const s = String(n);
    return s.length === 1 ? '0' + s : s;
}

function daysInFortuneMonth(year, month) {
    if (!year || !month) return 31;
    return new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
}

function fortuneBirthdateHtml(birthDate) {
    const p = parseFortuneBirthDate(birthDate);
    const nowY = new Date().getFullYear();
    let yOpts = '<option value="">년</option>';
    for (let y = nowY; y >= 1940; y--) {
        yOpts += '<option value="' + y + '"' + (String(y) === p.y ? ' selected' : '') + '>' + y + '년</option>';
    }
    let mOpts = '<option value="">월</option>';
    for (let mo = 1; mo <= 12; mo++) {
        const sv = String(mo);
        mOpts += '<option value="' + sv + '"' + (sv === p.m ? ' selected' : '') + '>' + mo + '월</option>';
    }
    const maxD = daysInFortuneMonth(p.y, p.m);
    let dOpts = '<option value="">일</option>';
    for (let da = 1; da <= maxD; da++) {
        const sv = String(da);
        dOpts += '<option value="' + sv + '"' + (sv === p.d ? ' selected' : '') + '>' + da + '일</option>';
    }
    return '<label class="fortune-field fortune-field-birthdate">' +
        '<span>생년월일</span>' +
        '<div class="fortune-birthdate-row">' +
        '<select class="form-select form-select-sm fortune-birth-y" onchange="onFortuneBirthdatePartChange(this)">' + yOpts + '</select>' +
        '<select class="form-select form-select-sm fortune-birth-m" onchange="onFortuneBirthdatePartChange(this)">' + mOpts + '</select>' +
        '<select class="form-select form-select-sm fortune-birth-d">' + dOpts + '</select>' +
        '<input type="hidden" class="fortune-birthdate" value="' + escapeHtml((birthDate || '').slice(0, 10)) + '">' +
        '</div></label>';
}

function onFortuneBirthdatePartChange(el) {
    const row = el.closest('.fortune-birthdate-row');
    if (!row) return;
    const ySel = row.querySelector('.fortune-birth-y');
    const mSel = row.querySelector('.fortune-birth-m');
    const dSel = row.querySelector('.fortune-birth-d');
    const y = ySel.value;
    const m = mSel.value;
    const prevD = dSel.value;
    const maxD = daysInFortuneMonth(y, m);
    let dOpts = '<option value="">일</option>';
    for (let da = 1; da <= maxD; da++) {
        const sv = String(da);
        dOpts += '<option value="' + sv + '"' + (sv === prevD ? ' selected' : '') + '>' + da + '일</option>';
    }
    dSel.innerHTML = dOpts;
    if (prevD && parseInt(prevD, 10) > maxD) dSel.value = '';
    syncFortuneBirthdateHidden(row);
}

function syncFortuneBirthdateHidden(row) {
    const y = row.querySelector('.fortune-birth-y')?.value;
    const m = row.querySelector('.fortune-birth-m')?.value;
    const d = row.querySelector('.fortune-birth-d')?.value;
    const hidden = row.querySelector('.fortune-birthdate');
    if (!hidden) return;
    if (y && m && d) {
        hidden.value = y + '-' + padFortuneDatePart(m) + '-' + padFortuneDatePart(d);
    } else {
        hidden.value = '';
    }
}

function getFortuneBirthdateFromCol(blk) {
    const row = blk.querySelector('.fortune-birthdate-row');
    if (row) syncFortuneBirthdateHidden(row);
    return blk.querySelector('.fortune-birthdate')?.value || '';
}

function parentFieldHtml(role, label, data) {
    data = data || {};
    const cal = data.calendar_type || 'solar';
    const bt = data.birth_time || '';
    return '<div class="fortune-parent-col">' +
        '<div class="fortune-parent-label">' + label + '</div>' +
        '<input type="hidden" class="fortune-role" value="' + role + '">' +
        '<label class="fortune-field"><span>이름 (한글)</span><input class="form-input form-input-sm fortune-name" value="' + escapeHtml(data.name || '') + '" autocomplete="name"></label>' +
        '<label class="fortune-field fortune-field-hanja">' +
        '<span>한자 <small class="fortune-optional">글자별 선택</small></span>' +
        '<input type="hidden" class="fortune-hanja" value="' + escapeHtml(data.name_hanja || '') + '">' +
        '<p class="fortune-hanja-preview" aria-live="polite">' + (data.name_hanja ? escapeHtml(data.name_hanja) : '—') + '</p>' +
        '<div class="fortune-hanja-chars"></div>' +
        '</label>' +
        fortuneBirthdateHtml(data.birth_date) +
        '<div class="fortune-grid fortune-grid-2 fortune-grid-tight">' +
        '<label class="fortune-field"><span>태어난 시</span>' +
        '<select class="form-select form-select-sm fortune-birthtime">' + shiChenSelectHtml(bt) + '</select></label>' +
        '<label class="fortune-field"><span>양·음력</span>' +
        '<select class="form-select form-select-sm fortune-calendar">' +
        '<option value="solar"' + (cal === 'solar' ? ' selected' : '') + '>양력</option>' +
        '<option value="lunar"' + (cal === 'lunar' ? ' selected' : '') + '>음력</option></select></label>' +
        '</div>' +
        '<label class="fortune-field"><span>출생지 (선택)</span><input class="form-input form-input-sm fortune-place" value="' + escapeHtml(data.birth_place || '') + '" placeholder="예: 서울"></label>' +
        '</div>';
}

function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function renderFortuneParentsForm(father, mother) {
    const el = document.getElementById('fortune-parents-form');
    if (!el) return;
    el.innerHTML = parentFieldHtml('father', '아빠', father) + parentFieldHtml('mother', '엄마', mother);
    el.querySelectorAll('.fortune-parent-col').forEach(function (col) {
        initFortuneParentCol(col);
    });
}

function initFortuneParentCol(col) {
    const nameInput = col.querySelector('.fortune-name');
    if (nameInput) {
        nameInput.addEventListener('input', function () {
            scheduleParentHanjaLookup(col);
        });
        nameInput.addEventListener('blur', function () {
            fetchParentHanjaOptions(col);
        });
    }
    col.querySelectorAll('.fortune-birth-y, .fortune-birth-m, .fortune-birth-d').forEach(function (sel) {
        sel.addEventListener('change', function () {
            const row = sel.closest('.fortune-birthdate-row');
            if (row) syncFortuneBirthdateHidden(row);
        });
    });
    const name = nameInput?.value?.trim();
    if (name) fetchParentHanjaOptions(col);
}

function scheduleParentHanjaLookup(col) {
    const prev = _hanjaLookupTimers.get(col);
    if (prev) clearTimeout(prev);
    _hanjaLookupTimers.set(col, setTimeout(function () {
        fetchParentHanjaOptions(col);
    }, 450));
}

function onFortuneHanjaCharSelectChange(sel) {
    const col = sel.closest('.fortune-parent-col');
    if (sel.value === '__custom__') {
        const v = window.prompt('한자 1글자를 입력하세요', '');
        const ch = v ? Array.from(v.trim())[0] : '';
        if (ch) {
            let found = false;
            for (let i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value === ch) { found = true; break; }
            }
            if (!found) {
                const opt = document.createElement('option');
                opt.value = ch;
                opt.textContent = ch;
                const customOpt = sel.querySelector('option[value="__custom__"]');
                sel.insertBefore(opt, customOpt);
            }
            sel.value = ch;
        } else if (sel.options.length > 1) {
            sel.selectedIndex = 0;
        }
    }
    syncHanjaFromPickers(col);
}

function renderHanjaCharPickers(col, characters) {
    const box = col.querySelector('.fortune-hanja-chars');
    if (!box) return;
    if (!characters || !characters.length) {
        box.innerHTML = '<p class="fortune-hanja-empty">이름을 입력하면 한자 후보가 표시됩니다</p>';
        syncHanjaFromPickers(col);
        return;
    }
    box.innerHTML = characters.map(function (c, idx) {
        const opts = (c.options || []).filter(function (o) { return o; });
        if (!opts.length) opts.push('');
        let optHtml = '';
        opts.forEach(function (h) {
            const sel = h === (c.selected || '') ? ' selected' : '';
            optHtml += '<option value="' + escapeHtml(h) + '"' + sel + '>' + escapeHtml(h) + '</option>';
        });
        optHtml += '<option value="__custom__">✏️ 직접 입력</option>';
        const count = opts.length;
        return '<div class="fortune-hanja-char" data-idx="' + idx + '">' +
            '<span class="fortune-hanja-hangul">' + escapeHtml(c.hangul) + '</span>' +
            '<select class="form-select form-select-sm fortune-hanja-char-select" title="' + count + '개 후보" ' +
            'onchange="onFortuneHanjaCharSelectChange(this)">' + optHtml + '</select></div>';
    }).join('');
    syncHanjaFromPickers(col);
}

function syncHanjaFromPickers(col) {
    if (!col) return;
    const parts = [];
    col.querySelectorAll('.fortune-hanja-char-select').forEach(function (sel) {
        if (sel.value) parts.push(sel.value);
    });
    const combined = parts.join('');
    const hidden = col.querySelector('.fortune-hanja');
    const preview = col.querySelector('.fortune-hanja-preview');
    if (hidden) hidden.value = combined;
    if (preview) preview.textContent = combined || '—';
}

async function fetchParentHanjaOptions(col) {
    const nameInput = col.querySelector('.fortune-name');
    const name = nameInput?.value?.trim();
    const box = col.querySelector('.fortune-hanja-chars');
    if (!name) {
        if (box) box.innerHTML = '';
        syncHanjaFromPickers(col);
        return;
    }
    if (box) box.innerHTML = '<p class="fortune-hanja-loading">한자 조회 중…</p>';
    const saved = col.querySelector('.fortune-hanja')?.value || '';
    const nameLen = Array.from(name).length;
    const savedLen = Array.from(saved).length;
    try {
        let url = API + '/api/fortune/hanja-lookup?name=' + encodeURIComponent(name);
        if (saved && savedLen === nameLen) {
            url += '&saved_hanja=' + encodeURIComponent(saved);
        }
        const res = await fetch(url, { headers: authHeaders() });
        const data = await res.json();
        if (data.characters && data.characters.length) {
            renderHanjaCharPickers(col, data.characters);
        } else if (data.hanja) {
            const hParts = Array.from(data.hanja);
            renderHanjaCharPickers(col, Array.from(name).map(function (ch, i) {
                const h = hParts[i] || '';
                return { hangul: ch, options: h ? [h] : [''], selected: h };
            }));
        } else {
            renderHanjaCharPickers(col, Array.from(name).map(function (ch) {
                return { hangul: ch, options: [''], selected: '' };
            }));
        }
    } catch (e) {
        if (box) box.innerHTML = '<p class="fortune-hanja-empty">조회 실패 — 이름을 다시 입력해 주세요</p>';
    }
}

function collectFortuneParents() {
    const blocks = document.querySelectorAll('.fortune-parent-col');
    const parents = [];
    blocks.forEach(function (blk) {
        parents.push({
            role: blk.querySelector('.fortune-role').value,
            name: blk.querySelector('.fortune-name').value.trim(),
            name_hanja: blk.querySelector('.fortune-hanja').value.trim() || null,
            birth_date: getFortuneBirthdateFromCol(blk),
            birth_time: blk.querySelector('.fortune-birthtime').value || null,
            calendar_type: blk.querySelector('.fortune-calendar').value,
            birth_place: blk.querySelector('.fortune-place').value.trim() || null,
        });
    });
    return parents;
}

async function loadFortuneParents() {
    try {
        const res = await fetch(API + '/api/fortune/parents', { headers: authHeaders() });
        const data = await res.json();
        const parents = data.parents || [];
        const father = parents.find(function (p) { return p.role === 'father'; });
        const mother = parents.find(function (p) { return p.role === 'mother'; });
        renderFortuneParentsForm(father, mother);
    } catch (e) { /* ignore */ }
}

async function saveFortuneParents() {
    const parents = collectFortuneParents();
    if (parents.length < 2 || !parents.every(function (p) { return p.name && p.birth_date; })) {
        showToast('아빠·엄마 이름과 생년월일을 모두 입력해 주세요', 'error');
        return;
    }
    try {
        const res = await fetch(API + '/api/fortune/parents', {
            method: 'PUT',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({ parents: parents }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || '저장 실패');
        }
        showToast('부모 사주가 저장되었습니다', 'success');
        const det = document.getElementById('fortune-parents-details');
        if (det) det.open = false;
    } catch (e) {
        showToast(e.message || '저장 실패', 'error');
    }
}

function formatFortuneDate(dateStr) {
    if (!dateStr) return '';
    const p = dateStr.slice(0, 10).split('-');
    if (p.length === 3) return p[0] + '년 ' + parseInt(p[1], 10) + '월 ' + parseInt(p[2], 10) + '일';
    return dateStr;
}

function renderFortuneBirthdayResult(result) {
    const recs = (result.recommendations || []).map(function (r, i) {
        const rank = r.rank != null ? r.rank : (i + 1);
        const dateStr = formatFortuneDate(r.date || (r.datetime || '').slice(0, 10));
        return '<div class="fortune-result-row fortune-birthday-row">' +
            '<span class="fortune-result-rank">' + rank + '위</span>' +
            '<div class="fortune-result-body">' +
            '<span class="fortune-result-dt">' + dateStr + '</span>' +
            (r.score != null ? '<span class="fortune-result-score-inline">적합도 ' + r.score + '</span>' : '') +
            '<p class="fortune-result-reason">' + (r.reason || '') + '</p></div></div>';
    }).join('');
    const cautions = (result.cautions || []).map(function (c) { return '<li>' + c + '</li>'; }).join('');
    const demo = result.demo ? '<span class="fortune-demo-badge">데모</span>' : '';
    return '<div class="card fortune-result-card">' +
        '<div class="fortune-result-head">출산 택일 결과 (우선순위 5일) ' + demo + '</div>' +
        '<p class="fortune-result-summary">' + (result.summary || '') + '</p>' + recs +
        (cautions ? '<ul class="fortune-cautions">' + cautions + '</ul>' : '') + '</div>';
}

function renderFortuneNamingResult(result) {
    const names = (result.names || []).map(function (n) {
        const hanja = n.hanja ? '<span class="fortune-hanja">(' + n.hanja + ')</span>' : '';
        const reason = n.reason ? '<p class="fortune-name-reason">' + n.reason + '</p>' : '';
        return '<div class="fortune-name-row fortune-result-row-compact">' +
            '<span class="fortune-name-score">' + (n.score || '') + '</span>' +
            '<div class="fortune-result-body">' +
            '<span class="fortune-name-main">' + n.name + ' ' + hanja + '</span>' +
            '<span class="fortune-name-meta">' + (n.meaning || '') + (n.five_elements ? ' · ' + n.five_elements : '') + '</span>' +
            reason + '</div></div>';
    }).join('');
    const cautions = (result.cautions || []).map(function (c) { return '<li>' + c + '</li>'; }).join('');
    const demo = result.demo ? '<span class="fortune-demo-badge">데모</span>' : '';
    return '<div class="card fortune-result-card">' +
        '<div class="fortune-result-head">작명 결과 ' + demo + '</div>' +
        '<p class="fortune-result-summary">' + (result.summary || '') + '</p>' + names +
        (cautions ? '<ul class="fortune-cautions">' + cautions + '</ul>' : '') + '</div>';
}

async function runFortuneBirthday() {
    const due = document.getElementById('fortune-due-date')?.value;
    if (!due) {
        showToast('예정 출산일을 입력해 주세요', 'error');
        return;
    }
    const gEl = document.getElementById('fortune-baby-gender');
    const gender = gEl?.dataset.gender || 'male';
    const resultEl = document.getElementById('fortune-result');
    if (resultEl) resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>부모 사주·명리 기준 분석 중...</p></div>';
    try {
        const res = await fetch(API + '/api/fortune/birthday', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify({
                due_date: due,
                baby_gender: gender,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            const d = data.detail;
            throw new Error(typeof d === 'string' ? d : (Array.isArray(d) ? d[0]?.msg : '오류'));
        }
        if (resultEl) resultEl.innerHTML = renderFortuneBirthdayResult(data.result);
    } catch (e) {
        if (resultEl) resultEl.innerHTML = '<p class="shop-error">' + (e.message || '분석 실패') + '</p>';
    }
}

async function runFortuneNaming() {
    const payload = collectFortuneNamingPayload();
    if (!payload.surname) {
        showToast('성(한글)을 입력해 주세요', 'error');
        return;
    }
    const resultEl = document.getElementById('fortune-result');
    if (resultEl) resultEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>명리·사주 기준 작명 분석 중...</p></div>';
    try {
        const res = await fetch(API + '/api/fortune/naming', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
            const d = data.detail;
            throw new Error(typeof d === 'string' ? d : (Array.isArray(d) ? d[0]?.msg : '오류'));
        }
        if (resultEl) resultEl.innerHTML = renderFortuneNamingResult(data.result);
    } catch (e) {
        if (resultEl) resultEl.innerHTML = '<p class="shop-error">' + (e.message || '분석 실패') + '</p>';
    }
}
