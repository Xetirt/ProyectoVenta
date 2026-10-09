export const config = {
  APP_NAME: 'GestioFlex',
  TRIAL_DAYS: 14,
  FREE_QUOTE_LIMIT: 5,
  PRIVATE_PAGES: ['dashboard.html', 'presupuestos.html', 'funcionalidades.html', 'calculadora.html', 'configuracion.html', 'perfil.html', 'simulador.html', 'clientes.html', 'contratos.html', 'automatizaciones.html'],
  PUBLIC_PAGES: ['index.html', 'login.html', 'registro.html', 'recuperar.html'],
  CHECKOUT_PAGE: 'checkout.html',
  PERMISOS: {
    propietario: ['dashboard', 'documentos', 'inventario', 'finanzas', 'configuracion', 'perfil'],
    empleado: ['dashboard', 'documentos', 'inventario', 'finanzas', 'perfil']
  },
  KEYS: {
    users: 'gp_users',
    session: 'gp_session',
    resets: 'gp_resets',
    dataPrefix: 'gp_data_',
    language: 'gp_language',
    theme: 'gp_theme',
    publicQuotePrefix: 'gp_public_quote_'
  },
  CURRENCIES: {
    EUR: { locale: 'es-ES', fraction: 2, symbol: '€', rate: 1.00, tax: 0.21 },
    USD: { locale: 'en-US', fraction: 2, symbol: '$', rate: 1.08, tax: 0.10 },
    GBP: { locale: 'en-GB', fraction: 2, symbol: '£', rate: 0.86, tax: 0.20 },
    MXN: { locale: 'es-MX', fraction: 2, symbol: '$', rate: 20.00, tax: 0.16 },
    COP: { locale: 'es-CO', fraction: 0, symbol: '$', rate: 4300.00, tax: 0.19 },
    ARS: { locale: 'es-AR', fraction: 2, symbol: '$', rate: 1500.00, tax: 0.21 },
    CLP: { locale: 'es-CL', fraction: 0, symbol: '$', rate: 950.00, tax: 0.19 },
    CHF: { locale: 'de-CH', fraction: 2, symbol: 'CHF', rate: 0.94, tax: 0.081 }
  },
  TAX_PROFILES: {
    ES: {
      label: 'España', taxName: 'IVA', country: 'ES',
      options: [
        { rate: 21, labelKey: 'tax.iva21' },
        { rate: 10, labelKey: 'tax.iva10' },
        { rate: 4, labelKey: 'tax.iva4' },
        { rate: 0, labelKey: 'tax.exempt' }
      ],
      recargo: { 21: 5.2, 10: 1.4, 4: 0.5, 0: 0 }, irpfOptions: [0, 7, 15]
    },
    EU: { label: 'UE / IVA configurable', taxName: 'IVA / VAT', country: 'EU', options: [{rate:0,labelKey:'tax.none'},{rate:null,labelKey:'tax.configurable'}], recargo:{}, irpfOptions:[0] },
    US: {
      label: 'EE. UU. / Sales Tax', taxName: 'Sales Tax', country: 'US',
      options: [{ rate: 0, labelKey: 'tax.none' }, { rate: null, labelKey: 'tax.configurable' }], recargo: {}, irpfOptions: [0],
      states: ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'],
      salesTaxByState: {
        AL:null, AK:null, AZ:null, AR:null, CA:null, CO:null, CT:null, DE:null, FL:null, GA:null,
        HI:null, ID:null, IL:null, IN:null, IA:null, KS:null, KY:null, LA:null, ME:null, MD:null,
        MA:null, MI:null, MN:null, MS:null, MO:null, MT:null, NE:null, NV:null, NH:null, NJ:null,
        NM:null, NY:null, NC:null, ND:null, OH:null, OK:null, OR:null, PA:null, RI:null, SC:null,
        SD:null, TN:null, TX:null, UT:null, VT:null, VA:null, WA:null, WV:null, WI:null, WY:null, DC:null
      }
    },
    MX: { label: 'México / IVA', taxName: 'IVA', country: 'MX', options: [{rate:0,labelKey:'tax.none'},{rate:null,labelKey:'tax.configurable'}], recargo:{}, irpfOptions:[0] },
    CO: { label: 'Colombia / IVA', taxName: 'IVA', country: 'CO', options: [{rate:0,labelKey:'tax.none'},{rate:null,labelKey:'tax.configurable'}], recargo:{}, irpfOptions:[0] },
    AR: { label: 'Argentina / IVA', taxName: 'IVA', country: 'AR', options: [{rate:0,labelKey:'tax.none'},{rate:null,labelKey:'tax.configurable'}], recargo:{}, irpfOptions:[0] },
    INTL: { label: 'Internacional / otro', taxName: 'Impuesto', country: 'INTL', options: [{rate:0,labelKey:'tax.none'},{rate:5,label:'5%'},{rate:8,label:'8%'},{rate:10,label:'10%'},{rate:20,label:'20%'}], recargo:{}, irpfOptions:[0] }
  },
  PREMIUM_FEATURES: {
    advancedReports: { titleKey: 'premium.advancedReportsTitle', descriptionKey: 'premium.advancedReportsText' },
    quotePortal: { titleKey: 'premium.quotePortalTitle', descriptionKey: 'premium.quotePortalText' },
    advancedAnalytics: { titleKey: 'premium.advancedAnalyticsTitle', descriptionKey: 'premium.advancedAnalyticsText' },
    fiscalCalendar: { titleKey: 'premium.fiscalCalendarTitle', descriptionKey: 'premium.fiscalCalendarText' },
    profitMargin: { titleKey: 'premium.profitMarginTitle', descriptionKey: 'premium.profitMarginText' }
  },
  PLANS: {
    freelance: { key:'freelance', name:'Autónomo / Freelance', monthly:12, annual:108, annualDiscount:25, features:['pricing.f1','pricing.f2','pricing.f3','pricing.f4'] },
    pyme: { key:'pyme', name:'PyME / Empresa', monthly:39, annual:348, annualDiscount:25.64, features:['pricing.p1','pricing.p2','pricing.p3','pricing.p4','pricing.f4'] }
  },
  COUNTRY_TAX_CONFIG: {
    ES: { labelKey:'country.ES', taxLabelKey:'tax.iva', taxType:'VAT', taxRate:21, currency:'EUR', priceIncludesTax:true },
    FR: { labelKey:'country.FR', taxLabelKey:'tax.tva', taxType:'VAT', taxRate:20, currency:'EUR', priceIncludesTax:true },
    DE: { labelKey:'country.DE', taxLabelKey:'tax.vat', taxType:'VAT', taxRate:19, currency:'EUR', priceIncludesTax:true },
    IT: { labelKey:'country.IT', taxLabelKey:'tax.iva', taxType:'VAT', taxRate:22, currency:'EUR', priceIncludesTax:true },
    GB: { labelKey:'country.GB', taxLabelKey:'tax.vat', taxType:'VAT', taxRate:20, currency:'GBP', priceIncludesTax:true },
    US: { labelKey:'country.US', taxLabelKey:'tax.salesTax', taxType:'salesTax', taxRate:0, currency:'USD', requiresState:true, priceIncludesTax:true },
    MX: { labelKey:'country.MX', taxLabelKey:'tax.iva', taxType:'VAT', taxRate:16, currency:'MXN', priceIncludesTax:true },
    CO: { labelKey:'country.CO', taxLabelKey:'tax.iva', taxType:'VAT', taxRate:19, currency:'COP', priceIncludesTax:true },
    AR: { labelKey:'country.AR', taxLabelKey:'tax.iva', taxType:'VAT', taxRate:21, currency:'ARS', priceIncludesTax:true },
    OTHER: { labelKey:'country.OTHER', taxLabelKey:'tax.tax', taxType:'VAT', taxRate:0, currency:'EUR', priceIncludesTax:true }
  },
  BILLING_COUNTRIES: [
    { code:'ES' }, { code:'FR' }, { code:'DE' }, { code:'IT' }, { code:'GB' },
    { code:'US' }, { code:'MX' }, { code:'CO' }, { code:'AR' }, { code:'OTHER' }
  ]
};

export const COUNTRY_TAX_CONFIG = config.COUNTRY_TAX_CONFIG;


export function currencyConfig(currency = 'EUR') {
  return config.CURRENCIES[currency] || config.CURRENCIES.EUR;
}

export function defaultTaxPercent(currency = 'EUR') {
  return Number(currencyConfig(currency).tax || 0) * 100;
}

export function currencyRate(currency = 'EUR') {
  return Number(currencyConfig(currency).rate || 1);
}


// Compatibilidad temporal con integraciones externas/anteriores.
window.GP = window.GP || {};
window.GP.config = config;
