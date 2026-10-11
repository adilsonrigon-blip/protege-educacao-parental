(function(){
'use strict';
const palette={roxo:'#7a3fa0',rosa:'#f5488b',verde:'#268b88',escuro:'#332b3a'};
const fonts={padrao:'inherit',serif:'Georgia,serif',sans:'Arial,sans-serif'};
function render(input){
 let s=String(input??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 s=s.replace(/\{cor:(roxo|rosa|verde|escuro)\}([\s\S]*?)\{\/cor\}/g,(_,k,v)=>`<span style="color:${palette[k]}">${v}</span>`)
 .replace(/\{fonte:(padrao|serif|sans)\}([\s\S]*?)\{\/fonte\}/g,(_,k,v)=>`<span style="font-family:${fonts[k]}">${v}</span>`)
 .replace(/\{tam:(pequeno|grande)\}([\s\S]*?)\{\/tam\}/g,(_,k,v)=>`<span style="font-size:${k==='pequeno'?'0.85em':'1.2em'}">${v}</span>`)
 .replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_\n]+)__/g,'<u>$1</u>')
 .replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
 return s.split(/\r?\n/).map(line=>line.startsWith('## ')?'<h3>'+line.slice(3)+'</h3>':line.startsWith('- ')?'<div class="article-list-item">• '+line.slice(2)+'</div>':line).join('<br>');
}
window.ProtegeRichText={render};
const controls=[
 ['bold','Negrito','N'],['italic','Itálico','I'],['underline','Sublinhado','S'],
 ['heading','Subtítulo','H2'],['list','Lista','☷'],['link','Link','🔗'],['clear','Limpar formatação','Limpar']
];
function addEditor(area){
 if(area.dataset.richEditor==='1')return;
 area.dataset.richEditor='1';
 const bar=document.createElement('div');bar.className='article-format-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Formatação do texto');
 for(const [kind,title,label] of controls){
 const b=document.createElement('button');b.type='button';b.dataset.format=kind;b.title=title;b.textContent=label;bar.appendChild(b);
 }
 for(const [name,options] of [
 ['cor',[['','Cor'],...Object.keys(palette).map(k=>[k,k])]],
 ['fonte',[['','Fonte'],['padrao','Padrão'],['serif','Serifada'],['sans','Sem serifa']]],
 ['tam',[['','Tamanho'],['pequeno','Pequeno'],['grande','Grande']]]
 ]){
 const sel=document.createElement('select');sel.setAttribute('aria-label',name);sel.dataset.format=name;
 for(const [v,label] of options){const o=document.createElement('option');o.value=v;o.textContent=label;sel.appendChild(o)}
 bar.appendChild(sel);
 }
 area.parentNode.insertBefore(bar,area);
 const apply=(kind,value)=>{
 const a=area.selectionStart,b=area.selectionEnd,part=area.value.slice(a,b),text=part||'texto';
 let replacement=text;
 if(kind==='bold')replacement='**'+text+'**';
 if(kind==='italic')replacement='*'+text+'*';
 if(kind==='underline')replacement='__'+text+'__';
 if(kind==='heading')replacement='## '+text;
 if(kind==='list')replacement=text.split('\n').map(x=>'- '+x).join('\n');
 if(kind==='cor'&&value)replacement=`{cor:${value}}${text}{/cor}`;
 if(kind==='fonte'&&value)replacement=`{fonte:${value}}${text}{/fonte}`;
 if(kind==='tam'&&value)replacement=`{tam:${value}}${text}{/tam}`;
 if(kind==='link'){
 const url=prompt('URL do link (https://...)');if(!url||!/^https:\/\/[^\s]+$/i.test(url))return;
 replacement=`${text} (${url})`;
 }
 if(kind==='clear')replacement=text.replace(/\*\*|__|\*|\{\/?(?:cor|fonte|tam)(?::[^}]+)?\}/g,'').replace(/^## |^- /gm,'');
 area.setRangeText(replacement,a,b,'select');area.dispatchEvent(new Event('input',{bubbles:true}));area.focus();
 };
 bar.addEventListener('click',e=>{const b=e.target.closest('button[data-format]');if(b)apply(b.dataset.format)});
 bar.addEventListener('change',e=>{const sel=e.target.closest('select[data-format]');if(sel){apply(sel.dataset.format,sel.value);sel.value=''}});
}
document.querySelectorAll('form textarea').forEach(addEditor);
})();
