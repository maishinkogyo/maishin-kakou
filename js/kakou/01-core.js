const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const COL_W = 36; // wider columns for readability
const DOW_JP = ['日','月','火','水','木','金','土'];

// 日本の祝日（2025〜2027年）
const JP_HOLIDAYS = new Set([
  '2025-01-01','2025-01-13','2025-02-11','2025-02-23','2025-02-24',
  '2025-03-20','2025-04-29','2025-05-03','2025-05-04','2025-05-05','2025-05-06',
  '2025-07-21','2025-08-11','2025-09-15','2025-09-23','2025-10-13',
  '2025-11-03','2025-11-23','2025-11-24',
  '2026-01-01','2026-01-12','2026-02-11','2026-02-23',
  '2026-03-20','2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06',
  '2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23','2026-10-12',
  '2026-11-03','2026-11-23',
  '2027-01-01','2027-01-11','2027-02-11','2027-02-23',
  '2027-03-21','2027-03-22','2027-04-29','2027-05-03','2027-05-04','2027-05-05',
  '2027-07-19','2027-08-11','2027-09-20','2027-09-23','2027-10-11',
  '2027-11-03','2027-11-23'
]);
function isHoliday(d){
  const s=d instanceof Date?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:d;
  return JP_HOLIDAYS.has(s);
}
function isRedDay(d){
  const dt=d instanceof Date?d:new Date(d);
  return dt.getDay()===0||isHoliday(dt); // 日曜または祝日
}

