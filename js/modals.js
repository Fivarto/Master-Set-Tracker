function closeMenu(){$('menu').hidden=true;$('menuBtn').setAttribute('aria-expanded','false')}
$('menuBtn').onclick=()=>{const o=$('menu').hidden;$('menu').hidden=!o;$('menuBtn').setAttribute('aria-expanded',String(o))};
document.addEventListener('click',e=>{if(!e.target.closest('.menuwrap'))closeMenu()});
$('menu').addEventListener('click',e=>{if(e.target.closest('button'))closeMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});

function openNewSet(fid){
  $('nsFolder').innerHTML='<option value="">Sem pasta</option>'+S.folders.map(f=>`<option value="${f.id}">${esc(fIcon(f))} ${esc(f.name)}</option>`).join('');
  $('nsFolderRow').hidden=!S.folders.length;
  $('nsFolder').value=fid||(cur()&&cur().folder)||'';
  $('nsName').value='';$('nsDlg').showModal();$('nsName').focus();
}
function createSet(){
  const n=$('nsName').value.trim();if(!n){$('nsName').focus();return}
  const fid=$('nsFolder').value,x={id:uid(),name:n,cards:[]};
  if(fid){x.folder=fid;const f=S.folders.find(y=>y.id===fid);if(f)f.open=true}
  S.sets.push(x);S.cur=x.id;save();render();$('nsDlg').close();
  if($('orgDlg').open)orgRender();
}
function newFolder(){
  const n=prompt('Nome da pasta (ex.: Master Set Artistas):');if(!n||!n.trim())return;
  S.folders.push({id:uid(),name:n.trim(),open:true});save();render();
  if($('orgDlg').open)orgRender();
}
$('newSet').onclick=()=>openNewSet();$('newFolder').onclick=newFolder;
$('nsOk').onclick=createSet;$('nsClose').onclick=()=>$('nsDlg').close();
$('nsName').onkeydown=e=>{if(e.key==='Enter')createSet()};

$('syBtn').onclick=()=>{$('syOn').checked=S.sync!==false;$('syInfo').textContent=`${syncGroups().length} carta(s) aparecem em mais de um set.`;$('syDlg').showModal()};
$('syOn').onchange=e=>{S.sync=e.target.checked;save()};
$('syNow').onclick=()=>{const n=syncAll();save();render();$('syInfo').textContent=`${n} carta(s) atualizada(s). ${syncGroups().length} carta(s) aparecem em mais de um set.`};
$('syClose').onclick=()=>$('syDlg').close();

let ed=null;
const edItem=()=>ed&&(ed.kind==='folder'?S.folders.find(f=>f.id===ed.id):S.sets.find(x=>x.id===ed.id));
function markIcon(){const v=$('edIcon').value.trim();document.querySelectorAll('#edIcons .ico').forEach(b=>b.classList.toggle('on',b.dataset.ic===v))}
function openEdit(kind,id){
  ed={kind,id};const x=edItem();if(!x)return;
  $('edTitle').textContent=kind==='folder'?'Editar pasta':'Editar master set';
  $('edName').value=x.name;$('edIcon').value=x.icon||'';
  $('edNoIcon').textContent=kind==='folder'?'Padrão (📁)':'Sem ícone';
  $('edIcons').innerHTML=ICONS.map(i=>`<button type="button" class="ico" data-ic="${i}">${i}</button>`).join('');
  markIcon();$('edDlg').showModal();$('edName').focus();
}
function saveEdit(){
  const x=edItem(),n=$('edName').value.trim();if(!x)return;
  if(!n){$('edName').focus();return}
  x.name=n;const ic=Array.from($('edIcon').value.trim()).slice(0,12).join('');
  if(ic)x.icon=ic;else delete x.icon;
  save();render();$('edDlg').close();if($('orgDlg').open)orgRender();
}
$('edIcons').onclick=e=>{const b=e.target.closest('.ico');if(b){$('edIcon').value=b.dataset.ic;markIcon()}};
$('edIcon').oninput=markIcon;
$('edNoIcon').onclick=()=>{$('edIcon').value='';markIcon()};
$('edOk').onclick=saveEdit;$('edClose').onclick=()=>$('edDlg').close();
$('edName').onkeydown=e=>{if(e.key==='Enter')saveEdit()};
$('edCur').onclick=()=>{if(cur())openEdit('set',cur().id)};
$('edCurF').onclick=()=>{const c=cur();if(c&&c.folder)openEdit('folder',c.folder)};

