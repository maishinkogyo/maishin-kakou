// ══ 日報 ══
const WORK_TYPES = ['カッター','まげ','ユニット','ようせつ','つみこみ','におろし','うんぱん','そうじ'];
let reports = []; // {id, date, worker, rows:[{taskId,taskName,workTypes:[],hours}], overtime,late,early,memo}
let nextReportId = 1;
let reportRowCount = 0;

function initReportTab(){
  // 日付を今日にセット
  const d = document.getElementById('rptDate');
  if(!d.value) d.value = TODAY.toISOString().slice(0,10);
  // 作業者セレクト同期
  const ws = document.getElementById('rptWorker');
  const cur = ws.value;
  ws.innerHTML = '<option value="">選択してください</option>' + activeWorkers().map(w=>`<option value="${w}">${w}</option>`).join('');
  if(cur) ws.value = cur;
  // フィルター作業者セレクト
  const fw = document.getElementById('rptFilterWorker');
  const fcur = fw.value;
  fw.innerHTML = '<option value="">全員</option>' + workers.map(w=>`<option value="${w}">${w}</option>`).join('');
  if(fcur) fw.value = fcur;
  // 行が空なら1行追加
  if(!document.getElementById('reportRows').children.length) addReportRow();
  renderReportList();
}

function getActiveTaskOptions(){
  return tasks.filter(t=>!t.complete).sort((a,b)=>(a.num??a.id)-(b.num??b.id)).map(t=>`<option value="${t.id}">No.${t.num??t.id}　${taskFullName(t)}</option>`).join('');
}

function onRptSiteChange(sel){
  const inp = sel.closest('div').querySelector('.rpt-other-name');
  if(!inp) return;
  inp.style.display = sel.value==='__other__' ? '' : 'none';
  if(sel.value==='__other__') inp.focus();
}

function syncReportTaskSelects(){
  // 日報タブが開いている場合、全行のセレクトを同期
  document.querySelectorAll('#reportRows .report-row select').forEach(sel=>{
    const cur = sel.value;
    sel.innerHTML = `<option value="">タスクを選択</option>${getActiveTaskOptions()}`;
    // 選択中のタスクが完了になっていたら解除
    if(cur && tasks.find(t=>t.id===Number(cur)&&t.complete)){
      sel.value = '';
    } else if(cur){
      sel.value = cur;
    }
  });
}

function addReportRow(){
  const id = ++reportRowCount;
  const chips = WORK_TYPES.map(w=>`<span class="work-type-chip" onclick="toggleWorkType(this)">${w}</span>`).join('');
  const row = document.createElement('div');
  row.className = 'report-row';
  row.id = `rrow-${id}`;
  row.innerHTML = `
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">現場</div>
      <select onchange="onRptSiteChange(this)" style="width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;">
        <option value="">現場を選択</option>${getActiveTaskOptions()}<option value="__other__">その他</option>
      </select>
      <input type="text" class="rpt-other-name" placeholder="内容を手入力" style="display:none;margin-top:4px;width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">作業内容</div>
      <div class="work-types">${chips}</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">作業時間</div>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
        <input type="time" class="rpt-start" style="padding:5px 6px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" oninput="calcRowHours(this.closest('.report-row'))">
        <span style="font-size:12px;color:var(--text-muted)">〜</span>
        <input type="time" class="rpt-end" style="padding:5px 6px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" oninput="calcRowHours(this.closest('.report-row'))">
        <span class="rpt-hours-disp" style="font-size:12px;font-weight:700;color:var(--accent);min-width:32px;">--</span>
      </div>
    </div>
    <button type="button" onclick="this.closest('.report-row').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:4px;align-self:start;margin-top:20px;">✕</button>`;
  document.getElementById('reportRows').appendChild(row);
}

function toggleWorkType(el){
  el.classList.toggle('active');
}

function calcHoursFromTimeRange(start, end){
  if(!start||!end) return 0;
  const [sh,sm]=start.split(':').map(Number);
  const [eh,em]=end.split(':').map(Number);
  const diff=(eh*60+em)-(sh*60+sm);
  return diff>0?Math.round(diff/6)/10:0;
}

function calcRowHours(row){
  const s=row.querySelector('.rpt-start')?.value;
  const e=row.querySelector('.rpt-end')?.value;
  const h=calcHoursFromTimeRange(s,e);
  const disp=row.querySelector('.rpt-hours-disp');
  if(disp) disp.textContent=h>0?h+'h':'--';
}

let editingReportId = null; // 編集中の日報ID（nullなら新規）
let currentReportStatus = '通常';

async function saveReport(){
  const date   = document.getElementById('rptDate').value;
  const worker = document.getElementById('rptWorker').value;
  if(!date){alert('日付を入力してください');return;}
  if(!worker){alert('作業者を選択してください');return;}

  // 行データ収集
  const rows = [];
  document.querySelectorAll('#reportRows .report-row').forEach(row=>{
    const sel   = row.querySelector('select');
    const isOther = sel?.value === '__other__';
    const taskId = (!isOther && sel?.value) ? Number(sel.value) : null;
    const taskObj = taskId ? tasks.find(t=>t.id===taskId) : null;
    const taskName = isOther
      ? (row.querySelector('.rpt-other-name')?.value.trim() || 'その他')
      : (taskObj ? taskObj.name : (sel?.options[sel.selectedIndex]?.text||''));
    const wts = [...row.querySelectorAll('.work-type-chip.active')].map(c=>c.textContent);
    const startTime = row.querySelector('.rpt-start')?.value||'';
    const endTime   = row.querySelector('.rpt-end')?.value||'';
    const hrs = calcHoursFromTimeRange(startTime, endTime);
    if(taskId||isOther||hrs>0) rows.push({taskId, taskName, workTypes:wts, hours:hrs, startTime, endTime});
  });

  const status = '通常';
  if(!rows.length){alert('現場・作業時間を入力してください');return;}

  const extraTimes = getExtraTimes('rpt');
  const overtime   = timeRangeToHours(...(extraTimes.overtime.split('-')));
  const late       = timeRangeToHours(...(extraTimes.late.split('-')));
  const early      = timeRangeToHours(...(extraTimes.early.split('-')));
  const paidLeave  = timeRangeToHours(...(extraTimes.paidLeave.split('-')));
  const memo = document.getElementById('rptMemo').value.trim();

  if(editingReportId !== null){
    // 更新モード
    const rep = reports.find(r=>r.id===editingReportId);
    if(rep){ Object.assign(rep, {date, worker, rows, overtime, late, early, paidLeave, memo, status, extraTimes}); }
    try{
      const {error} = await sb.from('daily_reports').upsert({
        id:editingReportId, date, worker, rows, overtime, late, early, memo, status, extra_times:extraTimes
      });
      if(error) throw error;
      flashSaved();
    }catch(e){ console.error('日報更新失敗:',e); reportCloudException(e,'日報の更新'); return; }
    saveLocal(); resetReportForm(); renderReportList();
    flashOk('日報を更新しました');
    editingReportId = null;
    const btn = document.querySelector('.report-save-btn');
    if(btn){ btn.textContent='💾 日報を保存'; btn.style.background=''; }
    const cancelBtn = document.getElementById('rptCancelEdit');
    if(cancelBtn) cancelBtn.style.display='none';
    return;
  }

  // 新規モード：同日・同人の日報があれば行をまとめる
  const existing = reports.find(r=>r.date===date && r.worker===worker);
  if(existing){
    // 行を追記
    existing.rows = [...(existing.rows||[]), ...rows];
    // extraTimes：新しく入力されたものを優先、なければ既存を維持
    const mergedET = {...(existing.extraTimes||{})};
    ['overtime','paidLeave','late','early'].forEach(k=>{ if(extraTimes[k]) mergedET[k]=extraTimes[k]; });
    existing.extraTimes = mergedET;
    existing.overtime  = timeRangeToHours(...(mergedET.overtime?.split('-')||['','']));
    existing.late      = timeRangeToHours(...(mergedET.late?.split('-')||['','']));
    existing.early     = timeRangeToHours(...(mergedET.early?.split('-')||['','']));
    existing.paidLeave = timeRangeToHours(...(mergedET.paidLeave?.split('-')||['','']));
    // メモ：両方あれば改行で連結
    if(memo) existing.memo = existing.memo ? existing.memo+'\n'+memo : memo;
    try{
      const {error} = await sb.from('daily_reports').upsert({
        id:existing.id, date, worker, rows:existing.rows,
        overtime:existing.overtime, late:existing.late, early:existing.early,
        memo:existing.memo, status:existing.status||'通常', extra_times:existing.extraTimes
      });
      if(error) throw error;
      flashSaved();
    }catch(e){ console.error('日報結合失敗:',e); reportCloudException(e,'日報の保存'); return; }
    saveLocal(); resetReportForm(); renderReportList();
    flashOk('同じ日の日報にまとめました');
  } else {
    // 完全新規
    const rep = {id:nextReportId++, date, worker, rows, overtime, late, early, paidLeave, memo, status, extraTimes};
    reports.push(rep);
    try{
      const {error} = await sb.from('daily_reports').insert({
        id:rep.id, date:rep.date, worker:rep.worker,
        rows:rep.rows, overtime:rep.overtime, late:rep.late, early:rep.early, memo:rep.memo, status:rep.status, extra_times:rep.extraTimes
      });
      if(error) throw error;
      flashSaved();
    }catch(e){ console.error('日報保存失敗:',e); reportCloudException(e,'日報の保存'); return; }
    saveLocal(); resetReportForm(); renderReportList();
    flashOk('日報を保存しました');
  }
  editingReportId = null;
  // ボタンを「保存」に戻す
  const btn = document.querySelector('.report-save-btn');
  if(btn){ btn.textContent='💾 日報を保存'; btn.style.background=''; }
  const cancelBtn = document.getElementById('rptCancelEdit');
  if(cancelBtn) cancelBtn.style.display='none';
}

