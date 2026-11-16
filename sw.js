const VERSION='v12';
const SHELL='shell-'+VERSION, IMGS='imgs-v1';
const FILES=['./','index.html','manifest.json','icon-192.png','icon-512.png','icon-maskable-512.png'];
const MAX_IMGS=600;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SHELL&&k!==IMGS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function trim(cache){
  const keys=await cache.keys();
  if(keys.length>MAX_IMGS)await Promise.all(keys.slice(0,keys.length-MAX_IMGS).map(k=>cache.delete(k)));
}

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);

  // Dados da API: sempre da rede (sem cache)
  if(u.hostname==='api.pokemontcg.io')return;

  // Imagens de cartas: cache primeiro, guarda ao ver
  if(r.destination==='image'&&u.origin!==location.origin){
    e.respondWith(caches.open(IMGS).then(async c=>{
      const hit=await c.match(r);
      if(hit)return hit;
      try{const res=await fetch(r);if(res&&(res.ok||res.type==='opaque')){c.put(r,res.clone());trim(c)}return res}
      catch(err){return hit||Response.error()}
    }));
    return;
  }

  // Arquivos do app: rede primeiro (pega atualizações), cache se estiver offline
  if(u.origin===location.origin){
    e.respondWith(fetch(r).then(res=>{
      const copy=res.clone();caches.open(SHELL).then(c=>c.put(r,copy));return res;
    }).catch(()=>caches.match(r).then(h=>h||caches.match('index.html'))));
  }
});
