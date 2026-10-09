import { config } from './config.js';
import { storage } from './storage.js';
import { i18n } from './i18n.js';
import { utils } from './utils.js';

let pdfLoader = null;

export function toast(message, type = 'info') {
  let host = document.getElementById('gp-toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'gp-toasts';
    host.className = 'toast-stack';
    document.body.appendChild(host);
  }
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  const span = document.createElement('span');
  span.textContent = String(message ?? '');
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', i18n.t('common.close'));
  close.textContent = '×';
  close.addEventListener('click', () => item.remove());
  item.append(span, close);
  host.appendChild(item);
  window.setTimeout(() => item.remove(), 4200);
  return item;
}

export function applyTheme() {
  let theme = storage.get(config.KEYS.theme, 'dark');
  if (theme !== 'dark' && theme !== 'light') { try { theme = localStorage.getItem(config.KEYS.theme) === 'dark' ? 'dark' : 'light'; } catch {} }
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
  return document.documentElement.dataset.theme;
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || applyTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  storage.set(config.KEYS.theme, next);
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  window.dispatchEvent(new CustomEvent('gp:themechange', { detail: next }));
  return next;
}

export function themeButton(id = 'theme-toggle') {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = id;
  button.className = 'icon-button theme-toggle';
  button.title = themeTitle();
  button.setAttribute('aria-label', themeTitle());
  button.addEventListener('click', () => { toggleTheme(); syncThemeButtons(); });
  updateThemeButton(button);
  return button;
}

export function themeTitle() {
  return applyTheme() === 'dark' ? i18n.t('theme.light') : i18n.t('theme.dark');
}

function updateThemeButton(button) {
  const dark = applyTheme() === 'dark';
  button.textContent = dark ? '☀' : '☾';
  button.title = dark ? i18n.t('theme.light') : i18n.t('theme.dark');
  button.setAttribute('aria-label', button.title);
}

export function syncThemeButtons() {
  document.querySelectorAll('.theme-toggle').forEach(updateThemeButton);
}

export function emptyStateMarkup({ title, description, href = '#', action = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state-card';
  wrap.innerHTML = `
    <div class="empty-state-illustration" aria-hidden="true">
      <svg viewBox="0 0 88 72" width="88" height="72" fill="none">
        <rect x="12" y="12" width="64" height="48" rx="10" stroke="currentColor" stroke-width="2"/>
        <path d="M26 28h36M26 37h25M26 46h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="67" cy="50" r="9" fill="currentColor" opacity=".12"/>
      </svg>
    </div>
    <div class="empty-state-content"><h3></h3><p></p><a class="btn-primary btn-small"></a></div>`;
  wrap.querySelector('h3').textContent = title;
  wrap.querySelector('p').textContent = description;
  const cta = wrap.querySelector('a');
  cta.href = href;
  cta.textContent = action;
  return wrap;
}

export function setSkeletonState(root, active = true) {
  root?.classList.toggle('is-loading', active);
}

export function exportCsv(rows, filename = 'datos.csv') {
  const matrix = Array.isArray(rows) ? rows : [];
  const csv = matrix.map(row => row.map(cell => {
    const value = String(cell ?? '');
    return /[\",\n]/.test(value) ? `\"${value.replace(/\"/g, '\"\"')}\"` : value;
  }).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = String(filename).replace(/[^a-z0-9._-]+/gi, '-') || 'datos.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export async function exportPdf(element, filename = 'documento.pdf') {
  if (!(element instanceof HTMLElement)) {
    throw new Error(i18n.t('pdf.elementMissing'));
  }

  if (!pdfLoader) {
    pdfLoader = new Promise((resolve, reject) => {
      if (window.html2pdf) return resolve(window.html2pdf);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.async = true;
      script.onload = () => window.html2pdf
        ? resolve(window.html2pdf)
        : reject(new Error(i18n.t('pdf.unavailable')));
      script.onerror = () => {
        pdfLoader = null;
        reject(new Error(i18n.t('pdf.unavailable')));
      };
      document.head.appendChild(script);
    });
  }

  const html2pdf = await pdfLoader;
  const lang = (typeof i18n.current === 'function' ? i18n.current() : 'es').toUpperCase();
  const safeName = String(filename || 'documento')
    .replace(/\.pdf$/i, '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'documento';
  const finalName = `${safeName}_${lang}.pdf`;

  // Mantener el elemento real del DOM para conservar traducciones, tablas y estilos actuales.
  const previousTheme = element.getAttribute('data-bs-theme');
  const previousBackground = element.style.backgroundColor;
  const previousColor = element.style.color;
  const previousColorScheme = element.style.colorScheme;

  try {
    element.setAttribute('data-bs-theme', 'light');
    element.style.backgroundColor = '#ffffff';
    element.style.color = '#111111';
    element.style.colorScheme = 'light';

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: finalName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['tr', '.kpi-card', '.report-kpi', '.card', '.document-section', '.total-box']
      }
    }).from(element).save();
  } finally {
    if (previousTheme === null) element.removeAttribute('data-bs-theme');
    else element.setAttribute('data-bs-theme', previousTheme);
    element.style.backgroundColor = previousBackground;
    element.style.color = previousColor;
    element.style.colorScheme = previousColorScheme;
  }
}

applyTheme();
