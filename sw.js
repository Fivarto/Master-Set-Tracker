const VERSION='v23';
const SHELL='shell-'+VERSION, IMGS='imgs-v1';
const FILES=[
  './','index.html','styles.css','manifest.json',
  'icon-192.png','icon-512.png','icon-maskable-512.png',
  'js/core.js','js/binder.js','js/modals.js','js/scan-api.js'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==SHELL&&k!==IMGS).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    e.respondWith(caches.match(r,{ignoreSearch:true}).then(h=>h||fetch(r)));
    return;
  }
  if(/images\.pokemontcg\.io|assets\.tcgdex\.net/.test(u.hostname)){
    e.respondWith(caches.open(IMGS).then(c=>c.match(r).then(h=>{
      if(h)return h;
      return fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res}).catch(()=>new Response('',{status:504}));
    })));
  }
});
