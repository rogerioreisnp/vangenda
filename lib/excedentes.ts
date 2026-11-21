// Excedentes de um atendimento: hora parada (transfer), hora extra e km
// excedente (diaria / city tour). Pedido Julimar 2026-11-19.
//
// - O gestor define as CONDICOES na contratacao (variam a cada contratacao):
//   franquia, tolerancia, valores e o % que vai pro motorista.
// - O MOTORISTA informa no app o tempo de parada e as horas extras. O km
//   excedente sai do KM inicial/final que ele ja registra.
// - O GESTOR confere na ficha e "lanca": o valor do atendimento e o repasse
//   passam a incluir os excedentes, e o que foi lancado fica guardado em
//   `aplicado` pra poder corrigir depois sem somar duas vezes.
//
// Cobranca proporcional ao minuto (1h30 = 1,5 h). O gestor pode ajustar os
// minutos antes de lancar se a empresa arredonda de outro jeito.

export type CondicoesExcedente = {
  franquia_horas?: number | null      // diaria/city tour (so referencia pro motorista)
  franquia_km?: number | null         // diaria/city tour
  valor_hora_extra?: number | null    // R$ por hora
  valor_km_excedente?: number | null  // R$ por km
  tolerancia_min?: number | null      // transfer: espera sem cobranca
  valor_hora_parada?: number | null   // R$ por hora
  pct_repasse?: number | null         // % dos excedentes que vai pro motorista
}

export type ItemExcedente = {
  tipo: 'hora_parada' | 'hora_extra' | 'km_excedente'
  descricao: string
  quantidade: number                  // horas ou km
  unidade: 'h' | 'km'
  valor_unit: number
  total: number
}

export type ExcedenteAplicado = {
  itens: ItemExcedente[]
  total: number
  repasse: number
  em: string                          // ISO de quando foi lancado
}

export type Excedentes = {
  condicoes?: CondicoesExcedente | null
  aplicado?: ExcedenteAplicado | null
}

export type MedidasExcedente = {
  minutos_parada?: number | null
  minutos_hora_extra?: number | null
  km_rodado?: number | null
}

const arred = (v: number) => Math.round(v * 100) / 100
const pos = (v: number | null | undefined) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0)

// Alguma condicao com valor? So entao o motorista ve os campos e a ficha mostra
// o quadro — empresa que nao usa excedente nao ve nada novo.
export function temCondicoes(c: CondicoesExcedente | null | undefined): boolean {
  if (!c) return false
  return pos(c.valor_hora_parada) > 0 || pos(c.valor_hora_extra) > 0 || pos(c.valor_km_excedente) > 0
}

export function formatarMinutos(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} min`
  return r === 0 ? `${h}h` : `${h}h${String(r).padStart(2, '0')}`
}

export function calcularExcedentes(cond: CondicoesExcedente | null | undefined, medidas: MedidasExcedente): { itens: ItemExcedente[]; total: number; repasse: number } {
  const itens: ItemExcedente[] = []
  if (cond) {
    // Hora parada: so o que passou da tolerancia.
    const valorParada = pos(cond.valor_hora_parada)
    const minutosCobrados = pos(medidas.minutos_parada) - pos(cond.tolerancia_min)
    if (valorParada > 0 && minutosCobrados > 0) {
      const horas = minutosCobrados / 60
      itens.push({
        tipo: 'hora_parada',
        descricao: `Hora parada (${formatarMinutos(minutosCobrados)} além da tolerância)`,
        quantidade: arred(horas), unidade: 'h', valor_unit: valorParada, total: arred(horas * valorParada),
      })
    }
    // Hora extra: o motorista informa quanto passou da franquia.
    const valorExtra = pos(cond.valor_hora_extra)
    const minutosExtra = pos(medidas.minutos_hora_extra)
    if (valorExtra > 0 && minutosExtra > 0) {
      const horas = minutosExtra / 60
      itens.push({
        tipo: 'hora_extra',
        descricao: `Hora extra (${formatarMinutos(minutosExtra)})`,
        quantidade: arred(horas), unidade: 'h', valor_unit: valorExtra, total: arred(horas * valorExtra),
      })
    }
    // KM excedente: km rodado acima da franquia. Sem franquia nao calcula
    // (cobrar o km inteiro nunca e o combinado).
    const valorKm = pos(cond.valor_km_excedente)
    const franquiaKm = cond.franquia_km
    const kmExcedente = pos(medidas.km_rodado) - pos(franquiaKm)
    if (valorKm > 0 && typeof franquiaKm === 'number' && franquiaKm >= 0 && kmExcedente > 0) {
      itens.push({
        tipo: 'km_excedente',
        descricao: `KM excedente (${arred(kmExcedente).toLocaleString('pt-BR')} km além da franquia)`,
        quantidade: arred(kmExcedente), unidade: 'km', valor_unit: valorKm, total: arred(kmExcedente * valorKm),
      })
    }
  }
  const total = arred(itens.reduce((s, i) => s + i.total, 0))
  const repasse = arred(total * Math.min(100, pos(cond?.pct_repasse)) / 100)
  return { itens, total, repasse }
}

// Novo valor e novo repasse do atendimento ao (re)lancar: tira o que ja tinha
// sido lancado antes e soma o novo — nunca soma duas vezes.
export function aplicarNoAtendimento(
  valorAtual: number, repasseAtual: number,
  anterior: ExcedenteAplicado | null | undefined,
  novo: { total: number; repasse: number },
): { valor: number; repasse: number } {
  const valor = arred(Math.max(0, (valorAtual || 0) - (anterior?.total || 0) + novo.total))
  const repasse = arred(Math.max(0, (repasseAtual || 0) - (anterior?.repasse || 0) + novo.repasse))
  return { valor, repasse }
}
