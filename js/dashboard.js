import { config } from './core/config.js';
import { utils } from './core/utils.js';
import { i18n } from './core/i18n.js';
import { auth } from './auth.js';
import { store } from './core/store.js';
import { premium } from './core/premium.js';
import { setSkeletonState, emptyStateMarkup, exportPdf, exportCsv } from './core/ui.js';

let chartInstance = null;

function periodKey(date, period) {
  const d = new Date(date);
  if (period === 'days') return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  if (period === 'years') return String(d.getFullYear());
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function periodLabel(key, period) {
  if (period === 'years') return key;
  if (period === 'days') { const [y,m,d]=key.split('-').map(Number); return new Intl.DateTimeFormat(i18n.current(),{day:'numeric',month:'short'}).format(new Date(y,m-1,d)); }
  const [y,m]=key.split('-').map(Number); return new Intl.DateTimeFormat(i18n.current(),{month:'short',year:'2-digit'}).format(new Date(y,m-1,1));
}
function setTierBadge() { const el=document.getElementById('subscription-tier'); if(!el)return; const pro=auth.isPro(); el.className=`badge ${pro?'badge-success':'badge-warning'}`; el.textContent=pro?i18n.t('plan.pro'):i18n.t('plan.free'); }

function renderChart(state) {
  const canvas=document.getElementById('income-expense-chart');
  if(!canvas || !window.Chart || !premium.isPro()) return;
  const period=document.getElementById('income-expense-period')?.value || 'months';
  const now=new Date(); const keys=[];
  if(period==='days') { for(let i=29;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);keys.push(periodKey(d,period));} }
  else if(period==='years') { for(let i=4;i>=0;i--) keys.push(String(now.getFullYear()-i)); }
  else { for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);keys.push(periodKey(d,period));} }
  const buckets=new Map(keys.map(k=>[k,{income:0,expense:0}]));
  (state.documents||[]).filter(d=>d.type==='FACTURA' && d.status!=='CANCELADA').forEach(d=>{
    if(!d.issueDate)return; const k=periodKey(d.issueDate,period); const b=buckets.get(k); if(!b)return;
    const docCurrency=d.currency||state.settings.currency||'EUR'; const fx=docCurrency===(state.settings.currency||'EUR')?1:(Number(d.fxRateToBase)>0?Number(d.fxRateToBase):null);
    if(fx){if(d.operation==='EMITIDA')b.income+=Number(d.totals?.total ?? d.totals?.base ?? 0)*fx;if(d.operation==='RECIBIDA')b.expense+=Number(d.totals?.total ?? d.totals?.base ?? 0)*fx;}
  });
  const currency=state.settings.currency||'EUR';
  const data={labels:keys.map(k=>periodLabel(k,period)),datasets:[
    {label:i18n.t('dashboard.income'),data:keys.map(k=>utils.roundMoney(buckets.get(k)?.income||0)),borderWidth:2,tension:.35,pointRadius:period==='days'?1:2,fill:false},
    {label:i18n.t('dashboard.expenses'),data:keys.map(k=>utils.roundMoney(buckets.get(k)?.expense||0)),borderWidth:2,tension:.35,pointRadius:period==='days'?1:2,fill:false}
  ]};
  chartInstance?.destroy();
  chartInstance=new Chart(canvas.getContext('2d'),{type:'line',data,options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true}},scales:{y:{beginAtZero:true,ticks:{callback:value=>utils.formatMoney(value,currency)}}}}});
}

