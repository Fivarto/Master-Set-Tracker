const KEY='pokemon-master-sets-v1';
const PER_PAGE=9;
const CONDS=['','Mint (M)','Near Mint (NM)','Lightly Played (LP)','Moderately Played (MP)','Heavily Played (HP)','Danificada (DMG)','Gradada (PSA/BGS/CGC)'];
const VERS=['Normal','Holo','Reverse Holo','Full Art','Alternate Art','Promo','Primeira edição','Outra'];
const ICONS=['📁','📂','🗂️','⭐','🏆','💎','🎨','✏️','🖌️','🎴','📚','🔥','❄️','⚡','🌿','🐉','🌙','☀️','❤️','🎮','👑','🦋'];

let S;
try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!S||!S.sets)S={sets:[],cur:null};
S.folders=S.folders||[];
if(!S.layout)S.layout='binder';

const $=id=>document.getElementById(id);
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){alert('Não foi possível salvar no navegador.')}};
const cur=()=>S.sets.find(s=>s.id===S.cur);
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const isBinder=()=>S.layout!=='grid';
const isPocket=c=>!!c.pocket||/^dex:((P-)?[AB]\d+[a-z]?-|P-[AB]-)/i.test(c.key||'');
const versOf=c=>c.vers||(c.ver?{[c.ver]:1}:{});
const versLabel=c=>Object.entries(versOf(c)).map(([n,q])=>q>1?`${n} ×${q}`:n).join(', ');
const fIcon=f=>f.icon||'📁';
const sName=x=>(x.icon?x.icon+' ':'')+x.name;
const rootSets=()=>S.sets.filter(x=>!S.folders.some(f=>f.id===x.folder));
const findCard=id=>{for(const s of S.sets){const c=s.cards.find(x=>x.id===id);if(c)return {s,c}}return null};

function setOptions(sel){
  const o=x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(sName(x))}</option>`;
  return S.folders.map(f=>{const ss=S.sets.filter(x=>x.folder===f.id);return ss.length?`<optgroup label="${esc(fIcon(f))} ${esc(f.name)}">${ss.map(o).join('')}</optgroup>`:''}).join('')+rootSets().map(o).join('');
}

function ensureSlots(cards){
  const used=new Set();
  cards.forEach(c=>{
    if(typeof c.slot==='number'&&Number.isInteger(c.slot)&&c.slot>=0&&!used.has(c.slot))used.add(c.slot);
    else c.slot=null;
  });
  let next=0;
  cards.forEach(c=>{if(c.slot===null){while(used.has(next))next++;c.slot=next;used.add(next)}});
}
function nextFreeSlot(cards,startFrom=0){
  ensureSlots(cards);
  const used=new Set(cards.map(c=>c.slot));
  let idx=Math.max(0,startFrom);
  while(used.has(idx))idx++;
  return idx;
}
function compactSlots(cards){
  ensureSlots(cards);
  [...cards].sort((a,b)=>a.slot-b.slot).forEach((c,i)=>c.slot=i);
}
const getExtraPages=(s,sec)=>(s&&s.extraPages&&s.extraPages[sec])||0;
function setExtraPages(s,sec,val){
  if(!s)return;
  if(!s.extraPages)s.extraPages={};
  if(val>0)s.extraPages[sec]=val;else delete s.extraPages[sec];
}

let dupIdx=new Map();
const idOf=c=>{const n=parseInt(c.num,10);return c.set?`${norm(c.set)}|${isNaN(n)?norm(c.num):n}|${norm(c.name)}`:'k:'+(c.key||c.id)};
function buildDup(){
  const m=new Map();dupIdx=new Map();
  S.sets.forEach(x=>x.cards.forEach(c=>{const k=idOf(c),a=m.get(k)||[];a.push(x.name);m.set(k,a)}));
  m.forEach((a,k)=>{const u=[...new Set(a)];if(u.length>1)dupIdx.set(k,u)});
}
function twins(c){
  const id=idOf(c),out=[];
  S.sets.forEach(x=>x.cards.forEach(y=>{if(y!==c&&((y.key&&y.key===c.key)||idOf(y)===id))out.push(y)}));
  return out;
}
function propagate(c,all){
  if(S.sync===false)return;
  twins(c).forEach(y=>{y.owned=c.owned;if(all){y.cond=c.cond;y.vers={...versOf(c)};delete y.ver;y.price=c.price}});
}
function adopt(c){
  if(S.sync===false)return;
  const t=twins(c).find(y=>y.owned);if(!t)return;
  c.owned=true;c.cond=t.cond;c.vers={...versOf(t)};delete c.ver;c.price=t.price;
}
function syncGroups(){
  const g=new Map();
  S.sets.forEach(x=>x.cards.forEach(c=>{const k=idOf(c);if(!g.has(k))g.set(k,[]);g.get(k).push({c,s:x.id})}));
  return [...g.values()].filter(l=>new Set(l.map(e=>e.s)).size>1).map(l=>l.map(e=>e.c));
}
function syncAll(){
  let n=0;
  syncGroups().forEach(l=>{
    const has=c=>Object.keys(versOf(c)).length||c.price>0||c.cond;
    const src=l.find(c=>c.owned&&has(c))||l.find(c=>c.owned);if(!src)return;
    l.forEach(c=>{
      if(c===src)return;let ch=false;
      if(!c.owned){c.owned=true;ch=true}
      if(!c.cond&&src.cond){c.cond=src.cond;ch=true}
      if(!Object.keys(versOf(c)).length&&Object.keys(versOf(src)).length){c.vers={...versOf(src)};delete c.ver;ch=true}
      if(!(c.price>0)&&src.price>0){c.price=src.price;ch=true}
      if(ch)n++;
    });
  });
  return n;
}
function stats(cards){
  const ph=cards.filter(c=>!isPocket(c)),po=cards.filter(isPocket),own=ph.filter(c=>c.owned).length;
  return {own,tot:ph.length,all:cards.length,po:po.filter(c=>c.owned).length,pt:po.length,pct:ph.length?own/ph.length*100:0,spent:cards.reduce((a,c)=>a+(c.owned&&c.price>0?c.price:0),0)};
}
