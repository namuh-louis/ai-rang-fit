/**
 * 금융 가이드 — 보험·증권·은행 TOP3 + 증여신고
 */
(function () {
  var guideData = null;

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtWon(n) {
    if (n == null || isNaN(n)) return '';
    return Number(n).toLocaleString() + '원/월';
  }

  function loadGuide() {
    var apiBase = typeof API !== 'undefined' ? API : '';
    var headers = typeof authHeaders === 'function' ? authHeaders() : {};
    return fetch(apiBase + '/api/finance-guide', { headers: headers })
      .then(function (r) {
        if (!r.ok) throw new Error('가이드를 불러올 수 없습니다');
        return r.json();
      })
      .then(function (data) {
        guideData = data;
        return data;
      });
  }

  function renderList(items, cls) {
    if (!items || !items.length) return '';
    return (
      '<ul class="' +
      (cls || 'fin-guide-list') +
      '">' +
      items
        .map(function (x) {
          return '<li>' + esc(x) + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function renderKvRows(rows) {
    if (!rows || !rows.length) return '';
    return (
      '<div class="fin-guide-kv-grid">' +
      rows
        .map(function (r) {
          return (
            '<div class="fin-guide-kv-row">' +
            '<span class="fin-guide-kv-label">' +
            esc(r.label) +
            '</span>' +
            '<span class="fin-guide-kv-value">' +
            esc(r.value) +
            '</span>' +
            (r.note ? '<p class="fin-guide-kv-note">' + esc(r.note) + '</p>' : '') +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderInsuranceCard(item) {
    return (
      '<article class="hub-card fin-guide-card">' +
      '<div class="fin-guide-card-head">' +
      '<span class="fin-guide-rank">' +
      item.rank +
      '</span>' +
      '<div class="fin-guide-card-title-wrap">' +
      '<h3 class="fin-guide-card-title">' +
      esc(item.product) +
      '</h3>' +
      '<p class="fin-guide-card-sub">' +
      esc(item.company) +
      '</p>' +
      '</div>' +
      (item.premium_monthly
        ? '<span class="fin-guide-premium">' + fmtWon(item.premium_monthly) + '</span>'
        : '') +
      '</div>' +
      (item.coverage
        ? '<p class="fin-guide-meta"><span>보장</span> ' + esc(item.coverage) + '</p>'
        : '') +
      renderList(item.highlights, 'fin-guide-highlights') +
      (item.note ? '<p class="fin-guide-note">' + esc(item.note) + '</p>' : '') +
      '</article>'
    );
  }

  function renderSecuritiesCard(item) {
    var rows = [
      { label: '미성년 계좌', value: item.minor_account },
      { label: '투자 상품', value: item.investment },
      { label: '수수료 혜택', value: item.fee_benefit },
      { label: '세제 혜택', value: item.tax_benefit },
      { label: '연금·일반', value: item.pension },
    ].filter(function (r) {
      return r.value;
    });

    return (
      '<article class="hub-card fin-guide-card fin-guide-card-sec">' +
      '<div class="fin-guide-card-head">' +
      '<span class="fin-guide-rank">' +
      item.rank +
      '</span>' +
      '<h3 class="fin-guide-card-title">' +
      esc(item.company) +
      '</h3>' +
      '</div>' +
      renderKvRows(rows) +
      (item.note ? '<p class="fin-guide-note">' + esc(item.note) + '</p>' : '') +
      '</article>'
    );
  }

  function renderBankCard(item) {
    return (
      '<article class="hub-card fin-guide-card">' +
      '<div class="fin-guide-card-head">' +
      '<span class="fin-guide-rank">' +
      item.rank +
      '</span>' +
      '<div class="fin-guide-card-title-wrap">' +
      '<h3 class="fin-guide-card-title">' +
      esc(item.product) +
      '</h3>' +
      '<p class="fin-guide-card-sub">' +
      esc(item.company) +
      '</p>' +
      '</div>' +
      (item.rate ? '<span class="fin-guide-rate-badge">' + esc(item.rate) + '</span>' : '') +
      '</div>' +
      (item.term ? '<p class="fin-guide-meta"><span>가입기간</span> ' + esc(item.term) + '</p>' : '') +
      (item.preferential && item.preferential.length
        ? '<div class="fin-guide-section-label">우대 조건</div>' +
          renderList(item.preferential, 'fin-guide-highlights')
        : '') +
      (item.note ? '<p class="fin-guide-note">' + esc(item.note) + '</p>' : '') +
      '</article>'
    );
  }

  function renderGiftSection(data) {
    var limits = (data.limits || []).map(function (l) {
      return {
        label: l.relation,
        value: l.amount,
        note: l.note,
      };
    });

    var minorTax = data.minor_tax;
    var minorTaxHtml = '';
    if (minorTax && minorTax.items && minorTax.items.length) {
      minorTaxHtml =
        '<div class="hub-card fin-gift-tax">' +
        '<h4 class="fin-guide-section-label">' +
        esc(minorTax.title || '미성년자 증여 세금') +
        '</h4>' +
        renderKvRows(minorTax.items) +
        '</div>';
    }

    var application = data.application;
    var applicationHtml = '';
    if (application) {
      var methodsHtml = (application.methods || [])
        .map(function (m) {
          return (
            '<div class="fin-guide-kv-row">' +
            '<span class="fin-guide-kv-label">' +
            esc(m.name) +
            '</span>' +
            '<span class="fin-guide-kv-value">' +
            esc(m.desc) +
            '</span>' +
            '</div>'
          );
        })
        .join('');
      applicationHtml =
        '<div class="hub-card fin-gift-application">' +
        '<h4 class="fin-guide-section-label">' +
        esc(application.title || '증여세 신고 절차') +
        '</h4>' +
        '<p class="fin-guide-subheading">신고 방법</p>' +
        '<div class="fin-guide-kv-grid">' +
        methodsHtml +
        '</div>' +
        (application.documents && application.documents.length
          ? '<p class="fin-guide-subheading">준비 서류</p>' +
            renderList(application.documents, 'fin-guide-list')
          : '') +
        '</div>';
    }

    var steps = (data.steps || [])
      .map(function (s, i) {
        return (
          '<li class="fin-gift-step">' +
          '<span class="fin-gift-step-num">' +
          (i + 1) +
          '</span>' +
          '<p class="fin-gift-step-text">' +
          esc(s) +
          '</p>' +
          '</li>'
        );
      })
      .join('');

    return (
      '<div class="hub-card fin-gift-intro">' +
      '<h3 class="fin-guide-section-title">' +
      esc(data.title) +
      '</h3>' +
      '<p class="fin-guide-tab-desc">' +
      esc(data.summary) +
      '</p>' +
      '</div>' +
      minorTaxHtml +
      '<div class="hub-card fin-gift-limits">' +
      '<h4 class="fin-guide-section-label">관계별 비과세 한도</h4>' +
      renderKvRows(limits) +
      '</div>' +
      applicationHtml +
      '<div class="hub-card fin-gift-steps">' +
      '<h4 class="fin-guide-section-label">증여 실무 순서</h4>' +
      '<ol class="fin-gift-step-list">' +
      steps +
      '</ol>' +
      '</div>' +
      (data.tips && data.tips.length
        ? '<div class="hub-card fin-gift-tips">' +
          '<h4 class="fin-guide-section-label">실무 팁</h4>' +
          renderList(data.tips, 'fin-guide-list') +
          '</div>'
        : '')
    );
  }

  function renderTab(tab) {
    var el = document.getElementById('finGuideContent');
    if (!el || !guideData) return;

    var html = '';
    if (tab === 'insurance') {
      html =
        '<p class="fin-guide-tab-desc">' +
        esc((guideData.insurance && guideData.insurance.intro) || '') +
        '</p>' +
        (guideData.insurance.items || []).map(renderInsuranceCard).join('');
    } else if (tab === 'securities') {
      html =
        '<p class="fin-guide-tab-desc">' +
        esc((guideData.securities && guideData.securities.intro) || '') +
        '</p>' +
        (guideData.securities.comparison_note
          ? '<p class="fin-guide-compare-note">' +
            esc(guideData.securities.comparison_note) +
            '</p>'
          : '') +
        (guideData.securities.items || []).map(renderSecuritiesCard).join('');
    } else if (tab === 'bank') {
      html =
        '<p class="fin-guide-tab-desc">' +
        esc((guideData.bank && guideData.bank.intro) || '') +
        '</p>' +
        (guideData.bank.items || []).map(renderBankCard).join('');
    } else if (tab === 'gift') {
      html = renderGiftSection(guideData.gift_reporting || {});
    }

    if (guideData.disclaimer) {
      html +=
        '<p class="fin-guide-disclaimer">' + esc(guideData.disclaimer) + '</p>';
    }
    el.innerHTML = html;
  }

  function switchFinGuideTab(tab) {
    document.querySelectorAll('#finGuideTabs .hub-tab-btn').forEach(function (btn) {
      btn.classList.toggle('hub-tab-btn-active', btn.dataset.finTab === tab);
    });
    renderTab(tab);
  }

  function initFinanceGuide(initialTab) {
    var tab = initialTab || 'insurance';

    var tabsEl = document.getElementById('finGuideTabs');
    if (tabsEl && !tabsEl.dataset.bound) {
      tabsEl.dataset.bound = '1';
      tabsEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-fin-tab]');
        if (btn) switchFinGuideTab(btn.dataset.finTab);
      });
    }

    var content = document.getElementById('finGuideContent');
    if (content) content.innerHTML = '<p class="fin-guide-loading">불러오는 중…</p>';

    return loadGuide()
      .then(function () {
        switchFinGuideTab(tab);
      })
      .catch(function (err) {
        if (content) {
          content.innerHTML =
            '<p class="fin-guide-error">' + esc(err.message || '오류') + '</p>';
        }
      });
  }

  window.initFinanceGuide = initFinanceGuide;
  window.switchFinGuideTab = switchFinGuideTab;
})();
