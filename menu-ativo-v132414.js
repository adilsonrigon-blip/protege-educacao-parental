/* PROTEJE v13.24.14 — marca apenas o item correspondente à página ou seção atual. */
(function () {
  'use strict';
  const nav = document.querySelector('.site-header .main-nav');
  if (!nav) return;
  const links = Array.from(nav.querySelectorAll('a[href]'));
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const hash = decodeURIComponent(location.hash || '').toLowerCase();
  const group = {
    'cadastro-profissional.html': 'cadastre-se.html',
    'cadastro-adolescente.html': 'cadastre-se.html',
    'pre-cadastro-profissionais.html': 'cadastre-se.html',
    'cadastro.html': 'cadastre-se.html',
    'login.html': 'login.html',
    'minha-conta.html': 'login.html'
  };
  const target = group[file] || file;
  const sections = ['#sobre','#como-funciona','#beneficios','#noticias','#contato'];
  function refresh() {
    links.forEach(a => a.removeAttribute('aria-current'));
    let active = null;
    if (file === 'index.html' && sections.includes((location.hash || '').toLowerCase())) {
      active = links.find(a => a.getAttribute('href') === 'index.html' + location.hash);
    } else if (file !== 'index.html') {
      active = links.find(a => a.getAttribute('href').split('#')[0].toLowerCase() === target);
    }
    if (active) active.setAttribute('aria-current', 'page');
  }
  // Único controlador do menu na Home: evita duplo toggle.
  const toggle = document.querySelector('.site-header .menu-toggle');
  if (toggle) {
    if (!nav.id) nav.id = 'protege-main-nav';
    toggle.setAttribute('aria-controls', nav.id);
    toggle.setAttribute('type', 'button');
    const setOpen = (open) => {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    };
    setOpen(false);
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      setOpen(!nav.classList.contains('open'));
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a[href]')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', (event) => {
      if (nav.classList.contains('open') && !nav.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1280) setOpen(false);
    });
  }
  refresh();
  window.addEventListener('hashchange', refresh);
})();
