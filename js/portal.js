import { storage } from './core/storage.js';
import { config } from './core/config.js';
import { i18n } from './core/i18n.js';
import { utils } from './core/utils.js';
import { toast } from './core/ui.js';

const token=new URLSearchParams(location.search).get('token');
const key=`${config.KEYS.publicQuotePrefix}${String(token||'')}`;
const quote=storage.get(key,null);
const canvas=document.getElementById('signature-canvas');
const ctx=canvas?.getContext('2d');
let drawing=false,decision=null;

function drawLine(x,y){if(!ctx)return;ctx.lineTo(x,y);ctx.stroke();}
function point(e){const r=canvas.getBoundingClientRect();const p=e.touches?.[0]||e;return{x:(p.clientX-r.left)*(canvas.width/r.width),y:(p.clientY-r.top)*(canvas.height/r.height)};}
function setDecision(value){decision=value;document.getElementById('signature-section').hidden=false;document.getElementById('portal-accept').classList.toggle('active',value==='accepted');document.getElementById('portal-reject').classList.toggle('active',value==='rejected');}

function render(){
  if(!quote){document.querySelector('.portal-card').innerHTML=`<div class="empty-state-card"><h2>${utils.escapeHtml(i18n.t('error.quoteNotFound'))}</h2></div>`;return;}
  document.getElementById('portal-number').textContent=quote.number||'—';document.getElementById('portal-company').textContent=quote.company?.companyName||'GestioFlex';document.getElementById('portal-from').textContent=quote.company?.companyName||'—';document.getElementById('portal-to').textContent=quote.client?.name||'—';
  const currency=quote.currency||'EUR';const tbody=document.getElementById('portal-lines');tbody.replaceChildren();(quote.lines||[]).forEach(line=>{const tr=document.createElement('tr');[['',line.description||'' ],['',String(line.quantity||0)],['',utils.formatMoney(line.unitPrice||0,currency)],['',utils.formatMoney((Number(line.quantity)||0)*(Number(line.unitPrice)||0),currency)]].forEach((x,i)=>{const td=document.createElement('td');td.textContent=x[1];tr.appendChild(td);});tbody.appendChild(tr);});
  document.getElementById('portal-base').textContent=utils.formatMoney(quote.totals?.base||0,currency);document.getElementById('portal-tax').textContent=utils.formatMoney((quote.totals?.iva||0)+(quote.totals?.re||0)-(quote.totals?.irpf||0),currency);document.getElementById('portal-total').textContent=utils.formatMoney(quote.totals?.total||0,currency);
  const status=document.getElementById('portal-status');if(quote.decision==='accepted'){status.className='badge badge-success';status.textContent=i18n.t('portal.accepted');}else if(quote.decision==='rejected'){status.className='badge badge-danger';status.textContent=i18n.t('portal.rejected');}else{status.className='badge badge-neutral';status.textContent=i18n.t('status.issued');}
}

if(canvas){ctx.lineWidth=2;ctx.lineCap='round';ctx.strokeStyle='#0f172a';canvas.addEventListener('pointerdown',e=>{drawing=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);});canvas.addEventListener('pointermove',e=>{if(drawing){const p=point(e);drawLine(p.x,p.y);}});window.addEventListener('pointerup',()=>drawing=false);document.getElementById('signature-clear').addEventListener('click',()=>ctx.clearRect(0,0,canvas.width,canvas.height));}
document.getElementById('portal-accept')?.addEventListener('click',()=>setDecision('accepted'));document.getElementById('portal-reject')?.addEventListener('click',()=>setDecision('rejected'));
document.getElementById('signature-confirm')?.addEventListener('click',()=>{if(!quote)return;if(!decision)return toast(i18n.t('portal.signatureNeeded'),'error');const pixels=ctx?.getImageData(0,0,canvas.width,canvas.height).data||[];let ink=false;for(let i=3;i<pixels.length;i+=4){if(pixels[i]>0){ink=true;break;}}if(!ink)return toast(i18n.t('portal.signatureNeeded'),'error');const next={...quote,decision,signatureDataUrl:canvas.toDataURL('image/png'),decidedAt:new Date().toISOString()};storage.set(key,next);toast(decision==='accepted'?i18n.t('portal.accepted'):i18n.t('portal.rejected'),'success');render();document.getElementById('signature-section').hidden=true;});
window.addEventListener('gp:languagechange',()=>{i18n.apply();render();});

i18n.apply();render();
