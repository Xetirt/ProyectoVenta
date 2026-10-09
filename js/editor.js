import { config } from './core/config.js';
import { utils } from './core/utils.js';
import { i18n } from './core/i18n.js';
import { auth } from './auth.js';
import { store } from './core/store.js';
import { toast, exportPdf, emptyStateMarkup } from './core/ui.js';
import { ejecutarBackend } from './api.js';
import { premium } from './core/premium.js';
const GP={config,utils,i18n,auth,store,toast,premium};
function getEditorEl(id) { return document.getElementById(id); }
function editorValue(id) { return getEditorEl(id)?.value?.trim() || ''; }
function tr(key, vars) { return GP.i18n.t(key, vars); }
function effectiveTaxRate() {
  const selected = editorValue('tax-rate');
  if (selected === 'CUSTOM') return Math.max(0, Math.min(100, Number(editorValue('custom-tax-rate')) || 0));
  return Math.max(0, Math.min(100, Number(selected) || 0));
}
function taxConfig() { return GP.config.TAX_PROFILES[editorValue('tax-profile') || 'ES'] || GP.config.TAX_PROFILES.ES; }

function populateCurrencyOptions() {
  const select=getEditorEl('currency'); const current=select.value; select.innerHTML='';
  Object.entries(GP.config.CURRENCIES).forEach(([code,cfg])=>{const o=document.createElement('option');o.value=code;o.textContent=`${code} · ${cfg.symbol}`;select.appendChild(o);});
  if([...select.options].some(o=>o.value===current))select.value=current;
}

function populateTaxProfiles() {
  const select=getEditorEl('tax-profile'); const current=select.value; select.innerHTML='';
  Object.keys(GP.config.TAX_PROFILES).forEach(key=>{const o=document.createElement('option');o.value=key;o.textContent=tr(`taxprofile.${key.toLowerCase()}`);select.appendChild(o);});
  if([...select.options].some(o=>o.value===current))select.value=current; else select.value='ES';
}

function populateTaxOptions(forceCurrencyDefault = false) {
  const profile=taxConfig(); const taxSelect=getEditorEl('tax-rate'); const current=taxSelect.value; taxSelect.innerHTML='';
  profile.options.forEach(opt=>{const option=document.createElement('option');option.value=opt.rate===null?'CUSTOM':String(opt.rate);option.textContent=opt.labelKey?tr(opt.labelKey):opt.label;taxSelect.appendChild(option);});
  const settings=GP.store.getState().settings;
  const currencyDefault=GP.utils.currencyTaxRate(editorValue('currency') || settings.currency || 'EUR');
  const defaultRate=forceCurrencyDefault ? currencyDefault : Number(settings.defaultTaxRate ?? currencyDefault);
  const exact=[...taxSelect.options].find(o=>o.value===String(defaultRate));
  if(exact) taxSelect.value=exact.value;
  else if([...taxSelect.options].some(o=>o.value==='CUSTOM')) taxSelect.value='CUSTOM';
  const custom=taxSelect.value==='CUSTOM'; getEditorEl('custom-tax-wrap').hidden=!custom;
  if(custom) getEditorEl('custom-tax-rate').value=String(defaultRate);
  updateRecargoOptions(); updateIrpfOptions(); updateTaxRegionOptions();
}

function updateFxVisibility() { const wrap=getEditorEl('fx-rate-wrap'); const base=GP.store.getState().settings.currency||'EUR'; const currency=editorValue('currency')||base; if(!wrap)return; wrap.hidden=currency===base; if(currency===base)getEditorEl('fx-rate').value='1'; }

function updateTaxRegionOptions() {
  const profile=editorValue('tax-profile'); const region=getEditorEl('tax-region'); const stateWrap=getEditorEl('tax-state-wrap'); const state=getEditorEl('tax-state');
  const config=taxConfig(); const isUS=profile==='US';
  region.value=config.country || profile;
  stateWrap.hidden=!isUS;
  if(isUS){ const current=state.value; state.innerHTML=config.states.map(code=>`<option value="${code}">${code}</option>`).join(''); if([...state.options].some(o=>o.value===current))state.value=current; }
}

function updateIrpfOptions() {
  const select=getEditorEl('irpf-rate'); const profile=taxConfig(); const current=select.value; const options=profile.irpfOptions || [0];
  select.innerHTML=options.map(r=>`<option value="${r}">${r===0?tr('billing.withoutRetention'):`${r}%`}</option>`).join('');
  if([...select.options].some(o=>o.value===current))select.value=current; else select.value=String(GP.store.getState().settings.defaultIrpf||0);
}

