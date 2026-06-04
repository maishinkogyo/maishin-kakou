
// ── 作業配置（週間グリッド） ──
let weekOffset=0;
const DAY_NAMES=['月','火','水','木','金','土','日'];

function localDateStr(d){
  return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getWeekDates(){
  const now=new Date();
  // ローカル日付のみ（時刻なし）で今日を作る
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const dow=today.getDay(); // 0=日,1=月,...
  const daysToMon=dow===0?-6:1-dow;
  const result=[];
  for(let i=0;i<7;i++){
    const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()+daysToMon+weekOffset*7+i);
    result.push(d);
  }
  return result;
}

function assignChipMax(){return window.matchMedia('(max-width:900px)').matches?3:999;}
function formatAssignChipList(items,renderChip){
  const max=assignChipMax();
  const shown=items.slice(0,max);
  let html=shown.map(renderChip).join('');
  if(items.length>max)html+=`<span class="assign-chip" style="background:var(--surface2);color:var(--text-muted);border:1px solid var(--border)">+${items.length-max}</span>`;
  return html;
}

function scrollAssignToToday(){
  const board=document.getElementById('assignBoard');
  if(!board||!window.matchMedia('(max-width:900px)').matches)return;
  requestAnimationFrame(()=>{
    const today=board.querySelector('thead th[data-today]');
    const site=board.querySelector('thead th.col-site');
    if(!today){board.scrollLeft=0;return;}
    const siteW=site?site.offsetWidth:(window.matchMedia('(max-width:900px)').matches?120:124);
    board.scrollLeft=Math.max(0,today.offsetLeft-siteW-6);
  });
}

