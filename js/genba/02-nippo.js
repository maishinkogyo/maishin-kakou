
// ── 日報 ──
let editingNippoId=null,nippoWorkerIds=[],nippoIsOther=false,nippoStayMap={}; // nippoStayMap: {wid: 'commute'|'stay'}
// その他日報はlocalStorageで管理
function loadOtherNippoList(){try{return JSON.parse(localStorage.getItem('genba_other_nippo')||'[]')}catch{return[];}}
function saveOtherNippoList(list){localStorage.setItem('genba_other_nippo',JSON.stringify(list));}
let editingOtherNippoId=null;

function openNippoFromAssign(tid,date,workerIds){
  nippoWorkerIds=workerIds.map(Number);
  nippoStayMap={};workerIds.forEach(wid=>{nippoStayMap[wid]='commute';});
  const t=tasks.find(x=>x.id===tid);
  document.getElementById('nippoModalTitle').textContent='日報を入力';
  document.getElementById('nippoSiteName').textContent=t?(t.nameMain+(t.nameSub?` ／ ${t.nameSub}`:'')):'' ;
  document.getElementById('nippoDate').value=date;
  const wopts='<option value="">選択…</option>'+fieldWorkers.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  document.getElementById('nippoInputWorker').innerHTML=wopts;
  document.getElementById('nippoInputWorker').value='';
  document.getElementById('nippoClient').value=getTaskMeta(tid).client||'';
  document.getElementById('nippoContent').value='';
  document.getElementById('nippoLocation').value='市内';
  document.getElementById('nippoMaterial').value='自社';
  document.getElementById('nippoTimeStart').value='';
  document.getElementById('nippoTimeEnd').value='';
  populateCarSelect('');
  document.getElementById('nippoUnitPass').value='-';
  document.getElementById('nippoOther').value='';
  editingNippoId=null;
  editingOtherNippoId=null;
  nippoIsOther=false;
  document.getElementById('nippoModal').dataset.tid=tid;
  renderNippoWorkerToggles();openModal('nippoModal');
}

function openNippoFromOther(date,workerIds){
  nippoWorkerIds=workerIds.map(Number);
  nippoStayMap={};workerIds.forEach(wid=>{nippoStayMap[wid]='commute';});
  nippoIsOther=true;
  editingNippoId=null;
  editingOtherNippoId=null;
  document.getElementById('nippoModalTitle').textContent='日報を入力（その他）';
  document.getElementById('nippoSiteName').textContent='その他';
  document.getElementById('nippoDate').value=date;
  const wopts='<option value="">選択…</option>'+fieldWorkers.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  document.getElementById('nippoInputWorker').innerHTML=wopts;
  document.getElementById('nippoInputWorker').value='';
  document.getElementById('nippoClient').value='';
  document.getElementById('nippoContent').value='';
  document.getElementById('nippoLocation').value='市内';
  document.getElementById('nippoMaterial').value='自社';
  document.getElementById('nippoTimeStart').value='';
  document.getElementById('nippoTimeEnd').value='';
  populateCarSelect('');
  document.getElementById('nippoUnitPass').value='-';
  document.getElementById('nippoOther').value='';
  renderNippoWorkerToggles();openModal('nippoModal');
}