function updateRecargoOptions() {
  const select=getEditorEl('re-rate'); const rate=effectiveTaxRate(); const profile=editorValue('tax-profile'); const allowed=profile==='ES' ? (GP.config.TAX_PROFILES.ES.recargo[rate] ?? 0) : 0;
  select.innerHTML=`<option value="0">${tr('billing.re')} (0%)</option>`;
  if(allowed>0){const o=document.createElement('option');o.value=String(allowed);o.textContent=`${tr('billing.re')} ${allowed}%`;select.appendChild(o);}
  select.disabled=allowed<=0; select.value=allowed>0?String(allowed):'0'; updatePreview();
}

function renderProductSelect(select) {
  const state=GP.store.getState(); const current=select.value; select.innerHTML=`<option value="">${tr('billing.serviceManual')}</option>`;
  state.inventory.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=`${p.sku} · ${p.name} (${tr('billing.stock')||'stock'} ${p.stock})`;select.appendChild(o);});
  if([...select.options].some(o=>o.value===current))select.value=current;
}

function checkDraftStock() {
  const node=getEditorEl('draft-stock-warning'); if(!node)return;
  try {
    const issues=GP.store.checkStock(readLines(), GP.store.getState().inventory);
    node.hidden=!issues.length;
    node.textContent=issues.length ? `${tr('error.stock')}: ${issues.map(i=>`${i.name} (${i.available} → ${i.requested})`).join(' · ')}` : '';
    document.querySelectorAll('#concepts-list .concept-item').forEach(row=>row.classList.remove('stock-warning-row'));
    if(issues.length){ const ids=new Set(issues.map(i=>i.id)); document.querySelectorAll('#concepts-list .concept-item').forEach(row=>{const pid=row.querySelector('.c-product')?.value;if(ids.has(pid))row.classList.add('stock-warning-row');}); }
  } catch { node.hidden=true; }
}

function addConceptRow(values={}) {
  const container=getEditorEl('concepts-list'); if(!container)return;
  const row=document.createElement('div'); row.className='concept-item';
  row.innerHTML=`<input class="form-control c-desc" type="text" data-i18n-placeholder="billing.description" value="${GP.utils.escapeHtml(values.description||'')}"><select class="form-control c-product" aria-label="${tr('billing.product')}"></select><input class="form-control c-qty" type="number" min="1" step="1" value="${Math.max(1, Math.round(Number(values.quantity ?? 1) || 1))}"><input class="form-control c-price" type="number" min="0" step="0.01" value="${Number(values.unitPrice ?? 0)}"><input class="form-control c-total" type="text" value="0" readonly><button class="icon-btn c-remove" type="button" aria-label="${tr('billing.removeLine')}">×</button>`;
  container.appendChild(row); GP.i18n.apply(row); const product=row.querySelector('.c-product'); renderProductSelect(product);
  if(values.productId)product.value=String(values.productId); else if(values.sku){const found=[...product.options].find(o=>o.textContent.startsWith(values.sku));if(found)product.value=found.value;}
  product.addEventListener('change',()=>{const p=GP.store.getState().inventory.find(x=>x.id===product.value);if(p){row.querySelector('.c-desc').value=p.name;row.querySelector('.c-price').value=p.unitPrice;}checkDraftStock();updatePreview();});
  row.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>{checkDraftStock();updatePreview();}));
  row.querySelector('.c-remove').addEventListener('click',()=>{if(container.children.length>1){row.remove();checkDraftStock();updatePreview();}else GP.toast(tr('billing.documentNeeded'),'info');});
  updatePreview();
}

function readLines() {
  const rate=effectiveTaxRate();
  return [...document.querySelectorAll('#concepts-list .concept-item')].map(row=>({
    productId:row.querySelector('.c-product')?.value||'',
    sku:(()=>{const p=row.querySelector('.c-product');const opt=p?.selectedOptions?.[0];return opt&&p.value?String(opt.textContent).split(' · ')[0]:'';})(),
    description:row.querySelector('.c-desc')?.value.trim()||'',
    quantity:Math.max(1, Math.round(Number(row.querySelector('.c-qty')?.value) || 1)),
    unitPrice:Number(row.querySelector('.c-price')?.value),
    taxRate:rate
  }));
}
function calculateTotals(lines=readLines()){return GP.store.buildTotals(lines,effectiveTaxRate(),Number(editorValue('re-rate'))||0,Number(editorValue('irpf-rate'))||0);}

