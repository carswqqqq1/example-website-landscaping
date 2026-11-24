const T={html:'text/html; charset=utf-8',css:'text/css',js:'application/javascript',json:'application/json',xml:'application/xml',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',avif:'image/avif',svg:'image/svg+xml',woff2:'font/woff2',pdf:'application/pdf',ico:'image/x-icon'};
// Root pages are a mirror of thinkgreen-az.netlify.app (fictional Mesa Wren demo). They may be framed only by arroyomarketing.com.
// /p/<slug> lead previews keep exactly the old behavior (no extra headers).
const FRAME={'Content-Security-Policy':"frame-ancestors 'self' https://arroyomarketing.com https://www.arroyomarketing.com"};
// Demo form endpoint: forwards to the original Netlify lead function, which emails the owner and the
// customer (Gmail SMTP) and adds the lead to the Google Sheet only when the customer ticks the opt-in box.
const LEAD_UPSTREAM='https://thinkgreen-az.netlify.app/api/lead';
const UPSTREAM_ORIGIN='https://thinkgreen-az.netlify.app';
const ALLOWED_ORIGINS=['https://demo.tryarroyo.com'];
function j(obj,status,extra){return new Response(JSON.stringify(obj),{status:status||200,headers:{'content-type':T.json,'cache-control':'no-store','x-content-type-options':'nosniff',...(extra||{})}});}
async function lead(req,extra){
  if(req.method!=='POST') return j({ok:false,error:'Method not allowed.'},405,{Allow:'POST',...extra});
  const origin=req.headers.get('origin')||'';
  if(!ALLOWED_ORIGINS.includes(origin)) return j({ok:false,error:'Request origin is not allowed.'},403,extra);
  const ct=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(ct!=='application/json'&&ct!=='application/x-www-form-urlencoded') return j({ok:false,error:'Unsupported request format.'},415,extra);
  const body=await req.arrayBuffer();
  if(body.byteLength>64*1024) return j({ok:false,error:'Request is too large.'},413,extra);
  try{
    const r=await fetch(LEAD_UPSTREAM,{method:'POST',body,headers:{'content-type':req.headers.get('content-type'),'origin':UPSTREAM_ORIGIN,'accept':'application/json','user-agent':(req.headers.get('user-agent')||'').slice(0,200),'x-demo-proxy':'demo.tryarroyo.com'}});
    const text=await r.text();
    let out; try{out=JSON.parse(text);}catch(e){out={ok:false,error:'Lead routing is temporarily unavailable.'};}
    return j(out,r.status,extra);
  }catch(e){
    return j({ok:false,error:'Lead routing is temporarily unavailable.'},503,extra);
  }
}
export default { async fetch(req, env) {
  const u=new URL(req.url); let p=decodeURIComponent(u.pathname);
  const isPreview=p.startsWith('/p/');
  const extra=isPreview?{}:FRAME;
  if(!isPreview && u.pathname==='/api/lead') return lead(req,extra);
  if(p.endsWith('/')) p+='index.html';
  let tries=[p]; if(!/\.[a-z0-9]+$/i.test(p)) tries=[p+'.html',p+'/index.html'];
  for(const k of tries){ const v=await env.SITE.get(k,{type:'arrayBuffer',cacheTtl:300}); if(v){ const ext=k.split('.').pop().toLowerCase(); return new Response(v,{headers:{'content-type':T[ext]||'application/octet-stream','cache-control':ext==='html'?'public, max-age=60':'public, max-age=86400',...extra}}); } }
  const nf=await env.SITE.get('/404.html',{type:'arrayBuffer'})||await env.SITE.get('/index.html',{type:'arrayBuffer'});
  return new Response(nf,{status:404,headers:{'content-type':T.html,...extra}});
}};
