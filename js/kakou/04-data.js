function dbToTask(r){
  const nameMain=r.name_main||(r.name&&r.name.includes(' ／ ')?r.name.split(' ／ ')[0]:r.name)||'';
  const nameSub=r.name_sub||(r.name&&r.name.includes(' ／ ')?r.name.split(' ／ ').slice(1).join(' ／ '):'')||'';
  return {
    id:r.id, num:r.num??r.id, name:r.name,
    nameMain, nameSub, dept:r.dept||'',
    material:r.material||'',
    priority:normalizePriority(r.priority),
    total:r.total??0, done:r.done??0,
    deadline:r.deadline??null, start:r.start_date??null,
    workflowType:normalizeWorkflowType(r.workflow_type),
    fieldStart:r.field_start_date??null,
    fieldEnd:r.field_end_date??null,
    workers:[], unitあり:r.unit_flag??false, unitType:r.unit_type||(r.unit_flag?'full':'none'),
    complete:r.complete??false, dailyLog:r.daily_log??[], transportLog:r.transport_log??[]
  };
}
function taskToDb(t){
  return {
    id:t.id, num:t.num, name:t.name,
    name_main:t.nameMain||null, name_sub:t.nameSub||null, dept:t.dept||'',
    material:t.material||null,
    priority:normalizePriority(t.priority),
    total:t.total, done:t.done,
    deadline:t.deadline||null, start_date:t.start||null,
    workflow_type:normalizeWorkflowType(t.workflowType),
    field_start_date:t.fieldStart||null,
    field_end_date:t.fieldEnd||null,
    workers:[], unit_flag:t.unitType!=='none'&&!!t.unitType, unit_type:t.unitType||'none',
    complete:t.complete, daily_log:t.dailyLog||[], transport_log:t.transportLog||[]
  };
}