function updatePreview() {
  const state=GP.store.getState(); if(!state)return; const settings=state.settings; const currency=editorValue('currency')||settings.currency||'EUR'; const type=editorValue('doc-kind')||'PRESUPUESTO'; const lines=readLines(); const totals=calculateTotals(lines); const internalCost=Math.max(0,Number(editorValue('internal-cost'))||0); const profit=GP.utils.roundMoney(totals.base-internalCost); const margin=totals.base>0?GP.utils.roundMoney(profit/totals.base*100):0; const format=v=>GP.utils.formatMoney(v,currency); const marginBox=getEditorEl('internal-margin'); if(marginBox){marginBox.hidden=false; marginBox.replaceChildren(); const wrap=document.createElement('div'); const title=document.createElement('strong'); title.textContent=tr('margin.title'); const value=document.createElement('span'); value.textContent=`${format(profit)} · ${margin}%`; wrap.append(title,value); const wrap2=document.createElement('div'); const profitTitle=document.createElement('strong'); profitTitle.textContent=tr('margin.profit'); const profitValue=document.createElement('span'); profitValue.textContent=format(profit); wrap2.append(profitTitle,profitValue); marginBox.append(wrap,wrap2); }
  getEditorEl('preview-title').textContent=type==='FACTURA'?tr('billing.invoice').toUpperCase():tr('billing.quote').toUpperCase();
  getEditorEl('preview-number').textContent=`Nº: ${editorValue('doc-number')||GP.store.getNextDocumentNumber(type==='PRESUPUESTO'?'PRESUPUESTO':'FACTURA')}`;
  getEditorEl('preview-date').textContent=editorValue('issue-date')||'—'; getEditorEl('preview-due').textContent=editorValue('due-date')?`${tr('billing.dueDate')}: ${editorValue('due-date')}`:'';
  getEditorEl('preview-company').textContent=settings.companyName||'—'; getEditorEl('preview-company-tax').textContent=settings.taxId||'—'; getEditorEl('preview-client').textContent=editorValue('client-name')||'—'; getEditorEl('preview-client-tax').textContent=editorValue('client-tax')||'—'; getEditorEl('preview-notes').textContent=editorValue('payment-notes')||tr('billing.notes');
  const logo=getEditorEl('preview-logo'); const logoUrl=editorValue('logo-url')||settings.logoUrl; if(logoUrl){logo.src=logoUrl;logo.hidden=false;}else{logo.hidden=true;logo.removeAttribute('src');}
  const body=getEditorEl('preview-lines'); body.innerHTML=''; lines.forEach(line=>{const trEl=document.createElement('tr'); trEl.classList.remove('table-dark'); trEl.removeAttribute('style'); trEl.innerHTML=`<td>${GP.utils.escapeHtml(line.description||tr('billing.concept'))}</td><td style="text-align:center">${Math.max(1,Math.round(Number(line.quantity)||1))}</td><td style="text-align:right">${GP.utils.escapeHtml(format(Number(line.unitPrice)||0))}</td><td style="text-align:right">${GP.utils.escapeHtml(format((Math.max(1,Math.round(Number(line.quantity)||1)))*(Number(line.unitPrice)||0)))}</td>`;body.appendChild(trEl);});
  getEditorEl('preview-base').textContent=format(totals.base); getEditorEl('preview-tax-label').textContent=`${taxConfig().taxName} (${effectiveTaxRate()}%)`; getEditorEl('preview-iva').textContent=`+${format(totals.iva)}`;
  const reRow=getEditorEl('preview-re-row'); reRow.hidden=totals.re<=0; getEditorEl('preview-re-label').textContent=`${tr('billing.re')} (${editorValue('re-rate')||0}%)`; getEditorEl('preview-re').textContent=`+${format(totals.re)}`;
  const irpfRow=getEditorEl('preview-irpf-row'); irpfRow.hidden=totals.irpf<=0; getEditorEl('preview-irpf-label').textContent=`${tr('billing.irpf')} (${editorValue('irpf-rate')||0}%)`; getEditorEl('preview-irpf').textContent=`−${format(totals.irpf)}`;
  getEditorEl('preview-total').textContent=format(totals.total); getEditorEl('preview-total-badge').textContent=format(totals.total); document.querySelectorAll('#concepts-list .concept-item').forEach((row,i)=>row.querySelector('.c-total').value=format((lines[i].quantity||0)*(lines[i].unitPrice||0)));
}