// ── 時間帯ヘルパー ──
function timeRangeToHours(start, end){
  if(!start||!end) return 0;
  const [sh,sm]=start.split(':').map(Number);
  const [eh,em]=end.split(':').map(Number);
  const diff=(eh*60+em)-(sh*60+sm);
  return diff>0 ? Math.round(diff/60*10)/10 : 0;
}
function parseTimeRange(str){
  if(!str||typeof str!=='string') return {start:'',end:''};
  const [start,end]=(str.includes('-')?str.split('-'):['','']);
  return {start:start||'',end:end||''};
}
function updateRptTimeHint(startId,endId,hintId){
  const h=timeRangeToHours(document.getElementById(startId)?.value,document.getElementById(endId)?.value);
  const el=document.getElementById(hintId);
  if(el) el.textContent=h>0?`(${h}h)`:'';
}
function getExtraTimes(prefix){
  const g=(id)=>document.getElementById(prefix+id)?.value||'';
  const mk=(s,e)=>(s&&e)?`${s}-${e}`:'';
  return {
    overtime:    mk(g('OvertimeStart'),    g('OvertimeEnd')),
    paidLeave:   mk(g('PaidLeaveStart'),   g('PaidLeaveEnd')),
    late:        mk(g('LateStart'),        g('LateEnd')),
    early:       mk(g('EarlyStart'),       g('EarlyEnd')),
    statusRange: mk(g('StatusTimeStart'),  g('StatusTimeEnd')),
    statusMemo:  document.getElementById(prefix+'StatusMemo')?.value||'',
  };
}
function setExtraTimesUI(prefix, et){
  const s=(id,v)=>{const el=document.getElementById(prefix+id);if(el)el.value=v||'';};
  const ot=parseTimeRange(et?.overtime);     s('OvertimeStart',ot.start);    s('OvertimeEnd',ot.end);
  const pl=parseTimeRange(et?.paidLeave);    s('PaidLeaveStart',pl.start);   s('PaidLeaveEnd',pl.end);
  const lt=parseTimeRange(et?.late);         s('LateStart',lt.start);        s('LateEnd',lt.end);
  const er=parseTimeRange(et?.early);        s('EarlyStart',er.start);       s('EarlyEnd',er.end);
  const sr=parseTimeRange(et?.statusRange);  s('StatusTimeStart',sr.start);  s('StatusTimeEnd',sr.end);
  s('StatusMemo', et?.statusMemo||'');
  [['OvertimeHint','OvertimeStart','OvertimeEnd'],['PaidLeaveHint','PaidLeaveStart','PaidLeaveEnd'],
   ['LateHint','LateStart','LateEnd'],['EarlyHint','EarlyStart','EarlyEnd'],
   ['StatusTimeHint','StatusTimeStart','StatusTimeEnd']
  ].forEach(([h,a,b])=>updateRptTimeHint(prefix+a, prefix+b, prefix+h));
}

function resetReportForm(){
  document.getElementById('reportRows').innerHTML='';
  reportRowCount=0;
  setExtraTimesUI('rpt',{});
  document.getElementById('rptMemo').value='';
  addReportRow();
}

let editReportRowCount = 0;

function addEditReportRow(){
  const id = ++editReportRowCount;
  const chips = WORK_TYPES.map(w=>`<span class="work-type-chip" onclick="toggleWorkType(this)">${w}</span>`).join('');
  const row = document.createElement('div');
  row.className = 'report-row';
  row.innerHTML = `
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">現場</div>
      <select onchange="onRptSiteChange(this)" style="width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;">
        <option value="">現場を選択</option>${getActiveTaskOptions()}<option value="__other__">その他</option>
      </select>
      <input type="text" class="rpt-other-name" placeholder="内容を手入力" style="display:none;margin-top:4px;width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">作業内容</div>
      <div class="work-types">${chips}</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">作業時間</div>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
        <input type="time" class="rpt-start" style="padding:5px 6px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" oninput="calcRowHours(this.closest('.report-row'))">
        <span style="font-size:12px;color:var(--text-muted)">〜</span>
        <input type="time" class="rpt-end" style="padding:5px 6px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" oninput="calcRowHours(this.closest('.report-row'))">
        <span class="rpt-hours-disp" style="font-size:12px;font-weight:700;color:var(--accent);min-width:32px;">--</span>
      </div>
    </div>
    <button type="button" onclick="this.closest('.report-row').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:4px;align-self:start;margin-top:20px;">✕</button>`;
  document.getElementById('editReportRows').appendChild(row);
}


function closeRptEditModal(e){
  if(e && e.target !== document.getElementById('rptEditModal')) return;
  document.getElementById('rptEditModal').style.display='none';
  editingReportId = null;
}

async function saveReportEdit(){
  const date   = document.getElementById('editRptDate').value;
  const worker = document.getElementById('editRptWorker').value;
  if(!date){alert('日付を入力してください');return;}
  if(!worker){alert('作業者を選択してください');return;}

  const status = '通常';

  const rows = [];
  document.querySelectorAll('#editReportRows .report-row').forEach(row=>{
    const sel = row.querySelector('select');
    const isOther = sel?.value === '__other__';
    const taskId = (!isOther && sel?.value) ? Number(sel.value) : null;
    const taskObj = taskId ? tasks.find(t=>t.id===taskId) : null;
    const taskName = isOther
      ? (row.querySelector('.rpt-other-name')?.value.trim() || 'その他')
      : (taskObj ? taskObj.name : (sel?.options[sel.selectedIndex]?.text||''));
    const wts = [...row.querySelectorAll('.work-type-chip.active')].map(c=>c.textContent);
    const startTime = row.querySelector('.rpt-start')?.value||'';
    const endTime   = row.querySelector('.rpt-end')?.value||'';
    const hrs = calcHoursFromTimeRange(startTime, endTime);
    if(taskId||isOther||hrs>0) rows.push({taskId, taskName, workTypes:wts, hours:hrs, startTime, endTime});
  });

  if(!rows.length){alert('現場・作業時間を入力してください');return;}

  const extraTimes = getExtraTimes('editRpt');
  const overtime   = timeRangeToHours(...(extraTimes.overtime.split('-')));
  const late       = timeRangeToHours(...(extraTimes.late.split('-')));
  const early      = timeRangeToHours(...(extraTimes.early.split('-')));
  const paidLeave  = timeRangeToHours(...(extraTimes.paidLeave.split('-')));
  const memo = document.getElementById('editRptMemo').value.trim();

  const rep = reports.find(r=>r.id===editingReportId);
  if(rep){ Object.assign(rep, {date, worker, rows, overtime, late, early, paidLeave, memo, status, extraTimes}); }
  try{
    const {error} = await sb.from('daily_reports').upsert({
      id:editingReportId, date, worker, rows, overtime, late, early, memo, status, extra_times:extraTimes
    });
    if(error) throw error;
    flashSaved();
  }catch(e){ console.error('日報更新失敗:',e); reportCloudException(e,'日報の更新'); return; }

  saveLocal();
  flashOk('日報を更新しました');
  document.getElementById('rptEditModal').style.display='none';
  editingReportId = null;
  renderReportList();
}

function editReport(id, e){
  e.stopPropagation();
  const r = reports.find(r=>r.id===id); if(!r) return;
  editingReportId = id;

  // モーダルの値をセット
  document.getElementById('editRptDate').value = r.date;
  const ws = document.getElementById('editRptWorker');
  ws.innerHTML = '<option value="">選択してください</option>' + workers.map(w=>`<option value="${w}">${w}</option>`).join('');
  ws.value = r.worker;

  // 行を再構築
  document.getElementById('editReportRows').innerHTML='';
  editReportRowCount=0;
  r.rows.forEach(rw=>{
    addEditReportRow();
    const rows = document.querySelectorAll('#editReportRows .report-row');
    const lastRow = rows[rows.length-1];
    const sel = lastRow.querySelector('select');
    if(rw.taskId){
      sel.value = String(rw.taskId);
    } else if(rw.taskName){
      sel.value = '__other__';
      const inp = lastRow.querySelector('.rpt-other-name');
      if(inp){ inp.style.display=''; inp.value=rw.taskName; }
    }
    lastRow.querySelectorAll('.work-type-chip').forEach(chip=>{
      if((rw.workTypes||[]).includes(chip.textContent)) chip.classList.add('active');
    });
    if(rw.startTime) lastRow.querySelector('.rpt-start').value = rw.startTime;
    if(rw.endTime)   lastRow.querySelector('.rpt-end').value   = rw.endTime;
    calcRowHours(lastRow);
  });

  // 残業・有給・遅刻・早退・メモ
  setExtraTimesUI('editRpt', r.extraTimes||{});
  document.getElementById('editRptMemo').value = r.memo||'';

  // モーダルを開く
  document.getElementById('rptEditModal').style.display='flex';
}

// ── 日報サブタブ ──
function switchReportTab(tab){
  ['input','summary','timeline'].forEach(t=>{
    const el=document.getElementById('rpanel-'+t);
    const on=t===tab;
    el.classList.toggle('report-panel-active',on);
    el.hidden=!on;
    el.style.display='';
  });
  document.querySelectorAll('.report-subtab').forEach(b=>b.classList.remove('active'));
  document.getElementById('rsubtab-'+tab).classList.add('active');
  if(tab==='summary'){
    if(!document.getElementById('rsumMonth').value){
      document.getElementById('rsumMonth').value = new Date().toISOString().slice(0,7);
    }
    renderReportSummary();
  }
  if(tab==='timeline'){
    if(!document.getElementById('tlDate').value){
      document.getElementById('tlDate').value = document.getElementById('rptDate').value || new Date().toISOString().slice(0,10);
    }
    refreshTlWorkerSelect();
    renderTimeline();
  }
}

