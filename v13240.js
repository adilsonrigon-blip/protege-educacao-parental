// PROTEGE V13.24.28 — contadores globais inicializados com o perfil Admin
(function(){
'use strict';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let running=false;

function badge(id){
  const el=document.getElementById(id);
  if(el){el.hidden=false;el.style.display='inline-flex';el.style.visibility='visible';}
  return el;
}
function ensureCadastroAlert(){
  const summary=document.querySelector('.sidebar-group > summary');
  if(!summary)return null;
  let el=document.getElementById('sidebarCadastroAlert');
  if(!el){
    el=document.createElement('span');
    el.id='sidebarCadastroAlert';
    el.className='cadastro-alert-badge';
    el.hidden=true;
    el.setAttribute('aria-label','Cadastros pendentes');
    summary.appendChild(el);
  }
  return el;
}
async function getDb(){
  for(let i=0;i<20;i++){
    if(window.ProtegeApp?.db)return window.ProtegeApp.db;
    await sleep(150);
  }
  return null;
}
function setBadge(el,n){if(el){el.textContent=String(Number(n||0));el.hidden=false;}}
function updateAlert(total){
  const alert=ensureCadastroAlert();
  if(!alert)return;
  alert.textContent=String(total);
  alert.hidden=!(total>0);
  document.querySelector('.sidebar-group')?.classList.toggle('has-pending',total>0);
}
async function refresh(){
  if(running)return;
  running=true;
  try{
    const db=await getDb(); if(!db)return;
    const {data:{session}}=await db.auth.getSession(); if(!session)return;
    const {data:profile,error:profileError}=await db.from('usuarios_perfis').select('perfil,ativo').eq('user_id',session.user.id).maybeSingle();
    if(profileError)throw profileError;
    if(profile?.perfil!=='admin'||profile?.ativo===false)return;

    const family=badge('sidebarLeadCount');
    const adolescent=badge('sidebarAdolescentLeadCount');
    const professional=badge('sidebarProfessionalPreCount');

    // Famílias e adolescentes: COUNT direto. Profissionais: COUNT server-side pela
    // função administrativa, pois é a mesma fonte autorizada que a tela de pré-cadastro usa.
    const [fr,ar,pr]=await Promise.allSettled([
      db.from('familias_interessadas').select('id',{count:'exact',head:true}).eq('status','novo'),
      db.from('adolescentes_interessados').select('id',{count:'exact',head:true}).eq('status','novo'),
      db.functions.invoke('administrar-profissional',{body:{action:'pending-pre-count'}})
    ]);
    let counts=[0,0,0], valid=[false,false,false];

    if(fr.status==='fulfilled'&&!fr.value.error){counts[0]=Number(fr.value.count||0);valid[0]=true;setBadge(family,counts[0]);}
    else console.error('[PROTEGE] Falha COUNT famílias:',fr.status==='rejected'?fr.reason:fr.value?.error);

    if(ar.status==='fulfilled'&&!ar.value.error){counts[1]=Number(ar.value.count||0);valid[1]=true;setBadge(adolescent,counts[1]);}
    else console.error('[PROTEGE] Falha COUNT adolescentes:',ar.status==='rejected'?ar.reason:ar.value?.error);

    if(pr.status==='fulfilled'&&!pr.value.error&&!pr.value.data?.error){
      counts[2]=Number(pr.value.data?.count||0);valid[2]=true;setBadge(professional,counts[2]);
    } else console.error('[PROTEGE] Falha COUNT profissionais:',pr.status==='rejected'?pr.reason:(pr.value?.error||pr.value?.data?.error));

    if(valid.every(Boolean))updateAlert(counts.reduce((a,b)=>a+b,0));
    const dash=document.querySelector('[data-metric="pre_cadastros_pendentes"]');
    if(dash&&valid[2])dash.textContent=String(counts[2]);
  }catch(e){console.error('[PROTEGE] Falha ao atualizar pendências do Admin:',e);}
  finally{running=false;}
}
window.ProtegeRefreshPendingBadges=refresh;

// A carga principal acontece quando o perfil Admin termina de ser identificado.
document.addEventListener('protege:admin-ready',refresh);
// Também cobre ordem inversa de scripts e todo refresh/F5.
document.addEventListener('DOMContentLoaded',()=>{if(window.PROTEGE_ADMIN_READY)refresh();setTimeout(refresh,700);});
window.addEventListener('pageshow',refresh);
})();
