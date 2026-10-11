/* PROTEGE — formulário de publicações integrado à página, como Quem Somos. */
(function(){
  'use strict';
  const dialog=document.getElementById('publicationDialog');
  const main=document.querySelector('main.app-main');
  if(!dialog||!main)return;
  dialog.classList.add('publication-inline-editor');
  const section=document.querySelector('.content-admin-tabs');
  if(section)section.insertAdjacentElement('afterend',dialog);
  else main.prepend(dialog);
  const openNative=dialog.show.bind(dialog);
  dialog.showModal=function(){
    openNative();
    dialog.scrollIntoView({behavior:'smooth',block:'start'});
  };
  const head=dialog.querySelector('.dialog-head');
  if(head&&!head.querySelector('.publication-inline-description')){
    const p=document.createElement('p');
    p.className='app-subtitle publication-inline-description';
    p.textContent='Preencha os dados abaixo seguindo o padrão dos demais cadastros.';
    head.querySelector('div')?.append(p);
  }
  dialog.addEventListener('close',()=>{dialog.scrollIntoView({block:'nearest'});});
})();
