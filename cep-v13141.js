// Protege V13.14.1 - consulta de CEP via ViaCEP
(function(){
  'use strict';
  const digits=v=>String(v||'').replace(/\D/g,'').slice(0,8);
  const format=v=>{const d=digits(v);return d.length>5?d.slice(0,5)+'-'+d.slice(5):d};
  const valid=v=>/^\d{8}$/.test(digits(v)) && !/^(\d)\1{7}$/.test(digits(v));
  async function lookup(value,signal){
    const cep=digits(value);if(!valid(cep))throw new Error('CEP inválido. Informe 8 números.');
    const response=await fetch('https://viacep.com.br/ws/'+cep+'/json/',{method:'GET',headers:{Accept:'application/json'},signal});
    if(!response.ok)throw new Error('Não foi possível consultar o CEP agora.');
    const data=await response.json();if(data?.erro)throw new Error('CEP não encontrado. Confira o número informado.');
    return {cep:format(data.cep||cep),logradouro:String(data.logradouro||''),bairro:String(data.bairro||''),cidade:String(data.localidade||''),estado:String(data.uf||'').toUpperCase()};
  }
  window.ProtegeCep={somenteDigitos:digits,formatarCep:format,validarCep:valid,consultarCep:lookup};
})();