function editNippo(id){
  const r=workRecords.find(x=>x.id===id);
  if(!r)return;
  let ex={};try{ex=JSON.parse(r.note||'{}');}catch(e){}
  const t=tasks.find(x=>x.id===r.task_id);
  nippoWorkerIds=(ex.allWorkers||[]).map(Number);
  nippoStayMap=Object.assign({},(ex.workerStayTypes||{}));
  nippoWorkerIds.forEach(wid=>{if(!nippoStayMap[wid])nippoStayMap[wid]='commute';});
  document.getElementById('nippoModalTitle').textContent='日報を編集';
  document.getElementById('nippoSiteName').textContent=t?(t.nameMain+(t.nameSub?` ／ ${t.nameSub}`:'')):'' ;
  const wopts='<option value="">選択…</option>'+fieldWorkers.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  document.getElementById('nippoInputWorker').innerHTML=wopts;
  document.getElementById('nippoDate').value=r.date;
  document.getElementById('nippoInputWorker').value=ex.inputWorker||'';
  document.getElementById('nippoClient').value=ex.client||'';
  document.getElementById('nippoWorkersDisp').innerHTML=nippoWorkerIds.map(wid=>{
    const w=fieldWorkers.find(x=>x.id===Number(wid));
    return w?`<span style="background:#dbeafe;color:#1d4ed8;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">👤 ${w.name}</span>`:'';
  }).join('')||'<span style="color:var(--text-muted);font-size:12px">未設定</span>';
  document.getElementById('nippoContent').value=r.content||'';
  document.getElementById('nippoLocation').value=ex.location||'市内';
  document.getElementById('nippoMaterial').value=ex.material||'自社';
  document.getElementById('nippoTimeStart').value=ex.timeStart||'';
  document.getElementById('nippoTimeEnd').value=ex.timeEnd||'';
  populateCarSelect(ex.car||'');
  document.getElementById('nippoUnitPass').value=ex.unitPass||'-';
  document.getElementById('nippoOther').value=ex.other||'';
  editingNippoId=id;
  editingOtherNippoId=null;
  nippoIsOther=false;
  document.getElementById('nippoModal').dataset.tid=r.task_id;
  renderNippoWorkerToggles();openModal('nippoModal');
}

function editOtherNippo(id){
  const list=loadOtherNippoList();
  const r=list.find(x=>x.id===id);
  if(!r)return;
  let ex={};try{ex=JSON.parse(r.note||'{}');}catch(e){}
  nippoWorkerIds=(ex.allWorkers||[]).map(Number);
  nippoStayMap=Object.assign({},(ex.workerStayTypes||{}));
  nippoWorkerIds.forEach(wid=>{if(!nippoStayMap[wid])nippoStayMap[wid]='commute';});
  nippoIsOther=true;
  editingNippoId=null;
  editingOtherNippoId=id;
  document.getElementById('nippoModalTitle').textContent='日報を編集（その他）';
  document.getElementById('nippoSiteName').textContent='その他';
  const wopts='<option value="">選択…</option>'+fieldWorkers.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  document.getElementById('nippoInputWorker').innerHTML=wopts;
  document.getElementById('nippoDate').value=r.date;
  document.getElementById('nippoInputWorker').value=ex.inputWorker||'';
  document.getElementById('nippoClient').value=ex.client||'';
  document.getElementById('nippoWorkersDisp').innerHTML=nippoWorkerIds.map(wid=>{
    const w=fieldWorkers.find(x=>x.id===Number(wid));
    return w?`<span style="background:#dbeafe;color:#1d4ed8;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">👤 ${w.name}</span>`:'';
  }).join('')||'<span style="color:var(--text-muted);font-size:12px">未設定</span>';
  document.getElementById('nippoContent').value=r.content||'';
  document.getElementById('nippoLocation').value=ex.location||'市内';
  document.getElementById('nippoMaterial').value=ex.material||'自社';
  document.getElementById('nippoTimeStart').value=ex.timeStart||'';
  document.getElementById('nippoTimeEnd').value=ex.timeEnd||'';
  populateCarSelect(ex.car||'');
  document.getElementById('nippoUnitPass').value=ex.unitPass||'-';
  document.getElementById('nippoOther').value=ex.other||'';
  renderNippoWorkerToggles();openModal('nippoModal');
}

