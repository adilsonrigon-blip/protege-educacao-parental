console.info("Protege build V13.0.1 - profissionais com acesso");
const ProtegeApp = (() => {
  const config = window.PROTEGE_CONFIG || {};
  const configured = Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && window.supabase?.createClient);
  const db = configured ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const LOCAL_LEADS_KEY = 'protegeFamiliasInteressadas';

  function getLocalLeads() {
    try { return JSON.parse(localStorage.getItem(LOCAL_LEADS_KEY) || '[]'); } catch { return []; }
  }
  function setLocalLeads(items) { localStorage.setItem(LOCAL_LEADS_KEY, JSON.stringify(items)); }
  function uid() { return crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function esc(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function statusLabel(s) { return ({novo:'Novo',em_contato:'Em contato',aprovado:'Aprovado',nao_aprovado:'Não aprovado',convertido:'Convertido'})[s] || s; }
  function formatDate(v) { if (!v) return '—'; return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)); }
  function onlyDigits(v='') { return String(v).replace(/\D/g,''); }

  async function currentSession() {
    if (!configured) return localStorage.getItem('protegeLoggedIn') === 'true' ? { user: { email: 'modo@demonstracao.local' } } : null;
    const { data } = await db.auth.getSession();
    return data.session;
  }

  async function requireAuth() {
    if (!document.body.dataset.requiresAuth) return;
    const session = await currentSession();
    if (!session) window.location.href = 'login.html';
  }

  async function loadLeads() {
    if (!configured) return getLocalLeads().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const { data, error } = await db.from('familias_interessadas').select('*, filhos_interesse(*)').order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function updateLead(id, patch) {
    if (!configured) {
      const items = getLocalLeads();
      const i = items.findIndex(x => x.id === id);
      if (i >= 0) { items[i] = {...items[i], ...patch, updated_at:new Date().toISOString()}; setLocalLeads(items); }
      return;
    }
    const { error } = await db.from('familias_interessadas').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);
    if (error) throw error;
  }

  async function loadFamilies() {
    if (!configured) return [];
    const { data, error } = await db.from('familias').select('*, filhos(*)').order('created_at',{ascending:false});
    if (error) throw error;
    return data || [];
  }

  async function convertLead(id) {
    if (!configured) throw new Error('Supabase não configurado.');
    const { data, error } = await db.rpc('converter_interesse_em_familia',{p_interesse_id:id});
    if (error) throw error;
    return data;
  }

  async function loadProfessionals() {
    if (!configured) return [];
    const { data, error } = await db.from('profissionais').select('*').order('nome',{ascending:true});
    if (error) throw error;
    return data || [];
  }

  async function saveProfessional(payload) {
    if (!configured) throw new Error('Supabase não configurado.');
    const session = await currentSession();
    const body = {...payload, updated_at:new Date().toISOString()};
    if (session?.user && payload.email && session.user.email && payload.email.toLowerCase() === session.user.email.toLowerCase()) body.auth_user_id = session.user.id;
    const { data, error } = await db.from('profissionais').insert(body).select().single();
    if (error) throw error;
    return data;
  }

  async function manageProfessionalAccess(payload) {
    if (!configured) throw new Error('Supabase não configurado.');
    const session = await currentSession();
    if (!session?.access_token) throw new Error('Sessão expirada. Entre novamente.');
    const response = await fetch(`${config.SUPABASE_URL}/functions/v1/administrar-profissional`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': config.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || `Falha ao administrar profissional (${response.status}).`);
    return result;
  }

  async function loadProfessionalsWithAccess() {
    const result = await manageProfessionalAccess({action:'list'});
    return result?.profissionais || [];
  }

  async function createProfessionalWithAccess(payload) {
    return manageProfessionalAccess({action:'create', ...payload});
  }

  async function loadAttendances(familyId=null, limit=100) {
    if (!configured) return [];
    let q = db.from('atendimentos').select('*, profissionais(nome), filhos(nome), familias(responsavel1,responsavel2)').order('data_hora',{ascending:false}).limit(limit);
    if (familyId) q = q.eq('familia_id',familyId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function saveAttendance(payload) {
    if (!configured) throw new Error('Supabase não configurado.');
    const session = await currentSession();
    const body = {...payload, created_by: session?.user?.id || null, updated_at:new Date().toISOString()};
    const { data, error } = await db.from('atendimentos').insert(body).select().single();
    if (error) throw error;
    return data;
  }

  async function loadAttendanceEvolutions(attendanceId) {
    if (!configured) return [];
    const { data, error } = await db.from('atendimento_evolucoes').select('*, profissionais(nome)').eq('atendimento_id',attendanceId).order('created_at',{ascending:true});
    if (error) throw error;
    return data || [];
  }

  async function saveAttendanceEvolution(payload) {
    if (!configured) throw new Error('Supabase não configurado.');
    const session = await currentSession();
    const body = {...payload, created_by:session?.user?.id || null};
    const { data, error } = await db.from('atendimento_evolucoes').insert(body).select('*, profissionais(nome)').single();
    if (error) throw error;
    return data;
  }

  async function loadSchedules(start=null,end=null) {
    if (!configured) return [];
    let q=db.from('agenda').select('*, profissionais(nome), filhos(nome), familias(responsavel1,responsavel2)').order('data_inicio',{ascending:true});
    if(start) q=q.gte('data_inicio',start);
    if(end) q=q.lt('data_inicio',end);
    const {data,error}=await q; if(error) throw error; return data||[];
  }

  async function getSchedule(id) {
    if (!configured) return null;
    const {data,error}=await db.from('agenda').select('*, profissionais(nome), filhos(nome), familias(responsavel1,responsavel2)').eq('id',id).single();
    if(error) throw error; return data;
  }

  async function saveSchedule(payload) {
    if (!configured) throw new Error('Supabase não configurado.');
    const session=await currentSession();
    const body={...payload,created_by:session?.user?.id||null,updated_at:new Date().toISOString()};
    const {data,error}=await db.from('agenda').insert(body).select().single(); if(error) throw error; return data;
  }

  async function updateSchedule(id,patch) {
    if (!configured) throw new Error('Supabase não configurado.');
    const {data,error}=await db.from('agenda').update({...patch,updated_at:new Date().toISOString()}).eq('id',id).select().single(); if(error) throw error; return data;
  }

  async function countNewLeads() {
    try {
      const leads = await loadLeads();
      const n = leads.filter(x=>x.status==='novo').length;
      document.querySelectorAll('#sidebarLeadCount').forEach(el=>el.textContent=n);
      const dash = document.getElementById('dashboardNewLeads'); if (dash) dash.textContent=n;
      return leads;
    } catch (e) {
      console.warn(e);
      return [];
    }
  }

  return {configured,db,esc,statusLabel,formatDate,onlyDigits,uid,getLocalLeads,setLocalLeads,currentSession,requireAuth,loadLeads,updateLead,loadFamilies,convertLead,loadProfessionals,saveProfessional,manageProfessionalAccess,loadProfessionalsWithAccess,createProfessionalWithAccess,loadAttendances,saveAttendance,loadAttendanceEvolutions,saveAttendanceEvolution,loadSchedules,getSchedule,saveSchedule,updateSchedule,countNewLeads};
})();

document.addEventListener('DOMContentLoaded', async () => {
  await ProtegeApp.requireAuth();

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  // LOGIN REAL COM SUPABASE; fallback demonstrativo enquanto o projeto não estiver configurado.
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const message = document.getElementById('loginMessage');
    if (!ProtegeApp.configured) {
      const hint = document.createElement('p');
      hint.className = 'setup-hint';
      hint.innerHTML = '<strong>Modo de configuração:</strong> o Supabase ainda não foi conectado. O login funciona em modo demonstrativo neste navegador.';
      loginForm.before(hint);
    }
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      message.textContent = 'Entrando...';
      try {
        if (!ProtegeApp.configured) {
          localStorage.setItem('protegeLoggedIn','true');
        } else {
          const { error } = await ProtegeApp.db.auth.signInWithPassword({email,password});
          if (error) throw error;
        }
        message.textContent = 'Acesso realizado. Abrindo painel...';
        setTimeout(()=>window.location.href='dashboard.html',350);
      } catch (err) {
        message.textContent = 'Não foi possível entrar. Confira e-mail e senha.';
        console.error(err);
      }
    });
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (ProtegeApp.configured) await ProtegeApp.db.auth.signOut();
    localStorage.removeItem('protegeLoggedIn');
    window.location.href='index.html';
  });

  // CADASTRO PÚBLICO DE INTERESSE
  initInterestForm();

  // DASHBOARD E FILA DE FAMÍLIAS
  if (document.getElementById('recentLeads')) await initDashboardLeads();
  if (document.getElementById('leadsTable')) await initLeadsPage();
  if (document.getElementById('familiesTable')) await initFamiliesPage();
  if (document.getElementById('professionalsTable')) await initProfessionalsPage();
  if (document.getElementById('dashboardAttendances')) await initDashboardCore();
  if (document.getElementById('attendancesTable')) await initAttendancesPage();
  if (document.getElementById('agendaDayList')) await initAgendaPage();
  if (document.body.dataset.requiresAuth) await ProtegeApp.countNewLeads();

  // WIZARD DE ATENDIMENTO
  initAttendanceWizard();
});