let mvId=null,adF=null;
function openMove(id){
  const x=S.sets.find(y=>y.id===id);if(!x)return;mvId=id;
  const hasF=S.folders.some(f=>f.id===x.folder);
  $('mvTitle').textContent=`Mover “${x.name}” para…`;
  $('mvList').innerHTML=`<button class="mvopt" data-mf="" ${!hasF?'disabled':''}>Sem pasta${!hasF?' (atual)':''}</button>`
    +S.folders.map(f=>`<button class="mvopt" data-mf="${f.id}" ${f.id===x.folder?'disabled':''}>${esc(fIcon(f))} ${esc(f.name)}${f.id===x.folder?' (atual)':''}</button>`).join('')
    +'<button class="mvopt" data-mnew>+ Nova pasta…</button>';
  $('mvDlg').showModal();
}
$('mvList').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  const x=S.sets.find(y=>y.id===mvId);if(!x)return;
  if('mnew' in b.dataset){const n=prompt('Nome da nova pasta:');if(!n||!n.trim())return;const f={id:uid(),name:n.trim(),open:true};S.folders.push(f);x.folder=f.id}
  else if(b.dataset.mf){x.folder=b.dataset.mf;const f=S.folders.find(y=>y.id===x.folder);if(f)f.open=true}
  else delete x.folder;
  save();render();$('mvDlg').close();if($('orgDlg').open)orgRender();
});
$('mvClose').onclick=()=>$('mvDlg').close();
$('mvCur').onclick=()=>{if(cur())openMove(cur().id)};

function openAddExisting(fid){
  const f=S.folders.find(y=>y.id===fid);if(!f)return;adF=fid;
  $('adTitle').textContent=`Adicionar sets à pasta “${f.name}”`;
  const c=S.sets.filter(x=>x.folder!==fid);
  $('adList').innerHTML=c.length?c.map(x=>{const fo=S.folders.find(y=>y.id===x.folder);return `<label class="orow"><input type="checkbox" data-adx="${x.id}"><span>${esc(sName(x))} <small class="msg">${x.cards.length} cartas · ${fo?'em '+esc(fIcon(fo))+' '+esc(fo.name):'sem pasta'}</small></span></label>`}).join(''):'<div class="empty">Não há outros sets para adicionar. Crie um novo com “+ Set”.</div>';
  $('adOk').disabled=true;$('adOk').textContent='Adicionar';$('adDlg').showModal();
}
$('adList').addEventListener('change',()=>{const n=$('adList').querySelectorAll('input:checked').length;$('adOk').disabled=!n;$('adOk').textContent=n?`Adicionar (${n})`:'Adicionar'});
$('adOk').onclick=()=>{
  [...$('adList').querySelectorAll('input:checked')].forEach(i=>{const x=S.sets.find(y=>y.id===i.dataset.adx);if(x)x.folder=adF});
  const f=S.folders.find(y=>y.id===adF);if(f)f.open=true;
  save();render();$('adDlg').close();if($('orgDlg').open)orgRender();
};
$('adClose').onclick=()=>$('adDlg').close();

const fOpts=sel=>'<option value="">Sem pasta</option>'+S.folders.map(f=>`<option value="${f.id}" ${f.id===sel?'selected':''}>${esc(fIcon(f))} ${esc(f.name)}</option>`).join('');
const srow=x=>`<div class="orow srow"><span>${esc(sName(x))} <small class="msg">${x.cards.length} cartas</small></span><span class="sp"></span><select data-omv="${x.id}" aria-label="Mover para pasta">${fOpts(x.folder)}</select><button data-osren="${x.id}">Editar</button><button data-osdel="${x.id}">Excluir</button></div>`;
function orgRender(){
  let h='';
  S.folders.forEach(f=>{
    const ss=S.sets.filter(x=>x.folder===f.id);
    h+=`<div class="orow frow"><b>${esc(fIcon(f))} ${esc(f.name)}</b><small class="msg">${ss.length} sets</small><span class="sp"></span><button data-ofadd="${f.id}">+ Set</button><button data-ofexist="${f.id}">+ Existente</button><button data-ofren="${f.id}">Editar</button><button data-ofdel="${f.id}">Excluir pasta</button></div>`+(ss.map(srow).join('')||'<div class="msg" style="padding:6px 22px">Pasta vazia</div>');
  });
  const r=rootSets();
  if(r.length)h+=(S.folders.length?'<div class="orow frow"><b>Sem pasta</b></div>':'')+r.map(srow).join('');
  $('orgTree').innerHTML=h||'<div class="empty">Nada aqui ainda. Crie uma pasta ou um set.</div>';
}
$('orgBtn').onclick=()=>{orgRender();$('orgDlg').showModal()};
$('orgClose').onclick=()=>$('orgDlg').close();
$('orgNewF').onclick=newFolder;$('orgNewS').onclick=()=>openNewSet();
$('orgTree').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset,done=()=>{save();render();orgRender()};
  if(d.ofadd){openNewSet(d.ofadd);return}
  if(d.ofexist){openAddExisting(d.ofexist);return}
  if(d.ofren){openEdit('folder',d.ofren);return}
  if(d.ofdel){const f=S.folders.find(y=>y.id===d.ofdel);if(confirm(`Excluir a pasta "${f.name}"? Os sets dentro dela não serão apagados: ficam sem pasta.`)){S.sets.forEach(x=>{if(x.folder===f.id)delete x.folder});S.folders=S.folders.filter(y=>y!==f);done()}return}
  if(d.osren){openEdit('set',d.osren);return}
  if(d.osdel){const x=S.sets.find(y=>y.id===d.osdel);if(confirm(`Excluir o set "${x.name}" e todas as suas cartas?`)){S.sets=S.sets.filter(y=>y!==x);if(S.cur===x.id)S.cur=S.sets[0]?S.sets[0].id:null;done()}return}
});
$('orgTree').addEventListener('change',e=>{
  const id=e.target.dataset.omv;if(!id)return;
  const x=S.sets.find(y=>y.id===id);if(e.target.value)x.folder=e.target.value;else delete x.folder;
  save();render();orgRender();
});
$('delSet').onclick=()=>{const s=cur();if(s&&confirm(`Excluir o set "${s.name}" e todas as suas cartas?`)){S.sets=S.sets.filter(x=>x!==s);S.cur=S.sets[0]?S.sets[0].id:null;save();render()}};

