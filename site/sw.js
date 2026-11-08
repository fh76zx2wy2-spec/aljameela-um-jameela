const CACHE='um-jameela-github-v4';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./push.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 if(e.request.mode==='navigate'){
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();void caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));return;
 }
 if(new URL(e.request.url).pathname.endsWith('/push-config.js')){e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return;}
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
self.addEventListener('push',e=>{
 let data={};try{data=e.data?.json()||{}}catch{data={title:'الجميلة أم جميلة ♥️',body:e.data?.text()||'أسبوع جديد من رحلتكِ الجميلة'}}
 const title=String(data.title||'الجميلة أم جميلة ♥️').slice(0,100);
 const body=String(data.body||'هيا لاكتشاف ما يحمله الأسبوع الجديد ♥').slice(0,200);
 const week=Number(data.week)||0;
 e.waitUntil(self.registration.showNotification(title,{body,icon:'./icon-192.png',badge:'./icon-192.png',tag:'umj-week-'+(week||'news'),renotify:false,data:{url:'./'},lang:'ar',dir:'rtl'}));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 const dest=new URL('./',self.registration.scope).href;
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  for(const c of clients){if(c.url.startsWith(self.registration.scope)){await c.focus();return}}
  return self.clients.openWindow(dest);
 }));
});
