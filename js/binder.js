const pageState={};
function getPage(setId,sec,totalPages){
  const k=`${setId}:${sec||'all'}`;
  let p=pageState[k]||1;
  if(p<1)p=1;if(totalPages>0&&p>totalPages)p=totalPages;
  return pageState[k]=p;
}
function setPage(setId,sec,p,totalPages){
  const k=`${setId}:${sec||'all'}`;
  pageState[k]=Math.max(1,Math.min(totalPages>0?totalPages:p,p));
}
function resetPages(){Object.keys(pageState).forEach(k=>delete pageState[k])}

function Q(){const e=$('cardQ');return e?e.value.trim():''}
function matchCard(c,s){
  const qs=norm(Q()).split(' ').filter(Boolean);if(!qs.length)return true;
  const fo=S.folders.find(f=>f.id===s.folder);
  const words=norm([c.name,c.set,c.num,c.cond,versLabel(c),s.name,fo&&fo.name].join(' ')).split(' ');
  return qs.every(t=>/^\d+$/.test(t)?words.some(w=>w===t||(/^\d+$/.test(w)&&parseInt(w,10)===parseInt(t,10))):words.some(w=>w.startsWith(t)));
}
function visible(s){
  const f=$('filter').value,o=$('sort').value;s=s||cur();
  if(!s)return [];
  const l=s.cards.filter(c=>(f==='all'||(f==='own')===!!c.owned)&&matchCard(c,s));
  const tie=(a,b)=>(a.date||'').localeCompare(b.date||'')||String(a.num).localeCompare(String(b.num),undefined,{numeric:true});
  const nm=(a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'})||tie(a,b);
  const dt=(a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||String(a.num).localeCompare(String(b.num),undefined,{numeric:true});
  if(o==='date')l.sort(dt);
  else if(o==='az')l.sort(nm);
  else if(o==='za')l.sort((a,b)=>nm(b,a));
  else if(o==='manual'){
    ensureSlots(l.filter(c=>!isPocket(c)));
    ensureSlots(l.filter(isPocket));
    l.sort((a,b)=>(a.slot??0)-(b.slot??0));
  }
  return l;
}
function sectionCards(sObj,sec){
  const vis=visible(sObj);
  return sec==='ph'?vis.filter(c=>!isPocket(c)):sec==='po'?vis.filter(isPocket):vis;
}
function buildManualSlots(cards,sObj,sec){
  ensureSlots(cards);
  const bySlot=new Map(cards.map(c=>[c.slot,c]));
  const maxSlot=cards.reduce((m,c)=>Math.max(m,c.slot),-1);
  const totalPages=Math.max(1,Math.ceil((maxSlot+1)/PER_PAGE))+getExtraPages(sObj,sec);
  const slots=Array.from({length:totalPages*PER_PAGE},(_,i)=>bySlot.get(i)||null);
  return {slots,totalPages};
}
function sectionTotalPages(sObj,sec,isManualSlots){
  const secList=sectionCards(sObj,sec);
  return (isManualSlots&&isBinder())?buildManualSlots(secList,sObj,sec).totalPages:Math.max(1,Math.ceil(secList.length/PER_PAGE));
}
function cardHtml(c,canDrag,slotIdx){
  return `<div class="card ${c.owned?'own':''}" tabindex="0" role="button" aria-pressed="${!!c.owned}" data-id="${c.id}" ${typeof slotIdx==='number'?`data-slot="${slotIdx}"`:''}>
    ${canDrag?`<button class="x h" data-h aria-label="Arrastar para reordenar" title="Arraste para mover ou trocar de lugar">⠿</button>`:''}<button class="x v" data-open="${c.id}" aria-label="Detalhes e tela cheia" title="Detalhes">⤢</button><button class="x" data-del="${c.id}" aria-label="Remover carta" title="Remover">×</button>
    <div class="im">${c.img?`<img loading="lazy" src="${esc(c.img)}" alt="${esc(c.name)}" onerror="this.parentNode.textContent='Sem imagem'">`:'Sem imagem'}${dupIdx.get(idOf(c))?`<span class="lnk" title="Presente nos sets: ${esc(dupIdx.get(idOf(c)).join(', '))}">🔗</span>`:''}</div>
    <b>${esc(c.name)}</b><small>${esc(c.set||'')} ${c.num?'#'+esc(c.num):''}</small>${c.owned?`<small class="meta">${esc([c.cond&&c.cond.replace(/.*\((.*)\)/,'$1'),versLabel(c),c.price>0&&money(c.price)].filter(Boolean).join(' · '))}</small>`:''}</div>`;
}
function binderSheetHtml(items,canDrag,startSlotIdx){
  return `<div class="binder-sheet">${Array.from({length:PER_PAGE},(_,i)=>{
    const c=items[i]||null,absSlot=startSlotIdx+i;
    return c?cardHtml(c,canDrag,absSlot):`<div class="slot-empty" data-empty-slot="${absSlot}" aria-label="Espaço vazio ${i+1}"><div class="slot-box"><span>•</span>${canDrag?`<span class="slot-num">Slot ${i+1}</span>`:''}</div></div>`;
  }).join('')}</div>`;
}
function binderSectionHtml(sObj,sec,label,cards,canDrag,emptyMsg){
  let totalPages=1,slice=[],hasEmptyGaps=false;
  if(canDrag){
    const built=buildManualSlots(cards,sObj,sec);
    totalPages=built.totalPages;
    const curPage=getPage(sObj.id,sec,totalPages);
    slice=built.slots.slice((curPage-1)*PER_PAGE,curPage*PER_PAGE);
    hasEmptyGaps=built.slots.slice(0,cards.length).some(x=>x===null)||getExtraPages(sObj,sec)>0;
  }else{
    if(!cards.length)return emptyMsg?`<div class="empty">${emptyMsg}</div>`:'';
    totalPages=Math.max(1,Math.ceil(cards.length/PER_PAGE));
    const curPage=getPage(sObj.id,sec,totalPages);
    slice=cards.slice((curPage-1)*PER_PAGE,curPage*PER_PAGE);
  }
  const curPage=getPage(sObj.id,sec,totalPages);
  const dots=totalPages>1&&totalPages<=20?`<div class="binder-dots">${Array.from({length:totalPages},(_,i)=>`<button type="button" class="pdot ${i+1===curPage?'on':''}" data-pg-set="${sObj.id}" data-pg-sec="${sec}" data-pg-to="${i+1}">${i+1}</button>`).join('')}</div>`:'';
  const tools=canDrag?`<div class="binder-actions"><button type="button" data-add-page="${sObj.id}" data-sec="${sec}">+ Página</button>${hasEmptyGaps?`<button type="button" data-compact="${sObj.id}" data-sec="${sec}">Compactar</button>`:''}</div>`:'';
  return `<div class="binder-wrap" data-binder-set="${sObj.id}" data-binder-sec="${sec}"><div class="binder-bar"><span class="msg"><b>${esc(label)}</b> · ${cards.length} ${cards.length===1?'carta':'cartas'}</span><div class="binder-nav"><button type="button" data-pg-set="${sObj.id}" data-pg-sec="${sec}" data-pg-dir="-1" ${curPage<=1?'disabled':''}>‹ Anterior</button><span class="binder-pinfo">Página ${curPage} de ${totalPages}</span><button type="button" data-pg-set="${sObj.id}" data-pg-sec="${sec}" data-pg-dir="1" ${curPage>=totalPages?'disabled':''}>Próxima ›</button></div>${tools}${dots}</div>${binderSheetHtml(slice,canDrag,(curPage-1)*PER_PAGE)}</div>`;
}
function renderCardsArea(sObj,list,canDrag,emptyMsg){
  if(!list.length)return `<div class="empty">${emptyMsg}</div>`;
  const ph=list.filter(c=>!isPocket(c)),po=list.filter(isPocket);
  if(!isBinder()){
    return `<div class="grid">${po.length?(ph.length?`<h3 class="sech">Cartas físicas (TCG) · ${ph.length}</h3>`+ph.map(c=>cardHtml(c,canDrag)).join(''):'')+(po.length?`<h3 class="sech">TCG Pocket (digital) · ${po.length}</h3>`+po.map(c=>cardHtml(c,canDrag)).join(''):''):ph.map(c=>cardHtml(c,canDrag)).join('')}</div>`;
  }
  return po.length
    ?((ph.length?`<h3 class="sech">Cartas físicas (TCG) · ${ph.length}</h3>`+binderSectionHtml(sObj,'ph','Físicas (TCG)',ph,canDrag,''):'')+(po.length?`<h3 class="sech">TCG Pocket (digital) · ${po.length}</h3>`+binderSectionHtml(sObj,'po','TCG Pocket',po,canDrag,''):''))
    :binderSectionHtml(sObj,'all','Binder 3×3',ph,canDrag,'');
}
function setBoxHtml(x,canDrag){
  const st=stats(x.cards),open=!!x.open||!!Q(),list=open?visible(x):[];
  const emptyMsg=Q()?'Nenhuma carta encontrada com essa busca.':st.all?'Nenhuma carta neste filtro.':'Nenhuma carta ainda. Clique em “+ Cartas”.';
  return `<section class="setbox" data-sid="${x.id}"><div class="sethead"><button class="tog" data-tog="${x.id}" aria-expanded="${open}"><span class="chev">${open?'▾':'▸'}</span>${esc(sName(x))}</button><span class="sinfo">${st.own}/${st.tot} (${Math.round(st.pct)}%)${st.pt?` · Pocket ${st.po}/${st.pt}`:''}${st.spent?' · '+money(st.spent):''}</span><div class="track"><div class="fill" style="width:${st.pct}%"></div></div><button data-add="${x.id}">+ Cartas</button><button data-sedit="${x.id}" aria-label="Editar nome e ícone">✎</button><button data-mv="${x.id}" aria-label="Mover para outra pasta">📁 Mover</button><button data-dels="${x.id}" aria-label="Excluir set">×</button></div><div class="setbody" ${open?'':'hidden'}>${open?renderCardsArea(x,list,canDrag,emptyMsg):''}</div></section>`;
}
function syncSeg(){
  document.querySelectorAll('#viewSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===(S.view==='multi'?'multi':'one')));
  document.querySelectorAll('#layoutSeg button').forEach(b=>b.classList.toggle('on',b.dataset.l===(isBinder()?'binder':'grid')));
  document.querySelectorAll('#filterSeg button').forEach(b=>b.classList.toggle('on',b.dataset.f===$('filter').value));
}
function render(){
  buildDup();$('qAll').hidden=true;
  const multi=S.view==='multi';syncSeg();$('crumb').textContent='';
  $('viewSel').value=multi?'multi':'one';
  $('setSel').hidden=multi;$('delSet').hidden=multi;$('mvCur').hidden=multi||!S.sets.length;$('edCur').hidden=multi||!S.sets.length;$('edCurF').hidden=multi||!(cur()&&S.folders.some(f=>f.id===cur().folder));$('expAll').hidden=!multi;$('colAll').hidden=!multi;
  $('setSel').innerHTML=setOptions(S.cur)||'<option>Nenhum set</option>';
  const g=$('grid'),m=$('multi');g.hidden=multi;m.hidden=!multi;
  const canDrag=$('sort').value==='manual'&&$('filter').value==='all'&&!Q();
  $('hint').textContent=$('sort').value==='manual'?(canDrag?(isBinder()?'Arraste pelo ⠿ para qualquer slot vazio, outra carta ou botão de página.':'Arraste pelo botão ⠿ para reordenar.'):'Para organizar manualmente, use o filtro "Todas" e limpe a busca.'):'';
  if(!S.sets.length&&(!multi||!S.folders.length)){(multi?m:g).innerHTML='<div class="empty">Seu fichário está vazio.<br>Crie um master set, por exemplo com o nome de um ilustrador.<br><button class="p" data-newset>Criar master set</button></div>';$('progTxt').textContent='';$('fill').style.width='0';return}
  if(multi){
    const t=stats(S.sets.flatMap(x=>x.cards));
    $('progTxt').textContent=`${t.own} de ${t.tot} cartas em ${S.sets.length} sets (${Math.round(t.pct)}%)`+(t.pt?` · TCG Pocket: ${t.po} de ${t.pt}`:'')+(t.spent?` · Investido: ${money(t.spent)}`:'');
    $('fill').style.width=t.pct+'%';
    const fs=S.folders.map(f=>{
      const ss=S.sets.filter(x=>x.folder===f.id),st=stats(ss.flatMap(x=>x.cards)),open=f.open!==false||!!Q(),sv=Q()?ss.filter(x=>visible(x).length):ss;
      if(Q()&&!sv.length)return '';
      return `<section class="folderbox"><div class="sethead"><button class="tog" data-ftog="${f.id}" aria-expanded="${open}"><span class="chev">${open?'▾':'▸'}</span>${esc(fIcon(f))} ${esc(f.name)}</button><span class="sinfo">${ss.length} sets · ${st.own}/${st.tot}${st.pt?` · Pocket ${st.po}/${st.pt}`:''}</span><div class="track"><div class="fill" style="width:${st.pct}%"></div></div><button data-fedit="${f.id}">✎</button><button data-fadd="${f.id}">+ Set</button><button data-fexist="${f.id}">+ Existente</button></div><div class="fbody" ${open?'':'hidden'}>${open?(sv.length?sv.map(x=>setBoxHtml(x,canDrag)).join(''):'<div class="empty">Pasta vazia. Clique em “+ Set”.</div>'):''}</div></section>`;
    }).join('');
    const rt=rootSets().filter(x=>!Q()||visible(x).length);
    m.innerHTML=(fs+(rt.length?(S.folders.length?'<h3 class="sech">Sem pasta</h3>':'')+rt.map(x=>setBoxHtml(x,canDrag)).join(''):''))||(Q()?'<div class="empty">Nenhuma carta encontrada com essa busca.</div>':'');
    return;
  }
  const x=cur(),st=stats(x.cards),list=visible(x),fo=S.folders.find(y=>y.id===x.folder);
  const oth=Q()?S.sets.filter(y=>y!==x).reduce((n,y)=>n+visible(y).length,0):0;
  $('qAll').hidden=!oth;$('qAll').textContent=`${oth} em outros sets · Ver todos`;
  $('crumb').textContent=fo?`${fIcon(fo)} ${fo.name} › ${sName(x)}`:sName(x);
  $('progTxt').textContent=`${st.own} de ${st.tot} cartas (${Math.round(st.pct)}%)`+(st.pt?` · TCG Pocket: ${st.po} de ${st.pt}`:'')+(st.spent?` · Investido: ${money(st.spent)}`:'');
  $('fill').style.width=st.pct+'%';
  const emptyMsg=Q()?'Nenhuma carta encontrada com essa busca.':st.all?'Nenhuma carta neste filtro.':'Nenhuma carta ainda. Clique em “Adicionar cartas”.';
  g.innerHTML=renderCardsArea(x,list,canDrag,emptyMsg);
}

let drag=null;
function moveGhost(e){drag.g.style.left=(e.clientX-drag.w/2)+'px';drag.g.style.top=(e.clientY-40)+'px';drag.y=e.clientY}
function clearMarks(){
  document.querySelectorAll('.dropA,.dropB,.drop-swap,.drop-page,.drop-slot').forEach(x=>x.classList.remove('dropA','dropB','drop-swap','drop-page','drop-slot'));
}
$('area').addEventListener('pointerdown',e=>{
  const h=e.target.closest('[data-h]');if(!h||drag)return;
  e.preventDefault();
  const card=h.closest('.card'),g=card.cloneNode(true),bw=card.closest('.binder-wrap'),sb=card.closest('.setbox');
  g.className=card.className+' ghost';g.style.width=card.offsetWidth+'px';
  document.body.appendChild(g);card.classList.add('drag');
  drag={id:card.dataset.id,g,card,srcSetId:sb?sb.dataset.sid:S.cur,srcSec:bw?bw.dataset.binderSec:'all',t:null,emptySlotEl:null,pgBtn:null,after:false,y:e.clientY,w:card.offsetWidth};
  moveGhost(e);
  drag.timer=setInterval(()=>{if(drag.y<70)scrollBy(0,-14);else if(drag.y>innerHeight-70)scrollBy(0,14)},16);
});
window.addEventListener('pointermove',e=>{
  if(!drag)return;
  moveGhost(e);clearMarks();
  drag.t=null;drag.emptySlotEl=null;drag.pgBtn=null;
  const el=document.elementFromPoint(e.clientX,e.clientY);if(!el)return;
  const pgBtn=el.closest('[data-pg-set]');
  if(pgBtn&&pgBtn.dataset.pgSet===drag.srcSetId&&(pgBtn.dataset.pgSec||'all')===drag.srcSec){pgBtn.classList.add('drop-page');drag.pgBtn=pgBtn;return}
  const emptySlot=el.closest('.slot-empty');
  if(emptySlot){
    const bw=emptySlot.closest('.binder-wrap');
    if(bw&&bw.dataset.binderSet===drag.srcSetId&&(bw.dataset.binderSec||'all')===drag.srcSec){emptySlot.classList.add('drop-slot');drag.emptySlotEl=emptySlot;return}
  }
  const t=el.closest('.card:not(.ghost)');
  if(t&&t!==drag.card){
    const tSet=t.closest('.setbox'),tBw=t.closest('.binder-wrap');
    if((tSet?tSet.dataset.sid:S.cur)===drag.srcSetId&&(tBw?tBw.dataset.binderSec:'all')===drag.srcSec){
      drag.t=t;
      if(isBinder())t.classList.add('drop-swap');
      else{const r=t.getBoundingClientRect();drag.after=e.clientX>r.left+r.width/2;t.classList.add(drag.after?'dropA':'dropB')}
    }
  }
});
function endDrag(ok){
  if(!drag)return;
  clearInterval(drag.timer);drag.g.remove();clearMarks();
  if(ok){
    const found=findCard(drag.id);
    if(found){
      const sObj=found.s,cardObj=found.c,pocket=isPocket(cardObj);
      const secCards=sObj.cards.filter(c=>isPocket(c)===pocket);
      ensureSlots(secCards);
      if(drag.emptySlotEl&&isBinder()){
        const targetSlot=parseInt(drag.emptySlotEl.dataset.emptySlot,10);
        if(!isNaN(targetSlot)&&targetSlot>=0){cardObj.slot=targetSlot;save()}
      }else if(drag.pgBtn){
        const sec=drag.pgBtn.dataset.pgSec||'all',totPages=sectionTotalPages(sObj,sec,true),curP=getPage(sObj.id,sec,totPages);
        const targetPage=drag.pgBtn.dataset.pgTo?parseInt(drag.pgBtn.dataset.pgTo,10):curP+(parseInt(drag.pgBtn.dataset.pgDir,10)||0);
        const clamped=Math.max(1,Math.min(totPages,targetPage)),pageStart=(clamped-1)*PER_PAGE;
        const used=new Set(secCards.filter(c=>c!==cardObj).map(c=>c.slot));
        let chosen=-1;
        for(let k=pageStart;k<pageStart+PER_PAGE;k++)if(!used.has(k)){chosen=k;break}
        if(chosen===-1)chosen=nextFreeSlot(secCards.filter(c=>c!==cardObj),pageStart+PER_PAGE);
        cardObj.slot=chosen;
        setPage(sObj.id,sec,Math.floor(chosen/PER_PAGE)+1,sectionTotalPages(sObj,sec,true));
        save();
      }else if(drag.t){
        const targetCard=secCards.find(c=>c.id===drag.t.dataset.id);
        if(targetCard&&targetCard!==cardObj){
          if(isBinder()){const tmp=cardObj.slot;cardObj.slot=targetCard.slot;targetCard.slot=tmp;save()}
          else{
            const arr=sObj.cards,i=arr.findIndex(c=>c.id===cardObj.id),m=arr.splice(i,1)[0];
            let j=arr.findIndex(c=>c.id===targetCard.id);if(drag.after)j++;
            arr.splice(j,0,m);
            arr.filter(c=>isPocket(c)===pocket).forEach((c,idx)=>c.slot=idx);
            save();
          }
        }
      }
    }
  }
  drag=null;render();
}
window.addEventListener('pointerup',()=>endDrag(true));
window.addEventListener('pointercancel',()=>endDrag(false));

$('area').addEventListener('click',e=>{
  if(e.target.closest('[data-h]'))return;
  if(e.target.closest('[data-newset]')){$('newSet').click();return}
  const addPg=e.target.closest('[data-add-page]');
  if(addPg){
    const sObj=S.sets.find(y=>y.id===addPg.dataset.addPage),sec=addPg.dataset.sec||'all';
    if(!sObj)return;
    setExtraPages(sObj,sec,getExtraPages(sObj,sec)+1);
    const tot=sectionTotalPages(sObj,sec,true);
    setPage(sObj.id,sec,tot,tot);save();render();return;
  }
  const cmp=e.target.closest('[data-compact]');
  if(cmp){
    const sObj=S.sets.find(y=>y.id===cmp.dataset.compact),sec=cmp.dataset.sec||'all';
    if(!sObj)return;
    compactSlots(sec==='ph'?sObj.cards.filter(c=>!isPocket(c)):sec==='po'?sObj.cards.filter(isPocket):sObj.cards);
    setExtraPages(sObj,sec,0);
    const tot=sectionTotalPages(sObj,sec,true);
    setPage(sObj.id,sec,getPage(sObj.id,sec,tot),tot);save();render();return;
  }
  const pgBtn=e.target.closest('[data-pg-set]');
  if(pgBtn){
    const sid=pgBtn.dataset.pgSet,sec=pgBtn.dataset.pgSec||'all',sObj=S.sets.find(y=>y.id===sid);
    if(!sObj)return;
    const totPages=sectionTotalPages(sObj,sec,$('sort').value==='manual'&&$('filter').value==='all'&&!Q());
    const curP=getPage(sid,sec,totPages);
    setPage(sid,sec,pgBtn.dataset.pgTo?parseInt(pgBtn.dataset.pgTo,10):curP+(parseInt(pgBtn.dataset.pgDir,10)||0),totPages);
    render();return;
  }
  const ft=e.target.closest('[data-ftog]');if(ft){const f=S.folders.find(y=>y.id===ft.dataset.ftog);f.open=!(f.open!==false);save();render();return}
  const fe2=e.target.closest('[data-fedit]');if(fe2){openEdit('folder',fe2.dataset.fedit);return}
  const se2=e.target.closest('[data-sedit]');if(se2){openEdit('set',se2.dataset.sedit);return}
  const mv=e.target.closest('[data-mv]');if(mv){openMove(mv.dataset.mv);return}
  const fe=e.target.closest('[data-fexist]');if(fe){openAddExisting(fe.dataset.fexist);return}
  const fa=e.target.closest('[data-fadd]');if(fa){openNewSet(fa.dataset.fadd);return}
  const tg=e.target.closest('[data-tog]');if(tg){const x=S.sets.find(y=>y.id===tg.dataset.tog);x.open=!x.open;S.cur=x.id;save();render();return}
  const ad=e.target.closest('[data-add]');if(ad){S.cur=ad.dataset.add;save();render();openAdd();return}
  const ds=e.target.closest('[data-dels]');if(ds){const x=S.sets.find(y=>y.id===ds.dataset.dels);if(confirm(`Excluir o set "${x.name}" e todas as suas cartas?`)){S.sets=S.sets.filter(y=>y!==x);if(S.cur===x.id)S.cur=S.sets[0]?S.sets[0].id:null;save();render()}return}
  const o=e.target.closest('[data-open]');if(o){openDet(o.dataset.open);return}
  const d=e.target.closest('[data-del]');if(d){const r=findCard(d.dataset.del);if(r&&confirm('Remover esta carta do set?')){r.s.cards=r.s.cards.filter(c=>c!==r.c);save();render()}return}
  const el=e.target.closest('.card');if(!el)return;
  const r=findCard(el.dataset.id);if(r){r.c.owned=!r.c.owned;propagate(r.c,false);save();render()}
});
$('area').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('card')){e.preventDefault();e.target.click()}});
$('viewSel').onchange=e=>{S.view=e.target.value;save();render()};
$('expAll').onclick=()=>{S.folders.forEach(f=>f.open=true);S.sets.forEach(x=>x.open=true);save();render()};
$('colAll').onclick=()=>{S.folders.forEach(f=>f.open=false);S.sets.forEach(x=>x.open=false);save();render()};
$('setSel').onchange=e=>{S.cur=e.target.value;save();render()};
$('filter').onchange=()=>{resetPages();render()};
$('sort').onchange=()=>{
  if($('sort').value==='manual'){S.sets.forEach(s=>{ensureSlots(s.cards.filter(c=>!isPocket(c)));ensureSlots(s.cards.filter(isPocket))});save()}
  resetPages();render();
};
let qT=null;
$('cardQ').addEventListener('input',()=>{clearTimeout(qT);qT=setTimeout(()=>{resetPages();render()},120)});
$('cardQ').addEventListener('keydown',e=>{if(e.key==='Escape'){$('cardQ').value='';resetPages();render()}});
$('qAll').onclick=()=>{S.view='multi';save();render()};
$('viewSeg').onclick=e=>{const b=e.target.closest('button');if(b){S.view=b.dataset.v;save();render()}};
$('layoutSeg').onclick=e=>{const b=e.target.closest('button');if(b){S.layout=b.dataset.l;resetPages();save();render()}};
$('filterSeg').onclick=e=>{const b=e.target.closest('button');if(b){$('filter').value=b.dataset.f;resetPages();render()}};

document.addEventListener('keydown',e=>{
  if(!isBinder()||S.view==='multi'||document.querySelector('dialog[open]')||!$('lb').hidden)return;
  const tag=(e.target&&e.target.tagName)||'';
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'))return;
  const x=cur();if(!x||!x.cards.length)return;
  const sec=visible(x).some(isPocket)?'ph':'all';
  const totPages=sectionTotalPages(x,sec,$('sort').value==='manual'&&$('filter').value==='all'&&!Q());
  if(totPages<=1)return;
  const curP=getPage(x.id,sec,totPages),nextP=curP+(e.key==='ArrowRight'?1:-1);
  if(nextP>=1&&nextP<=totPages){setPage(x.id,sec,nextP,totPages);render()}
});
