
// ── 原価管理 ──
function renderCosts(){
  const tid=Number(document.getElementById('costTaskSel').value);
  const statsEl=document.getElementById('costStats'),listEl=document.getElementById('costList');
  if(!tid){statsEl.innerHTML='';listEl.innerHTML='<div class="empty"><div class="empty-icon">💰</div>現場を選択してください</div>';return;}
  const cats=['材料費','外注費','人件費','その他'];
  const taskCosts=costs.filter(c=>c.task_id===tid).sort((a,b)=>b.date.localeCompare(a.date));
  const totals=Object.fromEntries(cats.map(c=>[c,taskCosts.filter(x=>x.category===c).reduce((s,x)=>s+Number(x.amount),0)]));
  const grand=Object.values(totals).reduce((s,v)=>s+v,0);
  statsEl.innerHTML=`<div class="stat-grid">
    <div class="stat-card"><div class="stat-value">${fmtMoney(grand)}</div><div class="stat-label">合計原価</div></div>
    ${cats.map(c=>`<div class="stat-card"><div class="stat-value" style="font-size:18px">${fmtMoney(totals[c])}</div><div class="stat-label">${c}</div></div>`).join('')}
  </div>`;
  if(!taskCosts.length){listEl.innerHTML='<div class="empty"><div class="empty-icon">💰</div>費用記録がありません</div>';return;}
  listEl.innerHTML=`<table class="data-table"><thead><tr><th>日付</th><th>カテゴリ</th><th style="text-align:right">金額</th><th>メモ</th><th></th></tr></thead><tbody>`+
    taskCosts.map(c=>`<tr>
      <td style="white-space:nowrap">${fmt(c.date)}</td>
      <td><span class="badge cat-${c.category}">${c.category}</span></td>
      <td style="font-weight:700;text-align:right">${fmtMoney(c.amount)}</td>
      <td style="color:var(--text-muted)">${c.note||''}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-secondary btn-sm" onclick="editCost(${c.id})" style="margin-right:4px">編集</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCost(${c.id})">削除</button>
      </td></tr>`).join('')+'</tbody></table>';
}

function openCostModal(id=null){
  const tid=Number(document.getElementById('costTaskSel').value);
  if(!tid){alert('先に現場を選択してください');return;}
  editingCostId=id;
  document.getElementById('costModalTitle').textContent=id?'費用を編集':'費用追加';
  if(id){
    const c=costs.find(x=>x.id===id);
    document.getElementById('costDate').value=c.date;
    document.getElementById('costCat').value=c.category;
    document.getElementById('costAmount').value=c.amount;
    document.getElementById('costNote').value=c.note||'';
  }else{
    document.getElementById('costDate').value=todayStr();
    document.getElementById('costAmount').value='';
    document.getElementById('costNote').value='';
  }
  openModal('costModal');
}
function editCost(id){openCostModal(id);}

async function saveCost(){
  const tid=Number(document.getElementById('costTaskSel').value);
  const date=document.getElementById('costDate').value;
  const category=document.getElementById('costCat').value;
  const amount=Number(document.getElementById('costAmount').value);
  const note=document.getElementById('costNote').value.trim();
  if(!date||!amount){alert('日付と金額を入力してください');return;}
  const payload={task_id:tid,date,category,amount,note};
  if(editingCostId){
    const{error}=await sb.from('field_costs').update(payload).eq('id',editingCostId);
    if(cloudFailed(error,'原価の更新'))return;
    const idx=costs.findIndex(c=>c.id===editingCostId);
    costs[idx]={...costs[idx],...payload};
  }else{
    const{data,error}=await sb.from('field_costs').insert(payload).select().single();
    if(cloudFailed(error,'原価の保存'))return;
    costs.unshift(data);
  }
  closeModal('costModal');flash();renderCosts();populateSelects();
}

async function deleteCost(id){
  if(!confirm('この費用記録を削除しますか？'))return;
  const{error}=await sb.from('field_costs').delete().eq('id',id);
  if(cloudFailed(error,'原価の削除'))return;
  costs=costs.filter(c=>c.id!==id);
  flash();renderCosts();populateSelects();
}