function renderAssign(){
  const dates=getWeekDates();
  const strs=dates.map(d=>localDateStr(d));
  const td=todayStr();
  const el=document.getElementById('assignBoard');
  const bannerEl=document.getElementById('assignBanner');
  const active=tasks.filter(t=>!t.complete);

  // 週ラベル
  const s=dates[0],e=dates[6];
  document.getElementById('assignWeekLabel').textContent=
    `${s.getMonth()+1}/${s.getDate()} ～ ${e.getMonth()+1}/${e.getDate()}`;

  if(!fieldWorkers.length){bannerEl.innerHTML='';el.innerHTML='<div class="empty"><div class="empty-icon">👷</div>マスタ登録で従業員を登録してください</div>';return;}
  if(!active.length){bannerEl.innerHTML='';el.innerHTML='<div class="empty"><div class="empty-icon">🏗️</div>進行中の現場がありません</div>';return;}

  bannerEl.innerHTML=`<div class="assign-color-legend" style="display:flex;flex-wrap:wrap;gap:10px 16px;font-size:11px;color:var(--text-muted);margin-bottom:8px;padding:6px 10px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
    <span style="font-weight:700;color:var(--text)">凡例</span>
    <span><span class="assign-chip" style="${assignGridChipStyle({affiliation:'現場'},{unassigned:true})}padding:1px 6px">現場</span> 未配置（赤）</span>
    <span><span class="assign-chip" style="${assignGridChipStyle({affiliation:'加工'},{unassigned:true})}padding:1px 6px">加工</span> 未配置（ピンク）</span>
    <span><span class="assign-chip" style="${assignGridChipStyle({affiliation:'現場'})}padding:1px 6px">配置表</span> 配置済（ネイビー）</span>
    <span><span class="assign-chip" style="background:${ASSIGN_CHIP_PALETTE.kakou.modal.bg};color:${ASSIGN_CHIP_PALETTE.kakou.modal.color};padding:1px 6px;border:1px solid ${ASSIGN_CHIP_PALETTE.kakou.modal.border}">加工</span> セル内の配置モーダル（水色）</span>
  </div>`;

  // ヘッダー行
  const headerCols=dates.map((d,i)=>{
    const ds=strs[i];
    const isToday=ds===td;
    const isSat=i===5,isSun=i===6;
    const color=isToday?'#fff':isSun?'#dc2626':isSat?'#2563eb':'var(--text)';
    const bg=isToday?'var(--accent)':isSat?'#eff6ff':isSun?'#fff1f2':'var(--surface2)';
    return`<th class="col-day"${isToday?' data-today="1"':''} style="background:${bg};color:${color};font-size:12px;font-weight:700;text-align:center;border:1px solid var(--border)">
      ${d.getMonth()+1}/${d.getDate()}<br>(${DAY_NAMES[i]})
    </th>`;
  }).join('');

  // 同日複数現場の重複チェック（現場行＋その他を含む）
  const dupMap={};
  strs.forEach(ds=>{
    const counts={};
    active.forEach(t=>{
      assignments.filter(a=>a.task_id===t.id&&a.date===ds).forEach(a=>{counts[a.worker_id]=(counts[a.worker_id]||0)+1;});
    });
    // その他にも配置されている場合もカウント
    getOtherAsg(ds).forEach(wid=>{counts[wid]=(counts[wid]||0)+1;});
    dupMap[ds]=new Set(Object.entries(counts).filter(([,v])=>v>1).map(([k])=>Number(k)));
  });

  // 現場行
  const siteRows=active.map(t=>{
    const cells=strs.map((ds,i)=>{
      const isSat=i===5,isSun=i===6;
      const cellBg=isSun?'#fff9f9':isSat?'#f0f7ff':'';
      const asgList=assignments.filter(a=>a.task_id===t.id&&a.date===ds);
      const asgWorkers=asgList.map(a=>{const w=fieldWorkers.find(x=>x.id===a.worker_id);return w?{w,a}:null;}).filter(Boolean);
      const chips=formatAssignChipList(asgWorkers,({w,a})=>{
        const isDup=dupMap[ds]&&dupMap[ds].has(w.id);
        return`<span class="assign-chip" style="${assignGridChipStyle(w,{dup:isDup})}cursor:pointer;" onclick="event.stopPropagation();toggleAssign(${t.id},${w.id},'${ds}',${a.id})">${w.name}</span>`;
      });

      // 使用車両チップ
      const siteVehicleAsg=getSiteVehicleAsg(t.id,ds);
      const allVehicles=loadVehicles();
      const vehicleChips=siteVehicleAsg.map(vid=>{const v=allVehicles.find(x=>normVehicleId(x.id)===normVehicleId(vid));if(!v)return'';return`<span class="assign-chip assign-vehicle-chip">${v.name}</span>`;}).join('');

      const wids=asgList.map(a=>a.worker_id);
      const hasNippo=workRecords.some(r=>r.task_id===t.id&&r.date===ds);
      const btnColor=hasNippo?'#9ca3af':'var(--accent)';
      const isToday=ds===td;
      return`<td class="col-day" style="${cellBg?'background:'+cellBg+';':''}border:1px solid var(--border);cursor:pointer" onclick="openCellAssign(${t.id},'${ds}',event)">
        ${chips}
        ${vehicleChips?`<div style="margin-top:4px;font-size:10px;color:#6b7280">車両:</div>${vehicleChips}`:''}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px">
          <span style="font-size:10px;color:${asgList.length?'#2563eb':'var(--border)'}">${asgList.length?asgList.length+'名':''}</span>
          ${asgList.length?`<button style="font-size:10px;padding:1px 5px;background:${btnColor};color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap" onclick="event.stopPropagation();openNippoFromAssign(${t.id},'${ds}',[${wids.join(',')}])">日報</button>`:''}
        </div>
      </td>`;
    }).join('');

    return`<tr>
      <td class="col-site" role="button" tabindex="0" title="タップでメモ・詳細" onclick="goToSite(${t.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goToSite(${t.id});}" style="font-size:12px;font-weight:700;padding:6px 8px;border:1px solid var(--border);background:var(--surface2);vertical-align:middle;cursor:pointer">
        ${t.nameMain}${t.nameSub?`<div style="font-weight:400;color:var(--text-muted);font-size:10px">${t.nameSub}</div>`:''}
      </td>${cells}
    </tr>`;
  }).join('');

  // 未配置行
  const unassignedCells=strs.map((ds,i)=>{
    const isSat=i===5,isSun=i===6;
    const cellBg=isSun?'#fff9f9':isSat?'#f0f7ff':'';
    const uws=getUnassignedWorkersForDate(ds);
    const uwsHtml=formatAssignChipList(uws,w=>`<span class="assign-chip" style="${assignGridChipStyle(w,{unassigned:true})}cursor:pointer;" onclick="event.stopPropagation();openUnassignedWorkerAssignModal(${w.id},'${ds}',event)" title="タップして現場に配置">${w.name}</span>`);
    const countColor=!uws.length?'var(--border)':uws.some(isKakouWorker)&&uws.some(w=>!isKakouWorker(w))?'#6b7280':uws.some(isKakouWorker)?'#db2777':'#dc2626';
    return`<td class="col-day assign-unassigned-cell" style="${cellBg?'background:'+cellBg+';':''}border:1px solid var(--border);cursor:pointer" onclick="openUnassignedDayAssign('${ds}',event)" title="タップして未配置の作業員を現場に配置">
      ${uwsHtml||'<span style="font-size:10px;color:var(--border)">—</span>'}
      <div style="text-align:right;font-size:10px;color:${countColor};margin-top:2px">${uws.length?uws.length+'名・タップで配置':''}</div>
    </td>`;
  }).join('');

  el.innerHTML=`<div class="assign-table-wrap"><table class="assign-grid-table">
    <thead>
      <tr>
        <th class="col-site" style="background:var(--surface2);padding:6px 8px;border:1px solid var(--border);font-size:11px"></th>
        ${headerCols}
      </tr>
    </thead>
    <tbody>
      ${siteRows}
      <tr>
        <td class="col-site" style="font-size:12px;font-weight:700;padding:6px 8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);vertical-align:middle">その他</td>
        ${strs.map((ds,i)=>{
          const isSat=i===5,isSun=i===6;
          const cellBg=isSun?'#fff9f9':isSat?'#f0f7ff':'';
          const isToday=ds===td;
          const otherWids=getOtherAsg(ds);
          const otherWorkers=otherWids.map(wid=>fieldWorkers.find(x=>x.id===wid)).filter(Boolean);
          const otherChips=formatAssignChipList(otherWorkers,w=>{
            const isDup=dupMap[ds]&&dupMap[ds].has(w.id);
            return`<span class="assign-chip" style="${assignGridChipStyle(w,{dup:isDup})}">${w.name}</span>`;
          });

          // 「その他」の使用車両
          const otherVehicleAsg=getOtherVehicleAsg(ds);
          const allVehicles=loadVehicles();
          const vehicleChips=otherVehicleAsg.map(vid=>{const v=allVehicles.find(x=>normVehicleId(x.id)===normVehicleId(vid));if(!v)return'';return`<span class="assign-chip assign-vehicle-chip">${v.name}</span>`;}).join('');

          return`<td class="col-day" style="${cellBg?'background:'+cellBg+';':''}border:1px solid var(--border);cursor:pointer" onclick="openOtherCellAssign('${ds}',event)">
            ${otherChips}
            ${vehicleChips?`<div style="margin-top:4px;font-size:10px;color:#6b7280">車両:</div>${vehicleChips}`:''}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px">
              <span style="font-size:10px;color:${otherWids.length?'#1e40af':'var(--border)'}">${otherWids.length?otherWids.length+'名':''}</span>
              ${otherWids.length?`<button style="font-size:10px;padding:1px 5px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap" onclick="event.stopPropagation();openNippoFromOther('${ds}',[${otherWids.join(',')}])">日報</button>`:''}
            </div>
          </td>`;
        }).join('')}
      </tr>
      <tr>
        <td class="col-site" style="font-size:12px;font-weight:700;padding:6px 8px;border:1px solid var(--border);background:#eff6ff;color:#1e40af;vertical-align:middle">加工</td>
        ${strs.map((ds,i)=>{
          const isSat=i===5,isSun=i===6;
          const cellBg=isSun?'#fff9f9':isSat?'#f0f7ff':'';
          const kakouWids=getKakouAsg(ds);
          const kakouList=kakouWids.map(wid=>kakouWorkers.find(x=>x.id===wid)).filter(Boolean);
          const kakouChips=formatAssignChipList(kakouList,w=>`<span class="assign-chip" style="${assignGridChipStyle(w)}">${w.name}</span>`);
          return`<td class="col-day" style="${cellBg?'background:'+cellBg+';':''}border:1px solid var(--border);cursor:pointer" onclick="openKakouCellAssign('${ds}',event)">
            ${kakouChips}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px">
              <span style="font-size:10px;color:${kakouWids.length?'#1e40af':'var(--border)'}">${kakouWids.length?kakouWids.length+'名':''}</span>
            </div>
          </td>`;
        }).join('')}
      </tr>
      <tr>
        <td class="col-site" style="font-size:12px;font-weight:700;padding:6px 8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);vertical-align:middle">休み</td>
        ${strs.map((ds,i)=>{
          const isSat=i===5,isSun=i===6;
          const cellBg=isSun?'#fff9f9':isSat?'#f0f7ff':'';
          const isToday=ds===td;
          const offWids=getOffAsg(ds);
          const offWorkers=offWids.map(wid=>fieldWorkers.find(x=>x.id===wid)).filter(Boolean);
          const offChips=formatAssignChipList(offWorkers,w=>{
            if(isKakouWorker(w))return`<span class="assign-chip" style="${assignGridChipStyle(w,{unassigned:true})}">${w.name}</span>`;
            return`<span class="assign-chip" style="background:#d1fae5;color:#059669">${w.name}</span>`;
          });
          return`<td class="col-day" style="${cellBg?'background:'+cellBg+';':''}border:1px solid var(--border);cursor:pointer" onclick="openOffCellAssign('${ds}',event)">
            ${offChips}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px">
              <span style="font-size:10px;color:${offWids.length?'#059669':'var(--border)'}">${offWids.length?offWids.length+'名':''}</span>
            </div>
          </td>`;
        }).join('')}
      </tr>
      <tr>
        <td class="col-site" style="font-size:12px;font-weight:700;padding:6px 8px;border:1px solid var(--border);background:#fff5f5;color:#dc2626;vertical-align:middle">未配置</td>
        ${unassignedCells}
      </tr>
      <tr>
        <td class="col-site" style="font-size:12px;font-weight:700;padding:6px 8px;border:1px solid var(--border);background:#f9f5ff;color:#9333ea;vertical-align:middle">未使用</td>
        ${strs.map((ds,i)=>{
          const isSat=i===5,isSun=i===6;
          const cellBg=isSun?'#fff9f9':isSat?'#f0f7ff':'';
          const unusedVehicles=getUnusedVehiclesForDate(ds);
          const unusedChips=unusedVehicles.map(v=>`<span class="assign-chip assign-vehicle-chip" style="cursor:pointer" onclick="event.stopPropagation();openUnusedVehicleAssignModal(${JSON.stringify(v.id)},'${ds}',event)">${v.name}</span>`).join('');
          return`<td class="col-day assign-unused-cell" style="${cellBg?'background:'+cellBg+';':''}border:1px solid var(--border)" onclick="openUnusedDayAssign('${ds}',event)" title="タップして未使用車両を現場に配置">
            ${unusedChips||'<span style="font-size:10px;color:var(--border)">—</span>'}
            <div style="text-align:right;font-size:10px;color:${unusedVehicles.length?'#9333ea':'var(--border)'};margin-top:4px">${unusedVehicles.length?unusedVehicles.length+'台・タップで配置':''}</div>
          </td>`;
        }).join('')}
      </tr>
    </tbody>
  </table></div>`;
  scrollAssignToToday();
}

