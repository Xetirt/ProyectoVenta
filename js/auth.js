import { config } from './core/config.js';
import { storage } from './core/storage.js';
import { utils } from './core/utils.js';
import { i18n } from './core/i18n.js';

export const auth = (() => {
  const { KEYS, TRIAL_DAYS, PERMISOS } = config;
  const { get, set, remove } = storage;

  async function hash(password, salt) {
    if (!(window.crypto && crypto.subtle)) throw new Error(i18n.t('error.passwordSecurity'));
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + password));
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  }

  const users = () => get(KEYS.users, []);
  const publico = ({ hash: _h, salt: _s, ...u }) => u;

  function validateAccountData({ empresa, nif, email, password }) {
    if (!empresa?.trim()) throw new Error(i18n.t('error.companyRequired'));
    if (!utils.validateSpanishTaxId(nif, 'NIF/NIE')) throw new Error(i18n.t('error.taxInvalid'));
    if (!/^\S+@\S+\.\S+$/.test(email?.trim() || '')) throw new Error(i18n.t('error.emailInvalid'));
    if ((password || '').length < 8) throw new Error(i18n.t('error.password'));
  }

  async function register({ empresa, nif, email, password, perfil }) {
    empresa = empresa.trim(); email = email.trim().toLowerCase(); nif = utils.normalizeTaxId(nif);
    validateAccountData({ empresa, nif, email, password });
    const lista = users();
    if (lista.some(u => u.email === email)) throw new Error(i18n.t('error.alreadyRegistered'));
    const now = new Date();
    const user = {
      id: utils.uid('user'), empresa, nif, email, perfil: perfil || 'autonomo',
      rol: lista.length === 0 ? 'propietario' : 'empleado',
      sessionToken: utils.uid('token'),
      plan: 'trial', subscriptionTier: 'free', subscriptionStatus: 'trial_active',
      trialEnds: new Date(now.getTime() + TRIAL_DAYS * 864e5).toISOString(),
      createdAt: now.toISOString(), salt: utils.uid('salt'), hash: await hash(password, utils.uid('hashseed'))
    };
    // El hash usa el salt guardado. Recalcular de forma determinista para no almacenar un seed diferente.
    user.hash = await hash(password, user.salt);
    set(KEYS.users, [...lista, user]);
    set(KEYS.session, publico(user));
    return publico(user);
  }

  async function login(email, password) {
    const u = users().find(x => x.email === email.trim().toLowerCase());
    if (!u || u.hash !== await hash(password, u.salt)) throw new Error(i18n.t('error.credentials'));
    const logged = { ...u, sessionToken: utils.uid('token') };
    set(KEYS.users, users().map(x => x.id === u.id ? logged : x));
    set(KEYS.session, publico(logged));
    return publico(logged);
  }

  const currentUser = () => get(KEYS.session, null);

  function syncUser(user) {
    const next = users().map(u => u.id === user.id ? { ...u, ...user } : u);
    set(KEYS.users, next);
    set(KEYS.session, publico(next.find(u => u.id === user.id) || user));
    return currentUser();
  }

  function accessState() {
    const user = currentUser();
    if (!user || !user.sessionToken) return { status: 'unauthenticated', user: null };
    if (user.subscriptionStatus === 'canceled') return { status: 'canceled', user };
    if (user.plan === 'trial' || user.subscriptionStatus === 'trial_active') {
      if (!user.trialEnds || new Date(user.trialEnds).getTime() <= Date.now()) {
        return { status: 'expired', user: syncUser({ ...user, plan: 'expired', subscriptionTier: 'free', subscriptionStatus: 'expired' }) };
      }
      return { status: 'trial_active', user };
    }
    if (['freelance', 'pyme', 'pro'].includes(user.plan) && user.subscriptionStatus === 'active') return { status: 'active', user };
    return { status: 'expired', user: syncUser({ ...user, plan: 'expired', subscriptionTier: 'free', subscriptionStatus: 'expired' }) };
  }

  function isPro() {
    const user = currentUser();
    return !!user && user.subscriptionStatus === 'active' && ['freelance', 'pyme', 'pro'].includes(user.plan);
  }

  function subscriptionTier() {
    const user = currentUser();
    if (!user) return 'anonymous';
    if (isPro()) return user.plan === 'pyme' || user.plan === 'pro' ? 'pro' : 'pro';
    if (user.subscriptionStatus === 'trial_active') return 'free';
    return 'free';
  }

  function hasAccess() {
    const status = accessState().status;
    return status === 'active' || status === 'trial_active';
  }

  function requireAccess() {
    const access = accessState();
    if (access.status === 'unauthenticated') { location.replace('login.html'); return null; }
    if (!['active', 'trial_active'].includes(access.status)) { location.replace('checkout.html'); return null; }
    return access.user;
  }

  function logout() { remove(KEYS.session); location.href = 'index.html'; }
  function can(permiso) { const user = currentUser(); return !!user && (PERMISOS[user.rol] || []).includes(permiso); }

  async function updateProfile(cambios) {
    const sesion = currentUser(); if (!sesion) throw new Error(i18n.t('error.session'));
    const permitidos = ['empresa', 'nif', 'perfil'];
    const clean = Object.fromEntries(Object.entries(cambios).filter(([k]) => permitidos.includes(k)));
    if (clean.empresa !== undefined && !clean.empresa.trim()) throw new Error(i18n.t('error.companyRequired'));
    if (clean.nif !== undefined && !utils.validateSpanishTaxId(clean.nif, 'NIF/NIE')) throw new Error(i18n.t('error.taxInvalid'));
    return syncUser({ ...sesion, ...clean, nif: clean.nif ? utils.normalizeTaxId(clean.nif) : sesion.nif });
  }

  function activateSubscription(plan = 'freelance', billingPeriod = 'monthly', currency = 'EUR') {
    const user = currentUser(); if (!user) throw new Error(i18n.t('error.session'));
    const normalizedPlan = ['freelance','pyme','pro'].includes(plan) ? (plan === 'pro' ? 'pyme' : plan) : 'freelance';
    const now = new Date();
    const renewal = billingPeriod === 'annual' ? new Date(now.getTime() + 365 * 864e5) : new Date(now.getTime() + 30 * 864e5);
    return syncUser({ ...user, plan: normalizedPlan, subscriptionTier: 'pro', billingPeriod, billingCurrency: currency, subscriptionStatus: 'active', subscriptionStartedAt: now.toISOString(), subscriptionRenewalAt: renewal.toISOString() });
  }

  function cancelSubscription() {
    const user = currentUser(); if (!user) throw new Error(i18n.t('error.session'));
    return syncUser({ ...user, subscriptionStatus: 'canceled', subscriptionTier: 'free', plan: 'canceled' });
  }

  function requestReset(email) {
    email = email.trim().toLowerCase();
    if (!users().some(u => u.email === email)) return null;
    const token = utils.uid('reset') + utils.uid('token');
    set(KEYS.resets, { ...get(KEYS.resets, {}), [token]: { email, expira: Date.now() + 3600e3 } });
    return token;
  }

  async function resetPassword(token, nueva) {
    const resets = get(KEYS.resets, {}), record = resets[token];
    if (!record || record.expira < Date.now()) throw new Error(i18n.t('error.expiredReset'));
    if (nueva.length < 8) throw new Error(i18n.t('error.password'));
    const salt = utils.uid('salt'), h = await hash(nueva, salt);
    set(KEYS.users, users().map(u => u.email === record.email ? { ...u, salt, hash: h } : u));
    delete resets[token]; set(KEYS.resets, resets);
  }

  return { register, login, logout, currentUser, accessState, hasAccess, requireAccess, can, isPro, subscriptionTier, updateProfile, activateSubscription, cancelSubscription, requestReset, resetPassword };
})();

