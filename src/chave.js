/**
 * chave.js — extração e validação de chave de acesso NF-e/NFC-e (44 dígitos).
 *
 * Espelha deliberadamente parsers/utils.py do Despesas2 (extrair_chave_44,
 * dv_chave_valido) para que a validação feita aqui, no momento da leitura,
 * corresponda exatamente à regra usada na importação. Ver docs/FORMATO-ARQUIVO.md.
 */

function extrairChave44(texto, agressivo = false) {
  if (!texto) return null;
  texto = String(texto);

  let m = texto.match(/(?<!\d)(\d{44})(?!\d)/);
  if (m) return m[1];

  const semSep = texto.replace(/[\s.\-/]/g, '');
  m = semSep.match(/\d{44}/);
  if (m) return m[0];

  if (agressivo) {
    const soDigitos = texto.replace(/\D/g, '');
    m = soDigitos.match(/\d{44}/);
    if (m) return m[0];
  }
  return null;
}

function dvChaveValido(chave) {
  if (!chave || chave.length !== 44 || !/^\d+$/.test(chave)) return false;
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  const primeiros43 = chave.slice(0, 43);
  let soma = 0;
  for (let i = 0; i < 43; i++) {
    const digito = parseInt(primeiros43[primeiros43.length - 1 - i], 10);
    soma += digito * pesos[i % 8];
  }
  const resto = soma % 11;
  const dv = (resto === 0 || resto === 1) ? 0 : 11 - resto;
  return dv === parseInt(chave[43], 10);
}

/**
 * Interpreta o texto bruto decodificado de um QR Code ou código de barras.
 * Retorna {chave, urlQr, valida} ou null se nenhuma chave for reconhecível.
 * urlQr preserva o texto INTEIRO quando a leitura é uma URL — nunca normalizar
 * nem truncar (ver docs/FORMATO-ARQUIVO.md: é o que contorna o reCAPTCHA da SEFAZ).
 */
function interpretarLeitura(texto) {
  if (!texto) return null;
  const bruto = String(texto).trim();
  if (!bruto) return null;
  const isUrl = /^https?:\/\//i.test(bruto);
  const chave = extrairChave44(bruto, isUrl);
  if (!chave) return null;
  return {
    chave,
    urlQr: isUrl ? bruto : null,
    valida: dvChaveValido(chave),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extrairChave44, dvChaveValido, interpretarLeitura };
}
