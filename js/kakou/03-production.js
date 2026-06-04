
// ══ PRODUCTION ══
function getMonthlyData(yearFilter){
  const map={};
  tasks.forEach(t=>{
    const st=toD(t.start),dl=toD(t.deadline);
    if(!st||!dl)return;
    const months=[];
    let cur=new Date(st.getFullYear(),st.getMonth(),1);
    const endM=new Date(dl.getFullYear(),dl.getMonth(),1);
    while(cur<=endM){months.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`);cur.setMonth(cur.getMonth()+1);}
    if(!months.length)return;
    const perMt=Math.round(t.total/months.length),perMd=Math.round(t.done/months.length);
    months.forEach((mk,idx)=>{
      if(!map[mk])map[mk]={total:0,done:0,tasks:[]};
      const isLast=idx===months.length-1;
      const tt=isLast?t.total-perMt*(months.length-1):perMt;
      const td=isLast?t.done-perMd*(months.length-1):perMd;
      map[mk].total+=Math.max(0,tt);map[mk].done+=Math.max(0,td);
      const{main:_mn,sub:_ms}=getTaskNames(t);
      map[mk].tasks.push({name:t.name, nameMain:_mn, nameSub:_ms, total:Math.max(0,tt),done:Math.max(0,td)});
    });
  });
  const result={};
  Object.keys(map).sort().forEach(k=>{if(!yearFilter||k.startsWith(yearFilter))result[k]=map[k];});
  return result;
}

function getAllYears(){
  const years=new Set();
  tasks.forEach(t=>{if(t.start)years.add(new Date(t.start).getFullYear());if(t.deadline)years.add(new Date(t.deadline).getFullYear());});
  return[...years].sort();
}

function initAyumiMonthSelect(){
  const sel=document.getElementById('ayumiMonthSel');
  if(!sel)return;
  const allData=getMonthlyData('','');
  const months=Object.keys(allData).sort().reverse();
  const cur=sel.value;
  sel.innerHTML=months.map(mk=>{const[y,m]=mk.split('-');return`<option value="${mk}">${y}年${Number(m)}月</option>`;}).join('');
  if(cur&&months.includes(cur))sel.value=cur;
  else if(months.length)sel.value=months[0];
}
function initProductionSelects(){initAyumiMonthSelect();}

// ── 作業時間分析 ──
function renderTimeAnalysis(){
  const el=document.getElementById('timeAnalysisWrap'); if(!el)return;
  const yearFilter=document.getElementById('timeYearSel')?.value||'';
  const workerFilter=document.getElementById('timeWorkerSel')?.value||'';

  // 全ログをフラットに展開
  // entry: {date, taskId, nameMain, nameSub, amount, worker, hours}
  const allEntries=[];
  tasks.forEach(t=>{
    const{main:nameMain,sub:nameSub}=getTaskNames(t);
    (t.dailyLog||[]).forEach(e=>{
      if(yearFilter&&!e.date.startsWith(yearFilter))return;
      const whs=e.workerHours||[];
      if(!whs.length)return;
      whs.forEach(wh=>{
        if(!wh.hours||wh.hours<=0)return;
        allEntries.push({date:e.date, taskId:t.id, nameMain, nameSub, amount:e.amount/whs.length, worker:wh.worker, hours:wh.hours});
      });
    });
  });

  if(!allEntries.length){
    el.innerHTML='<div style="color:var(--text-muted);padding:16px 0;font-size:13px;">作業時間のデータがありません。進捗入力時に作業時間を入力してください。</div>';
    return;
  }

  // ── 作業者が選択されている場合：その人の日別ログ一覧 ──
  if(workerFilter){
    const myEntries=allEntries.filter(e=>e.worker===workerFilter).sort((a,b)=>b.date.localeCompare(a.date));
    if(!myEntries.length){
      el.innerHTML=`<div style="color:var(--text-muted);padding:16px 0;font-size:13px;">「${workerFilter}」の作業時間データがありません。</div>`;
      return;
    }
    const totalHours=myEntries.reduce((s,e)=>s+e.hours,0);
    const totalDone=myEntries.reduce((s,e)=>s+e.amount,0);
    const tph=totalHours>0?(totalDone/totalHours).toFixed(2):'-';

    const rows=myEntries.map(e=>{
      const siteName=e.nameMain+(e.nameSub?` <span style="color:var(--text-muted)">／ ${e.nameSub}</span>`:'');
      return`<tr>
        <td style="font-family:'DM Mono',monospace;font-size:12px;white-space:nowrap">${e.date}</td>
        <td style="font-weight:600">${siteName}</td>
        <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--ok);font-weight:700">${e.amount.toFixed(1)} kg</td>
        <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--accent);font-weight:700">${e.hours.toFixed(1)} 時間</td>
      </tr>`;
    }).join('');

    el.innerHTML=`
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;flex-wrap:wrap;">
        <span style="font-size:16px;font-weight:700;color:var(--text)">👤 ${workerFilter}</span>
        <span style="font-size:12px;color:var(--text-muted)">${myEntries.length}件のログ</span>
        <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:var(--accent)">総 ${totalHours.toFixed(1)} 時間</span>
        <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--ok);font-weight:700">${totalDone.toFixed(1)} kg</span>
        <span style="font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:2px 10px;font-family:'DM Mono',monospace;color:var(--text)">生産性 ${tph} kg/h</span>
      </div>
      <div class="prod-table-wrap">
        <table class="prod-table">
          <thead><tr><th>日付</th><th>現場</th><th style="text-align:right">kg数</th><th style="text-align:right">作業時間</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    return;
  }

  // ── 全員表示：人別サマリ ──
  const workerMap={};
  allEntries.forEach(e=>{
    if(!workerMap[e.worker])workerMap[e.worker]={totalHours:0,totalDone:0,logs:[]};
    workerMap[e.worker].totalHours+=e.hours;
    workerMap[e.worker].totalDone+=e.amount;
    workerMap[e.worker].logs.push(e);
  });

  const workerRows=Object.entries(workerMap).sort((a,b)=>b[1].totalHours-a[1].totalHours).map(([w,v])=>{
    const tph=v.totalHours>0?(v.totalDone/v.totalHours).toFixed(2):'-';
    return`<tr style="cursor:pointer" onclick="document.getElementById('timeWorkerSel').value='${w}';renderTimeAnalysis();">
      <td style="font-weight:600">👤 ${w}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--text-muted);font-size:11px">${v.logs.length}件</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">${v.totalHours.toFixed(1)} h</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--ok)">${v.totalDone.toFixed(1)} kg</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${tph} kg/h</td>
      <td style="color:var(--text-muted);font-size:11px">→ 詳細</td>
    </tr>`;
  }).join('');

  el.innerHTML=`
    <div class="prod-table-wrap">
      <table class="prod-table">
        <thead><tr><th>作業者</th><th style="text-align:right">件数</th><th style="text-align:right">総作業時間</th><th style="text-align:right">完了kg数</th><th style="text-align:right">生産性（kg/h）</th><th></th></tr></thead>
        <tbody>${workerRows}</tbody>
      </table>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">行をクリックすると日別の詳細を表示します</div>`;
}

