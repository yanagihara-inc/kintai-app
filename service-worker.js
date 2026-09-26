const CACHE='rakuraku-kintai-shell-v29';
const APP_FILES=['./','./index.html','./app-config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_FILES)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const saved=await cache.match(event.request);
    const fresh=fetch(event.request).then(response=>{if(response.ok)cache.put(event.request,response.clone());return response;});
    if(saved){event.waitUntil(fresh.catch(()=>null));return saved;}
    return fresh;
  }));
});
