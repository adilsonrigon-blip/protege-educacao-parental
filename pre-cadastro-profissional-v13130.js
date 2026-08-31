(function () {
  'use strict';

  function resolveClient() {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.auth && supabaseClient?.from) return supabaseClient; } catch (_) {}
    try { if (typeof protegeSupabase !== 'undefined' && protegeSupabase?.auth && protegeSupabase?.from) return protegeSupabase; } catch (_) {}
    if (window.supabaseClient?.auth && window.supabaseClient?.from) return window.supabaseClient;
    let url = null; let key = null;
    try { if (typeof SUPABASE_URL !== 'undefined') url = SUPABASE_URL; } catch (_) {}
    try { if (typeof SUPABASE_ANON_KEY !== 'undefined') key = SUPABASE_ANON_KEY; } catch (_) {}
    url = url || window.SUPABASE_URL || window.PROTEGE_SUPABASE_URL;
    key = key || window.SUPABASE_ANON_KEY || window.PROTEGE_SUPABASE_ANON_KEY;
    if (url && key && window.supabase?.createClient) return window.supabase.createClient(url, key);
    throw new Error('Configuração do Supabase não encontrada.');
  }

  function escapeHtml(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function formatDate(v) { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR'); }
  function statusLabel(v) { return ({pendente:'Pendente',em_analise:'Em análise',aprovado:'Aprovado',recusado:'Recusado'})[v] || v; }

  const publicForm = document.getElementById('professionalInterestForm');
  if (publicForm) {
    const cpfInput = document.getElementById('professionalCpf');
    const cpfError = document.getElementById('cpfError');
    const phoneInput = document.getElementById('professionalPhone');
    const phoneError = document.getElementById('celularError');
    const cepInput = document.getElementById('professionalCep');
    const cepStatus = document.getElementById('cepStatus');
    const streetInput = document.getElementById('professionalStreet');
    const neighborhoodInput = document.getElementById('professionalNeighborhood');
    const cityInput = document.getElementById('professionalCity');
    const stateInput = document.getElementById('professionalState');
    let cepController = null;
    function setCepStatus(text,kind) { if (!cepStatus) return; cepStatus.textContent=text||''; cepStatus.className='cep-status'+(kind?' is-'+kind:''); }
    function markAuto(el,value) { if (!el || !value) return; el.value=value; el.classList.add('address-auto-filled'); }
    async function resolveCep() {
      if (!cepInput || !window.ProtegeCep) return true;
      cepInput.value=window.ProtegeCep.formatarCep(cepInput.value);
      if (!cepInput.value) { setCepStatus('', ''); return false; }
      if (!window.ProtegeCep.validarCep(cepInput.value)) { setCepStatus('CEP inválido. Informe 8 números.','error'); return false; }
      cepController?.abort(); cepController=new AbortController(); setCepStatus('Consultando CEP...','loading');
      try { const a=await window.ProtegeCep.consultarCep(cepInput.value,cepController.signal); markAuto(streetInput,a.logradouro); markAuto(neighborhoodInput,a.bairro); markAuto(cityInput,a.cidade); markAuto(stateInput,a.estado); setCepStatus('Endereço localizado. Confira e informe o número.','ok'); document.getElementById('professionalAddressNumber')?.focus(); return true; }
      catch(err) { if(err?.name==='AbortError') return false; setCepStatus(err?.message||'Não foi possível consultar o CEP.','error'); return false; }
    }
    const msg = document.getElementById('professionalInterestMessage');
    const submit = document.getElementById('professionalInterestSubmit');
    const success = document.getElementById('professionalInterestSuccess');
    const passwordInput = document.getElementById('professionalPassword');
    const passwordConfirmInput = document.getElementById('professionalPasswordConfirm');
    const passwordMatchError = document.getElementById('passwordMatchError');
    document.querySelectorAll('[data-toggle-password]').forEach(btn => btn.addEventListener('click', () => {
      const input=document.getElementById(btn.dataset.togglePassword); if(!input)return; const showing=input.type==='text'; input.type=showing?'password':'text'; btn.textContent=showing?'Mostrar':'Ocultar'; btn.setAttribute('aria-label', showing?'Mostrar senha':'Ocultar senha');
    }));
    [passwordInput,passwordConfirmInput].forEach(el=>el?.addEventListener('input',()=>{ if(passwordMatchError) passwordMatchError.hidden=true; }));
    cpfInput.addEventListener('input', () => { cpfInput.value = window.ProtegeCpf.formatarCpf(cpfInput.value); cpfError.hidden = true; });
    cpfInput.addEventListener('blur', () => { if (cpfInput.value && !window.ProtegeCpf.validarCpf(cpfInput.value)) { cpfError.textContent = 'CPF inválido. Confira os números informados.'; cpfError.hidden = false; } });
    phoneInput.addEventListener('input', () => { phoneInput.value = window.ProtegeCelular.formatarCelular(phoneInput.value); phoneError.hidden = true; });
    phoneInput.addEventListener('blur', () => { if (phoneInput.value && !window.ProtegeCelular.validarCelular(phoneInput.value)) { phoneError.textContent = 'Celular inválido. Informe DDD válido e número no formato (11) 99999-9999.'; phoneError.hidden = false; } });
    if (cepInput) { cepInput.addEventListener('input', () => { cepInput.value=window.ProtegeCep.formatarCep(cepInput.value); setCepStatus('', ''); }); cepInput.addEventListener('blur', resolveCep); }
    publicForm.addEventListener('submit', async (ev) => {
      ev.preventDefault(); msg.textContent = '';
      if (!publicForm.reportValidity()) return;
      if (!window.ProtegeCpf.validarCpf(cpfInput.value)) { cpfError.textContent = 'CPF inválido. Confira os números informados.'; cpfError.hidden = false; cpfInput.focus(); return; }
      if (!window.ProtegeCelular.validarCelular(phoneInput.value)) { phoneError.textContent = 'Celular inválido. Informe DDD válido e número no formato (11) 99999-9999.'; phoneError.hidden = false; phoneInput.focus(); return; }
      if (!passwordInput || passwordInput.value.length < 8) { msg.textContent = 'Crie uma senha com pelo menos 8 caracteres.'; passwordInput?.focus(); return; }
      if (passwordInput.value !== passwordConfirmInput?.value) { if(passwordMatchError) passwordMatchError.hidden=false; passwordConfirmInput?.focus(); return; }
      if (!window.ProtegeCep?.validarCep(cepInput?.value)) { setCepStatus('CEP inválido. Informe um CEP válido.','error'); cepInput?.focus(); return; }
      const fd = new FormData(publicForm);
      const estado = String(fd.get('estado') || '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(estado)) { msg.textContent = 'Informe a UF com duas letras, por exemplo SP.'; return; }
      submit.disabled = true; submit.textContent = 'Enviando...';
      try {
        const client = resolveClient();
        const body = {
          nome: String(fd.get('nome') || '').trim(), email: String(fd.get('email') || '').trim().toLowerCase(), cpf: window.ProtegeCpf.somenteDigitos(fd.get('cpf')),
          data_nascimento: fd.get('data_nascimento') || null, cep: window.ProtegeCep.somenteDigitos(fd.get('cep')), logradouro: String(fd.get('logradouro') || '').trim(), numero: String(fd.get('numero') || '').trim(), complemento: String(fd.get('complemento') || '').trim(), bairro: String(fd.get('bairro') || '').trim(), cidade: String(fd.get('cidade') || '').trim(), estado, celular: window.ProtegeCelular.formatarCelular(fd.get('celular')),
          especialidade: String(fd.get('especialidade') || '').trim(), formacao_origem: String(fd.get('formacao_origem') || '').trim(), formacao_educacao_parental: String(fd.get('formacao_educacao_parental') || ''),
          como_conheceu: String(fd.get('como_conheceu') || ''), motivacao: String(fd.get('motivacao') || '').trim(), consentimento_lgpd: fd.get('consentimento_lgpd') === 'on', senha: passwordInput.value
        };
        const { data, error } = await client.functions.invoke('pre-cadastrar-profissional', { body });
        if (error) throw error;
        if (data?.ok === false || data?.error) throw new Error(data?.message || data?.error || 'Não foi possível enviar o pré-cadastro.');
        publicForm.reset(); cpfError.hidden = true; phoneError.hidden = true; setCepStatus('', ''); [streetInput,neighborhoodInput,cityInput,stateInput].forEach(el=>el?.classList.remove('address-auto-filled')); publicForm.hidden = true; success.hidden = false;
      } catch (err) { msg.textContent = err?.message || 'Não foi possível enviar o pré-cadastro. Tente novamente.'; }
      finally { submit.disabled = false; submit.textContent = 'Enviar pré-cadastro'; }
    });
  }

  const cards = document.getElementById('preCards');
  if (!cards) return;
  let client; let rows = []; let current = null; let page=1; const pageSize=24; let total=0; let debounceTimer=null;
  const listMsg = document.getElementById('preListMessage'); const search = document.getElementById('preSearch'); const statusFilter = document.getElementById('preStatusFilter'); const pager=document.getElementById('prePagination');
  const dialog = document.getElementById('preReviewDialog'); const reviewMsg = document.getElementById('preReviewMessage'); const notes = document.getElementById('preAdminNotes'); const rejectReason=document.getElementById('preRejectReason'); const historyBox=document.getElementById('preReviewHistory'); const resendBtn=document.getElementById('preResendAccess');

  async function invoke(body) { const { data, error } = await client.functions.invoke('administrar-profissional', { body }); if (error) throw error; if (data?.error) throw new Error(data.error); return data; }
  function renderPager(){
    if(!pager)return; const pages=Math.max(1,Math.ceil(total/pageSize));
    pager.innerHTML=`<button type="button" class="small-btn" data-page="prev" ${page<=1?'disabled':''}>← Anterior</button><span>Página <strong>${page}</strong> de ${pages} · ${total} cadastro(s)</span><button type="button" class="small-btn" data-page="next" ${page>=pages?'disabled':''}>Próxima →</button>`;
  }
  async function load() { listMsg.textContent = ''; cards.innerHTML = '<p class="empty-state">Carregando...</p>'; try { client = client || resolveClient(); const data = await invoke({ action:'list-pre-cadastros',page,page_size:pageSize,q:search.value.trim(),status:statusFilter.value }); rows = data.pre_cadastros || []; total=Number(data.count||rows.length); render();renderPager(); } catch (e) { cards.innerHTML = ''; listMsg.textContent = e.message || 'Erro ao carregar pré-cadastros.'; } }
  function render() {
    document.getElementById('professionalPreCount').textContent = rows.filter(r => r.status === 'pendente').length;
    if (!rows.length) { cards.innerHTML = '<p class="empty-state">Nenhum pré-cadastro encontrado.</p>'; return; }
    cards.innerHTML = rows.map(r => `<article class="professional-pre-card"><span class="pre-status">${escapeHtml(statusLabel(r.status))}</span><h3>${escapeHtml(r.nome)}</h3><small>${escapeHtml(r.email)}</small><p><strong>${escapeHtml(r.especialidade || 'Área não informada')}</strong>${escapeHtml(r.cidade || '')}${r.estado ? ' / '+escapeHtml(r.estado) : ''}</p><p>Recebido em ${escapeHtml(formatDate(r.created_at))}</p><button class="btn btn-secondary" type="button" data-pre-id="${escapeHtml(r.id)}">Analisar</button></article>`).join('');
    cards.querySelectorAll('[data-pre-id]').forEach(btn => btn.addEventListener('click', () => openReview(btn.dataset.preId)));
  }
  async function loadHistory(id){
    if(!historyBox)return;historyBox.innerHTML='<p class="empty-state">Carregando histórico...</p>';
    try{const data=await invoke({action:'pre-cadastro-history',pre_cadastro_id:id});const history=data.historico||[];historyBox.innerHTML=history.length?history.map(h=>`<article class="pre-history-item"><div><strong>${escapeHtml(statusLabel(h.status_novo))}</strong><small>${escapeHtml(formatDate(h.created_at))} · ${escapeHtml(h.realizado_por_email||'Administrador')}</small></div>${h.observacao?`<p>${escapeHtml(h.observacao)}</p>`:''}${h.motivo_recusa?`<p><b>Motivo:</b> ${escapeHtml(h.motivo_recusa)}</p>`:''}</article>`).join(''):'<p class="empty-state">Nenhuma movimentação registrada ainda.</p>';}catch(e){historyBox.innerHTML='<p class="empty-state">Histórico indisponível.</p>';}
  }
  function openReview(id) {
    current = rows.find(r => r.id === id); if (!current) return;
    document.getElementById('preReviewName').textContent = current.nome; document.getElementById('preReviewEmail').textContent = current.email;
    document.getElementById('preReviewSummary').innerHTML = [
      ['CPF', window.ProtegeCpf.formatarCpf(current.cpf)], ['Nascimento', formatDate(current.data_nascimento)], ['CEP', window.ProtegeCep ? window.ProtegeCep.formatarCep(current.cep || '') || '—' : (current.cep || '—')], ['Endereço', [current.logradouro,current.numero,current.complemento,current.bairro].filter(Boolean).join(', ') || '—'], ['Local', `${current.cidade || '—'} / ${current.estado || '—'}`], ['Celular', window.ProtegeCelular ? window.ProtegeCelular.formatarCelular(current.celular || '') || '—' : (current.celular || '—')],
      ['Especialidade', current.especialidade || '—'], ['Formação de origem', current.formacao_origem || '—'], ['Educação Parental', current.formacao_educacao_parental || '—'], ['Conheceu por', current.como_conheceu || '—'], ['Motivação', current.motivacao || '—'], ['Senha de acesso', current.auth_user_id ? 'Definida pelo profissional' : 'Cadastro antigo — definir na aprovação']
    ].map(([k,v]) => `<div><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
    notes.value = current.observacoes_admin || ''; rejectReason.value=current.motivo_recusa||''; reviewMsg.textContent = ''; const legacyField=document.getElementById('preLegacyPasswordField'); const passwordNote=document.getElementById('prePasswordDefinedNote'); const legacyPassword=document.getElementById('preInitialPassword'); const legacy=!current.auth_user_id; if(legacyField)legacyField.hidden=!legacy; if(passwordNote)passwordNote.hidden=legacy; if(legacyPassword)legacyPassword.value=''; if(resendBtn)resendBtn.hidden=true; dialog.showModal();loadHistory(id);
  }
  async function act(action, extra={}) { if (!current) return; reviewMsg.textContent='Processando...'; try { await invoke({ action, pre_cadastro_id:current.id, observacoes_admin:notes.value.trim(), ...extra }); dialog.close(); await load(); } catch(e){ reviewMsg.textContent=e.message || 'Não foi possível concluir a ação.'; } }
  function queueReload(){clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>{page=1;load();},300);}
  search.addEventListener('input',queueReload); statusFilter.addEventListener('change',()=>{page=1;load();}); document.getElementById('preReviewClose').addEventListener('click',()=>dialog.close());
  pager?.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;const pages=Math.max(1,Math.ceil(total/pageSize));if(b.dataset.page==='prev'&&page>1)page--;if(b.dataset.page==='next'&&page<pages)page++;load();});
  document.getElementById('preMarkAnalysis').addEventListener('click',()=>act('set-pre-cadastro-status',{status:'em_analise'}));
  document.getElementById('preReject').addEventListener('click',()=>{const reason=rejectReason.value.trim();if(!reason){reviewMsg.textContent='Informe o motivo da recusa.';rejectReason.focus();return;}act('reject-pre-cadastro',{motivo_recusa:reason});});
  document.getElementById('preApprove').addEventListener('click',()=>{ const legacy=!current?.auth_user_id; const password=document.getElementById('preInitialPassword')?.value||''; if(legacy&&password.length<8){reviewMsg.textContent='Este é um pré-cadastro antigo. Informe uma senha inicial com pelo menos 8 caracteres.';document.getElementById('preInitialPassword')?.focus();return;} act('approve-pre-cadastro',{status:document.getElementById('preApprovedStatus').value,password:legacy?password:undefined}); });
  resendBtn?.addEventListener('click',async()=>{if(!current)return;reviewMsg.textContent='Enviando acesso...';try{await invoke({action:'resend-access',pre_cadastro_id:current.id,redirect_to:'https://protegeducparental.com.br/login.html'});reviewMsg.textContent='E-mail de recuperação/acesso enviado.';await loadHistory(current.id);}catch(e){reviewMsg.textContent=e.message||'Não foi possível reenviar o acesso.';}});
  load();
})();