// ── 作業員 ──
function renderWorkers(){
  const el=document.getElementById('workerList');
  if(!el)return;
  if(!fieldWorkers.length){el.innerHTML='<div class="empty" style="padding:20px"><div class="empty-icon">👷</div>作業員が登録されていません</div>';return;}
  el.innerHTML=`<table class="data-table"><thead><tr><th>氏名</th><th>職種</th><th>日当</th><th>メモ</th><th></th></tr></thead><tbody>`+
    fieldWorkers.map(w=>`<tr>
      <td style="font-weight:700">${w.name}</td>
      <td>${w.role||'－'}</td>
      <td>${w.daily_rate?fmtMoney(w.daily_rate):'－'}</td>
      <td style="color:var(--text-muted)">${w.note||''}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-secondary btn-sm" onclick="editWorker(${w.id})" style="margin-right:4px">編集</button>
        <button class="btn btn-danger btn-sm" onclick="deleteWorker(${w.id})">削除</button>
      </td></tr>`).join('')+'</tbody></table>';
}

function openWorkerModal(){
  editingWrkId=null;
  document.getElementById('wrkModalTitle').textContent='作業員追加';
  ['wrkId','wrkName','wrkRole','wrkRate','wrkNote'].forEach(id=>document.getElementById(id).value='');
  openModal('workerModal');
}
function editWorker(id){
  editingWrkId=id;
  const w=fieldWorkers.find(x=>x.id===id);
  document.getElementById('wrkModalTitle').textContent='作業員を編集';
  document.getElementById('wrkId').value=id;
  document.getElementById('wrkName').value=w.name;
  document.getElementById('wrkRole').value=w.role||'';
  document.getElementById('wrkRate').value=w.daily_rate||'';
  document.getElementById('wrkNote').value=w.note||'';
  openModal('workerModal');
}

async function saveWorker(){
  const name=document.getElementById('wrkName').value.trim();
  const role=document.getElementById('wrkRole').value.trim();
  const daily_rate=Number(document.getElementById('wrkRate').value)||0;
  const note=document.getElementById('wrkNote').value.trim();
  if(!name){alert('氏名を入力してください');return;}
  const payload={name,role,daily_rate,note};
  if(editingWrkId){
    const{error}=await sb.from('field_workers').update(payload).eq('id',editingWrkId);
    if(cloudFailed(error,'作業員の更新'))return;
    const idx=fieldWorkers.findIndex(w=>w.id===editingWrkId);
    fieldWorkers[idx]={...fieldWorkers[idx],...payload};
  }else{
    const{data,error}=await sb.from('field_workers').insert(payload).select().single();
    if(cloudFailed(error,'作業員の保存'))return;
    fieldWorkers.push(data);
    fieldWorkers.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  }
  closeModal('workerModal');flash();renderWorkers();populateSelects();
}

async function deleteWorker(id){
  if(!confirm('この作業員を削除しますか？'))return;
  const{error}=await sb.from('field_workers').delete().eq('id',id);
  if(cloudFailed(error,'作業員の削除'))return;
  fieldWorkers=fieldWorkers.filter(w=>w.id!==id);
  flash();renderWorkers();populateSelects();
}


// ── 車両マスタ（localStorage管理） ──
const VEHICLES_KEY='genba_vehicles';
let editingVehicleId=null;

function loadVehicles(){try{return JSON.parse(localStorage.getItem(VEHICLES_KEY)||'[]');}catch{return[];}}
function saveVehicles(list){localStorage.setItem(VEHICLES_KEY,JSON.stringify(list));}

function renderVehicles(){
  const list=loadVehicles();
  const el=document.getElementById('vehicleList');
  if(!list.length){
    el.innerHTML='<div class="empty" style="padding:20px"><div class="empty-icon">🚗</div>車両が登録されていません</div>';
    return;
  }
  el.innerHTML=`<table class="data-table"><thead><tr><th>車両名</th><th>種別</th><th>ナンバー</th><th>メモ</th><th>車検日</th><th>車検先</th><th></th></tr></thead><tbody>`+
    list.map(v=>`<tr>
      <td style="font-weight:700">${v.name}</td>
      <td>${v.type||'－'}</td>
      <td style="color:var(--text-muted)">${v.plate||'－'}</td>
      <td style="color:var(--text-muted)">${v.note||''}</td>
      <td style="color:var(--text-muted)">${v.inspection?v.inspection.replace(/-/g,'/'):''}</td>
      <td style="color:var(--text-muted)">${v.inspectionPlace||''}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-secondary btn-sm" onclick="editVehicle('${v.id}')" style="margin-right:4px">編集</button>
        <button class="btn btn-danger btn-sm" onclick="deleteVehicle('${v.id}')">削除</button>
      </td></tr>`).join('')+'</tbody></table>';
}

