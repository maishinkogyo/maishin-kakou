
// ══ GANTT ══
function showPdfMenu(){
  if(typeof MaishinPdfMenu==='undefined'){alert('PDFメニューを読み込めませんでした。');return;}
  MaishinPdfMenu.openMenu({
    items:[
      {label:'📋 現場一覧（一覧）',meta:'A3 横',onClick:()=>exportPdf('gantt','A3 landscape')},
      {label:'📋 現場一覧（一覧）',meta:'A4 横',onClick:()=>exportPdf('gantt','A4 landscape')},
      {label:'📝 日報',meta:'A4 縦',onClick:()=>exportPdf('report')},
      {label:'🔗 ユニット販売',meta:'A4 縦',onClick:()=>exportPdf('unit-sales')},
    ],
  });
}
function closePdfMenu(){if(typeof MaishinPdfMenu!=='undefined')MaishinPdfMenu.closeMenu();}

function escHtml(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function ganttPrintColW(pageSize){
  return pageSize.includes('A4')?24:30;
}

/** 印刷用：日付列ごとの縦線（グラデーションより印刷で確実） */
function ganttPrintVlinesHtml(days,colW){
  let h='';
  for(let i=0;i<=days;i++)h+=`<div class="gantt-print-vline" style="left:${i*colW}px"></div>`;
  return`<div class="gantt-print-vlines" aria-hidden="true">${h}</div>`;
}

function ganttPrintContentCss(){
  return`
  #ganttPrintWrap .gantt-print-root{
    box-sizing:border-box;padding:8mm;font-family:"Hiragino Sans","Meiryo",sans-serif;font-size:11px;color:#000;background:#fff;
  }
  #ganttPrintWrap .gantt-print-title{font-size:15px;margin:0 0 10px;}
  #ganttPrintWrap .gantt-print-container{
    overflow:hidden;
    display:inline-block;
    max-width:100%;
  }
  #ganttPrintWrap .gantt-print-hrow,#ganttPrintWrap .gantt-print-hrow2,#ganttPrintWrap .gantt-print-row{
    display:flex;border-bottom:1px solid #94a3b8;
  }
  #ganttPrintWrap .gantt-print-row:last-child{border-bottom:none;}
  #ganttPrintWrap .gantt-print-hlabel,#ganttPrintWrap .gantt-print-hlabel2,#ganttPrintWrap .gantt-print-label{
    width:200px;flex-shrink:0;padding:4px 6px;
    border-right:2px solid #64748b;
    background:#f8fafc;
    box-sizing:border-box;
  }
  #ganttPrintWrap .gantt-print-hlabel2{font-size:10px;font-weight:700;color:#64748b;}
  #ganttPrintWrap .gantt-print-label{font-size:11px;line-height:1.35;min-height:40px;}
  #ganttPrintWrap .gantt-print-num{font-size:10px;color:#64748b;font-weight:700;}
  #ganttPrintWrap .gantt-print-name{font-weight:700;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  #ganttPrintWrap .gantt-print-chart{
    position:relative;
    flex-shrink:0;
    box-sizing:border-box;
  }
  #ganttPrintWrap .gantt-print-vlines{
    position:absolute;inset:0;pointer-events:none;z-index:2;
  }
  #ganttPrintWrap .gantt-print-vline{
    position:absolute;top:0;bottom:0;width:1px;background:#475569;
  }
  #ganttPrintWrap .gantt-mcell{
    position:relative;z-index:1;
    font-size:11px;font-weight:700;text-align:center;padding:4px 0;background:#e2e8f0;
    border-left:1px solid #475569;
    border-bottom:1px solid #94a3b8;
    box-sizing:border-box;
  }
  #ganttPrintWrap .gantt-dcell{
    position:relative;z-index:1;
    text-align:center;font-size:10px;padding:3px 0;
    border-left:1px solid #475569;
    border-bottom:2px solid #64748b;
    box-sizing:border-box;
  }
  #ganttPrintWrap .gantt-dcell .dow{display:block;font-size:8px;opacity:.7;}
  #ganttPrintWrap .gantt-dcell.today-h{background:rgba(37,99,235,.12);}
  #ganttPrintWrap .gantt-dcell.sun-h{color:#dc2626;background:#fff5f5;}
  #ganttPrintWrap .gantt-dcell.sat-h{color:#2563eb;background:#f0f7ff;}
  #ganttPrintWrap .gantt-print-bar-area{
    position:relative;height:40px;background:#fff;
    box-sizing:border-box;
  }
  #ganttPrintWrap .gantt-print-bar-area .gbar{position:absolute;height:22px;border-radius:4px;overflow:hidden;z-index:2;}
  #ganttPrintWrap .gbar-prog{position:absolute;left:0;top:0;height:100%;opacity:.35;}
  #ganttPrintWrap .gbar-txt{position:relative;z-index:1;font-size:10px;font-weight:600;color:#fff;padding:0 5px;white-space:nowrap;}
  #ganttPrintWrap .gc-overdue{background:#dc2626!important;}
  #ganttPrintWrap .gc-urgent{background:#eab308!important;}
  #ganttPrintWrap .gc-normal{background:#2563eb!important;}
  #ganttPrintWrap .gc-done{background:#64748b!important;}
  #ganttPrintWrap .gbar-field{
    background:repeating-linear-gradient(-45deg,rgba(22,163,74,.22) 0,rgba(22,163,74,.22) 4px,rgba(22,163,74,.42) 4px,rgba(22,163,74,.42) 8px)!important;
    border:1px solid rgba(22,163,74,.55)!important;
  }
  #ganttPrintWrap .gbar-field-overdue{
    background:repeating-linear-gradient(-45deg,rgba(220,38,38,.18) 0,rgba(220,38,38,.18) 4px,rgba(220,38,38,.38) 4px,rgba(220,38,38,.38) 8px)!important;
    border:1px solid rgba(220,38,38,.55)!important;
  }
  #ganttPrintWrap .gdl-line{position:absolute;top:0;bottom:0;width:2px;background:#dc2626;z-index:3;}
  #ganttPrintWrap .gantt-status-tag{font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;display:inline-block;}
  #ganttPrintWrap .tag-overdue{background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;}
  #ganttPrintWrap .tag-urgent{background:#fef9c3;color:#a16207;border:1px solid #fde047;}
  #ganttPrintWrap .tag-normal{background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;}
  #ganttPrintWrap .legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:10px;color:#64748b;}
  #ganttPrintWrap .ldot{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle;}`;
}

function buildGanttPrintPageCss(pageSize,colW){
  return`@media print{
    @page{size:${pageSize};margin:8mm;}
    html,body{height:auto!important;min-height:0!important;overflow:visible!important;background:#fff!important;}
    body>*:not(#ganttPrintWrap){display:none!important;}
    #ganttPrintWrap{display:block!important;position:static!important;width:100%!important;overflow:visible!important;}
    #ganttPrintWrap .gbar,#ganttPrintWrap .gc-overdue,#ganttPrintWrap .gc-urgent,#ganttPrintWrap .gc-normal{
      -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;
    }
    ${ganttPrintContentCss(colW)}
  }`;
}

/** 印刷専用の軽量ガント（日×現場の背景DIVを出さない） */
function buildGanttPrintHtml(pageSize){
  const colW=ganttPrintColW(pageSize);
  const sv=document.getElementById('ganttStart').value;
  const days=Math.max(7,parseInt(document.getElementById('ganttDays').value,10)||30);
  const f=getFilters();
  const startD=sv?toD(sv):new Date(TODAY);
  const dates=[];
  for(let d=new Date(startD);dates.length<days;d.setDate(d.getDate()+1))dates.push(new Date(d));
  const filtTasks=filterGanttTasks(f);
  const totalW=days*colW;
  const gridCols=`repeat(${days}, ${colW}px)`;
  const gridW=`${totalW}px`;

  const monthStrip=dates.map((d,i)=>{
    const prev=dates[i-1];
    const isFirst=!prev||prev.getMonth()!==d.getMonth()||prev.getFullYear()!==d.getFullYear();
    const label=isFirst?`${d.getFullYear()}年${d.getMonth()+1}月`:'';
    return`<div class="gantt-mcell" style="width:${colW}px">${label}</div>`;
  }).join('');
  const vlines=ganttPrintVlinesHtml(days,colW);
  const dayStrip=dates.map(d=>{
    const dow=d.getDay();
    const isToday=d.getTime()===TODAY.getTime();
    const cls=isToday?'gantt-dcell today-h':isRedDay(d)?'gantt-dcell sun-h':dow===6?'gantt-dcell sat-h':'gantt-dcell';
    return`<div class="${cls}" style="width:${colW}px">${String(d.getDate()).padStart(2,'0')}<span class="dow">${DOW_JP[dow]}</span></div>`;
  }).join('');

  const rows=filtTasks.map(t=>{
    const pct=t.total>0?t.done/t.total:0;
    const {barHTML,dlLine}=buildGanttTimelineBars(t,startD,days,colW,10);
    const statusTag=ganttStatusTagHTML(t);
    return`<div class="gantt-print-row">
      <div class="gantt-print-label">
        <span class="gantt-print-num">No.${t.num??t.id}</span>
        <span class="gantt-print-name">${escHtml(t.name)}</span>
        ${statusTag?`<span style="display:inline-block;margin-top:2px">${statusTag}</span>`:''}
      </div>
      <div class="gantt-print-bar-area" style="width:${totalW}px">${vlines}${dlLine}${barHTML}</div>
    </div>`;
  }).join('');

  return{
    days,
    siteCount:filtTasks.length,
    colW,
    body:`
    <div class="gantt-print-container">
      <div class="gantt-print-hrow">
        <div class="gantt-print-hlabel"></div>
        <div class="gantt-print-chart gantt-month-strip" style="display:grid;grid-template-columns:${gridCols};width:${gridW}">${monthStrip}${vlines}</div>
      </div>
      <div class="gantt-print-hrow2">
        <div class="gantt-print-hlabel2">現場</div>
        <div class="gantt-print-chart gantt-day-strip" style="display:grid;grid-template-columns:${gridCols};width:${gridW}">${dayStrip}${vlines}</div>
      </div>
      ${rows||'<div style="padding:16px;color:#64748b">表示する現場がありません</div>'}
    </div>`,
    legend:`
      <span><span class="ldot" style="background:#dc2626"></span>超過</span>
      <span><span class="ldot" style="background:#eab308"></span>至急</span>
      <span><span class="ldot" style="background:#2563eb"></span>加工</span>
      <span><span class="ldot ldot-field"></span>現場</span>
      <span><span class="ldot" style="background:#16a34a"></span>完了</span>`,
  };
}

function schedulePrintCleanup(cleanup){
  let done=false;
  const run=()=>{
    if(done)return;
    done=true;
    cleanup();
    window.removeEventListener('afterprint',run);
  };
  window.addEventListener('afterprint',run);
  setTimeout(run,120000);
}

function ganttPrintPrepare(pageSizeOverride){
  const pageSize=pageSizeOverride||'A3 landscape';
  closePdfMenu();
  switchMainTab('gantt');
  renderGantt();
  const built=buildGanttPrintHtml(pageSize);
  if(!built.siteCount){
    alert('印刷する一覧がありません');
    return null;
  }
  const heavy=built.days*built.siteCount;
  if(heavy>2000&&!confirm(`印刷データが大きくなります（${built.siteCount}現場×${built.days}日）。\n通信が途切れる場合は「表示日数」を減らしてください。\nこのまま続けますか？`)){
    return null;
  }
  const startVal=document.getElementById('ganttStart')?.value||'';
  const sub=startVal?`（表示開始 ${startVal}・${built.days}日間）`:'';
  return{pageSize,built,sub};
}

function exportGanttPrint(pageSizeOverride){
  const prep=ganttPrintPrepare(pageSizeOverride);
  if(!prep)return;
  const{pageSize,built,sub}=prep;
  let wrap=document.getElementById('ganttPrintWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='ganttPrintWrap';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML=`
    <div class="gantt-print-root">
      <h1 class="gantt-print-title">現場一覧${escHtml(sub)}</h1>
      ${built.body}
      <div class="legend">${built.legend}</div>
    </div>`;
  let ps=document.getElementById('commonPrintStyle');
  if(!ps){ps=document.createElement('style');ps.id='commonPrintStyle';document.head.appendChild(ps);}
  ps.textContent=buildGanttPrintPageCss(pageSize,built.colW);
  const cleanup=()=>{ps.textContent='';wrap.innerHTML='';};
  schedulePrintCleanup(cleanup);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    try{window.print();}
    catch(e){
      cleanup();
      alert('印刷ダイアログを開けませんでした。');
    }
  }));
}

function buildPrintCss(tab,pageSizeOverride){
  const defaultSizes={production:'A4 landscape'};
  const pageSize=pageSizeOverride||defaultSizes[tab]||'A4 portrait';
  const tabSel=`#tab-${tab}`;
  const tabDisplay=tab==='gantt'?'flex':'block';
  const extraMap={
    done:`
      ${tabSel}.active{display:block!important;}
      #doneList{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:10px!important;}
      .task-card{break-inside:avoid!important;page-break-inside:avoid!important;}`,
    production:`
      ${tabSel}.active{display:block!important;}
      .prod-ctrl-inline select,.prod-ctrl-inline span,.prod-toolbar-wrap{display:none!important;}
      .prod-wrap{overflow:visible!important;}`,
    report:`
      ${tabSel}.active{display:block!important;}
      .report-form-section{display:none!important;}
      .report-list-section{display:block!important;}`,
    'unit-sales':`
      ${tabSel}.active{display:block!important;}
      #usSaleForm{display:none!important;}`,
  };
  return`@media print{
    @page{size:${pageSize};margin:10mm;}
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
    body{background:#fff!important;}
    body *{visibility:hidden!important;}
    .kakou-shell,.app-main,${tabSel}.active,${tabSel}.active *{visibility:visible!important;}
    .side-nav,.mobile-bottom-nav,.mobile-more-sheet,
    #cloudWarn,#flash,#maishinPdfMenuOverlay,#lockScreen,
    .task-modal-overlay,.rpt-edit-overlay,
    #maishinAuthGate{display:none!important;visibility:hidden!important;}
    .kakou-shell{display:block!important;position:static!important;width:100%!important;}
    .app-main{display:block!important;margin:0!important;padding:0!important;width:100%!important;max-width:100%!important;}
    .main-tabs{display:none!important;}
    .main-content{display:none!important;}
    ${tabSel}.active{
      display:${tabDisplay}!important;
      position:relative!important;inset:auto!important;
      overflow:visible!important;width:100%!important;
      padding:0!important;background:#fff!important;
    }
    ${extraMap[tab]||''}
  }`;
}

function exportPdf(tab,pageSizeOverride){
  if(tab==='active')tab='gantt';
  if(tab==='gantt'){exportGanttPrint(pageSizeOverride);return;}
  closePdfMenu();
  switchMainTab(tab);
  let ps=document.getElementById('commonPrintStyle');
  if(!ps){ps=document.createElement('style');ps.id='commonPrintStyle';document.head.appendChild(ps);}
  ps.textContent=buildPrintCss(tab,pageSizeOverride);
  const cleanup=()=>{ps.textContent='';};
  schedulePrintCleanup(cleanup);
  const runPrint=()=>{
    try{window.print();}
    catch(e){alert('印刷ダイアログを開けませんでした。ブラウザのポップアップ／印刷の許可を確認してください。');cleanup();}
  };
  if('requestAnimationFrame' in window){
    requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(runPrint,100)));
  }else{
    setTimeout(runPrint,400);
  }
}

