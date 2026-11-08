// Calculo da correcao de um pagamento que a baixa por cliente distribuiu entre
// varios itens (passagens fiadas ou encomendas). Sem acesso ao banco, pra poder
// ser testado isolado. Quem grava e o ModalPagamento em
// app/dashboard/financeiro/page.tsx.

export type ItemCobranca = { id: string; valor: number; pago: number }
export type MudancaItem = { id: string; novoPago: number; quitado: boolean }

const arred = (v: number) => parseFloat(v.toFixed(2))

// `itens` na ordem em que a baixa distribui: mais antigo primeiro.
//   delta < 0: devolve |delta| ao saldo, tirando primeiro do item pago mais
//              recente (ordem inversa da baixa).
//   delta > 0: aplica delta como uma baixa, quitando do mais antigo.
// Devolve so os itens que mudam. Se o delta passar do que existe pra mexer,
// para no limite (nunca deixa pago < 0 nem pago > valor).
export function planejarAjuste(itens: ItemCobranca[], delta: number): MudancaItem[] {
  const devolvendo = delta < 0
  const mudancas: MudancaItem[] = []
  let restante = arred(Math.abs(delta))
  for (const it of devolvendo ? [...itens].reverse() : itens) {
    if (restante <= 0.001) break
    const disponivel = devolvendo ? it.pago : it.valor - it.pago
    const mexe = arred(Math.min(Math.max(0, disponivel), restante))
    if (mexe <= 0.001) continue
    restante = arred(restante - mexe)
    const novoPago = arred(devolvendo ? it.pago - mexe : it.pago + mexe)
    mudancas.push({ id: it.id, novoPago, quitado: novoPago >= it.valor - 0.001 })
  }
  return mudancas
}