function fmt(d){if(!d)return'-';const dt=new Date(d);return`${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;}
function toD(s){if(!s)return null;const d=new Date(s);d.setHours(0,0,0,0);return d;}
function daysLeft(dl){const d=toD(dl);return d?Math.ceil((d-TODAY)/86400000):null;}
function dlStatus(dl){const n=daysLeft(dl);if(n===null)return'normal';if(n<0)return'danger';if(n<=3)return'warn';return'normal';}
function getTaskNames(t){
  const main=t.nameMain||(t.name&&t.name.includes(' ／ ')?t.name.split(' ／ ')[0]:t.name)||'';
  const sub=t.nameSub||(t.name&&t.name.includes(' ／ ')?t.name.split(' ／ ').slice(1).join(' ／ '):'') ||'';
  return{main,sub};
}
function taskFullName(t){const{main,sub}=getTaskNames(t);return main+(sub?' ／ '+sub:'');}

// ── Workers ──
let workers = [];
let workerRetireDates = {}; // {name: 'YYYY-MM-DD'}
function isWorkerActive(name){
  const rd = workerRetireDates[name];
  if(!rd) return true;
  return rd >= new Date().toISOString().slice(0,10);
}
function activeWorkers(){ return workers.filter(isWorkerActive); }

// ── Materials ──
let materials = []; // {id, name, note}
let nextMatId = 1;
let vehicles = []; // {id, name, note}
let nextVehId = 1;
let accessories = []; // {id, name, note}
let nextAccId = 1;

// ── Tasks — workers is now an array ──
let tasks = [
  {id:1,num:1, name:'タスク1',material:'',priority:null,total:200,done:130,deadline:'2026-04-01',start:'2026-03-17',workers:['田中'],unitType:'none',unitあり:false,complete:false,dailyLog:[]},
  {id:2,num:2, name:'タスク2',material:'',priority:null,total:200,done:65, deadline:'2026-03-31',start:'2026-03-18',workers:['鈴木'],unitType:'none',unitあり:false,complete:false,dailyLog:[]},
  {id:3,num:3, name:'タスク3',material:'',priority:null,total:500,done:20, deadline:'2026-03-16',start:'2026-03-10',workers:['佐藤'],unitType:'none',unitあり:false,complete:false,dailyLog:[]},
  {id:4,num:4, name:'タスク4',material:'',priority:null,total:90, done:70, deadline:'2026-04-03',start:'2026-03-20',workers:['田中'],unitType:'none',unitあり:false,complete:false,dailyLog:[]},
  {id:5,num:5, name:'タスク5',material:'',priority:null,total:80, done:60, deadline:'2026-04-05',start:'2026-03-22',workers:[],unitType:'none',unitあり:false,complete:false,dailyLog:[]},
  {id:6,num:6, name:'タスク6',material:'',priority:null,total:100,done:30, deadline:'2026-03-20',start:'2026-03-17',workers:['鈴木'],unitType:'none',unitあり:false,complete:false,dailyLog:[]},
  {id:7,num:7, name:'タスク7',material:'',priority:null,total:230,done:25, deadline:'2026-03-26',start:'2026-03-19',workers:['佐藤'],unitType:'none',unitあり:false,complete:false,dailyLog:[]},
  {id:8,num:8, name:'タスク8',material:'',priority:null,total:40, done:10, deadline:'2026-03-24',start:'2026-03-21',workers:['田中'],unitType:'none',unitあり:false,complete:false,dailyLog:[]},
  {id:9,num:9, name:'タスク9',material:'',priority:null,total:50, done:30, deadline:'2026-03-19',start:'2026-03-17',workers:[],unitType:'none',unitあり:false,complete:false,dailyLog:[]},
];
let nextId=10;
let nextNum=10; // タスクナンバー（追加順、削除しても欠番のまま）
let expandedIds=new Set();

function normalizePriority(p){
  return Number(p)===1?1:null;
}
function isUrgent(t){
  return normalizePriority(t.priority)===1;
}
function isTaskOverdue(t){
  return !t.complete&&dlStatus(t.deadline)==='danger';
}
function ganttBarClass(t){
  if(t.complete)return'gc-done';
  if(isTaskOverdue(t))return'gc-overdue';
  if(isUrgent(t))return'gc-urgent';
  return'gc-normal';
}
function ganttStatusTagHTML(t){
  if(t.complete)return'';
  if(isTaskOverdue(t))return'<span class="gantt-status-tag tag-overdue">超過</span>';
  if(isUrgent(t))return'<span class="gantt-status-tag tag-urgent">至急</span>';
  return'<span class="gantt-status-tag tag-normal">通常</span>';
}

function normalizeWorkflowType(w){
  if(w==='process_only'||w==='field_only'||w==='full')return w;
  return'full';
}
function showProcessBar(t){const w=normalizeWorkflowType(t.workflowType);return w==='full'||w==='process_only';}
function showFieldBar(t){const w=normalizeWorkflowType(t.workflowType);return w==='full'||w==='field_only';}
function isFieldPhaseOverdue(t){
  return !t.complete&&t.fieldEnd&&dlStatus(t.fieldEnd)==='danger';
}
function needsFieldDateHint(t){
  return normalizeWorkflowType(t.workflowType)==='full'&&showFieldBar(t)&&(!t.fieldStart||!t.fieldEnd);
}
function syncWorkflowFields(prefix){
  const w=normalizeWorkflowType(document.getElementById(prefix+'WorkflowType')?.value);
  const proc=document.getElementById(prefix+'ProcessDates');
  const fld=document.getElementById(prefix+'FieldDates');
  if(proc)proc.style.display=w==='field_only'?'none':'contents';
  if(fld)fld.style.display=w==='process_only'?'none':'grid';
}
function syncEditWorkflowFields(taskId){
  const w=normalizeWorkflowType(document.getElementById('editWorkflowType-'+taskId)?.value);
  const proc=document.getElementById('edit-'+taskId+'-ProcessDates');
  const fld=document.getElementById('edit-'+taskId+'-FieldDates');
  if(proc)proc.style.display=w==='field_only'?'none':'contents';
  if(fld)fld.style.display=w==='process_only'?'none':'grid';
}
function ganttBarSegment(left,width,cls,pct,title,txt,barTop){
  if(width<=0)return'';
  const safeT=(title||'').replace(/"/g,'&quot;');
  const topS=barTop!=null?`top:${barTop}px;`:'';
  return`<div class="gbar ${cls}" style="${topS}left:${left}px;width:${width}px" title="${safeT}">
    ${pct>=0?`<div class="gbar-prog" style="width:${pct}%"></div>`:''}
    ${txt?`<span class="gbar-txt">${txt}</span>`:''}
  </div>`;
}
function buildGanttTimelineBars(t,startD,days,colWIn,barTop){
  const cw=colWIn||COL_W;
  const pct=t.total>0?Math.round(t.done/t.total*100):0;
  let bars='';
  let dlLine='';
  if(showProcessBar(t)){
    const st=toD(t.start),dl=toD(t.deadline);
    if(st&&dl){
      const l=Math.round((st-startD)/86400000);
      const r=Math.round((dl-startD)/86400000)+1;
      if(r>0&&l<days){
        const left=Math.max(0,l)*cw;
        const width=(Math.min(r,days)-Math.max(0,l))*cw;
        bars+=ganttBarSegment(left,width,ganttBarClass(t),pct,`${t.name} | 加工 ${pct}% | 納期${fmt(t.deadline)}`,t.name,barTop);
      }
    }else if(dl){
      const doff=Math.round((dl-startD)/86400000);
      if(doff>=0&&doff<days)
        bars+=ganttBarSegment(doff*cw,cw,ganttBarClass(t),pct,t.name,'◆',barTop);
    }
    if(dl){const doff=Math.round((dl-startD)/86400000);if(doff>=0&&doff<days)dlLine=`<div class="gdl-line" style="left:${(doff+1)*cw-1}px"></div>`;}
  }
  if(showFieldBar(t)&&t.fieldStart&&t.fieldEnd){
    const fs=toD(t.fieldStart),fe=toD(t.fieldEnd);
    if(fs&&fe){
      const l=Math.round((fs-startD)/86400000);
      const r=Math.round((fe-startD)/86400000)+1;
      if(r>0&&l<days){
        const left=Math.max(0,l)*cw;
        const width=(Math.min(r,days)-Math.max(0,l))*cw;
        const fc=isFieldPhaseOverdue(t)?'gbar-field gbar-field-overdue':'gbar-field';
        bars+=ganttBarSegment(left,width,fc,-1,`${t.name} | 現場 ${fmt(t.fieldStart)}〜${fmt(t.fieldEnd)}`,'現場',barTop);
      }
    }
  }
  return{barHTML:bars,dlLine};
}
function sortedActive(){
  return[...tasks].filter(t=>!t.complete).sort((a,b)=>{
    if(isUrgent(a)!==isUrgent(b))return isUrgent(a)?-1:1;
    return(daysLeft(a.deadline)??9999)-(daysLeft(b.deadline)??9999);
  });
}

function syncMaterialSelects(){
  const matSels=['newMaterial'];
  matSels.forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;
    el.innerHTML='<option value="">未設定</option>'+materials.map(m=>`<option value="${m.name}">${m.name}${m.note?' ('+m.note+')':''}</option>`).join('');
    if([...el.options].some(o=>o.value===cur))el.value=cur;
  });
}

// ── マスタ管理 ──
let currentMasterTab = 'tasks';

function renderMasterTab(){
  renderMaterialList();
  renderVehicleList();
  syncMaterialSelects();
}

function switchMasterTab(tab){
  currentMasterTab = tab;
  document.querySelectorAll('.master-subtab').forEach((el,i)=>
    el.classList.toggle('active', ['tasks','materials','vehicles','workers','accessories'][i]===tab));
  document.querySelectorAll('.master-panel').forEach(el=>el.classList.remove('active'));
  document.getElementById('master-panel-'+tab).classList.add('active');
  if(tab==='accessories') renderAccessoryList();
}

// ── 材料リスト ──
function showAddMaterial(){ document.getElementById('materialAddForm').style.display='block'; }
function hideAddMaterial(){ document.getElementById('materialAddForm').style.display='none'; document.getElementById('newMatName').value=''; document.getElementById('newMatNote').value=''; }

async function addMaterial(){
  const name = document.getElementById('newMatName').value.trim();
  if(!name){ alert('材料名を入力してください'); return; }
  if(materials.some(m=>m.name===name)){ alert('同じ名前の材料がすでにあります'); return; }
  const mat = {id:nextMatId++, name, note: document.getElementById('newMatNote').value.trim()};
  materials.push(mat);
  hideAddMaterial();
  renderMaterialList();
  syncMaterialSelects();
  // Supabaseに保存
  try{ await sb.from('materials').insert({id:mat.id, name:mat.name, note:mat.note}); flashSaved(); }
  catch(e){ console.error('材料保存失敗:',e); }
  saveLocal();
}

async function deleteMaterial(id){
  const m = materials.find(m=>m.id===id);
  if(!m) return;
  if(!confirm(`「${m.name}」を削除しますか？\n使用中の現場からも外れます。`)) return;
  materials = materials.filter(x=>x.id!==id);
  // タスクの材料名もクリア
  tasks.forEach(t=>{ if(t.material===m.name){ t.material=''; saveTask(t); } });
  renderMaterialList();
  syncMaterialSelects();
  try{ await sb.from('materials').delete().eq('id',id); flashSaved(); }
  catch(e){ console.error('材料削除失敗:',e); }
  saveLocal();
}

function editMaterial(id){
  const m=materials.find(m=>m.id===id);if(!m)return;
  const el=document.getElementById(`mat-item-${id}`);if(!el)return;
  el.innerHTML=`
    <span style="font-size:18px">🔩</span>
    <input type="text" id="mat-edit-name-${id}" value="${m.name.replace(/"/g,'&quot;')}" placeholder="材料名"
      style="flex:1;padding:5px 8px;border-radius:6px;border:1.5px solid var(--accent);background:var(--surface);color:var(--text);font-size:13px;font-weight:600;">
    <input type="text" id="mat-edit-note-${id}" value="${(m.note||'').replace(/"/g,'&quot;')}" placeholder="メモ（任意）"
      style="flex:1;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;">
    <button class="btn btn-primary btn-sm" onclick="saveMaterialEdit(${id})">保存</button>
    <button class="btn btn-secondary btn-sm" onclick="renderMaterialList()">キャンセル</button>`;
  document.getElementById(`mat-edit-name-${id}`).focus();
}
async function saveMaterialEdit(id){
  const m=materials.find(m=>m.id===id);if(!m)return;
  const newName=document.getElementById(`mat-edit-name-${id}`).value.trim();
  const newNote=document.getElementById(`mat-edit-note-${id}`).value.trim();
  if(!newName){alert('材料名を入力してください');return;}
  if(materials.some(x=>x.id!==id&&x.name===newName)){alert('同じ名前の材料がすでにあります');return;}
  const oldName=m.name;
  m.name=newName;m.note=newNote;
  tasks.forEach(t=>{if(t.material===oldName){t.material=newName;saveTask(t);}});
  renderMaterialList();
  syncMaterialSelects();
  try{await sb.from('materials').upsert({id:m.id,name:m.name,note:m.note||null});flashSaved();}
  catch(e){console.error('材料更新失敗:',e);}
  saveLocal();
}

function renderMaterialList(){
  const el = document.getElementById('materialList');
  if(!el) return;
  if(!materials.length){
    el.innerHTML='<div style="color:var(--text-muted);padding:20px 0;text-align:center;">材料がまだ登録されていません</div>';
    return;
  }
  el.innerHTML = materials.map(m=>{
    const usedCount = tasks.filter(t=>t.material===m.name).length;
    return `<div class="task-card" style="margin-bottom:8px;">
      <div id="mat-item-${m.id}" style="padding:12px 14px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:18px">🔩</span>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:14px;">${m.name}</div>
          ${m.note?`<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${m.note}</div>`:''}
        </div>
        <span style="font-size:11px;color:var(--text-muted);background:var(--surface2);padding:3px 10px;border-radius:99px;white-space:nowrap;">
          ${usedCount}件の現場で使用中
        </span>
        <button class="btn btn-secondary btn-sm" onclick="editMaterial(${m.id})">✏️ 編集</button>
        <button class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="deleteMaterial(${m.id})">削除</button>
      </div>
    </div>`;
  }).join('');
}


// ── 付属品リスト ──
let _newAccSpecs = [];
let _editAccSpecs = {};

function accParseSpecs(note){
  if(!note) return [];
  try{ const p=JSON.parse(note); return Array.isArray(p)?p:[note]; }catch{ return [note]; }
}

function showAddAccessory(){ document.getElementById('accessoryAddForm').style.display='block'; }
function hideAddAccessory(){
  document.getElementById('accessoryAddForm').style.display='none';
  document.getElementById('newAccName').value='';
  document.getElementById('newAccSpecInput').value='';
  _newAccSpecs=[];
  renderNewAccSpecs();
}
function addAccSpecChip(){
  const inp=document.getElementById('newAccSpecInput');
  const v=inp.value.trim(); if(!v) return;
  if(!_newAccSpecs.includes(v)) _newAccSpecs.push(v);
  inp.value=''; inp.focus();
  renderNewAccSpecs();
}
function removeNewAccSpec(i){ _newAccSpecs.splice(i,1); renderNewAccSpecs(); }
function renderNewAccSpecs(){
  const el=document.getElementById('newAccSpecs'); if(!el) return;
  el.innerHTML=_newAccSpecs.map((s,i)=>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(37,99,235,.1);border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:3px 10px;font-size:13px;font-weight:600;">
      ${s}<button onclick="removeNewAccSpec(${i})" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:14px;padding:0;line-height:1;">×</button>
    </span>`
  ).join('');
}