function renderYearCards(){
  const years=getAllYears();
  if(!years.length){document.getElementById('yearSummaryCards').innerHTML='<div style="color:var(--text-muted)">データがありません</div>';return;}
  const html='<div class="year-cards">'+years.map(y=>{
    const data=getMonthlyData(String(y));
    const total=Object.values(data).reduce((s,v)=>s+v.total,0);
    const done=Object.values(data).reduce((s,v)=>s+v.done,0);
    const pct=total>0?Math.round(done/total*100):0;
    const tc=tasks.filter(t=>{const sy=t.start?new Date(t.start).getFullYear():null;const dy=t.deadline?new Date(t.deadline).getFullYear():null;return sy===y||dy===y;}).length;
    return`<div class="year-card"><div class="year-card-year">${y}年</div>
      <div class="year-card-row"><span class="year-card-lbl">総kg数</span><span class="year-card-val">${total.toLocaleString()}</span></div>
      <div class="year-card-row"><span class="year-card-lbl">完了kg数</span><span class="year-card-val c-done">${done.toLocaleString()}</span></div>
      <div class="year-card-row"><span class="year-card-lbl">達成率</span><span class="year-card-val c-pct">${pct}%</span></div>
      <div class="year-card-row"><span class="year-card-lbl">現場数</span><span class="year-card-val" style="font-size:14px">${tc}</span></div>
      <div class="year-card-bar-outer"><div class="year-card-bar-inner" style="width:${pct}%"></div></div>
    </div>`;
  }).join('')+'</div>';
  document.getElementById('yearSummaryCards').innerHTML=html;
}