// ── ローディング表示 ──
function showLoading(msg='読み込み中…'){
  let el=document.getElementById('sbLoading');
  if(!el){
    el=document.createElement('div');
    el.id='sbLoading';
    el.style.cssText='position:fixed;bottom:20px;right:20px;background:#ffffff;border:1px solid var(--border);color:var(--text);padding:10px 16px;border-radius:8px;font-size:13px;z-index:9998;display:flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);';
    el.innerHTML='<span style="animation:spin 1s linear infinite;display:inline-block">⟳</span><span id="sbLoadingMsg"></span>';
    document.body.appendChild(el);
    if(!document.getElementById('spinStyle')){
      const s=document.createElement('style');s.id='spinStyle';
      s.textContent='@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }
  }
  document.getElementById('sbLoadingMsg').textContent=msg;
  el.style.display='flex';
}
function hideLoading(){
  const el=document.getElementById('sbLoading');
  if(el)el.style.display='none';
}

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
function flashOk(msg='保存しました'){
  clearCloudWarnBanner();
  const el=document.getElementById('flash');
  if(!el)return;
  el.classList.remove('flash-error');
  el.textContent=msg;
  el.style.display='block';
  clearTimeout(flashTimer);
  flashTimer=setTimeout(()=>{el.style.display='none';},2200);
}
function flashError(msg,duration=6000){
  const el=document.getElementById('flash');
  if(!el)return;
  el.textContent=msg;
  el.classList.add('flash-error');
  el.style.display='block';
  clearTimeout(flashTimer);
  flashTimer=setTimeout(()=>{
    el.style.display='none';
    el.classList.remove('flash-error');
  },duration);
  flashSaveFailed();
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

function flashSaved(){
  const el=document.getElementById('saveIndicator');
  if(el){
    el.textContent='✓ 保存済み';
    el.style.color='var(--ok)';
    el.classList.remove('save-fail');
    el.style.opacity='1';
    clearTimeout(el._t);
    el._t=setTimeout(()=>el.style.opacity='0',1500);
  }
}
function flashSaveFailed(){
  const el=document.getElementById('saveIndicator');
  if(el){
    el.textContent='✕ 保存できませんでした';
    el.style.color='var(--danger)';
    el.classList.add('save-fail');
    el.style.opacity='1';
    clearTimeout(el._t);
    el._t=setTimeout(()=>{
      el.style.opacity='0';
      el.classList.remove('save-fail');
      el.textContent='✓ 保存済み';
      el.style.color='var(--ok)';
    },5000);
  }
}

// ── 全データ読み込み ──
async function loadData(){
  showLoading('データを読み込み中…');
  try{
    const [
      {data:dbTasks,  error:e1},
      {data:dbWorkers,error:e2},
      {data:dbMeta,   error:e3},
      {data:dbMats,   error:e4},
      {data:dbVehs,   error:e5},
      {data:dbRpts,   error:e6},
      {data:dbSales,  error:e7},
      {data:dbBuyers,  error:e8},
      {data:dbAccs,    error:e9}
    ] = await Promise.all([
      sb.from('tasks').select('*').order('num'),
      sb.from('workers_list').select('*').order('sort_order'),
      sb.from('meta').select('*'),
      sb.from('materials').select('*').order('id'),
      sb.from('vehicles').select('*').order('id'),
      sb.from('daily_reports').select('*').order('date'),
      sb.from('unit_sales').select('*').order('date'),
      sb.from('buyers').select('*').order('id'),
      sb.from('accessories').select('*').order('id')
    ]);
    if(e1){noteCloudLoadFailure(e1,'現場データ');throw e1;}
    if(e2){noteCloudLoadFailure(e2,'作業者');throw e2;}
    if(e3) throw e3;
    tasks   = dbTasks.map(dbToTask);
    workers = dbWorkers.filter(r=>(r.affiliation||'')==='加工'||r.is_kakou).map(r=>r.name);
    // ローカルキャッシュを先に読み込んでおき、DB成功分で上書きする（部分失敗でキャッシュを消さない）
    let _cache = {};
    try{ const raw=localStorage.getItem(STORAGE_KEY); if(raw) _cache=JSON.parse(raw); }catch{}
    if(dbMats && !e4) {
      materials = dbMats.map(r=>({id:r.id, name:r.name, note:r.note||''}));
      nextMatId = materials.length ? Math.max(...materials.map(m=>m.id))+1 : 1;
    } else if(e4 && _cache.materials) {
      materials = _cache.materials; nextMatId = materials.length ? Math.max(...materials.map(m=>m.id))+1 : 1;
      console.warn('materials DB失敗、キャッシュ使用:', e4.message);
    }
    if(dbVehs && !e5) {
      vehicles = dbVehs.map(r=>({id:r.id, name:r.name, note:r.note||''}));
      nextVehId = vehicles.length ? Math.max(...vehicles.map(v=>v.id))+1 : 1;
    } else if(e5 && _cache.vehicles) {
      vehicles = _cache.vehicles; nextVehId = vehicles.length ? Math.max(...vehicles.map(v=>v.id))+1 : 1;
      console.warn('vehicles DB失敗、キャッシュ使用:', e5.message);
    }
    if(dbRpts && !e6) {
      reports = dbRpts.map(r=>({id:r.id, date:r.date, worker:r.worker, rows:r.rows||[], overtime:r.overtime||0, late:r.late||0, early:r.early||0, memo:r.memo||'', status:r.status||'通常', extraTimes:r.extra_times||{}}));
      nextReportId = reports.length ? Math.max(...reports.map(r=>r.id))+1 : 1;
    } else if(e6 && _cache.reports) {
      reports = _cache.reports; nextReportId = reports.length ? Math.max(...reports.map(r=>r.id))+1 : 1;
      console.warn('daily_reports DB失敗、キャッシュ使用:', e6.message);
    }
    if(dbSales && !e7) {
      sales = dbSales.map(r=>({id:r.id, date:r.date, taskId:r.task_id, taskName:r.task_name||'', buyer:r.buyer||'', kg:r.kg||0, amount:r.amount||0, memo:r.memo||'', status:r.status||'出荷済'}));
      nextSaleId = sales.length ? Math.max(...sales.map(s=>s.id))+1 : 1;
    } else if(e7 && _cache.sales) {
      sales = _cache.sales; nextSaleId = sales.length ? Math.max(...sales.map(s=>s.id))+1 : 1;
      console.warn('unit_sales DB失敗、キャッシュ使用:', e7.message);
    }
    if(dbBuyers && !e8) {
      if(dbBuyers.length > 0) {
        buyers = dbBuyers.map(r=>({id:r.id, name:r.name, unitPrice:r.unit_price||0, mainItem:r.main_item||''}));
        nextBuyerId = buyers.length ? Math.max(...buyers.map(b=>b.id))+1 : 1;
      } else if(_cache.buyers && _cache.buyers.length > 0) {
        // Supabase空だがキャッシュにデータあり → 復元してDBに再同期
        buyers = _cache.buyers;
        nextBuyerId = buyers.length ? Math.max(...buyers.map(b=>b.id))+1 : 1;
        console.warn('buyers: Supabase空→ローカルキャッシュから復元し再同期します');
        Promise.all(buyers.map(b=>sb.from('buyers').upsert({id:b.id,name:b.name,unit_price:b.unitPrice}))).catch(e=>console.warn('buyers再同期失敗:',e));
      }
    } else if(e8 && _cache.buyers) {
      buyers = _cache.buyers; nextBuyerId = buyers.length ? Math.max(...buyers.map(b=>b.id))+1 : 1;
      console.warn('buyers DB失敗、キャッシュ使用:', e8.message);
    }
    if(dbAccs && !e9 && dbAccs.length > 0) {
      accessories = dbAccs.map(r=>({id:r.id, name:r.name, note:r.note||''}));
      nextAccId = accessories.length ? Math.max(...accessories.map(a=>a.id))+1 : 1;
    } else if(!e9 && dbAccs && dbAccs.length === 0 && _cache.accessories && _cache.accessories.length > 0) {
      // DBが空だがキャッシュにデータあり→キャッシュを使いDBに再同期
      accessories = _cache.accessories;
      nextAccId = accessories.length ? Math.max(...accessories.map(a=>a.id))+1 : 1;
      console.warn('accessories DBが空のためキャッシュから復元、再同期します');
      for(const a of accessories){
        try{ await sb.from('accessories').upsert({id:a.id, name:a.name, note:a.note||null}); }catch{}
      }
    } else if(e9 && _cache.accessories) {
      accessories = _cache.accessories; nextAccId = accessories.length ? Math.max(...accessories.map(a=>a.id))+1 : 1;
      console.warn('accessories DB失敗、キャッシュ使用:', e9.message);
    }
    const ni = dbMeta.find(r=>r.key==='nextId');
    const nn = dbMeta.find(r=>r.key==='nextNum');
    const wr = dbMeta.find(r=>r.key==='workerRetireDates');
    if(ni) nextId  = ni.value;
    if(nn) nextNum = nn.value;
    if(wr) try{ workerRetireDates = JSON.parse(wr.value); }catch{}
    saveLocal();
    if(!cloudWarnSticky)clearCloudWarnBanner();
  }catch(e){
    console.warn('Supabase接続失敗、ローカルキャッシュを使用:', e);
    noteCloudLoadFailure(e,'データ全体');
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const d = JSON.parse(raw);
        if(d.tasks)   tasks   = d.tasks.map((t,i)=>({...t, num:t.num??i+1, material:t.material||'', workers:[], dailyLog:t.dailyLog||[], transportLog:t.transportLog||[]}));
        if(d.workers) workers = d.workers;
        if(d.workerRetireDates) workerRetireDates = d.workerRetireDates;
        if(d.materials) { materials = d.materials; nextMatId = materials.length ? Math.max(...materials.map(m=>m.id))+1 : 1; }
        if(d.vehicles)  { vehicles  = d.vehicles;  nextVehId = vehicles.length  ? Math.max(...vehicles.map(v=>v.id))+1  : 1; }
        if(d.reports)   { reports   = d.reports;   nextReportId = reports.length ? Math.max(...reports.map(r=>r.id))+1 : 1; }
        if(d.sales)     { sales     = d.sales;     nextSaleId   = sales.length   ? Math.max(...sales.map(s=>s.id))+1   : 1; }
        if(d.buyers)      { buyers      = d.buyers;      nextBuyerId  = buyers.length      ? Math.max(...buyers.map(b=>b.id))+1      : 1; }
        if(d.accessories) { accessories = d.accessories; nextAccId    = accessories.length  ? Math.max(...accessories.map(a=>a.id))+1  : 1; }
        if(d.nextId)  nextId  = d.nextId;
        if(d.nextNum) nextNum = d.nextNum;
        showOfflineBanner();
      }
    }catch(e2){ console.warn('キャッシュ読み込みも失敗:', e2); }
  }finally{ hideLoading(); }
}