function initInterestForm() {
  const form = document.getElementById('interestForm');
  if (!form) return;
  const rows = document.getElementById('interestChildren');
  const add = document.getElementById('addInterestChild');
  const message = document.getElementById('interestMessage');
  const submit = document.getElementById('interestSubmitBtn');

  function updateRemoveButtons() {
    const buttons = rows.querySelectorAll('.remove-child');
    buttons.forEach(btn => btn.disabled = buttons.length === 1);
  }
  add?.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className='child-row';
    row.innerHTML=`<label><span class="mobile-label">Nome do filho(a)</span><input name="childName[]" type="text" required placeholder="Nome"></label><label><span class="mobile-label">Idade</span><input name="childAge[]" type="number" required min="0" max="99" placeholder="Idade"></label><button class="small-btn remove-child" type="button" aria-label="Excluir filho">Excluir</button>`;
    rows.appendChild(row); updateRemoveButtons(); row.querySelector('input')?.focus();
  });
  rows.addEventListener('click',e=>{ const btn=e.target.closest('.remove-child'); if(!btn||btn.disabled)return; btn.closest('.child-row').remove(); updateRemoveButtons(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled=true; submit.textContent='Enviando...'; message.textContent='';
    const fd=new FormData(form);
    const id=ProtegeApp.uid();
    const family={
      id,
      responsavel1:String(fd.get('responsavel1')).trim(), responsavel2:String(fd.get('responsavel2')||'').trim()||null,
      telefone:String(fd.get('telefone')).trim(), email:String(fd.get('email')||'').trim()||null,
      cep:String(fd.get('cep')).trim(), logradouro:String(fd.get('logradouro')).trim(), numero:String(fd.get('numero')).trim(),
      complemento:String(fd.get('complemento')||'').trim()||null, bairro:String(fd.get('bairro')).trim(), cidade:String(fd.get('cidade')).trim(),
      estado:String(fd.get('estado')).trim().toUpperCase(), status:'novo', observacoes:null, origem:'site', consentimento:true,
      created_at:new Date().toISOString(), updated_at:new Date().toISOString()
    };
    const names=fd.getAll('childName[]'), ages=fd.getAll('childAge[]');
    const children=names.map((nome,i)=>({id:ProtegeApp.uid(),familia_interesse_id:id,nome:String(nome).trim(),idade:Number(ages[i]),created_at:new Date().toISOString()}));
    try {
      if (!ProtegeApp.configured) {
        family.filhos_interesse=children;
        const list=ProtegeApp.getLocalLeads(); list.push(family); ProtegeApp.setLocalLeads(list);
        message.textContent='Cadastro salvo com sucesso no modo de teste. Após conectar o Supabase, os novos cadastros ficarão disponíveis para toda a equipe.';
      } else {
        let res=await ProtegeApp.db.from('familias_interessadas').insert(family);
        if(res.error) throw res.error;
        res=await ProtegeApp.db.from('filhos_interesse').insert(children);
        if(res.error) throw res.error;
        message.textContent='Cadastro enviado com sucesso! A equipe Protege entrará em contato com você.';
      }
      form.reset(); rows.innerHTML=`<div class="child-row"><label><span class="mobile-label">Nome do filho(a)</span><input name="childName[]" type="text" required placeholder="Nome"></label><label><span class="mobile-label">Idade</span><input name="childAge[]" type="number" required min="0" max="99" placeholder="Idade"></label><button class="small-btn remove-child" type="button" aria-label="Excluir filho" disabled>Excluir</button></div>`;
      message.scrollIntoView({behavior:'smooth',block:'center'});
    } catch(err) {
      console.error(err); message.textContent='Não foi possível enviar agora. Tente novamente em alguns instantes.';
    } finally { submit.disabled=false; submit.textContent='Enviar cadastro'; updateRemoveButtons(); }
  });
  updateRemoveButtons();
}

async function initDashboardLeads() {
  const box=document.getElementById('recentLeads');
  try {
    const leads=await ProtegeApp.loadLeads();
    const familyMetric=document.getElementById('dashboardFamilies');
    if(familyMetric){ try{ const families=await ProtegeApp.loadFamilies(); familyMetric.textContent=families.length; }catch(e){ familyMetric.textContent='0'; } }
    const recent=leads.slice(0,4);
    box.innerHTML=recent.length?recent.map(x=>`<a class="recent-lead" href="familias-interessadas.html?id=${encodeURIComponent(x.id)}"><div><b>${ProtegeApp.esc(x.responsavel1)}</b><small>${ProtegeApp.esc(x.cidade)}/${ProtegeApp.esc(x.estado)} · ${ProtegeApp.formatDate(x.created_at)}</small></div><span class="status-pill status-${ProtegeApp.esc(x.status)}">${ProtegeApp.statusLabel(x.status)}</span></a>`).join(''):'<div class="empty-state">Nenhum cadastro recebido ainda.</div>';
  } catch(e) { box.innerHTML='<div class="empty-state">Não foi possível carregar os cadastros.</div>'; console.error(e); }
}