async function saveNippo(){
  const tid=Number(document.getElementById('nippoModal').dataset.tid);
  const date=document.getElementById('nippoDate').value;
  if(!date){alert('日付を入力してください');return;}

  // 作業員の時給をスナップショット保存
  const workerHourlyWages={};
  let totalHourlyWage=0;
  nippoWorkerIds.forEach(wid=>{
    const w=workersList.find(x=>x.id===wid);
    const wage=w?Number(w.hourly_wage||0):0;
    workerHourlyWages[wid]=wage;
    totalHourlyWage+=wage;
  });

  const extra={
    inputWorker:document.getElementById('nippoInputWorker').value,
    client:document.getElementById('nippoClient').value,
    location:document.getElementById('nippoLocation').value,
    material:document.getElementById('nippoMaterial').value,
    timeStart:document.getElementById('nippoTimeStart').value,
    timeEnd:document.getElementById('nippoTimeEnd').value,
    car:document.getElementById('nippoCar').value,
    unitPass:document.getElementById('nippoUnitPass').value,
    other:document.getElementById('nippoOther').value,
    allWorkers:nippoWorkerIds,
    workerStayTypes:nippoStayMap,
    workerHourlyWages:workerHourlyWages,
    _type:'nippo',
  };
  if(nippoIsOther){
    // その他日報はlocalStorageに保存
    const list=loadOtherNippoList();
    const content=document.getElementById('nippoContent').value.trim();
    if(editingOtherNippoId){
      const idx=list.findIndex(x=>x.id===editingOtherNippoId);
      if(idx>=0)list[idx]={...list[idx],date,content,note:JSON.stringify(extra)};
    }else{
      list.unshift({id:Date.now(),date,content,note:JSON.stringify(extra)});
    }
    saveOtherNippoList(list);
    closeModal('nippoModal');flash();renderNippo();
    return;
  }
  const payload={task_id:tid,date,progress:0,content:document.getElementById('nippoContent').value.trim(),note:JSON.stringify(extra),hourly_wage:totalHourlyWage};
  if(editingNippoId){
    const{error}=await sb.from('field_work_records').update(payload).eq('id',editingNippoId);
    if(cloudFailed(error,'日報の更新'))return;
    const idx=workRecords.findIndex(r=>r.id===editingNippoId);
    workRecords[idx]={...workRecords[idx],...payload};
  }else{
    const{data,error}=await sb.from('field_work_records').insert(payload).select().single();
    if(cloudFailed(error,'日報の保存'))return;
    workRecords.unshift(data);
  }
  closeModal('nippoModal');flash();renderNippo();populateSelects();renderAssign();
}

async function deleteNippo(id){
  if(!confirm('この日報を削除しますか？'))return;
  const{error}=await sb.from('field_work_records').delete().eq('id',id);
  if(cloudFailed(error,'日報の削除'))return;
  workRecords=workRecords.filter(r=>r.id!==id);
  flash('削除しました');renderNippo();populateSelects();
}

function deleteOtherNippo(id){
  if(!confirm('この日報を削除しますか？'))return;
  saveOtherNippoList(loadOtherNippoList().filter(x=>x.id!==id));
  flash('削除しました');renderNippo();
}