function setClientOptions(){const select=getEditorEl('client-select');const state=GP.store.getState();const current=select.value;select.innerHTML=`<option value="">${tr('billing.select')}</option>`;state.clients.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=`${c.name} · ${c.taxId}`;select.appendChild(o);});if([...select.options].some(o=>o.value===current))select.value=current;const empty=getEditorEl('client-empty-state');if(empty){empty.replaceChildren();empty.hidden=state.clients.length>0;if(!empty.hidden)empty.appendChild(emptyStateMarkup({title:tr('empty.clientsTitle'),description:tr('empty.clientsText'),href:'#client-name',action:tr('empty.addClient')}));}}
function loadClient(id){const c=GP.store.getState().clients.find(x=>x.id===id);if(!c)return;getEditorEl('client-name').value=c.name||'';getEditorEl('client-tax').value=c.taxId||'';getEditorEl('client-email').value=c.email||'';getEditorEl('client-address').value=c.address||'';updatePreview();}
function setDocumentStatusOptions(){const op=editorValue('doc-operation');const kind=editorValue('doc-kind');const select=getEditorEl('doc-status');const current=select.value;const opts=kind==='PRESUPUESTO'?[['BORRADOR','status.draft'],['ENVIADO','status.issued'],['FACTURADO','status.invoiced']]:op==='EMITIDA'?[['BORRADOR','status.draft'],['EMITIDA','status.issued'],['COBRADA','status.paid']]:[['BORRADOR','status.draft'],['RECIBIDA','status.received'],['PAGADA','status.payed']];select.innerHTML=opts.map(([v,k])=>`<option value="${v}">${tr(k)}</option>`).join('');if(opts.some(x=>x[0]===current))select.value=current;else select.value=opts[0][0];}

function validatePartyTax(value, profile){const tax=GP.utils.normalizeTaxId(value);if(profile==='ES')return GP.utils.validateSpanishTaxId(tax,'NIF/NIE')||GP.utils.validateSpanishTaxId(tax,'CIF');return /^[A-Z0-9][A-Z0-9\-\.]{4,19}$/i.test(tax);}
function validateDocument(lines, totals){const profile=editorValue('tax-profile');const operation=editorValue('doc-operation');if(!editorValue('doc-number'))throw new Error(tr('error.docNumber'));if(!editorValue('issue-date'))throw new Error(tr('error.issueDate'));if(!editorValue('client-name'))throw new Error(tr('error.party'));if(!editorValue('client-tax'))throw new Error(tr('error.partyTax'));if(!validatePartyTax(editorValue('client-tax'),profile))throw new Error(tr('error.taxInvalid'));if(!lines.length||lines.some(l=>!l.description||!Number.isFinite(l.quantity)||!Number.isInteger(l.quantity)||l.quantity<=0||!Number.isFinite(l.unitPrice)||l.unitPrice<0))throw new Error(tr('error.lines'));if(totals.total<0)throw new Error(tr('error.totalNegative'));if(getEditorEl('doc-status').value!=='BORRADOR'&&getEditorEl('doc-kind').value==='FACTURA'&&!getEditorEl('terms').checked)throw new Error(tr('error.acceptTerms'));if(operation==='RECIBIDA'&&!['BORRADOR','RECIBIDA','PAGADA'].includes(getEditorEl('doc-status').value))throw new Error(tr('error.receivedStatus'));}
function collectDocument(){const kind=editorValue('doc-kind');const operation=editorValue('doc-operation');const lines=readLines();const totals=calculateTotals(lines);const state=GP.store.getState();validateDocument(lines,totals);return{id:getEditorEl('document-form').dataset.editId||undefined,type:kind,operation,status:getEditorEl('doc-status').value,number:editorValue('doc-number'),issueDate:editorValue('issue-date'),dueDate:editorValue('due-date'),currency:editorValue('currency'),taxProfile:editorValue('tax-profile'),taxRegion:editorValue('tax-region'),taxState:editorValue('tax-state'),fxRateToBase:Math.max(0,Number(editorValue('fx-rate'))||1),client:{name:editorValue('client-name'),taxId:GP.utils.normalizeTaxId(editorValue('client-tax')),email:editorValue('client-email'),address:editorValue('client-address')},lines,taxRate:effectiveTaxRate(),reRate:Number(editorValue('re-rate'))||0,irpfRate:Number(editorValue('irpf-rate'))||0,totals,notes:editorValue('payment-notes'),logoUrl:editorValue('logo-url'),internalCost:GP.premium.isPro()?Math.max(0,Number(editorValue('internal-cost'))||0):0,stockApplied:false,company:{...state.settings}};}