// ── その他配置（localStorage管理） ──
function loadOtherAsg(){try{return JSON.parse(localStorage.getItem('genba_other_asg')||'{}')}catch{return{}}}
function saveOtherAsg(m){localStorage.setItem('genba_other_asg',JSON.stringify(m));}
function getOtherAsg(date){return loadOtherAsg()[date]||[];}
function toggleOtherAsg(date,wid){
  const m=loadOtherAsg();
  const list=m[date]||[];
  const idx=list.indexOf(wid);
  if(idx>=0)list.splice(idx,1); else list.push(wid);
  if(list.length)m[date]=list; else delete m[date];
  saveOtherAsg(m);
}

// ── 加工配置（localStorage管理） ──
function loadKakouAsg(){try{return JSON.parse(localStorage.getItem('genba_kakou_asg')||'{}')}catch{return{}}}
function saveKakouAsg(m){localStorage.setItem('genba_kakou_asg',JSON.stringify(m));}
function getKakouAsg(date){return loadKakouAsg()[date]||[];}
function toggleKakouAsg(date,wid){
  const m=loadKakouAsg();
  const list=m[date]||[];
  const idx=list.indexOf(wid);
  if(idx>=0)list.splice(idx,1); else list.push(wid);
  if(list.length)m[date]=list; else delete m[date];
  saveKakouAsg(m);
}