async function initLeadsPage() {
  const tbody=document.querySelector('#leadsTable tbody');
  const search=document.getElementById('leadSearch');
  const filter=document.getElementById('leadStatusFilter');
  const dialog=document.getElementById('leadDialog');
  const editForm=document.getElementById('leadEditForm');
  let leads=[]; let active=null;

  async function refresh() {
    try { leads=await ProtegeApp.loadLeads(); render(); metrics(); await ProtegeApp.countNewLeads(); openFromQuery(); }
    catch(e){ tbody.innerHTML='<tr><td colspan="7" class="empty-state">Não foi possível carregar. Confira a conexão com o Supabase e o login.</td></tr>'; console.error(e); }
  }
  function metrics(){
    const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n;};
    set('metricNew',leads.filter(x=>x.status==='novo').length); set('metricContact',leads.filter(x=>x.status==='em_contato').length); set('metricApproved',leads.filter(x=>x.status==='aprovado').length); set('metricTotal',leads.length);
  }
  function childrenOf(x){ return x.filhos_interesse || []; }
  function render(){
    const q=(search.value||'').toLowerCase().trim(), st=filter.value;
    const items=leads.filter(x=>(!st||x.status===st)&&(!q||[x.responsavel1,x.responsavel2,x.telefone,x.email,x.cidade].filter(Boolean).join(' ').toLowerCase().includes(q)));
    tbody.innerHTML=items.length?items.map(x=>`<tr><td>${ProtegeApp.formatDate(x.created_at)}</td><td><b>${ProtegeApp.esc(x.responsavel1)}</b>${x.responsavel2?`<small>${ProtegeApp.esc(x.responsavel2)}</small>`:''}</td><td>${ProtegeApp.esc(x.telefone)}${x.email?`<small>${ProtegeApp.esc(x.email)}</small>`:''}</td><td>${childrenOf(x).length}</td><td>${ProtegeApp.esc(x.cidade)}/${ProtegeApp.esc(x.estado)}</td><td><span class="status-pill status-${ProtegeApp.esc(x.status)}">${ProtegeApp.statusLabel(x.status)}</span></td><td><button class="small-btn view-lead" data-id="${ProtegeApp.esc(x.id)}">Abrir</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty-state">Nenhum cadastro encontrado.</td></tr>';
  }
  function openLead(id){
    active=leads.find(x=>x.id===id); if(!active)return;
    document.getElementById('dialogFamilyName').textContent=active.responsavel1;
    document.getElementById('leadEditStatus').value=active.status;
    document.getElementById('leadNotes').value=active.observacoes||'';
    document.getElementById('leadWhatsapp').href=`https://wa.me/55${ProtegeApp.onlyDigits(active.telefone)}?text=${encodeURIComponent(`Olá, ${active.responsavel1}! Aqui é da equipe Protege Educação Parental. Recebemos seu cadastro de interesse no programa.`)}`;
    const ch=childrenOf(active);
    document.getElementById('leadDetails').innerHTML=`
      <div class="detail-card"><span>Responsáveis</span><b>${ProtegeApp.esc(active.responsavel1)}</b>${active.responsavel2?`<small>${ProtegeApp.esc(active.responsavel2)}</small>`:''}</div>
      <div class="detail-card"><span>Contato</span><b>${ProtegeApp.esc(active.telefone)}</b><small>${ProtegeApp.esc(active.email||'Sem e-mail')}</small></div>
      <div class="detail-card detail-wide"><span>Endereço</span><b>${ProtegeApp.esc(active.logradouro)}, ${ProtegeApp.esc(active.numero)}${active.complemento?' · '+ProtegeApp.esc(active.complemento):''}</b><small>${ProtegeApp.esc(active.bairro)} · ${ProtegeApp.esc(active.cidade)}/${ProtegeApp.esc(active.estado)} · CEP ${ProtegeApp.esc(active.cep)}</small></div>
      <div class="detail-card detail-wide"><span>Filhos</span>${ch.length?ch.map(c=>`<div class="child-chip"><b>${ProtegeApp.esc(c.nome)}</b><small>${ProtegeApp.esc(c.idade)} ano(s)</small></div>`).join(''):'<small>Nenhum filho cadastrado.</small>'}</div>`;
    dialog.showModal();
  }
  function openFromQuery(){ const id=new URLSearchParams(location.search).get('id'); if(id&&leads.some(x=>x.id===id)){openLead(id); history.replaceState({},'',location.pathname);} }
  tbody.addEventListener('click',e=>{const b=e.target.closest('.view-lead');if(b)openLead(b.dataset.id);});
  search.addEventListener('input',render); filter.addEventListener('change',render);
  editForm.addEventListener('submit',async e=>{e.preventDefault();if(!active)return;const msg=document.getElementById('leadDialogMessage');msg.textContent='Salvando...';try{await ProtegeApp.updateLead(active.id,{status:document.getElementById('leadEditStatus').value,observacoes:document.getElementById('leadNotes').value.trim()||null});msg.textContent='Alterações salvas.';await refresh();setTimeout(()=>dialog.close(),450);}catch(err){msg.textContent='Não foi possível salvar.';console.error(err);}});
  document.getElementById('convertLeadBtn').addEventListener('click',async()=>{
    if(!active)return;
    const btn=document.getElementById('convertLeadBtn');
    const msg=document.getElementById('leadDialogMessage');
    if(active.status==='convertido'){ msg.textContent='Esta família já foi convertida.'; return; }
    if(!confirm(`Converter o cadastro de ${active.responsavel1} em família atendida?`)) return;
    btn.disabled=true; msg.textContent='Convertendo família e filhos...';
    try{
      const familyId=await ProtegeApp.convertLead(active.id);
      msg.textContent='Família convertida com sucesso. Abrindo cadastro...';
      await refresh();
      setTimeout(()=>{ window.location.href=`familias.html?id=${encodeURIComponent(familyId)}`; },500);
    }catch(err){
      console.error(err);
      msg.textContent=err?.message?.includes('converter_interesse_em_familia')
        ? 'A função de conversão ainda não existe no banco. Execute o arquivo supabase-v8-conversao.sql no Supabase.'
        : `Não foi possível converter: ${err?.message || 'erro inesperado'}`;
    }finally{ btn.disabled=false; }
  });
  await refresh();
}