// 作業員トグル描画（nippoWorkerIds を直接更新）
function renderNippoWorkerToggles(){
  const el=document.getElementById('nippoWorkerToggles');
  if(!el)return;
  const isOther=nippoIsOther;
  const accentOn=isOther?'#92400e':'var(--accent)';
  const bgOn=isOther?'#dbeafe':'var(--accent-light)';
  el.innerHTML=fieldWorkers.map(w=>{
    const on=nippoWorkerIds.map(Number).includes(w.id);
    const stay=nippoStayMap[w.id]||'commute'; // 'commute'=通い, 'stay'=泊まり
    const stayLabel=stay==='stay'?'泊':'通';
    const stayBg=stay==='stay'?'#7c3aed':'#0891b2';
    if(on){
      return`<span style="display:inline-flex;align-items:center;gap:0;border-radius:20px;overflow:hidden;border:1.5px solid ${accentOn};font-size:12px;font-weight:600">
        <span onclick="toggleNippoWorker(${w.id})" style="cursor:pointer;padding:4px 10px;background:${bgOn};color:${accentOn}">✓ ${w.name}</span>
        <span onclick="toggleNippoStay(${w.id})" style="cursor:pointer;padding:4px 8px;background:${stayBg};color:#fff;font-size:11px">${stayLabel}</span>
      </span>`;
    }
    return`<span onclick="toggleNippoWorker(${w.id})" style="cursor:pointer;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-muted)">${w.name}</span>`;
  }).join('');
  // 上部チップ（通い:青 / 泊まり:紫）
  const disp=document.getElementById('nippoWorkersDisp');
  if(disp) disp.innerHTML=nippoWorkerIds.map(wid=>{
    const w=fieldWorkers.find(x=>x.id===Number(wid));
    if(!w)return'';
    const stay=nippoStayMap[w.id]||'commute';
    const bg=stay==='stay'?'#f3e8ff':'#dbeafe';
    const color=stay==='stay'?'#7c3aed':'#1d4ed8';
    const label=stay==='stay'?'泊':'通';
    return`<span style="background:${bg};color:${color};border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">👤 ${w.name} <span style="font-size:10px;opacity:.8">[${label}]</span></span>`;
  }).join('')||'<span style="color:var(--text-muted);font-size:12px">未設定</span>';
}
function toggleNippoWorker(wid){
  const ids=nippoWorkerIds.map(Number);
  const idx=ids.indexOf(Number(wid));
  if(idx>=0){nippoWorkerIds.splice(idx,1);delete nippoStayMap[wid];}
  else{nippoWorkerIds.push(Number(wid));nippoStayMap[wid]='commute';}
  renderNippoWorkerToggles();
}
function toggleNippoStay(wid){
  nippoStayMap[wid]=nippoStayMap[wid]==='stay'?'commute':'stay';
  renderNippoWorkerToggles();
}

// ── 日報タブ切り替え ──
function switchAssignTab(tab){
  ['grid','timeline'].forEach(t=>{
    document.getElementById('assignPane-'+t).style.display=t===tab?'block':'none';
    document.getElementById('assignTab-'+t).classList.toggle('active',t===tab);
  });
  if(tab==='timeline'){
    if(!document.getElementById('tlNippoDate').value) document.getElementById('tlNippoDate').value=todayStr();
    renderNippoTimeline();
  }else{
    setTimeout(scrollAssignToToday,80);
  }
}

// ── タイムスケジュール（日報） ──
const TL_COLORS=['#16a34a','#2563eb','#9333ea','#d97706','#dc2626','#0891b2','#7c3aed','#c026d3','#059669','#0284c7'];
const nippoColorMap={};let nippoColorIdx=0;
function getNippoSiteColor(key){if(!nippoColorMap[key])nippoColorMap[key]=TL_COLORS[nippoColorIdx++%TL_COLORS.length];return nippoColorMap[key];}

