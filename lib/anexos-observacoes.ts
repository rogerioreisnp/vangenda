// Anexos da observacao do ATENDIMENTO (gestor): plaquinha de identificacao,
// voucher, etc. A logica e igual a dos anexos do motorista — ate 2026-11-23
// a coluna `anexo_observacoes_url` guardava UMA url so, e um upload novo
// substituia o anterior. A partir de 2026-11-24 (Julimar), a coluna nova
// `anexos_observacoes_urls` passa a aceitar varios.
//
// Mesma logica pra IDA e pra VOLTA — cada linha de corrida_empresa tem a
// sua, lida/gravada separadamente.

export type CorridaComAnexosObs = {
  anexo_observacoes_url?: string | null
  anexos_observacoes_urls?: unknown
}

export function listarAnexosObservacoes(c: CorridaComAnexosObs | null | undefined): string[] {
  if (!c) return []
  const arr = Array.isArray(c.anexos_observacoes_urls)
    ? c.anexos_observacoes_urls.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : []
  const legacy = typeof c.anexo_observacoes_url === 'string' && c.anexo_observacoes_url.length > 0
    ? c.anexo_observacoes_url
    : null
  if (legacy && !arr.includes(legacy)) return [legacy, ...arr]
  return arr
}