async function initFamiliesPage() {
  const tbody=document.querySelector('#familiesTable tbody');
  const search=document.getElementById('familySearch');
  const dialog=document.getElementById('familyDialog');
  let families=[];

  function childrenOf(x){ return x.filhos || []; }
  function render(){
    const q=(search?.value||'').toLowerCase().trim();
    const items=families.filter(x=>!q||[x.responsavel1,x.responsavel2,x.telefone,x.email,x.cidade,...childrenOf(x).map(c=>c.nome)].filter(Boolean).join(' ').toLowerCase().includes(q));
    tbody.innerHTML=items.length?items.map(x=>`<tr>
      <td>${ProtegeApp.formatDate(x.created_at)}</td><td><b>${ProtegeApp.esc(x.responsavel1)}</b>${x.responsavel2?`<small>${ProtegeApp.esc(x.responsavel2)}</small>`:''}</td>
      <td>${ProtegeApp.esc(x.telefone)}${x.email?`<small>${ProtegeApp.esc(x.email)}</small>`:''}</td><td>${childrenOf(x).length}</td>
      <td>${ProtegeApp.esc(x.cidade||'')}/${ProtegeApp.esc(x.estado||'')}</td><td><span class="status-pill status-aprovado">${ProtegeApp.esc(x.status||'ativa')}</span></td>
      <td><button class="small-btn view-family" data-id="${ProtegeApp.esc(x.id)}">Abrir</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty-state">Nenhuma família convertida ainda.</td></tr>';
  }
  async function renderHistory(f){
    const box=document.getElementById('familyHistory');
    box.innerHTML='<div class="empty-state">Carregando histórico...</div>';
    try{
      const items=await ProtegeApp.loadAttendances(f.id,30);
      box.innerHTML=items.length?items.map(a=>`<div class="history-item"><div><b>${ProtegeApp.formatDate(a.data_hora)}</b><small>${ProtegeApp.esc(a.profissionais?.nome||'Profissional não informado')} · ${ProtegeApp.esc(a.tipo_alvo||'família')}${a.filhos?.nome?` · ${ProtegeApp.esc(a.filhos.nome)}`:''}</small></div><span class="status-pill">${ProtegeApp.esc(a.status)}</span></div>`).join(''):'<div class="empty-state">Nenhum atendimento registrado para esta família.</div>';
    }catch(err){console.error(err);box.innerHTML='<div class="empty-state">Histórico indisponível. Execute a migração V9 no Supabase.</div>';}
  }
  async function openFamily(id){
    const f=families.find(x=>x.id===id); if(!f)return;
    document.getElementById('familyDialogName').textContent=f.responsavel1;
    const ch=childrenOf(f);
    document.getElementById('familyDetails').innerHTML=`
      <div class="detail-card"><span>Responsáveis</span><b>${ProtegeApp.esc(f.responsavel1)}</b>${f.responsavel2?`<small>${ProtegeApp.esc(f.responsavel2)}</small>`:''}</div>
      <div class="detail-card"><span>Contato</span><b>${ProtegeApp.esc(f.telefone)}</b><small>${ProtegeApp.esc(f.email||'Sem e-mail')}</small></div>
      <div class="detail-card detail-wide"><span>Endereço</span><b>${ProtegeApp.esc(f.logradouro||'')}, ${ProtegeApp.esc(f.numero||'')}${f.complemento?' · '+ProtegeApp.esc(f.complemento):''}</b><small>${ProtegeApp.esc(f.bairro||'')} · ${ProtegeApp.esc(f.cidade||'')}/${ProtegeApp.esc(f.estado||'')} · CEP ${ProtegeApp.esc(f.cep||'')}</small></div>
      <div class="detail-card detail-wide"><span>Filhos</span>${ch.length?ch.map(c=>`<div class="child-chip"><b>${ProtegeApp.esc(c.nome)}</b><small>${c.idade ?? '—'} ano(s)</small></div>`).join(''):'<small>Nenhum filho cadastrado.</small>'}</div>`;
    document.getElementById('familyWhatsapp').href=`https://wa.me/55${ProtegeApp.onlyDigits(f.telefone)}`;
    document.getElementById('newAttendanceForFamily').href=`atendimento.html?familia=${encodeURIComponent(f.id)}`;
    dialog.showModal(); await renderHistory(f);
  }
  try{
    families=await ProtegeApp.loadFamilies(); document.getElementById('metricFamilies').textContent=families.length; document.getElementById('metricChildren').textContent=families.reduce((n,f)=>n+childrenOf(f).length,0); render();
    const id=new URLSearchParams(location.search).get('id'); if(id && families.some(f=>f.id===id)){ await openFamily(id); history.replaceState({},'',location.pathname); }
  }catch(err){console.error(err);tbody.innerHTML='<tr><td colspan="7" class="empty-state">Não foi possível carregar as famílias.</td></tr>';}
  search?.addEventListener('input',render); tbody.addEventListener('click',async e=>{const b=e.target.closest('.view-family');if(b)await openFamily(b.dataset.id);});
}

async function initProfessionalsPage(){
  const tbody=document.querySelector('#professionalsTable tbody'); const form=document.getElementById('professionalForm'); const msg=document.getElementById('professionalMessage');
  async function refresh(){
    try{
      const items=await ProtegeApp.loadProfessionalsWithAccess();
      tbody.innerHTML=items.length?items.map(p=>`<tr><td><b>${ProtegeApp.esc(p.nome)}</b></td><td>${ProtegeApp.esc(p.email||'—')}</td><td>${ProtegeApp.esc(p.telefone||'—')}</td><td>${ProtegeApp.esc(p.especialidade||'—')}</td><td><span class="access-pill ${p.perfil==='admin'?'access-admin':'access-professional'}">${p.perfil==='admin'?'Administrador':'Profissional'}</span></td><td><span class="status-pill ${p.status==='ativo'?'status-aprovado':'status-nao_aprovado'}">${ProtegeApp.esc(p.status)}</span></td></tr>`).join(''):'<tr><td colspan="6" class="empty-state">Nenhum profissional cadastrado.</td></tr>';
    }catch(err){console.error(err);tbody.innerHTML=`<tr><td colspan="6" class="empty-state">${ProtegeApp.esc(err?.message||'Não foi possível carregar os profissionais.')}</td></tr>`;}
  }
  const passwordInput=document.getElementById('professionalPassword'); const togglePassword=document.getElementById('toggleProfessionalPassword');
  togglePassword?.addEventListener('click',()=>{const showing=passwordInput.type==='text';passwordInput.type=showing?'password':'text';togglePassword.textContent=showing?'Mostrar':'Ocultar';});
  form?.addEventListener('submit',async e=>{
    e.preventDefault(); const fd=new FormData(form); const saveBtn=document.getElementById('saveProfessionalButton');
    const nome=String(fd.get('nome')||'').trim(), email=String(fd.get('email')||'').trim().toLowerCase(), password=String(fd.get('password')||'');
    if(!nome||!email){msg.textContent='Informe nome e e-mail.';return;} if(password.length<8){msg.textContent='A senha deve ter pelo menos 8 caracteres.';return;}
    msg.textContent='Criando profissional e acesso...'; saveBtn.disabled=true;
    try{
      await ProtegeApp.createProfessionalWithAccess({nome,email,password,telefone:String(fd.get('telefone')||'').trim()||null,especialidade:String(fd.get('especialidade')||'').trim()||null,perfil:String(fd.get('perfil')||'profissional'),status:String(fd.get('status')||'ativo')});
      msg.textContent='Profissional e usuário de acesso criados com sucesso.'; form.reset(); document.getElementById('professionalProfile').value='profissional'; await refresh();
    }catch(err){console.error(err);msg.textContent=`Não foi possível criar: ${err?.message||'erro inesperado'}`;}finally{saveBtn.disabled=false;}
  });
  await refresh();
}

async function initDashboardCore(){
  try{
    const [families,attendances,schedules]=await Promise.all([ProtegeApp.loadFamilies(),ProtegeApp.loadAttendances(null,500),ProtegeApp.loadSchedules()]);
    document.getElementById('dashboardFamilies').textContent=families.length;
    document.getElementById('dashboardAttendances').textContent=attendances.length;
    const localKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
    const now=new Date(),todayKey=localKey(now);
    const today=schedules.filter(a=>localKey(a.data_inicio)===todayKey&&a.status!=='cancelado').sort((a,b)=>new Date(a.data_inicio)-new Date(b.data_inicio));
    document.getElementById('dashboardToday').textContent=today.length;
    const future=schedules.filter(a=>new Date(a.data_inicio)>=now&&!['cancelado','realizado'].includes(a.status)).sort((a,b)=>new Date(a.data_inicio)-new Date(b.data_inicio));
    const display=(today.length?today:future).slice(0,4),box=document.getElementById('dashboardAttendanceList');
    box.innerHTML=display.length?display.map(a=>{const fam=a.familias?[a.familias.responsavel1,a.familias.responsavel2].filter(Boolean).join(' / '):'Família';const d=new Date(a.data_inicio);const time=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),day=localKey(a.data_inicio)===todayKey?'Hoje':d.toLocaleDateString('pt-BR');return `<a class="agenda-item" href="agenda.html?data=${localKey(a.data_inicio)}"><strong>${time}</strong><div><b>${ProtegeApp.esc(fam)}</b><small>${ProtegeApp.esc(a.atendimento_para)} · ${day}</small></div><span class="agenda-dot"></span></a>`;}).join(''):'<div class="empty-state">Nenhum compromisso agendado.</div>';
  }catch(err){console.error(err);}
}

