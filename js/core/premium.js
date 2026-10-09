import { config } from './config.js';
import { i18n } from './i18n.js';
import { auth } from '../auth.js';

let modal = null;

function ensureModal() {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal-overlay premium-modal-overlay';
  modal.id = 'premium-modal';
  modal.innerHTML = `
    <div class="modal-box premium-modal" role="dialog" aria-modal="true" aria-labelledby="premium-modal-title">
      <div class="modal-header"><div><span class="page-eyebrow">Premium</span><h2 id="premium-modal-title"></h2></div><button type="button" class="btn-close" id="premium-modal-close" aria-label="${i18n.t('common.close')}">×</button></div>
      <p class="subtle" id="premium-modal-text"></p>
      <div class="premium-modal-benefits"><span>✓ ${i18n.t('premium.benefit1')}</span><span>✓ ${i18n.t('premium.benefit2')}</span><span>✓ ${i18n.t('premium.benefit3')}</span></div>
      <div class="btn-row premium-modal-actions"><a class="btn-primary" id="premium-modal-cta" href="checkout.html?plan=pyme&period=monthly">${i18n.t('premium.upgrade')}</a><button type="button" class="btn-ghost" id="premium-modal-later">${i18n.t('premium.later')}</button></div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.remove('active');
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.querySelector('#premium-modal-close').addEventListener('click', close);
  modal.querySelector('#premium-modal-later').addEventListener('click', close);
  return modal;
}

function show(featureKey = 'advancedReports') {
  const feature = config.PREMIUM_FEATURES[featureKey] || config.PREMIUM_FEATURES.advancedReports;
  const host = ensureModal();
  host.dataset.feature = featureKey;
  host.querySelector('#premium-modal-title').textContent = i18n.t(feature.titleKey);
  host.querySelector('#premium-modal-text').textContent = i18n.t(feature.descriptionKey);
  const benefits = host.querySelector('.premium-modal-benefits');
  benefits.replaceChildren(...[i18n.t('premium.benefit1'), i18n.t('premium.benefit2'), i18n.t('premium.benefit3')].map(label => { const span=document.createElement('span'); span.textContent=`✓ ${label}`; return span; }));
  host.querySelector('#premium-modal-cta').textContent = i18n.t('premium.upgrade');
  host.querySelector('#premium-modal-later').textContent = i18n.t('premium.later');
  const cta = host.querySelector('#premium-modal-cta');
  cta.href = `checkout.html?plan=pyme&period=monthly&feature=${encodeURIComponent(featureKey)}`;
  host.classList.add('active');
}

function isPro() { return auth.isPro(); }
function require(featureKey) {
  if (isPro()) return true;
  show(featureKey);
  return false;
}
function canCreateQuote() {
  if (isPro()) return true;
  const user = auth.currentUser();
  if (!user) return false;
  const raw = localStorage.getItem(`${config.KEYS.dataPrefix}${user.id}_state`);
  let state = null;
  try { state = raw ? JSON.parse(raw) : null; } catch {}
  const count = state?.documents?.filter(d => d.type === 'PRESUPUESTO' && d.status !== 'CANCELADA' && !String(d.id || '').startsWith('demo_')).length || 0;
  return count < config.FREE_QUOTE_LIMIT;
}
function enforceQuoteLimit() {
  if (canCreateQuote()) return true;
  show('advancedReports');
  return false;
}
function applyLocks(root = document) {
  root.querySelectorAll('[data-premium-feature]').forEach(el => {
    const feature = el.dataset.premiumFeature;
    const pro = isPro();
    el.classList.toggle('premium-locked', !pro);
    el.setAttribute('aria-disabled', pro ? 'false' : 'true');
    if (!pro && !el.dataset.premiumBound) {
      el.dataset.premiumBound = '1';
      el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); require(feature); });
    }
  });
}

window.addEventListener('gp:languagechange', () => { if (modal?.classList.contains('active')) show(modal.dataset.feature || 'advancedReports'); });

export const premium = { isPro, subscriptionTier: () => auth.subscriptionTier(), require, show, canCreateQuote, enforceQuoteLimit, applyLocks };
window.GP = window.GP || {};
window.GP.premium = premium;
