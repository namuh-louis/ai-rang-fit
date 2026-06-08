/**
 * 아이랑 핏 — 제휴(파트너스) 클릭 추적
 */
function affiliateEscape(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

async function openAffiliateLink(productKey, platform, slot, babyId) {
    if (!productKey) return;
    platform = platform || 'coupang';
    slot = slot || 'shop';
    babyId = babyId || (typeof currentBabyId !== 'undefined' ? currentBabyId : null);
    try {
        const res = await fetch(API + '/api/affiliate/click', {
            method: 'POST',
            headers: Object.assign(
                { 'Content-Type': 'application/json' },
                typeof authHeaders === 'function' ? authHeaders() : {}
            ),
            body: JSON.stringify({
                product_key: productKey,
                platform: platform,
                slot: slot,
                baby_id: babyId,
            }),
        });
        if (!res.ok) throw new Error('click ' + res.status);
        const data = await res.json();
        if (data.redirect_url) {
            window.open(data.redirect_url, '_blank', 'noopener,noreferrer');
        }
    } catch (e) {
        if (typeof showToast === 'function') {
            showToast('링크를 열 수 없습니다', '');
        }
    }
}

function affiliateShopLink(productKey, platform, label) {
    platform = platform || 'coupang';
    label = label || '보기';
    return '<button type="button" class="shop-affiliate-btn" data-product-key="' +
        affiliateEscape(productKey) + '" data-platform="' + platform + '">' + label + '</button>';
}

document.addEventListener('click', function (e) {
    var btn = e.target.closest('.shop-affiliate-btn, .home-ad-cta-btn[data-product-key]');
    if (!btn || !btn.dataset.productKey) return;
    e.preventDefault();
    var slot = btn.dataset.slot || 'shop';
    var babyId = btn.dataset.babyId || null;
    openAffiliateLink(btn.dataset.productKey, btn.dataset.platform, slot, babyId);
});