async function initAttendancesPage(){
  const tbody=document.querySelector('#attendancesTable tbody');
  const search=document.getElementById('attendanceSearch');
  const statusFilter=document.getElementById('attendanceStatusFilter');
  const dialog=document.getElementById('attendanceDetailDialog');
  const close1=document.getElementById('closeAttendanceDetail');
  const close2=document.getElementById('closeAttendanceDetailBottom');
  const evolutionForm=document.getElementById('attendanceEvolutionForm');
  const evolutionList=document.getElementById('attendanceEvolutionList');
  const evolutionProfessional=document.getElementById('evolutionProfessional');
  const evolutionMessage=document.getElementById('evolutionMessage');
  let items=[],professionals=[],activeAttendance=null;
  const labels={demanda:'Demanda / motivo',objetivo:'Objetivo do encontro',participantes:'Participantes',contexto:'Contexto atual',sessao_relato:'Relato da sessão',sessao_conclusao:'Conclusões / combinados',dinamica_parental:'Perfil e dinâmica parental',estrategia:'Estratégia',orientacao:'Orientação',tecnica:'Técnica',observacoes:'Observações',encaminhamentos:'Encaminhamentos',proximo_passo:'Próximo passo',data_revisao:'Data da revisão',pontos_revisao:'Pontos para revisão',data_falta:'Data da ocorrência',falta_observacoes:'Falta / remarcação / contato',duvidas:'Dúvidas para supervisão',evolucao:'Evolução observada'};
  const stepGroups=[
    ['1 · Demanda',['demanda','objetivo']],['2 · Contexto',['participantes','contexto']],['3 · Sessão',['sessao_relato','sessao_conclusao']],['4 · Dinâmica',['dinamica_parental']],['5 · Ferramenta',['estrategia','orientacao','tecnica']],['6 · Observações',['observacoes']],['7 · Registro',['encaminhamentos','proximo_passo']],['8 · Revisão',['data_revisao','pontos_revisao']],['9 · Faltas',['data_falta','falta_observacoes']],['10 · Supervisão',['duvidas','evolucao']]
  ];
  const stepNames={1:'Demanda',2:'Contexto',3:'Sessão',4:'Dinâmica',5:'Ferramenta',6:'Observações',7:'Registro',8:'Revisão',9:'Faltas',10:'Supervisão'};
  function familyName(a){const f=a.familias||{};return [f.responsavel1,f.responsavel2].filter(Boolean).join(' / ')||'Família';}
  function memberName(a){return a?.dados?.membro_atendido||a?.filhos?.nome||(a.tipo_alvo==='familia'?'Família completa':a.tipo_alvo==='responsaveis'?'Responsável(is)':'—');}
  function statusText(s){return ({realizado:'Realizado',agendado:'Agendado',rascunho:'Rascunho',cancelado:'Cancelado'})[s]||s||'—';}
  function statusClass(s){return s==='realizado'?'status-aprovado':s==='agendado'?'status-em_contato':s==='cancelado'?'status-nao_aprovado':'status-novo';}
  function updateMetrics(){
    document.getElementById('attendanceMetricTotal').textContent=items.length;
    document.getElementById('attendanceMetricDone').textContent=items.filter(x=>x.status==='realizado').length;
    document.getElementById('attendanceMetricScheduled').textContent=items.filter(x=>x.status==='agendado').length;
    document.getElementById('attendanceMetricDraft').textContent=items.filter(x=>x.status==='rascunho').length;
  }
  function filtered(){const q=(search?.value||'').trim().toLowerCase(),st=statusFilter?.value||'';return items.filter(a=>{if(st&&a.status!==st)return false;if(!q)return true;return [familyName(a),memberName(a),a.profissionais?.nome||'',a.status||''].join(' ').toLowerCase().includes(q);});}
  function render(){const rows=filtered();tbody.innerHTML=rows.length?rows.map(a=>`<tr><td>${ProtegeApp.formatDate(a.data_hora)}</td><td><b>${ProtegeApp.esc(familyName(a))}</b></td><td>${ProtegeApp.esc(memberName(a))}</td><td>${ProtegeApp.esc(a.profissionais?.nome||'—')}</td><td><span class="status-pill ${statusClass(a.status)}">${ProtegeApp.esc(statusText(a.status))}</span></td><td><div class="attendance-row-actions"><button class="small-btn view-attendance" data-id="${ProtegeApp.esc(a.id)}">Abrir</button><button class="small-btn add-evolution" data-id="${ProtegeApp.esc(a.id)}">+ Evolução</button></div></td></tr>`).join(''):'<tr><td colspan="6" class="empty-state">Nenhum atendimento encontrado.</td></tr>';}
  function renderEvolutions(evolutions){
    evolutionList.innerHTML=evolutions.length?evolutions.map(ev=>`<article class="evolution-item"><div class="evolution-marker"><span>${Number(ev.etapa)}</span></div><div class="evolution-body"><div class="evolution-meta"><span class="evolution-step-badge">Etapa ${Number(ev.etapa)} · ${ProtegeApp.esc(stepNames[ev.etapa]||'')}</span><time>${ProtegeApp.formatDate(ev.created_at)}</time></div>${ev.titulo?`<h4>${ProtegeApp.esc(ev.titulo)}</h4>`:''}<p>${ProtegeApp.esc(ev.conteudo).replace(/\n/g,'<br>')}</p><small>Registrado por <b>${ProtegeApp.esc(ev.profissionais?.nome||'Profissional não informado')}</b></small></div></article>`).join(''):'<div class="empty-state evolution-empty">Nenhuma evolução acrescentada ainda. O registro inicial permanece preservado acima.</div>';
  }
  async function refreshEvolutions(){
    if(!activeAttendance)return;
    evolutionList.innerHTML='<div class="empty-state">Carregando evoluções...</div>';
    try{renderEvolutions(await ProtegeApp.loadAttendanceEvolutions(activeAttendance.id));}
    catch(err){console.error(err);evolutionList.innerHTML='<div class="empty-state">Não foi possível carregar as evoluções. Confirme se o SQL da V10.1 foi executado.</div>';}
  }
  async function openDetail(id,focusEvolution=false){
    const a=items.find(x=>x.id===id);if(!a)return;activeAttendance=a;
    document.getElementById('attendanceDetailTitle').textContent=memberName(a);
    document.getElementById('attendanceDetailMeta').textContent=`${ProtegeApp.formatDate(a.data_hora)} · ${a.profissionais?.nome||'Profissional não informado'}`;
    document.getElementById('attendanceDetailSummary').innerHTML=`<div class="detail-card"><span>Família</span><b>${ProtegeApp.esc(familyName(a))}</b></div><div class="detail-card"><span>Atendimento para</span><b>${ProtegeApp.esc(memberName(a))}</b></div><div class="detail-card"><span>Profissional</span><b>${ProtegeApp.esc(a.profissionais?.nome||'—')}</b></div><div class="detail-card"><span>Status</span><b>${ProtegeApp.esc(statusText(a.status))}</b></div>`;
    const dados=a.dados||{};
    document.getElementById('attendanceDetailSteps').innerHTML=stepGroups.map(([title,keys])=>{const content=keys.map(k=>{const v=String(dados[k]||'').trim();return v?`<div class="attendance-detail-field"><span>${ProtegeApp.esc(labels[k]||k)}</span><p>${ProtegeApp.esc(v).replace(/\n/g,'<br>')}</p></div>`:''}).join('');return `<section class="attendance-detail-step"><h4>${ProtegeApp.esc(title)}</h4>${content||'<p class="attendance-empty-value">Sem registro nesta etapa.</p>'}</section>`;}).join('');
    document.getElementById('attendanceFamilyLink').href=`familias.html?id=${encodeURIComponent(a.familia_id)}`;
    evolutionForm.reset();evolutionMessage.textContent='';
    const originalProfessional=professionals.find(p=>p.id===a.profissional_id);
    if(originalProfessional)evolutionProfessional.value=originalProfessional.id;
    dialog.showModal();
    await refreshEvolutions();
    if(focusEvolution){setTimeout(()=>{evolutionForm?.scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('evolutionContent')?.focus();},80);}
  }
  try{
    [items,professionals]=await Promise.all([ProtegeApp.loadAttendances(null,500),ProtegeApp.loadProfessionals()]);
    evolutionProfessional.innerHTML='<option value="">Selecione</option>'+professionals.filter(p=>p.status==='ativo').map(p=>`<option value="${ProtegeApp.esc(p.id)}">${ProtegeApp.esc(p.nome)}</option>`).join('');
    updateMetrics();render();
    const openId=new URLSearchParams(location.search).get('id'); if(openId&&items.some(a=>a.id===openId)){await openDetail(openId,new URLSearchParams(location.search).get('evolucao')==='1'); history.replaceState({},'',location.pathname);}
  }catch(err){console.error(err);tbody.innerHTML='<tr><td colspan="6" class="empty-state">Não foi possível carregar os atendimentos.</td></tr>';}
  evolutionForm?.addEventListener('submit',async e=>{
    e.preventDefault();if(!activeAttendance)return;
    const step=Number(document.getElementById('evolutionStep').value),professionalId=evolutionProfessional.value,title=document.getElementById('evolutionTitle').value.trim(),content=document.getElementById('evolutionContent').value.trim(),saveBtn=document.getElementById('saveEvolution');
    evolutionMessage.textContent='';
    if(!professionalId||!content){evolutionMessage.textContent='Selecione o profissional e informe a nova evolução.';return;}
    saveBtn.disabled=true;saveBtn.textContent='Salvando...';
    try{
      await ProtegeApp.saveAttendanceEvolution({atendimento_id:activeAttendance.id,profissional_id:professionalId,etapa:step,titulo:title||null,conteudo:content});
      evolutionForm.reset();evolutionProfessional.value=professionalId;document.getElementById('evolutionStep').value=String(step);
      evolutionMessage.textContent='Evolução acrescentada ao histórico.';
      await refreshEvolutions();
    }catch(err){console.error(err);evolutionMessage.textContent=`Não foi possível salvar: ${err?.message||'erro inesperado'}`;}
    finally{saveBtn.disabled=false;saveBtn.textContent='+ Adicionar evolução';}
  });
  search?.addEventListener('input',render);statusFilter?.addEventListener('change',render);tbody.addEventListener('click',e=>{const view=e.target.closest('.view-attendance');if(view){openDetail(view.dataset.id,false);return;}const evo=e.target.closest('.add-evolution');if(evo)openDetail(evo.dataset.id,true);});close1?.addEventListener('click',()=>dialog.close());close2?.addEventListener('click',()=>dialog.close());dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
}

