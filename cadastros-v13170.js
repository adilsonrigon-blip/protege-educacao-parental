(function(){
  'use strict';
  const toggle=document.querySelector('.menu-toggle');
  const nav=document.querySelector('.main-nav');
  if(toggle&&nav){
    toggle.addEventListener('click',function(){
      const open=nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
    });
    nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));
  }
  const year=document.getElementById('year'); if(year)year.textContent=new Date().getFullYear();

  const form=document.getElementById('adolescentForm');
  if(!form)return;
  const cpf=document.getElementById('adolescentCpf');
  const phone=document.getElementById('adolescentPhone');
  const birth=document.getElementById('adolescentBirthDate');
  const cpfError=document.getElementById('adolescentCpfError');
  const phoneError=document.getElementById('adolescentPhoneError');
  const birthError=document.getElementById('adolescentBirthError');
  const msg=document.getElementById('adolescentMessage');
  const submit=document.getElementById('adolescentSubmit');
  const success=document.getElementById('adolescentSuccess');
  birth.max=new Date().toISOString().slice(0,10);

  function setError(input,errorEl,text){errorEl.textContent=text||'';errorEl.hidden=!text;input.classList.toggle('input-error',Boolean(text));input.setAttribute('aria-invalid',text?'true':'false');}
  function cpfValid(){const ok=window.ProtegeCpf&&window.ProtegeCpf.validarCpf(cpf.value);setError(cpf,cpfError,ok?'':'Informe um CPF válido.');return Boolean(ok);}
  function phoneValid(){const ok=window.ProtegeCelular&&window.ProtegeCelular.validarCelular(phone.value);setError(phone,phoneError,ok?'':'Informe um celular brasileiro válido com DDD.');return Boolean(ok);}
  function birthValid(){if(!birth.value){setError(birth,birthError,'Informe a data de nascimento.');return false;}const value=new Date(birth.value+'T12:00:00');const today=new Date();const ok=!Number.isNaN(value.getTime())&&value<=today;setError(birth,birthError,ok?'':'A data de nascimento não pode ser futura.');return ok;}
  cpf.addEventListener('input',()=>{if(window.ProtegeCpf)cpf.value=window.ProtegeCpf.formatarCpf(cpf.value);setError(cpf,cpfError,'');});
  cpf.addEventListener('blur',cpfValid);
  phone.addEventListener('input',()=>{if(window.ProtegeCelular)phone.value=window.ProtegeCelular.formatarCelular(phone.value);setError(phone,phoneError,'');});
  phone.addEventListener('blur',phoneValid);
  birth.addEventListener('change',birthValid);

  form.addEventListener('submit',async function(event){
    event.preventDefault();msg.textContent='';
    const valid=form.reportValidity()&&cpfValid()&&phoneValid()&&birthValid();
    if(!valid)return;
    submit.disabled=true;submit.textContent='Enviando...';
    const fd=new FormData(form);
    const payload={
      p_nome:String(fd.get('nome')||'').trim(),
      p_data_nascimento:String(fd.get('data_nascimento')||''),
      p_cpf:window.ProtegeCpf.somenteDigitos(fd.get('cpf')),
      p_celular:window.ProtegeCelular.formatarCelular(fd.get('celular')),
      p_email:String(fd.get('email')||'').trim().toLowerCase()
    };
    try{
      const cfg=window.PROTEGE_CONFIG||{};
      if(!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||!window.supabase)throw new Error('O banco de dados não está configurado.');
      const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
      const {data,error}=await client.rpc('enviar_cadastro_adolescente',payload);
      if(error)throw error;
      if(data&&data.ok===false)throw new Error(data.message||'Não foi possível concluir o cadastro.');
      form.reset();form.hidden=true;success.hidden=false;success.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(err){console.error(err);msg.textContent=err?.message||'Não foi possível enviar agora. Tente novamente em alguns instantes.';}
    finally{submit.disabled=false;submit.textContent='Enviar cadastro';}
  });
})();
