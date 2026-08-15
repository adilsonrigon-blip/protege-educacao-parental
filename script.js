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

  return {configured,db,esc,statusLabel,formatDate,onlyDigits,uid,getLocalLeads,setLocalLeads,currentSession,requireAuth,loadLeads,updateLead,countNewLeads};
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
  document.getElementById('convertLeadBtn').addEventListener('click',async()=>{if(!active)return;document.getElementById('leadEditStatus').value='convertido';document.getElementById('leadDialogMessage').textContent='Nesta primeira etapa, a conversão marca o cadastro como convertido. O cadastro completo de famílias será conectado na próxima versão.';});
  await refresh();
}

function initAttendanceWizard() {
  const form=document.getElementById('attendanceForm'); if(!form)return;
  let current=1; const total=10;
  const panels=[...document.querySelectorAll('.wizard-panel')],steps=[...document.querySelectorAll('.wizard-step')];
  const counter=document.getElementById('stepCounter'),prev=document.getElementById('prevStep'),next=document.getElementById('nextStep'),save=document.getElementById('saveAttendance'),message=document.getElementById('saveMessage');
  function render(){panels.forEach(p=>p.classList.toggle('active',Number(p.dataset.panel)===current));steps.forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===current));counter.textContent=`Passo ${current} de ${total}`;prev.disabled=current===1;prev.style.opacity=current===1?'.45':'1';next.hidden=current===total;save.hidden=current!==total;window.scrollTo({top:0,behavior:'smooth'});}
  next?.addEventListener('click',()=>{if(current<total){current++;render();}}); prev?.addEventListener('click',()=>{if(current>1){current--;render();}}); steps.forEach(s=>s.addEventListener('click',()=>{current=Number(s.dataset.step);render();}));
  document.getElementById('addChild')?.addEventListener('click',()=>{const tbody=document.querySelector('#childrenTable tbody');if(tbody.children.length>=7)return alert('É possível cadastrar até 7 filhos.');const tr=document.createElement('tr');tr.innerHTML=`<td><input name="filho_nome[]"></td><td><select name="filho_sexo[]"><option value="">Selecione</option><option>Feminino</option><option>Masculino</option><option>Outro</option></select></td><td><input name="filho_idade[]" type="number" min="0" max="100"></td><td><button type="button" class="small-btn remove-row">Excluir</button></td>`;tbody.appendChild(tr);});
  document.getElementById('addSession')?.addEventListener('click',()=>{const tbody=document.querySelector('#sessionsTable tbody'),n=tbody.children.length+1,tr=document.createElement('tr');tr.innerHTML=`<td>${n}</td><td><input name="sessao_profissional[]"></td><td><input name="sessao_texto[]"></td><td><input name="sessao_observacoes[]"></td><td><input name="sessao_conclusao[]"></td>`;tbody.appendChild(tr);});
  form.addEventListener('click',e=>{if(e.target.classList.contains('remove-row'))e.target.closest('tr').remove();});
  form.addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());localStorage.setItem('ultimoAtendimentoProtege',JSON.stringify(data));message.textContent='Atendimento salvo no protótipo. A persistência dos atendimentos será conectada ao banco na etapa seguinte.';message.scrollIntoView({behavior:'smooth'});});
  render();
}