function formDataToObject(form){
  const fd=new FormData(form),out={};
  for(const [k,v] of fd.entries()){if(k in out)out[k]=Array.isArray(out[k])?[...out[k],v]:[out[k],v];else out[k]=v;}
  return out;
}

async function initAttendanceWizard() {
  const form=document.getElementById('attendanceForm'); if(!form)return;
  let current=1; const total=10; let families=[]; let professionals=[];
  const familySel=document.getElementById('attendanceFamily'),professionalSel=document.getElementById('attendanceProfessional'),targetSel=document.getElementById('attendanceTarget'),dateInput=document.getElementById('attendanceDateTime'),statusSel=document.getElementById('attendanceStatus');
  const panels=[...document.querySelectorAll('.wizard-panel')],steps=[...document.querySelectorAll('.wizard-step')],counter=document.getElementById('stepCounter'),prev=document.getElementById('prevStep'),next=document.getElementById('nextStep'),save=document.getElementById('saveAttendance'),message=document.getElementById('saveMessage');
  function render(){panels.forEach(p=>p.classList.toggle('active',Number(p.dataset.panel)===current));steps.forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===current));counter.textContent=`Passo ${current} de ${total}`;prev.disabled=current===1;prev.style.opacity=current===1?'.45':'1';next.hidden=current===total;save.hidden=current!==total;window.scrollTo({top:0,behavior:'smooth'});}
  function selectedFamily(){return families.find(f=>f.id===familySel.value);}
  function refreshFamily(){
    const f=selectedFamily();
    const ch=f?.filhos||[];
    if(!f){
      targetSel.innerHTML='<option value="">Selecione primeiro uma família</option>';
      document.getElementById('attendanceFamilySummary').innerHTML='Selecione uma família acima.';
      return;
    }
    const members=[];
    members.push(`<option value="familia:${ProtegeApp.esc(f.id)}">Família completa</option>`);
    if(f.responsavel1) members.push(`<option value="responsavel1:${ProtegeApp.esc(f.id)}">${ProtegeApp.esc(f.responsavel1)} · Responsável</option>`);
    if(f.responsavel2) members.push(`<option value="responsavel2:${ProtegeApp.esc(f.id)}">${ProtegeApp.esc(f.responsavel2)} · Responsável</option>`);
    ch.forEach(c=>members.push(`<option value="filho:${ProtegeApp.esc(c.id)}">${ProtegeApp.esc(c.nome)} · Filho(a)${c.idade!=null?' · '+c.idade+' ano(s)':''}</option>`));
    targetSel.innerHTML='<option value="">Selecione quem será atendido</option>'+members.join('');
    document.getElementById('attendanceFamilySummary').innerHTML=`<span>Família selecionada</span><b>${ProtegeApp.esc(f.responsavel1)}${f.responsavel2?' e '+ProtegeApp.esc(f.responsavel2):''}</b><small>${ch.length?ch.map(c=>ProtegeApp.esc(c.nome)).join(', '):'Sem filhos cadastrados'} · ${ProtegeApp.esc(f.cidade||'')}/${ProtegeApp.esc(f.estado||'')}</small>`;
  }
  function selectedTarget(){
    const raw=targetSel.value||'';
    const [kind,id]=raw.split(':');
    const f=selectedFamily();
    if(!f||!kind) return null;
    if(kind==='familia') return {tipo_alvo:'familia',filho_id:null,nome:`Família ${f.responsavel1}${f.responsavel2?' / '+f.responsavel2:''}`};
    if(kind==='responsavel1') return {tipo_alvo:'responsaveis',filho_id:null,nome:f.responsavel1||'Responsável'};
    if(kind==='responsavel2') return {tipo_alvo:'responsaveis',filho_id:null,nome:f.responsavel2||'Responsável'};
    if(kind==='filho') {const c=(f.filhos||[]).find(x=>x.id===id);return {tipo_alvo:'filho',filho_id:id,nome:c?.nome||'Filho(a)'};}
    return null;
  }
  try{
    [families,professionals]=await Promise.all([ProtegeApp.loadFamilies(),ProtegeApp.loadProfessionals()]);
    familySel.innerHTML='<option value="">Selecione a família</option>'+families.map(f=>`<option value="${ProtegeApp.esc(f.id)}">${ProtegeApp.esc(f.responsavel1)}${f.responsavel2?' / '+ProtegeApp.esc(f.responsavel2):''}</option>`).join('');
    professionalSel.innerHTML='<option value="">Selecione o profissional</option>'+professionals.filter(p=>p.status==='ativo').map(p=>`<option value="${ProtegeApp.esc(p.id)}">${ProtegeApp.esc(p.nome)}</option>`).join('');
    const params=new URLSearchParams(location.search),qid=params.get('familia'),agendaId=params.get('agenda');
    if(qid&&families.some(f=>f.id===qid))familySel.value=qid;
    const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());dateInput.value=d.toISOString().slice(0,16);refreshFamily();
    if(agendaId){try{const ag=await ProtegeApp.getSchedule(agendaId);if(ag){familySel.value=ag.familia_id;refreshFamily();professionalSel.value=ag.profissional_id||'';dateInput.value=(()=>{const x=new Date(ag.data_inicio);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,16)})();let tv=ag.tipo_alvo==='familia'?`familia:${ag.familia_id}`:ag.tipo_alvo==='filho'&&ag.filho_id?`filho:${ag.filho_id}`:'';if(ag.tipo_alvo==='responsavel'){const f=selectedFamily();tv=ag.atendimento_para===f?.responsavel2?`responsavel2:${ag.familia_id}`:`responsavel1:${ag.familia_id}`;}targetSel.value=tv;statusSel.value='realizado';document.getElementById('attendanceSetupMessage').innerHTML=`Atendimento iniciado a partir da agenda para <b>${ProtegeApp.esc(ag.atendimento_para)}</b>.`;}}catch(err){console.error(err);}}
    if(!professionals.length)document.getElementById('attendanceSetupMessage').innerHTML='Nenhum profissional cadastrado. <a href="profissionais.html"><b>Cadastre um profissional antes de salvar.</b></a>';
  }catch(err){console.error(err);document.getElementById('attendanceSetupMessage').textContent='Não foi possível carregar famílias/profissionais. Execute a migração V9.';}
  familySel.addEventListener('change',refreshFamily);
  next?.addEventListener('click',()=>{if(current<total){current++;render();}});prev?.addEventListener('click',()=>{if(current>1){current--;render();}});steps.forEach(s=>s.addEventListener('click',()=>{current=Number(s.dataset.step);render();}));
  form.addEventListener('submit',async e=>{e.preventDefault();message.textContent='';if(!familySel.value||!professionalSel.value||!targetSel.value||!dateInput.value){message.textContent='Selecione família, profissional, pessoa atendida e data/hora.';return;}const alvo=selectedTarget();if(!alvo){message.textContent='Selecione quem será atendido.';return;}save.disabled=true;save.textContent='Salvando...';try{const dados=formDataToObject(form);dados.membro_atendido=alvo.nome;dados.atendimento_para=targetSel.value;const row=await ProtegeApp.saveAttendance({familia_id:familySel.value,profissional_id:professionalSel.value,filho_id:alvo.filho_id,tipo_alvo:alvo.tipo_alvo,data_hora:new Date(dateInput.value).toISOString(),status:statusSel.value,etapa_atual:10,dados,observacoes:String(dados.observacoes||'').trim()||null});const agendaId=new URLSearchParams(location.search).get('agenda');if(agendaId)await ProtegeApp.updateSchedule(agendaId,{status:'realizado',atendimento_id:row.id});message.innerHTML=`Atendimento salvo com sucesso para <b>${ProtegeApp.esc(alvo.nome)}</b>. <a href="familias.html?id=${encodeURIComponent(row.familia_id)}"><b>Abrir ficha da família</b></a>.`;message.scrollIntoView({behavior:'smooth'});}catch(err){console.error(err);message.textContent=`Não foi possível salvar: ${err?.message||'erro inesperado'}`;}finally{save.disabled=false;save.textContent='Salvar atendimento';}});
  render();
}