async function addAccessory(){
  const name=document.getElementById('newAccName').value.trim();
  if(!name){ alert('品名を入力してください'); return; }
  if(accessories.some(a=>a.name===name)){ alert('同じ名前の付属品がすでにあります'); return; }
  const acc={id:nextAccId++, name, note:JSON.stringify(_newAccSpecs)};
  accessories.push(acc);
  hideAddAccessory();
  renderAccessoryList();
  try{ await sb.from('accessories').insert({id:acc.id, name:acc.name, note:acc.note||null}); flashSaved(); }
  catch(e){ console.error('付属品保存失敗:',e); }
  saveLocal();
}
async function deleteAccessory(id){
  const a=accessories.find(a=>a.id===id); if(!a) return;
  if(!confirm(`「${a.name}」を削除しますか？`)) return;
  accessories=accessories.filter(x=>x.id!==id);
  renderAccessoryList();
  try{ await sb.from('accessories').delete().eq('id',id); flashSaved(); }
  catch(e){ console.error('付属品削除失敗:',e); }
  saveLocal();
}
function editAccessory(id){
  const a=accessories.find(a=>a.id===id); if(!a) return;
  const el=document.getElementById(`acc-item-${id}`); if(!el) return;
  _editAccSpecs[id]=accParseSpecs(a.note).slice();
  el.innerHTML=`
    <div style="width:100%;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:18px">📦</span>
        <input type="text" id="acc-edit-name-${id}" value="${a.name.replace(/"/g,'&quot;')}" placeholder="品名"
          style="flex:1;padding:5px 10px;border-radius:6px;border:1.5px solid var(--accent);background:var(--surface);color:var(--text);font-size:14px;font-weight:600;">
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <input type="text" id="acc-edit-spec-inp-${id}" placeholder="規格を追加"
          style="flex:1;max-width:240px;padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;"
          onkeydown="if(event.key==='Enter'&&!event.isComposing){addEditAccSpec(${id});event.preventDefault();}">
        <button class="btn btn-secondary btn-sm" onclick="addEditAccSpec(${id})">＋ 追加</button>
      </div>
      <div id="acc-edit-specs-${id}" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;"></div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-primary btn-sm" onclick="saveAccessoryEdit(${id})">保存</button>
        <button class="btn btn-secondary btn-sm" onclick="renderAccessoryList()">キャンセル</button>
      </div>
    </div>`;
  renderEditAccSpecs(id);
  document.getElementById(`acc-edit-name-${id}`).focus();
}
function addEditAccSpec(id){
  const inp=document.getElementById(`acc-edit-spec-inp-${id}`);
  const v=inp.value.trim(); if(!v) return;
  if(!_editAccSpecs[id]) _editAccSpecs[id]=[];
  if(!_editAccSpecs[id].includes(v)) _editAccSpecs[id].push(v);
  inp.value=''; inp.focus();
  renderEditAccSpecs(id);
}
function removeEditAccSpec(id,i){ _editAccSpecs[id].splice(i,1); renderEditAccSpecs(id); }
function renderEditAccSpecs(id){
  const el=document.getElementById(`acc-edit-specs-${id}`); if(!el) return;
  el.innerHTML=(_editAccSpecs[id]||[]).map((s,i)=>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(37,99,235,.1);border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:3px 10px;font-size:13px;font-weight:600;">
      ${s}<button onclick="removeEditAccSpec(${id},${i})" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:14px;padding:0;line-height:1;">×</button>
    </span>`
  ).join('');
}
async function saveAccessoryEdit(id){
  const a=accessories.find(a=>a.id===id); if(!a) return;
  const newName=document.getElementById(`acc-edit-name-${id}`).value.trim();
  if(!newName){ alert('品名を入力してください'); return; }
  if(accessories.some(x=>x.id!==id&&x.name===newName)){ alert('同じ名前の付属品がすでにあります'); return; }
  a.name=newName; a.note=JSON.stringify(_editAccSpecs[id]||[]);
  renderAccessoryList();
  try{ await sb.from('accessories').upsert({id:a.id,name:a.name,note:a.note||null}); flashSaved(); }
  catch(e){ console.error('付属品更新失敗:',e); }
  saveLocal();
}
function renderAccessoryList(){
  const el=document.getElementById('accessoryList'); if(!el) return;
  if(!accessories.length){
    el.innerHTML='<div style="color:var(--text-muted);padding:20px 0;text-align:center;">付属品がまだ登録されていません</div>';
    return;
  }
  el.innerHTML=accessories.map(a=>{
    const specs=accParseSpecs(a.note);
    const chips=specs.map(s=>
      `<span style="background:rgba(37,99,235,.1);border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:3px 10px;font-size:14px;font-weight:600;">${s}</span>`
    ).join('');
    return`<div class="task-card" style="margin-bottom:8px;">
      <div id="acc-item-${a.id}" style="padding:12px 14px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:18px">📦</span>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:14px;margin-bottom:${specs.length?'6px':'0'};">${a.name}</div>
          ${specs.length?`<div style="display:flex;flex-wrap:wrap;gap:5px;">${chips}</div>`:''}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="editAccessory(${a.id})">✏️ 編集</button>
        <button class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="deleteAccessory(${a.id})">削除</button>
      </div>
    </div>`;
  }).join('');
}


// ── 車両リスト ──
function showAddVehicle(){ document.getElementById("vehicleAddForm").style.display="block"; }
function hideAddVehicle(){
  document.getElementById("vehicleAddForm").style.display="none";
  document.getElementById("newVehName").value="";
  document.getElementById("newVehNote").value="";
}

async function addVehicle(){
  const name = document.getElementById("newVehName").value.trim();
  if(!name){ alert("車両名を入力してください"); return; }
  if(vehicles.some(v=>v.name===name)){ alert("同じ名前の車両がすでにあります"); return; }
  const veh = {id:nextVehId++, name, note: document.getElementById("newVehNote").value.trim()};
  vehicles.push(veh);
  hideAddVehicle();
  renderVehicleList();
  try{ await sb.from("vehicles").insert({id:veh.id, name:veh.name, note:veh.note||null}); flashSaved(); }
  catch(e){ console.error("車両保存失敗:",e); }
  saveLocal();
}

async function deleteVehicle(id){
  const v = vehicles.find(v=>v.id===id);
  if(!v) return;
  if(!confirm("「"+v.name+"」を削除しますか？")) return;
  vehicles = vehicles.filter(x=>x.id!==id);
  renderVehicleList();
  try{ await sb.from("vehicles").delete().eq("id",id); flashSaved(); }
  catch(e){ console.error("車両削除失敗:",e); }
  saveLocal();
}

function editVehicle(id){
  const v=vehicles.find(v=>v.id===id);if(!v)return;
  const el=document.getElementById(`veh-item-${id}`);if(!el)return;
  el.innerHTML=`
    <span style="font-size:18px">🚛</span>
    <input type="text" id="veh-edit-name-${id}" value="${v.name.replace(/"/g,'&quot;')}" placeholder="車両名"
      style="flex:1;padding:5px 8px;border-radius:6px;border:1.5px solid var(--accent);background:var(--surface);color:var(--text);font-size:13px;font-weight:600;">
    <input type="text" id="veh-edit-note-${id}" value="${(v.note||'').replace(/"/g,'&quot;')}" placeholder="メモ（任意）"
      style="flex:1;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;">
    <button class="btn btn-primary btn-sm" onclick="saveVehicleEdit(${id})">保存</button>
    <button class="btn btn-secondary btn-sm" onclick="renderVehicleList()">キャンセル</button>`;
  document.getElementById(`veh-edit-name-${id}`).focus();
}
async function saveVehicleEdit(id){
  const v=vehicles.find(v=>v.id===id);if(!v)return;
  const newName=document.getElementById(`veh-edit-name-${id}`).value.trim();
  const newNote=document.getElementById(`veh-edit-note-${id}`).value.trim();
  if(!newName){alert('車両名を入力してください');return;}
  if(vehicles.some(x=>x.id!==id&&x.name===newName)){alert('同じ名前の車両がすでにあります');return;}
  v.name=newName;v.note=newNote;
  renderVehicleList();
  try{await sb.from('vehicles').upsert({id:v.id,name:v.name,note:v.note||null});flashSaved();}
  catch(e){console.error('車両更新失敗:',e);}
  saveLocal();
}

function renderVehicleList(){
  const el = document.getElementById("vehicleList");
  if(!el) return;
  if(!vehicles.length){
    el.innerHTML="<div style=\"color:var(--text-muted);padding:20px 0;text-align:center;\">車両がまだ登録されていません</div>";
    return;
  }
  el.innerHTML = vehicles.map(v=>`<div class="task-card" style="margin-bottom:8px;">
    <div id="veh-item-${v.id}" style="padding:12px 14px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:18px">🚛</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:14px;">${v.name}</div>
        ${v.note?`<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${v.note}</div>`:''}
      </div>
      <button class="btn btn-secondary btn-sm" onclick="editVehicle(${v.id})">✏️ 編集</button>
      <button class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="deleteVehicle(${v.id})">削除</button>
    </div>
  </div>`).join("");
}

function addTransportLog(id){
  const t = tasks.find(t=>t.id===id); if(!t) return;
  const date  = document.getElementById("tlog-date-"+id).value;
  const amt   = Number(document.getElementById("tlog-amt-"+id).value);
  const vehicle = document.getElementById("tveh-selected-"+id).value;
  if(!date)   { alert("日付を入力してください"); return; }
  if(!amt||amt<=0){ alert("kg数を正しく入力してください"); return; }
  if(!vehicle){ alert("車両を選択してください"); return; }
  if(!t.transportLog) t.transportLog=[];
  t.transportLog.push({date, vehicle, amount:amt});
  document.getElementById("tlog-amt-"+id).value="";
  render();
  saveTask(t);
}

function deleteTransportLog(id, idx){
  const t = tasks.find(t=>t.id===id); if(!t||!t.transportLog) return;
  const sorted = t.transportLog.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const target = sorted[idx];
  const realIdx = t.transportLog.findIndex(e=>e.date===target.date&&e.vehicle===target.vehicle&&e.amount===target.amount);
  if(realIdx===-1) return;
  t.transportLog.splice(realIdx,1);
  render();
  saveTask(t);
}
// ── Filters ──
function getFilters(){
  return{
    date:document.getElementById('filterDate').value,
    status:document.getElementById('filterStatus').value,
  };
}
function clearDateFilter(){document.getElementById('filterDate').value='';applyFilters();}
function setStatusFilter(val,btn){
  document.getElementById('filterStatus').value=val;
  document.querySelectorAll('.status-filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  syncKakouFilterToolbar();
  applyFilters();
}
function syncKakouFilterToolbar(){
  const isDone=document.getElementById('filterStatus')?.value==='完了';
  ['filterDate','ganttStart','ganttDays'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.disabled=isDone;
    el.style.opacity=isDone?'0.55':'1';
  });
}
function applyFilters(){if(currentMainTab==='gantt')renderGantt();}

function matchFilters(t,f){
  if(f.status==='完了'){
    if(!t.complete)return false;
  }else if(t.complete){
    return false;
  }else if(f.status){
    const s=dlStatus(t.deadline);
    if(f.status==='超過'&&s!=='danger')return false;
    if(f.status==='要注意'&&s!=='warn')return false;
    if(f.status==='正常'&&s!=='normal')return false;
  }
  if(f.date){const fd=toD(f.date);const st=toD(t.start),dl=toD(t.deadline);if(st&&dl){if(fd<st||fd>dl)return false;}else if(dl&&dl<fd)return false;}
  return true;
}
function filterGanttTasks(f){
  const list=tasks.filter(t=>matchFilters(t,f));
  if(f.status==='完了'){
    return[...list].sort((a,b)=>(Number(b.num)||Number(b.id)||0)-(Number(a.num)||Number(a.id)||0));
  }
  return[...list].filter(t=>!t.complete).sort((a,b)=>{
    if(isUrgent(a)!==isUrgent(b))return isUrgent(a)?-1:1;
    return(daysLeft(a.deadline)??9999)-(daysLeft(b.deadline)??9999);
  });
}

function taskCardHTML(t){
  const pct=t.total>0?Math.round(t.done/t.total*100):0;
  const n=daysLeft(t.deadline);
  const st=dlStatus(t.deadline);
  let sLabel='正常',sCls='s-normal',cCls='';
  if(t.complete){sLabel='完了';sCls='s-done';cCls='done-card';}
  else if(st==='danger'){sLabel='超過';sCls='s-danger';cCls='danger-card';}
  else if(st==='warn'){sLabel='要注意';sCls='s-warn';cCls='warn-card';}
  const isOpen=expandedIds.has(t.id);

  const dlPillCls=st==='danger'?'mp mp-dl-danger':st==='warn'?'mp mp-dl-warn':'mp mp-dl';
  const dlPill=`<span class="${dlPillCls}">📅 ${fmt(t.deadline)}</span>`;
  let daysPill='';
  if(n!==null){daysPill=n>=0?`<span class="mp mp-rem">残 ${n}日</span>`:`<span class="mp mp-over">${Math.abs(n)}日超過</span>`;}
  const unitTypeConfig={
    full: {icon:'🔗', label:'マイシングレード', bg:'#fff3e0', color:'#e65100', border:'#ffb74d'},
    outer:{icon:'🔗', label:'外周のみ',         bg:'#fff3e0', color:'#e65100', border:'#ffb74d'},
    other:{icon:'🔗', label:t.unitOtherNote?`その他：${t.unitOtherNote}`:'その他ユニット', bg:'#fff3e0', color:'#e65100', border:'#ffb74d'}
  };
  const unitCfg=unitTypeConfig[t.unitType];
  const unitPill=unitCfg?`<span class="mp unit-pill" style="background:${unitCfg.bg};color:${unitCfg.color};border:1px solid ${unitCfg.border};font-weight:700;">${unitCfg.icon} ${unitCfg.label}</span>`:'';
  const materialPill=t.material?`<span class="mp" style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;">🔩 ${t.material}</span>`:'';
  const tPill=`<span class="mp mp-t"><span class="ok">${t.done.toLocaleString()}</span> / ${t.total.toLocaleString()} kg</span>`;
  const progPill=`<span class="mp-pct"><div class="mp-bar-outer"><div class="mp-bar-inner" style="width:${pct}%"></div></div><span class="pval">${pct}%</span></span>`;
  // daily log entries (newest first)
  const logs=(t.dailyLog||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const logItems=logs.map((e,i)=>{
    const whStr=(e.workerHours||[]).filter(wh=>wh.hours>0).map(wh=>`${wh.worker}:${wh.hours}h`).join(' ');
    return`<div class="daily-log-item">
      <span class="daily-log-date">${e.date}</span>
      <span class="daily-log-amount">+${e.amount.toLocaleString()} kg</span>
      ${whStr?`<span class="daily-log-note" style="color:var(--accent)">⏱ ${whStr}</span>`:e.note?`<span class="daily-log-note">${e.note}</span>`:'<span class="daily-log-note" style="color:transparent">-</span>'}
      <button class="daily-log-del" onclick="deleteDailyLog(${t.id},'${e.date}',${i})" title="削除">✕</button>
    </div>`;
  }).join('');

  // today's date as default
  const todayStr=TODAY.toISOString().slice(0,10);

  return`
  <div class="task-card ${cCls}" id="card-${t.id}">
    <div class="task-main">
      <!-- 上段：No. 優先度 ステータス 編集ボタン -->
      <div class="task-main-top">
        <span class="num-badge">No.${t.num??t.id}</span>
        ${isUrgent(t)?'<span class="priority-badge pri-urgent">急</span>':''}
        <span class="status-badge ${sCls}" style="margin-left:auto;">${sLabel}</span>
        <button class="task-expand-btn" onclick="openTaskModal(${t.id})">✏️ 編集</button>
      </div>
      <!-- 現場名 -->
      <div class="task-name">${(()=>{const{main,sub}=getTaskNames(t);return main+(sub?`<span class="task-name-sub"> ／ ${sub}</span>`:'');})()}</div>
      <!-- ユニット（なければ空行を確保） -->
      <div style="min-height:22px;">${unitPill}</div>
      <!-- 納期・残日数 -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;">${dlPill}${daysPill}</div>
      <!-- kg数 -->
      <div><span class="mp mp-t"><span class="ok">${t.done.toLocaleString()}</span> / ${t.total.toLocaleString()} kg</span></div>
    </div>
    <!-- プログレスバー -->
    <div class="task-progress-bar-wrap">
      <div class="task-prog-outer"><div class="task-prog-inner" style="width:${pct}%"></div></div>
      <div class="task-prog-label"><span>${t.done.toLocaleString()} kg 完了</span><span>${pct}%</span></div>
    </div>
  </div>`;
}