function resetEditor(){const form=getEditorEl('document-form');form.reset();delete form.dataset.editId;const settings=GP.store.getState().settings;populateCurrencyOptions();populateTaxProfiles();getEditorEl('currency').value=settings.currency||'EUR';getEditorEl('fx-rate').value='1';updateFxVisibility();getEditorEl('tax-profile').value=settings.taxProfile||'ES';getEditorEl('tax-region').value=settings.taxRegion||settings.country||'ES';getEditorEl('custom-tax-rate').value=String(settings.defaultTaxRate||0);getEditorEl('logo-url').value=settings.logoUrl||'';getEditorEl('internal-cost').value='0';populateTaxOptions();const today=new Date().toISOString().slice(0,10);getEditorEl('issue-date').value=today;const due=new Date();due.setDate(due.getDate()+30);getEditorEl('due-date').value=due.toISOString().slice(0,10);getEditorEl('doc-kind').value='PRESUPUESTO';getEditorEl('doc-operation').value='EMITIDA';getEditorEl('doc-number').value=GP.store.getNextDocumentNumber('PRESUPUESTO');getEditorEl('terms').checked=false;setDocumentStatusOptions();getEditorEl('concepts-list').innerHTML='';addConceptRow();getEditorEl('editor-title').textContent=tr('billing.new');getEditorEl('editor-status').textContent=tr('status.draft');setClientOptions();checkDraftStock();updatePreview();}

