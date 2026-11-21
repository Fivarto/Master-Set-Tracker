const dlg=$('dlg');
let results=[],picked=new Set(),page=1,lastQ='',lastArtist='',loaded=0,total=0,netTok=0,sid=0;
const sig=c=>norm(c.name)+'|'+(parseInt(c.num,10)||norm(c.num));
const inSet=c=>cur().cards.some(x=>x.key===c.key||sig(x)===sig(c));

function openAdd(){
  if(!cur()){alert('Crie um master set primeiro.');return}
  $('tgt').innerHTML=setOptions(S.cur);$('tgt').value=S.cur;
  dlg.showModal();
}
$('addBtn').onclick=openAdd;
$('tgt').onchange=e=>{S.cur=e.target.value;save();render();drawRes()};
$('close').onclick=()=>{netTok++;dlg.close()};
$('netStop').onclick=()=>{netTok++;$('netStop').hidden=true};
function tab(api){$('pApi').hidden=!api;$('pMan').hidden=api;$('tApi').classList.toggle('on',api);$('tMan').classList.toggle('on',!api)}
$('tApi').onclick=()=>tab(true);$('tMan').onclick=()=>tab(false);
$('mode').onchange=()=>{const m=$('mode').value;$('qn').hidden=m!=='set';$('q').placeholder=m==='artist'?'Ex.: Mitsuhiro Arita':m==='name'?'Ex.: Pikachu':'Coleção (nome ou código). Ex.: Base Set, sv3pt5'};
$('modeSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;$('mode').value=b.dataset.m;$('mode').onchange();document.querySelectorAll('#modeSeg button').forEach(x=>x.classList.toggle('on',x===b))};

function candidates(){
  const m=$('mode').value,v=$('q').value.trim();if(!v)return [];
  if(m==='artist')return [`artist:"${v}"`];
  if(m==='name')return [`name:"${v}"`];
  const n=$('qn').value.trim().split('/')[0].trim(),dig=/^\d+$/.test(n);
  const nums=n?[...new Set([n,dig&&n.padStart(3,'0'),dig&&String(parseInt(n,10))].filter(Boolean))]:[''];
  const words=v.split(/\s+/).map(w=>w.replace(/[^\p{L}\p{N}]/gu,'')).filter(Boolean);
  const sets=[];
  if(words.length===1)sets.push(`set.id:"${words[0].toLowerCase()}"`,`set.ptcgoCode:"${words[0].toUpperCase()}"`);
  if(words.length)sets.push(words.map(w=>`set.name:${w}*`).join(' '));
  const out=[];
  sets.forEach(sq=>nums.forEach(nn=>out.push(nn?`${sq} number:"${nn}"`:sq)));
  return out;
}
const sleepC=(ms,tok)=>new Promise(res=>{const t0=Date.now(),iv=setInterval(()=>{if(tok!==netTok||Date.now()-t0>=ms){clearInterval(iv);res()}},200)});
async function getJson(url,o){
  const max=(o&&o.max)||Infinity,ui=!!(o&&o.ui),tok=netTok;let n=0,err='';
  for(;;){
    if(tok!==netTok)throw new Error('cancelado');
    n++;
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),Math.min(20000+n*5000,45000));
    try{
      const r=await fetch(url,{signal:ctl.signal});
      if(r.ok){const j=await r.json();clearTimeout(t);return j}
      clearTimeout(t);
      if(r.status>=400&&r.status<500&&r.status!==429&&r.status!==408)throw Object.assign(new Error('HTTP '+r.status),{fatal:true});
      err='HTTP '+r.status;
    }catch(e){
      clearTimeout(t);
      if(e.fatal)throw e;
      err=!navigator.onLine?'sem internet':e.name==='AbortError'?'tempo esgotado':'sem resposta';
    }
    if(n>=max)throw new Error(err);
    const wait=Math.min(1500*Math.pow(1.6,n-1),10000);
    if(ui){const m=$('apiMsg');m.className='msg';m.textContent=`A API não respondeu (${err}). Tentativa ${n+1} em ${Math.ceil(wait/1000)}s… Toque em “Parar de tentar” para cancelar.`}
    await sleepC(wait,tok);
  }
}
const fetchPage=(q,pg)=>getJson(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=100&page=${pg}&orderBy=set.releaseDate&select=id,name,number,images,set,artist,tcgplayer`,{ui:true});
function lev(a,b){const m=a.length,n=b.length,d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=1;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
function similar(x,y){
  const a=norm(x),b=norm(y);if(!a||!b)return false;
  const tol=Math.max(2,Math.round(b.length*.15)),r=b.split(' ').reverse().join(' ');
  return a===b||lev(a,b)<=tol||lev(a,r)<=tol;
}
function fuzzyQ(v){
  const w=norm(v).split(' ').filter(x=>x.length>1);if(!w.length)return '';
  const p=x=>`artist:${x.slice(0,3)}*`;
  return w.length>1?`${p(w[0])} ${p(w[w.length-1])}`:p(w[0]);
}
async function search(more){netTok++;$('netStop').hidden=false;try{await searchInner(more)}finally{$('netStop').hidden=true}}
async function searchInner(more){
  const m=$('apiMsg');m.className='msg';const mode=$('mode').value;let cs=[];
  if(!more){
    cs=candidates();
    if(!cs.length){m.textContent=mode==='set'?'Informe a coleção (nome ou código).':'Digite algo para buscar.';return}
    results=[];picked=new Set();page=1;lastQ='';loaded=0;total=0;lastArtist=$('q').value.trim();sid++;
  }else page++;
  m.textContent='Buscando…';
  try{
    let data=[],tot=0,exactN=0,err=null,found=false;
    if(more){const t=await fetchPage(lastQ,page);data=t.data;tot=t.totalCount;exactN=data.length;found=true}
    else if(mode==='artist'){
      const fq=fuzzyQ(lastArtist),rs=await Promise.allSettled([fetchPage(cs[0],1),fq?fetchPage(fq,1):Promise.resolve({data:[],totalCount:0})]);
      if(rs[0].status==='fulfilled'){data=rs[0].value.data;tot=rs[0].value.totalCount;exactN=data.length;lastQ=cs[0]}else err=rs[0].reason;
      if(rs[1].status==='fulfilled')data=data.concat(rs[1].value.data.filter(c=>similar(c.artist,lastArtist)));
      found=data.length>0;
    }else for(const q of cs){
      try{const t=await fetchPage(q,1);if(t.totalCount>0){data=t.data;tot=t.totalCount;exactN=data.length;lastQ=q;found=true;break}}catch(e){err=e}
    }
    if(!found){
      if(err)throw err;
      $('res').innerHTML='';$('more').hidden=true;updateSel();
      if(mode==='artist'&&!more){m.textContent='Nenhuma carta na base principal.';enrich(lastArtist,sid);return}
      m.textContent=mode==='set'?'Nenhuma carta encontrada. Tente o código da coleção (ex.: MEP, SVP, sv3pt5) ou só parte do nome.':'Nenhuma carta encontrada.';
      return;
    }
    loaded+=exactN;if(!more||tot)total=tot;
    const seen=new Set(results.map(c=>c.key));
    data.forEach(c=>{if(seen.has(c.id))return;seen.add(c.id);results.push({key:c.id,name:c.name,set:c.set.name,num:c.number,img:c.images.small,big:c.images.large,date:c.set.releaseDate,avail:availPtcg(c.tcgplayer),availSrc:'Pokémon TCG API',alt:mode==='artist'?(norm(c.artist)!==norm(lastArtist)?c.artist:''):(c.artist||'')})});
    results.sort((a,b)=>(a.date||'').localeCompare(b.date||'')||String(a.num).localeCompare(String(b.num),undefined,{numeric:true}));
    const alts=mode==='artist'?results.filter(c=>c.alt).length:0;
    m.textContent=`${results.length} cartas encontradas.`+(loaded<total?' Use “Carregar mais” para ver o resto.':'')+(alts?` ${alts} com nome do ilustrador diferente na base.`:'')+' Clique nas cartas para selecionar.';
    $('more').hidden=loaded>=total;drawRes();
    if(mode==='artist'&&!more)enrich(lastArtist,sid);
  }catch(e){m.className=e.message==='cancelado'?'msg':'msg err';m.textContent=e.message==='cancelado'?'Busca interrompida.':'Falha na busca ('+e.message+').'}
}
const dexSets={};
const dexJson=u=>getJson(u,{max:4});
async function enrich(name,id){
  const m=$('apiMsg'),base=' Consultando a segunda base (TCGdex)…';m.textContent+=base;
  try{
    const j=await dexJson(`https://api.tcgdex.net/v2/en/illustrators/${encodeURIComponent(name)}`),list=Array.isArray(j)?j:(j.cards||[]);
    if(id!==sid)return;
    const known=new Set(results.map(sig)),todo=list.filter(b=>b.id&&!known.has(norm(b.name)+'|'+(parseInt(b.localId,10)||norm(b.localId)))),add=[];
    for(let i=0;i<todo.length;i+=6){
      const part=await Promise.all(todo.slice(i,i+6).map(async b=>{
        try{
          const d=await dexJson(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(b.id)}`),si=d.set&&d.set.id;
          if(si&&!dexSets[si])dexSets[si]=dexJson(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(si)}`).then(x=>({date:x.releaseDate||'',pocket:!!(x.serie&&x.serie.id==='tcgp')}),()=>({date:'',pocket:false}));
          const ds=si?await dexSets[si]:{date:'',pocket:false};
          return {key:'dex:'+d.id,name:d.name,set:d.set?d.set.name:'',num:d.localId,img:d.image?d.image+'/low.webp':'',big:d.image?d.image+'/high.webp':'',date:ds.date?ds.date.replace(/-/g,'/'):'9999',pocket:ds.pocket||/^((P-)?[AB]\d+[a-z]?-|P-[AB]-)/i.test(d.id),alt:'',src:'TCGdex',avail:availDex(d.variants),availSrc:'TCGdex'};
        }catch(e){return null}
      }));
      add.push(...part.filter(Boolean));
    }
    if(id!==sid)return;
    let n=0;add.forEach(c=>{if(!results.some(r=>sig(r)===sig(c))){results.push(c);n++}});
    results.sort((a,b)=>(a.date||'').localeCompare(b.date||'')||String(a.num).localeCompare(String(b.num),undefined,{numeric:true}));
    m.textContent=m.textContent.replace(base,n?` ${n} carta(s) vieram da segunda base (TCGdex).`:' A segunda base (TCGdex) não trouxe cartas novas.');
    drawRes();
  }catch(e){if(id===sid)m.textContent=m.textContent.replace(base,' Não consegui consultar a segunda base (TCGdex).')}
}

