let tasks=[],fieldWorkers=[],kakouWorkers=[],assignments=[],workRecords=[],costs=[];
let workersList=[];
let editingCostId=null,editingWrkId=null;

// ── Storage ──
const STORAGE_KEY='taskManager_v1'; // 加工アプリと同じキー
function loadTasksFromStorage(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    return(data.tasks||[]).map(x=>{
      // ユニット関連フィールドを除外
      const {unitType,unitOtherNote,unitあり,...rest}=x;
      const task={...rest,nameMain:x.name_main||x.nameMain||'',nameSub:x.name_sub||x.nameSub||''};
      // ステータスがない場合は「未着手」をデフォルトにする
      if(!task.status)task.status='未着手';
      return task;
    });
  }catch{return[];}
}
function saveTasksToStorage(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    data.tasks=tasks;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  }catch{}
}

// ── 加工 tasks テーブル連携（Supabase を正とする）──
function dbRowToGenbaTask(r){
  const nameMain=r.name_main||(r.name&&r.name.includes(' ／ ')?r.name.split(' ／ ')[0]:r.name)||'';
  const nameSub=r.name_sub||(r.name&&r.name.includes(' ／ ')?r.name.split(' ／ ').slice(1).join(' ／ '):'')||'';
  const meta=getTaskMeta(r.id);
  const totalKg=Number(r.total)||0;
  let status=meta.status;
  if(!status){
    if(r.complete) status='進行中';
    else if(Number(r.done)>0) status='進行中';
    else status='未着手';
  }
  return{
    id:r.id,num:r.num??r.id,name:r.name,
    name_main:nameMain,name_sub:nameSub,nameMain,nameSub,
    start_date:r.start_date||null,deadline:r.deadline||null,
    workflow_type:normalizeSiteWorkflowType(r.workflow_type),
    field_start_date:r.field_start_date||null,
    field_end_date:r.field_end_date||null,
    complete:!!r.complete,total_kg:totalKg,status,
    done:Number(r.done)||0,total:totalKg
  };
}
function normalizeSiteWorkflowType(w){
  if(w==='process_only'||w==='field_only'||w==='full')return w;
  return'full';
}
function syncSiteWorkflowFields(){
  const w=normalizeSiteWorkflowType(document.getElementById('siteWorkflowType')?.value);
  const proc=document.getElementById('siteProcessDates');
  const fld=document.getElementById('siteFieldDates');
  if(proc)proc.style.display=w==='field_only'?'none':'flex';
  if(fld)fld.style.display=w==='process_only'?'none':'flex';
}
function applyKgMapFromTasks(taskList){
  const m=loadKgMap();
  let changed=false;
  taskList.forEach(t=>{
    const kg=t.total_kg??t.total??0;
    if(m[t.id]!==kg){m[t.id]=kg;changed=true;}
    t.total_kg=kg;
  });
  if(changed)saveKgMap(m);
}
async function loadTasksFromGenbaTasksLegacy(){
  const{data,error}=await sb.from('genba_tasks').select('*');
  if(error||!data||!data.length)return[];
  return data.map(x=>{
    const{unitType,unitOtherNote,unitあり,...rest}=x;
    const task={...rest,nameMain:x.name_main||'',nameSub:x.name_sub||''};
    if(!task.status)task.status='未着手';
    return task;
  });
}
async function fetchCloudMeta(){
  let nextId=10,nextNum=10;
  try{
    const{data}=await sb.from('meta').select('*');
    if(data){
      const ni=data.find(r=>r.key==='nextId');
      const nn=data.find(r=>r.key==='nextNum');
      if(ni)nextId=Number(ni.value)||nextId;
      if(nn)nextNum=Number(nn.value)||nextNum;
    }
  }catch(e){console.warn('meta読み込み失敗:',e);}
  if(tasks.length){
    nextId=Math.max(nextId,...tasks.map(t=>Number(t.id)||0))+1;
    nextNum=Math.max(nextNum,...tasks.map(t=>Number(t.num)||0))+1;
  }
  return{nextId,nextNum};
}
async function bumpCloudMeta(nextId,nextNum){
  await sb.from('meta').delete().in('key',['nextId','nextNum']);
  await sb.from('meta').insert([{key:'nextId',value:nextId},{key:'nextNum',value:nextNum}]);
}
function buildTaskDbPayload(t,existing){
  const meta=getTaskMeta(t.id);
  const nameMain=t.nameMain||t.name_main||'';
  const nameSub=t.nameSub||t.name_sub||'';
  const total=getTaskKg(t.id)||t.total_kg||t.total||0;
  const name=nameSub?nameMain+' ／ '+nameSub:nameMain;
  const rawPri=meta.priority!==undefined&&meta.priority!==''?meta.priority:(t.priority!=null?t.priority:null);
  const pri=normalizeSitePriority(rawPri);
  const payload={
    id:t.id,num:t.num??t.id,name,
    name_main:nameMain||null,name_sub:nameSub||null,
    start_date:t.start_date||null,deadline:t.deadline||null,
    total,complete:!!t.complete,
    dept:meta.dept||t.dept||'',material:meta.material||t.material||null,
    priority:pri,
    workflow_type:normalizeSiteWorkflowType(t.workflow_type||t.workflowType),
    field_start_date:t.field_start_date||t.fieldStart||null,
    field_end_date:t.field_end_date||t.fieldEnd||null
  };
  if(existing){
    payload.done=existing.done??0;
    payload.daily_log=existing.daily_log??[];
    payload.transport_log=existing.transport_log??[];
    payload.workers=[];
    payload.unit_flag=existing.unit_flag??false;
    payload.unit_type=existing.unit_type||'none';
  }else{
    payload.done=0;
    payload.daily_log=[];
    payload.transport_log=[];
    payload.workers=[];
    payload.unit_flag=false;
    payload.unit_type='none';
  }
  return payload;
}
async function upsertTaskToCloud(t){
  const{data:existing}=await sb.from('tasks').select('*').eq('id',t.id).maybeSingle();
  const payload=buildTaskDbPayload(t,existing);
  const{error}=await sb.from('tasks').upsert(payload);
  if(error)throw error;
}
async function deleteTaskFromCloud(id){
  const{error}=await sb.from('tasks').delete().eq('id',id);
  if(error)throw error;
}