function renderCalendar(state) {
  const list=document.getElementById('fiscal-calendar'); if(!list||!premium.isPro())return; list.replaceChildren();
  [1,2,3,4].forEach(q=>{const item=document.createElement('li');const title=document.createElement('strong');title.textContent=i18n.t('calendar.quarter',{q});const date=document.createElement('span');const endMonth=q*3;date.textContent=new Intl.DateTimeFormat(i18n.current(),{month:'short'}).format(new Date(new Date().getFullYear(),endMonth-1,1));item.append(title,date);list.appendChild(item);});
  const expiring=state.documents.filter(d=>d.type==='PRESUPUESTO'&&d.dueDate&&new Date(d.dueDate).getTime()>=Date.now()).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).slice(0,3);
  if(expiring.length){const sep=document.createElement('li');sep.className='calendar-section-label';sep.textContent=i18n.t('calendar.expiringQuotes');list.appendChild(sep);expiring.forEach(d=>{const item=document.createElement('li');const strong=document.createElement('strong');const span=document.createElement('span');strong.textContent=d.number||'';span.textContent=d.dueDate;item.append(strong,span);list.appendChild(item);});}
}

function renderPremiumSections(state){
  const pro=premium.isPro();
  const analytics=document.getElementById('advanced-analytics-panel'); const calendar=document.getElementById('fiscal-calendar-panel'); const lock=document.getElementById('dashboard-premium-lock');
  analytics.classList.toggle('premium-available',pro); calendar.classList.toggle('premium-available',pro);
  if(pro){ lock.hidden=true; analytics.hidden=false; calendar.hidden=false; renderChart(state); renderCalendar(state); }
  else {
    analytics.hidden=true; calendar.hidden=true; lock.hidden=false;
    lock.replaceChildren();
    const badge=document.createElement('span'); badge.className='premium-label'; badge.textContent=i18n.t('premium.badge');
    const h=document.createElement('h2'); h.textContent=i18n.t('premium.advancedAnalyticsTitle');
    const p=document.createElement('p'); p.textContent=i18n.t('premium.advancedAnalyticsText');
    const b=document.createElement('button'); b.type='button'; b.className='btn-primary btn-small'; b.textContent=i18n.t('premium.upgrade'); b.addEventListener('click',()=>premium.show('advancedAnalytics'));
    lock.append(badge,h,p,b);
  }
  premium.applyLocks();
}