function openVehicleModal(){
  editingVehicleId=null;
  document.getElementById('vehModalTitle').textContent='車両追加';
  document.getElementById('vehName').value='';
  document.getElementById('vehType').value='乗用車';
  document.getElementById('vehPlate').value='';
  document.getElementById('vehNote').value='';
  document.getElementById('vehInspection').value='';
  document.getElementById('vehInspectionPlace').value='';
  openModal('vehicleModal');
}

function editVehicle(id){
  editingVehicleId=id;
  const v=loadVehicles().find(x=>x.id===id);
  if(!v)return;
  document.getElementById('vehModalTitle').textContent='車両を編集';
  document.getElementById('vehName').value=v.name;
  document.getElementById('vehType').value=v.type||'乗用車';
  document.getElementById('vehPlate').value=v.plate||'';
  document.getElementById('vehNote').value=v.note||'';
  document.getElementById('vehInspection').value=v.inspection||'';
  document.getElementById('vehInspectionPlace').value=v.inspectionPlace||'';
  openModal('vehicleModal');
}

function saveVehicle(){
  const name=document.getElementById('vehName').value.trim();
  if(!name){alert('車両名を入力してください');return;}
  const payload={
    name,
    type:document.getElementById('vehType').value,
    plate:document.getElementById('vehPlate').value.trim(),
    note:document.getElementById('vehNote').value.trim(),
    inspection:document.getElementById('vehInspection').value.trim(),
    inspectionPlace:document.getElementById('vehInspectionPlace').value.trim(),
  };
  const list=loadVehicles();
  if(editingVehicleId){
    const idx=list.findIndex(v=>v.id===editingVehicleId);
    if(idx>=0)list[idx]={...list[idx],...payload};
  }else{
    payload.id='veh_'+Date.now();
    list.push(payload);
  }
  saveVehicles(list);
  closeModal('vehicleModal');flash();renderVehicles();
}

function deleteVehicle(id){
  if(!confirm('この車両を削除しますか？'))return;
  saveVehicles(loadVehicles().filter(v=>v.id!==id));
  flash();renderVehicles();
}