// ── Nav ──
function lockApp(){MaishinAuth.goLogin();}

// ── Init ──
async function initApp(){
  showLoading();
  weekOffset=0;
  try{
    let cloudOk=false;
    try{
      const{data,error}=await sb.from('tasks').select('*').order('num');
      if(!error){
        cloudOk=true;
        tasks=(data||[]).map(dbRowToGenbaTask);
        applyKgMapFromTasks(tasks);
        saveTasksToStorage();
        clearCloudWarnBanner();
        console.log('Supabase tasks から現場一覧を読み込みました:',tasks.length,'件');
      }else{
        console.warn('tasks読み込み失敗:',error);
        noteCloudLoadFailure(error,'現場一覧');
      }
    }catch(e){
      console.warn('tasks読み込み失敗:',e);
      noteCloudLoadFailure(e,'現場一覧');
    }

    if(!cloudOk){
      tasks=loadTasksFromStorage();
      if(tasks.length)console.log('オフライン: ブラウザキャッシュから現場一覧を表示');
    }

    if(!tasks.length){
      try{
        const legacy=await loadTasksFromGenbaTasksLegacy();
        if(legacy.length){
          tasks=legacy;
          applyKgMapFromTasks(tasks);
          saveTasksToStorage();
          console.log('genba_tasks（旧）から復元:',legacy.length,'件');
        }
      }catch(e){console.warn('genba_tasks 復元失敗:',e);}
    }

    // 他のデータは Supabase から（オプション）
    try{
      const[asg,wr,c,veh,wl]=await Promise.all([
        sb.from('field_assignments').select('*'),
        sb.from('field_work_records').select('*').order('date',{ascending:false}),
        sb.from('field_costs').select('*').order('date',{ascending:false}),
        sb.from('vehicles').select('*'),
        sb.from('workers_list').select('*').order('sort_order'),
      ]);
      noteCloudLoadFailure(asg.error,'作業配置');
      noteCloudLoadFailure(wr.error,'作業記録');
      noteCloudLoadFailure(c.error,'原価');
      noteCloudLoadFailure(veh.error,'車両');
      noteCloudLoadFailure(wl.error,'従業員一覧');
      workersList=wl.data||[];
      fieldWorkers=(wl.data||[]).map(w=>({id:w.id,name:w.name,role:w.affiliation||'',affiliation:w.affiliation||'',daily_rate:0,note:''}))
        .sort((a,b)=>a.name.localeCompare(b.name,'ja'));
      kakouWorkers=(wl.data||[]).filter(w=>String(w.affiliation||'').trim()==='加工').map(w=>({id:w.id,name:w.name}));
      assignments=asg.data||[];
      workRecords=wr.data||[];
      costs=c.data||[];
      if(veh.data){
        const vehicles=veh.data.map(v=>({id:v.id,name:v.name,type:v.type,plate:v.plate,inspection:v.inspection,inspection_place:v.inspection_place,note:v.note}));
        saveVehicles(vehicles);
        console.log('Supabase から vehicles を読み込んで localStorage に保存しました');
      }
    }catch(e){
      console.warn('Supabase接続エラー、ローカルデータのみ使用します:',e);
      noteCloudLoadFailure(e,'データ読み込み');
    }
  }catch(e){console.error(e);}
  hideLoading();
  populateSelects();
  renderAssign();
  renderNippo();
  renderCosts();
  renderWorkers();
  renderVehicles();
  applyEntryFromUrl();
}
function applyEntryFromUrl(){
  const page=new URLSearchParams(location.search).get('page');
  const valid=['assign','nippo','costs'];
  if(page&&valid.includes(page))showPage(page);
  else if(typeof MaishinNav!=='undefined')MaishinNav.syncActive('assign');
}

