/* Installation-aware iOS Web Push. Pregnancy journal continues to work without cloud setup. */
const cfg = window.UMJ_PUSH_CONFIG || {};
const statusKey = 'umj-push-enabled-v1';
const dueKey = 'umj-push-due-v1';
const profileStorage = 'um-jameela-2026-v1';
let clientPromise;
let syncing = false;
function configured(){return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl || '') && !!cfg.supabasePublishableKey && !!cfg.vapidPublicKey}
function profile(){try{return JSON.parse(localStorage.getItem(profileStorage)||'{}').profile || null}catch{return null}}
function dueDate(p){if(!p || !/^\d{4}-\d{2}-\d{2}$/.test(p.date||''))return null;const d=new Date(p.date+'T12:00:00.000Z');if(!Number.isFinite(d.getTime()))return null;if(p.mode==='lmp')d.setUTCDate(d.getUTCDate()+280);return d.toISOString().slice(0,10)}
function installed(){return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true}
function isiOS(){return /iPhone|iPad|iPod/.test(navigator.userAgent)}
function pushSupported(){return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window) && location.protocol==='https:'}
function notice(message){if(typeof window.toast==='function')window.toast(message);else alert(message)}
function statusLabel(){if(!configured())return 'الإشعارات تنتظر ربط خدمة Supabase. بقية التطبيق تعمل دونها.';
if(isiOS()&&!installed())return 'لتصلكِ إشعارات الآيفون: افتحي الرابط في Safari ثم أضيفيه إلى الشاشة الرئيسية.';
if(!pushSupported())return 'متصفحكِ لا يدعم الإشعارات في هذا الوضع.';
if(Notification.permission==='denied')return 'الإشعارات محظورة من إعدادات الجهاز؛ يمكنكِ السماح بها من إعدادات الآيفون.';
if(localStorage.getItem(statusKey)==='1' && Notification.permission==='granted')return 'الإشعارات مفعّلة على هذا الجهاز ✓';
return 'لم تُفعّل إشعارات التطبيق بعد.'}
window.umjRefreshPushUI=()=>document.querySelectorAll('[data-umj-push-status]').forEach(node=>{node.textContent=statusLabel()});
function b64url(bytes){const s=bytes.replace(/-/g,'+').replace(/_/g,'/');const p=s+'='.repeat((4-s.length%4)%4);const raw=atob(p);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function client(){if(!clientPromise){clientPromise=import('https://esm.sh/@supabase/supabase-js@2.81.1').then(({createClient})=>createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}));}return clientPromise}
async function authenticatedClient(){const c=await client();let {data:{session},error}=await c.auth.getSession();if(error)throw error;if(!session){const result=await c.auth.signInAnonymously();if(result.error)throw result.error;session=result.data.session;}if(!session)throw new Error('تعذّر إنشاء جلسة آمنة.');return c}
async function register(subscription, action, due){const c=await authenticatedClient();const r=await c.functions.invoke('umj-register-push',{body:{action,subscription:subscription.toJSON(),dueDate:due}});if(r.error)throw r.error;return r.data}
async function refreshServer(){if(syncing||!configured()||localStorage.getItem(statusKey)!=='1'||!pushSupported()||Notification.permission!=='granted'||!profile())return;
  const due=dueDate(profile());if(!due)return;
  syncing=true;
  try {const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(!sub){localStorage.removeItem(statusKey);return;}await register(sub,'subscribe',due);localStorage.setItem(dueKey,due)}
  catch(err){console.warn('Notification resync needed',err)} finally{syncing=false;window.umjRefreshPushUI?.()}
}
window.umjSyncPush=()=>{void refreshServer()};
window.umjEnablePush=async()=>{
 if(!profile())return notice('أدخلي موعد الولادة المتوقع أولًا.');
 if(!configured())return notice('يلزم إعداد خدمة الإرسال أولًا من مالك التطبيق. لا يمكن إرسال إشعار قبل ربط Supabase.');
 if(isiOS()&&!installed())return notice('لآيفون: افتحي الرابط في Safari ثم مشاركة ← إضافة إلى الشاشة الرئيسية، وبعدها افتحي التطبيق من أيقونته واضغطي التفعيل.');
 if(!pushSupported())return notice('يحتاج هذا الجهاز إلى تطبيق ويب مثبت يدعم الإشعارات واتصال HTTPS.');
 if(Notification.permission==='denied')return notice('السماح بالإشعارات مرفوض من إعدادات الجهاز. افتحي الإعدادات ثم الإشعارات واسم التطبيق.');
 try{
  // Permission request is intentionally first async operation after a direct user tap.
  const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(permission!=='granted')return notice('لن نرسل أي إشعارات دون موافقتكِ.');
  await navigator.serviceWorker.register('./sw.js',{scope:'./'});
  const reg=await navigator.serviceWorker.ready;
  const key=b64url(cfg.vapidPublicKey);
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  const due=dueDate(profile());
  await register(sub,'subscribe',due);
  localStorage.setItem(statusKey,'1');localStorage.setItem(dueKey,due);
  notice('تم تفعيل تنبيهات الأسبوع الجديد ♥');window.umjRefreshPushUI?.();
 }catch(err){console.error('Web Push activation failed',err);notice('لم تُكتمل عملية الربط. راجعي اتصال الإنترنت وإعداد Supabase وجربي مجددًا.');}
};
window.umjDisablePush=async()=>{
 try{
  if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration('./');const sub=await reg?.pushManager.getSubscription();if(sub){if(configured()){try{await register(sub,'unsubscribe',dueDate(profile()))}catch(err){console.warn('Server unsubscribe could not finish',err)}}await sub.unsubscribe()}}
 }catch(err){console.warn('Web Push unsubscribe failed',err)}
 localStorage.removeItem(statusKey);localStorage.removeItem(dueKey);window.umjRefreshPushUI?.();notice('أُوقفت الإشعارات على هذا الجهاز.');
};
window.umjRefreshPushUI();
if(localStorage.getItem(statusKey)==='1'){setTimeout(()=>{void refreshServer()},1000)}
