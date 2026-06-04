/**
 * 키워드별 쇼핑가이드 — 쿠팡·네이버 1·2위 (한 줄 2개)
 */
let _shopKeywords = [];
let _shopSelectedKeyword = 'basic';

function formatPrice(n) {
    if (n == null || n === '') return '—';
    return Number(n).toLocaleString('ko-KR') + '원';
}

function formatCount(n) {
    if (n == null || n === '') return '—';
    return Number(n).toLocaleString('ko-KR');
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function showShoppingGuidePage() {
    const main = document.getElementById('main-content');
    main.innerHTML =
        '<div class="shop-page">' +
        '<div class="section-title">키워드별 쇼핑가이드</div>' +
        '<p class="shop-disclaimer" id="shop-disclaimer">가격은 갱신 시점 기준이며 실제와 다를 수 있습니다.</p>' +
        '<div class="shop-keyword-chips" id="shop-keyword-chips"></div>' +
        '<div id="shop-content"><div class="loading"><div class="spinner"></div></div></div>' +
        '<p class="shop-footer-note">쿠팡·네이버에서 최종 가격·리뷰를 확인하세요.</p>' +
        '</div>';
    loadShoppingKeywords();
}

async function loadShoppingKeywords() {
    try {
        const res = await fetch(API + '/api/shopping-guide/keywords', { headers: authHeaders() });
        const data = await res.json();
        _shopKeywords = data.keywords || [];
        const disc = document.getElementById('shop-disclaimer');
        if (disc && data.disclaimer) disc.textContent = data.disclaimer;
        if (_shopKeywords.length && !_shopKeywords.some(function (k) { return k.key === _shopSelectedKeyword; })) {
            _shopSelectedKeyword = _shopKeywords[0].key;
        }
        renderShopKeywordChips();
        loadShoppingGuide(_shopSelectedKeyword);
    } catch (e) {
        const c = document.getElementById('shop-content');
        if (c) c.innerHTML = '<p class="shop-error">목록을 불러오지 못했습니다.</p>';
    }
}

function renderShopKeywordChips() {
    const el = document.getElementById('shop-keyword-chips');
    if (!el) return;
    el.innerHTML = _shopKeywords.map(function (k) {
        const active = k.key === _shopSelectedKeyword ? ' shop-chip-active' : '';
        return '<button type="button" class="shop-chip' + active + '" data-keyword="' + k.key + '">' + k.label + '</button>';
    }).join('');
    el.querySelectorAll('.shop-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
            _shopSelectedKeyword = btn.dataset.keyword;
            renderShopKeywordChips();
            loadShoppingGuide(_shopSelectedKeyword);
        });
    });
}

async function loadShoppingGuide(keyword) {
    const c = document.getElementById('shop-content');
    if (!c) return;
    c.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
        const res = await fetch(API + '/api/shopping-guide?keyword=' + encodeURIComponent(keyword), { headers: authHeaders() });
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        c.innerHTML = renderShoppingProducts(data.products || [], data.label);
    } catch (e) {
        c.innerHTML = '<p class="shop-error">이 키워드 데이터가 없습니다.</p>';
    }
}

function renderProductImage(item) {
    const url = item.image_url;
    const alt = escapeHtml(item.name);
    if (url) {
        return '<img class="shop-prod-img" src="' + escapeHtml(url) + '" alt="' + alt + '" loading="lazy" onerror="this.classList.add(\'shop-prod-img-fallback\')">';
    }
    return '<div class="shop-prod-img shop-prod-img-placeholder">' + (item.rank || '') + '</div>';
}

function renderProductStats(platform, offer, label) {
    const cp = offer.coupang || {};
    const np = offer.naver || {};
    const o = platform === 'coupang' ? cp : np;
    const price = formatPrice(o.price);
    const reviews = formatCount(o.review_count);
    const purchases = formatCount(o.purchase_count);
    const url = o.url || '#';
    return '<div class="shop-prod-stat-line">' +
        '<span class="shop-prod-stat-label">' + label + '</span> ' +
        '<span class="shop-prod-stat-price">' + price + '</span> ' +
        '<span class="shop-prod-stat-meta">리뷰 ' + reviews + ' · 구매 ' + purchases + '</span> ' +
        '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" class="shop-prod-stat-link">' + label + ' →</a>' +
        '</div>';
}

function renderPlatformCell(platformClass, label, offer) {
    const o = offer || {};
    const link = o.url
        ? '<a href="' + escapeHtml(o.url) + '" target="_blank" rel="noopener noreferrer" class="shop-prod-stat-link">보기</a>'
        : '';
    return '<div class="shop-prod-stat-cell ' + platformClass + '">' +
        '<span class="shop-prod-stat-label">' + label + '</span>' +
        '<span class="shop-prod-stat-price">' + formatPrice(o.price) + '</span>' +
        '<span class="shop-prod-stat-meta">리뷰 ' + formatCount(o.review_count) + '</span>' +
        '<span class="shop-prod-stat-meta">구매 ' + formatCount(o.purchase_count) + '</span>' +
        link +
        '</div>';
}

function renderProductCard(item) {
    const cp = item.coupang || {};
    const np = item.naver || {};
    return '<article class="shop-prod-card">' +
        '<div class="shop-prod-rank">' + item.rank + '위</div>' +
        renderProductImage(item) +
        '<h4 class="shop-prod-name">' + escapeHtml(item.name) + '</h4>' +
        '<div class="shop-prod-stats shop-prod-stats-row">' +
        renderPlatformCell('shop-prod-stat-coupang', '쿠팡', cp) +
        renderPlatformCell('shop-prod-stat-naver', '네이버', np) +
        '</div></article>';
}

function renderShoppingProducts(products, keywordLabel) {
    if (!products.length) {
        return '<p class="shop-empty">' + escapeHtml(keywordLabel || '') + ' 추천 상품이 없습니다.</p>';
    }
    return products.map(function (prod) {
        const items = (prod.items || []).slice(0, 2);
        const cards = items.map(renderProductCard).join('');
        return '<section class="shop-product-group">' +
            '<h3 class="shop-product-group-title">' + escapeHtml(prod.label) + '</h3>' +
            '<div class="shop-product-row">' + cards + '</div></section>';
    }).join('');
}
