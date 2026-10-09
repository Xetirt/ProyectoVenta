import { store } from './core/store.js';
import { premium } from './core/premium.js';
import { i18n } from './core/i18n.js';
import { toast } from './core/ui.js';

function renderHistory() {
  const list = document.getElementById('automation-history');
  const history = store.getState().meta?.automationHistory || [];
  list.replaceChildren();
  if (!history.length) { const li = document.createElement('li'); li.className = 'subtle'; li.textContent = i18n.t('automation.noHistory'); list.append(li); return; }
  history.slice().reverse().forEach(item => { const li = document.createElement('li'); const span = document.createElement('span'); span.textContent = item.label; const small = document.createElement('small'); small.textContent = item.date; li.append(span, small); list.append(li); });
}

function addHistory(label) { store.transact(state => { state.meta = { ...(state.meta || {}), automationHistory: [...(state.meta?.automationHistory || []), { id: Date.now(), label, date: new Date().toLocaleString() }] }; }); }

const ALERTS = [
  {id:'invoice-due', category:'due', tone:'warning', title:'Factura #F26-012 próxima a vencer (3 días)', detail:'Revisar el estado del cobro.'},
  {id:'quote-accepted', category:'due', tone:'success', title:'Presupuesto #P26-004 aceptado por el cliente', detail:'Preparar la factura correspondiente.'},
  {id:'client-inactive', category:'clients', tone:'neutral', title:"Sin contacto con el cliente 'Xavi S.L.' en los últimos 30 días", detail:'Conviene programar un seguimiento comercial.'},
  {id:'low-stock', category:'system', tone:'warning', title:"Stock bajo en 'Licencia SaaS' (Quedan 2 unidades)", detail:'Comprobar la disponibilidad del inventario.'},
  {id:'backup-ok', category:'system', tone:'success', title:'Copia de seguridad realizada correctamente', detail:'Última comprobación del sistema.'},
  {id:'billing-limit', category:'system', tone:'warning', title:'Límite de facturación mensual alcanzado (80%)', detail:'Supervisa el uso del periodo actual.'}
];
function renderAlerts() {
  const list=document.getElementById('automation-alerts'); if(!list)return;
  const filter=document.getElementById('automation-alert-filter')?.value||'all';
  const read=new Set(JSON.parse(localStorage.getItem('gestioflex.readAutomationAlerts')||'[]'));
  list.replaceChildren();
  ALERTS.filter(a=>filter==='all'||a.category===filter).forEach(alert=>{
    const li=document.createElement('li'); li.className=`automation-alert ${read.has(alert.id)?'is-read':''}`;
    const content=document.createElement('div'); content.className='automation-alert-content';
    const badge=document.createElement('span'); badge.className=`badge ${alert.tone==='warning'?'badge-warning':alert.tone==='success'?'badge-success':'badge-neutral'}`; badge.textContent=({due:'Vencimiento',clients:'Cliente',system:'Sistema'})[alert.category];
    const title=document.createElement('strong'); title.textContent=alert.title; const detail=document.createElement('p'); detail.textContent=alert.detail; content.append(badge,title,detail);
    const button=document.createElement('button'); button.type='button'; button.className='btn-ghost btn-small'; button.textContent=read.has(alert.id)?'Leída':'Marcar leída'; button.disabled=read.has(alert.id);
    button.addEventListener('click',()=>{read.add(alert.id);localStorage.setItem('gestioflex.readAutomationAlerts',JSON.stringify([...read]));renderAlerts();});
    li.append(content,button); list.append(li);
  });
}

function render() {
  const pro = premium.isPro();
  document.getElementById('automation-workspace').hidden = !pro;
  document.getElementById('automation-upgrade').textContent = pro ? i18n.t('automation.proOnly') : i18n.t('automation.upgrade');
  renderHistory();
  renderAlerts();
}

function bind() {
  document.getElementById('automation-alert-filter')?.addEventListener('change', renderAlerts);
  document.getElementById('automation-upgrade').addEventListener('click', () => { if (!premium.isPro()) premium.show('automations'); else toast(i18n.t('automation.proOnly'), 'info'); });
  document.getElementById('automation-simulate').addEventListener('click', () => { const labels = [i18n.t('automation.example1'), i18n.t('automation.example2')]; toast(labels[Math.floor(Date.now() / 1000) % labels.length], 'info'); });
  document.getElementById('automation-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!premium.require('automations')) return;
    const type = document.getElementById('automation-type').value;
    const days = Number(document.getElementById('automation-days').value) || 5;
    store.transact(state => { state.meta = { ...(state.meta || {}), automationRules: [...(state.meta?.automationRules || []), { id: Date.now(), type, days, active: document.getElementById('automation-active').checked }] }; });
    addHistory(type === 'quote' ? i18n.t('automation.example1') : i18n.t('automation.example2'));
    toast(i18n.t('toast.saved'), 'success');
  });
  store.subscribe(render);
  window.addEventListener('gp:languagechange', render);
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('automation-preview');
  if (!root) return;
  store.getState();
  premium.applyLocks(document);
  bind();
  render();
});