// ── Helpers ──
function todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function taskName(t){return t.nameMain+(t.nameSub?' ／ '+t.nameSub:'');}
function fmt(d){return d?d.replace(/-/g,'/'):'－';}
function fmtMoney(n){return'¥'+Number(n).toLocaleString();}

/** 作業配置の色：配置表＝現場ネイビー/赤・加工ピンクのみ、水色は配置モーダルのみ */
const ASSIGN_CHIP_PALETTE={
  genba:{assigned:{bg:'#dbeafe',color:'#1e3a8a'},unassigned:{bg:'#fee2e2',color:'#dc2626'}},
  kakou:{modal:{bg:'#e0f2fe',color:'#0284c7',border:'#7dd3fc'},unassigned:{bg:'#fce7f3',color:'#db2777'}},
  dup:{bg:'#fed7aa',color:'#c2410c',border:'border:1px solid #fb923c;'},
};
function workerAffiliation(w){
  if(!w)return '';
  const direct=String(w.affiliation||w.role||'').trim();
  if(direct)return direct;
  const rec=workersList.find(x=>x.id===w.id);
  return rec?String(rec.affiliation||'').trim():'';
}
function isKakouWorker(w){
  return workerAffiliation(w)==='加工';
}
function assignGridChipColors(w,opts={}){
  if(opts.dup)return ASSIGN_CHIP_PALETTE.dup;
  if(opts.unassigned)return isKakouWorker(w)?ASSIGN_CHIP_PALETTE.kakou.unassigned:ASSIGN_CHIP_PALETTE.genba.unassigned;
  return ASSIGN_CHIP_PALETTE.genba.assigned;
}
function assignGridChipStyle(w,opts={},extra=''){
  const c=assignGridChipColors(w,opts);
  const border=c.border?c.border:'';
  return`background:${c.bg};color:${c.color};${border}${extra}`;
}
function assignModalRowStyle(w,on){
  if(isKakouWorker(w)){
    const k=ASSIGN_CHIP_PALETTE.kakou.modal;
    if(on)return{bg:k.bg,border:k.color,accent:k.color};
    return{bg:'var(--bg)',border:k.border,accent:k.color};
  }
  const g=ASSIGN_CHIP_PALETTE.genba.assigned;
  if(on)return{bg:g.bg,border:g.color,accent:g.color};
  return{bg:'var(--bg)',border:'var(--border)',accent:'var(--accent)'};
}

function populateSelects(){
  const active=tasks.filter(t=>!t.complete);
  ['costTaskSel'].forEach(id=>{
    const sel=document.getElementById(id),prev=sel.value;
    sel.innerHTML='<option value="">現場を選択…</option>'+active.map(t=>`<option value="${t.id}">${taskName(t)}</option>`).join('');
    if(prev)sel.value=prev;
  });
  // 日報集計フィルタ（全現場）
  const nippoSel=document.getElementById('nippoSiteSel');
  if(nippoSel){
    const prev=nippoSel.value;
    nippoSel.innerHTML='<option value="">全現場</option>'+tasks.map(t=>`<option value="${t.id}">${taskName(t)}</option>`).join('');
    if(prev)nippoSel.value=prev;
  }
  // 使用車両プルダウン
  populateCarSelect();
}

