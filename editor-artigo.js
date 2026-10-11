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
// WYSIWYG only for the publication body. Other forms remain plain text until their viewers support rich HTML.
function wysiwyg(area){
 const shell=document.createElement('div');shell.className='protege-wysiwyg';
 const toolbar=document.createElement('div');toolbar.className='protege-wysiwyg-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Formatação do artigo');
 const surface=document.createElement('div');surface.className='protege-wysiwyg-surface';surface.contentEditable='true';surface.setAttribute('role','textbox');surface.setAttribute('aria-multiline','true');surface.setAttribute('aria-label','Texto completo do artigo');
 let savedRange=null;surface.addEventListener('mouseup',()=>{const sel=window.getSelection();if(sel.rangeCount)savedRange=sel.getRangeAt(0).cloneRange()});surface.addEventListener('keyup',()=>{const sel=window.getSelection();if(sel.rangeCount)savedRange=sel.getRangeAt(0).cloneRange()});function restore(){if(!savedRange)return;const sel=window.getSelection();sel.removeAllRanges();sel.addRange(savedRange)}
 const buttons=[['bold','Negrito','N'],['italic','Itálico','I'],['underline','Sublinhado','S'],['insertUnorderedList','Lista','☷'],['removeFormat','Limpar','Limpar']];
 for(const [cmd,title,label] of buttons){const b=document.createElement('button');b.type='button';b.title=title;b.setAttribute('aria-label',title);b.textContent=label;b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>{surface.focus();restore();document.execCommand(cmd,false,null);sync()});toolbar.appendChild(b)}
 function selector(label,choices,command){const sel=document.createElement('select');sel.className='protege-editor-select protege-editor-select-'+(label==='Fonte'?'font':'size');sel.setAttribute('aria-label',label);for(const [v,t] of choices){const o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o)}sel.addEventListener('change',()=>{if(!sel.value)return;surface.focus();restore();document.execCommand(command,false,sel.value);sync();sel.selectedIndex=0});toolbar.appendChild(sel)}
 // Compact, familiar word-processor controls: font family, point size, and color palette.
 selector('Fonte',[['','Fonte'],['Arial','Arial'],['Georgia','Georgia'],['Verdana','Verdana']],'fontName');
 selector('Tamanho',[['','Tamanho'],['2','12 px'],['3','14 px'],['4','18 px'],['5','24 px']],'fontSize');
 const colorGroup=document.createElement('div');colorGroup.className='protege-color-group';colorGroup.setAttribute('role','group');colorGroup.setAttribute('aria-label','Cor do texto');
 const colorLabel=document.createElement('span');colorLabel.className='protege-color-label';colorLabel.textContent='Cor';colorGroup.appendChild(colorLabel);
 for(const [name,color] of [['Escuro','#332b3a'],['Roxo','#7a3fa0'],['Rosa','#f5488b'],['Verde-água','#268b88']]){
  const swatch=document.createElement('button');swatch.type='button';swatch.className='protege-color-swatch';swatch.title='Cor: '+name;swatch.setAttribute('aria-label','Cor do texto: '+name);swatch.style.setProperty('--swatch',color);
  swatch.addEventListener('mousedown',e=>e.preventDefault());
  swatch.addEventListener('click',()=>{surface.focus();restore();document.execCommand('foreColor',false,color);sync()});colorGroup.appendChild(swatch);
 }
 toolbar.appendChild(colorGroup);
 const link=document.createElement('button');link.type='button';link.textContent='Link';link.addEventListener('mousedown',e=>e.preventDefault());link.addEventListener('click',()=>{const url=prompt('Endereço do link (https://...)');if(url&&/^https:\/\/[^\s]+$/i.test(url)){surface.focus();restore();document.execCommand('createLink',false,url);sync()}});toolbar.appendChild(link);
 shell.append(toolbar,surface);area.parentNode.insertBefore(shell,area);area.classList.add('protege-wysiwyg-source');
 let last='';function load(){if(area.value===last)return;last=area.value;surface.innerHTML=toEditable(last);savedRange=null;surface.blur()}
 function sync(){const html=sanitize(surface.innerHTML);last=html;area.value=html;area.dispatchEvent(new Event('input',{bubbles:true}))}
 surface.addEventListener('input',sync);
 area.addEventListener('change',load);area.protegeEditor={load,flush:sync};
 const observer=new MutationObserver(()=>{if(document.activeElement!==surface)load()});observer.observe(area,{attributes:true,attributeFilter:['value']});
 const dialog=area.closest('dialog');if(dialog){dialog.addEventListener('close',load);dialog.addEventListener('click',e=>{if(e.target.closest('[data-close-create-dialog]'))load()})}
 const form=area.closest('form');if(form)form.addEventListener('submit',sync,true);
 // Existing edit forms fill textarea.value programmatically; refresh when dialog is opened.
 if(dialog)new MutationObserver(()=>{if(dialog.open)queueMicrotask(load)}).observe(dialog,{attributes:true,attributeFilter:['open']});
 load();
}
function toEditable(value){
 if(/<\/?(?:span|br|div|p|strong|b|em|i|u|ul|ol|li|h[23]|font|a)\b/i.test(value))return sanitize(value);
 return render(value).replace(/<br>/g,'<br>');
}
function sanitize(value){
 const root=document.createElement('div');root.innerHTML=String(value||'');
 const allowed=new Set(['B','STRONG','I','EM','U','BR','P','DIV','SPAN','UL','OL','LI','H2','H3','A','FONT']);
 const walk=node=>{for(const child of [...node.childNodes]){
 if(child.nodeType===8){child.remove();continue}
 if(child.nodeType!==1)continue;
 if(!allowed.has(child.tagName)){const text=document.createTextNode(child.textContent||'');child.replaceWith(text);continue}
 for(const a of [...child.attributes]){const k=a.name.toLowerCase(),v=a.value;
 if(k==='href'&&child.tagName==='A'&&/^https:\/\/[^\s]+$/i.test(v))continue;
 if(k==='color'&&child.tagName==='FONT'&&/^#[0-9a-f]{6}$/i.test(v))continue;
 if(k==='face'&&child.tagName==='FONT'&&['Arial','Georgia','Verdana'].includes(v))continue;
 if(k==='size'&&child.tagName==='FONT'&&/^[2-5]$/.test(v))continue;
 if(k==='style'&&child.tagName==='SPAN'&&/^(?:font-weight:\s*(?:bold|700)|font-style:\s*italic|text-decoration(?:-line)?:\s*underline|color:\s*#[0-9a-f]{6}|font-family:\s*(?:Arial|Georgia|Verdana)|font-size:\s*(?:0\.85em|1\.2em))\s*;?$/i.test(v))continue;
 if(k==='style'&&child.tagName==='SPAN'){const parts=v.split(';').map(x=>x.trim()).filter(Boolean);if(parts.length&&parts.every(x=>/^(?:font-weight:\s*(?:bold|700)|font-style:\s*italic|text-decoration(?:-line)?:\s*underline|color:\s*(?:#[0-9a-f]{6}|rgb\(\d+,\s*\d+,\s*\d+\))|font-family:\s*(?:Arial|Georgia|Verdana)(?:,\s*(?:sans-serif|serif))?|font-size:\s*(?:\d+(?:\.\d+)?(?:px|pt|em)))$/i.test(x)))continue;}
 child.removeAttribute(a.name)
 }walk(child)
 }};walk(root);return root.innerHTML;
}
const oldRender=render;
window.ProtegeRichText.render=value=>/<\/?(?:span|br|div|p|strong|b|em|i|u|ul|ol|li|h[23]|font|a)\b/i.test(String(value||''))?sanitize(value):oldRender(value);
document.querySelectorAll('form textarea[name="conteudo"]').forEach(wysiwyg);
})();
