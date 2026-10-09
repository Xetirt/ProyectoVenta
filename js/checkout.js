import { config, COUNTRY_TAX_CONFIG } from './core/config.js';
import { utils } from './core/utils.js';
import { i18n } from './core/i18n.js';
import { auth } from './auth.js';
import { store } from './core/store.js';
import { toast } from './core/ui.js';
document.addEventListener('DOMContentLoaded', () => {
  const planSelect = document.getElementById('checkout-plan');
  const periodSelect = document.getElementById('checkout-period');
  const countrySelect = document.getElementById('billing-country');
  const taxRate = document.getElementById('billing-tax-rate');
  const stateWrap = document.getElementById('billing-state-wrap');
  const stateSelect = document.getElementById('billing-state');
  const methodDetails = document.getElementById('payment-details');
  const transferDetails = document.getElementById('transfer-details');
  const feedback = document.getElementById('checkout-feedback');
  const btn = document.getElementById('pay-button');
  const query = new URLSearchParams(location.search);
  const backButton = document.getElementById('checkout-back');
  backButton?.addEventListener('click', () => window.history.back());
  i18n.apply();
  const user = auth.currentUser();

  if (query.get('plan') && config.PLANS[query.get('plan')]) planSelect.value = query.get('plan');
  if (query.get('period') === 'annual') periodSelect.value = 'annual';

  let currency = 'EUR';
  function renderCountryOptions() {
    const selected = countrySelect.value || user?.billingCountry || 'ES';
    countrySelect.innerHTML = '';
    config.BILLING_COUNTRIES.forEach(country => {
      const cfg = COUNTRY_TAX_CONFIG[country.code] || COUNTRY_TAX_CONFIG.OTHER;
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = i18n.t(cfg.labelKey);
      countrySelect.appendChild(option);
    });
    const validCountry = config.BILLING_COUNTRIES.some(c => c.code === selected);
    countrySelect.value = validCountry ? selected : 'ES';
  }
  renderCountryOptions();
  if (user) {
    document.getElementById('billing-name').value = user.empresa || '';
    document.getElementById('billing-email').value = user.email || '';
    document.getElementById('billing-tax-id').value = user.nif || '';
  }

  function countryConfig() {
    return COUNTRY_TAX_CONFIG[countrySelect.value] || COUNTRY_TAX_CONFIG.OTHER;
  }
  function renderStates() {
    const c = countryConfig();
    const isUS = c.requiresState === true;
    stateWrap.hidden = !isUS;
    if (!isUS) {
      stateSelect.innerHTML = '';
      return;
    }
    const previous = stateSelect.value;
    stateSelect.innerHTML = config.TAX_PROFILES.US.states
      .map(code => `<option value="${code}">${code}</option>`)
      .join('');
    if (previous && config.TAX_PROFILES.US.states.includes(previous)) stateSelect.value = previous;
  }

  function renderTaxRate() {
    const c = countryConfig();
    const stateRate = c.requiresState && stateSelect.value
      ? config.TAX_PROFILES.US.salesTaxByState?.[stateSelect.value]
      : null;
    const rate = Number.isFinite(Number(stateRate)) ? Number(stateRate) : Number(c.taxRate || 0);
    currency = c.currency || 'EUR';
    taxRate.value = rate;
    const labelKey = c.taxLabelKey || 'tax.tax';
    const label = `${i18n.t(labelKey)} (${rate}%)`;
    const taxLabel = document.getElementById('checkout-tax-label');
    const legacyTaxLabel = document.getElementById('summary-tax-label');
    if (taxLabel) taxLabel.textContent = label;
    if (legacyTaxLabel && legacyTaxLabel !== taxLabel) legacyTaxLabel.textContent = label;
    renderSummary();
  }

  function amount() { const plan=config.PLANS[planSelect.value] || config.PLANS.freelance; return Number(plan[periodSelect.value]) || 0; }
  function formatCheckoutMoney(value) {
    const cfg = config.CURRENCIES[currency] || config.CURRENCIES.EUR;
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(Number(value) || 0));
  }

  function renderSummary() {
    const plan = config.PLANS[planSelect.value] || config.PLANS.freelance;
    // Los precios de los planes son importes finales con impuestos incluidos.
    // Extraemos la base imponible y el impuesto con redondeo a euros enteros,
    // manteniendo siempre el total anunciado del plan.
    const total = Math.round(amount());
    const rate = Math.max(0, Math.min(100, Number(taxRate.value) || 0));
    const includesTax = countryConfig().priceIncludesTax !== false;
    const base = includesTax && rate > 0 ? Math.round(total / (1 + rate / 100)) : total;
    const tax = includesTax ? total - base : Math.round(base * rate / 100);
    const payable = includesTax ? total : base + tax;
    const baseOutput = document.getElementById('checkout-subtotal') || document.getElementById('summary-base');
    const taxOutput = document.getElementById('checkout-tax-amount') || document.getElementById('summary-tax');
    const totalOutput = document.getElementById('checkout-total') || document.getElementById('summary-total');
    document.getElementById('summary-plan').textContent = i18n.t(plan.key === 'pyme' ? 'pricing.pyme' : 'pricing.freelance');
    document.getElementById('summary-period').textContent = i18n.t(periodSelect.value === 'annual' ? 'checkout.annual' : 'checkout.monthly');
    if (baseOutput) baseOutput.textContent = formatCheckoutMoney(base);
    if (taxOutput) taxOutput.textContent = formatCheckoutMoney(tax);
    if (totalOutput) totalOutput.textContent = formatCheckoutMoney(payable);
  }
  function luhn(value) { const digits=value.replace(/\D/g,''); if(digits.length<13||digits.length>19)return false; let sum=0;let alt=false;for(let i=digits.length-1;i>=0;i--){let n=Number(digits[i]);if(alt){n*=2;if(n>9)n-=9;}sum+=n;alt=!alt;}return sum%10===0; }
  function validateCard() {
    if (!document.getElementById('card-holder').value.trim()) return false;
    if (!luhn(document.getElementById('card-number').value)) return false;
    if (!/^\d{2}\/\d{2}$/.test(document.getElementById('card-expiry').value)) return false;
    const [mm,yy]=document.getElementById('card-expiry').value.split('/').map(Number); const now=new Date(); const expiry=new Date(2000+yy,mm,1); if(mm<1||mm>12||expiry<=now)return false;
    return /^\d{3,4}$/.test(document.getElementById('card-cvc').value);
  }
  function validateBilling() { return !!document.getElementById('billing-name').value.trim() && /^\S+@\S+\.\S+$/.test(document.getElementById('billing-email').value.trim()); }

  document.querySelectorAll('input[name="payment-method"]').forEach(r=>r.addEventListener('change',()=>{if(!r.checked)return;methodDetails.hidden=r.value!=='card';transferDetails.hidden=r.value!=='transfer';}));
  [planSelect,periodSelect,taxRate,countrySelect,stateSelect].forEach(el=>el.addEventListener('change',()=>{ if(el===countrySelect){renderStates();renderTaxRate();} else if(el===stateSelect){renderTaxRate();} else renderSummary(); }));
  document.getElementById('card-number').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim();});
  document.getElementById('card-expiry').addEventListener('input',e=>{const v=e.target.value.replace(/\D/g,'').slice(0,4);e.target.value=v.length>2?`${v.slice(0,2)}/${v.slice(2)}`:v;});

  function setPayButton(processing = false) {
    btn.disabled = processing;
    btn.innerHTML = processing
      ? '<span class="button-spinner" aria-hidden="true"></span><span class="btn-processing-label"></span>'
      : `<span>${i18n.t('checkout.pay')}</span>`;
    if (processing) btn.querySelector('.btn-processing-label').textContent = i18n.t('checkout.processing');
  }

  btn.addEventListener('click',()=>{
    try {
      if (!auth.currentUser()) { toast(i18n.t('error.session'),'error'); setTimeout(()=>location.href=`login.html?redirect=checkout.html&plan=${planSelect.value}&period=${periodSelect.value}`,500); return; }
      if (!validateBilling()) { toast(i18n.t('checkout.invalidBilling'),'error'); return; }
      const method=document.querySelector('input[name="payment-method"]:checked')?.value || 'card';
      if(method==='card'&&!validateCard()){toast(i18n.t('checkout.invalidCard'),'error');return;}
      setPayButton(true);
      setTimeout(()=>{
        try {
          auth.activateSubscription(planSelect.value,periodSelect.value,currency);
          store?.transact?.(state => {
            state.meta = { ...(state.meta || {}), subscription: {
              plan: planSelect.value, status: 'active', billingPeriod: periodSelect.value,
              currency, updatedAt: new Date().toISOString()
            }};
          });
          feedback.hidden=false;feedback.className='alert alert-ok';feedback.textContent=i18n.t('checkout.welcome');
          toast(i18n.t('toast.subscription'),'success');
          setTimeout(()=>location.href='dashboard.html?welcome=1',700);
        } catch(err){ toast(err.message,'error'); setPayButton(false); }
      },450);
    } catch(err){ toast(err.message,'error'); setPayButton(false); }
  });
  renderStates();renderTaxRate();renderSummary();
  window.addEventListener('gp:languagechange',()=>{ renderCountryOptions(); i18n.apply(); renderStates(); renderTaxRate(); if(!btn.disabled) setPayButton(false); });
});