function showOfflineBanner(){
  let el = document.getElementById('offlineBanner');
  if(!el){
    el = document.createElement('div');
    el.id = 'offlineBanner';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9990;background:#fff3cd;color:#8a6000;text-align:center;padding:8px;font-size:12px;border-bottom:1px solid #f5c842;';
    el.innerHTML = '⚠️ サーバーに接続できません。オフラインモード（ローカルキャッシュ）で動作中です。 <button onclick="retryConnection()" style="margin-left:10px;background:var(--warn);color:#000;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;">再接続</button>';
    document.body.appendChild(el);
  }
}

async function retryConnection(){
  document.getElementById('offlineBanner')?.remove();
  clearCloudWarnBanner();
  await loadData();
  render();
}

// ── メタ値更新 ──
async function saveMeta(){
  await sb.from('meta').delete().in('key',['nextId','nextNum']);
  await sb.from('meta').insert([{key:'nextId',value:nextId},{key:'nextNum',value:nextNum}]);
}

// ── タスク保存（upsert）──
async function saveTask(t){
  showLoading('保存中…');
  try{
    const payload = taskToDb(t);
    const {error} = await sb.from('tasks').upsert(payload);
    if(error) throw error;
    await saveMeta();
    flashSaved();
    saveLocal();
  }catch(e){
    console.error('saveTask失敗:', e);
    reportCloudException(e,'現場の保存');
  }
  finally{ hideLoading(); }
}