// ── 休み配置（localStorage管理） ──
function loadOffAsg(){try{return JSON.parse(localStorage.getItem('genba_off_asg')||'{}')}catch{return{}}}
function saveOffAsg(m){localStorage.setItem('genba_off_asg',JSON.stringify(m));}
function getOffAsg(date){return loadOffAsg()[date]||[];}
function toggleOffAsg(date,wid){
  const m=loadOffAsg();
  const list=m[date]||[];
  const idx=list.indexOf(wid);
  if(idx>=0)list.splice(idx,1); else list.push(wid);
  if(list.length)m[date]=list; else delete m[date];
  saveOffAsg(m);
}

// ── 使用車両配置（日付単位：全体）──
function loadVehicleAsg(){try{return JSON.parse(localStorage.getItem('genba_vehicle_asg')||'{}')}catch{return{}}}
function saveVehicleAsg(m){localStorage.setItem('genba_vehicle_asg',JSON.stringify(m));}
function getVehicleAsg(date){return (loadVehicleAsg()[date]||[]).map(normVehicleId);}
function toggleVehicleAsg(date,vid){
  vid=normVehicleId(vid);
  const m=loadVehicleAsg();
  const list=(m[date]||[]).map(normVehicleId);
  const idx=list.indexOf(vid);
  if(idx>=0)list.splice(idx,1); else list.push(vid);
  if(list.length)m[date]=list; else delete m[date];
  saveVehicleAsg(m);
}

// 車両IDの型ゆれ（数値/文字列）を吸収
function normVehicleId(id){return id==null||id===''?'':String(id);}
function vehicleAsgIncludes(list,vid){return list.map(normVehicleId).includes(normVehicleId(vid));}

// ── 現場ごとの使用車両配置（現場×日付単位） ──
function loadSiteVehicleAsg(){try{return JSON.parse(localStorage.getItem('genba_site_vehicle_asg')||'{}')}catch{return{}}}
function saveSiteVehicleAsg(m){localStorage.setItem('genba_site_vehicle_asg',JSON.stringify(m));}
function getSiteVehicleAsg(tid,date){
  const m=loadSiteVehicleAsg();
  const key=tid+'-'+date;
  return (m[key]||[]).map(normVehicleId);
}
function toggleSiteVehicleAsg(tid,date,vid){
  vid=normVehicleId(vid);
  const m=loadSiteVehicleAsg();
  const key=tid+'-'+date;
  const list=(m[key]||[]).map(normVehicleId);
  const idx=list.indexOf(vid);
  if(idx>=0)list.splice(idx,1); else list.push(vid);
  if(list.length)m[key]=list; else delete m[key];
  saveSiteVehicleAsg(m);
}

// 「その他」用の車両配置管理
function loadOtherVehicleAsg(){try{return JSON.parse(localStorage.getItem('genba_other_vehicle_asg')||'{}')}catch{return{}}}
function saveOtherVehicleAsg(m){localStorage.setItem('genba_other_vehicle_asg',JSON.stringify(m));}
function getOtherVehicleAsg(date){
  const m=loadOtherVehicleAsg();
  return (m[date]||[]).map(normVehicleId);
}
function toggleOtherVehicleAsg(date,vid){
  vid=normVehicleId(vid);
  const m=loadOtherVehicleAsg();
  const list=(m[date]||[]).map(normVehicleId);
  const idx=list.indexOf(vid);
  if(idx>=0)list.splice(idx,1); else list.push(vid);
  if(list.length)m[date]=list; else delete m[date];
  saveOtherVehicleAsg(m);
}

