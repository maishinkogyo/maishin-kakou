function initMaishinSideNav(){
  const el=document.getElementById('maishinSideNavItems');
  if(!el||typeof MaishinNav==='undefined')return;
  MaishinNav.renderNav(el,{activeId:MaishinNav.navIdForKakouTab(currentMainTab)});
  const mob=document.getElementById('maishinMobileMoreNav');
  if(mob)MaishinNav.renderNav(mob,{activeId:MaishinNav.navIdForKakouTab(currentMainTab)});
}
async function initApp(){
  try{
    // iOSのSafari対策: 少し待ってから接続
    await new Promise(r => setTimeout(r, 300));
    await loadData();
    const gStart=document.getElementById('ganttStart');
    const gDays=document.getElementById('ganttDays');
    if(gStart) gStart.value=ganttDateInputVal(TODAY);
    if(gDays) gDays.value='30';
    render();
    renderGantt();
    applyEntryFromUrl();
  }catch(e){
    console.error('initApp:',e);
    try{ renderGantt(); }catch(e2){ console.error('renderGantt fallback:',e2); }
    const gc=document.getElementById('ganttContainer');
    if(gc&&!gc.innerHTML.trim()){
      gc.innerHTML='<div style="color:#991b1b;padding:24px;text-align:center;font-weight:600;">画面の読み込みに失敗しました。玄関から入り直すか、ページを再読み込みしてください。</div>';
    }
  }
}
function updateKakouMobileLayout(){
  document.body.classList.toggle('kakou-mobile',window.matchMedia('(max-width:900px)').matches);
}
window.addEventListener('resize',updateKakouMobileLayout);
updateKakouMobileLayout();

if(MaishinAuth.isSessionValid()){
  document.body.classList.remove('maishin-auth-pending');
  MaishinAuth.applyHomeLinks();
  initMaishinSideNav();
  initApp();
}
