/**
 * 全画面共通の PDF／印刷メニュー（オーバーレイ）
 */
(function (global) {
  const OVERLAY_ID = 'maishinPdfMenuOverlay';

  function closeMenu() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.style.display = 'none';
  }

  function openMenu(options) {
    const title = options.title || '📄 PDF出力';
    const subtitle = options.subtitle || '出力する内容を選択してください';
    const items = options.items || [];

    let ov = document.getElementById(OVERLAY_ID);
    if (!ov) {
      ov = document.createElement('div');
      ov.id = OVERLAY_ID;
      ov.style.cssText =
        'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4);';
      ov.addEventListener('click', (e) => {
        if (e.target === ov) closeMenu();
      });
      document.body.appendChild(ov);
    }

    const btnHtml = items
      .map((it, i) => {
        const id = 'maishinPdfBtn' + i;
        return (
          `<button type="button" id="${id}" data-pdf-idx="${i}"` +
          ` style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border:1.5px solid var(--ms-navy-border,#1e293b);border-radius:9px;background:var(--ms-surface2,#f1f5f9);cursor:pointer;font-family:inherit;font-size:13px;color:var(--ms-text,#1e293b);text-align:left;width:100%;"` +
          ` onmouseover="this.style.background='var(--ms-accent-light,#dbeafe)'" onmouseout="this.style.background='var(--ms-surface2,#f1f5f9)'">` +
          `<span>${it.label}</span>` +
          (it.meta
            ? `<span style="font-size:10px;color:var(--ms-text-muted,#64748b);background:#fff;border:1px solid var(--ms-border-light,#cbd5e1);border-radius:4px;padding:2px 7px;white-space:nowrap;">${it.meta}</span>`
            : '') +
          `</button>`
        );
      })
      .join('');

    ov.innerHTML =
      `<div style="background:#fff;border:2px solid var(--ms-navy-border,#1e293b);border-radius:16px;padding:28px 24px 20px;width:380px;max-width:96vw;box-shadow:0 12px 40px rgba(11,18,32,.2);">` +
      `<div style="font-size:16px;font-weight:700;margin-bottom:4px;color:var(--ms-text,#1e293b);">${title}</div>` +
      `<div style="font-size:12px;color:var(--ms-text-muted,#64748b);margin-bottom:18px;">${subtitle}</div>` +
      `<div style="display:flex;flex-direction:column;gap:7px;">${btnHtml}</div>` +
      `<button type="button" id="maishinPdfCancel" style="margin-top:14px;width:100%;padding:9px;border:1.5px solid var(--ms-navy-border,#1e293b);border-radius:9px;background:none;cursor:pointer;font-family:inherit;font-size:13px;color:var(--ms-text-muted,#64748b);">キャンセル</button>` +
      `</div>`;

    ov.querySelector('#maishinPdfCancel').addEventListener('click', closeMenu);
    items.forEach((it, i) => {
      const btn = ov.querySelector(`[data-pdf-idx="${i}"]`);
      if (btn && typeof it.onClick === 'function') {
        btn.addEventListener('click', () => {
          closeMenu();
          it.onClick();
        });
      }
    });

    ov.style.display = 'flex';
  }

  function runBrowserPrint(buildCss, beforePrint) {
    let ps = document.getElementById('maishinPrintStyle');
    if (!ps) {
      ps = document.createElement('style');
      ps.id = 'maishinPrintStyle';
      document.head.appendChild(ps);
    }
    if (typeof beforePrint === 'function') beforePrint();
    ps.textContent = typeof buildCss === 'function' ? buildCss() : buildCss;
    const cleanup = () => {
      ps.textContent = '';
    };
    const after = () => {
      cleanup();
      window.removeEventListener('afterprint', after);
    };
    window.addEventListener('afterprint', after);
    const run = () => {
      try {
        window.print();
      } catch (e) {
        alert(
          '印刷ダイアログを開けませんでした。ブラウザの印刷の許可を確認してください。'
        );
        cleanup();
      }
    };
    if ('requestAnimationFrame' in window) {
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(run, 100)));
    } else {
      setTimeout(run, 400);
    }
  }

  global.MaishinPdfMenu = { openMenu, closeMenu, runBrowserPrint };
})(typeof window !== 'undefined' ? window : globalThis);
