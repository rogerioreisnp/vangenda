'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { getMotoristaIdSalvar } from '@/lib/motorista-salvar'

export default function ModalNovoFretamento({ onFechar, onSalvo, dataSelecionada }: {
  onFechar: () => void
  onSalvo: () => void
  dataSelecionada?: Date
}) {
  const dataDefault = dataSelecionada ? format(dataSelecionada, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({
    cliente_nome: '', telefone: '',
    origem: '', destino: '',
    data_saida: dataDefault, horario_saida: '', horario_retorno_estimado: '',
    quantidade_pessoas: '', valor: '', observacao: '',
    status_pagamento: 'a_receber' as 'a_receber' | 'pago',
    forma_pagamento: 'dinheiro',
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vangenda_form_fretamento')
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved) setForm(f => ({ ...f, ...saved }))
      }
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('vangenda_form_fretamento', JSON.stringify(form)) } catch {}
  }, [form])

  function fechar() {
    localStorage.removeItem('vangenda_form_fretamento')
    onFechar()
  }

  async function salvar() {
    if (!form.cliente_nome.trim() || !form.origem.trim() || !form.destino.trim() || !form.valor) {
      setErro('Cliente, origem, destino e valor são obrigatórios.')
      return
    }
    setSaving(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErro('Não autenticado.'); setSaving(false); return }

    const valor = parseFloat(form.valor)
    const qtd = form.quantidade_pessoas ? parseInt(form.quantidade_pessoas) : null

    const { data: novoFret, error } = await supabase.from('fretamentos').insert({
      motorista_id: await getMotoristaIdSalvar(user.id),
      cliente_nome: form.cliente_nome.trim(),
      telefone: form.telefone.trim() || null,
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      data_saida: form.data_saida,
      horario_saida: form.horario_saida || null,
      horario_retorno_estimado: form.horario_retorno_estimado || null,
      quantidade_pessoas: qtd,
      valor,
      observacao: form.observacao.trim() || null,
      status_pagamento: form.status_pagamento,
      forma_pagamento: form.status_pagamento === 'pago' ? form.forma_pagamento : null,
      status: 'agendado',
    }).select('id').single()

    if (error) { setErro('Erro: ' + error.message); setSaving(false); return }

    const dataFmt = new Date(form.data_saida + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const info = [dataFmt, form.horario_saida].filter(Boolean).join(' às ')
    const descBase = `Fretamento ${form.origem.trim()} → ${form.destino.trim()} - ${info}`
    const descFinal = descBase + (form.observacao.trim() ? ': ' + form.observacao.trim() : '')

    if (form.status_pagamento === 'a_receber' && novoFret) {
      await supabase.from('movimentacoes').insert({
        motorista_id: await getMotoristaIdSalvar(user.id),
        cliente_nome: form.cliente_nome.trim(),
        tipo: 'divida',
        valor,
        descricao: descFinal,
        categoria: 'fretamento',
        referencia_id: novoFret.id,
      })
    }
    setSaving(false)
    localStorage.removeItem('vangenda_form_fretamento')
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full bg-white rounded-t-2xl p-6 pb-16 flex flex-col gap-4" style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">🚌 Novo fretamento</p>
          <button onClick={fechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Cliente / grupo contratante *</p>
          <input value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
            placeholder="Ex: Igreja São José, Escola XYZ"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Telefone do responsável (opcional)</p>
          <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
            placeholder="(95) 99999-9999" type="tel"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Origem *</p>
          <input value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
            placeholder="Ex: Igreja Centro"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Destino *</p>
          <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
            placeholder="Ex: Sítio para reunião"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Data *</p>
            <input type="date" value={form.data_saida}
              onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Saída</p>
            <input type="time" value={form.horario_saida}
              onChange={e => setForm(f => ({ ...f, horario_saida: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Retorno</p>
            <input type="time" value={form.horario_retorno_estimado}
              onChange={e => setForm(f => ({ ...f, horario_retorno_estimado: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Qtd. pessoas (opcional)</p>
            <input value={form.quantidade_pessoas} onChange={e => setForm(f => ({ ...f, quantidade_pessoas: e.target.value.replace(/\D/g, '') }))}
              placeholder="Ex: 25" inputMode="numeric"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Valor combinado (R$) *</p>
            <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              placeholder="0,00" type="number" step="0.01"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Observação (opcional)</p>
          <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
            placeholder="Ex: buscar no portão principal, café da manhã incluso, aguardar 3h no local"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white resize-none focus:border-green-600" />
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Status do pagamento</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'a_receber', label: '📝 A receber' },
              { value: 'pago', label: '✅ Pago' },
            ] as const).map(s => (
              <button key={s.value} onClick={() => setForm(f => ({ ...f, status_pagamento: s.value }))}
                className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={form.status_pagamento === s.value
                  ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                  : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {form.status_pagamento === 'pago' && (
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

        <button onClick={salvar} disabled={saving || !form.cliente_nome || !form.origem || !form.destino || !form.valor}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : '✓ Registrar fretamento'}
        </button>
      </div>
    </div>
  )
}