let cellOtherDate=null;
function openOtherCellAssign(date,ev){
  if(ev)ev.stopPropagation();
  cellOtherDate=date;
  const p=date.split('-');
  const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  const dow=DAY_NAMES[d.getDay()===0?6:d.getDay()-1];
  document.getElementById('cellAssignTitle').textContent=`その他　${d.getMonth()+1}/${d.getDate()}(${dow})`;
  resetCellAssignModalLayout();
  renderOtherCellWorkers();
  renderOtherCellAssignVehicles();
  document.getElementById('cellAssignWorkers').dataset.mode='other';
  openModal('cellAssignModal');
}
function renderOtherCellWorkers(){
  const otherWids=getOtherAsg(cellOtherDate);
  document.getElementById('cellAssignWorkers').innerHTML=fieldWorkers.map(w=>{
    const on=otherWids.includes(w.id);
    const row=assignModalRowStyle(w,on);
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:${row.bg};border:1px solid ${row.border}">
      <span style="font-weight:${on?700:400}">${w.name}</span>
      <button class="btn btn-sm" style="background:${on?'#ef4444':row.accent};color:#fff;padding:3px 12px" onclick="toggleOtherCellWorker(${w.id})">
        ${on?'解除':'配置'}
      </button>
    </div>`;
  }).join('');
}
function toggleOtherCellWorker(wid){
  toggleOtherAsg(cellOtherDate,wid);
  renderOtherCellWorkers();
  renderAssign();
}
function renderOtherCellAssignVehicles(){
  const otherVehicleAsg=getOtherVehicleAsg(cellOtherDate);
  const allVehicles=loadVehicles();
  document.getElementById('cellAssignVehicles').innerHTML=allVehicles.map(v=>{
    const on=vehicleAsgIncludes(otherVehicleAsg,v.id);
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:${on?'#f3e8ff':'var(--bg)'};border:1px solid ${on?'#d8b4fe':'var(--border)'};font-size:12px">
      <span style="font-weight:${on?700:400}">${v.name}</span>
      <button type="button" class="btn btn-sm" style="background:${on?'#ef4444':'#9333ea'};color:#fff;padding:2px 8px;font-size:11px" onclick="toggleOtherCellVehicle(${JSON.stringify(v.id)})">
        ${on?'解除':'配置'}
      </button>
    </div>`;
  }).join('');
}
function toggleOtherCellVehicle(vid){
  toggleOtherVehicleAsg(cellOtherDate,normVehicleId(vid));
  renderOtherCellAssignVehicles();
  renderAssign();
}

// 未配置作業員の現場配置
let unassignedWorkerSelectId=null, unassignedWorkerSelectDate=null;
function getUnassignedWorkersForDate(ds){
  const assignedIds=new Set([
    ...assignments.filter(a=>a.date===ds).map(a=>a.worker_id),
    ...getOtherAsg(ds),
    ...getOffAsg(ds),
    ...getKakouAsg(ds),
  ]);
  return fieldWorkers.filter(w=>!assignedIds.has(w.id));
}
function formatAssignDateTitle(ds,prefix){
  const p=ds.split('-');
  const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  const dow=DAY_NAMES[d.getDay()===0?6:d.getDay()-1];
  return`${prefix}　${d.getMonth()+1}/${d.getDate()}(${dow})`;
}
function openUnassignedDayAssign(ds,ev){
  if(ev)ev.stopPropagation();
  const list=getUnassignedWorkersForDate(ds);
  if(!list.length){alert('この日に未配置の作業員はいません');return;}
  unassignedWorkerSelectDate=ds;
  document.getElementById('cellAssignTitle').textContent=formatAssignDateTitle(ds,'未配置');
  const layout=document.getElementById('cellAssignLayout');
  if(layout){layout.style.display='grid';layout.style.gridTemplateColumns='1fr';}
  const wp=document.getElementById('cellAssignWorkers')?.parentElement;
  if(wp){wp.style.display='block';wp.querySelector('div:first-child').textContent='作業員を選んで現場に配置';}
  const vp=document.getElementById('cellAssignVehicles')?.parentElement;
  if(vp)vp.style.display='none';
  document.getElementById('cellAssignWorkers').innerHTML=list.map(w=>{
    const row=assignModalRowStyle(w,false);
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:var(--bg);border:1px solid ${row.border};font-size:12px">
      <span style="font-weight:600">${w.name}</span>
      <button type="button" class="btn btn-sm" style="background:${row.accent};color:#fff;padding:3px 12px" onclick="openUnassignedWorkerAssignModal(${w.id},'${ds}',event)">現場に配置</button>
    </div>`;
  }).join('');
  document.getElementById('cellAssignWorkers').dataset.mode='unassigned-list';
  openModal('cellAssignModal');
}
function openUnassignedWorkerAssignModal(wid,date,ev){
  if(ev)ev.stopPropagation();
  unassignedWorkerSelectId=wid;
  unassignedWorkerSelectDate=date;
  const w=fieldWorkers.find(x=>x.id===wid);
  if(!w){alert('作業員が見つかりません');return;}
  const p=date.split('-');
  const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  const dow=DAY_NAMES[d.getDay()===0?6:d.getDay()-1];
  document.getElementById('cellAssignTitle').textContent=`${w.name}を配置（${d.getMonth()+1}/${d.getDate()}(${dow})）`;
  renderUnassignedWorkerSiteList();
  openModal('cellAssignModal');
  setTimeout(()=>{
    const layout=document.getElementById('cellAssignLayout');
    if(layout){layout.style.display='grid';layout.style.gridTemplateColumns='1fr';}
    const wp=document.getElementById('cellAssignWorkers')?.parentElement;
    if(wp)wp.style.display='none';
    const vp=document.getElementById('cellAssignVehicles')?.parentElement;
    if(vp){vp.style.display='block';vp.querySelector('div:first-child').textContent='現場';}
    document.getElementById('cellAssignWorkers').dataset.mode='unassigned-site';
  },50);
}
function renderUnassignedWorkerSiteList(){
  const active=tasks.filter(t=>!t.complete);
  const w=fieldWorkers.find(x=>x.id===unassignedWorkerSelectId);
  document.getElementById('cellAssignVehicles').innerHTML=active.map(t=>{
    const asg=assignments.find(a=>a.task_id===t.id&&a.worker_id===unassignedWorkerSelectId&&a.date===unassignedWorkerSelectDate);
    const isAssigned=!!asg;
    const row=w?assignModalRowStyle(w,isAssigned):{bg:'var(--bg)',border:'var(--border)',accent:'#059669'};
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:${isAssigned?row.bg:'var(--bg)'};border:1px solid ${isAssigned?row.border:'var(--border)'};font-size:12px">
      <span style="font-weight:${isAssigned?700:400}">${t.nameMain}${t.nameSub?` (${t.nameSub})`:''}</span>
      <button type="button" class="btn btn-sm" style="background:${isAssigned?'#ef4444':row.accent};color:#fff;padding:3px 12px" onclick="assignUnassignedWorkerToSite(${t.id})">
        ${isAssigned?'解除':'配置'}
      </button>
    </div>`;
  }).join('');
}
async function assignUnassignedWorkerToSite(tid){
  const asg=assignments.find(a=>a.task_id===tid&&a.worker_id===unassignedWorkerSelectId&&a.date===unassignedWorkerSelectDate);
  await toggleAssign(tid,unassignedWorkerSelectId,unassignedWorkerSelectDate,asg?asg.id:null);
  renderUnassignedWorkerSiteList();
}

