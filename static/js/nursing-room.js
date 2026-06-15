/**
 * 수유실 찾기 — 수유정보 알리미 OPEN API (연동 예정)
 * https://www.sooyusil.com/home/39.htm
 */
let _nursingZone = '';
let _nursingFatherOnly = false;

function nursingEscape(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

const NURSING_ZONES = [
    '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
    '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

function showNursingRoomPage() {
    const main = document.getElementById('main-content');
    main.innerHTML =
        '<div class="hub-page nursing-page">' +
        '<div class="hub-page-head nursing-page-head">' +
        '<div><h2 class="hub-page-title">수유실 찾기</h2>' +
        '<p class="hub-page-sub">전국 수유시설 · 수유정보 알리미</p></div>' +
        '<span class="nursing-source-badge">공공데이터</span></div>' +
        '<div id="nursing-status-banner" class="nursing-status-banner">' +
        '<div class="loading"><div class="spinner"></div></div></div>' +
        '<div class="nursing-search-card hub-card">' +
        '<label class="form-label">지역 (시·도)</label>' +
        '<div class="nursing-zone-chips" id="nursing-zone-chips">' +
        NURSING_ZONES.map(function (z) {
            return '<button type="button" class="hub-chip nursing-zone-chip" data-zone="' + z + '">' + z + '</button>';
        }).join('') +
        '</div>' +
        '<label class="form-label" style="margin-top:14px;">검색</label>' +
        '<input class="form-input" id="nursing-search-input" placeholder="수유실 이름·주소 (API 연동 후 검색)" disabled>' +
        '<div class="nursing-filter-row">' +
        '<button type="button" class="toggle-btn nursing-father-toggle" id="nursing-father-toggle" disabled>아빠 이용 가능만</button>' +
        '<button type="button" class="btn btn-primary btn-sm" id="nursing-search-btn" disabled onclick="searchNursingRooms()">검색</button>' +
        '</div></div>' +
        '<div id="nursing-results" class="nursing-results">' +
        '<div class="nursing-empty-preview">' +
        '<span data-icon="nursing" data-icon-size="48"></span>' +
        '<p class="nursing-empty-title">지도와 목록이 여기에 표시됩니다</p>' +
        '<p class="nursing-empty-sub">API 인증키 승인 후 전국 수유실 정보를 불러옵니다.</p>' +
        '</div></div>' +
        '<p class="nursing-footer-note">출처: <a href="https://www.sooyusil.com/home/39.htm" target="_blank" rel="noopener noreferrer">수유정보 알리미 OPEN API</a></p>' +
        '</div>';
    if (typeof enhanceIcons3d === 'function') enhanceIcons3d(main);
    bindNursingZoneChips();
    loadNursingRoomStatus();
}

function bindNursingZoneChips() {
    document.querySelectorAll('.nursing-zone-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.disabled) return;
            const zone = btn.dataset.zone;
            _nursingZone = _nursingZone === zone ? '' : zone;
            document.querySelectorAll('.nursing-zone-chip').forEach(function (b) {
                b.classList.toggle('hub-chip-active', b.dataset.zone === _nursingZone);
            });
        });
    });
}

async function loadNursingRoomStatus() {
    const banner = document.getElementById('nursing-status-banner');
    if (!banner) return;
    try {
        const res = await fetch(API + '/api/nursing-rooms/status', { headers: authHeaders() });
        const data = res.ok ? await res.json() : { ready: false };
        if (data.ready) {
            banner.className = 'nursing-status-banner nursing-status-ready';
            banner.innerHTML = '<span class="nursing-status-icon" aria-hidden="true">✓</span>' +
                '<div><strong>API 연동 준비됨</strong>' +
                '<p>' + nursingEscape(data.message || '검색 기능을 곧 열어요.') + '</p></div>';
            enableNursingSearchUI(true);
        } else {
            banner.className = 'nursing-status-banner nursing-status-pending';
            banner.innerHTML = '<span class="nursing-status-icon" aria-hidden="true">⏳</span>' +
                '<div><strong>API 연동 예정</strong>' +
                '<p>' + nursingEscape(data.message || '인증키 승인 후 전국 수유실 검색이 제공됩니다.') + '</p></div>';
            enableNursingSearchUI(false);
        }
    } catch (e) {
        banner.className = 'nursing-status-banner nursing-status-pending';
        banner.innerHTML = '<p>상태를 불러오지 못했습니다.</p>';
        enableNursingSearchUI(false);
    }
}

function enableNursingSearchUI(on) {
    const input = document.getElementById('nursing-search-input');
    const btn = document.getElementById('nursing-search-btn');
    const father = document.getElementById('nursing-father-toggle');
    if (input) input.disabled = !on;
    if (btn) btn.disabled = !on;
    if (father) father.disabled = !on;
    document.querySelectorAll('.nursing-zone-chip').forEach(function (b) {
        b.disabled = !on;
        if (!on) b.classList.remove('hub-chip-active');
    });
    if (father && on) {
        father.onclick = function () {
            _nursingFatherOnly = !_nursingFatherOnly;
            father.classList.toggle('active', _nursingFatherOnly);
        };
    }
}

function searchNursingRooms() {
    const box = document.getElementById('nursing-results');
    if (!box) return;
    box.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    fetch(API + '/api/nursing-rooms?' + new URLSearchParams({
        zone: _nursingZone,
        q: document.getElementById('nursing-search-input')?.value || '',
        father_only: _nursingFatherOnly ? '1' : '0',
    }), { headers: authHeaders() })
        .then(function (res) { return res.json(); })
        .then(function (data) { renderNursingResults(data); })
        .catch(function () {
            box.innerHTML = '<p class="nursing-empty-sub">검색에 실패했습니다.</p>';
        });
}

function renderNursingResults(data) {
    const box = document.getElementById('nursing-results');
    if (!box) return;
    const rooms = data.rooms || [];
    if (!rooms.length) {
        box.innerHTML = '<div class="nursing-empty-preview">' +
            '<p class="nursing-empty-title">검색 결과가 없습니다</p>' +
            '<p class="nursing-empty-sub">' + nursingEscape(data.message || '다른 지역으로 검색해 보세요.') + '</p></div>';
        return;
    }
    box.innerHTML = rooms.map(function (r) {
        return '<article class="nursing-room-card hub-card">' +
            '<div class="nursing-room-head">' +
            '<h3 class="nursing-room-name">' + nursingEscape(r.room_name) + '</h3>' +
            (r.room_type_name ? '<span class="tag tag-blue">' + nursingEscape(r.room_type_name) + '</span>' : '') +
            '</div>' +
            '<p class="nursing-room-address">' + nursingEscape(r.address) + '</p>' +
            (r.location ? '<p class="nursing-room-meta">📍 ' + nursingEscape(r.location) + '</p>' : '') +
            (r.father_use_nm ? '<p class="nursing-room-meta">' + nursingEscape(r.father_use_nm) + '</p>' : '') +
            (r.manager_tel ? '<p class="nursing-room-meta">☎ ' + nursingEscape(r.manager_tel) + '</p>' : '') +
            '</article>';
    }).join('');
}
