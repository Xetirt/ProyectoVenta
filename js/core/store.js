import { config } from './config.js';
import { storage } from './storage.js';
import { utils } from './utils.js';
import { i18n } from './i18n.js';
import { auth } from '../auth.js';

const GP = { config, storage, utils, i18n, auth };

export const store = (() => {
  let state = null;
  let userId = null;
  const subscribers = new Set();

  function emptyState() {
    return {
      settings: {
        companyName: '', taxId: '', address: '', postalCode: '', city: '', province: '', country: 'España',
        currency: 'EUR', taxProfile: 'ES', taxRegion: 'ES', taxState: '', defaultTaxRate: 21, defaultIrpf: 0, logoUrl: ''
      },
      meta: { demoSeeded: false },
      clients: [],
      inventory: [],
      documents: [],
      contracts: [],
      expenses: []
    };
  }

  function seedDemoState(base) {
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date(); future.setDate(future.getDate() + 15);
    base.meta = { ...(base.meta || {}), demoSeeded: true, seededAt: new Date().toISOString() };
    base.inventory = [
      { id: 'demo_prod_1', sku: 'DEMO-001', name: 'Consultoría estratégica', unitPrice: 480, stock: 7, minStock: 2, taxRate: 21, createdAt: new Date().toISOString() },
      { id: 'demo_prod_2', sku: 'DEMO-002', name: 'Licencia SaaS', unitPrice: 79, stock: 20, minStock: 5, taxRate: 21, createdAt: new Date().toISOString() },
      { id: 'demo_prod_3', sku: 'DEMO-003', name: 'Pack soporte', unitPrice: 120, stock: 3, minStock: 4, taxRate: 21, createdAt: new Date().toISOString() }
    ];
    base.clients = [{ id:'demo_client_1', name:'Cliente Demo S.L.', taxId:'B12345674', email:'cliente@example.com', address:'Calle Demo 1', updatedAt:new Date().toISOString() }];
    base.documents = [
      { id:'demo_doc_1', type:'FACTURA', operation:'EMITIDA', status:'COBRADA', issueDate:today, dueDate:future.toISOString().slice(0,10), number:'F26-0001', currency:'EUR', taxProfile:'ES', taxRegion:'ES', taxRate:21, reRate:0, irpfRate:0, client:base.clients[0], lines:[{productId:'demo_prod_1',sku:'DEMO-001',description:'Consultoría estratégica',quantity:1,unitPrice:480,taxRate:21}], totals:{base:480,iva:100.8,re:0,irpf:0,total:580.8}, stockApplied:true, createdAt:new Date().toISOString() },
      { id:'demo_doc_2', type:'FACTURA', operation:'EMITIDA', status:'EMITIDA', issueDate:today, dueDate:future.toISOString().slice(0,10), number:'F26-0002', currency:'EUR', taxProfile:'ES', taxRegion:'ES', taxRate:21, reRate:0, irpfRate:0, client:base.clients[0], lines:[{productId:'demo_prod_2',sku:'DEMO-002',description:'Licencia SaaS',quantity:2,unitPrice:79,taxRate:21}], totals:{base:158,iva:33.18,re:0,irpf:0,total:191.18}, stockApplied:true, createdAt:new Date().toISOString() },
      { id:'demo_doc_3', type:'PRESUPUESTO', operation:'EMITIDA', status:'BORRADOR', issueDate:today, dueDate:future.toISOString().slice(0,10), number:'P26-0001', currency:'EUR', taxProfile:'ES', taxRegion:'ES', taxRate:21, reRate:0, irpfRate:0, client:base.clients[0], lines:[{productId:'demo_prod_3',sku:'DEMO-003',description:'Pack soporte',quantity:1,unitPrice:120,taxRate:21}], totals:{base:120,iva:25.2,re:0,irpf:0,total:145.2}, stockApplied:false, createdAt:new Date().toISOString() }
    ];
    return base;
  }

  function ensureDemoData(uid) {
    const current = GP.storage.getScoped(uid, 'state', null);
    if (current?.meta?.demoSeeded) return current;
    const stateToSeed = current || emptyState();
    const isEmpty = !stateToSeed.documents?.length && !stateToSeed.inventory?.length && !stateToSeed.clients?.length;
    if (!isEmpty) return stateToSeed;
    const seeded = seedDemoState(stateToSeed);
    GP.storage.setScoped(uid, 'state', seeded);
    if (userId === uid) state = seeded;
    return seeded;
  }

  function migrateLegacy(uid) {
    const base = emptyState();
    const legacyStock = GP.storage.get('app_stock', null) || [];
    const legacyInvoices = GP.storage.get('app_facturas', null) || [];
    if (legacyStock.length) {
      base.inventory = legacyStock.map((p, i) => ({
        id: String(p.id ?? GP.utils.uid('prod')),
        sku: p.SKU || p.sku || `PRD-${String(i + 1).padStart(3, '0')}`,
        name: p.nombre || p.name || 'Producto',
        unitPrice: Number(p.precio) || 0,
        stock: Math.max(0, Number(p.cantidad) || 0),
        minStock: Math.max(0, Number(p.minimo) || 0),
        taxRate: Number(p.iva ?? 21) || 0,
        createdAt: new Date().toISOString()
      }));
    }
    if (legacyInvoices.length) {
      base.documents = legacyInvoices.map((f, i) => ({
        id: f.id || `FAC-${String(i + 1).padStart(4, '0')}`,
        type: 'FACTURA',
        operation: f.tipo || 'EMITIDA',
        status: 'EMITIDA',
        issueDate: f.fecha || new Date().toISOString().slice(0, 10),
        number: f.id || `F26-${String(i + 1).padStart(4, '0')}`,
        currency: 'EUR',
        client: { name: f.cliente || '', taxId: '', email: '' },
        lines: (f.items || []).map(item => ({
          productId: item.id ? String(item.id) : '', description: item.descripcion || item.nombre || 'Producto',
          quantity: Number(item.cantidad) || 0, unitPrice: Number(item.precio) || 0,
          taxRate: Number(item.iva ?? 21) || 0
        })),
        totals: { base: Number(f.subtotal) || 0, iva: Number(f.totalIVA) || 0, re: 0, irpf: 0, total: Number(f.total) || 0 },
        stockApplied: true,
        createdAt: new Date().toISOString()
      }));
    }
    GP.storage.setScoped(uid, 'state', base);
    return base;
  }

  function ensureLoaded() {
    const user = GP.auth?.currentUser?.();
    const uid = user?.id;
    if (!uid) return null;
    if (state && userId === uid) return state;
    userId = uid;
    state = GP.storage.getScoped(uid, 'state', null) || migrateLegacy(uid);
    // Garantiza compatibilidad si una versión anterior dejó estructuras incompletas.
    state = { ...emptyState(), ...state, meta: { ...emptyState().meta, ...(state.meta || {}) }, settings: { ...emptyState().settings, ...(state.settings || {}) } };
    if (!state.settings.companyName) state.settings.companyName = user.empresa || '';
    if (!state.settings.taxId) state.settings.taxId = user.nif || '';
    if (!state.meta.demoSeeded && !state.documents.length && !state.inventory.length && !state.clients.length && !state.expenses.length) {
      state = seedDemoState(state);
      GP.storage.setScoped(uid, 'state', state);
    }
    return state;
  }

  function notify() {
    const snapshot = typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    subscribers.forEach(fn => { try { fn(snapshot); } catch (err) { console.error(err); } });
    window.dispatchEvent(new CustomEvent('gp:statechange', { detail: snapshot }));
    window.dispatchEvent(new CustomEvent('gp-state-change', { detail: snapshot }));
  }

  function persist() {
    ensureLoaded();
    if (!userId || !state) throw new Error('Sesión no iniciada.');
    GP.storage.setScoped(userId, 'state', state);
    notify();
    return state;
  }

  function getState() { return ensureLoaded(); }
  function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }

  function transact(mutator) {
    ensureLoaded();
    const next = typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const result = mutator(next);
    state = next;
    persist();
    return result;
  }

  function getNextDocumentNumber(type) {
    const prefix = type === 'PRESUPUESTO' ? 'P26' : 'F26';
    const nums = state.documents.filter(d => String(d.number || '').startsWith(`${prefix}-`)).map(d => Number(String(d.number || '').split('-')[1]) || 0).filter(Boolean);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  function findProduct(inventory, line) {
    if (line.productId) return inventory.find(p => p.id === String(line.productId));
    if (line.sku) return inventory.find(p => p.sku.toUpperCase() === String(line.sku).toUpperCase());
    return null;
  }

  function checkStock(lines, inventory) {
    const required = new Map();
    lines.forEach(line => {
      const product = findProduct(inventory, line);
      if (!product) return;
      const qty = Number(line.quantity) || 0;
      required.set(product.id, (required.get(product.id) || 0) + qty);
    });
    const issues = [];
    required.forEach((qty, id) => {
      const product = inventory.find(p => p.id === id);
      if (product && qty > product.stock) issues.push({ id, sku: product.sku, name: product.name, available: product.stock, requested: qty });
    });
    return issues;
  }

  function applyStock(lines, inventory) {
    const issues = checkStock(lines, inventory);
    if (issues.length) {
      const details = issues.map(i => `${i.name} (${i.available} / ${i.requested})`).join(', '); const err = new Error(`${GP.i18n.t('error.stock')} ${GP.i18n.t('error.stockDetails', { details })}`);
      err.code = 'STOCK_INSUFFICIENT'; err.issues = issues;
      throw err;
    }
    lines.forEach(line => {
      const product = findProduct(inventory, line);
      if (product) product.stock = GP.utils.roundMoney(product.stock - Number(line.quantity));
    });
  }

  function restoreStock(lines, inventory) {
    (lines || []).forEach(line => {
      const product = findProduct(inventory, line);
      if (product) product.stock = GP.utils.roundMoney(product.stock + (Number(line.quantity) || 0));
    });
  }

  function buildTotals(lines, taxRate, reRate, irpfRate) {
    const base = GP.utils.roundMoney(lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0));
    const iva = GP.utils.roundMoney(lines.reduce((sum, l) => {
      const lineBase = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      const rate = Number.isFinite(Number(l.taxRate)) ? Number(l.taxRate) : Number(taxRate || 0);
      return sum + lineBase * rate / 100;
    }, 0));
    const re = GP.utils.roundMoney(base * Number(reRate || 0) / 100);
    const irpf = GP.utils.roundMoney(base * Number(irpfRate || 0) / 100);
    const total = GP.utils.roundMoney(base + iva + re - irpf);
    return { base, iva, re, irpf, total };
  }

  function saveDocument(documentData) {
    ensureLoaded();
    const next = typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    const doc = { ...documentData, id: documentData.id || GP.utils.uid('doc'), createdAt: documentData.createdAt || new Date().toISOString() };
    doc.internalCost = GP.auth.isPro?.() ? GP.utils.roundMoney(Math.max(0, Number(doc.internalCost) || 0)) : 0;
    const existingIndex = next.documents.findIndex(d => d.id === doc.id);
    const existing = existingIndex >= 0 ? next.documents[existingIndex] : null;
    const shouldApply = doc.type === 'FACTURA' && doc.operation === 'EMITIDA' && ['EMITIDA', 'COBRADA'].includes(doc.status);

    if (existing?.stockApplied) restoreStock(existing.lines, next.inventory);
    if (shouldApply) {
      applyStock(doc.lines, next.inventory);
      doc.stockApplied = true;
      doc.stockAppliedAt = existing?.stockAppliedAt || new Date().toISOString();
    } else {
      doc.stockApplied = false;
      delete doc.stockAppliedAt;
    }

    if (existingIndex >= 0) next.documents[existingIndex] = doc;
    else next.documents.unshift(doc);
    state = next;
    persist();
    return doc;
  }

  function convertQuoteToInvoice(id) {
    ensureLoaded();
    const quote = state.documents.find(d => d.id === id && d.type === 'PRESUPUESTO');
    if (!quote) throw new Error(GP.i18n.t('error.quoteNotFound'));
    const issues = checkStock(quote.lines || [], state.inventory);
    if (issues.length) {
      const details = issues.map(i => `${i.name} (${i.available} / ${i.requested})`).join(', '); const err = new Error(`${GP.i18n.t('error.documentStock')} ${GP.i18n.t('error.stockDetails', { details })}`);
      err.code = 'STOCK_INSUFFICIENT'; err.issues = issues;
      throw err;
    }
    const invoice = {
      ...quote,
      id: GP.utils.uid('doc'), type: 'FACTURA', status: 'EMITIDA',
      number: getNextDocumentNumber('FACTURA'),
      convertedFrom: quote.id, stockApplied: false,
      convertedAt: new Date().toISOString(), createdAt: new Date().toISOString()
    };
    applyStock(invoice.lines, state.inventory);
    invoice.stockApplied = true;
    state.documents.unshift(invoice);
    state.documents = state.documents.map(d => d.id === quote.id ? { ...d, status: 'FACTURADO', convertedTo: invoice.id } : d);
    persist();
    return invoice;
  }


  function publishQuote(id) {
    ensureLoaded();
    if (!GP.auth.isPro?.()) throw new Error(GP.i18n.t('premium.blocked'));
    const quote = state.documents.find(d => d.id === id && d.type === 'PRESUPUESTO');
    if (!quote) throw new Error(i18n.t('error.quoteNotFound'));
    const token = utils.uid('share').replace(/^share_/, '');
    const snapshot = {
      token, ownerId: userId, id: quote.id, type: quote.type, status: quote.status || 'ENVIADO',
      number: quote.number, issueDate: quote.issueDate, dueDate: quote.dueDate, currency: quote.currency || state.settings.currency || 'EUR',
      taxProfile: quote.taxProfile, taxRate: quote.taxRate, reRate: quote.reRate || 0, irpfRate: quote.irpfRate || 0,
      client: quote.client, company: quote.company || state.settings, lines: quote.lines || [], totals: quote.totals,
      sharedAt: new Date().toISOString(), decision: null, signatureDataUrl: '', premiumPortal: true
    };
    storage.set(`${config.KEYS.publicQuotePrefix}${token}`, snapshot);
    return { token, url: `portal.html?token=${encodeURIComponent(token)}` };
  }

  function getPublishedQuote(token) { return storage.get(`${config.KEYS.publicQuotePrefix}${String(token || '')}`, null); }

  function updatePublishedQuote(token, changes) {
    const key = `${config.KEYS.publicQuotePrefix}${String(token || '')}`;
    const current = storage.get(key, null); if (!current) throw new Error(i18n.t('error.quoteNotFound'));
    const next = { ...current, ...changes, updatedAt: new Date().toISOString() }; storage.set(key, next); return next;
  }

  function addProduct(product) {
    return transact(s => {
      if (s.inventory.some(p => p.sku.toUpperCase() === product.sku.toUpperCase())) throw new Error(GP.i18n.t('error.productDuplicate'));
      s.inventory.unshift({ ...product, id: product.id || GP.utils.uid('prod'), createdAt: new Date().toISOString() });
    });
  }

  function updateProduct(id, changes) {
    return transact(s => {
      const idx = s.inventory.findIndex(p => p.id === id);
      if (idx < 0) throw new Error(GP.i18n.t('error.productNotFound'));
      s.inventory[idx] = { ...s.inventory[idx], ...changes };
    });
  }

  function removeProduct(id) {
    return transact(s => { s.inventory = s.inventory.filter(p => p.id !== id); });
  }

  function saveClient(client) {
    return transact(s => {
      const value = { ...client, id: client.id || GP.utils.uid('client'), updatedAt: new Date().toISOString() };
      const idx = s.clients.findIndex(c => c.id === value.id);
      if (idx >= 0) s.clients[idx] = value; else s.clients.unshift(value);
      return value;
    });
  }

  function saveSettings(settings) {
    return transact(s => {
      const previousCurrency = s.settings.currency || 'EUR';
      const nextCurrency = settings.currency || previousCurrency;
      const previousDefaultTax = Number(s.settings.defaultTaxRate);
      const previousCurrencyDefaultTax = GP.utils.currencyTaxRate(previousCurrency);
      const next = { ...s.settings, ...settings };
      // Solo cambia el impuesto por defecto automáticamente cuando el usuario
      // estaba usando el valor automático de la divisa anterior.
      if (nextCurrency !== previousCurrency && Number.isFinite(previousDefaultTax) && Math.abs(previousDefaultTax - previousCurrencyDefaultTax) < 0.0001) {
        next.defaultTaxRate = GP.utils.currencyTaxRate(nextCurrency);
      }
      s.settings = next;
    });
  }

  function saveContract(contract) {
    return transact(s => {
      const value = { ...contract, id: contract.id || GP.utils.uid('contract'), updatedAt: new Date().toISOString() };
      const idx = (s.contracts || []).findIndex(c => c.id === value.id);
      if (idx >= 0) s.contracts[idx] = value; else s.contracts.unshift(value);
      return value;
    });
  }

  function getSnapshot() {
    ensureLoaded();
    return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  }

  function replaceState(snapshot) {
    ensureLoaded();
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Copia de seguridad no válida.');
    const base = emptyState();
    const incoming = snapshot;
    state = {
      ...base,
      ...incoming,
      settings: { ...base.settings, ...(incoming.settings || {}) },
      meta: { ...base.meta, ...(incoming.meta || {}) },
      clients: Array.isArray(incoming.clients) ? incoming.clients : [],
      inventory: Array.isArray(incoming.inventory) ? incoming.inventory : [],
      documents: Array.isArray(incoming.documents) ? incoming.documents : [],
      contracts: Array.isArray(incoming.contracts) ? incoming.contracts : [],
      expenses: Array.isArray(incoming.expenses) ? incoming.expenses : []
    };
    persist();
    return state;
  }

  function stats() {
    ensureLoaded();
    const baseCurrency = state.settings.currency || 'EUR';
    const invoices = state.documents.filter(d => d.type === 'FACTURA' && d.status !== 'CANCELADA');
    const issued = invoices.filter(d => d.operation === 'EMITIDA');
    const received = invoices.filter(d => d.operation === 'RECIBIDA');
    const unconvertedDocuments = [];
    const factor = d => {
      if ((d.currency || baseCurrency) === baseCurrency) return 1;
      const rate = Number(d.fxRateToBase);
      if (Number.isFinite(rate) && rate > 0) return rate;
      unconvertedDocuments.push(d);
      return 0;
    };
    const sum = (list, getter) => GP.utils.roundMoney(list.reduce((total, d) => total + (Number(getter(d)) || 0) * factor(d), 0));
    const ingresos = sum(issued, d => d.totals?.base);
    const gastos = sum(received, d => d.totals?.base);
    const ivaRepercutido = sum(issued, d => (d.totals?.iva || 0) + (d.totals?.re || 0));
    const ivaDeducible = sum(received, d => d.totals?.iva);
    const irpfRetenido = sum(issued, d => d.totals?.irpf);
    const ivaPagar = Math.max(0, GP.utils.roundMoney(ivaRepercutido - ivaDeducible));
    const resultado = GP.utils.roundMoney(ingresos - gastos);
    const margenTrasImpuestos = GP.utils.roundMoney(resultado - ivaPagar - irpfRetenido);
    const pendientes = invoices.filter(d => d.operation === 'EMITIDA' && d.status !== 'COBRADA' && d.status !== 'CANCELADA');
    const lowStock = state.inventory.filter(p => p.stock <= p.minStock);
    const byCurrency = {};
    invoices.forEach(d => { const c=d.currency||baseCurrency; byCurrency[c]=(byCurrency[c]||0)+(d.totals?.base||0); });
    return { invoices, issued, received, ingresos, gastos, resultado, ivaRepercutido, ivaDeducible, ivaPagar, irpfRetenido, margenTrasImpuestos, pendientes, lowStock, baseCurrency, byCurrency, unconvertedDocuments };
  }

  return {
    getState, subscribe, transact, saveDocument, convertQuoteToInvoice, addProduct, updateProduct, removeProduct,
    saveClient, saveSettings, saveContract, getSnapshot, replaceState, stats, buildTotals, checkStock, getNextDocumentNumber, ensureDemoData, publishQuote, getPublishedQuote, updatePublishedQuote
  };
})();

window.GP = window.GP || {};
window.GP.store = store;
