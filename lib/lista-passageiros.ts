// Lista nominal de passageiros de um FRETAMENTO (igreja, empresa, excursão).
//
// É separada dos passageiros da rota do dia: cada fretamento guarda a sua
// própria lista (coluna lista_passageiros, JSONB) — em `fretamentos` no app
// individual e em `corridas_empresa` no empresarial. Exigida pela ANTT/PRF
// em viagem intermunicipal (nome completo; documento opcional).

export type PassageiroFretamento = {
  nome: string
  documento?: string
}

const RE_NUMERACAO = /^\s*(?:\d{1,3}\s*[.)\-–—:ºª°]*\s*|[-•*·–—]+\s*)(?=[A-Za-zÀ-ÿ])/
const RE_DOCUMENTO = /^(.*?)[\s,;:\-–—]*(?:\b(RG|CPF|DOC|DOCUMENTO)\b\.?\s*(?:n[ºo°]?\.?)?\s*[:\-]?\s*)?([0-9][0-9.\-\/ xX]{3,}[0-9xX])\s*$/i

function contarDigitos(s: string): number {
  return (s.match(/\d/g) || []).length
}

function limparNome(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[\s,;:\-–—]+$/, '').trim()
}

// Uma linha de texto vira um passageiro. Aceita o jeito que a lista costuma
// chegar pelo WhatsApp: "1. João da Silva", "- Maria", "Pedro - 123.456.789-00",
// "Ana Souza RG 1234567", "Carlos<TAB>12345678900" (colado do Excel).
export function lerLinhaPassageiro(linha: string): PassageiroFretamento | null {
  let texto = linha.replace(/\t/g, ' ').trim()
  if (!texto) return null
  // "Lista da igreja:" — título da mensagem, não passageiro.
  if (/:\s*$/.test(texto)) return null
  texto = texto.replace(RE_NUMERACAO, '')

  const m = texto.match(RE_DOCUMENTO)
  if (m && contarDigitos(m[3]) >= 5) {
    const nome = limparNome(m[1])
    if (!nome) return null
    const rotulo = m[2] ? m[2].toUpperCase() + ' ' : ''
    return { nome, documento: rotulo + m[3].trim() }
  }

  const nome = limparNome(texto)
  if (!nome || !/[A-Za-zÀ-ÿ]/.test(nome)) return null
  return { nome }
}

export function lerTextoPassageiros(texto: string): PassageiroFretamento[] {
  const saida: PassageiroFretamento[] = []
  for (const linha of texto.split(/\r?\n/)) {
    const p = lerLinhaPassageiro(linha)
    if (p) saida.push(p)
  }
  return saida
}

// O que vai pro banco: sem linhas vazias, espaços normalizados, documento
// só quando preenchido.
export function limparListaPassageiros(lista: PassageiroFretamento[]): PassageiroFretamento[] {
  const saida: PassageiroFretamento[] = []
  for (const p of lista) {
    const nome = (p.nome || '').replace(/\s+/g, ' ').trim()
    if (!nome) continue
    const documento = (p.documento || '').replace(/\s+/g, ' ').trim()
    saida.push(documento ? { nome, documento } : { nome })
  }
  return saida
}

// Lê o que veio do banco sem confiar no formato (JSONB pode ter qualquer coisa).
export function normalizarListaDoBanco(valor: unknown): PassageiroFretamento[] {
  if (!Array.isArray(valor)) return []
  const lista: PassageiroFretamento[] = []
  for (const item of valor) {
    if (item && typeof item === 'object' && typeof (item as any).nome === 'string') {
      const doc = (item as any).documento
      lista.push({ nome: (item as any).nome, documento: typeof doc === 'string' ? doc : '' })
    }
  }
  return lista
}