window.GP = window.GP || {};
window.GP.auth = auth;

function mostrarMensaje(el, texto, tipo) {
  if (!el) return;
  el.hidden = false;
  el.className = `alert alert-${tipo === 'exito' ? 'ok' : 'error'}`;
  el.textContent = texto;
}

function enlazar(id, accion) {
  const form = document.getElementById(id);
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('mensaje-feedback');
    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    try { await accion(form, msg); }
    catch (err) { mostrarMensaje(msg, err.message, 'error'); if (btn) btn.disabled = false; }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const val = id => document.getElementById(id)?.value || '';
  const resetToken = new URLSearchParams(location.search).get('token');
  if (resetToken) { document.getElementById('form-recuperar')?.setAttribute('hidden',''); const resetForm=document.getElementById('form-reset'); if(resetForm) resetForm.hidden=false; }
  enlazar('form-registro', async (f, msg) => {
    await auth.register({ empresa: val('empresa'), nif: val('cif'), email: val('reg-email'), password: val('reg-password'), perfil: val('perfil') });
    mostrarMensaje(msg, `${config.APP_NAME}: ${i18n.t('subscription.trial')} ${config.TRIAL_DAYS} ${i18n.t('subscription.days')}.`, 'exito');
    setTimeout(() => location.href = 'dashboard.html', 650);
  });

  enlazar('form-login', async (f, msg) => {
    await auth.login(val('email'), val('password'));
    const query = new URLSearchParams(location.search);
    const redirect = query.get('redirect');
    if (redirect && /^[a-zA-Z0-9_-]+\.html$/.test(redirect)) {
      const target = new URL(redirect, location.href);
      ['plan', 'period'].forEach(key => {
        const value = query.get(key);
        if (value) target.searchParams.set(key, value);
      });
      location.href = `${target.pathname.split('/').pop()}${target.search}`;
      return;
    }
    location.href = 'dashboard.html';
  });

  enlazar('form-recuperar', async (f, msg) => {
    const token = auth.requestReset(val('rec-email'));
    mostrarMensaje(msg, i18n.t('auth.recover.text'), 'exito');
    if (token) { const br=document.createElement('br'); const link=document.createElement('a'); link.href=`recuperar.html?token=${encodeURIComponent(token)}`; link.textContent=i18n.t('demo.reset'); link.style.display='inline-block'; link.style.marginTop='.5rem'; msg.append(br,link); }
    const btn = f.querySelector('button[type=submit]'); if (btn) btn.disabled = false;
  });

  enlazar('form-reset', async (f, msg) => {
    await auth.resetPassword(new URLSearchParams(location.search).get('token'), val('nueva-password'));
    mostrarMensaje(msg, `${i18n.t('auth.savePassword')}.`, 'exito');
    setTimeout(() => location.href = 'login.html', 800);
  });
});
