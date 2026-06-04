/**
 * 玄関メニューと同じ8項目 — 各画面のサイドナビ（maishin-theme.css の .ms-nav-item）
 */
(function (global) {
  const ITEMS = [
    { id: 'list', label: '現場一覧', icon: '📋', href: 'kakou.html?tab=gantt' },
    { id: 'assign', label: '作業配置', icon: '👷', href: 'genba.html?page=assign' },
    { id: 'kreport', label: '加工日報', icon: '📝', href: 'kakou.html?tab=report' },
    { id: 'fnippo', label: '現場日報', icon: '📊', href: 'genba.html?page=nippo' },
    { id: 'production', label: '歩掛り', icon: '⚙️', href: 'kakou.html?tab=production' },
    { id: 'unit-sales', label: 'ユニット販売', icon: '🔗', href: 'kakou.html?tab=unit-sales' },
    { id: 'costs', label: '現場原価管理', icon: '💰', href: 'genba.html?page=costs' },
    { id: 'master', label: 'マスタ登録', icon: '🗂️', href: 'master.html' },
  ];

  const TAB_TO_NAV = {
    gantt: 'list',
    report: 'kreport',
    production: 'production',
    'unit-sales': 'unit-sales',
  };
  const PAGE_TO_NAV = {
    assign: 'assign',
    nippo: 'fnippo',
    costs: 'costs',
  };

  function renderItem(it, activeId) {
    const active = it.id === activeId;
    const cls = 'ms-nav-item' + (active ? ' active' : '');
    return (
      `<a href="${it.href}" class="${cls}" data-maishin-nav="${it.id}">` +
      `<span class="ms-nav-icon" aria-hidden="true">${it.icon}</span>` +
      `<span class="ms-nav-label">${it.label}</span></a>`
    );
  }

  function renderNav(container, options) {
    if (!container) return;
    const activeId = (options && options.activeId) || '';
    container.innerHTML = ITEMS.map((it) => renderItem(it, activeId)).join('');
  }

  function syncActive(activeId) {
    document.querySelectorAll('[data-maishin-nav]').forEach((el) => {
      el.classList.toggle('active', el.dataset.maishinNav === activeId);
    });
  }

  function navIdForKakouTab(tab) {
    return TAB_TO_NAV[tab] || '';
  }

  function navIdForGenbaPage(page) {
    return PAGE_TO_NAV[page] || '';
  }

  global.MaishinNav = {
    ITEMS,
    renderNav,
    syncActive,
    navIdForKakouTab,
    navIdForGenbaPage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