function populateCarSelect(selected){
  const sel=document.getElementById('nippoCar');
  if(!sel)return;
  const prev=selected!==undefined?selected:sel.value;
  const vehicles=loadVehicles();
  sel.innerHTML='<option value="">未使用</option>'+vehicles.map(v=>`<option value="${v.name}">${v.name}${v.plate?' ('+v.plate+')':''}</option>`).join('');
  if(prev)sel.value=prev;
}

function cumulativeKg(tid){
  return workRecords.filter(x=>x.task_id===tid).reduce((s,r)=>s+Number(r.progress||0),0);
}
function latestRecord(tid){
  const r=workRecords.filter(x=>x.task_id===tid).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  return r.length?r[0]:null;
}
function assignedWorkers(tid,date){
  return assignments.filter(a=>a.task_id===tid&&a.date===date).map(a=>fieldWorkers.find(w=>w.id===a.worker_id)).filter(Boolean);
}
function totalCost(tid){return costs.filter(c=>c.task_id===tid).reduce((s,c)=>s+Number(c.amount),0);}
function deadlineCls(dl){
  if(!dl)return'';
  const days=Math.ceil((new Date(dl)-new Date())/(864e5));
  return days<0?'red':days<=7?'amber':'green';
}

function daysLeftSite(dl){return dl?Math.ceil((new Date(dl)-new Date())/864e5):null;}
function normalizeSitePriority(p){
  return Number(p)===1?1:null;
}
function isSiteUrgent(t){
  const meta=getTaskMeta(t.id);
  const raw=meta.priority!==undefined&&meta.priority!==''?meta.priority:(t.priority!=null?t.priority:null);
  return normalizeSitePriority(raw)===1;
}
function isSiteOverdue(t){
  if(t.complete||!t.deadline)return false;
  const n=daysLeftSite(t.deadline);
  return n!==null&&n<0;
}
function siteOverdueDays(t){
  if(!isSiteOverdue(t))return 0;
  return Math.ceil((new Date()-new Date(t.deadline))/864e5);
}
// ── 現場CRUD ──
let editingSiteId=null;
function openSiteModal(id=null){
  editingSiteId=id;
  document.getElementById('siteModalTitle').textContent=id?'現場を編集':'現場追加';
  // 作業者セレクト更新
  const wsel=document.getElementById('siteWorker');
  wsel.innerHTML='<option value="">未割当</option>'+fieldWorkers.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
  // 編集時のみ完了・削除ボタンを表示
  const actions=document.getElementById('siteModalActions');
  actions.style.display=id?'flex':'none';
  if(id){
    const t=tasks.find(x=>x.id===id);
    const btn=document.getElementById('siteModalCompleteBtn');
    btn.textContent=t.complete?'🔄 再開':'✅ 完了にする';
    btn.style.background=t.complete?'#6b7280':'var(--accent)';
    btn.style.color='#fff';
    const meta=getTaskMeta(id);
    document.getElementById('siteId').value=id;
    document.getElementById('siteName').value=t.nameMain;
    document.getElementById('siteNameSub').value=t.nameSub||'';
    document.getElementById('siteWorkflowType').value=normalizeSiteWorkflowType(t.workflow_type);
    syncSiteWorkflowFields();
    document.getElementById('siteStart').value=t.start_date||'';
    document.getElementById('siteDeadline').value=t.deadline||'';
    document.getElementById('siteFieldStart').value=t.field_start_date||'';
    document.getElementById('siteFieldEnd').value=t.field_end_date||'';
    document.getElementById('siteTotalKg').value=getTaskKg(id)||'';
    document.getElementById('siteDept').value=meta.dept||'';
    document.getElementById('sitePriority').value=isSiteUrgent(t)?'1':'';
    document.getElementById('siteMaterial').value=meta.material||'';
    document.getElementById('siteWorker').value=meta.workerId||'';
    document.getElementById('siteStatus').value=meta.status||t.status||'未着手';
    document.getElementById('siteClient').value=meta.client||'';
  }else{
    document.getElementById('siteId').value='';
    document.getElementById('siteName').value='';
    document.getElementById('siteNameSub').value='';
    document.getElementById('siteWorkflowType').value='full';
    syncSiteWorkflowFields();
    document.getElementById('siteStart').value='';
    document.getElementById('siteDeadline').value='';
    document.getElementById('siteFieldStart').value='';
    document.getElementById('siteFieldEnd').value='';
    document.getElementById('siteTotalKg').value='';
    document.getElementById('siteDept').value='';
    document.getElementById('sitePriority').value='';
    document.getElementById('siteMaterial').value='';
    document.getElementById('siteWorker').value='';
    document.getElementById('siteStatus').value='未着手';
    document.getElementById('siteClient').value='';
  }
  openModal('siteModal');
}
// total_kgはlocalStorageで管理（DB列不要）
function loadKgMap(){try{return JSON.parse(localStorage.getItem('genba_kg')||'{}')}catch{return{}}}
function saveKgMap(m){localStorage.setItem('genba_kg',JSON.stringify(m))}
function getTaskKg(id){return loadKgMap()[id]||0}
function setTaskKg(id,kg){const m=loadKgMap();m[id]=kg;saveKgMap(m);}
// 追加メタ情報（部門・優先度・材料・作業者・ユニット等）
function loadMetaMap(){try{return JSON.parse(localStorage.getItem('genba_task_meta')||'{}')}catch{return{}}}
function saveMetaMap(m){localStorage.setItem('genba_task_meta',JSON.stringify(m))}
function getTaskMeta(id){return loadMetaMap()[String(id)]||{}}
function setTaskMeta(id,meta){const m=loadMetaMap();m[String(id)]={...m[String(id)],...meta};saveMetaMap(m);}

