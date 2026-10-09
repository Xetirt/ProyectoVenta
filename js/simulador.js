import { store } from './core/store.js';
import { i18n } from './core/i18n.js';
import { auth } from './auth.js';
import { premium } from './core/premium.js';
import { utils } from './core/utils.js';
import { toast, exportCsv } from './core/ui.js';

const scenarios = { pessimistic: 0.78, realistic: 1, optimistic: 1.22 };
const els = id => document.getElementById(id);
let chartInstance = null;

function money(value) { return utils.formatMoney(value, store.getState().settings.currency || 'EUR'); }

function projectMonths(months, factor = 1) {
  const stats = store.stats();
  const issued = stats.issued || [];
  const monthCount = new Set(issued.map(d => (d.issueDate || '').slice(0, 7)).filter(Boolean)).size || 1;
  const baseMonthly = Math.max(1, (stats.ingresos || 0) / monthCount);
  const conversion = Number(els('sim-conversion').value) / 100;
  const growth = Number(els('sim-growth').value) / 100;
  const cac = Number(els('sim-cac').value);
  const prospects = Number(els('sim-potential').value);
  const currency = store.getState().settings.currency || 'EUR';
  const taxRate = utils.currencyTaxRate(currency) / 100;
  const avgTicket = issued.length && stats.ingresos > 0 ? stats.ingresos / issued.length : Math.max(500, baseMonthly / 2);
  const monthlyNewRevenue = prospects * conversion * avgTicket;
  const values = [];
  for (let m = 1; m <= months; m += 1) {
    const multiplier = Math.pow(1 + growth, m - 1);
    const recurrent = baseMonthly * multiplier;
    const acquired = monthlyNewRevenue * multiplier;
    const value = (recurrent + acquired) * factor;
    const acquisitionCost = prospects * conversion * cac;
    const taxAmount = utils.roundMoney(value * taxRate);
    values.push({ month: m, revenue: utils.roundMoney(value), tax: taxAmount, cash: utils.roundMoney(value - acquisitionCost - taxAmount), acquisitionCost: utils.roundMoney(acquisitionCost) });
  }
  return values;
}

function drawChart(dataSets, labels) {
  const canvas = els('sim-chart');
  if (!canvas) return;
  const root = getComputedStyle(document.documentElement);
  const text = root.getPropertyValue('--text-secondary').trim() || '#64748b';
  const grid = root.getPropertyValue('--border-color').trim() || 'rgba(148,163,184,.16)';
  if (window.Chart) {
    if (chartInstance) chartInstance.destroy();
    chartInstance = new window.Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: dataSets.map((ds, index) => ({
          label: i18n.t(`simulator.${ds.key}`),
          data: ds.values.map(p => p.revenue),
          borderColor: ['#94a3b8', '#10b981', '#60a5fa'][index],
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          tension: 0.28,
          pointRadius: 2,
          fill: false
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { labels: { color: text, boxWidth: 14 } } },
        scales: {
          x: { ticks: { color: text }, grid: { color: grid } },
          y: { ticks: { color: text, callback: value => money(value) }, grid: { color: grid } }
        }
      }
    });
    return;
  }
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(210, Math.floor(rect.height || 260));
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const pad = { l: 42, r: 18, t: 20, b: 34 };
  const max = Math.max(1, ...dataSets.flatMap(d => d.values.map(x => x.revenue)));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  ctx.strokeStyle = grid;
  for (let i = 0; i < 5; i += 1) { const y = pad.t + innerH * i / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke(); }
  ctx.fillStyle = text;
  ctx.font = '11px system-ui';
  labels.forEach((label, i) => { const x = pad.l + innerW * (i / Math.max(1, labels.length - 1)); ctx.fillText(label, x - 14, height - 10); });
  dataSets.forEach((ds, di) => { ctx.strokeStyle = ['#94a3b8', '#10b981', '#60a5fa'][di]; ctx.lineWidth = 2.5; ctx.beginPath(); ds.values.forEach((p, i) => { const x = pad.l + innerW * (i / Math.max(1, ds.values.length - 1)); const y = pad.t + innerH * (1 - p.revenue / max); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); });
}


