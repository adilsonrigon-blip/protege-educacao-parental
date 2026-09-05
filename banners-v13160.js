(() => {
  'use strict';
  const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const cfg=()=>window.PROTEGE_CONFIG||{};
  const fallback=[
    {id:'f1316000-0000-4000-8000-000000000001',titulo:'Famílias mais fortes para um futuro melhor',texto_curto:'Apoio e orientação para transformar desafios reais da vida familiar em oportunidades de conexão e crescimento.',conteudo:'Na Protege, acreditamos que famílias bem orientadas constroem relações mais saudáveis e um futuro com mais oportunidades para todos.\n\nA Educação Parental oferece acolhimento, informação e estratégias para que pais, mães e responsáveis compreendam melhor os desafios do cotidiano e fortaleçam seus vínculos.',imagem_url:'banner-default-familias.svg',link_url:null,ordem:1},
    {id:'f1316000-0000-4000-8000-000000000002',titulo:'Adolescência com mais diálogo e equilíbrio',texto_curto:'Informação, escuta e ferramentas para construir relações mais saudáveis durante uma fase de grandes mudanças.',conteudo:'A adolescência traz mudanças intensas para jovens e para toda a família. O diálogo, os limites claros e a escuta qualificada ajudam a atravessar essa fase com mais segurança.\n\nA Protege apoia famílias na construção de estratégias para comunicação, autonomia, rotina, uso de telas e bem-estar emocional.',imagem_url:'banner-default-adolescencia.svg',link_url:null,ordem:2},
    {id:'f1316000-0000-4000-8000-000000000003',titulo:'Pequenas ações, grandes conexões',texto_curto:'Fortalecer vínculos também acontece nos pequenos gestos: presença, escuta, respeito e disponibilidade.',conteudo:'Relações familiares são construídas todos os dias. Pequenas mudanças na forma de conversar, acolher emoções e estabelecer limites podem gerar impactos importantes na convivência.\n\nA Educação Parental ajuda a transformar intenção em práticas concretas para relações mais respeitosas e afetivas.',imagem_url:'banner-default-vinculos.svg',link_url:null,ordem:3}
  ];
  async function rest(query=''){
    const c=cfg(); if(!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY) throw new Error('Supabase não configurado');
    const r=await fetch(`${c.SUPABASE_URL}/rest/v1/banners_home${query?`?${query}`:''}`,{headers:{apikey:c.SUPABASE_ANON_KEY,Authorization:`Bearer ${c.SUPABASE_ANON_KEY}`,Accept:'application/json'}});
    if(!r.ok) throw new Error(`Falha ao carregar banners (${r.status})`); return r.json();
  }
  function renderSlide(x){return `<article class="home-banner-slide"><div class="home-banner-copy"><span class="section-label">DESTAQUE PROTEGE</span><h2>${esc(x.titulo)}</h2><p>${esc(x.texto_curto||'')}</p><div class="home-banner-actions"><a class="btn btn-primary" href="banner.html?id=${encodeURIComponent(x.id)}">Saiba Mais</a></div></div><img class="home-banner-image" src="${esc(x.imagem_url||'banner-default-familias.svg')}" alt="" loading="lazy"></article>`;}
  async function initCarousel(){
    const section=document.getElementById('homeBanners'),track=document.getElementById('homeBannerTrack'); if(!section||!track)return;
    let rows,fromFallback=false;
    try{rows=await rest('select=id,titulo,texto_curto,conteudo,imagem_url,link_url,ordem&publicado=eq.true&order=ordem.asc,created_at.asc');}
    catch(err){console.warn('Protege: usando banners locais por indisponibilidade do banco.',err); rows=fallback; fromFallback=true;}
    if(!rows.length){section.hidden=true;return;} section.hidden=false; track.innerHTML=rows.map(renderSlide).join('');
    const prev=document.getElementById('homeBannerPrev'),next=document.getElementById('homeBannerNext'),dots=document.getElementById('homeBannerDots'); let current=0,timer=null;
    if(dots)dots.innerHTML=rows.map((_,i)=>`<button class="banner-carousel-dot${i===0?' active':''}" type="button" data-banner-index="${i}" aria-label="Ver banner ${i+1}"></button>`).join('');
    const go=i=>{current=(i+rows.length)%rows.length;track.style.transform=`translateX(-${current*100}%)`;dots?.querySelectorAll('.banner-carousel-dot').forEach((d,n)=>d.classList.toggle('active',n===current));};
    const stop=()=>{if(timer){clearInterval(timer);timer=null;}}; const start=()=>{stop();if(rows.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setInterval(()=>go(current+1),7000);};
    if(prev){prev.hidden=rows.length<2;prev.addEventListener('click',()=>{go(current-1);start();});} if(next){next.hidden=rows.length<2;next.addEventListener('click',()=>{go(current+1);start();});}
    dots?.querySelectorAll('[data-banner-index]').forEach(b=>b.addEventListener('click',()=>{go(Number(b.dataset.bannerIndex));start();}));
    const viewport=track.parentElement;viewport?.addEventListener('mouseenter',stop);viewport?.addEventListener('mouseleave',start);viewport?.addEventListener('focusin',stop);viewport?.addEventListener('focusout',start);
    let touchX=null;viewport?.addEventListener('touchstart',e=>{touchX=e.changedTouches[0]?.clientX??null;stop();},{passive:true});viewport?.addEventListener('touchend',e=>{if(touchX===null)return;const dx=(e.changedTouches[0]?.clientX??touchX)-touchX;if(Math.abs(dx)>45)go(current+(dx<0?1:-1));touchX=null;start();},{passive:true});
    if(fromFallback)section.dataset.bannerFallback='true'; go(0);start();
  }
  async function initDetail(){
    const host=document.getElementById('publicBannerDetail');if(!host)return;const id=new URLSearchParams(location.search).get('id');if(!id){host.innerHTML='<div class="container"><div class="public-content-empty">Banner não encontrado.</div></div>';return;}
    let x=null;try{const rows=await rest(`select=*&id=eq.${encodeURIComponent(id)}&publicado=eq.true&limit=1`);x=rows[0]||null;}catch(err){x=fallback.find(b=>b.id===id)||null;}
    if(!x){host.innerHTML='<div class="container"><div class="public-content-empty">Conteúdo não encontrado ou ainda não publicado.</div></div>';return;}
    document.title=`${x.titulo} | Protege Educação Parental`;const external=x.link_url?`<a class="btn btn-secondary" href="${esc(x.link_url)}" target="_blank" rel="noopener">Acessar conteúdo relacionado</a>`:'';
    host.innerHTML=`<div class="container"><article class="banner-detail-shell"><img class="banner-detail-image" src="${esc(x.imagem_url||'banner-default-familias.svg')}" alt=""><div class="banner-detail-copy"><span class="section-label">PROTEGE · EDUCAÇÃO PARENTAL</span><h1>${esc(x.titulo)}</h1><p class="banner-detail-summary">${esc(x.texto_curto||'')}</p><div class="banner-detail-text">${esc(x.conteudo||'')}</div><div class="banner-detail-actions"><a class="btn btn-primary" href="cadastro.html">Quero participar</a>${external}</div></div></article></div>`;
  }
  document.addEventListener('DOMContentLoaded',()=>{initCarousel();initDetail();});
})();