async function saveSite(){
  const name_main=document.getElementById('siteName').value.trim();
  if(!name_main){alert('現場名を入力してください');return;}
  const name_sub=document.getElementById('siteNameSub').value.trim();
  const workflow_type=normalizeSiteWorkflowType(document.getElementById('siteWorkflowType').value);
  const start_date=document.getElementById('siteStart').value||null;
  const deadline=document.getElementById('siteDeadline').value||null;
  const field_start_date=document.getElementById('siteFieldStart').value||null;
  const field_end_date=document.getElementById('siteFieldEnd').value||null;
  const total_kg=Number(document.getElementById('siteTotalKg').value)||0;
  const status=document.getElementById('siteStatus').value||'未着手';
  const meta={
    dept:document.getElementById('siteDept').value,
    priority:document.getElementById('sitePriority').value==='1'?'1':'',
    material:document.getElementById('siteMaterial').value.trim(),
    workerId:document.getElementById('siteWorker').value,
    status:status,
    client:document.getElementById('siteClient').value.trim(),
  };
  if(editingSiteId){
    const t=tasks.find(x=>x.id===editingSiteId);
    Object.assign(t,{nameMain:name_main,nameSub:name_sub,name_main,name_sub,start_date,deadline,
      workflow_type,field_start_date,field_end_date,total_kg,status});
    setTaskKg(editingSiteId,total_kg);
    setTaskMeta(editingSiteId,meta);
    try{await upsertTaskToCloud(t);}catch(e){reportCloudException(e,'現場更新');return;}
  }else{
    const{nextId,nextNum}=await fetchCloudMeta();
    const newTask={name_main,name_sub,start_date,deadline,workflow_type,field_start_date,field_end_date,
      complete:false,num:nextNum,nameMain:name_main,nameSub:name_sub||'',total_kg,status,id:nextId};
    tasks.push(newTask);
    setTaskKg(newTask.id,total_kg);
    setTaskMeta(newTask.id,meta);
    try{
      await upsertTaskToCloud(newTask);
      await bumpCloudMeta(nextId+1,nextNum+1);
    }catch(e){reportCloudException(e,'現場追加');return;}
  }
  saveTasksToStorage();
  flash();closeModal('siteModal');populateSelects();renderAssign();
}
async function toggleSiteCompleteFromEdit(){
  await toggleSiteComplete(editingSiteId);
  const t=tasks.find(x=>x.id===editingSiteId);
  const btn=document.getElementById('siteModalCompleteBtn');
  btn.textContent=t.complete?'🔄 再開':'✅ 完了にする';
  btn.style.background=t.complete?'#6b7280':'var(--accent)';
}
async function deleteSiteFromEdit(){
  if(!confirm('この現場を削除しますか？\n関連する作業記録・原価も削除されます。'))return;
  try{await deleteTaskFromCloud(editingSiteId);}catch(e){reportCloudException(e,'現場削除');return;}
  tasks=tasks.filter(x=>x.id!==editingSiteId);
  closeModal('siteModal');
  flash();populateSelects();renderAssign();
}
async function toggleSiteComplete(id){
  const t=tasks.find(x=>x.id===id);
  const complete=!t.complete;
  t.complete=complete;
  try{await upsertTaskToCloud(t);}catch(e){reportCloudException(e,'現場の完了状態');return;}
  saveTasksToStorage();
  flash();populateSelects();renderAssign();
}
async function deleteSite(id){
  if(!confirm('この現場を削除しますか？\n関連する作業記録・原価も削除されます。'))return;
  try{await deleteTaskFromCloud(id);}catch(e){reportCloudException(e,'現場削除');return;}
  tasks=tasks.filter(x=>x.id!==id);
  saveTasksToStorage();
  flash();populateSelects();renderAssign();
}

