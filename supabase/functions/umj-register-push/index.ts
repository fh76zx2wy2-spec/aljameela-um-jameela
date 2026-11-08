import { createClient } from 'npm:@supabase/supabase-js@2.81.1';
// Public endpoint with explicit session verification. The secret service role remains on the server.
const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigin = Deno.env.get('UMJ_ALLOWED_ORIGIN')!; // e.g. https://username.github.io
const CORS = { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
function json(data: unknown, status=200) { return new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}}); }
function dateNumber(str:string){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(str);if(!m)return NaN;const [y,mo,d]=m.slice(1).map(Number);const ms=Date.UTC(y,mo-1,d);return new Date(ms).toISOString().slice(0,10)===str?Math.floor(ms/86400000):NaN;}
function nowRiyadh(){const fields=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const f=(name:string)=>fields.find(x=>x.type===name)?.value||'0';return `${f('year')}-${f('month')}-${f('day')}`;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(!allowedOrigin || req.headers.get('origin')!==allowedOrigin)return json({error:'Origin forbidden'},403);
 const authorization=req.headers.get('Authorization')||'';
 const token=authorization.replace(/^Bearer\s+/i,'');
 if(!token)return json({error:'Authentication required'},401);
 const auth=createClient(url,anonKey,{auth:{persistSession:false}});
 const {data:{user},error:authErr}=await auth.auth.getUser(token);
 if(authErr||!user)return json({error:'Session invalid'},401);
 let payload:any;
 try{payload=await req.json()}catch{return json({error:'Invalid JSON'},400)}
 const {action,subscription,dueDate}=payload||{};
 if(action!=='subscribe' && action!=='unsubscribe')return json({error:'Invalid action'},400);
 const endpoint=subscription?.endpoint;
 if(typeof endpoint!=='string'||endpoint.length>1800)return json({error:'Invalid subscription'},400);
 let host:string;
 try { const u=new URL(endpoint);if(u.protocol!=='https:')throw Error();host=u.hostname.toLowerCase(); }catch{return json({error:'HTTPS endpoint required'},400)}
 // iPhone APNs plus standard browser push services; limits SSRF from arbitrary endpoints.
 if(!((host==='web.push.apple.com'||host.endsWith('.push.apple.com'))||host==='fcm.googleapis.com'||host.endsWith('.googleapis.com')||host==='updates.push.services.mozilla.com'))return json({error:'Unsupported push endpoint'},400);
 const admin=createClient(url,serviceRole,{auth:{persistSession:false}});
 if(action==='unsubscribe'){
  const {error}=await admin.from('umj_push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',endpoint);
  return error?json({error:'Subscription removal failed'},500):json({ok:true});
 }
 if(typeof subscription?.keys?.p256dh!=='string'||typeof subscription?.keys?.auth!=='string'||subscription.keys.p256dh.length>500||subscription.keys.auth.length>500)return json({error:'Invalid encryption keys'},400);
 const due=dateNumber(dueDate);const today=dateNumber(nowRiyadh());
 if(!Number.isFinite(due)||due<today-31||due>today+300)return json({error:'Due date out of range'},400);
 const week=Math.min(40,Math.max(1,Math.floor((today-(due-280))/7)+1));
 const {data:existing}=await admin.from('umj_push_subscriptions').select('due_date,last_notified_week').eq('user_id',user.id).eq('endpoint',endpoint).maybeSingle();
 const {count}=await admin.from('umj_push_subscriptions').select('id',{count:'exact',head:true}).eq('user_id',user.id);
 if(!existing && (count||0)>=3)return json({error:'Maximum 3 devices'},429);
 const lastNotified=existing?.due_date===dueDate?existing.last_notified_week:week;
 const {error}=await admin.from('umj_push_subscriptions').upsert({user_id:user.id,endpoint,p256dh:subscription.keys.p256dh,auth_key:subscription.keys.auth,due_date:dueDate,last_notified_week:lastNotified,enabled:true,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
 if(error){console.error('Register database error',error.code);return json({error:'Subscription registration failed'},500)}
 return json({ok:true});
});
