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

// Confere se um telefone digitado parece real, sem travar cliente
// internacional (o transfer atende gente de fora do Brasil — mesma
// ressalva de formatarTelefoneWhatsApp acima). Não é validação de telecom
// de verdade (não confere se o DDD existe de fato) — é só o suficiente
// pra barrar número digitado a esmo, tipo "764648464646465" (15 dígitos),
// que não bate com nenhum formato real de telefone em lugar nenhum.
//
// Pedido de cliente (2026-08-11): agendamentos falsos entrando pelo link
// público com telefone/nome inventados pra atrapalhar. Verificação de
// código por SMS/WhatsApp foi descartada de propósito — fricção a mais
// pro cliente real só pra confirmar o telefone.
export function pareceTelefoneReal(input: string): boolean {
  const raw = (input || '').trim()
  if (!raw) return false

  const temMais = raw.startsWith('+')
  const digitos = raw.replace(/\D/g, '')
  if (!digitos) return false

  // Internacional explícito: a pessoa assumiu o código do país digitando
  // "+", então só barra tamanho absurdo (nenhum telefone do mundo tem
  // menos de 8 ou mais de 15 dígitos).
  if (temMais) return digitos.length >= 8 && digitos.length <= 15

  // Brasil com código do país embutido (55 + DDD + número).
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    const ddd = parseInt(digitos.slice(2, 4), 10)
    return ddd >= 11 && ddd <= 99
  }

  // Brasil sem código (DDD + número: 10 dígitos fixo, 11 celular).
  if (digitos.length === 10 || digitos.length === 11) {
    const ddd = parseInt(digitos.slice(0, 2), 10)
    return ddd >= 11 && ddd <= 99
  }

  return false
}