function buildReportElement(state, stats){
  const lang=(i18n.current()||'es').toLowerCase();
  const labels={
    es:{title:'Informe Ejecutivo de Rendimiento',generated:'Fecha de generación',period:'Periodo analizado',revenue:'Ingresos Totales',approved:'Presupuestos aprobados',clients:'Clientes activos',conversion:'Tasa de conversión',expenses:'Gastos',result:'Resultado neto',receivable:'Pendiente de cobro',recent:'Actividad reciente',number:'Número',client:'Cliente',type:'Tipo',status:'Estado',total:'Total',quote:'Presupuesto',invoice:'Factura',yes:'Aprobado',noData:'No hay documentos recientes.',months:'Últimos 12 meses'},
    en:{title:'Executive Performance Report',generated:'Generated on',period:'Reporting period',revenue:'Total Revenue',approved:'Approved Quotes',clients:'Active Clients',conversion:'Conversion Rate',expenses:'Expenses',result:'Net Result',receivable:'Outstanding Receivables',recent:'Recent Activity',number:'Number',client:'Client',type:'Type',status:'Status',total:'Total',quote:'Quote',invoice:'Invoice',yes:'Approved',noData:'No recent documents.',months:'Last 12 months'},
    ca:{title:'Informe executiu de rendiment',generated:'Data de generació',period:'Període analitzat',revenue:'Ingressos totals',approved:'Pressupostos aprovats',clients:'Clients actius',conversion:'Taxa de conversió',expenses:'Despeses',result:'Resultat net',receivable:'Pendent de cobrament',recent:'Activitat recent',number:'Número',client:'Client',type:'Tipus',status:'Estat',total:'Total',quote:'Pressupost',invoice:'Factura',yes:'Aprovat',noData:'No hi ha documents recents.',months:'Darrers 12 mesos'},
    fr:{title:'Rapport exécutif de performance',generated:'Date de génération',period:'Période analysée',revenue:'Revenus totaux',approved:'Devis approuvés',clients:'Clients actifs',conversion:'Taux de conversion',expenses:'Dépenses',result:'Résultat net',receivable:'Créances en attente',recent:'Activité récente',number:'Numéro',client:'Client',type:'Type',status:'Statut',total:'Total',quote:'Devis',invoice:'Facture',yes:'Approuvé',noData:'Aucun document récent.',months:'12 derniers mois'}
  }[lang] || null;
  const L=labels||{title:i18n.t('dashboard.title'),generated:'Generated',period:'Period',revenue:i18n.t('dashboard.income'),approved:'Approved quotes',clients:'Active clients',conversion:'Conversion rate',expenses:i18n.t('dashboard.expenses'),result:i18n.t('dashboard.result'),receivable:i18n.t('dashboard.receivable'),recent:'Recent activity',number:i18n.t('table.number'),client:i18n.t('table.party'),type:i18n.t('table.type'),status:i18n.t('table.status'),total:i18n.t('table.total'),quote:'Quote',invoice:'Invoice',yes:'Approved',noData:'No recent documents.',months:'Last 12 months'};
  const root=document.createElement('div');
  root.id='dashboard-report';
  root.className='gp-executive-report';
  root.style.cssText='width:794px;padding:36px;background:#fff;color:#111827;font-family:Arial,sans-serif;';
  const date=new Intl.DateTimeFormat(i18n.current(),{dateStyle:'long'}).format(new Date());
  const heading=document.createElement('div');
  heading.style.cssText='padding:0 0 20px;border-bottom:3px solid #0d6efd;margin-bottom:20px;';
  heading.innerHTML=`<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#0d6efd!important;font-weight:700">${utils.escapeHtml(config.APP_NAME)}</div><h1 style="font-size:27px;margin:8px 0;color:#111827!important">${utils.escapeHtml(L.title)}</h1><div style="font-size:12px;color:#64748b!important">${utils.escapeHtml(L.period)}: ${utils.escapeHtml(L.months)} &nbsp; · &nbsp; ${utils.escapeHtml(L.generated)}: ${utils.escapeHtml(date)}</div>`;
  root.appendChild(heading);
  const docs=Array.isArray(state.documents)?state.documents:[];
  const quotes=docs.filter(d=>d.type==='PRESUPUESTO');
  const approved=quotes.filter(d=>['ACEPTADO','APROBADO','FACTURADO'].includes(String(d.status||'').toUpperCase())).length;
  const clients=Array.isArray(state.clients)?state.clients.filter(c=>c.active!==false).length:0;
  const conversion=quotes.length?Math.round(approved/quotes.length*100):0;
  const kpis=[{label:L.revenue,value:utils.formatMoney(stats.ingresos,stats.baseCurrency),detail:'↑'},{label:L.approved,value:String(approved),detail:`${quotes.length} ${L.quote.toLowerCase()}${quotes.length===1?'':'s'}`},{label:L.clients,value:String(clients),detail:''},{label:L.conversion,value:`${conversion}%`,detail:''}];
  const cards=document.createElement('div');cards.className='report-kpis';cards.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:20px 0 24px;';
  kpis.forEach(k=>{const card=document.createElement('div');card.className='report-kpi';card.style.cssText='border:1px solid #e2e8f0;border-radius:8px;padding:14px;background:#f8fafc;page-break-inside:avoid;';const label=document.createElement('div');label.textContent=k.label;label.style.cssText='font-size:11px;color:#64748b;margin-bottom:8px';const value=document.createElement('div');value.textContent=k.value;value.style.cssText='font-size:23px;font-weight:700;color:#0f172a;margin-bottom:5px';card.append(label,value);if(k.detail){const detail=document.createElement('small');detail.textContent=k.detail;detail.style.cssText='font-size:10px;color:#64748b';card.appendChild(detail)}if(k.label===L.conversion){const track=document.createElement('div');track.style.cssText='height:6px;background:#e2e8f0;border-radius:5px;margin-top:10px;overflow:hidden';const bar=document.createElement('div');bar.style.cssText=`height:100%;width:${Math.max(0,Math.min(100,conversion))}%;background:#0d6efd;border-radius:5px`;track.appendChild(bar);card.appendChild(track)}cards.appendChild(card)});
  root.appendChild(cards);
  const summary=document.createElement('div');summary.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 26px;';
  [{label:L.expenses,value:stats.gastos},{label:L.result,value:stats.resultado},{label:L.receivable,value:(stats.pendientes||[]).reduce((a,d)=>a+(Number(d.totals?.total)||0),0)}].forEach(item=>{const box=document.createElement('div');box.style.cssText='padding:12px;border:1px solid #e2e8f0;border-radius:7px;page-break-inside:avoid';const l=document.createElement('div');l.textContent=item.label;l.style.cssText='font-size:11px;color:#64748b;margin-bottom:6px';const v=document.createElement('strong');v.textContent=utils.formatMoney(item.value,stats.baseCurrency);v.style.cssText='font-size:15px;color:#111827';box.append(l,v);summary.appendChild(box)});
  root.appendChild(summary);
  const section=document.createElement('h2');section.textContent=L.recent;section.style.cssText='font-size:17px;margin:0 0 10px;color:#111827';root.appendChild(section);
  const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;font-size:11px';
  const head=document.createElement('thead');const hr=document.createElement('tr');[L.number,L.client,L.type,L.status,L.total].forEach(label=>{const th=document.createElement('th');th.textContent=label;th.style.cssText='padding:10px 8px;text-align:left;background:#1e293b;color:#fff;border:1px solid #1e293b';hr.appendChild(th)});head.appendChild(hr);table.appendChild(head);
  const body=document.createElement('tbody');const recent=docs.slice().sort((a,b)=>String(b.issueDate||'').localeCompare(String(a.issueDate||''))).slice(0,8);
  recent.forEach((d,index)=>{const tr=document.createElement('tr');tr.style.cssText='page-break-inside:avoid;background:'+(index%2?'#f8fafc':'#fff');const values=[d.number||'—',d.client?.name||'—',d.type==='FACTURA'?L.invoice:L.quote,d.status||'—',utils.formatMoney(d.totals?.total||0,d.currency||stats.baseCurrency)];values.forEach(value=>{const td=document.createElement('td');td.textContent=String(value);td.style.cssText='padding:9px 8px;border-bottom:1px solid #e2e8f0;color:#111827;background:transparent;overflow-wrap:anywhere';tr.appendChild(td)});body.appendChild(tr)});
  if(!recent.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent=L.noData;td.style.cssText='padding:14px;color:#64748b';tr.appendChild(td);body.appendChild(tr)}
  table.appendChild(body);root.appendChild(table);
  const footer=document.createElement('div');footer.textContent=`${config.APP_NAME} · ${date}`;footer.style.cssText='margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px';root.appendChild(footer);
  return root;
}
async function exportReport(state,stats){ if(!premium.require('advancedReports'))return; const report=buildReportElement(state,stats);document.body.appendChild(report);try{const element=document.getElementById('dashboard-report');await exportPdf(element,`Informe_Dashboard_${(i18n.current()||'es').toUpperCase()}`);}finally{report.remove();} }
function exportData(state){ if(!premium.require('advancedReports'))return; const rows=[[i18n.t('premium.dataset'),i18n.t('table.number'),i18n.t('billing.issueDate'),i18n.t('table.party'),i18n.t('table.type'),i18n.t('table.status'),i18n.t('table.total'),i18n.t('billing.currency')]]; state.documents.forEach(d=>rows.push(['document',d.number||'',d.issueDate||'',d.client?.name||'',d.type||'',d.status||'',utils.formatMoney(d.totals?.total||0,d.currency||'EUR'),d.currency||'EUR'])); state.inventory.forEach(p=>rows.push(['inventory',p.sku||'',p.createdAt?.slice(0,10)||'',p.name||'',i18n.t('inventory.title'),p.stock,i18n.t('inventory.units'),state.settings.currency||'EUR'])); exportCsv(rows,'gestioflex-datos.csv');}