let tessP=null,tessW=null,termT=null;
function loadTess(){return tessP||(tessP=new Promise((ok,no)=>{if(window.Tesseract)return ok();const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';sc.onload=ok;sc.onerror=()=>{tessP=null;no(new Error('não consegui carregar o leitor de texto'))};document.head.appendChild(sc)}))}
async function getWorker(){await loadTess();if(!tessW)tessW=await Tesseract.createWorker('eng');clearTimeout(termT);termT=setTimeout(()=>{if(tessW){tessW.terminate();tessW=null}},90000);return tessW}
async function loadImg(file){const u=URL.createObjectURL(file),im=new Image();im.src=u;await im.decode();return im}
function cropCanvas(im,y0,y1,maxW){
  const sw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,sy=ih*y0,sh=ih*(y1-y0),k=Math.min((maxW||2200)/sw,2.5);
  const c=document.createElement('canvas');c.width=Math.round(sw*k);c.height=Math.max(1,Math.round(sh*k));
  const x=c.getContext('2d');x.filter='grayscale(1) contrast(1.5)';x.drawImage(im,0,sy,sw,sh,0,0,c.width,c.height);return c;
}
const STOP=new Set(['EN','JP','PT','ES','FR','DE','IT','TCG','HP','ILLUS','NINTENDO','CREATURES','GAME','FREAK','POKEMON','ETC','THE','AND','NAME']);
function guessName(t){
  for(let l of String(t||'').split('\n')){
    l=l.replace(/\b(BASIC|STAGE\s*[12]|FASE\s*[12]|B[AÁ]SICO)\b/gi,' ').split(/\bHP\b|\s\d{2,3}\s*\S?$/i)[0].replace(/[^A-Za-zÀ-ÿ'’\- ]/g,' ').replace(/\s+/g,' ').trim();
    if(l.replace(/[^A-Za-z]/g,'').length>=3)return l;
  }
  return '';
}
function parseScan(foot,head,full){
  const U=(String(foot||'')+'\n'+String(full||'')).toUpperCase();
  let num='',tot='',codes=[];
  const m=U.match(/\b([A-Z]{0,4}\d{1,3})\s*[\/\\|]\s*([A-Z]{0,4}\d{2,3})\b/);
  if(m){
    num=m[1];tot=m[2].replace(/\D/g,'');
    const ls=U.lastIndexOf('\n',m.index)+1,le=U.indexOf('\n',m.index),line=U.slice(ls,le<0?U.length:le),pos=m.index-ls,toks=[];let t,re=/\b[A-Z][A-Z0-9]{1,4}\b/g;
    while((t=re.exec(line)))if(!STOP.has(t[0])&&t[0]!==m[1]&&t[0]!==m[2])toks.push({v:t[0],d:Math.abs(t.index-pos)});
    toks.sort((a,b)=>a.d-b.d).forEach(x=>{if(!codes.includes(x.v))codes.push(x.v)});
  }else{
    const p=U.match(/\b(SVP|MEP|SWSH|SM|XY|BW|HGSS|DP)\s*(?:EN\s*)?(\d{1,3})\b/);
    if(p){if(p[1]==='SVP'||p[1]==='MEP'){num=p[2];codes=[p[1]]}else num=p[1]+p[2].padStart(3,'0')}
  }
  return {num,tot,codes:codes.slice(0,3),name:guessName(head)||guessName(full)};
}
const numVariants=n=>/^\d+$/.test(n)?[...new Set([n,String(parseInt(n,10)),n.padStart(3,'0')])]:[n];
function scanQueries(p){
  const q=[];
  if(p.num){
    const ns=numVariants(p.num);
    p.codes.forEach(c=>ns.forEach(n=>q.push(`set.ptcgoCode:"${c}" number:"${n}"`)));
    if(p.tot)ns.forEach(n=>q.push(`set.printedTotal:${p.tot} number:"${n}"`));
    if(p.name)ns.forEach(n=>q.push(`name:"${p.name}" number:"${n}"`));
    if(/^[A-Z]+\d+$/.test(p.num)&&!p.tot)ns.forEach(n=>q.push(`number:"${n}"`));
  }
  if(p.name)q.push(`name:"${p.name}"`);
  return q;
}
async function scanFile(file){
  const m=$('apiMsg');m.className='msg';m.textContent='Preparando a foto…';
  try{const im=await createImageBitmap(file,{resizeWidth:2400,resizeQuality:'medium'}).catch(()=>loadImg(file));await scanRun({foot:cropCanvas(im,.76,1,2000),head:cropCanvas(im,0,.16,2000),full:()=>cropCanvas(im,0,1,1600)})}
  catch(e){m.className='msg err';m.textContent='Não consegui abrir a foto ('+e.message+').'}
}
async function scanRun(src){
  const m=$('apiMsg');m.className='msg';sid++;netTok++;$('netStop').hidden=false;
  try{
    m.textContent='Carregando o leitor de texto…';const w=await getWorker();m.textContent='Lendo a carta…';
    await w.setParameters({tessedit_pageseg_mode:'6'});
    const foot=(await w.recognize(src.foot)).data.text,head=(await w.recognize(src.head)).data.text;let full='';
    if(!/\d{1,3}\s*[\/\\|]\s*\d{2,3}/.test(foot)){await w.setParameters({tessedit_pageseg_mode:'11'});full=(await w.recognize(src.full())).data.text}
    $('scanTxt').textContent=`[rodapé]\n${foot}\n[topo]\n${head}`+(full?`\n[carta inteira]\n${full}`:'');$('scanDbg').hidden=false;
    const p=parseScan(foot,head,full);
    if(!p.num&&!p.name){m.className='msg err';m.textContent='Não consegui ler número nem nome. Tente com mais luz e sem reflexo.';return}
    const lido=`Li: ${p.num?'nº '+p.num+(p.tot?'/'+p.tot:''):'sem número'}${p.codes.length?', código '+p.codes.join(' ou '):''}${p.name?', nome “'+p.name+'”':''}.`;
    if(p.num&&p.codes.length){document.querySelector('#modeSeg [data-m=set]').click();$('q').value=p.codes[0];$('qn').value=p.num}
    else if(p.name){document.querySelector('#modeSeg [data-m=name]').click();$('q').value=p.name}
    m.textContent=lido+' Buscando…';
    const rs=await Promise.allSettled(scanQueries(p).map(q=>fetchPage(q,1)));
    if(rs.length&&rs.every(r=>r.status==='rejected'))throw rs[0].reason;
    const ok=rs.find(r=>r.status==='fulfilled'&&r.value.totalCount>0);
    results=[];picked=new Set();loaded=0;total=0;$('more').hidden=true;
    if(!ok){$('res').innerHTML='';updateSel();m.className='msg err';m.textContent=lido+' Nenhuma carta encontrada na base.';return}
    results=ok.value.data.map(c=>({key:c.id,name:c.name,set:c.set.name,num:c.number,img:c.images.small,big:c.images.large,date:c.set.releaseDate,avail:availPtcg(c.tcgplayer),availSrc:'Pokémon TCG API',alt:c.artist||''}));
    results.sort((a,b)=>(a.date||'').localeCompare(b.date||'')||String(a.num).localeCompare(String(b.num),undefined,{numeric:true}));
    m.textContent=lido+` ${results.length} carta(s) encontrada(s).`;drawRes();
    if(results.length===1){picked.add(results[0].key);drawRes()}
  }catch(e){m.className=e.message==='cancelado'?'msg':'msg err';m.textContent=e.message==='cancelado'?'Busca interrompida.':'Falha no scan ('+e.message+').'}finally{$('netStop').hidden=true}
}

let camStream=null,camRect=null;
function stopCam(){if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null}$('camV').srcObject=null}
function layoutGuide(){
  const v=$('camV');if(!v.videoWidth)return;
  const cw=v.clientWidth,ch=v.clientHeight,vw=v.videoWidth,vh=v.videoHeight,sc=Math.min(cw/vw,ch/vh),ox=(cw-vw*sc)/2,oy=(ch-vh*sc)/2;
  let gh=vh*.9,gw=gh*63/88;if(gw>vw*.94){gw=vw*.94;gh=gw*88/63}
  const gx=(vw-gw)/2,gy=(vh-gh)/2,g=$('camG').style;
  camRect={x:gx,y:gy,w:gw,h:gh};g.left=ox+gx*sc+'px';g.top=oy+gy*sc+'px';g.width=gw*sc+'px';g.height=gh*sc+'px';
}
async function openCam(){
  const m=$('apiMsg');
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){m.className='msg err';m.textContent='Navegador sem câmera direta. Use “Usar foto”.';return}
  try{camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:4096},height:{ideal:4096}},audio:false})}
  catch(e){m.className='msg err';m.textContent='Não consegui abrir a câmera ('+(e.name||e.message)+').';return}
  const v=$('camV');v.srcObject=camStream;$('cam').showModal();try{await v.play()}catch(e){}layoutGuide();
}
$('camV').addEventListener('loadedmetadata',layoutGuide);
window.addEventListener('resize',()=>{if($('cam').open)layoutGuide()});
$('cam').addEventListener('close',stopCam);
$('camCancel').onclick=()=>$('cam').close();
$('camShot').onclick=()=>{
  const v=$('camV'),r=camRect;if(!r||!v.videoWidth)return;
  const strip=(y0,y1,maxW)=>{const sh=r.h*(y1-y0),k=Math.min(maxW/r.w,2.5),c=document.createElement('canvas');c.width=Math.round(r.w*k);c.height=Math.max(1,Math.round(sh*k));const x=c.getContext('2d');x.filter='grayscale(1) contrast(1.5)';x.drawImage(v,r.x,r.y+r.h*y0,r.w,sh,0,0,c.width,c.height);return c};
  const foot=strip(.78,1,2000),head=strip(0,.14,2000),full=strip(0,1,1600);
  $('cam').close();scanRun({foot,head,full:()=>full});
};
$('scanBtn').onclick=openCam;
$('scanPick').onclick=()=>$('scanFile').click();
$('scanFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)scanFile(f)};

function updateSel(){const n=picked.size;$('addSel').disabled=!n;$('addSel').textContent=n?`Adicionar (${n})`:'Adicionar selecionadas'}
function drawRes(){
  const ph=results.filter(c=>!isPocket(c)),po=results.filter(isPocket);
  $('res').innerHTML=[...ph,...po].map((c,i)=>{const h=inSet(c),on=picked.has(c.key);
    const hd=po.length?(i===0&&ph.length?`<h3 class="sech">Cartas físicas (TCG) · ${ph.length}</h3>`:'')+(i===ph.length?`<h3 class="sech">TCG Pocket (digital) · ${po.length}</h3>`:''):'';
    return hd+`<label class="rc ${on?'on':''} ${h?'have':''}" title="${esc(c.name)}"><input type="checkbox" data-k="${c.key}" ${on?'checked':''} ${h?'disabled':''}><span class="rimg"><img loading="lazy" src="${esc(c.img)}" alt="${esc(c.name)}"></span><span class="rn">${esc(c.name)}</span><span class="rs">${esc(c.set)} #${esc(c.num)}</span>${c.alt?`<span class="rs">Ilustr.: ${esc(c.alt)}</span>`:''}${c.src?`<span class="rs">Fonte: ${esc(c.src)}</span>`:''}${h?'<span class="tagin">No set</span>':''}</label>`}).join('');
  updateSel();
}
$('res').addEventListener('change',e=>{const k=e.target.dataset.k;e.target.checked?picked.add(k):picked.delete(k);e.target.parentNode.classList.toggle('on',e.target.checked);updateSel()});
$('go').onclick=()=>search(false);
$('q').onkeydown=$('qn').onkeydown=e=>{if(e.key==='Enter')search(false)};
$('more').onclick=()=>search(true);
$('selAll').onclick=()=>{const ks=results.filter(c=>!inSet(c)).map(c=>c.key),all=ks.length&&ks.every(k=>picked.has(k));picked=new Set(all?[]:ks);drawRes()};
$('addSel').onclick=()=>{
  const s=cur();let n=0;
  results.filter(c=>picked.has(c.key)&&!inSet(c)).forEach(c=>{
    const pocket=isPocket(c),slot=nextFreeSlot(s.cards.filter(x=>isPocket(x)===pocket),0);
    const nc={id:uid(),key:c.key,name:c.name,set:c.set,num:c.num,img:c.img,big:c.big,date:c.date,pocket,avail:c.avail,availSrc:c.availSrc,owned:false,slot};
    s.cards.push(nc);adopt(nc);n++;
  });
  save();render();picked=new Set();drawRes();$('apiMsg').textContent=`${n} carta(s) adicionada(s).`;
};

$('mAdd').onclick=async()=>{
  const name=$('mName').value.trim();if(!name){alert('Informe o nome da carta.');return}
  const set=$('mSet').value.trim(),num=$('mNum').value.trim();let img=$('mImg').value.trim();
  if(!img){
    try{
      const q=`name:"${name}"`+(num?` number:"${num}"`:'');
      const j=await (await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1&select=images`)).json();
      if(j.data&&j.data[0])img=j.data[0].images.small;
    }catch(e){}
  }
  const s=cur(),slot=nextFreeSlot(s.cards.filter(x=>!isPocket(x)),0);
  s.cards.push({id:uid(),key:'m'+uid(),name,set,num,img,owned:false,slot});
  save();render();['mName','mSet','mNum','mImg'].forEach(i=>$(i).value='');
  if(!img)alert('Carta adicionada, mas não achei uma imagem. Você pode removê-la e cadastrar de novo com uma URL.');
};

if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(()=>{})}

render();
