import { config } from './core/config.js';
import { storage } from './core/storage.js';
import { utils } from './core/utils.js';
import { i18n } from './core/i18n.js';
import { auth } from './auth.js';
import { store } from './core/store.js';
import { toast, applyTheme, syncThemeButtons } from './core/ui.js';

const GP = { config, storage, utils, i18n, auth, store, toast };
window.GP = window.GP || {};
Object.assign(window.GP, GP); // Compatibility bridge only; application code imports modules.

function logout() { auth.logout(); }
function pageName() { return location.pathname.split('/').pop() || 'index.html'; }

function themeButtonHtml() { return `<button type="button" class="icon-button theme-toggle" aria-label="${utils.escapeHtml(i18n.t('theme.dark'))}" title="${utils.escapeHtml(i18n.t('theme.dark'))}">${applyTheme()==='dark'?'☀':'☾'}</button>`; }

GP.renderPublicNavbar = () => {
  const host = document.getElementById('app-navbar');
  if (!host) return;
  const user = auth.currentUser();
  const toolsLabel = user && auth.hasAccess() ? i18n.t('nav.panel') : i18n.t('nav.login');
  const toolsHref = user && auth.hasAccess() ? 'dashboard.html' : 'login.html';
  host.className = 'navbar';
  host.innerHTML = `<div class="logo">${utils.escapeHtml(config.APP_NAME)}</div><nav><ul><li><a href="index.html">${i18n.t('nav.home')}</a></li><li><a href="${toolsHref}">${toolsLabel}</a></li>${user ? `<li><a href="#" id="public-logout" class="btn-secondary">${i18n.t('nav.logout')}</a></li>` : `<li><a href="login.html" class="btn-secondary">${i18n.t('nav.login')}</a></li><li><a href="registro.html" class="btn-primary">${i18n.t('nav.register')}</a></li>`}<li>${i18n.languageSelect('langSelect')}</li><li class="navbar-theme">${themeButtonHtml()}</li></ul></nav>`;
  document.getElementById('public-logout')?.addEventListener('click', e => { e.preventDefault(); logout(); });
  i18n.bindSelect('langSelect');
  document.querySelector('.theme-toggle')?.addEventListener('click', () => { GP.themeToggle?.(); });
  syncThemeButtons();
};

function sidebarLink(href, icon, key, activePage) {
  return `<a class="sidebar-link ${href === activePage ? 'active' : ''}" href="${href}"><span class="sidebar-icon">${icon}</span><span class="sidebar-label">${i18n.t(key)}</span></a>`;
}

function bindThemeButton() {
  const button = document.getElementById('app-theme-toggle');
  if (!button || button.dataset.gpBound === '1') return;
  button.dataset.gpBound = '1';
  button.addEventListener('click', () => GP.themeToggle?.());
}
GP.themeToggle = () => { import('./core/ui.js').then(({ toggleTheme }) => { toggleTheme(); syncThemeButtons(); }); };

GP.renderAppShell = () => {
  const sidebar = document.getElementById('app-sidebar');
  const topbar = document.getElementById('app-topbar');
  if (!sidebar || !topbar) return;
  const user = auth.currentUser();
  const access = auth.accessState();
  const current = pageName();
  sidebar.innerHTML = `<div class="sidebar-brand"><div class="brand-mark">G</div><div><strong>${utils.escapeHtml(config.APP_NAME)}</strong><small>${i18n.t('app.tagline')}</small></div></div><button class="sidebar-collapse" id="sidebar-collapse" type="button" aria-label="${utils.escapeHtml(i18n.t('sidebar.collapse'))}">☰</button><nav class="sidebar-nav" aria-label="${utils.escapeHtml(i18n.t('nav.home'))}">${sidebarLink('dashboard.html','⌂','sidebar.dashboard',current)}${sidebarLink('presupuestos.html','▤','sidebar.billing',current)}${sidebarLink('funcionalidades.html','▦','sidebar.inventory',current)}${sidebarLink('calculadora.html','◒','sidebar.finance',current)}${sidebarLink('simulador.html','◌','sidebar.simulator',current)}${sidebarLink('clientes.html','♧','sidebar.crm',current)}${sidebarLink('contratos.html','▣','sidebar.contracts',current)}${sidebarLink('automatizaciones.html','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>','sidebar.automations',current)}<div class="sidebar-separator"></div>${auth.can('configuracion') ? sidebarLink('configuracion.html','⚙','sidebar.settings',current) : ''}${sidebarLink('perfil.html','◉','sidebar.profile',current)}</nav><div class="sidebar-footer"><div class="sidebar-language">${i18n.languageSelect('private-language-select')}</div><button id="btn-sidebar-logout" class="sidebar-logout" type="button">↪ <span class="sidebar-label">${i18n.t('nav.logout')}</span></button></div>`;
  sidebar.querySelectorAll('.sidebar-link').forEach(link => { link.classList.toggle('active', link.getAttribute('href') === current); });

  const userText = user ? utils.escapeHtml(user.empresa || user.email) : '';
  let banner = '';
  if (access.status === 'trial_active') {
    const days = utils.daysRemaining(access.user.trialEnds);
    banner = `<div class="trial-banner"><span>${i18n.t('subscription.trial')}: <strong>${days} ${days === 1 ? i18n.t('subscription.day') : i18n.t('subscription.days')}</strong> ${i18n.t('subscription.remaining')}</span><a href="checkout.html">${i18n.t('subscription.manage')}</a></div>`;
  } else if (access.status === 'active') {
    banner = `<div class="trial-banner active"><span>${i18n.t('subscription.active')}</span><a href="perfil.html">${i18n.t('subscription.manage')}</a></div>`;
  }
  topbar.innerHTML = `<div class="topbar-left"><button class="mobile-menu" id="mobile-menu" type="button">☰</button><div><span class="eyebrow">${utils.escapeHtml(config.APP_NAME)}</span><strong>${userText}</strong></div></div><div class="topbar-actions"><button type="button" id="app-theme-toggle" class="icon-button theme-toggle" aria-label="${utils.escapeHtml(i18n.t('theme.dark'))}" title="${utils.escapeHtml(i18n.t('theme.dark'))}">${applyTheme()==='dark'?'☀':'☾'}</button>${banner}<span class="user-chip">${utils.escapeHtml(user?.email || '')}</span></div>`;

  const toggle = () => document.body.classList.toggle('sidebar-collapsed');
  document.getElementById('sidebar-collapse')?.addEventListener('click', toggle);
  document.getElementById('mobile-menu')?.addEventListener('click', () => document.body.classList.toggle('sidebar-mobile-open'));
  document.getElementById('btn-sidebar-logout')?.addEventListener('click', logout);
  i18n.bindSelect('private-language-select');
  bindThemeButton(); syncThemeButtons();
};

