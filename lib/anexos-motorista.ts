// Anexos do motorista na ficha do atendimento (comprovantes de
// estacionamento, pedagio etc).
//
// Historico: a coluna antiga `anexo_motorista_url` em `corridas_empresa`
// guardava UMA url so. Em 2026-11-23 o Julimar reportou que o motorista
// paga mais de um estacionamento no mesmo dia e o upload novo sobrescrevia
// o anterior. A coluna nova `anexos_motorista_urls` (JSONB, array de
// strings) passa a aceitar varias. Nada e removido da antiga, pra nao
// perder registro: a leitura une as duas e, na primeira gravacao na coluna
// nova, o valor da antiga entra no array e a antiga e zerada.

export type CorridaComAnexos = {
  anexo_motorista_url?: string | null
  anexos_motorista_urls?: unknown
}

// Lista unificada de anexos do motorista: array vindo do banco + a url
// legacy, sem duplicar. A ordem e estavel: legacy primeiro, depois os
// gravados no array na ordem em que vieram.
export function listarAnexosMotorista(c: CorridaComAnexos | null | undefined): string[] {
  if (!c) return []
  const arr = Array.isArray(c.anexos_motorista_urls)
    ? c.anexos_motorista_urls.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : []
  const legacy = typeof c.anexo_motorista_url === 'string' && c.anexo_motorista_url.length > 0
    ? c.anexo_motorista_url
    : null
  if (legacy && !arr.includes(legacy)) return [legacy, ...arr]
  return arr
}
