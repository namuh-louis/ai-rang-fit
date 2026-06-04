/**
 * 3D 스타일 아이콘 (Fluent Emoji 3D + 커스텀 SVG)
 * 대변(stool/bowel): 3D 💩 이모지
 */
const ICONS_3D_BASE = '/static/icons/3d/';

const ICONS_3D = {
    baby: 'baby.svg',
    boy: 'boy.svg',
    girl: 'girl.svg',
    feeding: 'feeding.png',
    sleep: 'sleep.png',
    diaper: 'bowel.png',
    growth: 'growth.png',
    home: 'home.png',
    record: 'record.png',
    memories: 'memories.png',
    play: 'play.png',
    finance: 'finance.png',
    vaccine: 'vaccine.png',
    stats: 'stats.png',
    timeline: 'timeline.png',
    heatmap: 'heatmap.png',
    milestone: 'milestone.png',
    birthday: 'birthday.png',
    family: 'family.png',
    chat: 'chat.png',
    ai: 'ai.png',
    diet: 'diet.png',
    insurance: 'insurance.png',
    bank: 'bank.png',
    gift: 'gift.png',
    check: 'check.png',
    warning: 'warning.png',
    robot: 'robot.png',
    motor: 'motor.png',
    language: 'language.png',
    social: 'social.png',
    cognitive: 'cognitive.png',
    logo: 'logo.png',
    chart: 'chart.png',
    fortune: 'birthday.png',
    shopping: 'gift.png',
};

const ICONS_3D_GENDER = { male: 'boy', female: 'girl' };

function isStoolIconKey(key) {
    return key === 'stool' || key === 'bowel';
}

function icon3dSrc(key) {
    if (isStoolIconKey(key)) return null;
    const file = ICONS_3D[key];
    return file ? ICONS_3D_BASE + file : null;
}

/** 대변: 3D 💩 HTML */
function stoolIcon3dHtml(size, noAnim) {
    size = size || 22;
    var anim = noAnim ? '' : ' icon-3d-anim';
    var fs = Math.max(Math.round(size * 0.88), 12);
    return '<span class="icon-stool-3d' + anim + '" style="width:' + size + 'px;height:' + size + 'px;" aria-hidden="true">' +
        '<span class="icon-stool-emoji" style="font-size:' + fs + 'px;">💩</span></span>';
}

function mountStoolIcon3d(el, size, noAnim) {
    if (!el) return;
    size = size || 28;
    el.textContent = '';
    el.className = '';
    el.innerHTML = stoolIcon3dHtml(size, noAnim);
}

function mountDataIcon(el, key, size, noAnim) {
    if (!el) return;
    size = size || 28;
    if (isStoolIconKey(key)) {
        mountStoolIcon3d(el, size, noAnim);
        return;
    }
    const src = icon3dSrc(key);
    if (!src) return;
    el.textContent = '';
    el.className = '';
    const img = document.createElement('img');
    img.src = src;
    img.className = 'icon-3d' + (noAnim ? '' : ' icon-3d-anim');
    img.width = size;
    img.height = size;
    img.alt = '';
    el.appendChild(img);
}

function icon3d(key, className, size) {
    if (isStoolIconKey(key)) {
        var noAnim = className && className.indexOf('no-anim') >= 0;
        return stoolIcon3dHtml(size || 22, noAnim);
    }
    const src = icon3dSrc(key);
    if (!src) return '';
    className = className || 'icon-3d';
    size = size || 32;
    const anim = className.indexOf('no-anim') < 0 ? ' icon-3d-anim' : '';
    return '<img src="' + src + '" class="' + className + anim + '" width="' + size + '" height="' + size + '" alt="" loading="lazy" decoding="async">';
}

function icon3dStool(size, noAnim) {
    return stoolIcon3dHtml(size || 22, noAnim);
}

/** 패턴 차트 SVG — 3D 💩 */
function patternSvg3dDefs() {
    return '<defs>' +
        '<filter id="icon3dDrop" x="-50%" y="-50%" width="200%" height="200%">' +
        '<feDropShadow dx="0" dy="2.2" stdDeviation="1.6" flood-color="#5C4510" flood-opacity="0.32"/>' +
        '<feDropShadow dx="0" dy="-0.8" stdDeviation="0.6" flood-color="#fff" flood-opacity="0.28"/>' +
        '</filter></defs>';
}

function patternStoolIconSvg(cx, cy, size) {
    size = size || 11;
    var emSize = Math.max(size * 0.92, 8);
    return '<text x="' + cx.toFixed(1) + '" y="' + cy.toFixed(1) + '" font-size="' + emSize.toFixed(1) + '" text-anchor="middle" dominant-baseline="middle" filter="url(#icon3dDrop)">💩</text>';
}

function icon3dForGender(gender, className, size) {
    const key = ICONS_3D_GENDER[gender] || 'baby';
    return icon3d(key, className, size);
}

function setIcon3dElement(el, key, size, opts) {
    if (!el) return;
    opts = opts || {};
    size = size || 32;
    if (isStoolIconKey(key)) {
        mountStoolIcon3d(el, size, opts.noAnim);
        return;
    }
    const src = icon3dSrc(key);
    if (!src) return;
    el.innerHTML = '';
    const img = document.createElement('img');
    img.src = src;
    img.className = 'icon-3d' + (opts.header ? ' icon-3d-header' : (opts.noAnim ? '' : ' icon-3d-anim'));
    img.width = size;
    img.height = size;
    img.alt = '';
    img.loading = 'lazy';
    el.appendChild(img);
}

function updateAppHeaderBabyIcon(baby) {
    const photoEl = document.getElementById('header-baby-photo');
    if (!photoEl) return;
    if (baby && baby.profile_photo) {
        photoEl.innerHTML = '<img src="' + baby.profile_photo + '" class="header-baby-img" alt="">';
        photoEl.removeAttribute('data-icon');
        return;
    }
    const key = baby ? (ICONS_3D_GENDER[baby.gender] || 'baby') : 'baby';
    photoEl.setAttribute('data-icon', key);
    setIcon3dElement(photoEl, key, 52, { header: true });
}

function initIcons3d(root) {
    root = root || document;
    root.querySelectorAll('[data-icon]').forEach(function (el) {
        const key = el.dataset.icon;
        const size = parseInt(el.dataset.iconSize || '28', 10);
        const noAnim = el.dataset.iconAnim === 'false';
        mountDataIcon(el, key, size, noAnim);
    });
}

function enhanceIcons3d(container) {
    if (!container) return;
    initIcons3d(container);
}