function renderBarChart(labels,totalVals,doneVals,viewMode){
  const canvas=document.getElementById('prodBarCanvas');
  const dpr=window.devicePixelRatio||1;
  const W=canvas.parentElement.clientWidth-40;
  const H=260;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  canvas.width=W*dpr;canvas.height=H*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const PAD={top:20,right:20,bottom:44,left:56};
  const cW=W-PAD.left-PAD.right,cH=H-PAD.top-PAD.bottom;
  ctx.clearRect(0,0,W,H);
  const maxVal=Math.max(...totalVals,...doneVals,1);
  const nBars=labels.length;
  const grpW=cW/nBars;
  const barW=viewMode==='both'?grpW*.35:grpW*.55;
  const gap=viewMode==='both'?grpW*.05:0;
  const gridLines=5;
  ctx.strokeStyle='rgba(160,170,200,.7)';ctx.lineWidth=1;
  for(let i=0;i<=gridLines;i++){
    const y=PAD.top+cH*(1-i/gridLines);
    ctx.beginPath();ctx.moveTo(PAD.left,y);ctx.lineTo(PAD.left+cW,y);ctx.stroke();
    const v=Math.round(maxVal*i/gridLines);
    ctx.fillStyle='rgba(60,75,120,.8)';ctx.font=`10px "DM Mono",monospace`;ctx.textAlign='right';
    ctx.fillText(v>=1000?(v/1000).toFixed(1)+'k':v,PAD.left-6,y+4);
  }
  labels.forEach((lbl,i)=>{
    const x0=PAD.left+i*grpW,centerX=x0+grpW/2;
    function drawBar(val,c1,c2,offX){
      if(val<=0)return;
      const bh=(val/maxVal)*cH,bx=centerX+offX-barW/2,by=PAD.top+cH-bh;
      const grad=ctx.createLinearGradient(bx,by,bx,by+bh);grad.addColorStop(0,c1);grad.addColorStop(1,c2);
      ctx.fillStyle=grad;const r=Math.min(4,barW/2);
      ctx.beginPath();ctx.moveTo(bx+r,by);ctx.lineTo(bx+barW-r,by);ctx.quadraticCurveTo(bx+barW,by,bx+barW,by+r);
      ctx.lineTo(bx+barW,by+bh);ctx.lineTo(bx,by+bh);ctx.lineTo(bx,by+r);ctx.quadraticCurveTo(bx,by,bx+r,by);ctx.closePath();ctx.fill();
      if(bh>16){ctx.fillStyle='rgba(40,50,80,.75)';ctx.font=`bold 9px "DM Mono",monospace`;ctx.textAlign='center';ctx.fillText(val>=1000?(val/1000).toFixed(1)+'k':val,bx+barW/2,by-3);}
    }
    if(viewMode==='total')drawBar(totalVals[i],'#4f46e5','#818cf8',0);
    else if(viewMode==='done')drawBar(doneVals[i],'#15803d','#4ade80',0);
    else{drawBar(totalVals[i],'#4f46e5','#818cf8',-(barW/2+gap/2));drawBar(doneVals[i],'#15803d','#4ade80',+(barW/2+gap/2));}
    ctx.fillStyle='rgba(60,75,120,.85)';ctx.font=`11px "Noto Sans JP",sans-serif`;ctx.textAlign='center';ctx.fillText(lbl,centerX,PAD.top+cH+16);
  });
  if(viewMode==='both'){
    const items=[['#4f46e5','総kg数'],['#15803d','完了kg数']];let lx=PAD.left;
    items.forEach(([c,label])=>{ctx.fillStyle=c;ctx.fillRect(lx,PAD.top+cH+28,10,10);ctx.fillStyle='rgba(60,75,120,.85)';ctx.font='11px "Noto Sans JP",sans-serif';ctx.textAlign='left';ctx.fillText(label,lx+14,PAD.top+cH+38);lx+=80;});
  }
}