// ── 運搬集計 ──
function renderTransportSummary(list, mf, el){
  if(!el) el = document.getElementById('transportSummaryContent');
  if(!el) return;

  // うんぱんを含む行だけ抽出
  let rows = [];
  (list||reports).forEach(r=>{
    r.rows.forEach(rw=>{
      if(!(rw.workTypes||[]).includes('うんぱん')) return;
      const taskObj = rw.taskId ? tasks.find(t=>t.id===rw.taskId) : null;
      const rawName = rw.taskName||'—';
      const site = taskObj ? getTaskNames(taskObj).main : (rawName.includes(' ／ ') ? rawName.split(' ／ ')[0] : rawName);
      rows.push({date:r.date, worker:r.worker, site, hours:rw.hours||0});
    });
  });

  if(!rows.length){
    el.innerHTML='<div style="color:var(--text-muted);padding:20px 0;text-align:center;">運搬の記録がありません</div>';
    return;
  }

  // 日付昇順ソート
  rows.sort((a,b)=>a.date.localeCompare(b.date)||a.worker.localeCompare(b.worker));

  // サマリー：現場別合計
  const siteTotal = {};
  rows.forEach(r=>{ siteTotal[r.site]=(siteTotal[r.site]||0)+r.hours; });
  const summaryChips = Object.entries(siteTotal).sort((a,b)=>b[1]-a[1]).map(([site,h])=>
    `<span style="font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:3px 10px;white-space:nowrap;">
      <span style="font-weight:600;">${site}</span>
      <span style="font-family:'DM Mono',monospace;color:var(--accent);margin-left:6px;">${h}h</span>
    </span>`
  ).join('');

  // 明細テーブル
  const tableRows = rows.map(r=>{
    const d = new Date(r.date+'T00:00:00');
    const dow = ['日','月','火','水','木','金','土'][d.getDay()];
    const isRed = isRedDay(r.date)||d.getDay()===0;
    const isSat = d.getDay()===6;
    const dateStr = `${r.date.slice(5).replace('-','/')}（${dow}）`;
    return`<tr>
      <td style="padding:6px 10px;font-family:'DM Mono',monospace;font-size:13px;white-space:nowrap;${isRed?'color:var(--danger);':isSat?'color:var(--accent);':''}">${dateStr}</td>
      <td style="padding:6px 10px;font-size:13px;font-weight:600;color:var(--accent);">${r.worker}</td>
      <td style="padding:6px 10px;font-size:13px;">${r.site}</td>
      <td style="padding:6px 10px;font-size:13px;font-family:'DM Mono',monospace;text-align:center;">${r.hours>0?r.hours+'h':'—'}</td>
    </tr>`;
  }).join('');

  el.innerHTML=`
    <div class="rsum-section" style="margin-bottom:12px;">
      <div class="rsum-section-title">🚛 運搬先別　合計時間</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0;">${summaryChips}</div>
    </div>
    <div class="rsum-section">
      <div class="rsum-section-title">📋 運搬明細　（${rows.length}件）</div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:var(--surface2);">
              <th style="padding:6px 10px;text-align:left;font-size:12px;white-space:nowrap;border-bottom:2px solid var(--border);">日付</th>
              <th style="padding:6px 10px;text-align:left;font-size:12px;border-bottom:2px solid var(--border);">作業者</th>
              <th style="padding:6px 10px;text-align:left;font-size:12px;border-bottom:2px solid var(--border);">運搬先</th>
              <th style="padding:6px 10px;text-align:center;font-size:12px;border-bottom:2px solid var(--border);">時間</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── タイムスケジュール ──
const TL_COLORS=['#16a34a','#2563eb','#9333ea','#d97706','#dc2626','#0891b2','#7c3aed','#c026d3','#059669','#0284c7'];
const siteColorMap={};let siteColorIdx=0;
function getSiteColor(site){if(!siteColorMap[site])siteColorMap[site]=TL_COLORS[siteColorIdx++%TL_COLORS.length];return siteColorMap[site];}

function refreshTlWorkerSelect(){
  const sel=document.getElementById('tlWorker');
  if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='<option value="">全員</option>'+activeWorkers().map(w=>`<option value="${w}">${w}</option>`).join('');
  if(cur) sel.value=cur;
}

// ── タイムライン共通ヘルパー ──
const STATUS_TL={
  '有給':      {bg:'rgba(16,185,129,.15)',border:'#10b981',text:'#065f46',label:'有給'},
  '欠勤':      {bg:'rgba(239,68,68,.13)', border:'#ef4444',text:'#991b1b',label:'😷 欠勤'},
  'その他休日':{bg:'rgba(99,102,241,.13)',border:'#6366f1',text:'#3730a3',label:'🎌 休日'},
};

function calcTlRange(rList){
  let minH=8,maxH=18;
  rList.forEach(r=>{
    if(!r) return;
    (r.rows||[]).forEach(rw=>{
      if(rw.startTime){const h=parseInt(rw.startTime);if(h<minH)minH=h;}
      if(rw.endTime){const h=parseInt(rw.endTime)+1;if(h>maxH)maxH=h;}
    });
    [r.extraTimes?.statusRange, r.extraTimes?.paidLeave].forEach(rng=>{
      if(rng&&rng.includes('-')){
        const[s,e]=rng.split('-');
        if(s){const h=parseInt(s);if(h<minH)minH=h;}
        if(e){const h=parseInt(e)+1;if(h>maxH)maxH=h;}
      }
    });
  });
  return{minH,maxH};
}

function buildTlBlocks(r, minH, pxPerMin){
  if(!r) return{blocks:'',stStyle:null,status:'通常'};
  const status=r.status||'通常';
  const stStyle=STATUS_TL[status];
  let blocks='';
  if(stStyle){
    const sr=r.extraTimes?.statusRange;
    if(sr&&sr.includes('-')){
      const[ss,se]=sr.split('-');
      const[sh,sm]=ss.split(':').map(Number);
      const[eh,em]=se.split(':').map(Number);
      const top=(sh*60+sm-minH*60)*pxPerMin;
      const height=((eh*60+em)-(sh*60+sm))*pxPerMin;
      blocks=height>0
        ?`<div class="timeline-block" style="top:${top}px;height:${height}px;background:${stStyle.border};" title="${stStyle.label}\n${ss}〜${se}">${stStyle.label}<br>${ss}〜${se}</div>`
        :`<div style="position:absolute;inset:4px;border-radius:6px;background:${stStyle.border};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;">${stStyle.label}</div>`;
    } else {
      blocks=`<div style="position:absolute;inset:4px;border-radius:6px;background:${stStyle.border};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;">${stStyle.label}</div>`;
    }
  } else {
    blocks=(r.rows||[]).filter(rw=>rw.startTime&&rw.endTime).map(rw=>{
      const taskObj=rw.taskId?tasks.find(t=>t.id===rw.taskId):null;
      const site=taskObj?taskFullName(taskObj):(rw.taskName||'現場未設定');
      const[sh,sm]=rw.startTime.split(':').map(Number);
      const[eh,em]=rw.endTime.split(':').map(Number);
      const top=(sh*60+sm-minH*60)*pxPerMin;
      const height=((eh*60+em)-(sh*60+sm))*pxPerMin;
      const color=getSiteColor(site);
      const wt=(rw.workTypes||[]).join('・');
      const label=wt?`${site}\n${wt}\n${rw.startTime}〜${rw.endTime}`:`${site}\n${rw.startTime}〜${rw.endTime}`;
      const dispText=wt?`${site}　${wt}<br>${rw.startTime}〜${rw.endTime}`:`${site}<br>${rw.startTime}〜${rw.endTime}`;
      return`<div class="timeline-block" style="top:${top}px;height:${height}px;background:${color}" title="${label}">${dispText}</div>`;
    }).join('');
    const plRange=r.extraTimes?.paidLeave;
    if(plRange&&plRange.includes('-')){
      const[ps,pe]=plRange.split('-');
      const[psh,psm]=ps.split(':').map(Number);
      const[peh,pem]=pe.split(':').map(Number);
      const ptop=(psh*60+psm-minH*60)*pxPerMin;
      const pheight=((peh*60+pem)-(psh*60+psm))*pxPerMin;
      if(pheight>0){
        blocks+=`<div class="timeline-block" style="top:${ptop}px;height:${pheight}px;background:${STATUS_TL['有給'].border};" title="有給\n${ps}〜${pe}">有給<br>${ps}〜${pe}</div>`;
      }
    }
  }
  return{blocks,stStyle,status};
}

function renderTimeline(){
  const date=document.getElementById('tlDate').value;
  const wf=document.getElementById('tlWorker')?.value||'';
  const el=document.getElementById('timelineView');
  if(!el) return;
  const pxPerMin=1;

  // ── 個人別・週間表示 ──
  if(wf && date){
    // 選択日を含む月曜〜日曜を算出
    const base=new Date(date+'T00:00:00');
    const dow=base.getDay();
    const mon=new Date(base); mon.setDate(base.getDate()-(dow===0?6:dow-1));
    const weekDates=Array.from({length:7},(_,i)=>{
      const d=new Date(mon); d.setDate(mon.getDate()+i);
      return d.toISOString().slice(0,10);
    });
    const WEEK_LABELS=['月','火','水','木','金','土','日'];
    const weekReports=weekDates.map(d=>reports.find(r=>r.date===d&&r.worker===wf)||null);
    const today=new Date().toISOString().slice(0,10);

    const{minH,maxH}=calcTlRange(weekReports);
    const trackH=(maxH-minH)*60*pxPerMin;

    const hourMarks=[];
    for(let h=minH;h<=maxH;h++) hourMarks.push(`<div class="timeline-hour-mark">${h}:00</div>`);
    const timeAxis=`<div class="timeline-time-axis"><div class="timeline-time-header" style="font-size:11px;color:var(--text-muted);">👤 ${wf}</div>${hourMarks.join('')}</div>`;

    const gridLines=[];
    for(let h=minH;h<=maxH;h++) gridLines.push(`<div class="timeline-track-hour" style="top:${(h-minH)*60}px"></div>`);

    const dayCols=weekDates.map((d,i)=>{
      const r=weekReports[i];
      const{blocks,stStyle,status}=buildTlBlocks(r,minH,pxPerMin);
      const isSat=i===5, isSun=i===6;
      const isSelected=d===date, isToday=d===today;
      const[,mm,dd]=d.split('-');
      const headColor=isSun?'#ef4444':isSat?'#2563eb':'var(--text)';
      const headStyle=isSelected?`font-weight:700;color:var(--accent);border-bottom:2px solid var(--accent);`
                     :isToday?`font-weight:600;color:${headColor};`:`color:${headColor};`;
      const trackBg=isSun?'rgba(239,68,68,.03)':isSat?'rgba(37,99,235,.03)':'';
      const stBadge=stStyle?`<span style="font-size:9px;padding:1px 4px;border-radius:99px;background:${stStyle.border};color:#fff;margin-left:3px;">${status}</span>`:'';
      return`<div class="timeline-worker-col">
        <div class="timeline-worker-name" style="${headStyle}font-size:12px;padding-bottom:4px;">
          ${mm}/${dd}<span style="font-size:10px;margin-left:3px;opacity:.8;">(${WEEK_LABELS[i]})</span>${stBadge}
        </div>
        <div class="timeline-track" style="height:${trackH}px;${trackBg?`background:${trackBg};`:''}">
          ${stStyle?'':gridLines.join('')}${blocks}
        </div>
      </div>`;
    }).join('');

    const legend=Object.entries(siteColorMap).map(([site,color])=>
      `<div class="timeline-legend-item"><span style="width:12px;height:12px;border-radius:3px;background:${color};display:inline-block;flex-shrink:0"></span>${site}</div>`
    ).join('');
    el.innerHTML=`<div class="timeline-wrap">${timeAxis}${dayCols}</div><div class="timeline-legend">${legend}</div>`;
    return;
  }

  // ── 全員・日次表示 ──
  const dayReports=date?reports.filter(r=>r.date===date):[];
  const{minH,maxH}=calcTlRange(dayReports);
  const trackH=(maxH-minH)*60*pxPerMin;

  const hourMarks=[];
  for(let h=minH;h<=maxH;h++) hourMarks.push(`<div class="timeline-hour-mark">${h}:00</div>`);
  const timeAxis=`<div class="timeline-time-axis"><div class="timeline-time-header"></div>${hourMarks.join('')}</div>`;

  const gridLines=[];
  for(let h=minH;h<=maxH;h++) gridLines.push(`<div class="timeline-track-hour" style="top:${(h-minH)*60}px"></div>`);

  const workerCols=activeWorkers().map(wName=>{
    const r=dayReports.find(rp=>rp.worker===wName);
    const{blocks,stStyle,status}=buildTlBlocks(r,minH,pxPerMin);
    const nameBadge=stStyle?`<span style="font-size:9px;padding:1px 5px;border-radius:99px;background:${stStyle.border};color:#fff;margin-left:4px;">${status}</span>`:'';
    return`<div class="timeline-worker-col">
      <div class="timeline-worker-name">${wName}${nameBadge}</div>
      <div class="timeline-track" style="height:${trackH}px">${stStyle?'':gridLines.join('')}${blocks}</div>
    </div>`;
  }).join('');

  const legend=Object.entries(siteColorMap).map(([site,color])=>
    `<div class="timeline-legend-item"><span style="width:12px;height:12px;border-radius:3px;background:${color};display:inline-block;flex-shrink:0"></span>${site}</div>`
  ).join('');
  el.innerHTML=`<div class="timeline-wrap">${timeAxis}${workerCols}</div><div class="timeline-legend">${legend}</div>`;
}

function cancelEditReport(){
  editingReportId = null;
  resetReportForm();
  const btn = document.querySelector('.report-save-btn');
  if(btn){ btn.textContent='💾 日報を保存'; btn.style.background=''; }
  const cancelBtn = document.getElementById('rptCancelEdit');
  if(cancelBtn) cancelBtn.style.display='none';
}

function renderReportList(){
  const el = document.getElementById('reportList'); if(!el) return;
  const wf = document.getElementById('rptFilterWorker')?.value||'';
  const mf = document.getElementById('rptFilterMonth')?.value||'';
  // PDF印刷ボタン：人と月が両方選ばれているときだけ表示
  const printBtn = document.getElementById('rptPrintBtn');
  if(printBtn) printBtn.style.display = (wf && mf) ? '' : 'none';
  let list = [...reports].sort((a,b)=>b.date.localeCompare(a.date));
  if(wf) list = list.filter(r=>r.worker===wf);
  if(mf) list = list.filter(r=>r.date.startsWith(mf));
  if(!list.length){
    el.innerHTML='<div style="color:var(--text-muted);padding:20px 0;text-align:center;">日報がまだ登録されていません</div>';
    return;
  }
  const STATUS_STYLE = {
    '有給':       'background:#d1fae5;color:#065f46',
    '欠勤':       'background:#fee2e2;color:#991b1b',
    'その他休日': 'background:#e0e7ff;color:#3730a3',
  };
  el.innerHTML = list.map(r=>{
    const st = r.status && r.status!=='通常' ? r.status : null;
    const totalH = (r.rows||[]).reduce((s,rw)=>s+(rw.hours||0),0);
    const siteNames = [...new Set((r.rows||[]).map(rw=>rw.taskName||'').filter(Boolean))].join('・');
    const detailRows = (r.rows||[]).map(rw=>`
      <div class="report-detail-row">
        <span class="report-site-name">${rw.taskName||'現場未選択'}</span>
        <div class="report-work-chips">${(rw.workTypes||[]).map(w=>`<span class="report-work-chip">${w}</span>`).join('')}</div>
        <span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--accent);font-weight:700;white-space:nowrap">${rw.hours}時間</span>
      </div>`).join('');
    const fmtRange=(key,label)=>{
      const rng=r.extraTimes?.[key];
      if(rng) return `${label} ${rng.replace('-','〜')}`;
      const h=r[key==='overtime'?'overtime':key==='late'?'late':'early'];
      return h?`${label} ${h}h`:'';
    };
    const extras=[
      fmtRange('overtime','残業'),fmtRange('paidLeave','有給'),
      fmtRange('late','遅刻'),fmtRange('early','早退')
    ].filter(Boolean);
    const extraStr = extras.length ? `<span style="font-size:11px;color:var(--warn)">${extras.join('　')}</span>` : '';
    const stBadge = st ? `<span style="font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;${STATUS_STYLE[st]||''}">${st}</span>` : '';
    return`<div class="report-card">
      <div class="report-card-header" onclick="this.nextElementSibling.classList.toggle('open')">
        <span class="report-card-date">${r.date}</span>
        <span class="report-card-worker">👤 ${r.worker}</span>
        ${st ? stBadge : `<span class="report-card-summary">${siteNames}</span>`}
        <span style="margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0;">
          ${st ? '' : `<span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--accent);white-space:nowrap">計 ${totalH}h</span>`}
          ${extraStr}
          <button onclick="editReport(${r.id},event)" style="background:none;border:1px solid var(--border);color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px 8px;border-radius:5px;">✏️ 編集</button>
          <button onclick="deleteReport(${r.id},event)" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:2px 4px;">🗑</button>
        </span>
      </div>
      <div class="report-card-body">
        ${st ? `<div style="padding:12px 0;font-size:13px;color:var(--text-muted);text-align:center;">${st}</div>` : detailRows}
        ${r.memo?`<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">📝 ${r.memo}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

async function mergeDuplicateReports(){
  // 同日・同人のグループを検出
  const groups = {};
  reports.forEach(r=>{
    const key = r.date+'__'+r.worker;
    if(!groups[key]) groups[key]=[];
    groups[key].push(r);
  });
  const dupeGroups = Object.values(groups).filter(g=>g.length>1);
  if(!dupeGroups.length){ alert('まとめる日報はありません'); return; }

  const total = dupeGroups.reduce((s,g)=>s+g.length,0);
  if(!confirm(`${dupeGroups.length}グループ（計${total}件）の日報をまとめます。よろしいですか？`)) return;

  for(const group of dupeGroups){
    // 日付降順でソート（最古を基準に）
    group.sort((a,b)=>a.id-b.id);
    const base = group[0];
    const rest = group.slice(1);
    // 行を全部結合
    base.rows = group.flatMap(r=>r.rows||[]);
    // extraTimes：後のものを優先
    const mergedET = {...(base.extraTimes||{})};
    rest.forEach(r=>{ Object.entries(r.extraTimes||{}).forEach(([k,v])=>{ if(v) mergedET[k]=v; }); });
    base.extraTimes = mergedET;
    // memo連結
    const memos = group.map(r=>r.memo||'').filter(Boolean);
    base.memo = [...new Set(memos)].join('\n');
    // 基準をDB更新
    try{
      await sb.from('daily_reports').upsert({
        id:base.id, date:base.date, worker:base.worker, rows:base.rows,
        memo:base.memo, status:base.status||'通常', extra_times:base.extraTimes
      });
    }catch(e){ console.error('結合更新失敗:',e); }
    // 重複をDB・ローカルから削除
    for(const r of rest){
      try{ await sb.from('daily_reports').delete().eq('id',r.id); }catch(e){ console.error('重複削除失敗:',e); }
      reports = reports.filter(x=>x.id!==r.id);
    }
  }
  flashSaved();
  saveLocal();
  renderReportList();
  alert('まとめ完了しました！');
}

function printReportPdf(){
  const wf = document.getElementById('rptFilterWorker')?.value||'';
  const mf = document.getElementById('rptFilterMonth')?.value||'';
  if(!wf||!mf){ alert('作業員と月を選択してください'); return; }

  const list = [...reports]
    .filter(r=>r.worker===wf && r.date.startsWith(mf))
    .sort((a,b)=>a.date.localeCompare(b.date));

  const [y,m] = mf.split('-');
  const DOW = ['日','月','火','水','木','金','土'];

  const totalH = list.reduce((s,r)=>{
    return s + (r.rows||[]).reduce((ss,rw)=>ss+(rw.hours||0),0);
  },0);
  const totalOT = list.reduce((s,r)=>{
    const ot = r.extraTimes?.overtime;
    if(ot&&ot.includes('-')){ const[a,b]=ot.split('-'); const[ah,am]=a.split(':').map(Number); const[bh,bm]=b.split(':').map(Number); return s+((bh*60+bm)-(ah*60+am))/60; }
    return s+(r.overtime||0);
  },0);

  const rows = list.map(r=>{
    const d = new Date(r.date+'T00:00:00');
    const dow = DOW[d.getDay()];
    const dayStr = `${Number(r.date.slice(5,7))}/${Number(r.date.slice(8,10))}(${dow})`;
    const isSat = d.getDay()===6, isSun = d.getDay()===0;
    const dayColor = isSun?'#dc2626':isSat?'#2563eb':'';
    const rowH = (r.rows||[]).reduce((s,rw)=>s+(rw.hours||0),0);
    const sites = [...new Set((r.rows||[]).map(rw=>rw.taskName||'').filter(Boolean))];
    const workTypes = [...new Set((r.rows||[]).flatMap(rw=>rw.workTypes||[]))];
    const siteStr = (r.rows||[]).map(rw=>{
      const wt = (rw.workTypes||[]).join('・');
      return `${rw.taskName||''}${wt?' ［'+wt+'］':''}　${rw.hours}h`;
    }).join('<br>');
    // 時間外
    const fmtR = (key)=>{ const v=r.extraTimes?.[key]; return v&&v.includes('-')?v.replace('-','〜'):''; };
    const extras = [
      fmtR('overtime')  ? '残業 '+fmtR('overtime')  : '',
      fmtR('paidLeave') ? '有給 '+fmtR('paidLeave') : '',
      fmtR('late')      ? '遅刻 '+fmtR('late')       : '',
      fmtR('early')     ? '早退 '+fmtR('early')       : '',
    ].filter(Boolean).join(' ／ ');
    return `<tr>
      <td style="text-align:center;white-space:nowrap;color:${dayColor};font-weight:${isSat||isSun?'700':'400'}">${dayStr}</td>
      <td>${siteStr}</td>
      <td style="text-align:center;white-space:nowrap;">${rowH?rowH+'h':''}</td>
      <td style="font-size:10px;color:#555;">${extras}</td>
      <td style="font-size:10px;color:#555;">${r.memo||''}</td>
    </tr>`;
  }).join('');

  const html = `
    <div id="rptPrintDoc" style="font-family:'Hiragino Sans','Meiryo',sans-serif;padding:10mm;background:#fff;color:#000;font-size:12px;">
      <div style="text-align:center;margin-bottom:6px;">
        <div style="font-size:20px;font-weight:900;letter-spacing:4px;border-bottom:3px double #000;padding-bottom:4px;margin-bottom:4px;">作　業　日　報</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:6px;">
          <span>${y}年${Number(m)}月分</span>
          <span>作業員：<strong style="font-size:14px;">${wf}</strong></span>
          <span>マイシン工業</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;">
        <thead>
          <tr style="background:#1e3a5f;color:#fff;">
            <th style="border:1px solid #888;padding:5px 8px;white-space:nowrap;">日付</th>
            <th style="border:1px solid #888;padding:5px 8px;">現場 / 作業内容</th>
            <th style="border:1px solid #888;padding:5px 8px;white-space:nowrap;">時間</th>
            <th style="border:1px solid #888;padding:5px 8px;">時間外</th>
            <th style="border:1px solid #888;padding:5px 8px;">メモ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f0f4f8;font-weight:700;">
            <td colspan="2" style="border:1px solid #888;padding:5px 8px;text-align:right;">合　計</td>
            <td style="border:1px solid #888;padding:5px 8px;text-align:center;">${totalH}h</td>
            <td colspan="2" style="border:1px solid #888;padding:5px 8px;font-size:10px;">残業合計 ${Math.round(totalOT*10)/10}h</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:16px;display:flex;gap:24px;justify-content:flex-end;">
        <div style="border:1px solid #999;width:80px;text-align:center;padding:4px;font-size:10px;">確認印<div style="height:32px;"></div></div>
        <div style="border:1px solid #999;width:80px;text-align:center;padding:4px;font-size:10px;">責任者<div style="height:32px;"></div></div>
      </div>
    </div>`;

  // 印刷用オーバーレイ作成
  let wrap = document.getElementById('rptPrintWrap');
  if(!wrap){ wrap=document.createElement('div'); wrap.id='rptPrintWrap'; document.body.appendChild(wrap); }
  wrap.innerHTML = html;

  let ps = document.getElementById('commonPrintStyle');
  if(!ps){ ps=document.createElement('style'); ps.id='commonPrintStyle'; document.head.appendChild(ps); }
  ps.textContent=`@media print{
    @page{size:A4 portrait;margin:0;}
    body *{visibility:hidden!important;}
    #rptPrintWrap,#rptPrintWrap *{visibility:visible!important;}
    #rptPrintWrap{position:fixed!important;inset:0!important;overflow:visible!important;background:#fff!important;z-index:99999;}
    table tr:nth-child(even){background:#f8fafc;}
    table td,table th{border:1px solid #999!important;padding:4px 6px!important;}
  }`;
  setTimeout(()=>{
    window.print();
    setTimeout(()=>{ ps.textContent=''; wrap.innerHTML=''; },1500);
  },300);
}

async function deleteReport(id, e){
  e.stopPropagation();
  if(!confirm('この日報を削除しますか？'))return;
  reports = reports.filter(r=>r.id!==id);
  try{ await sb.from('daily_reports').delete().eq('id',id); flashSaved(); }
  catch(err){ console.error('日報削除失敗:',err); }
  saveLocal();
  renderReportList();
}

// ══ ユニット販売 ══
let sales = []; // {id, date, taskId, taskName, buyer, kg, amount, memo}
let nextSaleId = 1;
let buyers = []; // {id, name, unitPrice}
let nextBuyerId = 1;
let editingSaleId = null;

function switchUnitSalesTab(tab){
  document.querySelectorAll('.master-subtab').forEach((el,i)=>
    el.classList.toggle('active',['sales','buyers'][i]===tab));
  document.getElementById('us-panel-sales').style.display=tab==='sales'?'block':'none';
  document.getElementById('us-panel-buyers').style.display=tab==='buyers'?'block':'none';
  if(tab==='buyers')renderBuyerList();
}

function initUnitSales(){
  const d=document.getElementById('usDate');
  if(!d.value)d.value=TODAY.toISOString().slice(0,10);
  syncSaleTaskSelects();
  syncBuyerSelects();
  const mf=document.getElementById('usFilterMonth');
  if(!mf.value){
    const now=new Date();
    mf.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }
  renderSaleSummary();
  renderSaleView();
}

function syncSaleTaskSelects(){
  const unitTasks=tasks.filter(t=>t.unitType&&t.unitType!=='none');
  const opts='<option value="">選択してください</option>'+unitTasks.map(t=>`<option value="${t.id}">${taskFullName(t)}</option>`).join('');
  const sel=document.getElementById('usTask');
  const cur=sel?.value;
  if(sel){sel.innerHTML=opts;if(cur)sel.value=cur;}
  const fsel=document.getElementById('usFilterTask');
  const fcur=fsel?.value;
  if(fsel){
    fsel.innerHTML='<option value="">全現場</option>'+unitTasks.map(t=>`<option value="${t.id}">${taskFullName(t)}</option>`).join('');
    if(fcur)fsel.value=fcur;
  }
}

function syncBuyerSelects(taskId){
  // タスクのメイン項目で絞り込み
  const taskObj=taskId?tasks.find(t=>t.id===Number(taskId)):null;
  const mainItem=taskObj?getTaskNames(taskObj).main:'';
  const filtered=mainItem?buyers.filter(b=>b.mainItem===mainItem):buyers;
  const opts='<option value="">選択してください</option>'+filtered.map(b=>`<option value="${b.name}">${b.name}（${b.unitPrice.toLocaleString()}円/kg）</option>`).join('');
  const sel=document.getElementById('usBuyer');
  const cur=sel?.value;
  if(sel){sel.innerHTML=opts;if(cur)sel.value=cur;}
}

function onUsTaskChange(){
  const taskId=document.getElementById('usTask').value;
  const t=tasks.find(t=>t.id===Number(taskId));
  if(t){document.getElementById('usKg').value=t.total||'';}
  calcUsSaleAmount();
}

function onUsBuyerChange(){calcUsSaleAmount();}

function calcUsSaleAmount(){
  const buyerName=document.getElementById('usBuyer')?.value||'';
  const kg=Number(document.getElementById('usKg')?.value)||0;
  const buyer=buyers.find(b=>b.name===buyerName);
  if(buyer&&kg>0){
    document.getElementById('usAmount').value=Math.round(buyer.unitPrice*kg);
    document.getElementById('usUnitPriceHint').textContent=`単価 ${buyer.unitPrice.toLocaleString()}円/kg × ${kg.toLocaleString()}kg = ${Math.round(buyer.unitPrice*kg).toLocaleString()}円`;
  } else {
    document.getElementById('usUnitPriceHint').textContent='';
  }
}

async function saveSale(){
  const date=document.getElementById('usDate').value;
  const taskId=Number(document.getElementById('usTask').value)||null;
  const buyerName=document.getElementById('usBuyer').value;
  const kg=Number(document.getElementById('usKg').value)||0;
  const amount=Number(document.getElementById('usAmount').value)||0;
  const memo=document.getElementById('usMemo').value.trim();
  if(!date){alert('日付を入力してください');return;}
  if(!taskId){alert('現場を選択してください');return;}
  if(!buyerName){alert('販売先を選択してください');return;}
  if(kg<=0){alert('kg数を入力してください');return;}
  const taskObj=tasks.find(t=>t.id===taskId);
  const taskName=taskObj?taskObj.name:'';
  if(editingSaleId!==null){
    const s=sales.find(s=>s.id===editingSaleId);
    if(s)Object.assign(s,{date,taskId,taskName,buyer:buyerName,kg,amount,memo});
    try{
      const {error}=await sb.from('unit_sales').upsert({id:editingSaleId,date,task_id:taskId,task_name:taskName,buyer:buyerName,kg,amount,memo});
      if(error)throw error; flashSaved();
    }catch(e){reportCloudException(e,'販売記録の更新');return;}
    cancelEditSale();
    flashOk('販売記録を更新しました');
  }else{
    const s={id:nextSaleId++,date,taskId,taskName,buyer:buyerName,kg,amount,memo};
    sales.push(s);
    try{
      const {error}=await sb.from('unit_sales').insert({id:s.id,date,task_id:taskId,task_name:taskName,buyer:buyerName,kg,amount,memo});
      if(error)throw error; flashSaved();
    }catch(e){reportCloudException(e,'販売記録の保存');return;}
    flashOk('販売記録を保存しました');
    ['usKg','usAmount','usMemo'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('usUnitPriceHint').textContent='';
  }
  saveLocal();
  renderSaleSummary();
  renderSaleView();
}

function editSale(id){
  const s=sales.find(s=>s.id===id);if(!s)return;
  editingSaleId=id;
  document.getElementById('usDate').value=s.date;
  document.getElementById('usTask').value=s.taskId||'';
  document.getElementById('usBuyer').value=s.buyer;
  document.getElementById('usKg').value=s.kg;
  document.getElementById('usAmount').value=s.amount;
  document.getElementById('usMemo').value=s.memo||'';
  document.getElementById('usFormTitle').textContent='✏️ 販売記録を編集';
  document.getElementById('usCancelBtn').style.display='inline-block';
  document.querySelector('#usSaleForm').scrollIntoView({behavior:'smooth'});
}

function cancelEditSale(){
  editingSaleId=null;
  ['usKg','usAmount','usMemo'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('usFormTitle').textContent='＋ 販売記録を追加';
  document.getElementById('usCancelBtn').style.display='none';
  document.getElementById('usUnitPriceHint').textContent='';
}

async function deleteSale(id){
  if(!confirm('この販売記録を削除しますか？'))return;
  sales=sales.filter(s=>s.id!==id);
  try{await sb.from('unit_sales').delete().eq('id',id);flashSaved();}
  catch(e){console.error(e);}
  saveLocal();
  renderSaleSummary();
  renderSaleView();
}

async function markDoneWithSale(id){
  const t=tasks.find(t=>t.id===id);if(!t)return;
  t.complete=true;t.done=t.total;
  expandedIds.delete(id);
  render();saveTask(t);syncReportTaskSelects();

  // ユニットなしならスキップ
  if(!t.unitType||t.unitType==='none')return;

  // 未出荷レコードを探して出荷済に更新
  const pendingSale=sales.find(s=>s.taskId===t.id&&s.status==='未出荷');
  if(pendingSale){
    pendingSale.status='出荷済';
    const today=TODAY.toISOString().slice(0,10);
    pendingSale.date=today; // 完了日を出荷日に
    try{
      const {error}=await sb.from('unit_sales').upsert({
        id:pendingSale.id,date:today,task_id:pendingSale.taskId,
        task_name:pendingSale.taskName,buyer:pendingSale.buyer,
        kg:pendingSale.kg,amount:pendingSale.amount,memo:pendingSale.memo,status:'出荷済'
      });
      if(error)throw error; flashSaved();
    }catch(e){console.error('出荷済更新失敗:',e);}
    saveLocal();
    alert(`「${t.nameMain||t.name}」を完了しました！\n🔗 ${pendingSale.buyer} / ${pendingSale.kg.toLocaleString()}kg / ¥${pendingSale.amount.toLocaleString()}\nを出荷済として計上しました。`);
  } else {
    // 未出荷レコードがなければ新規計上を促す
    alert(`「${t.nameMain||t.name}」を完了しました！`);
  }
}

// ── 販売集計ビュー ──
let currentSaleView = 'list';

function switchSaleView(view){
  currentSaleView = view;
  ['list','month','year','buyer'].forEach(v=>{
    const tab=document.getElementById(`saleViewTab-${v}`);
    if(tab)tab.classList.toggle('active',v===view);
  });
  document.getElementById('usFilterMonthWrap').style.display=(view==='list'||view==='buyer')?'flex':'none';
  document.getElementById('usFilterYearWrap').style.display=(view==='year'||view==='month')?'flex':'none';
  renderSaleView();
}

function clearSaleFilters(){
  ['usFilterStatus','usFilterTask','usFilterMonth','usFilterYear','usFilterFrom','usFilterTo'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  renderSaleView();
}

function getFilteredSales(){
  const sf=document.getElementById('usFilterStatus')?.value||'';
  const tf=document.getElementById('usFilterTask')?.value||'';
  const mf=document.getElementById('usFilterMonth')?.value||'';
  const yf=document.getElementById('usFilterYear')?.value||'';
  let list=[...sales];
  if(sf)list=list.filter(s=>(s.status||'出荷済')===sf);
  if(tf)list=list.filter(s=>String(s.taskId)===tf);
  if(mf)list=list.filter(s=>s.date.startsWith(mf));
  if(yf)list=list.filter(s=>s.date.startsWith(yf));
  return list;
}

function initYearFilter(){
  const sel=document.getElementById('usFilterYear');if(!sel)return;
  const cur=sel.value;
  const years=[...new Set(sales.map(s=>s.date.slice(0,4)))].sort((a,b)=>b-a);
  sel.innerHTML='<option value="">全期間</option>'+years.map(y=>`<option value="${y}">${y}年</option>`).join('');
  if(cur)sel.value=cur;
}

function renderSaleView(){
  initYearFilter();
  renderSaleSummary();
  if(currentSaleView==='list')renderSaleList();
  else if(currentSaleView==='month')renderSaleMonthly();
  else if(currentSaleView==='year')renderSaleYearly();
  else if(currentSaleView==='buyer')renderSaleBuyer();
}

function renderSaleMonthly(){
  const el=document.getElementById('saleList');if(!el)return;
  const list=getFilteredSales().filter(s=>(s.status||'出荷済')==='出荷済');
  if(!list.length){el.innerHTML='<div style="color:var(--text-muted);padding:20px 0;text-align:center;">出荷済データがありません</div>';return;}
  const monthMap={};
  list.forEach(s=>{
    const mk=s.date.slice(0,7);
    if(!monthMap[mk])monthMap[mk]={month:mk,kg:0,amount:0,count:0,buyers:{}};
    monthMap[mk].kg+=s.kg;monthMap[mk].amount+=s.amount;monthMap[mk].count++;
    monthMap[mk].buyers[s.buyer]=(monthMap[mk].buyers[s.buyer]||0)+s.amount;
  });
  const months=Object.values(monthMap).sort((a,b)=>b.month.localeCompare(a.month));
  const totalKg=months.reduce((s,m)=>s+m.kg,0);
  const totalAmt=months.reduce((s,m)=>s+m.amount,0);
  el.innerHTML=`<div class="prod-table-wrap"><table class="prod-table">
    <thead><tr><th>年月</th><th style="text-align:right">件数</th><th style="text-align:right">販売kg</th><th style="text-align:right">売上金額</th><th style="text-align:right">平均単価</th><th>販売先内訳</th></tr></thead>
    <tbody>${months.map(m=>`<tr>
      <td style="font-weight:700;font-family:'DM Mono',monospace">${m.month.replace('-','年')}月</td>
      <td style="text-align:right">${m.count}件</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--ok)">${m.kg.toLocaleString()} kg</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">¥${m.amount.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${m.kg>0?Math.round(m.amount/m.kg).toLocaleString():'-'} 円/kg</td>
      <td style="font-size:11px">${Object.entries(m.buyers).map(([b,a])=>`<span style="margin-right:8px">${b} ¥${a.toLocaleString()}</span>`).join('')}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr style="background:var(--surface2);border-top:2px solid var(--border);">
      <td style="font-weight:700">合計</td><td style="text-align:right">${list.length}件</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--ok)">${totalKg.toLocaleString()} kg</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">¥${totalAmt.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${totalKg>0?Math.round(totalAmt/totalKg).toLocaleString():'-'} 円/kg</td><td></td>
    </tr></tfoot>
  </table></div>`;
}

function renderSaleYearly(){
  const el=document.getElementById('saleList');if(!el)return;
  const list=getFilteredSales().filter(s=>(s.status||'出荷済')==='出荷済');
  if(!list.length){el.innerHTML='<div style="color:var(--text-muted);padding:20px 0;text-align:center;">出荷済データがありません</div>';return;}
  const yearMap={};
  list.forEach(s=>{
    const yk=s.date.slice(0,4);
    if(!yearMap[yk])yearMap[yk]={year:yk,kg:0,amount:0,count:0,months:{}};
    yearMap[yk].kg+=s.kg;yearMap[yk].amount+=s.amount;yearMap[yk].count++;
    const mk=s.date.slice(5,7)+'月';
    if(!yearMap[yk].months[mk])yearMap[yk].months[mk]={kg:0,amount:0};
    yearMap[yk].months[mk].kg+=s.kg;yearMap[yk].months[mk].amount+=s.amount;
  });
  const years=Object.values(yearMap).sort((a,b)=>b.year-a.year);
  const totalKg=years.reduce((s,y)=>s+y.kg,0);
  const totalAmt=years.reduce((s,y)=>s+y.amount,0);
  el.innerHTML=`<div class="prod-table-wrap"><table class="prod-table">
    <thead><tr><th>年</th><th style="text-align:right">件数</th><th style="text-align:right">販売kg</th><th style="text-align:right">売上金額</th><th style="text-align:right">平均単価</th><th>月別内訳</th></tr></thead>
    <tbody>${years.map(y=>`<tr>
      <td style="font-weight:700;font-family:'DM Mono',monospace">${y.year}年</td>
      <td style="text-align:right">${y.count}件</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--ok)">${y.kg.toLocaleString()} kg</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">¥${y.amount.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${y.kg>0?Math.round(y.amount/y.kg).toLocaleString():'-'} 円/kg</td>
      <td style="font-size:11px">${Object.entries(y.months).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,v])=>`<span style="margin-right:8px">${m} ¥${v.amount.toLocaleString()}</span>`).join('')}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr style="background:var(--surface2);border-top:2px solid var(--border);">
      <td style="font-weight:700">合計</td><td style="text-align:right">${list.length}件</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--ok)">${totalKg.toLocaleString()} kg</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">¥${totalAmt.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${totalKg>0?Math.round(totalAmt/totalKg).toLocaleString():'-'} 円/kg</td><td></td>
    </tr></tfoot>
  </table></div>`;
}

function renderSaleBuyer(){
  const el=document.getElementById('saleList');if(!el)return;
  const list=getFilteredSales().filter(s=>(s.status||'出荷済')==='出荷済');
  if(!list.length){el.innerHTML='<div style="color:var(--text-muted);padding:20px 0;text-align:center;">出荷済データがありません</div>';return;}
  const buyerMap={};
  list.forEach(s=>{
    if(!buyerMap[s.buyer])buyerMap[s.buyer]={buyer:s.buyer,kg:0,amount:0,count:0};
    buyerMap[s.buyer].kg+=s.kg;buyerMap[s.buyer].amount+=s.amount;buyerMap[s.buyer].count++;
  });
  const rows=Object.values(buyerMap).sort((a,b)=>b.amount-a.amount);
  const totalKg=rows.reduce((s,r)=>s+r.kg,0);
  const totalAmt=rows.reduce((s,r)=>s+r.amount,0);
  el.innerHTML=`<div class="prod-table-wrap"><table class="prod-table">
    <thead><tr><th>販売先</th><th style="text-align:right">件数</th><th style="text-align:right">販売kg</th><th style="text-align:right">売上金額</th><th style="text-align:right">平均単価</th><th style="text-align:right">構成比</th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td style="font-weight:700">🏢 ${r.buyer}</td>
      <td style="text-align:right">${r.count}件</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--ok)">${r.kg.toLocaleString()} kg</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">¥${r.amount.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${r.kg>0?Math.round(r.amount/r.kg).toLocaleString():'-'} 円/kg</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${totalAmt>0?Math.round(r.amount/totalAmt*100):0}%</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr style="background:var(--surface2);border-top:2px solid var(--border);">
      <td style="font-weight:700">合計</td><td style="text-align:right">${list.length}件</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--ok)">${totalKg.toLocaleString()} kg</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">¥${totalAmt.toLocaleString()}</td>
      <td></td><td></td>
    </tr></tfoot>
  </table></div>`;
}

// ── 販売先マスタ ──
function showAddBuyerForm(){ document.getElementById('buyerAddForm').style.display='block'; }
function hideAddBuyerForm(){
  document.getElementById('buyerAddForm').style.display='none';
  ['newBuyerName','newBuyerPrice'].forEach(id=>document.getElementById(id).value='');
}

async function addBuyer(){
  const name=document.getElementById('newBuyerName').value.trim();
  const unitPrice=Number(document.getElementById('newBuyerPrice').value)||0;
  if(!name){alert('販売先名を入力してください');return;}
  if(buyers.some(b=>b.name===name)){alert('同じ名前の販売先がすでにあります');return;}
  const b={id:nextBuyerId++,name,unitPrice};
  buyers.push(b);
  hideAddBuyerForm();
  renderBuyerList();
  syncBuyerSelects();
  try{
    const {error}=await sb.from('buyers').insert({id:b.id,name:b.name,unit_price:b.unitPrice});
    if(error)throw error; flashSaved();
  }catch(e){console.error('販売先保存失敗:',e);}
  saveLocal();
}

async function updateBuyerPrice(id,price){
  const b=buyers.find(b=>b.id===id);if(!b)return;
  b.unitPrice=Number(price)||0;
  syncBuyerSelects();
  try{
    const {error}=await sb.from('buyers').upsert({id:b.id,name:b.name,unit_price:b.unitPrice});
    if(error)throw error; flashSaved();
  }catch(e){console.error(e);}
  saveLocal();
}

async function updateBuyerName(id,newName){
  newName=newName.trim();
  const b=buyers.find(b=>b.id===id);if(!b)return;
  if(!newName){renderBuyerList();return;}
  if(buyers.some(x=>x.id!==id&&x.name===newName)){alert('同じ名前の販売先がすでにあります');renderBuyerList();return;}
  const oldName=b.name;
  if(oldName===newName)return;
  b.name=newName;
  sales.forEach(s=>{if(s.buyer===oldName)s.buyer=newName;});
  syncBuyerSelects();
  renderSaleView();
  try{
    await sb.from('buyers').upsert({id:b.id,name:b.name,unit_price:b.unitPrice});
    const affected=sales.filter(s=>s.buyer===newName);
    for(const s of affected){
      await sb.from('unit_sales').upsert({id:s.id,date:s.date,task_id:s.taskId,task_name:s.taskName,buyer:s.buyer,kg:s.kg,amount:s.amount,memo:s.memo,status:s.status||'出荷済'});
    }
    flashSaved();
  }catch(e){console.error('販売先名更新失敗:',e);}
  saveLocal();
}

async function deleteBuyer(id){
  const b=buyers.find(b=>b.id===id);if(!b)return;
  if(!confirm(`「${b.name}」を削除しますか？`))return;
  buyers=buyers.filter(x=>x.id!==id);
  renderBuyerList();
  syncBuyerSelects();
  try{await sb.from('buyers').delete().eq('id',id);flashSaved();}
  catch(e){console.error(e);}
  saveLocal();
}

function syncBuyerSelects(){
  const opts='<option value="">選択してください</option>'+buyers.map(b=>`<option value="${b.name}">${b.name}（${b.unitPrice.toLocaleString()}円/kg）</option>`).join('');
  ['usBuyer'].forEach(id=>{const s=document.getElementById(id);if(s){const c=s.value;s.innerHTML=opts;if(c)s.value=c;}});
  syncNewSaleBuyerSelect();
}

function renderBuyerList(){
  const el=document.getElementById('buyerList');if(!el)return;
  if(!buyers.length){
    el.innerHTML='<div style="color:var(--text-muted);padding:16px 0;text-align:center;">販売先がまだ登録されていません</div>';
    return;
  }
  el.innerHTML=buyers.map(b=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;flex-wrap:wrap;">
      <span style="font-size:16px;flex-shrink:0;">🏢</span>
      <input type="text" value="${b.name.replace(/"/g,'&quot;')}" style="flex:1;min-width:120px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-weight:700;font-size:14px;"
        onchange="updateBuyerName(${b.id},this.value)">
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <input type="number" value="${b.unitPrice}" min="0" style="width:100px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);text-align:right;"
          onchange="updateBuyerPrice(${b.id},this.value)">
        <span style="font-size:12px;color:var(--text-muted);">円/kg</span>
      </div>
      <button class="btn btn-secondary btn-sm" style="color:var(--danger);flex-shrink:0;" onclick="deleteBuyer(${b.id})">削除</button>
    </div>`).join('');
}

