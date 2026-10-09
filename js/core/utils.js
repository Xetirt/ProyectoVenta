import { config, currencyConfig, defaultTaxPercent, currencyRate } from './config.js';

export const utils = (() => {
  const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

  function uid(prefix = 'id') {
    if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function currencyInfo(currency = 'EUR') {
    return config.CURRENCIES[currency] || config.CURRENCIES.EUR;
  }

  function currencyTaxRate(currency = 'EUR') {
    return defaultTaxPercent(currency);
  }

  function currencyExchangeRate(currency = 'EUR') {
    return currencyRate(currency);
  }

  function convertCurrency(value, fromCurrency = 'EUR', toCurrency = 'EUR') {
    const fromRate = currencyRate(fromCurrency) || 1;
    const toRate = currencyRate(toCurrency) || 1;
    return roundMoney((Number(value) || 0) * toRate / fromRate);
  }

  function formatMoney(value, currency = 'EUR') {
    const cfg = currencyInfo(currency);
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency', currency,
      minimumFractionDigits: cfg.fraction,
      maximumFractionDigits: cfg.fraction
    }).format(Number(value) || 0);
  }

  function daysRemaining(isoDate) {
    const end = new Date(isoDate).getTime();
    if (!Number.isFinite(end)) return 0;
    return Math.max(0, Math.ceil((end - Date.now()) / 864e5));
  }

  function normalizeTaxId(raw) {
    return String(raw || '').trim().toUpperCase().replace(/[\s-]/g, '');
  }

  function validateNifNie(value) {
    const taxId = normalizeTaxId(value);
    if (/^[XYZ]\d{7}[A-Z]$/.test(taxId)) {
      const prefix = { X: '0', Y: '1', Z: '2' }[taxId[0]];
      const number = Number(prefix + taxId.slice(1, 8));
      return DNI_LETTERS[number % 23] === taxId[8];
    }
    if (/^\d{8}[A-Z]$/.test(taxId)) {
      return DNI_LETTERS[Number(taxId.slice(0, 8)) % 23] === taxId[8];
    }
    return false;
  }

  function validateCif(value) {
    const taxId = normalizeTaxId(value);
    if (!/^[A-HJNPQRSUVW]\d{7}[0-9A-J]$/.test(taxId)) return false;
    const digits = taxId.slice(1, 8);
    let sumEven = 0;
    let sumOdd = 0;
    for (let i = 0; i < digits.length; i += 1) {
      const n = Number(digits[i]);
      if ((i + 1) % 2 === 0) sumEven += n;
      else {
        const doubled = n * 2;
        sumOdd += Math.floor(doubled / 10) + doubled % 10;
      }
    }
    const controlDigit = (10 - ((sumEven + sumOdd) % 10)) % 10;
    const controlLetter = 'JABCDEFGHI'[controlDigit];
    const first = taxId[0];
    const last = taxId[8];
    const letterControl = ['P', 'Q', 'S', 'W'].includes(first);
    const digitControl = ['A', 'B', 'E', 'H'].includes(first);
    if (letterControl) return last === controlLetter;
    if (digitControl) return last === String(controlDigit);
    return last === String(controlDigit) || last === controlLetter;
  }

  function validateSpanishTaxId(value, type = 'NIF/NIE') {
    if (type === 'VAT') return /^[A-Z]{2}[A-Z0-9]{5,14}$/.test(normalizeTaxId(value));
    const taxId = normalizeTaxId(value);
    if (type === 'CIF') return validateCif(taxId);
    return validateNifNie(taxId) || validateCif(taxId);
  }

  function validationError(field, message) {
    const err = new Error(message);
    err.field = field;
    return err;
  }

  return {
    uid, escapeHtml, roundMoney, formatMoney, currencyTaxRate, currencyExchangeRate, convertCurrency, daysRemaining,
    normalizeTaxId, validateSpanishTaxId, validationError
  };
})();


window.GP = window.GP || {};
window.GP.utils = utils;