// 未使用車両の現場配置
let unusedVehicleSelectId=null, unusedVehicleSelectDate=null;
function getUnusedVehiclesForDate(ds){
  const allVehicles=loadVehicles();
  const siteVehicleAsgMap=loadSiteVehicleAsg();
  const active=tasks.filter(t=>!t.complete);
  const assignedVids=new Set();
  active.forEach(t=>{const key=t.id+'-'+ds;const vids=siteVehicleAsgMap[key]||[];vids.forEach(vid=>assignedVids.add(normVehicleId(vid)));});
  return allVehicles.filter(v=>!assignedVids.has(normVehicleId(v.id)));
}
function openUnusedDayAssign(ds,ev){
  if(ev)ev.stopPropagation();
  const unused=getUnusedVehiclesForDate(ds);
  if(!unused.length){alert('この日に未使用の車両はありません');return;}
  unusedVehicleSelectDate=ds;
  const p=ds.split('-');
  const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  const dow=DAY_NAMES[d.getDay()===0?6:d.getDay()-1];
  document.getElementById('cellAssignTitle').textContent=`未使用車両　${d.getMonth()+1}/${d.getDate()}(${dow})`;
  const layout=document.getElementById('cellAssignLayout');
  if(layout){layout.style.display='grid';layout.style.gridTemplateColumns='1fr';}
  const wp=document.getElementById('cellAssignWorkers')?.parentElement;
  if(wp)wp.style.display='none';
  const vp=document.getElementById('cellAssignVehicles')?.parentElement;
  if(vp){vp.style.display='block';vp.querySelector('div:first-child').textContent='車両を選んで現場に配置';}
  document.getElementById('cellAssignVehicles').innerHTML=unused.map(v=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:var(--bg);border:1px solid var(--border);font-size:12px">
      <span>${v.name}</span>
      <button type="button" class="btn btn-sm" style="background:#9333ea;color:#fff;padding:3px 12px" onclick="openUnusedVehicleAssignModal(${JSON.stringify(v.id)},'${ds}',event)">現場に配置</button>
    </div>`).join('');
  openModal('cellAssignModal');
}
function openUnusedVehicleAssignModal(vid, date, ev){
  if(ev)ev.stopPropagation();
  unusedVehicleSelectId=normVehicleId(vid);
  unusedVehicleSelectDate=date;
  const v=loadVehicles().find(x=>normVehicleId(x.id)===normVehicleId(vid));
  if(!v){alert('車両が見つかりません');return;}
  const p=date.split('-');
  const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  const dow=DAY_NAMES[d.getDay()===0?6:d.getDay()-1];
  document.getElementById('cellAssignTitle').textContent=`${v.name}を配置（${d.getMonth()+1}/${d.getDate()}(${dow})）`;
  renderUnusedVehicleSiteList();
  openModal('cellAssignModal');
  setTimeout(()=>{
    const layout=document.getElementById('cellAssignLayout');
    if(layout){layout.style.display='grid';layout.style.gridTemplateColumns='1fr';}
    const wp=document.getElementById('cellAssignWorkers')?.parentElement;
    if(wp)wp.style.display='none';
    const vp=document.getElementById('cellAssignVehicles')?.parentElement;
    if(vp){vp.style.display='block';vp.querySelector('div:first-child').textContent='現場';}
  },50);
}
function renderUnusedVehicleSiteList(){
  const active=tasks.filter(t=>!t.complete);
  const siteList=active.map(t=>{
    const isAssigned=vehicleAsgIncludes(getSiteVehicleAsg(t.id,unusedVehicleSelectDate),unusedVehicleSelectId);
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:${isAssigned?'#f3e8ff':'var(--bg)'};border:1px solid ${isAssigned?'#d8b4fe':'var(--border)'};font-size:12px">
      <span style="font-weight:${isAssigned?700:400}">${t.nameMain}${t.nameSub?` (${t.nameSub})`:''}</span>
      <button class="btn btn-sm" style="background:${isAssigned?'#ef4444':'#059669'};color:#fff;padding:3px 12px" onclick="assignUnusedVehicleToSite(${t.id})">
        ${isAssigned?'解除':'配置'}
      </button>
    </div>`;
  }).join('');
  document.getElementById('cellAssignVehicles').innerHTML=siteList;
}
function assignUnusedVehicleToSite(tid){
  toggleSiteVehicleAsg(tid,unusedVehicleSelectDate,unusedVehicleSelectId);
  renderUnusedVehicleSiteList();
  renderAssign();
}