function renderSaleSummary(){
  const el=document.getElementById('usSummary');if(!el)return;
  const mf=document.getElementById('usFilterMonth')?.value||'';
  const tf=document.getElementById('usFilterTask')?.value||'';
  const sf=document.getElementById('usFilterStatus')?.value||'';
  let list=[...sales];
  if(mf)list=list.filter(s=>s.date.startsWith(mf));
  if(tf)list=list.filter(s=>String(s.taskId)===tf);
  if(sf)list=list.filter(s=>(s.status||'出荷済')===sf);
  const shipped=list.filter(s=>(s.status||'出荷済')==='出荷済');
  const pending=list.filter(s=>s.status==='未出荷');
  const totalKg=shipped.reduce((s,r)=>s+r.kg,0);
  const totalAmt=shipped.reduce((s,r)=>s+r.amount,0);
  const pendingAmt=pending.reduce((s,r)=>s+r.amount,0);
  el.innerHTML=`
    <div class="us-stat"><div class="us-stat-label">出荷済件数</div><div class="us-stat-val">${shipped.length}<span class="us-stat-unit">件</span></div></div>
    <div class="us-stat"><div class="us-stat-label">総販売kg</div><div class="us-stat-val">${totalKg.toLocaleString()}<span class="us-stat-unit">kg</span></div></div>
    <div class="us-stat"><div class="us-stat-label">総売上金額</div><div class="us-stat-val" style="color:var(--ok)">¥${totalAmt.toLocaleString()}</div></div>
    <div class="us-stat"><div class="us-stat-label">未出荷（仮）</div><div class="us-stat-val" style="color:var(--warn)">¥${pendingAmt.toLocaleString()}</div></div>
    <div class="us-stat"><div class="us-stat-label">平均単価</div><div class="us-stat-val">${totalKg>0?Math.round(totalAmt/totalKg).toLocaleString():'-'}<span class="us-stat-unit">円/kg</span></div></div>`;
}