function renderMonthlyTable(data){
  const months=Object.keys(data).sort();
  if(!months.length){document.getElementById('prodTable').innerHTML='<tr><td style="padding:20px;color:var(--text-muted)">データがありません</td></tr>';return;}
  const totalSum=months.reduce((s,m)=>s+data[m].total,0),doneSum=months.reduce((s,m)=>s+data[m].done,0);
  const maxTotal=Math.max(...months.map(m=>data[m].total),1);
  const thead=`<thead><tr><th>月</th><th>総kg数</th><th>完了kg数</th><th>達成率</th><th style="min-width:120px">進捗</th></tr></thead>`;
  const rows=months.map(mk=>{
    const[y,m]=mk.split('-');const v=data[mk];const pct=v.total>0?Math.round(v.done/v.total*100):0;
    return`<tr><td class="name-col">${y}年 ${Number(m)}月</td><td>${v.total.toLocaleString()}</td><td class="done-col">${v.done.toLocaleString()}</td><td class="pct-col">${pct}%</td>
      <td><div class="bar-inline"><div class="bar-inline-outer"><div class="bar-inline-inner" style="width:${Math.round(v.total/maxTotal*100)}%"></div></div><span style="font-size:10px;color:var(--text-muted);white-space:nowrap">${v.total.toLocaleString()}</span></div></td></tr>`;
  }).join('');
  const tp=totalSum>0?Math.round(doneSum/totalSum*100):0;
  const tfoot=`<tfoot><tr><td class="name-col">合計</td><td>${totalSum.toLocaleString()}</td><td class="done-col">${doneSum.toLocaleString()}</td><td class="pct-col">${tp}%</td><td></td></tr></tfoot>`;
  document.getElementById('prodTable').innerHTML=thead+'<tbody>'+rows+'</tbody>'+tfoot;
}