let detailSiteId=null;

function updateSiteDetailMemoSummary(tid){
  const el=document.getElementById('sdMemoSummary');
  if(!el)return;
  const totalKg=getTaskKg(tid);
  const cumKg=cumulativeKg(tid);
  const recCount=workRecords.filter(r=>r.task_id===tid).length;
  if(totalKg>0){
    el.textContent=`メモ合計（目安）: ${cumKg.toLocaleString()} / ${totalKg.toLocaleString()} kg`;
    el.style.display='block';
  }else if(recCount>0){
    el.textContent=`メモ ${recCount}件（kgはあくまで目安です）`;
    el.style.display='block';
  }else{
    el.textContent='';
    el.style.display='none';
  }
}
function goToSite(tid){
  detailSiteId=tid;
  const t=tasks.find(x=>x.id===tid);
  const td=todayStr();

  document.getElementById('sdTitle').textContent=t.nameMain;
  document.getElementById('sdSub').textContent=t.nameSub||'';
  updateSiteDetailMemoSummary(tid);

  // バッジ
  const ws=assignedWorkers(tid,td);
  const cost=totalCost(tid);
  const meta=getTaskMeta(tid);
  const badges=[];
  if(!t.complete){
    if(isSiteOverdue(t))badges.push(`<span class="site-status-tag tag-overdue">超過${siteOverdueDays(t)>0?' '+siteOverdueDays(t)+'日':''}</span>`);
    else if(isSiteUrgent(t))badges.push('<span class="site-status-tag tag-urgent">至急</span>');
    else badges.push('<span class="site-status-tag tag-normal">通常</span>');
  }
  if(t.start_date) badges.push(`<span class="badge">開始 ${fmt(t.start_date)}</span>`);
  if(t.deadline)   badges.push(`<span class="badge ${deadlineCls(t.deadline)}">期限 ${fmt(t.deadline)}</span>`);
  if(ws.length)    badges.push(`<span class="badge blue" title="${ws.map(w=>w.name).join('、')}">今日 ${ws.map(w=>w.name).join('・')}</span>`);
  if(meta.dept)    badges.push(`<span class="badge">${meta.dept}</span>`);
  if(cost>0)       badges.push(`<span class="badge purple">原価 ${fmtMoney(cost)}</span>`);
  if(t.complete)   badges.push(`<span class="badge green">完了</span>`);
  document.getElementById('sdBadges').innerHTML=badges.join('');

  // 完了/再開ボタン
  const btn=document.getElementById('sdCompleteBtn');
  btn.textContent=t.complete?'🔄 再開':'✅ 完了にする';
  btn.style.background=t.complete?'#6b7280':'var(--accent)';
  btn.style.color='#fff';

  // 日付デフォルト
  document.getElementById('sdDate').value=td;
  document.getElementById('sdKg').value='';
  document.getElementById('sdNote').value='';

  renderSiteDetailRecords();
  openModal('siteDetailModal');
}