$('expBtn').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'}));a.download='master-sets-backup.json';a.click()};
$('impBtn').onclick=()=>$('impFile').click();
$('impFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.sets)throw 0;if(confirm('Isso substitui os dados atuais. Continuar?')){S=d;S.folders=S.folders||[];if(!S.layout)S.layout='binder';if(!cur())S.cur=S.sets[0]?S.sets[0].id:null;resetPages();save();render()}}catch(x){alert('Arquivo de backup inválido.')}};r.readAsText(f);e.target.value=''};

const VMAP={normal:'Normal',unlimited:'Normal',holofoil:'Holo',unlimitedHolofoil:'Holo',reverseHolofoil:'Reverse Holo','1stEditionHolofoil':'Primeira edição','1stEditionNormal':'Primeira edição'};
function availPtcg(t){
  if(!t||!t.prices)return undefined;
  const a=new Set(Object.keys(t.prices).map(k=>VMAP[k]).filter(Boolean));
  return a.size?VERS.filter(n=>a.has(n)):undefined;
}
function availDex(v){
  if(!v)return undefined;
  const a=[];
  if(v.normal)a.push('Normal');if(v.holo)a.push('Holo');if(v.reverse)a.push('Reverse Holo');if(v.firstEdition)a.push('Primeira edição');if(v.wPromo)a.push('Promo');
  return a;
}
let dShowAll=false,dId=null,lbBack=false,lbList=[],lbI=0;
const dCard=()=>{const r=findCard(dId);return r&&r.c};
function versNames(c,v){
  const all=[...VERS,...Object.keys(v).filter(k=>!VERS.includes(k))];
  return (!c||!c.avail||dShowAll)?all:all.filter(n=>c.avail.includes(n)||n in v||n==='Outra');
}
function updVMsg(){
  const c=dCard();if(!c)return;
  $('dVMsg').textContent=!c.avail?'Versões existentes desta carta desconhecidas: mostrando todas.':dShowAll?'Mostrando todas as versões.':`Mostrando só as versões que existem para esta carta (fonte: ${c.availSrc||'base de dados'}).`;
  $('dAll').textContent=dShowAll?'Mostrar só as existentes':'Mostrar todas';$('dAll').hidden=!c.avail;
}
function updVTot(){const n=Object.values(readVers()).reduce((a,b)=>a+b,0);$('dVTot').textContent=n?`Total: ${n} carta${n>1?'s':''}`:''}
function renderVers(v){
  const names=versNames(dCard(),v);
  $('dVers').innerHTML=names.map(n=>{const on=n in v;return `<div class="vrow"><label><input type="checkbox" data-vn="${esc(n)}" ${on?'checked':''}> ${esc(n)}</label><input type="number" min="1" step="1" inputmode="numeric" data-vq="${esc(n)}" value="${v[n]||1}" aria-label="Quantidade de ${esc(n)}" ${on?'':'hidden'}></div>`}).join('')+'<div class="msg" id="dVTot"></div>';
  updVTot();updVMsg();
}
function readVers(){
  const vs={};
  $('dVers').querySelectorAll('input[data-vn]:checked').forEach(i=>{
    const q=$('dVers').querySelector(`input[data-vq="${CSS.escape(i.dataset.vn)}"]`);
    vs[i.dataset.vn]=Math.max(1,parseInt(q.value,10)||1);
  });
  return vs;
}
$('dAll').onclick=()=>{dShowAll=!dShowAll;renderVers(readVers())};
$('dRef').onclick=async()=>{
  const c=dCard();if(!c)return;const m=$('dVMsg');m.textContent='Consultando a internet…';
  try{
    let av,src;const k=c.key||'';
    if(k.startsWith('dex:')){const d=await dexJson(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(k.slice(4))}`);av=availDex(d.variants);src='TCGdex'}
    else if(k.includes('-')){const j=await dexJson(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(k)}?select=tcgplayer`);av=availPtcg(j.data&&j.data.tcgplayer);src='Pokémon TCG API'}
    else{m.textContent='Esta carta foi cadastrada manualmente, então não há como consultar as versões.';return}
    if(!av){m.textContent='A base de dados não informa as versões desta carta. Mostrando todas.';return}
    c.avail=av;c.availSrc=src;save();renderVers(readVers());
  }catch(e){m.textContent='Não consegui consultar agora ('+e.message+').'}
};
$('dCond').innerHTML=CONDS.map(v=>`<option value="${v}">${v||'Não informada'}</option>`).join('');
const big=c=>c.big||(c.img&&/images\.pokemontcg\.io/.test(c.img)?c.img.replace(/\.png$/,'_hires.png'):c.img);

