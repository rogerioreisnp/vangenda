// Formata um telefone pra usar em link wa.me (WhatsApp), respeitando
// números internacionais. O Vangenda transfer atende viagens internacionais,
// então clientes de fora do Brasil precisam ter WhatsApp aceito.
//
// Regras:
//  - Se o usuário digitou com "+" no começo (ex: "+1 555 123 4567",
//    "+351 912 345 678"), respeita o código de país exato — só remove o "+"
//    e caracteres não-numéricos. É a forma explícita de dizer "é internacional".
//  - Se já começa com "55" e tem 12-13 dígitos, é Brasil com código — mantém.
//  - Se tem 10-11 dígitos (padrão BR sem código: DDD + número), prefixa "55".
//  - Qualquer outro caso, devolve só os dígitos como estão (não força "55"
//    pra não corromper número estrangeiro digitado sem "+").
export function formatarTelefoneWhatsApp(input: string | null | undefined): string {
  const raw = (input || '').trim()
  if (!raw) return ''

  const temMais = raw.startsWith('+')
  const digitos = raw.replace(/\D/g, '')
  if (!digitos) return ''

  // Internacional explícito com "+": respeita exatamente o que foi digitado.
  if (temMais) return digitos

  // Brasil com código de país já embutido.
  if (digitos.startsWith('55') && digitos.length >= 12 && digitos.length <= 13) {
    return digitos
  }

  // Brasil sem código (DDD + número: 10 ou 11 dígitos) → prefixa 55.
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`
  }

  // Ambíguo (número estrangeiro sem "+", ou tamanho fora do padrão BR):
  // devolve os dígitos como estão. Melhor não abrir o WhatsApp num número
  // BR errado do que forçar "55" num número que não é brasileiro.
  return digitos
}