function renderTaskBreakdown(){
  const mk=document.getElementById('prodMonthSel').value;
  if(!mk){document.getElementById('taskBreakdownTable').innerHTML='';return;}
  const allData=getMonthlyData(mk.slice(0,4));
  const md=allData[mk];
  const el=document.getElementById('taskBreakdownTable');
  if(!md||!md.tasks.length){el.innerHTML='<tr><td style="padding:16px;color:var(--text-muted)">この月のデータがありません</td></tr>';return;}

  // メイン項目でグループ化
  const groups={};
  md.tasks.forEach(t=>{
    const key=t.nameMain||t.name;
    if(!groups[key])groups[key]={nameMain:key, subs:[], total:0, done:0};
    groups[key].total+=t.total;
    groups[key].done+=t.done;
    if(t.nameSub) groups[key].subs.push(t);
  });

  const thead=`<thead><tr>
    <th>現場　<span style="font-size:10px;font-weight:400;color:var(--text-muted);">（クリックで内訳）</span></th>
    <th style="text-align:right">総kg数</th>
    <th style="text-align:right">完了kg数</th>
    <th style="text-align:right">達成率</th>
  </tr></thead>`;

  let prodSiteIdx=0;
  const rows=Object.values(groups).sort((a,b)=>b.total-a.total).map(g=>{
    const pct=g.total>0?Math.round(g.done/g.total*100):0;
    const pctColor=pct>=100?'var(--ok)':pct>=50?'var(--accent)':'var(--text-muted)';
    const hasSubs=g.subs.length>0;
    const detailId=`prodSite_${prodSiteIdx++}`;

    // メイン行
    let html=`<tr style="background:var(--surface2);${hasSubs?'cursor:pointer;':''}" ${hasSubs?`onclick="toggleSiteDetail('${detailId}',this)"`:''}>
      <td style="font-weight:700;font-size:13px;padding:9px 14px;">
        ${hasSubs?`<span class="site-detail-arrow" style="font-size:10px;margin-right:4px;color:var(--text-muted);">▶</span>`:''}📍 ${g.nameMain}
      </td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${g.total.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--ok);font-weight:700">${g.done.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:${pctColor}">${pct}%</td>
    </tr>`;

    // サブ項目行（デフォルト非表示・クリックで展開）
    if(hasSubs){
      g.subs.sort((a,b)=>b.total-a.total).forEach(s=>{
        const sp=s.total>0?Math.round(s.done/s.total*100):0;
        const spColor=sp>=100?'var(--ok)':sp>=50?'var(--accent)':'var(--text-muted)';
        html+=`<tr class="${detailId}" style="display:none;border-top:1px dashed var(--border);">
          <td style="padding:7px 14px 7px 28px;font-size:12px;color:var(--text-muted)">└ ${s.nameSub}</td>
          <td style="text-align:right;font-family:'DM Mono',monospace;font-size:12px">${s.total.toLocaleString()}</td>
          <td style="text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--ok)">${s.done.toLocaleString()}</td>
          <td style="text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:${spColor}">${sp}%</td>
        </tr>`;
      });
    }
    return html;
  }).join('');

  const totT=md.tasks.reduce((s,t)=>s+t.total,0);
  const totD=md.tasks.reduce((s,t)=>s+t.done,0);
  const totP=totT>0?Math.round(totD/totT*100):0;

  el.innerHTML=thead+`<tbody>${rows}</tbody>
    <tfoot><tr>
      <td style="font-weight:700">合計</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${totT.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--ok)">${totD.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${totP}%</td>
    </tr></tfoot>`;
}