function taskDetailHTML(t){
  const logs=(t.dailyLog||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const logItems=logs.map((e,i)=>{
    const whStr=(e.workerHours||[]).filter(wh=>wh.hours>0).map(wh=>`${wh.worker}:${wh.hours}h`).join(' ');
    return`<div class="daily-log-item">
      <span class="daily-log-date">${e.date}</span>
      <span class="daily-log-amount">+${e.amount.toLocaleString()} kg</span>
      ${whStr?`<span class="daily-log-note" style="color:var(--accent)">⏱ ${whStr}</span>`:e.note?`<span class="daily-log-note">${e.note}</span>`:'<span class="daily-log-note" style="color:transparent">-</span>'}
      <button class="daily-log-del" onclick="deleteDailyLog(${t.id},'${e.date}',${i})" title="削除">✕</button>
    </div>`;
  }).join('');
  const todayStr=TODAY.toISOString().slice(0,10);
  const tLog=t.transportLog||[];
  const transported=tLog.reduce((s,e)=>s+e.amount,0);
  const tPct=t.total>0?Math.min(100,Math.round(transported/t.total*100)):0;
  const remaining=Math.max(0,t.total-transported);

  return`<div class="task-detail">
      <!-- 日次入力パネル -->
      <div class="daily-input-wrap" style="grid-column:1/-1">
        <div class="daily-input-title">📥 今日の進捗を入力</div>
        <div class="daily-input-row">
          <input type="date" id="dlog-date-${t.id}" value="${todayStr}">
          <input type="number" id="dlog-amt-${t.id}" placeholder="完了kg数" min="1">
          <input type="text" id="dlog-note-${t.id}" class="note-input" placeholder="メモ（任意）">
          <button class="btn btn-primary btn-sm" onclick="addDailyLog(${t.id})">＋ 追加</button>
        </div>
        ${logs.length?`<div class="daily-log-list">${logItems}</div>`:'<div style="font-size:11px;color:var(--text-muted)">まだ記録がありません</div>'}
      </div>

      <!-- 基本情報編集 -->
      <div class="detail-field"><label>メイン項目</label><input type="text" value="${t.nameMain||t.name.split(' ／ ')[0]}" onchange="updateTaskName(${t.id},'main',this.value)"></div>
      <div class="detail-field"><label>サブ項目</label><input type="text" value="${t.nameSub||(t.name.includes(' ／ ')?t.name.split(' ／ ')[1]:'')||''}" placeholder="任意" onchange="updateTaskName(${t.id},'sub',this.value)"></div>
      <div class="detail-field"><label>部門</label>
        <select onchange="updateField(${t.id},'dept',this.value)">
          <option value="" ${!t.dept?'selected':''}>未設定</option>
          <option value="建築" ${'建築'===t.dept?'selected':''}>建築</option>
          <option value="土木" ${'土木'===t.dept?'selected':''}>土木</option>
          <option value="住宅基礎" ${'住宅基礎'===t.dept?'selected':''}>住宅基礎</option>
          <option value="その他" ${'その他'===t.dept?'selected':''}>その他</option>
        </select>
      </div>
      <div class="detail-field"><label>材料名</label>
        <select onchange="updateField(${t.id},'material',this.value)">
          <option value="" ${!t.material?'selected':''}>未設定</option>
          ${materials.map(m=>`<option value="${m.name}" ${t.material===m.name?'selected':''}>${m.name}${m.note?' ('+m.note+')':''}</option>`).join('')}
        </select>
      </div>
      <div class="detail-field"><label>至急</label>
        <select onchange="updateField(${t.id},'priority',this.value==='1'?1:null)">
          <option value="" ${!isUrgent(t)?'selected':''}>通常</option>
          <option value="1" ${isUrgent(t)?'selected':''}>至急</option>
        </select>
      </div>
      <div class="detail-field"><label>総kg数</label><input type="number" value="${t.total}" min="0" onchange="updateField(${t.id},'total',Number(this.value))"></div>
      <div class="detail-field"><label>ユニット</label>
        <div class="unit-tabs">
          <span class="unit-tab none-tab ${(!t.unitType||t.unitType==='none')?'active':''}" onclick="updateUnitType(${t.id},'none',this)">なし</span>
          <span class="unit-tab ${ t.unitType==='full'?'active':''}" onclick="updateUnitType(${t.id},'full',this)">マイシングレード</span>
          <span class="unit-tab ${t.unitType==='outer'?'active':''}" onclick="updateUnitType(${t.id},'outer',this)">外周のみ</span>
          <span class="unit-tab ${t.unitType==='other'?'active':''}" onclick="updateUnitType(${t.id},'other',this)">その他ユニット</span>
        </div>
        <input type="text" id="unit-other-note-${t.id}" placeholder="その他ユニットの内容" value="${t.unitOtherNote||''}"
          style="display:${t.unitType==='other'?'block':'none'};margin-top:6px;width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;"
          onchange="updateField(${t.id},'unitOtherNote',this.value)">
      </div>
      <div class="detail-field"><label>完了kg数（手動修正）</label><input type="number" value="${t.done}" min="0" max="${t.total}" onchange="updateField(${t.id},'done',Number(this.value))"></div>
      <div class="detail-field" style="grid-column:1/-1"><label>案件タイプ</label>
        <select id="editWorkflowType-${t.id}" onchange="updateField(${t.id},'workflowType',this.value);syncEditWorkflowFields(${t.id})">
          <option value="full" ${normalizeWorkflowType(t.workflowType)==='full'?'selected':''}>加工＋現場</option>
          <option value="field_only" ${normalizeWorkflowType(t.workflowType)==='field_only'?'selected':''}>現場のみ</option>
          <option value="process_only" ${normalizeWorkflowType(t.workflowType)==='process_only'?'selected':''}>加工のみ</option>
        </select>
      </div>
      <div id="edit-${t.id}-ProcessDates" style="display:${normalizeWorkflowType(t.workflowType)==='field_only'?'none':'contents'}">
        <div class="detail-field"><label>加工開始日</label><input type="date" value="${t.start||''}" onchange="updateField(${t.id},'start',this.value)"></div>
        <div class="detail-field"><label>加工納期</label><input type="date" value="${t.deadline||''}" onchange="updateField(${t.id},'deadline',this.value)"></div>
      </div>
      <div id="edit-${t.id}-FieldDates" style="grid-column:1/-1;display:${normalizeWorkflowType(t.workflowType)==='process_only'?'none':'grid'};grid-template-columns:1fr 1fr;gap:12px">
        <div class="detail-field"><label>現場開始日</label><input type="date" value="${t.fieldStart||''}" onchange="updateField(${t.id},'fieldStart',this.value||null)"></div>
        <div class="detail-field"><label>現場終了日</label><input type="date" value="${t.fieldEnd||''}" onchange="updateField(${t.id},'fieldEnd',this.value||null)"></div>
      </div>
      <div class="detail-field"><label>請会社</label><input type="text" value="${t.client||''}" placeholder="会社名（任意）" onchange="updateField(${t.id},'client',this.value)"></div>

      <!-- 運搬ログ -->
      <div class="transport-section">
        <div class="transport-title">🚛 運搬記録</div>
        <div class="transport-progress-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <span style="font-size:12px;color:var(--text-muted)">運搬済み <strong style="color:var(--warn)">${transported.toLocaleString()} kg</strong> / 総${t.total.toLocaleString()} kg</span>
            <span style="font-size:12px;color:${remaining===0?'var(--ok)':'var(--warn)'};">${remaining===0?'✅ 完了':'残 '+remaining.toLocaleString()+' kg'}</span>
          </div>
          <div style="background:var(--progress-bg);border-radius:99px;height:8px;overflow:hidden;margin-bottom:10px;">
            <div style="height:100%;width:${tPct}%;background:linear-gradient(90deg,#f5a623,#f7d080);border-radius:99px;transition:width .3s;"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">進捗 ${tPct}%</div>
        </div>
        <div class="transport-input-row">
          <select id="tveh-selected-${t.id}" style="flex:1.5;padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;">
            ${vehicles.length
              ? vehicles.map(v=>`<option value="${v.name.replace(/"/g,'&quot;')}">${v.name}</option>`).join('')
              : '<option value="">車両未登録</option>'
            }
          </select>
          <input type="date" id="tlog-date-${t.id}" value="${todayStr}" style="flex:1;">
          <input type="number" id="tlog-amt-${t.id}" placeholder="kg数" min="0.1" step="0.1" style="flex:1;">
          <button class="btn btn-primary btn-sm" onclick="addTransportLog(${t.id})">＋ 追加</button>
        </div>
        ${(t.transportLog&&t.transportLog.length)
          ? `<div class="transport-log-list">${(t.transportLog).slice().sort((a,b)=>b.date.localeCompare(a.date)).map((e,i)=>`
            <div class="transport-log-item">
              <span class="transport-log-date">${e.date}</span>
              <span class="transport-log-vehicle">🚛 ${e.vehicle}</span>
              <span class="transport-log-amount">${e.amount.toLocaleString()} kg</span>
              <button class="transport-log-del" onclick="deleteTransportLog(${t.id},${i})" title="削除">✕</button>
            </div>`).join('')}</div>`
          : '<div style="font-size:11px;color:var(--text-muted)">まだ運搬記録がありません</div>'
        }
      </div>

      <div class="detail-row" style="grid-column:1/-1">
        ${!t.complete
          ?`<button class="btn btn-success btn-sm" onclick="markDone(${t.id});closeTaskModal();">✓ 完了にする</button>`
          :`<button class="btn btn-secondary btn-sm" onclick="markUndone(${t.id})">↩ 未完了に戻す</button>`}
        <button class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="deleteTask(${t.id});closeTaskModal();">🗑 削除</button>
      </div>
    </div>`;
}

// ── Daily log ──
function addDailyLog(id){
  const t=tasks.find(t=>t.id===id); if(!t)return;
  const date=document.getElementById(`dlog-date-${id}`).value;
  const amt=Number(document.getElementById(`dlog-amt-${id}`).value);
  const note=document.getElementById(`dlog-note-${id}`).value.trim();
  if(!date){alert('日付を入力してください');return;}
  if(!amt||amt<=0){alert('完了kg数を1以上で入力してください');return;}
  const remaining=t.total-t.done;
  if(amt>remaining){if(!confirm(`残り${remaining.toLocaleString()}kgを超えています（${amt.toLocaleString()}kg）。続けますか？`))return;}
  if(!t.dailyLog)t.dailyLog=[];
  t.dailyLog.push({date,amount:amt,note});
  t.done=Math.min(t.total, t.done+amt);
  document.getElementById(`dlog-amt-${id}`).value='';
  document.getElementById(`dlog-note-${id}`).value='';
  render(); saveTask(t);
}

function deleteDailyLog(id,date,idx){
  const t=tasks.find(t=>t.id===id); if(!t||!t.dailyLog)return;
  const sorted=t.dailyLog.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const entry=sorted[idx];
  if(!entry)return;
  if(!confirm(`${entry.date} の +${entry.amount}kg を削除しますか？\n完了kg数から差し引かれます。`))return;
  const origIdx=t.dailyLog.findIndex(e=>e.date===entry.date&&e.amount===entry.amount&&e.note===entry.note);
  if(origIdx>=0)t.dailyLog.splice(origIdx,1);
  t.done=Math.max(0, t.done-entry.amount);
  render(); saveTask(t);
}


function toggleExpand(id){ openTaskModal(id); }

// Add Task Modal
function openAddTaskModal(){
  document.getElementById('newNameMain').value='';
  document.getElementById('newNameSub').value='';
  document.getElementById('newDept').value='';
  document.getElementById('newPriority').value='';
  document.getElementById('newWorkflowType').value='full';
  syncWorkflowFields('new');
  document.getElementById('newTotal').value='';
  document.getElementById('newStart').value='';
  document.getElementById('newDeadline').value='';
  document.getElementById('newFieldStart').value='';
  document.getElementById('newFieldEnd').value='';
  document.getElementById('newMaterial').value='';
  document.getElementById('newClient').value='';
  document.getElementById('addTaskModal').style.display='flex';
  document.body.style.overflow='hidden';
}

function closeAddTaskModal(){
  document.getElementById('addTaskModal').style.display='none';
  document.body.style.overflow='';
}

function openTaskModal(id){
  const tid=Number(id);
  const t=tasks.find(x=>x.id===tid||x.id===id);
  if(!t) return;
  document.getElementById('taskModalTitle').textContent=`No.${t.num??t.id}　${taskFullName(t)}`;
  document.getElementById('taskModalContent').innerHTML=taskDetailHTML(t);
  document.getElementById('taskModal').style.display='flex';
  document.body.style.overflow='hidden';
}

function closeTaskModal(e){
  if(e&&e.target!==document.getElementById('taskModal'))return;
  document.getElementById('taskModal').style.display='none';
  document.body.style.overflow='';
  render();
}
function selectUnitTab(prefix, type, el){
  const container=el.parentElement;
  container.querySelectorAll('.unit-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(prefix+'UnitType').value=type;
  // その他ユニットのメモ欄を表示切替
  const noteEl=document.getElementById(prefix+'UnitOtherNote');
  if(noteEl) noteEl.style.display=type==='other'?'block':'none';
  // タスク追加フォームのユニット販売情報欄を表示切替
  if(prefix==='new'){
    const saleInfo=document.getElementById('newSaleInfo');
    if(saleInfo){
      saleInfo.style.display=type!=='none'?'block':'none';
      if(type!=='none'){
        syncNewSaleBuyerSelect();
        // kg数を総kg数から自動入力
        const kg=document.getElementById('newTotal')?.value;
        if(kg)document.getElementById('newSaleKg').value=kg;
        calcNewSaleAmount();
      }
    }
  }
}
function syncNewSaleBuyerSelect(){
  const sel=document.getElementById('newSaleBuyer');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">選択してください</option>'+
    buyers.map(b=>`<option value="${b.name}">${b.name}（${b.unitPrice.toLocaleString()}円/kg）</option>`).join('');
  if(cur)sel.value=cur;
}
function calcNewSaleAmount(){
  const buyerName=document.getElementById('newSaleBuyer')?.value||'';
  const kg=Number(document.getElementById('newSaleKg')?.value)||0;
  const buyer=buyers.find(b=>b.name===buyerName);
  if(buyer&&kg>0){
    document.getElementById('newSaleAmount').value=Math.round(buyer.unitPrice*kg);
    document.getElementById('newSaleHint').textContent=`${buyer.unitPrice.toLocaleString()}円/kg × ${kg.toLocaleString()}kg = ${Math.round(buyer.unitPrice*kg).toLocaleString()}円`;
  }else{
    document.getElementById('newSaleAmount').value='';
    document.getElementById('newSaleHint').textContent='';
  }
}
function updateUnitType(id, type, el){
  const t=tasks.find(t=>t.id===id);
  if(!t) return;
  t.unitType=type;
  t.unitあり=type!=='none';
  const container=el.parentElement;
  container.querySelectorAll('.unit-tab').forEach(tab=>tab.classList.remove('active'));
  el.classList.add('active');
  // その他メモ欄の表示切替
  const noteEl=document.getElementById(`unit-other-note-${id}`);
  if(noteEl) noteEl.style.display=type==='other'?'block':'none';
  saveTask(t);
}
function updateTaskName(id, part, val){
  const t=tasks.find(t=>t.id===id);
  if(!t) return;
  if(part==='main') t.nameMain=val;
  else t.nameSub=val;
  t.name=t.nameSub ? (t.nameMain||'')+' ／ '+t.nameSub : (t.nameMain||'');
  render(); saveTask(t);
}
function updateField(id,field,val){
  const t=tasks.find(t=>t.id===id);
  if(!t)return;
  if(field==='priority')t.priority=normalizePriority(val);
  else t[field]=val;
  render();saveTask(t);
}
function markDone(id){markDoneWithSale(id);}
function markUndone(id){const t=tasks.find(t=>t.id===id);if(t){t.complete=false;render();saveTask(t);}}
function deleteTask(id){if(!confirm('削除しますか？'))return;tasks=tasks.filter(t=>t.id!==id);expandedIds.delete(id);render();deleteTaskDb(id);}

async function addTask(){
  const nameMain=document.getElementById('newNameMain').value.trim();
  const nameSub=document.getElementById('newNameSub').value.trim();
  if(!nameMain){alert('メイン項目を入力してください');return;}
  const name=nameSub ? nameMain+' ／ '+nameSub : nameMain;
  const unit=document.getElementById('newUnitType').value||'none';
  const unitOtherNote=unit==='other'?(document.getElementById('newUnitOtherNote').value.trim()||''):'';
  const mat=document.getElementById('newMaterial').value;
  const dept=document.getElementById('newDept').value||'';
  const client=document.getElementById('newClient').value.trim()||'';
  const wf=normalizeWorkflowType(document.getElementById('newWorkflowType').value);
  const t={id:nextId++,num:nextNum++,name,nameMain,nameSub,dept,material:mat,priority:document.getElementById('newPriority').value==='1'?1:null,
    total:Number(document.getElementById('newTotal').value)||0,done:0,
    workflowType:wf,
    deadline:document.getElementById('newDeadline').value||null,
    start:document.getElementById('newStart').value||null,
    fieldStart:document.getElementById('newFieldStart').value||null,
    fieldEnd:document.getElementById('newFieldEnd').value||null,
    status:'未着手',
    unitType:unit,unitOtherNote,unitあり:unit!=='none',workers:[],complete:false,client,dailyLog:[],transportLog:[]};
  tasks.push(t);

  // ユニットありなら未出荷として仮計上
  if(unit!=='none'){
    const buyerName=document.getElementById('newSaleBuyer')?.value||'';
    const kg=Number(document.getElementById('newSaleKg')?.value)||t.total;
    const amount=Number(document.getElementById('newSaleAmount')?.value)||0;
    if(buyerName){
      const s={id:nextSaleId++,date:t.start||TODAY.toISOString().slice(0,10),taskId:t.id,taskName:name,buyer:buyerName,kg,amount,memo:'',status:'未出荷'};
      sales.push(s);
      try{
        await sb.from('unit_sales').insert({id:s.id,date:s.date,task_id:t.id,task_name:name,buyer:buyerName,kg,amount,memo:'',status:'未出荷'});
        flashSaved();
      }catch(e){console.error('未出荷計上失敗:',e);}
      saveLocal();
    }
  }

  ['newNameMain','newNameSub','newTotal','newDeadline','newStart','newClient','newUnitOtherNote','newSaleKg','newSaleAmount'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('newDept').value='';;
  document.getElementById('newUnitType').value='none';
  document.querySelectorAll('#newUnitTabs .unit-tab').forEach(el=>el.classList.remove('active'));
  document.querySelector('#newUnitTabs .none-tab').classList.add('active');
  document.getElementById('newUnitOtherNote').style.display='none';
  document.getElementById('newMaterial').value='';
  const saleInfo=document.getElementById('newSaleInfo');
  if(saleInfo)saleInfo.style.display='none';
  render(); saveTask(t);
  switchMainTab('gantt');
}