function renderNippoTimeline(){
  const el=document.getElementById('nippoTimelineView');
  if(!el)return;
  const date=document.getElementById('tlNippoDate').value;
  if(!date){el.innerHTML='<div class="empty"><div class="empty-icon">📅</div>日付を選択してください</div>';return;}
  if(!fieldWorkers.length){el.innerHTML='<div class="empty"><div class="empty-icon">👷</div>マスタ登録で従業員を登録してください</div>';return;}

  // その日の日報を収集 — _typeに関わらずallWorkersまたはtimeStartがあるもの全部
  const allRecords=[];
  workRecords.forEach(r=>{
    if(r.date!==date)return;
    try{
      const ex=JSON.parse(r.note||'{}');
      // nippoフラグ or allWorkers配列を持つ or timeStartがあるレコードを対象
      if(ex._type==='nippo'||ex.allWorkers||ex.timeStart)
        allRecords.push({r,ex,isOther:false});
    }catch(e){}
  });
  loadOtherNippoList().forEach(r=>{
    if(r.date!==date)return;
    try{const ex=JSON.parse(r.note||'{}');allRecords.push({r,ex,isOther:true});}catch(e){}
  });

  // 時間レンジ（デフォルト 7〜18、データがあれば拡張）
  let minH=7,maxH=18;
  allRecords.forEach(({ex})=>{
    if(ex.timeStart){const h=parseInt(ex.timeStart);if(!isNaN(h)&&h<minH)minH=h;}
    if(ex.timeEnd){const h=parseInt(ex.timeEnd)+1;if(!isNaN(h)&&h>maxH)maxH=h;}
  });
  const pxPerMin=1;
  const trackH=(maxH-minH)*60*pxPerMin;

  // 時間軸
  const hourMarks=[];
  for(let h=minH;h<=maxH;h++) hourMarks.push(`<div class="tl-hour-mark">${h}:00</div>`);
  const gridLines=[];
  for(let h=minH;h<=maxH;h++) gridLines.push(`<div class="tl-hour-line" style="top:${(h-minH)*60}px"></div>`);
  const timeAxis=`<div class="tl-axis"><div class="tl-axis-header"></div>${hourMarks.join('')}</div>`;

  // 全作業員カラム（日報なくても必ず表示）
  const workerCols=fieldWorkers.map(w=>{
    const myRecs=allRecords.filter(({ex})=>(ex.allWorkers||[]).map(Number).includes(Number(w.id)));
    const blocks=myRecs.filter(({ex})=>ex.timeStart&&ex.timeEnd).map(({r,ex,isOther})=>{
      const siteName=isOther?'その他':(()=>{const t=tasks.find(x=>x.id===Number(r.task_id));return t?(t.nameMain+(t.nameSub?`／${t.nameSub}`:'')):'-';})();
      const colorKey=isOther?'__other__':String(r.task_id);
      const color=isOther?'#854d0e':getNippoSiteColor(colorKey);
      const[sh,sm]=ex.timeStart.split(':').map(Number);
      const[eh,em]=ex.timeEnd.split(':').map(Number);
      const top=Math.max(0,(sh*60+sm-minH*60)*pxPerMin);
      const height=Math.max(22,((eh*60+em)-(sh*60+sm))*pxPerMin);
      return`<div class="tl-block" style="top:${top}px;height:${height}px;background:${color}" title="${siteName}  ${ex.timeStart}〜${ex.timeEnd}">${siteName}<br><span style="font-size:10px;opacity:.85">${ex.timeStart}〜${ex.timeEnd}</span></div>`;
    }).join('');
    return`<div class="tl-col">
      <div class="tl-col-name">${w.name}</div>
      <div class="tl-track" style="height:${trackH}px">${gridLines.join('')}${blocks}</div>
    </div>`;
  }).join('');

  // 凡例
  const legend=Object.entries(nippoColorMap).map(([key,color])=>{
    const t=tasks.find(x=>String(x.id)===key);
    const label=t?(t.nameMain+(t.nameSub?`／${t.nameSub}`:'')):key;
    return`<div class="tl-legend-item"><span style="width:12px;height:12px;border-radius:3px;background:${color};display:inline-block;flex-shrink:0"></span>${label}</div>`;
  }).join('');
  const otherInUse=allRecords.some(({isOther})=>isOther);
  const otherLegend=otherInUse?`<div class="tl-legend-item"><span style="width:12px;height:12px;border-radius:3px;background:#854d0e;display:inline-block;flex-shrink:0"></span>その他</div>`:'';
  const noData=!allRecords.length?`<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:12px 0">この日の日報はまだありません</div>`:'';

  el.innerHTML=`${noData}<div class="tl-wrap">${timeAxis}${workerCols}</div>${(legend||otherLegend)?`<div class="tl-legend">${legend}${otherLegend}</div>`:''}`;
}

