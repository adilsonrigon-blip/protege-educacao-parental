(function (global) {
  'use strict';

  const DDDS_VALIDOS = new Set([
    '11','12','13','14','15','16','17','18','19','21','22','24','27','28',
    '31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49',
    '51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79',
    '81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99'
  ]);

  function somenteDigitos(valor) {
    let d = String(valor || '').replace(/\D/g, '');
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    return d.slice(0, 11);
  }

  function formatarCelular(valor) {
    const d = somenteDigitos(valor);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
  }

  function validarCelular(valor) {
    const d = somenteDigitos(valor);
    if (d.length !== 11) return false;
    if (!DDDS_VALIDOS.has(d.slice(0,2))) return false;
    if (d[2] !== '9') return false;
    return true;
  }

  global.ProtegeCelular = { somenteDigitos, formatarCelular, validarCelular };
})(typeof window !== 'undefined' ? window : globalThis);