function render(){
  const user=auth.currentUser(); if(!user||!auth.hasAccess())return;
  const main=document.querySelector('.private-main'); setSkeletonState(main,true);
  window.setTimeout(()=>{
    const state=store.getState(); const s=store.stats(); const currency=state.settings.currency||'EUR'; const money=v=>utils.formatMoney(v,currency);
    document.getElementById('saludo').textContent=`${i18n.t('dashboard.hello')}, ${user.empresa||i18n.t('dashboard.title')}`; setTierBadge();
    document.getElementById('kpi-ingresos').textContent=money(s.ingresos); document.getElementById('kpi-gastos').textContent=money(s.gastos); document.getElementById('kpi-resultado').textContent=money(s.resultado); const pending=s.pendientes.reduce((sum,d)=>sum+(d.totals?.total||0),0); document.getElementById('kpi-pendientes').textContent=money(pending); document.getElementById('kpi-pendientes-count').textContent=`${s.pendientes.length} ${s.pendientes.length===1?i18n.t('dashboard.invoiceOne'):i18n.t('dashboard.invoices')}`; document.getElementById('kpi-stock').textContent=s.lowStock.length;
    const tbody=document.getElementById('tabla-ultimas'); tbody.replaceChildren(); const docs=state.documents.slice(0,8);
    if(!docs.length){const holder=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.appendChild(emptyStateMarkup({title:i18n.t('empty.documentsTitle'),description:i18n.t('empty.documentsText'),href:'presupuestos.html',action:i18n.t('empty.createQuote')}));holder.appendChild(td);tbody.appendChild(holder);} else docs.forEach(d=>{const tr=document.createElement('tr');const statusClass=['EMITIDA','COBRADA','FACTURADO'].includes(d.status)?'badge-success':d.status==='BORRADOR'?'badge-neutral':'badge-warning';const statusKey={BORRADOR:'status.draft',EMITIDA:'status.issued',COBRADA:'status.paid',FACTURADO:'status.invoiced',ENVIADO:'status.issued',RECIBIDA:'status.received',PAGADA:'status.payed'}[d.status];tr.innerHTML=`<td>${utils.escapeHtml(d.number||'')}</td><td>${utils.escapeHtml(d.client?.name||'')}</td><td>${d.type==='FACTURA'?i18n.t('dashboard.invoice'):i18n.t('dashboard.quote')}</td><td><span class="badge ${statusClass}">${utils.escapeHtml(i18n.t(statusKey)||d.status||'')}</span></td><td>${utils.escapeHtml(money(d.totals?.total||0))}</td>`;const labels=[i18n.t('table.number'),i18n.t('table.party'),i18n.t('table.type'),i18n.t('table.status'),i18n.t('table.total')];tr.querySelectorAll(':scope > td').forEach((td,i)=>td.dataset.label=labels[i]||'');tbody.appendChild(tr);});
    const list=document.getElementById('lista-bajo-stock'); list.replaceChildren(); if(!s.lowStock.length){const li=document.createElement('li');li.textContent=i18n.t('dashboard.noLowStock');list.appendChild(li);} else s.lowStock.slice(0,6).forEach(p=>{const li=document.createElement('li');const span=document.createElement('span');const strong=document.createElement('strong');span.textContent=p.name;strong.textContent=`${p.stock} / ${i18n.t('dashboard.minimum')} ${p.minStock}`;li.append(span,strong);list.appendChild(li);});
    renderPremiumSections(state); setSkeletonState(main,false);
  },120);
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('export-report-pdf')?.addEventListener('click',()=>{const state=store.getState();exportReport(state,store.stats()).catch(err=>window.GP?.toast?.(err.message,'error'));});
  document.getElementById('export-report-csv')?.addEventListener('click',()=>exportData(store.getState()));
  render();
});
store.subscribe(render); window.addEventListener('gp:languagechange',render); window.addEventListener('gp-state-change',render); window.addEventListener('storage', event => { if (!event.key || /state|document|invoice|quote|gestio/i.test(event.key)) render(); });
document.getElementById('income-expense-period')?.addEventListener('change', () => renderChart(store.getState()));
