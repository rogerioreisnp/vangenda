// Converte valor decimal em texto por extenso (usado no recibo PDF formal).
// Ex: 1234.56 => "mil, duzentos e trinta e quatro reais e cinquenta e seis centavos"

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function extensoAte999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const d = Math.floor((n % 100) / 10)
  const u = n % 10
  const partes: string[] = []
  if (c > 0) partes.push(CENTENAS[c])
  if (d === 1) {
    partes.push(DEZ_A_DEZENOVE[u])
  } else {
    if (d > 0) partes.push(DEZENAS[d])
    if (u > 0) partes.push(UNIDADES[u])
  }
  return partes.filter(Boolean).join(' e ')
}

function extensoInt(n: number): string {
  if (n === 0) return 'zero'
  if (n < 0) return 'menos ' + extensoInt(-n)
  const milhoes = Math.floor(n / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (milhoes > 0) {
    partes.push(milhoes === 1 ? 'um milhão' : `${extensoAte999(milhoes)} milhões`)
  }
  if (milhares > 0) {
    partes.push(milhares === 1 ? 'mil' : `${extensoAte999(milhares)} mil`)
  }
  if (resto > 0) partes.push(extensoAte999(resto))
  return partes.join(', ')
}

export function valorPorExtenso(v: number): string {
  const inteiro = Math.floor(Math.abs(v))
  const centavos = Math.round((Math.abs(v) - inteiro) * 100)
  const parteInt = inteiro === 1 ? 'um real' : `${extensoInt(inteiro)} reais`
  if (centavos === 0) return parteInt
  const parteCent = centavos === 1 ? 'um centavo' : `${extensoInt(centavos)} centavos`
  return `${parteInt} e ${parteCent}`
}
