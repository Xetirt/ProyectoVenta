import { i18n } from './core/i18n.js';
import { toast } from './core/ui.js';

const API_URL = 'https://script.google.com/macros/s/AKfycbygrn-NBeCzeD1W4C84w7FysdKr_qmVXPCle8E61i2PQfj0vCF671iS9mbk2ozla-_I/exec';
const MODO_SIMULADO = true;

const RESPUESTAS_SIMULADAS = {
  crearFactura: () => ({ pdfUrl: '', mensaje: i18n.t('api.invoiceSimulated') }),
  crearDocumento: () => ({ mensaje: i18n.t('api.documentSimulated'), pdfUrl: '' }),
  crearPresupuestoCompleto: () => ({ mensaje: i18n.t('api.quoteSimulated'), idPresupuesto: 'SIM-' + Date.now(), pdfUrl: '' })
};

function apiErrorForStatus(status) {
  const map = {
    401: 'error.unauthorized',
    403: 'error.forbidden',
    500: 'error.server'
  };
  const key = map[status];
  const message = key ? i18n.t(key) : i18n.t('error.serverWithStatus', { status });
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function ejecutarBackend(nombreFuncion, parametros = {}) {
  try {
    if (MODO_SIMULADO) {
      const requestedStatus = parametros.__simulateStatus;
      if ([401, 403, 500].includes(requestedStatus)) throw apiErrorForStatus(requestedStatus);
      const sim = RESPUESTAS_SIMULADAS[nombreFuncion];
      if (!sim) throw new Error(i18n.t('api.simulatedMissing', { name: nombreFuncion }));
      return sim(parametros);
    }

    const respuesta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: nombreFuncion, data: parametros })
    });
    if ([401, 403, 500].includes(respuesta.status)) throw apiErrorForStatus(respuesta.status);
    let resultado;
    try { resultado = await respuesta.json(); }
    catch { throw new Error(i18n.t('api.invalidResponse')); }
    if (!resultado.exito) {
      const err = new Error(resultado.error || i18n.t('api.callError'));
      err.status = respuesta.status;
      throw err;
    }
    return resultado.datos;
  } catch (err) {
    console.error(`Error al ejecutar ${nombreFuncion}:`, err);
    toast(err.message, 'error');
    throw err;
  }
}