function renderDeptBreakdown(){
  const sel=document.getElementById('ayumiMonthSel');
  const mk=sel?sel.value:'';
  const el=document.getElementById('deptBreakdownTable');
  if(!mk){el.innerHTML='';return;}

  // 月の日報から人工を集計（taskId → dept 経由）
  const [y,m]=mk.split('-');
  const monthReports=reports.filter(r=>r.date&&r.date.startsWith(mk)&&(!r.status||r.status==='通常'));

  // 全タスクのdept マップ
  const taskDeptMap={};
  tasks.forEach(t=>{if(t.dept)taskDeptMap[t.id]=t.dept;});

  // 月の加工量を部門別に集計（dailyLog から当月分）
  const deptKg={};
  tasks.forEach(t=>{
    if(!t.dept)return;
    const monthLog=(t.dailyLog||[]).filter(e=>e.date&&e.date.startsWith(mk));
    const kg=monthLog.reduce((s,e)=>s+Number(e.amount||0),0);
    deptKg[t.dept]=(deptKg[t.dept]||0)+kg;
  });

  // 月の人工を部門別に集計（日報のrows.taskId から dept を引く）
  const deptHours={};
  monthReports.forEach(r=>{
    (r.rows||[]).forEach(rw=>{
      const dept=rw.taskId?taskDeptMap[rw.taskId]:null;
      if(!dept)return;
      deptHours[dept]=(deptHours[dept]||0)+(rw.hours||0);
    });
  });

  const DEPTS=['建築','土木','住宅基礎','その他'];
  const activeDepts=DEPTS.filter(d=>deptKg[d]||deptHours[d]);
  if(!activeDepts.length){
    el.innerHTML='<tr><td style="padding:16px;color:var(--text-muted)">部門が設定された現場のデータがありません</td></tr>';
    return;
  }

  const thead=`<thead><tr>
    <th>部門</th>
    <th style="text-align:right">加工数量(kg)</th>
    <th style="text-align:right">人工数</th>
    <th style="text-align:right">歩掛り(kg/人工)</th>
  </tr></thead>`;

  let totKg=0,totH=0;
  const rows=activeDepts.map(d=>{
    const kg=Math.round(deptKg[d]||0);
    const mandays=((deptHours[d]||0)/7);
    const ayumi=mandays>0?(kg/mandays).toFixed(1):'-';
    totKg+=kg; totH+=(deptHours[d]||0);
    return`<tr>
      <td style="font-weight:600;padding:9px 14px">${d}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${kg.toLocaleString()}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace">${mandays.toFixed(1)}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">${ayumi}</td>
    </tr>`;
  }).join('');

  const totMandays=(totH/7);
  const totAyumi=totMandays>0?(totKg/totMandays).toFixed(1):'-';
  el.innerHTML=thead+`<tbody>${rows}</tbody><tfoot><tr>
    <td style="font-weight:700">合計</td>
    <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${Math.round(totKg).toLocaleString()}</td>
    <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${totMandays.toFixed(1)}</td>
    <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">${totAyumi}</td>
  </tr></tfoot>`;
}

function renderProduction(){
  initAyumiMonthSelect();
  renderDeptBreakdown();
}

// ── Tab switch ──
let currentMainTab='gantt';
function closeMobileMoreKakou(){
  const s=document.getElementById('kakouMobileMore');
  if(s)s.classList.remove('open');
}
function toggleMobileMoreKakou(){
  const s=document.getElementById('kakouMobileMore');
  if(s)s.classList.toggle('open');
}
function syncKakouMobileNav(tab){
  document.querySelectorAll('.mbn-k[data-tab]').forEach(b=>{
    b.classList.toggle('active',b.dataset.tab===tab);
  });
}
function switchMainTab(tab){
  if(tab==='active')tab='gantt';
  if(tab==='unit-sales'){
    currentMainTab='unit-sales';
    closeMobileMoreKakou();
    if(typeof MaishinNav!=='undefined')MaishinNav.syncActive(MaishinNav.navIdForKakouTab('unit-sales'));
    document.querySelectorAll('.main-tab').forEach(el=>el.classList.remove('active'));
    document.querySelectorAll('.main-content').forEach(el=>el.classList.remove('active'));
    document.getElementById('tab-unit-sales').classList.add('active');
    initUnitSales();
    return;
  }
  if(tab==='done'){
    tab='gantt';
    const doneBtn=document.querySelector('#statusFilterTabs .status-filter-btn[data-value="完了"]');
    if(doneBtn)setStatusFilter('完了',doneBtn);
  }
  currentMainTab=tab;
  closeMobileMoreKakou();
  syncKakouMobileNav(tab);
  if(typeof MaishinNav!=='undefined')MaishinNav.syncActive(MaishinNav.navIdForKakouTab(tab));
  document.querySelectorAll('.main-tab').forEach((el,i)=>el.classList.toggle('active',['gantt','production','report'][i]===tab));
  document.querySelectorAll('.main-content').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  if(tab==='gantt')renderGantt();
  if(tab==='production'){initProductionSelects();renderProduction();}
  if(tab==='master')renderMasterTab();
  if(tab==='report')initReportTab();
}

function render(){
  syncKakouFilterToolbar();
  syncMaterialSelects();
  if(currentMainTab==='gantt')renderGantt();
  if(currentMainTab==='production'){initProductionSelects();renderProduction();}
  if(currentMainTab==='master')renderMasterTab();
}
