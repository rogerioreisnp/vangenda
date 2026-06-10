'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ModalNovaEncomenda({ onFechar, onSalvo, nomeInicial, telefoneInicial }: {
  onFechar: () => void
  onSalvo: () => void
  nomeInicial?: string
  telefoneInicial?: string
}) {
  const [form, setForm] = useState({
    nome: nomeInicial ?? '', telefone: telefoneInicial ?? '', valor: '', observacao: '',
    status: 'fiado' as 'fiado' | 'pago_na_hora',
    forma_pagamento: 'dinheiro',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!form.nome.trim() || !form.valor) { setErro('Nome e valor são obrigatórios.'); return }
    setSaving(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Não autenticado.'); setSaving(false); return }

    const valor = parseFloat(form.valor)
    const pago = form.status === 'pago_na_hora'

    const { data: novaEnc, error } = await supabase.from('encomendas').insert({
      motorista_id: user.id,
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      valor,
      observacao: form.observacao.trim() || null,
      pago,
      valor_pago: pago ? valor : 0,
      forma_pagamento: pago ? form.forma_pagamento : null,
    }).select('id').single()

    if (error) { setErro('Erro: ' + error.message); setSaving(false); return }
    if (!pago && novaEnc) {
      await supabase.from('movimentacoes').insert({
        motorista_id: user.id,
        cliente_nome: form.nome.trim(),
        tipo: 'divida',
        valor,
        descricao: 'Encomenda' + (form.observacao.trim() ? ': ' + form.observacao.trim() : ''),
        categoria: 'encomenda',
        referencia_id: novaEnc.id,
      })
    }
    setSaving(false)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4" style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Nova encomenda</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Nome de quem pediu *</p>
          <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Ex: João Silva"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Telefone (opcional)</p>
          <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
            placeholder="(95) 99999-9999" type="tel"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Valor do frete (R$) *</p>
          <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
            placeholder="0,00" type="number" step="0.01"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Observação (opcional)</p>
          <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
            placeholder="Ex: buscar correio capital, caixa azul, dia 15"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white resize-none focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Status do pagamento</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'fiado', label: '📝 Fiado' },
              { value: 'pago_na_hora', label: '✅ Pago na hora' },
            ] as const).map(s => (
              <button key={s.value} onClick={() => setForm(f => ({ ...f, status: s.value }))}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={form.status === s.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {form.status === 'pago_na_hora' && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Forma de recebimento</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'dinheiro', label: '💵 Dinheiro' },
                { value: 'pix', label: '📱 Pix' },
              ] as const).map(f => (
                <button key={f.value} onClick={() => setForm(prev => ({ ...prev, forma_pagamento: f.value }))}
                  className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                  style={form.forma_pagamento === f.value
                    ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                    : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {erro && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}

        <button onClick={salvar} disabled={saving || !form.nome || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : '✓ Registrar encomenda'}
        </button>
      </div>
    </div>
  )
}