function renderSiteDetailRecords(){
  const recs=workRecords.filter(r=>r.task_id===detailSiteId).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  const el=document.getElementById('sdRecordList');
  if(!recs.length){el.innerHTML='<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">記録がありません</div>';return;}
  el.innerHTML=recs.map((r,i)=>{
    const isLatest=i===0;
    const kg=Number(r.progress||0);
    const kgLabel=kg>0?`<span style="font-size:13px;font-weight:700;color:#10b981;white-space:nowrap">+${kg.toLocaleString()} kg（目安）</span>`:'';
    const dayWorkers=assignments.filter(a=>a.task_id===detailSiteId&&a.date===r.date)
      .map(a=>fieldWorkers.find(w=>w.id===a.worker_id)).filter(Boolean).map(w=>w.name);
    return`<div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:${isLatest?'var(--surface)':'var(--bg)'};border:1px solid ${isLatest?'var(--accent)':'var(--border)'};border-radius:8px;margin-bottom:5px">
      <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;min-width:82px">${r.date}</span>
      ${kgLabel}
      ${dayWorkers.length?`<span style="font-size:12px;color:#6366f1;white-space:nowrap">⏱ ${dayWorkers.map(w=>w.name).join('・')}</span>`:''}
      ${r.note?`<span style="font-size:12px;color:var(--text-muted);flex:1">${r.note}</span>`:'<span style="flex:1"></span>'}
      <button style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted);padding:0 2px;line-height:1" onclick="deleteSiteDetailRecord(${r.id})" title="削除">×</button>
    </div>`;
  }).join('');
}

async function saveSiteDetailRecord(){
  const date=document.getElementById('sdDate').value;
  const kg=Number(document.getElementById('sdKg').value)||0;
  const note=document.getElementById('sdNote').value.trim();
  if(!date){alert('日付を入力してください');return;}
  const payload={task_id:detailSiteId,date,progress:kg,content:'',note};
  const{data,error}=await sb.from('field_work_records').insert(payload).select().single();
  if(cloudFailed(error,'作業記録の保存'))return;
  workRecords.unshift(data);
  document.getElementById('sdKg').value='';
  document.getElementById('sdNote').value='';
  updateSiteDetailMemoSummary(detailSiteId);
  flash();renderSiteDetailRecords();populateSelects();
}

function editSiteDetailRecord(id){
  const r=workRecords.find(x=>x.id===id);
  document.getElementById('sdDate').value=r.date;
  document.getElementById('sdKg').value=r.progress;
  document.getElementById('sdNote').value=r.note||'';
  // 削除して再追加する形で編集
  workRecords=workRecords.filter(x=>x.id!==id);
  sb.from('field_work_records').delete().eq('id',id).then(({error})=>{
    if(error)reportCloudError(error,'作業記録の削除');
  });
  renderSiteDetailRecords();
}

async function deleteSiteDetailRecord(id){
  if(!confirm('この記録を削除しますか？'))return;
  const{error}=await sb.from('field_work_records').delete().eq('id',id);
  if(cloudFailed(error,'作業記録の削除'))return;
  workRecords=workRecords.filter(r=>r.id!==id);
  updateSiteDetailMemoSummary(detailSiteId);
  flash();renderSiteDetailRecords();populateSelects();
}

function openSiteModalFromDetail(){
  closeModal('siteDetailModal');
  openSiteModal(detailSiteId);
}

async function deleteSiteFromDetail(){
  if(!confirm('この現場を削除しますか？\n関連する作業記録・原価も削除されます。'))return;
  try{await deleteTaskFromCloud(detailSiteId);}catch(e){reportCloudException(e,'現場削除');return;}
  tasks=tasks.filter(x=>x.id!==detailSiteId);
  closeModal('siteDetailModal');
  flash();populateSelects();renderAssign();
}

async function toggleSiteCompleteFromDetail(){
  await toggleSiteComplete(detailSiteId);
  const t=tasks.find(x=>x.id===detailSiteId);
  const btn=document.getElementById('sdCompleteBtn');
  btn.textContent=t.complete?'🔄 再開':'✅ 完了にする';
  btn.style.background=t.complete?'#6b7280':'var(--accent)';
  const badges=[];
  if(t.start_date) badges.push(`<span class="badge">開始 ${fmt(t.start_date)}</span>`);
  if(t.deadline)   badges.push(`<span class="badge ${deadlineCls(t.deadline)}">期限 ${fmt(t.deadline)}</span>`);
  if(t.complete)   badges.push(`<span class="badge green">完了</span>`);
  document.getElementById('sdBadges').innerHTML=badges.join('');
}