function exportProjectionCsv() {
  const months = Number(els('sim-horizon').value);
  const data = Object.entries(scenarios).map(([key, factor]) => ({ key, values: projectMonths(months, factor) }));
  const byMonth = new Map(data[0].values.map(point => [point.month, { month: point.month }]));
  data.forEach(series => series.values.forEach(point => {
    byMonth.get(point.month)[series.key] = point.revenue;
    byMonth.get(point.month)[`${series.key}Cash`] = point.cash;
    byMonth.get(point.month)[`${series.key}Tax`] = point.tax || 0;
  }));
  const rows = [
    ['Mes', 'Escenario pesimista', 'Escenario realista', 'Escenario optimista', 'Impuesto realista', 'Caja realista'],
    ...Array.from(byMonth.values()).map(row => [row.month, row.pessimistic || 0, row.realistic || 0, row.optimistic || 0, row.realisticTax || 0, row.realisticCash || 0])
  ];
  exportCsv(rows, `proyeccion-${months}m.csv`);
  toast(i18n.t('premium.reportCsv'), 'success');
}

function isAllowedMonths(months) { return months === 3 || premium.require('simulatorAdvanced'); }

function render() {
  const horizon = Number(els('sim-horizon').value);
  if (horizon > 3 && !premium.isPro()) { els('sim-horizon').value = '3'; toast(i18n.t('premium.blocked'), 'info'); }
  const months = Number(els('sim-horizon').value);
  const data = Object.entries(scenarios).map(([key, factor]) => ({ key, values: projectMonths(months, factor) }));
  const labels = data[1].values.map(p => i18n.t('simulator.month', { n: p.month }));
  drawChart(data, labels);
  const realistic = data.find(d => d.key === 'realistic').values;
  const last = realistic.at(-1) || { revenue: 0, cash: 0, acquisitionCost: 0 };
  els('sim-kpi-revenue').textContent = money(last.revenue);
  els('sim-kpi-cash').textContent = money(last.cash);
  els('sim-kpi-acq').textContent = money(last.acquisitionCost);
  const taxKpi = els('sim-kpi-tax'); if (taxKpi) taxKpi.textContent = money(last.tax || 0);
  [['pess', 'pessimistic'], ['real', 'realistic'], ['opt', 'optimistic']].forEach(([id, key]) => { const v = data.find(d => d.key === key).values.reduce((a, p) => a + p.revenue, 0); els(`sim-s-${id}`).textContent = money(utils.roundMoney(v)); });
  els('sim-note').textContent = premium.isPro() ? i18n.t('simulator.proNote') : i18n.t('simulator.freeNote');
  const user = auth.currentUser();
  els('sim-plan-badge').textContent = premium.isPro() ? `Pro · ${user?.plan || 'pro'}` : 'Free · Trial';
}

function bind() {
  ['sim-conversion', 'sim-growth', 'sim-cac', 'sim-potential'].forEach(id => {
    const input = els(id); const out = els(`${id}-value`);
    input.addEventListener('input', () => { out.textContent = id === 'sim-cac' ? money(Number(input.value)) : `${input.value}${id === 'sim-potential' ? '' : '%'}`; render(); });
  });
  els('sim-horizon').addEventListener('change', () => { const months = Number(els('sim-horizon').value); if (!isAllowedMonths(months)) { els('sim-horizon').value = '3'; return; } render(); });
  els('sim-project').addEventListener('click', render);
  els('sim-export-csv')?.addEventListener('click', exportProjectionCsv);
  els('sim-extreme').addEventListener('click', e => {
    if (!premium.require('simulatorAdvanced')) return;
    const current = Number(els('sim-growth').value);
    const next = current >= 15 ? -10 : 20;
    els('sim-growth').value = String(next);
    els('sim-growth-value').textContent = `${next}%`;
    render();
    toast(i18n.t('simulator.extreme'), 'success');
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(render, 120); });
  store.subscribe(render);
  window.addEventListener('gp:languagechange', render);
  window.addEventListener('gp:themechange', render);
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('sim-chart');
  if (!root) return;
  store.getState();
  premium.applyLocks(document);
  bind();
  render();
});