async function initAgendaPage(){
  const dateInput=document.getElementById('agendaDate'),list=document.getElementById('agendaDayList'),professionalFilter=document.getElementById('agendaProfessionalFilter');
  if(!dateInput||!list)return;
  const dialog=document.getElementById('scheduleDialog'),backdrop=document.getElementById('scheduleDialogBackdrop'),form=document.getElementById('scheduleForm');
  const showScheduleModal=()=>{if(backdrop){backdrop.hidden=false;document.body.classList.add('schedule-modal-open');}else if(dialog?.showModal){dialog.showModal();}};
  const closeScheduleModal=()=>{if(backdrop){backdrop.hidden=true;document.body.classList.remove('schedule-modal-open');}else if(dialog?.close){dialog.close();}};
  const familySel=document.getElementById('scheduleFamily'),targetSel=document.getElementById('scheduleTarget'),professionalSel=document.getElementById('scheduleProfessional');
  let items=[],families=[],professionals=[],editingId=null;
  const localKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  const toInputDate=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10);};
  const toLocalDT=v=>{const x=new Date(v);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,16);};
  const qs=new URLSearchParams(location.search); dateInput.value=qs.get('data')||toInputDate(new Date());
  const hourOptions=Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,'0')}">${String(i).padStart(2,'0')}</option>`).join('');
  const minuteOptions=Array.from({length:12},(_,i)=>String(i*5).padStart(2,'0')).map(m=>`<option value="${m}">${m}</option>`).join('');
  ['scheduleStartHour','scheduleEndHour'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=hourOptions;});
  ['scheduleStartMinute','scheduleEndMinute'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=minuteOptions;});
  function setDateTimeParts(prefix,value){const d=new Date(value);if(Number.isNaN(d.getTime()))return;document.getElementById(prefix+'Date').value=toInputDate(d);document.getElementById(prefix+'Hour').value=String(d.getHours()).padStart(2,'0');const rounded=String(Math.round(d.getMinutes()/5)*5%60).padStart(2,'0');document.getElementById(prefix+'Minute').value=rounded;}
  function composeDateTime(prefix,required=false){const date=document.getElementById(prefix+'Date').value,hour=document.getElementById(prefix+'Hour').value,minute=document.getElementById(prefix+'Minute').value;if(!date){return required?'':null;}return `${date}T${hour||'00'}:${minute||'00'}`;}
  function syncHiddenDateTimes(){document.getElementById('scheduleStart').value=composeDateTime('scheduleStart',true)||'';document.getElementById('scheduleEnd').value=composeDateTime('scheduleEnd')||'';}
  function autoFillScheduleEnd(){const start=composeDateTime('scheduleStart',true);if(!start)return;const d=new Date(start);if(Number.isNaN(d.getTime()))return;d.setHours(d.getHours()+1);setDateTimeParts('scheduleEnd',d);syncHiddenDateTimes();}
  function familyName(a){return a.familias?[a.familias.responsavel1,a.familias.responsavel2].filter(Boolean).join(' / '):'—';}
  function statusText(s){return ({agendado:'Agendado',confirmado:'Confirmado',realizado:'Realizado',cancelado:'Cancelado',falta:'Falta'})[s]||s||'—';}
  function statusClass(s){return ({realizado:'status-aprovado',confirmado:'status-aprovado',agendado:'status-em_contato',cancelado:'status-nao_aprovado',falta:'status-nao_aprovado'})[s]||'';}
  function typeText(s){return ({atendimento:'Atendimento',retorno:'Retorno',reuniao:'Reunião',supervisao:'Supervisão',outro:'Outro'})[s]||s;}
  function selectedFamily(){return families.find(f=>f.id===familySel.value);}
  function targetOptions(f){if(!f)return '<option value="">Selecione a família</option>';const out=[`<option value="familia:${ProtegeApp.esc(f.id)}">Família completa</option>`];if(f.responsavel1)out.push(`<option value="responsavel1:${ProtegeApp.esc(f.id)}">${ProtegeApp.esc(f.responsavel1)} · Responsável</option>`);if(f.responsavel2)out.push(`<option value="responsavel2:${ProtegeApp.esc(f.id)}">${ProtegeApp.esc(f.responsavel2)} · Responsável</option>`);(f.filhos||[]).forEach(c=>out.push(`<option value="filho:${ProtegeApp.esc(c.id)}">${ProtegeApp.esc(c.nome)} · Filho(a)${c.idade!=null?' · '+c.idade+' ano(s)':''}</option>`));return '<option value="">Selecione quem será atendido</option>'+out.join('');}
  function selectedTarget(){const f=selectedFamily(),[kind,id]=(targetSel.value||'').split(':');if(!f||!kind)return null;if(kind==='familia')return {tipo_alvo:'familia',filho_id:null,nome:'Família completa'};if(kind==='responsavel1')return {tipo_alvo:'responsavel',filho_id:null,nome:f.responsavel1};if(kind==='responsavel2')return {tipo_alvo:'responsavel',filho_id:null,nome:f.responsavel2};if(kind==='filho'){const c=(f.filhos||[]).find(x=>x.id===id);return {tipo_alvo:'filho',filho_id:id,nome:c?.nome||'Filho(a)'};}return null;}
  function refreshTarget(){targetSel.innerHTML=targetOptions(selectedFamily());}
  function selected(){return items.filter(a=>localKey(a.data_inicio)===dateInput.value&&(!professionalFilter.value||a.profissional_id===professionalFilter.value)).sort((a,b)=>new Date(a.data_inicio)-new Date(b.data_inicio));}
  function render(){const rows=selected(),dayDate=new Date(dateInput.value+'T12:00:00');document.getElementById('agendaDayTitle').textContent=dayDate.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});document.getElementById('agendaMetricDay').textContent=rows.length;document.getElementById('agendaMetricScheduled').textContent=rows.filter(x=>['agendado','confirmado'].includes(x.status)).length;document.getElementById('agendaMetricDone').textContent=rows.filter(x=>x.status==='realizado').length;document.getElementById('agendaMetricMissed').textContent=rows.filter(x=>x.status==='falta').length;list.innerHTML=rows.length?rows.map(a=>{const d=new Date(a.data_inicio),time=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});let actions=`<a class="small-btn" href="familias.html?id=${encodeURIComponent(a.familia_id)}">Família</a>`;if(a.atendimento_id)actions+=`<a class="small-btn" href="atendimentos.html?id=${encodeURIComponent(a.atendimento_id)}">Abrir atendimento</a>`;else if(!['cancelado','falta','realizado'].includes(a.status))actions+=`<a class="small-btn agenda-action-success" href="atendimento.html?agenda=${encodeURIComponent(a.id)}">Iniciar atendimento</a>`;actions+=`<button class="small-btn edit-schedule" data-id="${ProtegeApp.esc(a.id)}">Remarcar / editar</button>`;if(a.status==='agendado')actions+=`<button class="small-btn schedule-status" data-id="${ProtegeApp.esc(a.id)}" data-status="confirmado">Confirmar</button>`;if(!['realizado','cancelado'].includes(a.status))actions+=`<button class="small-btn schedule-status" data-id="${ProtegeApp.esc(a.id)}" data-status="falta">Falta</button><button class="small-btn agenda-action-danger schedule-status" data-id="${ProtegeApp.esc(a.id)}" data-status="cancelado">Cancelar</button>`;return `<article class="agenda-card" data-status="${ProtegeApp.esc(a.status)}"><div class="agenda-time"><strong>${time}</strong><span>${ProtegeApp.esc(typeText(a.tipo))}</span></div><div class="agenda-card-main"><div><span class="section-label">${ProtegeApp.esc(a.atendimento_para)}</span><h3>${ProtegeApp.esc(familyName(a))}</h3><p>${ProtegeApp.esc(a.profissionais?.nome||'Profissional não informado')}</p>${a.observacoes?`<p class="agenda-notes">${ProtegeApp.esc(a.observacoes)}</p>`:''}</div><span class="status-pill ${statusClass(a.status)}">${ProtegeApp.esc(statusText(a.status))}</span></div><div class="agenda-card-actions">${actions}</div></article>`;}).join(''):'<div class="empty-state agenda-empty">Nenhum compromisso nesta data.</div>';}
  function shift(days){const d=new Date(dateInput.value+'T12:00:00');d.setDate(d.getDate()+days);dateInput.value=toInputDate(d);render();}
  async function reload(){items=await ProtegeApp.loadSchedules();render();}
  function openNew(){editingId=null;form.reset();document.getElementById('scheduleId').value='';document.getElementById('scheduleDialogTitle').textContent='Novo agendamento';familySel.value='';refreshTarget();professionalSel.value='';const d=new Date(dateInput.value+'T09:00:00');setDateTimeParts('scheduleStart',d);const e=new Date(d.getTime()+60*60*1000);setDateTimeParts('scheduleEnd',e);syncHiddenDateTimes();document.getElementById('scheduleStatus').value='agendado';document.getElementById('scheduleMessage').textContent='';showScheduleModal();}
  async function openEdit(id){const a=items.find(x=>x.id===id)||await ProtegeApp.getSchedule(id);editingId=id;document.getElementById('scheduleId').value=id;document.getElementById('scheduleDialogTitle').textContent='Editar / remarcar';familySel.value=a.familia_id;refreshTarget();let val=a.tipo_alvo==='familia'?`familia:${a.familia_id}`:a.tipo_alvo==='filho'&&a.filho_id?`filho:${a.filho_id}`:'';if(a.tipo_alvo==='responsavel'){const f=selectedFamily();if(a.atendimento_para===f?.responsavel2)val=`responsavel2:${a.familia_id}`;else val=`responsavel1:${a.familia_id}`;}targetSel.value=val;professionalSel.value=a.profissional_id||'';document.getElementById('scheduleType').value=a.tipo;setDateTimeParts('scheduleStart',a.data_inicio);if(a.data_fim){setDateTimeParts('scheduleEnd',a.data_fim);}else{document.getElementById('scheduleEndDate').value='';}syncHiddenDateTimes();document.getElementById('scheduleStatus').value=a.status;document.getElementById('scheduleNotes').value=a.observacoes||'';document.getElementById('scheduleMessage').textContent='';showScheduleModal();}
  async function runQuery(){const s=document.getElementById('agendaQueryStart').value,e=document.getElementById('agendaQueryEnd').value,st=document.getElementById('agendaQueryStatus').value,q=document.getElementById('agendaQuerySearch').value.trim().toLowerCase();let rows=items.filter(a=>(!s||localKey(a.data_inicio)>=s)&&(!e||localKey(a.data_inicio)<=e)&&(!st||a.status===st));if(q)rows=rows.filter(a=>[familyName(a),a.atendimento_para,a.profissionais?.nome||'',a.tipo].join(' ').toLowerCase().includes(q));rows.sort((a,b)=>new Date(a.data_inicio)-new Date(b.data_inicio));document.getElementById('agendaQueryRows').innerHTML=rows.length?rows.map(a=>`<tr><td>${ProtegeApp.formatDate(a.data_inicio)}</td><td><b>${ProtegeApp.esc(familyName(a))}</b></td><td>${ProtegeApp.esc(a.atendimento_para)}</td><td>${ProtegeApp.esc(a.profissionais?.nome||'—')}</td><td>${ProtegeApp.esc(typeText(a.tipo))}</td><td><span class="status-pill ${statusClass(a.status)}">${ProtegeApp.esc(statusText(a.status))}</span></td><td><button class="small-btn edit-schedule" data-id="${ProtegeApp.esc(a.id)}">Abrir</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty-state">Nenhum compromisso encontrado.</td></tr>';}
  try{[items,families,professionals]=await Promise.all([ProtegeApp.loadSchedules(),ProtegeApp.loadFamilies(),ProtegeApp.loadProfessionals()]);professionalFilter.innerHTML='<option value="">Todos os profissionais</option>'+professionals.filter(p=>p.status==='ativo').map(p=>`<option value="${ProtegeApp.esc(p.id)}">${ProtegeApp.esc(p.nome)}</option>`).join('');professionalSel.innerHTML='<option value="">Selecione o profissional</option>'+professionals.filter(p=>p.status==='ativo').map(p=>`<option value="${ProtegeApp.esc(p.id)}">${ProtegeApp.esc(p.nome)}</option>`).join('');familySel.innerHTML='<option value="">Selecione a família</option>'+families.map(f=>`<option value="${ProtegeApp.esc(f.id)}">${ProtegeApp.esc([f.responsavel1,f.responsavel2].filter(Boolean).join(' / '))}</option>`).join('');const today=toInputDate(new Date());document.getElementById('agendaQueryStart').value=today;const future=new Date();future.setDate(future.getDate()+30);document.getElementById('agendaQueryEnd').value=toInputDate(future);render();}catch(err){console.error(err);list.innerHTML='<div class="empty-state">Não foi possível carregar a agenda. Execute o SQL da V12 no Supabase.</div>';}
  familySel.addEventListener('change',refreshTarget);dateInput.addEventListener('change',render);professionalFilter.addEventListener('change',render);document.getElementById('agendaPrevDay')?.addEventListener('click',()=>shift(-1));document.getElementById('agendaNextDay')?.addEventListener('click',()=>shift(1));document.getElementById('agendaToday')?.addEventListener('click',()=>{dateInput.value=toInputDate(new Date());render();});document.getElementById('openScheduleDialog')?.addEventListener('click',openNew);document.getElementById('closeScheduleDialog')?.addEventListener('click',()=>closeScheduleModal());document.getElementById('cancelScheduleDialog')?.addEventListener('click',()=>closeScheduleModal());document.getElementById('agendaQueryButton')?.addEventListener('click',runQuery);backdrop?.addEventListener('click',e=>{if(e.target===backdrop)closeScheduleModal();});
  document.addEventListener('click',async e=>{const edit=e.target.closest('.edit-schedule');if(edit){await openEdit(edit.dataset.id);return;}const st=e.target.closest('.schedule-status');if(st){try{await ProtegeApp.updateSchedule(st.dataset.id,{status:st.dataset.status});await reload();}catch(err){alert('Não foi possível atualizar: '+(err?.message||'erro'));}}});
  ['scheduleStartDate','scheduleStartHour','scheduleStartMinute'].forEach(id=>document.getElementById(id)?.addEventListener('change',autoFillScheduleEnd));
  form.addEventListener('submit',async e=>{e.preventDefault();const t=selectedTarget(),msg=document.getElementById('scheduleMessage');if(!familySel.value||!professionalSel.value||!t){msg.textContent='Preencha família, pessoa atendida e profissional.';return;}syncHiddenDateTimes();const start=document.getElementById('scheduleStart').value,end=document.getElementById('scheduleEnd').value;if(!start){msg.textContent='Informe data e hora de início.';return;}if(end&&new Date(end)<=new Date(start)){msg.textContent='O horário de término deve ser posterior ao início.';return;}const body={familia_id:familySel.value,filho_id:t.filho_id,profissional_id:professionalSel.value,atendimento_para:t.nome,tipo_alvo:t.tipo_alvo,tipo:document.getElementById('scheduleType').value,data_inicio:new Date(start).toISOString(),data_fim:end?new Date(end).toISOString():null,status:document.getElementById('scheduleStatus').value,observacoes:document.getElementById('scheduleNotes').value.trim()||null};try{document.getElementById('saveScheduleButton').disabled=true;if(editingId)await ProtegeApp.updateSchedule(editingId,body);else await ProtegeApp.saveSchedule(body);msg.textContent='Agendamento salvo com sucesso.';await reload();setTimeout(()=>closeScheduleModal(),350);}catch(err){console.error(err);msg.textContent='Não foi possível salvar: '+(err?.message||'erro');}finally{document.getElementById('saveScheduleButton').disabled=false;}});
}

