import { store } from './core/store.js';
import { i18n } from './core/i18n.js';
import { premium } from './core/premium.js';
import { utils } from './core/utils.js';
import { toast } from './core/ui.js';

const STAGES = ['lead', 'quote', 'negotiation', 'won', 'lost'];
const stageKeys = { lead: 'crm.leadCreated', quote: 'crm.quoteSent', negotiation: 'crm.negotiation', won: 'crm.wonStage', lost: 'crm.lost' };
const demo = [
  { id: 'demo_crm_1', name: 'Ana García', company: 'Estudio Norte', email: 'ana@example.com', value: 2400, stage: 'lead', note: 'Interesada en servicio recurrente', demo: true },
  { id: 'demo_crm_2', name: 'Bruno Serra', company: 'Serra Digital', email: 'bruno@example.com', value: 5600, stage: 'quote', note: 'Presupuesto enviado', demo: true },
  { id: 'demo_crm_3', name: 'Clara Martín', company: 'Martín & Co', email: 'clara@example.com', value: 3100, stage: 'negotiation', note: 'Pendiente de cerrar alcance', demo: true }
];

function ensureSeed() { const state = store.getState(); if (state.clients.some(c => String(c.id).startsWith('demo_crm_'))) return; store.transact(s => { s.clients = [...(s.clients || []), ...demo]; }); }
function realClients() { return (store.getState().clients || []).filter(c => !String(c.id).startsWith('demo_crm_')); }
function canCreate() { return premium.isPro() || realClients().length < 5; }
function money(value) { return utils.formatMoney(value, store.getState().settings.currency || 'EUR'); }
function matchesSearch(client, query) { if (!query) return true; const haystack = [client.name, client.company, client.email].filter(Boolean).join(' ').toLocaleLowerCase(); return haystack.includes(query.toLocaleLowerCase()); }
function stageOptions() { return STAGES.map(stage => { const option = document.createElement('option'); option.value = stage; option.textContent = i18n.t(stageKeys[stage]); return option; }); }
function card(client) {
  const node = document.createElement('article'); node.className = 'kanban-item'; node.draggable = true; node.dataset.id = client.id;
  const h = document.createElement('h3'); h.textContent = client.company || client.name;
  const p = document.createElement('p'); p.textContent = client.name;
  const val = document.createElement('strong'); val.textContent = money(Number(client.value) || 0);
  const note = document.createElement('textarea'); note.className = 'kanban-note'; note.rows = 2; note.value = client.note || ''; note.placeholder = i18n.t('crm.note'); note.addEventListener('blur', () => { try { store.saveClient({ ...client, note: note.value }); toast(i18n.t('toast.saved'), 'success'); } catch (error) { toast(error.message, 'error'); } });
  node.append(h, p, val, note);
  if (client.tags?.length) { const tags = document.createElement('div'); tags.className = 'tag-row'; client.tags.forEach(tag => { const span = document.createElement('span'); span.className = 'tag'; span.textContent = tag; tags.appendChild(span); }); node.append(tags); }
  node.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', client.id); node.classList.add('dragging'); });
  node.addEventListener('dragend', () => node.classList.remove('dragging'));
  return node;
}
function render() {
  const state = store.getState();
  const board = document.getElementById('crm-board');
  const query = document.getElementById('crm-search')?.value.trim() || '';
  board.replaceChildren();
  const visible = state.clients.filter(client => matchesSearch(client, query));
  const groups = Object.fromEntries(STAGES.map(stage => [stage, visible.filter(client => !client.stage || client.stage === stage)]));
  STAGES.forEach(stage => {
    const col = document.createElement('section'); col.className = 'kanban-column'; col.dataset.stage = stage;
    const head = document.createElement('div'); head.className = 'kanban-column-head';
    const h = document.createElement('h2'); h.textContent = i18n.t(stageKeys[stage]);
    const count = document.createElement('span'); count.className = 'badge badge-neutral'; count.textContent = String(groups[stage].length);
    const total = groups[stage].reduce((sum, client) => sum + (Number(client.value) || 0), 0); const totalEl = document.createElement('small'); totalEl.textContent = money(total);
    head.append(h, count, totalEl);
    const list = document.createElement('div'); list.className = 'kanban-list'; groups[stage].forEach(client => list.appendChild(card(client)));
    if (!groups[stage].length) { const empty = document.createElement('div'); empty.className = 'kanban-empty'; empty.textContent = query ? i18n.t('crm.noSearchResults') : i18n.t('crm.empty'); list.appendChild(empty); }
    col.append(head, list);
    col.addEventListener('dragover', e => e.preventDefault());
    col.addEventListener('drop', e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); const client = store.getState().clients.find(item => item.id === id); if (client) { try { store.saveClient({ ...client, stage }); toast(i18n.t('toast.saved'), 'success'); } catch (error) { toast(error.message, 'error'); } } });
    board.append(col);
  });
  const vals = state.clients; const total = vals.reduce((sum, client) => sum + (Number(client.value) || 0), 0); const risk = vals.filter(client => ['lead', 'quote', 'negotiation'].includes(client.stage)).reduce((sum, client) => sum + (Number(client.value) || 0), 0); const won = vals.filter(client => client.stage === 'won').reduce((sum, client) => sum + (Number(client.value) || 0), 0);
  document.getElementById('crm-total').textContent = money(total); document.getElementById('crm-risk').textContent = money(risk); document.getElementById('crm-won').textContent = money(won); document.getElementById('crm-limit').textContent = premium.isPro() ? i18n.t('crm.proUnlimited') : i18n.t('crm.freeLimit', { current: realClients().length, limit: 5 });
}
function bind() {
  const form = document.getElementById('crm-form'); const stage = document.getElementById('crm-stage'); stage.replaceChildren(...stageOptions());
  document.getElementById('crm-search').addEventListener('input', render);
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!canCreate()) { premium.show('crmUnlimited'); return; }
    const tags = document.getElementById('crm-tags').value.split(',').map(x => x.trim()).filter(Boolean);
    if (tags.length && !premium.require('crmTags')) return;
    const client = { name: document.getElementById('crm-name').value.trim(), company: document.getElementById('crm-company').value.trim(), email: document.getElementById('crm-email').value.trim(), value: Number(document.getElementById('crm-value').value) || 0, stage: stage.value, note: document.getElementById('crm-note').value.trim(), tags };
    try { store.saveClient(client); form.reset(); stage.value = 'lead'; toast(i18n.t('toast.saved'), 'success'); } catch (error) { toast(error.message, 'error'); }
  });
  document.getElementById('crm-tags').addEventListener('focus', () => { if (!premium.isPro()) premium.require('crmTags'); });
  store.subscribe(render);
  window.addEventListener('gp:languagechange', () => { stage.replaceChildren(...stageOptions()); render(); });
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('crm-board');
  if (!root) return;
  store.getState();
  ensureSeed();
  premium.applyLocks(document);
  bind();
  render();
});