function editDocument(id){const d=GP.store.getState().documents.find(x=>x.id===id);if(!d)return;const f=getEditorEl('document-form');f.dataset.editId=d.id;getEditorEl('doc-kind').value=d.type;getEditorEl('doc-operation').value=d.operation||'EMITIDA';getEditorEl('doc-number').value=d.number||'';getEditorEl('issue-date').value=d.issueDate||'';getEditorEl('due-date').value=d.dueDate||'';populateCurrencyOptions();getEditorEl('currency').value=d.currency||'EUR';getEditorEl('fx-rate').value=String(d.fxRateToBase||1);updateFxVisibility();populateTaxProfiles();getEditorEl('tax-profile').value=d.taxProfile||'ES';populateTaxOptions();getEditorEl('tax-region').value=d.taxRegion||getEditorEl('tax-profile').value;getEditorEl('tax-state').value=d.taxState||'';getEditorEl('client-name').value=d.client?.name||'';getEditorEl('client-tax').value=d.client?.taxId||'';getEditorEl('client-email').value=d.client?.email||'';getEditorEl('client-address').value=d.client?.address||'';getEditorEl('logo-url').value=d.logoUrl||'';getEditorEl('internal-cost').value=String(d.internalCost||0);getEditorEl('payment-notes').value=d.notes||'';getEditorEl('irpf-rate').value=String(d.irpfRate||0);getEditorEl('custom-tax-rate').value=String(d.taxRate||0);if([...getEditorEl('tax-rate').options].some(o=>o.value===String(d.taxRate)))getEditorEl('tax-rate').value=String(d.taxRate);else getEditorEl('tax-rate').value='CUSTOM';getEditorEl('custom-tax-wrap').hidden=getEditorEl('tax-rate').value!=='CUSTOM';updateTaxRegionOptions();setDocumentStatusOptions();getEditorEl('doc-status').value=d.status||'BORRADOR';updateRecargoOptions();getEditorEl('concepts-list').innerHTML='';(d.lines||[]).forEach(addConceptRow);if(!(d.lines||[]).length)addConceptRow();getEditorEl('terms').checked=true;getEditorEl('editor-title').textContent=tr('billing.edit');getEditorEl('editor-status').textContent=tr({BORRADOR:'status.draft',EMITIDA:'status.issued',COBRADA:'status.paid',RECIBIDA:'status.received',PAGADA:'status.payed',FACTURADO:'status.invoiced',ENVIADO:'status.issued',CANCELADA:'status.canceled'}[d.status]||'status.draft');checkDraftStock();updatePreview();window.scrollTo({top:0,behavior:'smooth'});}

  function renderHistory(){const body=getEditorEl('history-body');const filter=getEditorEl('history-filter').value;const state=GP.store.getState();body.innerHTML='';const docs=state.documents.filter(d=>filter==='ALL'||d.type===filter);if(!docs.length){const row=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=7;cell.className='empty-state-cell';cell.appendChild(emptyStateMarkup({title:tr('empty.documentsTitle'),description:tr('empty.documentsText'),href:'presupuestos.html',action:tr('empty.createQuote')}));row.appendChild(cell);body.appendChild(row);return;}docs.forEach(d=>{const cls=['EMITIDA','COBRADA','RECIBIDA','PAGADA','FACTURADO'].includes(d.status)?'badge-success':d.status==='BORRADOR'?'badge-neutral':'badge-warning';const statusKey={BORRADOR:'status.draft',EMITIDA:'status.issued',COBRADA:'status.paid',RECIBIDA:'status.received',PAGADA:'status.payed',FACTURADO:'status.invoiced',ENVIADO:'status.issued',CANCELADA:'status.canceled'}[d.status];const actions=d.type==='PRESUPUESTO'&&d.status!=='FACTURADO'?`<button class="btn-ghost btn-small js-convert" data-id="${GP.utils.escapeHtml(d.id)}">${tr('billing.convert')}</button>`:'';const trEl=document.createElement('tr');trEl.innerHTML=`<td>${GP.utils.escapeHtml(d.issueDate||'')}</td><td><strong>${GP.utils.escapeHtml(d.number||'')}</strong></td><td>${d.type==='FACTURA'?tr('billing.invoice'):tr('billing.quote')}</td><td>${GP.utils.escapeHtml(d.client?.name||'')}</td><td><span class="badge ${cls}">${GP.utils.escapeHtml(tr(statusKey)||d.status||'')}</span></td><td>${GP.utils.escapeHtml(GP.utils.formatMoney(d.totals?.total||0,d.currency||'EUR'))}</td><td><div class="btn-row"><button class="btn-ghost btn-small js-edit" data-id="${GP.utils.escapeHtml(d.id)}">${tr('billing.edit')}</button>${actions}</div></td>`;body.appendChild(trEl); const labels=[tr('billing.issueDate'),tr('billing.number'),tr('billing.document'),tr('billing.name'),tr('billing.statusSave'),tr('billing.total'),tr('billing.actions')];trEl.querySelectorAll(':scope > td').forEach((td,i)=>td.dataset.label=labels[i]||'');});}