function printCurrentPage(){showPdfMenu();}
function printGantt(){exportGanttPrint('A3 landscape');}

function ganttDateInputVal(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function ganttToday(){
  document.getElementById('ganttStart').value=ganttDateInputVal(TODAY);
  renderGantt();
  const ganttScroll=document.getElementById('ganttScroll');
  if(ganttScroll) ganttScroll.scrollLeft=0;
}

function renderGantt(){
  const sv=document.getElementById('ganttStart').value;

  const days=Math.max(7, parseInt(document.getElementById('ganttDays').value, 10) || 30);

  const f=getFilters();
  const startD=sv?toD(sv):new Date(TODAY);

  const dates=[];
  for(let d=new Date(startD);dates.length<days;d.setDate(d.getDate()+1))dates.push(new Date(d));

  const filtTasks=filterGanttTasks(f);
  const totalW=days*COL_W;
  const todayOff=Math.round((TODAY-startD)/86400000);

  // ── Month strip (top row) ──
  const monthGroups=[];
  dates.forEach((d,i)=>{
    const mk=`${d.getFullYear()}-${d.getMonth()}`;
    if(!monthGroups.length||monthGroups[monthGroups.length-1].key!==mk)
      monthGroups.push({key:mk,label:`${d.getFullYear()}年${d.getMonth()+1}月`,count:1,startIdx:i});
    else monthGroups[monthGroups.length-1].count++;
  });
  const monthStrip=monthGroups.map(g=>`<div class="gantt-mcell" style="grid-column:span ${g.count}">${g.label}</div>`).join('');

  // ── Day strip (bottom row) ──
  const dayStrip=dates.map((d,i)=>{
    const dow=d.getDay();
    const isToday=d.getTime()===TODAY.getTime();
    const cls=isToday?'gantt-dcell today-h':isRedDay(d)?'gantt-dcell sun-h':dow===6?'gantt-dcell sat-h':'gantt-dcell';
    return`<div class="${cls}">${String(d.getDate()).padStart(2,'0')}<span class="dow">${DOW_JP[dow]}</span></div>`;
  }).join('');

  // BG cols
  const bgCols=dates.map((d,i)=>{
    const dow=d.getDay();
    const isToday=d.getTime()===TODAY.getTime();
    const cls=isToday?'gbg today-bg':(isRedDay(d)||dow===6)?'gbg wkend':'gbg';
    return`<div class="${cls}" style="left:${i*COL_W}px;width:${COL_W}px"></div>`;
  }).join('');

  const todayLine=todayOff>=0&&todayOff<days
    ?`<div class="gtoday-line" style="left:${todayOff*COL_W+COL_W/2-1}px"></div>`:'';

  const rows=filtTasks.map(t=>{
    const pct=t.total>0?t.done/t.total:0;
    const {barHTML,dlLine}=buildGanttTimelineBars(t,startD,days);
    const fieldHint=needsFieldDateHint(t)?'<span class="gantt-field-hint">現場日付未設定</span>':'';

    const pctVal=Math.round(pct*100);
    const statusTag=ganttStatusTagHTML(t);
    const unitLabel=(t.unitType&&t.unitType!=='none')
      ?`<span style="font-size:10px;color:#2563eb;background:#dbeafe;border:1px solid #93c5fd;padding:1px 5px;border-radius:4px;flex-shrink:0;white-space:nowrap">📦</span>`:'';

    return`
    <div class="gantt-row">
      <div class="gantt-row-label" role="button" tabindex="0" title="クリックで編集" onclick="openTaskModal(${t.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTaskModal(${t.id});}" style="flex-direction:column;align-items:flex-start;gap:3px;padding:5px 8px 5px 0;">
        <div style="display:flex;align-items:center;gap:5px;width:100%;overflow:hidden;">
          <span style="font-family:'DM Mono',monospace;font-size:10px;font-weight:700;color:var(--text-muted);background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:1px 5px;flex-shrink:0">No.${t.num??t.id}</span>
          <span class="lname" title="${t.name}" style="flex:1">${t.name}</span>
          ${unitLabel}
        </div>
        <div style="display:flex;align-items:center;gap:6px;width:100%;flex-wrap:wrap;">
          ${statusTag}${fieldHint}
          <div style="flex:1;min-width:60px;height:4px;background:var(--progress-bg);border-radius:99px;overflow:hidden;">
            <div style="width:${pctVal}%;height:100%;border-radius:99px;background:${t.complete?'var(--ok)':pctVal>=70?'var(--ok)':pctVal>=40?'var(--accent)':'var(--warn)'};"></div>
          </div>
          <span style="font-size:10px;font-family:'DM Mono',monospace;font-weight:700;color:${t.complete?'var(--ok)':pctVal>=70?'var(--ok)':pctVal>=40?'var(--accent)':'var(--warn)'};white-space:nowrap;flex-shrink:0">${pctVal}%</span>
        </div>
      </div>
      <div class="gantt-bar-area" style="width:${totalW}px">
        <div class="gantt-area-grid" aria-hidden="true"></div>
        ${bgCols}${todayLine}${dlLine}${barHTML}
      </div>
    </div>`;
  }).join('');

  const ganttEl=document.getElementById('ganttContainer');
  const gridCols=`repeat(${days}, ${COL_W}px)`;
  const gridW=`${totalW}px`;
  ganttEl.style.setProperty('--gantt-col-w', COL_W + 'px');
  ganttEl.style.setProperty('--gantt-day-count', String(days));
  ganttEl.innerHTML=`
    <div class="gantt-hrow">
      <div class="gantt-hlabel"></div>
      <div class="gantt-month-strip" style="grid-template-columns:${gridCols};width:${gridW}">${monthStrip}</div>
    </div>
    <div class="gantt-hrow2">
      <div class="gantt-hlabel2">現場</div>
      <div class="gantt-day-strip" style="grid-template-columns:${gridCols};width:${gridW}">${dayStrip}</div>
    </div>
    ${rows||'<div style="color:var(--text-muted);padding:20px;text-align:center;">表示する現場がありません</div>'}
  `;

  // スクロール開始位置を0に設定
  const ganttScroll = document.getElementById('ganttScroll');
  if(ganttScroll) {
    ganttScroll.scrollLeft = 0;
    ganttScroll.scrollTop = 0;
  }

}
