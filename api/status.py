from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Zegrate Training - Live Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e0e0e0;font-family:'SF Mono','Fira Code',monospace;min-height:100vh}
.c{max-width:800px;margin:0 auto;padding:16px}
.h{text-align:center;padding:20px 0;border-bottom:1px solid #1a1a2e;margin-bottom:20px}
.h h1{font-size:24px;background:linear-gradient(135deg,#00d4ff,#7b2ff7);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.h .sub{color:#666;font-size:12px;margin-top:4px}
.lb{display:inline-flex;align-items:center;gap:6px;border:1px solid #ff3333;border-radius:12px;padding:3px 10px;font-size:11px;color:#ff4444;margin-top:8px}
.ld{width:6px;height:6px;border-radius:50%;background:#ff3333;animation:p 1.5s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
.cd{background:#111118;border:1px solid #1a1a2e;border-radius:12px;padding:16px;margin-bottom:12px}
.ct{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
.bn{font-size:56px;font-weight:700;line-height:1}
.aw{display:inline-block;font-size:32px;margin-left:8px}
.aw.u{color:#ff4444;animation:b .8s infinite}
.aw.d{color:#00ff88;animation:b .8s infinite}
.aw.f{color:#444}
@keyframes b{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.pb{width:100%;height:28px;background:#1a1a2e;border-radius:14px;overflow:hidden;position:relative;margin:10px 0}
.pf{height:100%;background:linear-gradient(90deg,#7b2ff7,#00d4ff);border-radius:14px;transition:width .6s}
.pt{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.phb{display:flex;gap:2px;margin:10px 0}
.ph{flex:1;height:10px;border-radius:5px;background:#1a1a2e;transition:background .4s}
.ph.done{background:#00ff88}
.ph.act{background:#00d4ff;box-shadow:0 0 8px #00d4ff}
.ph.fut{background:#1a1a2e}
.phl{display:flex;justify-content:space-between;font-size:9px;color:#555;margin-top:4px}
.mg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.m{background:#0d0d14;border-radius:8px;padding:10px;text-align:center}
.m .l{font-size:9px;color:#555;margin-bottom:4px;text-transform:uppercase}
.m .v{font-size:22px;font-weight:700}
.g{color:#00ff88}.bl{color:#00d4ff}.y{color:#ffaa00}.r{color:#ff4444}
.el{max-height:160px;overflow-y:auto;font-size:11px}
.ev{padding:6px 8px;border-left:2px solid #333;margin-bottom:4px;border-radius:0 4px 4px 0;background:#0d0d14}
.ev.out{border-color:#ff4444;color:#ff6666}
.ev.rst{border-color:#ffaa00;color:#ffcc00}
.ft{text-align:center;padding:16px 0;color:#333;font-size:10px}
.rd{background:#0d0d14;border-radius:8px;padding:10px;font-size:10px;color:#555;white-space:pre-wrap;max-height:100px;overflow-y:auto;margin-top:8px}
</style>
</head>
<body>
<div class="c">
<div class="h">
<h1>Zegrate Training</h1>
<div class="sub">Phase 1: DoRA Fine-tuning - Qwen 2.5 14B - 10,000 steps</div>
<div class="lb" id="lb"><span class="ld"></span><span id="lt">LOADING...</span></div>
</div>
<div class="cd" style="text-align:center">
<div class="ct">Training Step</div>
<div><span class="bn bl" id="sn">---</span><span class="aw f" id="sa"></span></div>
<div style="font-size:14px;color:#555;margin-top:4px">/ 10,000</div>
</div>
<div class="cd">
<div class="ct">Total Progress</div>
<div class="pb"><div class="pf" id="pf" style="width:0%"></div><div class="pt" id="pt">0%</div></div>
</div>
<div class="cd">
<div class="ct">Training Phase</div>
<div class="phb" id="phb"></div>
<div class="phl"><span>Warmup</span><span>25%</span><span>50%</span><span>75%</span><span>Done</span></div>
</div>
<div class="cd">
<div class="ct">Metrics</div>
<div class="mg">
<div class="m"><div class="l">Loss</div><div class="v g" id="lv">---</div></div>
<div class="m"><div class="l">GPU Temp</div><div class="v y" id="tv">---</div></div>
<div class="m"><div class="l">GPU Mem</div><div class="v bl" id="mv">---</div></div>
<div class="m"><div class="l">Epoch</div><div class="v" id="ev">---</div></div>
<div class="m"><div class="l">Speed</div><div class="v" id="sv">---</div></div>
<div class="m"><div class="l">ETA</div><div class="v" id="et">---</div></div>
</div>
</div>
<div class="cd">
<div class="ct">Events & Power Log</div>
<div class="el" id="elog"><div class="ev">Loading...</div></div>
</div>
<div class="cd">
<div class="ct">Raw Status</div>
<div class="rd" id="rd">Loading...</div>
</div>
<div class="ft">Zegrate AI - Auto-refreshes every 60s</div>
</div>
<script>
let ls=0;
function bp(p){const b=document.getElementById('phb');b.innerHTML='';for(let i=0;i<100;i++){const s=document.createElement('div');s.className='ph '+(i<p?'done':i===p?'act':'fut');b.appendChild(s);}}
async function f(){
try{
const gr=await fetch('https://api.github.com/gists/78eb3a0b4db48c73b1276974bd156008');
const g=await gr.json();
const fi=g.files['training-status.txt'];
if(!fi)return;
const r=await fetch(fi.raw_url+'?t='+Date.now());
const t=await r.text();
document.getElementById('rd').textContent=t;
const d={};
for(const l of t.split('\\n')){
const m=l.match(/Progress:\\s*(\\d+)%.*?(\\d+)\\/10000/);if(m){d.p=parseInt(m[1]);d.s=parseInt(m[2]);}
const lm=l.match(/Loss:\\s*([0-9.]+)/);if(lm)d.lo=parseFloat(lm[1]);
const em=l.match(/Epoch:\\s*([0-9.]+)/);if(em)d.e=parseFloat(em[1]);
const tm=l.match(/GPU:\\s*(\\d+)\\s*MiB,\\s*(\\d+)/);if(tm){d.g=parseInt(tm[1]);d.t=parseInt(tm[2]);}
const sm=l.match(/Speed:\\s*([^\\n]+)/);if(sm)d.sp=sm[1].trim();
if(l.includes('RUNNING'))d.r=true;if(l.includes('STOPPED'))d.r=false;
}
if(!d.s)return;
document.getElementById('lt').textContent=d.r?'LIVE':'STOPPED';
document.getElementById('lb').style.borderColor=d.r?'#00ff88':'#ff4444';
document.getElementById('lb').style.background=d.r?'#0a1a0a':'#1a0a0a';
document.getElementById('sn').textContent=d.s.toLocaleString();
const a=document.getElementById('sa');
if(d.s>ls){a.textContent='\\u25B2';a.className='aw u';}
else if(d.s<ls){a.textContent='\\u25BC';a.className='aw d';}
else{a.textContent='\\u2014';a.className='aw f';}
ls=d.s;
document.getElementById('pf').style.width=d.p+'%';
document.getElementById('pt').textContent=d.p+'%';
bp(d.p);
document.getElementById('lv').textContent=d.lo?d.lo.toFixed(4):'---';
document.getElementById('tv').textContent=d.t?d.t+'C':'---';
document.getElementById('tv').className='v '+(d.t>85?'r':d.t>70?'y':'g');
document.getElementById('mv').textContent=d.g?(d.g/1024).toFixed(1)+'GB':'---';
document.getElementById('ev').textContent=d.e?d.e.toFixed(2):'---';
document.getElementById('sv').textContent=d.sp||'---';
if(d.s&&d.sp){const sm=d.sp.match(/([\\.\\d]+)s\\/it/);if(sm){const h=((10000-d.s)*parseFloat(sm[1]))/3600;document.getElementById('et').textContent=h>24?Math.round(h/24)+'d':h.toFixed(1)+'h';}}
}catch(e){console.error(e);}
}
f();setInterval(f,60000);
</script>
</body>
</html>"""

@app.get("/api/status")
async def status_page():
    return HTMLResponse(HTML, headers={"Cache-Control": "no-store"})