// ── タスク削除 ──
async function deleteTaskDb(id){
  showLoading('削除中…');
  try{
    const {error} = await sb.from('tasks').delete().eq('id',id);
    if(error) throw error;
    flashSaved();
  }catch(e){ console.error('deleteTask失敗:',e); reportCloudException(e,'現場の削除'); }
  finally{ hideLoading(); }
}

// ── 作業者保存 ──
async function saveWorker(name){
  try{
    await sb.from('workers_list').upsert({name, sort_order: workers.indexOf(name)});
  }catch(e){ console.error('saveWorker失敗:',e); }
}
async function deleteWorkerDb(name){
  try{
    await sb.from('workers_list').delete().eq('name',name);
  }catch(e){ console.error('deleteWorkerDb失敗:',e); }
}

// ── クラウド同期 ──
async function syncToCloud(){
  if(!confirm('ローカルのデータをSupabaseクラウドに同期します。\nよろしいですか？'))return;
  showLoading('クラウドに同期中…');
  try{
    // tasks
    if(tasks.length){
      const payloads=tasks.map(taskToDb);
      const{error:e1}=await sb.from('tasks').upsert(payloads);
      if(e1)throw new Error('tasks: '+e1.message);
    }
    // workers（既存を全削除してから挿入）
    if(workers.length){
      await sb.from('workers_list').delete().neq('name','');
      const{error:e2}=await sb.from('workers_list').insert(workers.map((name,i)=>({name,sort_order:i})));
      if(e2)throw new Error('workers_list: '+e2.message);
    }
    // materials
    if(materials.length){
      const{error:e3}=await sb.from('materials').upsert(materials.map(m=>({id:m.id,name:m.name,note:m.note||null})));
      if(e3)throw new Error('materials: '+e3.message);
    }
    // vehicles
    if(vehicles.length){
      const{error:e4}=await sb.from('vehicles').upsert(vehicles.map(v=>({id:v.id,name:v.name,note:v.note||null})));
      if(e4)throw new Error('vehicles: '+e4.message);
    }
    // reports
    if(reports.length){
      const{error:e5}=await sb.from('daily_reports').upsert(reports.map(r=>({id:r.id,date:r.date,worker:r.worker,rows:r.rows||[],overtime:r.overtime||0,late:r.late||0,early:r.early||0,memo:r.memo||''})));
      if(e5)throw new Error('daily_reports: '+e5.message);
    }
    // sales
    if(sales.length){
      const{error:e6}=await sb.from('unit_sales').upsert(sales.map(s=>({id:s.id,date:s.date,task_id:s.taskId,task_name:s.taskName,buyer:s.buyer,kg:s.kg,amount:s.amount,memo:s.memo||'',status:s.status||'出荷済'})));
      if(e6)throw new Error('unit_sales: '+e6.message);
    }
    // meta
    const{error:e7}=await sb.from('meta').upsert([{key:'nextId',value:nextId},{key:'nextNum',value:nextNum}]);
    if(e7)throw new Error('meta: '+e7.message);
    hideLoading();
    flashOk(`同期完了（現場${tasks.length}件・日報${reports.length}件）`);
  }catch(e){
    hideLoading();
    reportCloudException(e,'クラウド同期');
  }
}

// ── リセット（誤操作防止のため無効化）──
async function resetAllData(){
  alert('この機能は誤操作防止のため無効化されています。\nデータの初期化が必要な場合は、管理者にご連絡ください。');
}
