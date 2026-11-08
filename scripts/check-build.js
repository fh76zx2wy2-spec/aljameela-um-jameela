const fs=require('fs');const assert=require('assert');
const html=fs.readFileSync('site/index.html','utf8');
assert(html.includes('تفعيل إشعارات التطبيق'));
assert(html.includes('umj-push-status'));
assert(html.includes('um-jameela-2026-v1'));
for (const f of ['site/index.html','site/sw.js','site/push.js','site/push-config.js','site/manifest.webmanifest','site/icon-192.png','site/icon-512.png','.github/workflows/github-pages.yml','supabase/functions/umj-register-push/index.ts','supabase/functions/umj-weekly-push/index.ts'])assert(fs.existsSync(f),f);
console.log('All required files present.');
