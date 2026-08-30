(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ProtegeCpf = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function somenteDigitos(valor) {
    return String(valor || '').replace(/\D/g, '').slice(0, 11);
  }

  function formatarCpf(valor) {
    const d = somenteDigitos(valor);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function validarCpf(valor) {
    const cpf = somenteDigitos(valor);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const calcular = (base, pesoInicial) => {
      let soma = 0;
      for (let i = 0; i < base.length; i += 1) soma += Number(base[i]) * (pesoInicial - i);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    const d1 = calcular(cpf.slice(0, 9), 10);
    const d2 = calcular(cpf.slice(0, 10), 11);
    return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
  }

  return { somenteDigitos, formatarCpf, validarCpf };
});