let cellKakouDate=null;
function openKakouCellAssign(date,ev){
  if(ev)ev.stopPropagation();
  cellKakouDate=date;
  const p=date.split('-');
  const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  const dow=DAY_NAMES[d.getDay()===0?6:d.getDay()-1];
  document.getElementById('cellAssignTitle').textContent=`加工　${d.getMonth()+1}/${d.getDate()}(${dow})`;
  resetCellAssignModalLayout();
  const vp=document.getElementById('cellAssignVehicles')?.parentElement;
  if(vp)vp.style.display='none';
  renderKakouCellWorkers();
  document.getElementById('cellAssignWorkers').dataset.mode='kakou';
  openModal('cellAssignModal');
}
function renderKakouCellWorkers(){
  if(!kakouWorkers.length){
    document.getElementById('cellAssignWorkers').innerHTML='<p style="font-size:13px;color:var(--text-muted);padding:8px">マスタ登録で所属が「加工」の従業員がここに表示されます。</p>';
    return;
  }
  const kakouWids=getKakouAsg(cellKakouDate);
  document.getElementById('cellAssignWorkers').innerHTML=kakouWorkers.map(w=>{
    const on=kakouWids.includes(w.id);
    const fw=fieldWorkers.find(x=>x.id===w.id)||{id:w.id,name:w.name,affiliation:'加工'};
    const row=assignModalRowStyle(fw,on);
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:${row.bg};border:1px solid ${row.border}">
      <span style="font-weight:${on?700:400}">${w.name}</span>
      <button type="button" class="btn btn-sm" style="background:${on?'#ef4444':row.accent};color:#fff;padding:3px 12px" onclick="toggleKakouCellWorker(${w.id})">
        ${on?'解除':'加工'}
      </button>
    </div>`;
  }).join('');
}
function toggleKakouCellWorker(wid){
  toggleKakouAsg(cellKakouDate,wid);
  renderKakouCellWorkers();
  renderAssign();
}

let cellOffDate=null;
function openOffCellAssign(date,ev){
  if(ev)ev.stopPropagation();
  cellOffDate=date;
  const p=date.split('-');
  const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  const dow=DAY_NAMES[d.getDay()===0?6:d.getDay()-1];
  document.getElementById('cellAssignTitle').textContent=`休み　${d.getMonth()+1}/${d.getDate()}(${dow})`;
  resetCellAssignModalLayout();
  const vp=document.getElementById('cellAssignVehicles')?.parentElement;
  if(vp)vp.style.display='none';
  renderOffCellWorkers();
  document.getElementById('cellAssignWorkers').dataset.mode='off';
  openModal('cellAssignModal');
}

let cellVehicleDate=null;
function openVehicleAssignModal(date,ev){
  if(ev)ev.stopPropagation();
  cellVehicleDate=date;
  const p=date.split('-');
  const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  const dow=DAY_NAMES[d.getDay()===0?6:d.getDay()-1];
  document.getElementById('vehicleAssignTitle').textContent=`使用車両　${d.getMonth()+1}/${d.getDate()}(${dow})`;
  renderVehicleList();
  openModal('vehicleAssignModal');
}
function renderVehicleList(){
  const vehicleAsg=getVehicleAsg(cellVehicleDate);
  const allVehicles=loadVehicles();
  document.getElementById('vehicleAssignList').innerHTML=allVehicles.map(v=>{
    const on=vehicleAsgIncludes(vehicleAsg,v.id);
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:${on?'#f3e8ff':'var(--bg)'};border:1px solid ${on?'#d8b4fe':'var(--border)'}">
      <span style="font-weight:${on?700:400}">${v.name}</span>
      <button type="button" class="btn btn-sm" style="background:${on?'#ef4444':'#9333ea'};color:#fff;padding:3px 12px" onclick="toggleVehicleAsgItem(${JSON.stringify(v.id)})">
        ${on?'解除':'配置'}
      </button>
    </div>`;
  }).join('');
}
function toggleVehicleAsgItem(vid){
  toggleVehicleAsg(cellVehicleDate,normVehicleId(vid));
  renderVehicleList();
  renderAssign();
}
function renderOffCellWorkers(){
  const offWids=getOffAsg(cellOffDate);
  document.getElementById('cellAssignWorkers').innerHTML=fieldWorkers.map(w=>{
    const on=offWids.includes(w.id);
    const rowStyle=assignModalRowStyle(w,on);
    const rowBg=on?rowStyle.bg:'var(--bg)';
    const rowBorder=on?rowStyle.border:(isKakouWorker(w)?ASSIGN_CHIP_PALETTE.kakou.modal.border:'var(--border)');
    const btnAccent=on?'#ef4444':rowStyle.accent;
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:${rowBg};border:1px solid ${rowBorder}">
      <span style="font-weight:${on?700:400}">${w.name}</span>
      <button class="btn btn-sm" style="background:${btnAccent};color:#fff;padding:3px 12px" onclick="toggleOffCellWorker(${w.id})">
        ${on?'解除':'休み'}
      </button>
    </div>`;
  }).join('');
}
function toggleOffCellWorker(wid){
  toggleOffAsg(cellOffDate,wid);
  renderOffCellWorkers();
  renderAssign();
}

let cellAssignTid=null,cellAssignDate=null;
function resetCellAssignModalLayout(){
  const layout=document.getElementById('cellAssignLayout');
  if(layout){layout.style.display='flex';layout.style.gridTemplateColumns='';}
  const wp=document.getElementById('cellAssignWorkers')?.parentElement;
  const vp=document.getElementById('cellAssignVehicles')?.parentElement;
  if(wp){wp.style.display='block';wp.querySelector('div:first-child').textContent='作業員';}
  if(vp){vp.style.display='block';vp.querySelector('div:first-child').textContent='車両';}
  const workersEl=document.getElementById('cellAssignWorkers');
  if(workersEl)workersEl.dataset.mode='site';
}
function openCellAssign(tid,date,ev){
  if(ev)ev.stopPropagation();
  cellAssignTid=tid;cellAssignDate=date;
  const t=tasks.find(x=>x.id===tid);
  const p=date.split('-');
  const d=new Date(Number(p[0]),Number(p[1])-1,Number(p[2]));
  const dow=DAY_NAMES[d.getDay()===0?6:d.getDay()-1];
  document.getElementById('cellAssignTitle').textContent=`${t.nameMain}　${d.getMonth()+1}/${d.getDate()}(${dow})`;
  resetCellAssignModalLayout();
  renderCellAssignWorkers();
  renderCellAssignVehicles();
  openModal('cellAssignModal');
}
function renderCellAssignWorkers(){
  const asgList=assignments.filter(a=>a.task_id===cellAssignTid&&a.date===cellAssignDate);
  document.getElementById('cellAssignWorkers').innerHTML=fieldWorkers.map(w=>{
    const asg=asgList.find(a=>a.worker_id===w.id);
    const row=assignModalRowStyle(w,!!asg);
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:${row.bg};border:1px solid ${row.border};font-size:12px">
      <span style="font-weight:${asg?700:400}">${w.name}</span>
      <button class="btn btn-sm" style="background:${asg?'#ef4444':row.accent};color:#fff;padding:2px 8px;font-size:11px" onclick="toggleAssignCell(${w.id})">
        ${asg?'解除':'配置'}
      </button>
    </div>`;
  }).join('');
}
function renderCellAssignVehicles(){
  const siteVehicleAsg=getSiteVehicleAsg(cellAssignTid,cellAssignDate);
  const allVehicles=loadVehicles();
  document.getElementById('cellAssignVehicles').innerHTML=allVehicles.map(v=>{
    const on=vehicleAsgIncludes(siteVehicleAsg,v.id);
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:${on?'#f3e8ff':'var(--bg)'};border:1px solid ${on?'#d8b4fe':'var(--border)'};font-size:12px">
      <span style="font-weight:${on?700:400}">${v.name}</span>
      <button type="button" class="btn btn-sm" style="background:${on?'#ef4444':'#9333ea'};color:#fff;padding:2px 8px;font-size:11px" onclick="toggleAssignCellVehicle(${JSON.stringify(v.id)})">
        ${on?'解除':'配置'}
      </button>
    </div>`;
  }).join('');
}
async function toggleAssignCell(wid){
  const asg=assignments.find(a=>a.task_id===cellAssignTid&&a.date===cellAssignDate&&a.worker_id===wid);
  await toggleAssign(cellAssignTid,wid,cellAssignDate,asg?asg.id:null);
  renderCellAssignWorkers();
}
function toggleAssignCellVehicle(vid){
  if(cellAssignTid==null||!cellAssignDate)return;
  toggleSiteVehicleAsg(cellAssignTid,cellAssignDate,normVehicleId(vid));
  renderCellAssignVehicles();
  renderAssign();
}

async function toggleAssign(tid,wid,date,asgId){
  if(asgId){
    const{error}=await sb.from('field_assignments').delete().eq('id',asgId);
    if(cloudFailed(error,'作業配置の解除'))return;
    assignments=assignments.filter(a=>a.id!==asgId);
  }else{
    const{data,error}=await sb.from('field_assignments').insert({task_id:tid,worker_id:wid,date,note:''}).select().single();
    if(cloudFailed(error,'作業配置の保存'))return;
    assignments.push(data);
  }
  renderAssign();
  populateSelects();
}