// ── UI ──
function toggleSettingsPanel(name){
  const panel=document.getElementById('settingsPanel-'+name);
  if(!panel)return;
  const isOpen=panel.style.display!=='none';
  // 一度全部閉じる
  document.querySelectorAll('[id^="settingsPanel-"]').forEach(p=>{p.style.display='none';});
  // 閉じてたら開く（開いてたらそのまま閉じた状態）
  if(!isOpen){
    panel.style.display='block';
    panel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}

function closeMobileMore(){
  const s=document.getElementById('mobileMoreSheet');
  if(s)s.classList.remove('open');
}
function toggleMobileMore(){
  const s=document.getElementById('mobileMoreSheet');
  if(s)s.classList.toggle('open');
}
function showPage(name){
  if(name==='sites')name='assign';
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  if(typeof MaishinNav!=='undefined')MaishinNav.syncActive(MaishinNav.navIdForGenbaPage(name));
  document.querySelectorAll('.mbn-item[data-page]').forEach(b=>{
    b.classList.toggle('active',b.dataset.page===name);
  });
  closeMobileMore();
  if(name==='assign')setTimeout(scrollAssignToToday,80);
}
function initMaishinSideNavGenba(){
  if(typeof MaishinNav==='undefined')return;
  const page=new URLSearchParams(location.search).get('page')||'assign';
  const valid=['assign','nippo','costs'];
  const active=valid.includes(page)?MaishinNav.navIdForGenbaPage(page):'assign';
  const el=document.getElementById('maishinSideNavItems');
  if(el)MaishinNav.renderNav(el,{activeId:active});
  const mob=document.getElementById('maishinMobileMoreNav');
  if(mob)MaishinNav.renderNav(mob,{activeId:active});
}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(el=>{el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open');});});

let flashTimer;
let cloudWarnSticky=false;

function isSupabaseAccessError(error){
  if(!error)return false;
  const code=String(error.code||'');
  const status=error.status||error.statusCode;
  if(status===401||status===403)return true;
  if(code==='42501'||code==='PGRST301'||code==='401'||code==='403')return true;
  const msg=String(error.message||error.details||error.hint||'').toLowerCase();
  return /row-level security|permission denied|jwt|not authorized|policy|forbidden/.test(msg);
}
function cloudSaveErrorMessage(error){
  if(isSupabaseAccessError(error)){
    return 'クラウドに保存できませんでした。通信またはデータベースの権限設定を確認してください。';
  }
  if(typeof navigator!=='undefined'&&!navigator.onLine){
    return 'クラウドに保存できませんでした。ネットワーク接続を確認してください。';
  }
  return 'クラウドに保存できませんでした。しばらくしてから再度お試しください。';
}
function showCloudWarnBanner(msg){
  const el=document.getElementById('cloudWarn');
  if(!el)return;
  el.textContent=msg;
  el.classList.add('visible');
  document.body.classList.add('cloud-warn-active');
  cloudWarnSticky=true;
}
function clearCloudWarnBanner(){
  cloudWarnSticky=false;
  const el=document.getElementById('cloudWarn');
  if(!el)return;
  el.classList.remove('visible');
  document.body.classList.remove('cloud-warn-active');
}
function flashError(msg,duration=6000){
  const el=document.getElementById('flash');
  el.textContent=msg;
  el.classList.add('flash-error');
  el.style.display='block';
  clearTimeout(flashTimer);
  flashTimer=setTimeout(()=>{
    el.style.display='none';
    el.classList.remove('flash-error');
  },duration);
}
function reportCloudError(error,context){
  console.warn(context||'Supabase:',error);
  flashError(cloudSaveErrorMessage(error));
}
function reportCloudException(e,context){
  reportCloudError(e&&e.message?e:{message:String(e)},context);
}
function cloudFailed(error,context){
  if(!error)return false;
  reportCloudError(error,context);
  return true;
}
function noteCloudLoadFailure(error,label){
  if(!error)return;
  console.warn(label+'の読み込み失敗:',error);
  if(isSupabaseAccessError(error)){
    showCloudWarnBanner('クラウドからデータを読み込めませんでした。データベースの権限設定または通信を確認してください。');
  }
}
function flash(msg='保存しました'){
  const el=document.getElementById('flash');
  el.classList.remove('flash-error');
  el.textContent=msg;
  el.style.display='block';
  clearTimeout(flashTimer);
  flashTimer=setTimeout(()=>el.style.display='none',2000);
}
function showLoading(){let el=document.getElementById('ld');if(!el){el=document.createElement('div');el.id='ld';el.style.cssText='position:fixed;bottom:20px;right:20px;background:#fff;border:1px solid var(--border);padding:10px 16px;border-radius:8px;font-size:13px;z-index:9998;box-shadow:0 4px 16px rgba(0,0,0,.1)';el.textContent='読み込み中…';document.body.appendChild(el);}el.style.display='block';}
function hideLoading(){const el=document.getElementById('ld');if(el)el.style.display='none';}

function showGenbaPdfMenu(){
  if(typeof MaishinPdfMenu==='undefined'){alert('PDFメニューを読み込めませんでした。');return;}
  MaishinPdfMenu.openMenu({
    items:[
      {label:'👷 作業配置',meta:'A4 横',onClick:()=>printGenbaPdf('assign')},
      {label:'📊 現場日報',meta:'A4 縦',onClick:()=>printGenbaPdf('nippo')},
      {label:'💰 現場原価管理',meta:'A4 縦',onClick:()=>printGenbaPdf('costs')},
    ],
  });
}
function printGenbaPdf(page){
  if(page==='sites')page='assign';
  showPage(page);
  closeMobileMore();
  const css=`
    @media print{
      @page{size:A4;margin:12mm;}
      .ms-sidebar,.mobile-bottom-nav,.mobile-more-sheet,#maishinAuthGate,#flash,#ld,#cloudWarn{display:none!important;}
      .main-content{margin:0!important;padding:8px!important;max-width:none!important;}
      .page{display:none!important;}
      #page-${page}{display:block!important;}
      #page-${page} .page-desc{display:none;}
    }
  `;
  MaishinPdfMenu.runBrowserPrint(()=>css);
}

function updateGenbaMobileLayout(){
  document.body.classList.toggle('genba-mobile',window.matchMedia('(max-width:900px)').matches);
  if(document.getElementById('page-assign')?.classList.contains('active'))scrollAssignToToday();
}
window.addEventListener('resize',updateGenbaMobileLayout);
updateGenbaMobileLayout();
if(MaishinAuth.isSessionValid()){
  document.body.classList.remove('maishin-auth-pending');
  MaishinAuth.applyHomeLinks();
  initMaishinSideNavGenba();
  initApp();
}
