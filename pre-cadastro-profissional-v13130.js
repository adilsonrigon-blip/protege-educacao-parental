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
    const msg = document.getElementById('professionalInterestMessage');
    const submit = document.getElementById('professionalInterestSubmit');
    const success = document.getElementById('professionalInterestSuccess');
    cpfInput.addEventListener('input', () => { cpfInput.value = window.ProtegeCpf.formatarCpf(cpfInput.value); cpfError.hidden = true; });
    cpfInput.addEventListener('blur', () => { if (cpfInput.value && !window.ProtegeCpf.validarCpf(cpfInput.value)) { cpfError.textContent = 'CPF inválido. Confira os números informados.'; cpfError.hidden = false; } });
    publicForm.addEventListener('submit', async (ev) => {
      ev.preventDefault(); msg.textContent = '';
      if (!publicForm.reportValidity()) return;
      if (!window.ProtegeCpf.validarCpf(cpfInput.value)) { cpfError.textContent = 'CPF inválido. Confira os números informados.'; cpfError.hidden = false; cpfInput.focus(); return; }
      const fd = new FormData(publicForm);
      const estado = String(fd.get('estado') || '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(estado)) { msg.textContent = 'Informe a UF com duas letras, por exemplo SP.'; return; }
      submit.disabled = true; submit.textContent = 'Enviando...';
      try {
        const client = resolveClient();
        const { data, error } = await client.rpc('enviar_pre_cadastro_profissional', {
          p_nome: String(fd.get('nome') || '').trim(), p_email: String(fd.get('email') || '').trim().toLowerCase(), p_cpf: window.ProtegeCpf.somenteDigitos(fd.get('cpf')),
          p_data_nascimento: fd.get('data_nascimento') || null, p_cidade: String(fd.get('cidade') || '').trim(), p_estado: estado, p_celular: String(fd.get('celular') || '').trim(),
          p_especialidade: String(fd.get('especialidade') || '').trim(), p_formacao_origem: String(fd.get('formacao_origem') || '').trim(), p_formacao_educacao_parental: String(fd.get('formacao_educacao_parental') || ''),
          p_como_conheceu: String(fd.get('como_conheceu') || ''), p_motivacao: String(fd.get('motivacao') || '').trim(), p_consentimento_lgpd: fd.get('consentimento_lgpd') === 'on'
        });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data.message || 'Não foi possível enviar o pré-cadastro.');
        publicForm.reset(); cpfError.hidden = true; publicForm.hidden = true; success.hidden = false;
      } catch (err) { msg.textContent = err?.message || 'Não foi possível enviar o pré-cadastro. Tente novamente.'; }
      finally { submit.disabled = false; submit.textContent = 'Enviar pré-cadastro'; }
    });
  }

  const cards = document.getElementById('preCards');
  if (!cards) return;
  let client; let rows = []; let current = null;
  const listMsg = document.getElementById('preListMessage'); const search = document.getElementById('preSearch'); const statusFilter = document.getElementById('preStatusFilter');
  const dialog = document.getElementById('preReviewDialog'); const reviewMsg = document.getElementById('preReviewMessage'); const notes = document.getElementById('preAdminNotes');

  async function invoke(body) { const { data, error } = await client.functions.invoke('administrar-profissional', { body }); if (error) throw error; if (data?.error) throw new Error(data.error); return data; }
  async function load() { listMsg.textContent = ''; cards.innerHTML = '<p class="empty-state">Carregando...</p>'; try { client = client || resolveClient(); const data = await invoke({ action:'list-pre-cadastros' }); rows = data.pre_cadastros || []; render(); } catch (e) { cards.innerHTML = ''; listMsg.textContent = e.message || 'Erro ao carregar pré-cadastros.'; } }
  function render() {
    const q = search.value.trim().toLowerCase(); const st = statusFilter.value;
    const filtered = rows.filter(r => (!st || r.status === st) && (!q || `${r.nome} ${r.email} ${r.cpf}`.toLowerCase().includes(q)));
    document.getElementById('professionalPreCount').textContent = rows.filter(r => r.status === 'pendente').length;
    if (!filtered.length) { cards.innerHTML = '<p class="empty-state">Nenhum pré-cadastro encontrado.</p>'; return; }
    cards.innerHTML = filtered.map(r => `<article class="professional-pre-card"><span class="pre-status">${escapeHtml(statusLabel(r.status))}</span><h3>${escapeHtml(r.nome)}</h3><small>${escapeHtml(r.email)}</small><p><strong>${escapeHtml(r.especialidade || 'Área não informada')}</strong>${escapeHtml(r.cidade || '')}${r.estado ? ' / '+escapeHtml(r.estado) : ''}</p><p>Recebido em ${escapeHtml(formatDate(r.created_at))}</p><button class="btn btn-secondary" type="button" data-pre-id="${escapeHtml(r.id)}">Analisar</button></article>`).join('');
    cards.querySelectorAll('[data-pre-id]').forEach(btn => btn.addEventListener('click', () => openReview(btn.dataset.preId)));
  }
  function openReview(id) {
    current = rows.find(r => r.id === id); if (!current) return;
    document.getElementById('preReviewName').textContent = current.nome; document.getElementById('preReviewEmail').textContent = current.email;
    document.getElementById('preReviewSummary').innerHTML = [
      ['CPF', window.ProtegeCpf.formatarCpf(current.cpf)], ['Nascimento', formatDate(current.data_nascimento)], ['Local', `${current.cidade || '—'} / ${current.estado || '—'}`], ['Celular', current.celular || '—'],
      ['Especialidade', current.especialidade || '—'], ['Formação de origem', current.formacao_origem || '—'], ['Educação Parental', current.formacao_educacao_parental || '—'], ['Conheceu por', current.como_conheceu || '—'], ['Motivação', current.motivacao || '—']
    ].map(([k,v]) => `<div><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
    notes.value = current.observacoes_admin || ''; reviewMsg.textContent = ''; document.getElementById('preInitialPassword').value = ''; dialog.showModal();
  }
  async function act(action, extra={}) { if (!current) return; reviewMsg.textContent='Processando...'; try { await invoke({ action, pre_cadastro_id:current.id, observacoes_admin:notes.value.trim(), ...extra }); dialog.close(); await load(); } catch(e){ reviewMsg.textContent=e.message || 'Não foi possível concluir a ação.'; } }
  search.addEventListener('input', render); statusFilter.addEventListener('change', render); document.getElementById('preReviewClose').addEventListener('click',()=>dialog.close());
  document.getElementById('preMarkAnalysis').addEventListener('click',()=>act('set-pre-cadastro-status',{status:'em_analise'}));
  document.getElementById('preReject').addEventListener('click',()=>act('reject-pre-cadastro'));
  document.getElementById('preApprove').addEventListener('click',()=>{ const password=document.getElementById('preInitialPassword').value; if(password.length<8){reviewMsg.textContent='Informe uma senha inicial com pelo menos 8 caracteres.';return;} act('approve-pre-cadastro',{password,status:document.getElementById('preApprovedStatus').value}); });
  load();
})();
