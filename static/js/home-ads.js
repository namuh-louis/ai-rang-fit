/**
 * 아이랑 핏 — 홈 롤링 광고/쇼핑 배너
 */

function homeAdFormatPrice(n) {
    if (n == null || n === '') return '';
    return Number(n).toLocaleString('ko-KR') + '원';
}

function homeAdEscape(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function renderHomeAdSlide(item, babyId) {
    if (item.type === 'promo') {
        return '<div class="home-ad-slide home-ad-slide-promo" data-slide-id="' + homeAdEscape(item.id) + '">' +
            '<div class="home-ad-slide-inner">' +
            '<div class="home-ad-copy">' +
            '<span class="home-ad-badge">' + homeAdEscape(item.badge || '안내') + '</span>' +
            '<div class="home-ad-title">' + homeAdEscape(item.title) + '</div>' +
            '<div class="home-ad-sub">' + homeAdEscape(item.subtitle) + '</div>' +
            '</div>' +
            '<button type="button" class="home-ad-cta-btn home-ad-cta-promo" data-action="navigate" data-page="' +
            homeAdEscape(item.page || 'shopping-guide') + '">' + homeAdEscape(item.cta || '보기') + '</button>' +
            '</div></div>';
    }

    var img = item.image_url
        ? '<img class="home-ad-thumb" src="' + homeAdEscape(item.image_url) + '" alt="" loading="lazy">'
        : '<div class="home-ad-thumb home-ad-thumb-empty"></div>';

    return '<div class="home-ad-slide home-ad-slide-shopping" data-slide-id="' + homeAdEscape(item.id) + '">' +
        '<div class="home-ad-slide-inner">' +
        img +
        '<div class="home-ad-copy">' +
        '<span class="home-ad-badge">' + homeAdEscape(item.badge || '추천') + '</span>' +
        '<div class="home-ad-title">' + homeAdEscape(item.title) + '</div>' +
        '<div class="home-ad-sub">' + homeAdEscape(item.subtitle) + '</div>' +
        (item.price_label ? '<div class="home-ad-price">' + homeAdEscape(item.price_label) + '</div>' : '') +
        '</div>' +
        '<button type="button" class="home-ad-cta-btn" data-product-key="' + homeAdEscape(item.product_key) +
        '" data-platform="' + homeAdEscape(item.platform || 'coupang') +
        '" data-slot="home" data-baby-id="' + homeAdEscape(babyId || '') + '">' +
        homeAdEscape(item.cta || '쿠팡에서 보기') + '</button>' +
        '</div></div>';
}

function renderHomeAdCarousel(data, babyId) {
    var items = data.items || [];
    if (!items.length) return '';

    var slides = items.map(function (item) { return renderHomeAdSlide(item, babyId); }).join('');
    var dots = items.map(function (_, i) {
        return '<button type="button" class="home-ad-dot' + (i === 0 ? ' home-ad-dot-active' : '') +
            '" data-index="' + i + '" aria-label="배너 ' + (i + 1) + '"></button>';
    }).join('');

    return '<section class="home-ad-carousel" data-rotation-sec="' + (data.rotation_sec || 5) + '" aria-label="추천 상품">' +
        '<div class="home-ad-viewport">' +
        '<div class="home-ad-track">' + slides + '</div>' +
        '</div>' +
        '<div class="home-ad-footer">' +
        '<div class="home-ad-dots" role="tablist">' + dots + '</div>' +
        '<p class="home-ad-disclosure">' + homeAdEscape(data.disclosure || '파트너스 · 수수료가 지급될 수 있습니다') + '</p>' +
        '</div></section>';
}

function initHomeAdCarousel(root) {
    if (!root) return;
    var track = root.querySelector('.home-ad-track');
    var slides = root.querySelectorAll('.home-ad-slide');
    var dots = root.querySelectorAll('.home-ad-dot');
    if (!track || slides.length < 2) return;

    var idx = 0;
    var total = slides.length;
    var sec = parseInt(root.dataset.rotationSec, 10) || 5;
    var timer = null;

    function goTo(i) {
        idx = ((i % total) + total) % total;
        track.style.transform = 'translateX(-' + (idx * 100) + '%)';
        dots.forEach(function (d, j) {
            d.classList.toggle('home-ad-dot-active', j === idx);
        });
    }

    function startAuto() {
        stopAuto();
        timer = setInterval(function () { goTo(idx + 1); }, sec * 1000);
    }

    function stopAuto() {
        if (timer) { clearInterval(timer); timer = null; }
    }

    dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
            goTo(parseInt(dot.dataset.index, 10));
            startAuto();
        });
    });

    root.addEventListener('mouseenter', stopAuto);
    root.addEventListener('mouseleave', startAuto);
    root.addEventListener('touchstart', stopAuto, { passive: true });
    root.addEventListener('touchend', function () { setTimeout(startAuto, 3000); }, { passive: true });

    root.addEventListener('click', function (e) {
        var promo = e.target.closest('.home-ad-cta-promo[data-action="navigate"]');
        if (promo && promo.dataset.page && typeof navigateTo === 'function') {
            e.preventDefault();
            navigateTo(promo.dataset.page);
        }
    });

    goTo(0);
    startAuto();
}

async function loadHomeAdCarousel(babyId) {
    var mount = document.getElementById('home-ad-mount');
    if (!mount) return;
    try {
        var url = API + '/api/home/ads';
        if (babyId) url += '?baby_id=' + encodeURIComponent(babyId);
        var res = await fetch(url, { headers: typeof authHeaders === 'function' ? authHeaders() : {} });
        if (!res.ok) { mount.remove(); return; }
        var data = await res.json();
        if (!data.items || !data.items.length) { mount.remove(); return; }
        mount.outerHTML = renderHomeAdCarousel(data, babyId);
        var carousel = document.querySelector('.home-ad-carousel');
        initHomeAdCarousel(carousel);
    } catch (e) {
        mount.remove();
    }
}
