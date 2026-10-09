import { config } from './core/config.js';
import { utils } from './core/utils.js';
import { i18n } from './core/i18n.js';
import { auth } from './auth.js';
import { store } from './core/store.js';
import { toast } from './core/ui.js';
const GP={config,utils,i18n,auth,store,toast};
document.addEventListener('DOMContentLoaded',()=>{
  if(!GP.auth.hasAccess() || !GP.auth.can('configuracion')) return;
  const form=document.getElementById('company-form');
  const s=GP.store.getState().settings;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??'';};
  const currency=document.getElementById('company-currency'); Object.entries(GP.config.CURRENCIES).forEach(([code,cfg])=>{const o=document.createElement('option');o.value=code;o.textContent=`${code} · ${cfg.symbol}`;currency.appendChild(o);});
  const profile=document.getElementById('company-profile'); Object.keys(GP.config.TAX_PROFILES).forEach(key=>{const o=document.createElement('option');o.value=key;o.textContent=GP.i18n.t(`taxprofile.${key.toLowerCase()}`);profile.appendChild(o);});
  const taxState=document.getElementById('company-tax-state'); GP.config.TAX_PROFILES.US.states.forEach(code=>{const o=document.createElement('option');o.value=code;o.textContent=code;taxState.appendChild(o);});
  set('company-name',s.companyName);set('company-tax',s.taxId);set('company-country',s.country||'España');set('company-currency',s.currency||'EUR');set('company-profile',s.taxProfile||'ES');set('company-tax-region',s.taxRegion||'ES');set('company-tax-state',s.taxState||'CA');set('company-tax-rate',s.defaultTaxRate);set('company-address',s.address);set('company-postal',s.postalCode);set('company-city',s.city);set('company-province',s.province);set('company-irpf',s.defaultIrpf);set('company-logo',s.logoUrl);
  const updateStateVisibility=()=>{document.getElementById('company-state-wrap').hidden=document.getElementById('company-profile').value!=='US';}; updateStateVisibility(); profile.addEventListener('change',updateStateVisibility);
  const previousCurrency=s.currency||'EUR'; const previousDefaultTax=Number(s.defaultTaxRate); currency.addEventListener('change',()=>{ const next=currency.value; const oldAutomatic=Math.abs(previousDefaultTax-GP.utils.currencyTaxRate(previousCurrency))<0.0001; if(oldAutomatic){ document.getElementById('company-tax-rate').value=String(GP.utils.currencyTaxRate(next)); } });
  form.addEventListener('submit',e=>{e.preventDefault();const data={companyName:document.getElementById('company-name').value.trim(),taxId:GP.utils.normalizeTaxId(document.getElementById('company-tax').value),country:document.getElementById('company-country').value.trim(),currency:document.getElementById('company-currency').value,taxProfile:document.getElementById('company-profile').value,taxRegion:document.getElementById('company-tax-region').value.trim().toUpperCase(),taxState:document.getElementById('company-tax-state').value,address:document.getElementById('company-address').value.trim(),postalCode:document.getElementById('company-postal').value.trim(),city:document.getElementById('company-city').value.trim(),province:document.getElementById('company-province').value.trim(),defaultTaxRate:Number(document.getElementById('company-tax-rate').value),defaultIrpf:Number(document.getElementById('company-irpf').value)||0,logoUrl:document.getElementById('company-logo').value.trim()};if(!data.companyName)return GP.toast(GP.i18n.t('error.companyRequired'),'error');if(!Number.isFinite(data.defaultTaxRate)||data.defaultTaxRate<0||data.defaultTaxRate>100||!Number.isFinite(data.defaultIrpf)||data.defaultIrpf<0||data.defaultIrpf>100)return GP.toast(GP.i18n.t('error.noNegative'),'error');if(data.taxProfile==='ES'&&(!GP.utils.validateSpanishTaxId(data.taxId,'NIF/NIE')&&!GP.utils.validateSpanishTaxId(data.taxId,'CIF')))return GP.toast(GP.i18n.t('error.taxInvalid'),'error');try{GP.store.saveSettings(data);GP.toast(GP.i18n.t('settings.saved'),'success');}catch(err){GP.toast(err.message,'error');}});
  window.addEventListener('gp:languagechange',()=>{profile.querySelectorAll('option').forEach(o=>o.textContent=GP.i18n.t(`taxprofile.${o.value.toLowerCase()}`));GP.i18n.apply();});

const backupExport = document.getElementById('backup-export');
const backupImport = document.getElementById('backup-import');
backupExport?.addEventListener('click', () => {
  try {
    const payload = {
      app: GP.config.APP_NAME,
      version: 1,
      exportedAt: new Date().toISOString(),
      user: GP.auth.currentUser()?.email || '',
      state: GP.store.getSnapshot()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proyectoventa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 300);
    GP.toast(GP.i18n.t('backup.exported'), 'success');
  } catch (error) { GP.toast(GP.i18n.t('backup.error'), 'error'); }
});
backupImport?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || '{}'));
      const snapshot = payload?.state || payload;
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('invalid');
      if (!Array.isArray(snapshot.clients) || !Array.isArray(snapshot.documents)) throw new Error('invalid');
      if (!Array.isArray(snapshot.inventory)) snapshot.inventory = [];
      if (!Array.isArray(snapshot.contracts)) snapshot.contracts = [];
      if (!Array.isArray(snapshot.expenses)) snapshot.expenses = [];
      GP.store.replaceState(snapshot);
      GP.toast(GP.i18n.t('backup.imported'), 'success');
    } catch (error) { GP.toast(GP.i18n.t('backup.invalid'), 'error'); }
    finally { event.target.value = ''; }
  };
  reader.onerror = () => { GP.toast(GP.i18n.t('backup.error'), 'error'); event.target.value = ''; };
  reader.readAsText(file);
});
});
