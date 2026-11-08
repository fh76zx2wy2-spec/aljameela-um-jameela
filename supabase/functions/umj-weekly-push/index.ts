import { createClient } from 'npm:@supabase/supabase-js@2.81.1';
import webpush from 'npm:web-push@3.6.7';
const {SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UMJ_CRON_SECRET, UMJ_VAPID_SUBJECT, UMJ_VAPID_PUBLIC_KEY, UMJ_VAPID_PRIVATE_KEY}=Deno.env.toObject();
function dateNum(str:string){const [y,m,d]=str.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);}
function todayRiyadh(){const fields=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=(s:string)=>fields.find(x=>x.type===s)?.value||'';return `${p('year')}-${p('month')}-${p('day')}`;}
Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response('POST only',{status:405});
 if(!UMJ_CRON_SECRET||req.headers.get('x-cron-secret')!==UMJ_CRON_SECRET)return new Response('Forbidden',{status:403});
 if(!UMJ_VAPID_SUBJECT||!UMJ_VAPID_PUBLIC_KEY||!UMJ_VAPID_PRIVATE_KEY)return new Response('Missing VAPID config',{status:500});
 webpush.setVapidDetails(UMJ_VAPID_SUBJECT, UMJ_VAPID_PUBLIC_KEY, UMJ_VAPID_PRIVATE_KEY);
 const db=createClient(SUPABASE_URL!,SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const {data:rows,error}=await db.from('umj_push_subscriptions').select('id,endpoint,p256dh,auth_key,due_date,last_notified_week').eq('enabled',true).limit(1000);
 if(error){console.error(error.code);return new Response('Database query failed',{status:500})}
 const today=dateNum(todayRiyadh());let sent=0,skipped=0,failures=0;
 for(const r of rows||[]){
   const elapsed=today-(dateNum(r.due_date)-280);
   const week=Math.floor(elapsed/7)+1;
   if(elapsed<7||elapsed>=280||week<2||week>40||week<=(r.last_notified_week||0)){skipped++;continue}
   const message=JSON.stringify({title:`🌷 الأسبوع ${week} من رحلة أم جميلة ♥️`,body:`أهلًا بأسبوع جديد! افتحي الجميلة أم جميلة لتتعرفي على نمو جنينكِ وتغيرات هذا الأسبوع.`,week,url:'./'});
   try{
     await webpush.sendNotification({endpoint:r.endpoint,keys:{p256dh:r.p256dh,auth:r.auth_key}},message,{TTL:86400,urgency:'normal'});
     await db.from('umj_push_subscriptions').update({last_notified_week:week,updated_at:new Date().toISOString()}).eq('id',r.id);
     sent++;
   }catch(e){const code=(e as any)?.statusCode||0;console.error('Delivery failed',code);failures++;
     if(code===404||code===410)await db.from('umj_push_subscriptions').update({enabled:false,updated_at:new Date().toISOString()}).eq('id',r.id);
   }
 }
 return Response.json({sent,skipped,failures});
});
