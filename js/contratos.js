import { store } from './core/store.js';
import { i18n } from './core/i18n.js';
import { premium } from './core/premium.js';
import { toast, exportPdf } from './core/ui.js';

const templates = {
  standard: { title: 'Servicios estándar', body: 'El proveedor prestará los servicios acordados con el cliente conforme al presupuesto aceptado. El cliente abonará los importes y condiciones indicados en el documento de referencia.' },
  web: { title: 'Servicios Web', body: 'Desarrollo, diseño, mantenimiento y soporte de servicios web. Los entregables y hitos se definirán en la propuesta comercial aceptada.' },
  maintenance: { title: 'Mantenimiento', body: 'Servicio de mantenimiento preventivo y correctivo, con los tiempos de atención y alcance descritos en la propuesta comercial.' },
  consulting: { title: 'Consultoría', body: 'Servicios de consultoría profesional, incluyendo reuniones, análisis, recomendaciones y documentación según el alcance acordado.' }
};
function state() { return store.getState(); }
function clients() { return state().clients || []; }
function quotes() { return (state().documents || []).filter(d => d.type === 'PRESUPUESTO' && ['ACEPTADO', 'ACCEPTED'].includes(String(d.status || '').toUpperCase())); }
function selectedClient() { const id = document.getElementById('contract-client').value; return clients().find(client => client.id === id) || null; }
function refreshOptions() {
  const clientSelect = document.getElementById('contract-client'); const quoteSelect = document.getElementById('contract-quote'); const selectedClientId = clientSelect.value; const selectedQuoteId = quoteSelect.value;
  clientSelect.replaceChildren(new Option(i18n.t('contracts.selectClient'), '')); clients().forEach(client => clientSelect.append(new Option(client.company || client.name, client.id))); clientSelect.value = selectedClientId || '';
  quoteSelect.replaceChildren(new Option(i18n.t('contracts.noAccepted'), '')); quotes().forEach(quote => quoteSelect.append(new Option(`${quote.number || ''} · ${quote.client?.name || ''}`, quote.id))); quoteSelect.value = selectedQuoteId || '';
  toggleAdvanced();
}
function toggleAdvanced() { const advanced = document.getElementById('contract-template').value !== 'standard'; const note = document.getElementById('contract-advanced-note'); note.hidden = premium.isPro() || !advanced; document.getElementById('contract-clauses').disabled = advanced && !premium.isPro(); }
function fillFromQuote() { const quote = quotes().find(item => item.id === document.getElementById('contract-quote').value); if (!quote) return; const client = clients().find(item => item.name === quote.client?.name || item.email === quote.client?.email); if (client) document.getElementById('contract-client').value = client.id; }
function buildContract() {
  const client = selectedClient(); const quote = quotes().find(item => item.id === document.getElementById('contract-quote').value); const templateKey = document.getElementById('contract-template').value || 'standard';
  if (templateKey !== 'standard' && !premium.isPro()) { premium.show('contractAdvanced'); return null; }
  const company = state().settings.companyName || 'Empresa'; const date = document.getElementById('contract-date').value || new Date().toISOString().slice(0, 10); const clauses = premium.isPro() ? document.getElementById('contract-clauses').value.trim() : '';
  return { company, clientId: client?.id || '', client: client?.company || client?.name || 'Cliente', email: client?.email || '', quoteId: quote?.id || '', quote: quote?.number || '', templateKey, template: templates[templateKey].title, date, duration: document.getElementById('contract-duration').value.trim(), body: templates[templateKey].body, clauses };
}
function render() {
  const template = document.getElementById('contract-template');
  if (template && !template.value) template.value = 'standard';
  const data = buildContract(); if (!data) return;
  const root = document.getElementById('contract-preview'); root.replaceChildren(); root.classList.add('contract-document');
  const header=document.createElement('header'); header.className='contract-paper-header';
  const kicker=document.createElement('div'); kicker.className='contract-paper-kicker'; kicker.textContent=data.company;
  const title=document.createElement('h2'); title.textContent='CONTRATO DE PRESTACIÓN DE SERVICIOS';
  const rule=document.createElement('div'); rule.className='contract-paper-rule'; header.append(kicker,title,rule); root.append(header);
  const meta=document.createElement('section'); meta.className='contract-meta-grid';
  [['contracts.from',data.company],['contracts.to',data.client],['contracts.date',data.date],['contracts.duration',data.duration]].forEach(([key,value])=>{const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=`${i18n.t(key)}: `;p.append(strong,document.createTextNode(value||'—'));meta.append(p);}); root.append(meta);
  const h = document.createElement('h3'); h.textContent = data.template; root.append(h);
  const body = document.createElement('p'); body.className='contract-clause'; body.textContent = data.body; root.append(body);
  if (data.quote) { const q = document.createElement('p'); q.className = 'contract-reference'; q.textContent = `${i18n.t('contracts.quote')}: ${data.quote}`; root.append(q); }
  if (data.clauses) { const ch = document.createElement('h3'); ch.textContent = i18n.t('contracts.clauses'); const cp = document.createElement('p'); cp.className='contract-clause'; cp.textContent = data.clauses; root.append(ch, cp); }
  const signatures=document.createElement('section'); signatures.className='contract-signatures';
  [['Firma del Proveedor',data.company],['Firma del Cliente',data.client]].forEach(([label,name])=>{const box=document.createElement('div');box.className='contract-signature-box';const line=document.createElement('div');line.className='contract-signature-line';const strong=document.createElement('strong');strong.textContent=label;const small=document.createElement('span');small.textContent=name;box.append(line,strong,small);signatures.append(box);});root.append(signatures);
  document.getElementById('contracts-plan').textContent = premium.isPro() ? 'Pro' : 'Free · Standard';
}
function saveCurrentContract() { const data = buildContract(); if (!data) return null; const saved = store.saveContract(data); render(); return saved; }
async function downloadPdf() { const data = buildContract(); if (!data) return; try { await exportPdf(document.getElementById('contract-preview'), `contrato-${data.client || 'cliente'}.pdf`); toast(i18n.t('contracts.pdfReady'), 'success'); } catch (error) { toast(error.message, 'error'); } }
function printContract() { const data = buildContract(); if (!data) return; const printWindow = window.open('', '_blank', 'width=900,height=800'); if (!printWindow) { toast(i18n.t('contracts.popupBlocked'), 'error'); return; } const content = document.getElementById('contract-preview').innerHTML; printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${String(data.template).replace(/[<>]/g, '')}</title><style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.6;color:#172033}h2{margin:28px 0 14px}p{margin:8px 0}</style></head><body>${content}</body></html>`); printWindow.document.close(); printWindow.focus(); printWindow.print(); }
function bind() {
  const form = document.getElementById('contract-form');
  const template = document.getElementById('contract-template');
  const client = document.getElementById('contract-client');
  const quote = document.getElementById('contract-quote');
  const printBtn = document.getElementById('contract-print');
  const downloadBtn = document.getElementById('contract-download');
  if (!form || !template || !client || !quote) return false;

  template.addEventListener('change', () => { toggleAdvanced(); render(); });
  client.addEventListener('change', render);
  quote.addEventListener('change', () => { fillFromQuote(); render(); });
  form.addEventListener('input', event => {
    if (event.target.matches('input, textarea, select')) render();
  });
  form.addEventListener('change', event => {
    if (event.target.matches('input, textarea, select')) render();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const saved = saveCurrentContract();
    if (saved) toast(i18n.t('contracts.saved'), 'success');
  });
  printBtn?.addEventListener('click', printContract);
  downloadBtn?.addEventListener('click', downloadPdf);
  store.subscribe(() => { refreshOptions(); render(); });
  window.addEventListener('gp:languagechange', () => { refreshOptions(); render(); });
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('contract-preview');
  const form = document.getElementById('contract-form');
  if (!root || !form) return;
  document.getElementById('contract-template').value ||= 'standard';
  document.getElementById('contract-date').value = new Date().toISOString().slice(0, 10);
  store.getState();
  premium.applyLocks(document);
  refreshOptions();
  bind();
  render();
});