function renderSaleList(){
  const el=document.getElementById('saleList');if(!el)return;
  const mf=document.getElementById('usFilterMonth')?.value||'';
  const tf=document.getElementById('usFilterTask')?.value||'';
  const sf=document.getElementById('usFilterStatus')?.value||'';
  let list=[...sales].sort((a,b)=>b.date.localeCompare(a.date));
  if(mf)list=list.filter(s=>s.date.startsWith(mf));
  if(tf)list=list.filter(s=>String(s.taskId)===tf);
  if(sf)list=list.filter(s=>(s.status||'出荷済')===sf);
  renderSaleSummary();
  if(!list.length){
    el.innerHTML='<div style="color:var(--text-muted);padding:20px 0;text-align:center;">販売記録がありません</div>';
    return;
  }
  el.innerHTML=list.map(s=>{
    const taskObj=tasks.find(t=>t.id===s.taskId);
    const{main,sub}=taskObj?getTaskNames(taskObj):{main:s.taskName||'',sub:''};
    const status=s.status||'出荷済';
    const statusBadge=status==='未出荷'
      ?`<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;background:#fef9c3;color:#b45309;border:1px solid #fde047;white-space:nowrap;">📦 未出荷</span>`
      :`<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;background:#dcfce7;color:#15803d;border:1px solid #86efac;white-space:nowrap;">✅ 出荷済</span>`;
    return`<div class="sale-card" style="${status==='未出荷'?'border-color:#fde047;background:#fefce8;':''}">
      <span class="sale-date">${s.date}</span>
      ${statusBadge}
      <span class="sale-site">${main}${sub?` <span style="color:var(--text-muted);font-weight:400">／ ${sub}</span>`:''}</span>
      <span class="sale-buyer">🏢 ${s.buyer}</span>
      <span class="sale-kg">${s.kg.toLocaleString()} kg</span>
      <span class="sale-amount">¥${s.amount.toLocaleString()}</span>
      ${s.memo?`<span class="sale-memo">📝 ${s.memo}</span>`:'<span class="sale-memo"></span>'}
      <div style="margin-left:auto;display:flex;gap:6px;">
        <button class="btn btn-secondary btn-sm" onclick="editSale(${s.id})" style="font-size:11px;">✏️</button>
        <button class="btn btn-secondary btn-sm" onclick="deleteSale(${s.id})" style="font-size:11px;color:var(--danger);">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ══ 日報集計 ══
function initReportSummary(){
  const m = document.getElementById('rsumMonth');
  if(!m.value){
    const now = new Date();
    m.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }
  renderReportSummary();
}

function renderReportSummary(){
  const el = document.getElementById('reportSummaryContent'); if(!el) return;
  const mf   = document.getElementById('rsumMonth').value;
  const view = document.getElementById('rsumView').value;

  let list = [...reports];
  if(mf) list = list.filter(r=>r.date.startsWith(mf));

  if(!list.length){
    el.innerHTML='<div style="color:var(--text-muted);padding:20px 0;text-align:center;">該当する日報がありません</div>';
    return;
  }

  if(view==='daily')          el.innerHTML = renderDailySummary(list, mf);
  else if(view==='transport') { renderTransportSummary(list, mf, el); return; }
  else                        el.innerHTML = renderPersonSummary(list, mf);
}

// 月の日付一覧を生成
function getMonthDays(mf){
  if(!mf) return [];
  const [y,m] = mf.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  return Array.from({length:days}, (_,i)=>`${mf}-${String(i+1).padStart(2,'0')}`);
}

// 横軸：日付、縦軸：現場の集計表を生成
function buildSiteTable(list, days, filterWorker=''){
  // {site: {date: hours}} と {site: {worker: {date: hours}}} を同時に集計
  const siteMap = {};
  const siteWorkerMap = {}; // {site: {worker: {date: hours}}}
  list.forEach(r=>{
    if(filterWorker && r.worker !== filterWorker) return;
    r.rows.forEach(rw=>{
      if(!rw.hours||rw.hours<=0) return;
      const taskObj = rw.taskId ? tasks.find(t=>t.id===rw.taskId) : null;
      const rawName = rw.taskName||'現場未設定';
      const site=taskObj?getTaskNames(taskObj).main:(rawName.includes(' ／ ')?rawName.split(' ／ ')[0]:rawName);
      if(!siteMap[site]) siteMap[site]={};
      siteMap[site][r.date] = (siteMap[site][r.date]||0) + rw.hours;
      // 作業者別内訳
      if(!siteWorkerMap[site]) siteWorkerMap[site]={};
      if(!siteWorkerMap[site][r.worker]) siteWorkerMap[site][r.worker]={};
      siteWorkerMap[site][r.worker][r.date] = (siteWorkerMap[site][r.worker][r.date]||0) + rw.hours;
    });
  });

  const sites = Object.keys(siteMap).sort();
  if(!sites.length) return '<div style="color:var(--text-muted);padding:12px;">データがありません</div>';

  // ヘッダー行（日付）
  const colCount = days.length + 3; // 現場名 + 日付列 + 合計 + 人工
  const dayHeaders = days.map(d=>{
    const day = Number(d.split('-')[2]);
    const dow = ['日','月','火','水','木','金','土'][new Date(d).getDay()];
    const isWeekend = isRedDay(d) || new Date(d).getDay()===6;
    const isRed = isRedDay(d);
    return`<th style="min-width:36px;text-align:center;font-size:11px;padding:4px 2px;${isRed?'color:var(--danger);':isWeekend?'color:var(--accent);':''}">${day}<br><span style="font-size:9px">${dow}</span></th>`;
  }).join('');

  // データ行（現場ごと）＋内訳行
  let siteIdx = 0;
  const dataRows = sites.map(site=>{
    const rowTotal = days.reduce((s,d)=>s+(siteMap[site][d]||0),0);
    if(!rowTotal) return '';
    const idx = siteIdx++;
    const detailId = `siteDetail_${idx}`;
    const cells = days.map(d=>{
      const v = siteMap[site][d]||0;
      return`<td style="text-align:center;font-size:12px;font-family:'DM Mono',monospace;padding:4px 2px;${v>0?'color:var(--accent);font-weight:700;':''}">${v>0?v:''}</td>`;
    }).join('');
    const manDays = (rowTotal/7).toFixed(1);

    // 内訳行（作業者別）— 同じtbodyに直接追加してcolspan不要に
    const workerMap = siteWorkerMap[site]||{};
    const workerNames = Object.keys(workerMap).sort();
    const detailRows = workerNames.map(wk=>{
      const wTotal = days.reduce((s,d)=>s+(workerMap[wk][d]||0),0);
      if(!wTotal) return '';
      const wCells = days.map(d=>{
        const v = workerMap[wk][d]||0;
        return`<td style="text-align:center;font-size:11px;font-family:'DM Mono',monospace;padding:3px 2px;border-top:1px dashed var(--border);color:${v>0?'var(--text)':''};">${v>0?v:''}</td>`;
      }).join('');
      return`<tr class="${detailId}" style="display:none;background:var(--surface2);">
        <td style="font-size:11px;padding:3px 10px 3px 22px;color:var(--text-muted);white-space:nowrap;border-right:2px solid var(--border);border-top:1px dashed var(--border);">👤 ${wk}</td>
        ${wCells}
        <td style="text-align:center;font-size:11px;font-family:'DM Mono',monospace;color:var(--text-muted);padding:3px 6px;border-left:2px solid var(--border);border-top:1px dashed var(--border);">${wTotal}</td>
        <td style="text-align:center;font-size:11px;font-family:'DM Mono',monospace;color:var(--text-muted);padding:3px 6px;border-left:1px solid var(--border);border-top:1px dashed var(--border);">${(wTotal/7).toFixed(1)}</td>
      </tr>`;
    }).join('');

    return`<tr style="cursor:pointer;" onclick="toggleSiteDetail('${detailId}',this)">
      <td style="font-size:12px;padding:5px 10px;white-space:nowrap;font-weight:600;border-right:2px solid var(--border);">
        <span class="site-detail-arrow" style="font-size:10px;margin-right:4px;color:var(--text-muted);">▶</span>${site}
      </td>
      ${cells}
      <td style="text-align:center;font-size:12px;font-family:'DM Mono',monospace;font-weight:700;color:var(--ok);padding:4px 6px;border-left:2px solid var(--border);">${rowTotal}</td>
      <td style="text-align:center;font-size:12px;font-family:'DM Mono',monospace;font-weight:700;color:var(--text-muted);padding:4px 6px;border-left:1px solid var(--border);">${manDays}</td>
    </tr>
    ${detailRows}`;
  }).join('');

  // 合計行
  const totalCells = days.map(d=>{
    const v = sites.reduce((s,site)=>s+(siteMap[site][d]||0),0);
    return`<td style="text-align:center;font-size:12px;font-family:'DM Mono',monospace;font-weight:700;padding:4px 2px;${v>0?'color:var(--text);':''}">${v>0?v:''}</td>`;
  }).join('');
  const grandTotal = sites.reduce((s,site)=>s+days.reduce((ss,d)=>ss+(siteMap[site][d]||0),0),0);

  return`<div style="overflow-x:auto;">
    <table style="border-collapse:collapse;width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:var(--surface2);">
          <th style="text-align:left;padding:6px 10px;font-size:12px;min-width:140px;border-right:2px solid var(--border);">現場　<span style="font-size:10px;font-weight:400;color:var(--text-muted);">（クリックで内訳）</span></th>
          ${dayHeaders}
          <th style="text-align:center;padding:4px 6px;font-size:12px;border-left:2px solid var(--border);color:var(--ok);">合計時間</th>
          <th style="text-align:center;padding:4px 6px;font-size:12px;border-left:1px solid var(--border);color:var(--text-muted);">人工</th>
        </tr>
      </thead>
      <tbody>${dataRows}</tbody>
      <tfoot>
        <tr style="background:var(--surface2);border-top:2px solid var(--border);">
          <td style="font-weight:700;font-size:12px;padding:5px 10px;border-right:2px solid var(--border);">合計</td>
          ${totalCells}
          <td style="text-align:center;font-size:13px;font-family:'DM Mono',monospace;font-weight:700;color:var(--ok);padding:4px 6px;border-left:2px solid var(--border);">${grandTotal}</td>
          <td style="text-align:center;font-size:13px;font-family:'DM Mono',monospace;font-weight:700;color:var(--text-muted);padding:4px 6px;border-left:1px solid var(--border);">${(grandTotal/7).toFixed(1)}</td>
        </tr>
      </tfoot>
    </table>
  </div>`;
}

function toggleSiteDetail(id, row){
  const rows = document.querySelectorAll(`tr.${id}`);
  if(!rows.length) return;
  const arrow = row.querySelector('.site-detail-arrow');
  const isOpen = rows[0].style.display !== 'none';
  rows.forEach(r => r.style.display = isOpen ? 'none' : '');
  if(arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

function renderDailySummary(list, mf){
  const days = getMonthDays(mf);
  if(!days.length){
    // 月フィルターなし：実際にある日付のみ使用
    const allDates = [...new Set(list.map(r=>r.date))].sort();
    return`<div class="rsum-section">
      <div class="rsum-section-title">📅 現場別　作業時間（全期間）</div>
      ${buildSiteTable(list, allDates)}
    </div>`;
  }
  return`<div class="rsum-section">
    <div class="rsum-section-title">📅 現場別　作業時間（${mf.replace('-','年')}月）</div>
    ${buildSiteTable(list, days)}
  </div>`;
}

function renderPersonSummary(list, mf){
  const days = getMonthDays(mf).length ? getMonthDays(mf) : [...new Set(list.map(r=>r.date))].sort();
  const allWorkers = [...new Set(list.map(r=>r.worker))].sort();

  // 選択中の作業者（なければ最初の人）
  const sel = document.getElementById('rsumWorkerTab')?.value || allWorkers[0] || '';
  const w = allWorkers.includes(sel) ? sel : (allWorkers[0]||'');

  if(!w) return`<div class="rsum-section"><div style="color:var(--text-muted)">データがありません</div></div>`;

  // 作業者タブ
  const tabs = allWorkers.map(wk=>`
    <span class="master-subtab${wk===w?' active':''}" style="cursor:pointer;margin-bottom:-2px;"
      onclick="document.getElementById('rsumWorkerTab').value='${wk}';renderReportSummary()">
      👤 ${wk}
    </span>`).join('');

  // 選択中の作業者の作業内容別集計
  const wtMap={};
  list.forEach(r=>{
    if(r.worker!==w) return;
    r.rows.forEach(rw=>{
      if(!rw.hours||rw.hours<=0) return;
      (rw.workTypes||[]).forEach(wt=>{ wtMap[wt]=(wtMap[wt]||0)+rw.hours; });
    });
  });
  const wtSummary = Object.entries(wtMap).sort((a,b)=>b[1]-a[1]).map(([wt,h])=>
    `<span style="font-size:12px;margin-right:10px;"><span class="rsum-wt-chip">${wt}</span> <strong style="font-family:'DM Mono',monospace;">${h}h</strong></span>`
  ).join('');

  return`<div class="rsum-section">
    <div class="rsum-section-title">👤 人別　現場ごとの作業時間</div>
    <input type="hidden" id="rsumWorkerTab" value="${w}">
    <div class="master-subtabs" style="margin-bottom:16px;">${tabs}</div>
    <div class="rsum-person-header" style="margin-bottom:12px;">
      <span class="rsum-person-name">👤 ${w}</span>
      ${wtSummary?`<div style="margin-left:12px;display:flex;flex-wrap:wrap;gap:4px;">${wtSummary}</div>`:''}
    </div>
    ${buildSiteTable(list, days, w)}
  </div>`;
}

// ── ローカルキャッシュ保存（パスワードのみ）──
const STORAGE_KEY = 'taskManager_v1';
const PW_KEY_LS   = 'taskManager_pw';
function saveLocal(){ localStorage.setItem(STORAGE_KEY, JSON.stringify({tasks, workers, workerRetireDates, materials, vehicles, accessories, reports, sales, buyers, nextId, nextNum, nextMatId, nextVehId, nextAccId, nextReportId, nextSaleId, nextBuyerId})); }

// ══ LOCK / AUTH ══
const PW_KEY = PW_KEY_LS;
const PW_DEFAULT = '1234';
let lockFailCount = 0;
let lockUntil = 0;

function getStoredHash(){ return localStorage.getItem(PW_KEY) || hashPw(PW_DEFAULT); }

// 簡易ハッシュ（djb2）— HTMLファイル単体での抑止力として
function hashPw(pw){
  let h = 5381;
  for(let i=0;i<pw.length;i++) h = ((h<<5)+h) ^ pw.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function tryUnlock(){
  const now = Date.now();
  if(lockUntil > now){
    const sec = Math.ceil((lockUntil - now) / 1000);
    showLockError(`ロック中です。${sec}秒後に再試行してください。`);
    return;
  }
  const pw = document.getElementById('lockInput').value;
  if(!pw){ showLockError('パスワードを入力してください'); return; }
  if(hashPw(pw) === getStoredHash()){
    lockFailCount = 0;
    document.getElementById('lockScreen').style.display = 'none';
    document.getElementById('lockInput').value = '';
    document.getElementById('lockError').textContent = '';
    document.getElementById('lockAttempts').textContent = '';
  initApp();
  } else {
    lockFailCount++;
    const inp = document.getElementById('lockInput');
    inp.classList.remove('error');
    void inp.offsetWidth; // reflow for animation
    inp.classList.add('error');
    if(lockFailCount >= 5){
      lockUntil = Date.now() + 30000; // 30秒ロック
      showLockError('試行回数超過。30秒後に再試行してください。');
      document.getElementById('lockAttempts').textContent = '';
    } else {
      const left = 5 - lockFailCount;
      showLockError('パスワードが違います。');
      document.getElementById('lockAttempts').textContent = `残り試行回数: ${left}回`;
    }
    document.getElementById('lockInput').value = '';
  }
}

function showLockError(msg){
  document.getElementById('lockError').textContent = msg;
}

function toggleLockEye(){
  const inp = document.getElementById('lockInput');
  const eye = document.getElementById('lockEye');
  if(inp.type === 'password'){ inp.type = 'text'; eye.textContent = '🙈'; }
  else { inp.type = 'password'; eye.textContent = '👁'; }
}

function lockApp(){
  MaishinAuth.goLogin();
}

function showChangePassword(){
  MaishinAuth.changePassword();
}

// ── Init ──
// Load from Supabase after unlock
function applyEntryFromUrl(){
  const tab=new URLSearchParams(location.search).get('tab');
  const valid=['gantt','production','report','unit-sales'];
  if(tab&&valid.includes(tab))switchMainTab(tab);
  else if(typeof MaishinNav!=='undefined')MaishinNav.syncActive(MaishinNav.navIdForKakouTab(currentMainTab));
}