GP.initLanding = () => {
  if (!document.body.classList.contains('landing-main')) return;
  const plans = config.PLANS || {};
  let period = document.querySelector('.billing-toggle button.active')?.dataset.period || 'monthly';
  const renderPricing = () => {
    ['freelance', 'pyme'].forEach(key => {
      const plan = plans[key];
      const node = document.getElementById(`price-${key}`);
      const link = document.querySelector(`[data-plan-link="${key}"]`);
      if (!plan || !node) return;
      const value = period === 'annual' ? utils.roundMoney(Number(plan.annual) / 12) : plan.monthly;
      node.replaceChildren(document.createTextNode(utils.formatMoney(value, 'EUR')), (() => { const small=document.createElement('small'); small.textContent=i18n.t('pricing.perMonth'); return small; })());
      if (period === 'annual') { const billed=document.createElement('span'); billed.className='price-billed-annually'; billed.textContent=i18n.t('pricing.billedAnnually',{total:utils.formatMoney(plan.annual,'EUR')}); node.appendChild(billed); }
      if (link) link.href = `checkout.html?plan=${encodeURIComponent(key)}&period=${encodeURIComponent(period)}`;
    });
    document.querySelectorAll('.billing-toggle button').forEach(button => { const active=button.dataset.period===period; button.classList.toggle('active',active); button.setAttribute('aria-selected',active?'true':'false'); });
  };
  document.querySelectorAll('.billing-toggle button').forEach(button => {
    if (button.dataset.gpBound === '1') return;
    button.dataset.gpBound='1'; button.addEventListener('click',()=>{period=button.dataset.period==='annual'?'annual':'monthly';renderPricing();});
  });
  document.querySelectorAll('.faq-question').forEach(button=>{
    if(button.dataset.gpBound==='1')return; button.dataset.gpBound='1'; button.setAttribute('aria-expanded',button.parentElement.classList.contains('open')?'true':'false');
    button.addEventListener('click',()=>{const item=button.parentElement;const open=!item.classList.contains('open');item.classList.toggle('open',open);button.setAttribute('aria-expanded',open?'true':'false');const icon=button.querySelector('.faq-icon')||button.lastElementChild;if(icon)icon.textContent=open?'−':'+';});
  });
  renderPricing();
};

GP.protectCurrentPage = () => {
  const current = pageName();
  if (!config.PRIVATE_PAGES.includes(current)) return true;
  return !!auth.requireAccess();
};

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  i18n.apply();
  const protectedPage = config.PRIVATE_PAGES.includes(pageName());
  if (protectedPage && !GP.protectCurrentPage()) return;
  if (protectedPage) {
    GP.renderAppShell();
    setInterval(() => { if (!auth.hasAccess()) auth.requireAccess(); else GP.renderAppShell(); }, 60000);
  } else { GP.renderPublicNavbar(); GP.initLanding(); }
  const welcome = new URLSearchParams(location.search).get('welcome');
  if (welcome === '1' && auth.currentUser()) toast(i18n.t('checkout.welcome'),'success');
});

window.addEventListener('gp:languagechange', () => {
  const protectedPage = config.PRIVATE_PAGES.includes(pageName());
  if (protectedPage && auth.hasAccess()) GP.renderAppShell();
  else if (!protectedPage) { GP.renderPublicNavbar(); GP.initLanding(); }
  syncThemeButtons();
});
window.addEventListener('gp:themechange', syncThemeButtons);