document.addEventListener('DOMContentLoaded',()=>{
  if(!GP.auth.hasAccess())return;
  const form=getEditorEl('document-form');
  const syncPremiumFields=()=>{
    const pro=GP.premium.isPro();
    const cost=getEditorEl('internal-cost');
    if(cost){ cost.disabled=!pro; cost.title=pro?'':tr('premium.profitMarginTitle'); if(!pro) cost.value='0'; }
    document.querySelectorAll('[data-premium-feature]').forEach(el=>el.classList.toggle('premium-locked',!pro));
  };
  resetEditor(); syncPremiumFields(); populateCurrencyOptions(); populateTaxProfiles();
  ['doc-kind','doc-operation'].forEach(id=>getEditorEl(id).addEventListener('change',()=>{if(id==='doc-kind')getEditorEl('doc-number').value=GP.store.getNextDocumentNumber(getEditorEl('doc-kind').value==='PRESUPUESTO'?'PRESUPUESTO':'FACTURA');setDocumentStatusOptions();updatePreview();}));
  getEditorEl('tax-profile').addEventListener('change',()=>{populateTaxOptions();updatePreview();});
  getEditorEl('tax-rate').addEventListener('change',()=>{getEditorEl('custom-tax-wrap').hidden=getEditorEl('tax-rate').value!=='CUSTOM';updateRecargoOptions();updatePreview();});
  getEditorEl('custom-tax-rate').addEventListener('input',()=>{updateRecargoOptions();checkDraftStock();updatePreview();});
  getEditorEl('tax-state').addEventListener('change',updatePreview);getEditorEl('tax-region').addEventListener('input',updatePreview);getEditorEl('fx-rate').addEventListener('input',updatePreview);
  ['currency','irpf-rate','doc-status','client-name','client-tax','client-email','client-address','logo-url','issue-date','due-date','payment-notes','fx-rate','internal-cost'].forEach(id=>getEditorEl(id).addEventListener('input',()=>{if(id==='currency'){updateFxVisibility();populateTaxOptions(true);}checkDraftStock();updatePreview();}));
  getEditorEl('currency').addEventListener('change',()=>{updateFxVisibility();populateTaxOptions(true);checkDraftStock();updatePreview();});
  getEditorEl('add-line').addEventListener('click',()=>addConceptRow());
  getEditorEl('export-pdf').addEventListener('click',async()=>{if(!GP.premium.require('advancedReports'))return;try{updatePreview();const number=editorValue('doc-number')||'001';const langCode=(GP.i18n.current()||'es').toLowerCase();const names={es:{quote:'Presupuesto',invoice:'Factura'},en:{quote:'Quote',invoice:'Invoice'},ca:{quote:'Pressupost',invoice:'Factura'},fr:{quote:'Devis',invoice:'Facture'}};const kind=names[langCode]?(editorValue('doc-kind')==='FACTURA'?names[langCode].invoice:names[langCode].quote):(editorValue('doc-kind')==='FACTURA'?'Invoice':'Quote');const lang=langCode.toUpperCase();const year=(editorValue('issue-date')||new Date().toISOString().slice(0,10)).slice(0,4);await exportPdf(getEditorEl('paper-preview'),`${kind}_${lang}_${year}_${number}`);GP.toast(tr('toast.pdf'),'success');}catch(err){GP.toast(err.message,'error');}});
  getEditorEl('share-quote').addEventListener('click',async()=>{if(!GP.premium.require('quotePortal'))return;try{if(editorValue('doc-kind')!=='PRESUPUESTO')throw new Error(tr('portal.title'));const form=getEditorEl('document-form');const shared=GP.store.saveDocument(collectDocument());const link=GP.store.publishQuote(shared.id);try{await navigator.clipboard.writeText(new URL(link.url,location.href).href);}catch(_){}GP.toast(tr('toast.portal'),'success');window.open(link.url,'_blank','noopener,noreferrer');}catch(err){GP.toast(err.message,'error');}});getEditorEl('client-select').addEventListener('change',e=>loadClient(e.target.value));getEditorEl('history-filter').addEventListener('change',renderHistory);getEditorEl('reset-document').addEventListener('click',resetEditor);getEditorEl('print-document').addEventListener('click',()=>window.print());
  form.addEventListener('submit',async e=>{e.preventDefault();const button=getEditorEl('save-document');button.disabled=true;try{const isNewQuote=!form.dataset.editId&&editorValue('doc-kind')==='PRESUPUESTO';if(isNewQuote&&!GP.premium.enforceQuoteLimit()){GP.toast(tr('premium.quoteLimit',{limit:GP.config.FREE_QUOTE_LIMIT}),'error');return;}const doc=collectDocument();const saved=GP.store.saveDocument(doc);try{GP.store.saveClient(saved.client);}catch(_){}try{await ejecutarBackend(saved.type==='FACTURA'?'crearFactura':'crearPresupuestoCompleto',{documento:saved});}catch(apiErr){}GP.toast(tr('toast.saved'),'success');renderHistory();resetEditor();}catch(err){GP.toast(err.message,'error');}finally{button.disabled=false;}});
  getEditorEl('history-body').addEventListener('click',e=>{const edit=e.target.closest('.js-edit');const convert=e.target.closest('.js-convert');if(edit)editDocument(edit.dataset.id);if(convert){try{const invoice=GP.store.convertQuoteToInvoice(convert.dataset.id);GP.toast(`${tr('billing.convert')}: ${invoice.number}`,'success');renderHistory();resetEditor();}catch(err){GP.toast(err.message,'error');}}});
  renderHistory();GP.store.subscribe(()=>{syncPremiumFields();setClientOptions();document.querySelectorAll('.c-product').forEach(renderProductSelect);renderHistory();checkDraftStock();updatePreview();});window.addEventListener('gp:languagechange',()=>{populateCurrencyOptions();populateTaxProfiles();setDocumentStatusOptions();populateTaxOptions();updateFxVisibility();GP.i18n.apply();syncPremiumFields();renderHistory();checkDraftStock();updatePreview();});
  window.addEventListener('gp:themechange',syncPremiumFields);
});
