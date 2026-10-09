import { config } from './core/config.js';
import { utils } from './core/utils.js';
import { i18n } from './core/i18n.js';
import { auth } from './auth.js';
import { store } from './core/store.js';
import { toast, emptyStateMarkup } from './core/ui.js';

const GP = { config, utils, i18n, auth, store, toast };

document.addEventListener('DOMContentLoaded', () => {
  if (!GP.auth.hasAccess()) return;
  const form = document.getElementById('form-stock');
  const search = document.getElementById('buscar-stock');
  const tbody = document.getElementById('tabla-stock');
  const submit = document.getElementById('stock-submit');
  const title = document.getElementById('stock-form-title');
  const cancelEdit = document.getElementById('stock-cancel-edit');
  let editingId = null;

  function resetForm() {
    editingId = null;
    form.reset();
    document.getElementById('prod-minimo').value = 5;
    document.getElementById('prod-iva').value = 21;
    title.textContent = GP.i18n.t('inventory.add');
    submit.textContent = GP.i18n.t('inventory.add');
    cancelEdit.hidden = true;
  }

  function beginEdit(product) {
    editingId = product.id;
    document.getElementById('prod-nombre').value = product.name || '';
    document.getElementById('prod-sku').value = product.sku || '';
    document.getElementById('prod-precio').value = Number(product.unitPrice || 0);
    document.getElementById('prod-cantidad').value = Math.max(0, Math.round(Number(product.stock) || 0));
    document.getElementById('prod-minimo').value = Math.max(0, Math.round(Number(product.minStock) || 0));
    document.getElementById('prod-iva').value = Number(product.taxRate ?? 21);
    title.textContent = GP.i18n.t('inventory.editProduct');
    submit.textContent = GP.i18n.t('inventory.saveChanges');
    cancelEdit.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('prod-nombre').focus({ preventScroll: true });
  }

  function render() {
    const state = GP.store.getState();
    const currency = state.settings.currency || 'EUR';
    const data = state.inventory || [];
    const q = (search?.value || '').trim().toLowerCase();
    const filtered = data.filter(p => !q || String(p.name || '').toLowerCase().includes(q) || String(p.sku || '').toLowerCase().includes(q));
    document.getElementById('stock-valor-total').textContent = GP.utils.formatMoney(data.reduce((sum, p) => sum + (Number(p.unitPrice) || 0) * (Number(p.stock) || 0), 0), currency);
    document.getElementById('stock-total-unidades').textContent = new Intl.NumberFormat(GP.config.CURRENCIES[currency]?.locale || 'es-ES').format(data.reduce((sum, p) => sum + (Number(p.stock) || 0), 0));
    document.getElementById('stock-alertas-count').textContent = data.filter(p => Number(p.stock) <= Number(p.minStock)).length;
    tbody.replaceChildren();
    if (!filtered.length) {
      const row = document.createElement('tr'); const cell = document.createElement('td');
      cell.colSpan = 6; cell.className = 'empty-state-cell';
      cell.appendChild(emptyStateMarkup(data.length ? { title: GP.i18n.t('inventory.noMatch'), description: '', href: '#', action: '' } : { title: GP.i18n.t('empty.inventoryTitle'), description: GP.i18n.t('empty.inventoryText'), href: '#form-stock', action: GP.i18n.t('empty.addProduct') }));
      row.appendChild(cell); tbody.appendChild(row); return;
    }
    filtered.forEach(product => {
      const low = Number(product.stock) <= Number(product.minStock);
      const empty = Number(product.stock) <= 0;
      const status = empty ? GP.i18n.t('dashboard.outOfStock') : low ? GP.i18n.t('dashboard.lowStock') : GP.i18n.t('dashboard.ok');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${GP.utils.escapeHtml(product.sku)}</strong></td><td>${GP.utils.escapeHtml(product.name)}</td><td>${GP.utils.escapeHtml(GP.utils.formatMoney(Number(product.unitPrice) || 0, currency))}</td><td>${Math.round(Number(product.stock) || 0)}</td><td><span class="badge ${empty ? 'badge-danger' : low ? 'badge-warning' : 'badge-success'}">${GP.utils.escapeHtml(status)}</span></td><td><div class="btn-row"><button type="button" class="btn-ghost btn-small js-edit-product" data-id="${GP.utils.escapeHtml(product.id)}">${GP.i18n.t('inventory.edit')}</button><button type="button" class="btn-ghost btn-small js-delete-product" data-id="${GP.utils.escapeHtml(product.id)}">${GP.i18n.t('inventory.delete')}</button></div></td>`;
      const labels = [GP.i18n.t('inventory.sku'), GP.i18n.t('inventory.product'), GP.i18n.t('inventory.unitPrice'), GP.i18n.t('inventory.stock'), GP.i18n.t('inventory.status'), GP.i18n.t('inventory.actions')];
      tr.querySelectorAll(':scope > td').forEach((td, i) => td.dataset.label = labels[i] || '');
      tbody.appendChild(tr);
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = document.getElementById('prod-nombre').value.trim();
    const sku = document.getElementById('prod-sku').value.trim().toUpperCase();
    const unitPrice = Number(document.getElementById('prod-precio').value);
    const stock = Number(document.getElementById('prod-cantidad').value);
    const minStock = Number(document.getElementById('prod-minimo').value);
    const taxRate = Number(document.getElementById('prod-iva').value);
    if (!name || !sku) return GP.toast(GP.i18n.t('error.companyRequired'), 'error');
    if ([unitPrice, stock, minStock, taxRate].some(value => !Number.isFinite(value) || value < 0) || !Number.isInteger(stock) || !Number.isInteger(minStock) || taxRate > 100) return GP.toast(GP.i18n.t('error.noNegative'), 'error');
    try {
      const inventory = GP.store.getState().inventory;
      if (inventory.some(product => product.sku.toUpperCase() === sku && product.id !== editingId)) throw new Error(GP.i18n.t('error.productDuplicate'));
      const changes = { name, sku, unitPrice, stock: Math.round(stock), minStock: Math.round(minStock), taxRate };
      if (editingId) {
        GP.store.updateProduct(editingId, changes);
        GP.toast(GP.i18n.t('inventory.updated'), 'success');
      } else {
        GP.store.addProduct(changes);
        GP.toast(GP.i18n.t('inventory.added'), 'success');
      }
      resetForm();
      render();
    } catch (error) { GP.toast(error.message, 'error'); }
  });

  cancelEdit.addEventListener('click', resetForm);
  search?.addEventListener('input', render);
  tbody.addEventListener('click', event => {
    const editButton = event.target.closest('.js-edit-product');
    if (editButton) {
      const product = GP.store.getState().inventory.find(item => item.id === editButton.dataset.id);
      if (product) beginEdit(product);
      return;
    }
    const deleteButton = event.target.closest('.js-delete-product');
    if (!deleteButton) return;
    try {
      if (editingId === deleteButton.dataset.id) resetForm();
      GP.store.removeProduct(deleteButton.dataset.id);
      GP.toast(GP.i18n.t('inventory.deleted'), 'success');
    } catch (error) { GP.toast(error.message, 'error'); }
  });
  render();
  GP.store.subscribe(render);
  window.addEventListener('gp:languagechange', () => { if (!editingId) resetForm(); render(); });
});
