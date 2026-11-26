/* Serves imported web games (unzipped into the browser cache) to the game frame. */
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin===location.origin&&u.pathname.includes('/__g/')){
    e.respondWith((async()=>{const c=await caches.open('narrow-games');const r=await c.match(e.request,{ignoreSearch:true});return r||new Response('Not found',{status:404})})());
  }
});