function nippoCard(r,isOther=false){
  let ex={};try{ex=JSON.parse(r.note||'{}');}catch(e){}
  const siteName=isOther?'その他':(()=>{const t=tasks.find(x=>x.id===r.task_id);return t?(t.nameMain+(t.nameSub?` ／ ${t.nameSub}`:'')):'-';})();
  const inputWorkerName=ex.inputWorker?(fieldWorkers.find(w=>w.id===Number(ex.inputWorker))||{}).name||'':'';
  const stayTypes=ex.workerStayTypes||{};
  const allW=(ex.allWorkers||[]).map(wid=>{const w=fieldWorkers.find(x=>x.id===Number(wid));return w?{name:w.name,stay:stayTypes[wid]||stayTypes[String(wid)]||'commute'}:null}).filter(Boolean);
  const chipColor=isOther?'background:#dbeafe;color:#1d4ed8':'background:#dbeafe;color:#1d4ed8';
  const badges=[];
  if(ex.location)badges.push(`<span class="badge blue">${ex.location}</span>`);
  if(ex.material&&ex.material!=='自社')badges.push(`<span class="badge">${ex.material}</span>`);
  if(ex.timeStart||ex.timeEnd)badges.push(`<span class="badge green">⏱ ${ex.timeStart||'?'}〜${ex.timeEnd||'?'}</span>`);
  if(ex.car)badges.push(`<span class="badge">🚗 ${ex.car}</span>`);
  if(ex.unitPass&&ex.unitPass!=='-')badges.push(`<span class="badge ${ex.unitPass==='○'?'green':'red'}">ユニット ${ex.unitPass}</span>`);
  if(ex.client)badges.push(`<span class="badge amber">${ex.client}</span>`);
  const editBtn=isOther?`onclick="editOtherNippo(${r.id})"`:`onclick="editNippo(${r.id})"`;
  const delBtn=isOther?`onclick="deleteOtherNippo(${r.id})"`:`onclick="deleteNippo(${r.id})"`;
  return`<div style="background:var(--surface);border:1px solid ${isOther?'#93c5fd':'var(--border)'};border-radius:8px;padding:8px 10px;margin-bottom:6px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;min-width:0">
        <span style="font-size:12px;font-weight:800;color:${isOther?'#1e40af':'var(--accent)'};white-space:nowrap">${siteName}</span>
        <span style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap">${fmt(r.date)}</span>
        ${inputWorkerName?`<span style="font-size:11px;color:#7c3aed;background:#f3e8ff;border-radius:20px;padding:1px 6px">入力: ${inputWorkerName}</span>`:''}
        ${allW.map(({name,stay})=>{const stayBg=stay==='stay'?'#7c3aed':'#0891b2';return`<span style="background:#dbeafe;color:#1d4ed8;border-radius:20px;padding:1px 6px;font-size:11px;font-weight:600">${name}<span style="background:${stayBg};color:#fff;border-radius:8px;padding:0 4px;font-size:10px;margin-left:3px">${stay==='stay'?'泊':'通'}</span></span>`;}).join('')}
        ${badges.length?badges.join(''):''}
        ${r.content?`<span style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px" title="${r.content}">${r.content}</span>`:''}
        ${ex.other?`<span style="font-size:11px;color:var(--text-muted)">備考:${ex.other}</span>`:''}
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" ${editBtn}>編集</button>
        <button class="btn btn-danger btn-sm" ${delBtn}>削除</button>
      </div>
    </div>
  </div>`;
}

function renderNippo(){
  const el=document.getElementById('nippoList');
  if(!el)return;
  const siteFilter=document.getElementById('nippoSiteSel')?.value;
  const monthFilter=document.getElementById('nippoMonth')?.value;
  // 現場日報（Supabase）
  let recs=workRecords.filter(r=>{
    try{const ex=JSON.parse(r.note||'{}');return ex._type==='nippo';}catch{return false;}
  });
  if(siteFilter)recs=recs.filter(r=>String(r.task_id)===siteFilter);
  if(monthFilter)recs=recs.filter(r=>r.date.startsWith(monthFilter));
  // その他日報（localStorage）— サイトフィルタ選択中は非表示
  let otherRecs=siteFilter?[]:loadOtherNippoList();
  if(monthFilter)otherRecs=otherRecs.filter(r=>r.date.startsWith(monthFilter));
  // 合わせてソート
  const all=[
    ...recs.map(r=>({r,isOther:false})),
    ...otherRecs.map(r=>({r,isOther:true})),
  ].sort((a,b)=>b.r.date.localeCompare(a.r.date));
  if(!all.length){el.innerHTML='<div class="empty"><div class="empty-icon">📝</div>日報がありません</div>';return;}
  el.innerHTML=all.map(({r,isOther})=>nippoCard(r,isOther)).join('');
}
