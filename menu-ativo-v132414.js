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
  refresh();
  window.addEventListener('hashchange', refresh);
})();
