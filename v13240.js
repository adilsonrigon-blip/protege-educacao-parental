// PROTEGE V13.24.0 - contadores confiáveis do submenu Cadastros
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function badge(id){
  const el=document.getElementById(id);
  if(el){ el.hidden=false; el.style.display='inline-flex'; el.style.visibility='visible'; if(!el.textContent.trim()) el.textContent='0'; }
  return el;
}
async function getDb(){
  for(let i=0;i<12;i++){
    if(window.ProtegeApp?.db) return window.ProtegeApp.db;
    await sleep(250);
  }
  return null;
}
async function refresh(){
  const family=badge('sidebarLeadCount');
  const adolescent=badge('sidebarAdolescentLeadCount');
  const professional=badge('sidebarProfessionalPreCount');
  if(!family&&!adolescent&&!professional)return;
  const db=await getDb();
  if(!db)return;
  try{
    const {data:{session}}=await db.auth.getSession();
    if(!session)return;
    const {data:profile}=await db.from('usuarios_perfis').select('perfil,ativo').eq('user_id',session.user.id).maybeSingle();
    if(profile && (profile.ativo===false || profile.perfil!=='admin')) return;
    const jobs=[];
    if(family) jobs.push((async()=>{const {count,error}=await db.from('familias_interessadas').select('id',{count:'exact',head:true}).eq('status','novo'); if(error)throw error; family.textContent=String(Number(count||0));})());
    if(adolescent) jobs.push((async()=>{const {count,error}=await db.from('adolescentes_interessados').select('id',{count:'exact',head:true}).eq('status','novo'); if(error)throw error; adolescent.textContent=String(Number(count||0));})());
    if(professional) jobs.push((async()=>{const {data,error}=await db.rpc('protege_pre_cadastro_pendentes'); if(error)throw error; professional.textContent=String(Number(data||0));})());
    await Promise.allSettled(jobs);
  }catch(e){ console.warn('Protege: contadores de pendências não puderam ser atualizados.',e); }
}
window.ProtegeRefreshPendingBadges=refresh;
document.addEventListener('DOMContentLoaded',()=>{refresh();setTimeout(refresh,1200);});
window.addEventListener('pageshow',()=>setTimeout(refresh,150));
})();