function openDet(id){
  dId=id;const c=dCard();$('dPhys').hidden=isPocket(c);
  $('dName').textContent=c.name;$('dSub').textContent=`${c.set||''} ${c.num?'#'+c.num:''}`;
  $('dImg').src=c.img||'';$('dOwn').checked=!!c.owned;
  $('dCond').value=c.cond||'';dShowAll=false;renderVers(versOf(c));
  $('dPrice').value=c.price>0?c.price:'';$('dUrl').value=c.img||'';
  $('det').showModal();
}
function upd(){
  const c=dCard();if(!c)return;
  c.owned=$('dOwn').checked;c.cond=$('dCond').value;c.vers=readVers();delete c.ver;
  c.price=$('dPrice').value===''?'':parseFloat($('dPrice').value);
  const u=$('dUrl').value.trim();
  if(u!==(c.img||'')){c.img=u;c.big='';$('dImg').src=u}
  propagate(c,true);save();render();
}
['dOwn','dCond','dPrice','dUrl'].forEach(i=>$(i).addEventListener('change',upd));
$('dVers').addEventListener('change',e=>{
  const n=e.target.dataset.vn;
  if(n){const q=$('dVers').querySelector(`input[data-vq="${CSS.escape(n)}"]`);q.hidden=!e.target.checked;if(e.target.checked){$('dOwn').checked=true;if(!(parseInt(q.value,10)>0))q.value=1}}
  updVTot();upd();
});
$('dClose').onclick=()=>$('det').close();

function showLb(){
  const c=lbList[lbI],im=$('lbImg');
  im.onerror=()=>{im.onerror=null;im.src=c.img};
  im.src=big(c);
  $('lbCap').textContent=`${c.name} · ${c.set||''} ${c.num?'#'+c.num:''} · ${c.owned?'Na coleção':'Faltando'} (${lbI+1}/${lbList.length})`;
}
function openLb(id,fromDet){
  const r=findCard(id);lbList=r?visible(r.s):[];lbI=Math.max(0,lbList.findIndex(c=>c.id===id));
  lbBack=!!fromDet;if(fromDet)$('det').close();
  $('lb').hidden=false;showLb();
  if($('lb').requestFullscreen)$('lb').requestFullscreen().catch(()=>{});
}
function closeLb(){
  $('lb').hidden=true;
  if(document.fullscreenElement)document.exitFullscreen();
  if(lbBack){lbBack=false;$('det').showModal()}
}
function stepLb(d){if(!lbList.length)return;lbI=(lbI+d+lbList.length)%lbList.length;showLb()}
$('dFull').onclick=()=>openLb(dId,true);
$('dImg').onclick=()=>openLb(dId,true);
$('lbX').onclick=closeLb;$('lbPrev').onclick=()=>stepLb(-1);$('lbNext').onclick=()=>stepLb(1);
$('lb').addEventListener('click',e=>{if(e.target.id==='lb')closeLb()});
document.addEventListener('keydown',e=>{
  if($('lb').hidden)return;
  if(e.key==='Escape')closeLb();
  if(e.key==='ArrowLeft')stepLb(-1);
  if(e.key==='ArrowRight')stepLb(1);
});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&!$('lb').hidden)closeLb()});
