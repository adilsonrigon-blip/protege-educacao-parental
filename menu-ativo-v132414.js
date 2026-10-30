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
  // Navegação mobile centralizada: o mesmo comportamento em todas as páginas públicas.
  const toggle = document.querySelector('.site-header .menu-toggle');
  if (toggle) {
    toggle.setAttribute('aria-controls', nav.id || 'protege-main-nav');
    if (!nav.id) nav.id = 'protege-main-nav';
    toggle.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');
    // Os HTMLs legados já registram um clique que alterna .open.
    // Executar após esses handlers evita uma segunda alternância.
    toggle.addEventListener('click', () => {
      queueMicrotask(() => toggle.setAttribute('aria-expanded', String(nav.classList.contains('open'))));
    });
    function closeMobileMenu() {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a[href]')) closeMobileMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        closeMobileMenu();
        toggle.focus();
      }
    });
    document.addEventListener('click', (event) => {
      if (nav.classList.contains('open') && !nav.contains(event.target) && !toggle.contains(event.target)) closeMobileMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1280) closeMobileMenu();
    });
  }
  refresh();
  window.addEventListener('hashchange', refresh);
})();
