'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type RotaOpcao = {
  id: string
  origem: string
  destino: string
  preco: number
  motorista_id: string | null
}

type MotoristaOpcao = {
  id: string
  nome: string
}

type Corrida = {
  id: string
  rota_id: string | null
  origem: string
  destino: string
  data_hora: string
  created_at: string
  cliente_nome: string
  cliente_telefone: string | null
  valor: number
  status: string
  motorista_id: string | null
  tipo_servico: string | null
  forma_pagamento: string | null
  status_pagamento: string | null
  valor_recebido: number | null
  observacoes: string | null
  motoristas_empresa: { nome: string } | null
}

type CorridaAgrupada =
  | { tipo: 'simples'; corrida: Corrida }
  | { tipo: 'par'; ida: Corrida; volta: Corrida }

type FormCorrida = {
  tipo_servico: string
  rota_id: string
  origem: string
  destino: string
  data: string
  horario: string
  ida_volta: boolean
  horario_retorno: string
  motorista_id: string
  cliente_nome: string
  cliente_telefone: string
  forma_pagamento: string
  status_pagamento: string
  valor_recebido: string
  preco: string
  observacoes: string
}

const FORM_VAZIO: FormCorrida = {
  tipo_servico: 'transfer',
  rota_id: '',
  origem: '',
  destino: '',
  data: '',
  horario: '',
  ida_volta: false,
  horario_retorno: '',
  motorista_id: '',
  cliente_nome: '',
  cliente_telefone: '',
  forma_pagamento: 'a_definir',
  status_pagamento: 'a_receber',
  valor_recebido: '',
  preco: '',
  observacoes: '',
}

const STATUS_COR: Record<string, { bg: string; text: string; label: string }> = {
  confirmada:             { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
  em_andamento:           { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
  concluida:              { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
  cancelada:              { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
  parcialmente_cancelada: { bg: '#FEF3C7', text: '#92400E', label: 'Parc. cancelada' },
}

function statusPar(ida: Corrida, volta: Corrida): string {
  if (ida.status === volta.status) return ida.status
  if (ida.status === 'cancelada' || volta.status === 'cancelada') return 'parcialmente_cancelada'
  return ida.status
}

// Duas corridas formam um par quando têm o mesmo cliente e foram criadas
// com menos de 30 segundos de diferença (ambas geradas pelo mesmo agendamento ida e volta).
function agruparPares(corridas: Corrida[]): CorridaAgrupada[] {
  const usados = new Set<string>()
  const resultado: CorridaAgrupada[] = []

  for (let i = 0; i < corridas.length; i++) {
    if (usados.has(corridas[i].id)) continue
    const a = corridas[i]
    let parIdx = -1

    for (let j = i + 1; j < corridas.length; j++) {
      if (usados.has(corridas[j].id)) continue
      const b = corridas[j]
      if (
        a.cliente_nome === b.cliente_nome &&
        Math.abs(
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ) < 30000
      ) {
        parIdx = j
        break
      }
    }

    if (parIdx !== -1) {
      const b = corridas[parIdx]
      usados.add(a.id)
      usados.add(b.id)
      const ida = a.data_hora <= b.data_hora ? a : b
      const volta = a.data_hora <= b.data_hora ? b : a
      resultado.push({ tipo: 'par', ida, volta })
    } else {
      usados.add(a.id)
      resultado.push({ tipo: 'simples', corrida: a })
    }
  }

  return resultado
}

export default function AgendamentosPage() {
  const searchParams = useSearchParams()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [rotasOpcoes, setRotasOpcoes] = useState<RotaOpcao[]>([])
  const [motoristasOpcoes, setMotoristasOpcoes] = useState<MotoristaOpcao[]>([])
  const [tipoOperacao, setTipoOperacao] = useState<string>('transfer')
  const [corridas, setCorridas] = useState<Corrida[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState<FormCorrida>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [rotaManualParaSalvar, setRotaManualParaSalvar] = useState<{
    origem: string
    destino: string
    preco: number
  } | null>(null)
  const [corridaEditando, setCorridaEditando] = useState<Corrida | null>(null)
  const [voltaIdEditando, setVoltaIdEditando] = useState<string | null>(null)

  useEffect(() => { carregarDados() }, [])

  useEffect(() => {
    if (!loading && searchParams.get('nova') === '1') {
      abrirNovaCorrida()
    }
  }, [loading, searchParams])

  async function carregarDados() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: gestor } = await supabase
      .from('gestores')
      .select('empresa_id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) return
    setEmpresaId(gestor.empresa_id)

    await supabase.from('corridas_empresa')
      .update({ status: 'concluida' })
      .eq('empresa_id', gestor.empresa_id)
      .eq('status', 'confirmada')
      .lt('data_hora', new Date().toISOString())

    const [{ data: empresa }, { data: rts }, { data: mots }, { data: corrds }] = await Promise.all([
      supabase
        .from('empresas')
        .select('tipo_operacao')
        .eq('id', gestor.empresa_id)
        .single(),
      supabase
        .from('rotas_empresa')
        .select('id, origem, destino, preco, motorista_id')
        .eq('empresa_id', gestor.empresa_id)
        .order('created_at'),
      supabase
        .from('motoristas_empresa')
        .select('id, nome')
        .eq('empresa_id', gestor.empresa_id)
        .eq('status', 'ativo')
        .order('nome'),
      supabase
        .from('corridas_empresa')
        .select('id, rota_id, origem, destino, data_hora, created_at, cliente_nome, cliente_telefone, valor, status, motorista_id, tipo_servico, forma_pagamento, status_pagamento, valor_recebido, observacoes, motoristas_empresa(nome)')
        .eq('empresa_id', gestor.empresa_id)
        .order('data_hora', { ascending: false })
        .limit(50),
    ])

    if (empresa) setTipoOperacao(empresa.tipo_operacao || 'transfer')
    if (rts) setRotasOpcoes(rts)
    if (mots) setMotoristasOpcoes(mots)
    if (corrds) setCorridas(corrds as any)
    setLoading(false)
  }

  function abrirNovaCorrida() {
    setCorridaEditando(null)
    setVoltaIdEditando(null)
    setForm(FORM_VAZIO)
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(c: Corrida, voltaId?: string) {
    const rotaExiste = c.rota_id != null && rotasOpcoes.some(r => r.id === c.rota_id)
    setCorridaEditando(c)
    setVoltaIdEditando(voltaId ?? null)
    setForm({
      tipo_servico: c.tipo_servico || 'transfer',
      rota_id: rotaExiste ? c.rota_id! : 'manual',
      origem: c.origem,
      destino: c.destino,
      data: c.data_hora.slice(0, 10),
      horario: c.data_hora.slice(11, 16),
      ida_volta: false,
      horario_retorno: '',
      motorista_id: c.motorista_id || '',
      cliente_nome: c.cliente_nome,
      cliente_telefone: c.cliente_telefone || '',
      forma_pagamento: c.forma_pagamento || 'a_definir',
      status_pagamento: c.status_pagamento || (c.status === 'concluida' ? 'recebido' : 'a_receber'),
      valor_recebido: c.valor_recebido != null ? String(c.valor_recebido) : '',
      preco: String(c.valor),
      observacoes: c.observacoes || '',
    })
    setErro('')
    setModalAberto(true)
  }

  function selecionarRota(rotaId: string) {
    if (rotaId === 'manual') {
      setForm(f => ({ ...f, rota_id: 'manual', origem: '', destino: '', preco: '' }))
      return
    }
    if (rotaId === '') {
      setForm(f => ({ ...f, rota_id: '', origem: '', destino: '', preco: '' }))
      return
    }
    const rota = rotasOpcoes.find(r => r.id === rotaId)
    if (rota) {
      setForm(f => ({
        ...f,
        rota_id: rotaId,
        origem: rota.origem,
        destino: rota.destino,
        preco: String(rota.preco),
      }))
    }
  }

  async function salvar() {
    if (!form.cliente_nome.trim()) { setErro('Nome do contratante é obrigatório'); return }
    if (!form.origem.trim() || !form.destino.trim()) { setErro('Origem e destino são obrigatórios'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    if (!form.horario) { setErro('Horário de saída é obrigatório'); return }
    const preco = parseFloat(form.preco)
    if (isNaN(preco) || preco < 0) { setErro('Preço inválido'); return }
    if (!empresaId) return

    setSalvando(true)
    setErro('')

    const valorRecebido = form.status_pagamento === 'recebido'
      ? preco
      : form.status_pagamento === 'parcial'
      ? (parseFloat(form.valor_recebido) || 0)
      : 0

    const camposComuns = {
      motorista_id: form.motorista_id || null,
      rota_id: form.rota_id && form.rota_id !== 'manual' ? form.rota_id : null,
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      cliente_nome: form.cliente_nome.trim(),
      cliente_telefone: form.cliente_telefone.trim() || null,
      valor: preco,
      tipo_servico: form.tipo_servico,
      forma_pagamento: form.forma_pagamento,
      status_pagamento: form.status_pagamento,
      valor_recebido: valorRecebido,
      observacoes: form.observacoes.trim() || null,
    }

    if (corridaEditando) {
      const { error } = await supabase
        .from('corridas_empresa')
        .update({ ...camposComuns, data_hora: `${form.data}T${form.horario}:00` })
        .eq('id', corridaEditando.id)

      if (error) {
        setErro('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }

      // Se editando um par, atualiza os campos compartilhados na corrida de volta
      if (voltaIdEditando) {
        const { error: erroVolta } = await supabase
          .from('corridas_empresa')
          .update({
            motorista_id: camposComuns.motorista_id,
            cliente_nome: camposComuns.cliente_nome,
            cliente_telefone: camposComuns.cliente_telefone,
            forma_pagamento: camposComuns.forma_pagamento,
          })
          .eq('id', voltaIdEditando)

        if (erroVolta) {
          setErro('Erro ao salvar corrida de volta: ' + erroVolta.message)
          setSalvando(false)
          return
        }
      }
    } else {
      const statusCorrida = form.status_pagamento === 'recebido' ? 'concluida' : 'confirmada'
      const base = { empresa_id: empresaId, status: statusCorrida, ...camposComuns }
      const registros: typeof base[] = [
        { ...base, data_hora: `${form.data}T${form.horario}:00` } as any,
      ]

      if (form.ida_volta && form.horario_retorno) {
        registros.push({
          ...base,
          data_hora: `${form.data}T${form.horario_retorno}:00`,
          origem: form.destino.trim(),
          destino: form.origem.trim(),
        } as any)
      }

      const { error } = await supabase.from('corridas_empresa').insert(registros)

      if (error) {
        setErro('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }

      if (form.rota_id === 'manual') {
        setRotaManualParaSalvar({ origem: form.origem.trim(), destino: form.destino.trim(), preco })
      }
    }

    setSalvando(false)
    setModalAberto(false)
    carregarDados()
  }

  async function salvarRotaManual() {
    if (!rotaManualParaSalvar || !empresaId) return
    await supabase.from('rotas_empresa').insert({
      empresa_id: empresaId,
      origem: rotaManualParaSalvar.origem,
      destino: rotaManualParaSalvar.destino,
      preco: rotaManualParaSalvar.preco,
    })
    setRotaManualParaSalvar(null)
    carregarDados()
  }

  async function cancelarCorrida(ids: string[]) {
    for (const id of ids) {
      await supabase.from('corridas_empresa').update({ status: 'cancelada' }).eq('id', id)
    }
    setCorridas(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: 'cancelada' } : c))
  }

  async function apagarCorrida(ids: string[]) {
    if (!confirm('Tem certeza que deseja apagar este agendamento?')) return
    for (const id of ids) {
      await supabase.from('corridas_empresa').delete().eq('id', id)
    }
    setCorridas(prev => prev.filter(c => !ids.includes(c.id)))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-pulse">🚐</div>
      </div>
    )
  }

  const corridasAgrupadas = agruparPares(corridas)
  const eAtivo = (s: string) => s !== 'cancelada' && s !== 'concluida'
  const qtdAtivas = corridasAgrupadas.filter(g =>
    g.tipo === 'simples'
      ? eAtivo(g.corrida.status)
      : eAtivo(g.ida.status) || eAtivo(g.volta.status)
  ).length

  const rotaManual = form.rota_id === 'manual'
  const camposRotaBloqueados = form.rota_id !== '' && form.rota_id !== 'manual'

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Agendamentos</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">
            {qtdAtivas} ativa{qtdAtivas !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {/* Banner salvar rota manual */}
        {rotaManualParaSalvar && (
          <div className="rounded-xl p-4 border" style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#085041' }}>
              Deseja salvar essa rota para usar novamente?
            </p>
            <p className="text-xs mb-3" style={{ color: '#0F6E56' }}>
              {rotaManualParaSalvar.origem} → {rotaManualParaSalvar.destino} · R$ {rotaManualParaSalvar.preco.toFixed(2).replace('.', ',')}
            </p>
            <div className="flex gap-2">
              <button onClick={salvarRotaManual}
                className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{ background: '#0F6E56', color: '#fff' }}>
                Sim, salvar rota
              </button>
              <button onClick={() => setRotaManualParaSalvar(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200"
                style={{ background: '#fff', color: '#6B7280' }}>
                Não obrigado
              </button>
            </div>
          </div>
        )}

        {/* Botão nova corrida */}
        <button onClick={abrirNovaCorrida}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#1D9E75', color: '#fff' }}>
          + Nova corrida
        </button>

        {/* Lista de corridas */}
        {corridas.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm text-gray-500">Nenhum agendamento ainda.</p>
            <p className="text-xs text-gray-400 mt-1">Toque em "+ Nova corrida" para começar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {corridasAgrupadas.map(grupo => {

              /* ── Card simples ── */
              if (grupo.tipo === 'simples') {
                const c = grupo.corrida
                const cor = STATUS_COR[c.status] ?? STATUS_COR.confirmada
                const nomeMotorista = c.motoristas_empresa?.nome ?? null
                return (
                  <div key={c.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {c.origem} → {c.destino}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.data_hora.slice(8, 10)}/{c.data_hora.slice(5, 7)}/{c.data_hora.slice(0, 4)} às {c.data_hora.slice(11, 16)}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: cor.bg, color: cor.text }}>
                        {cor.label}
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2"
                      style={{ borderTop: '1px solid #f5f5f5', paddingTop: '8px' }}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{c.cliente_nome}</p>
                        {nomeMotorista && (
                          <p className="text-xs text-gray-400 mt-0.5">🚐 {nomeMotorista}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                          R$ {Number(c.valor).toFixed(2).replace('.', ',')}
                        </p>
                        {eAtivo(c.status) && (
                          <button onClick={() => abrirEditar(c)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                            ✏️
                          </button>
                        )}
                        {c.status === 'confirmada' && (
                          <button onClick={() => cancelarCorrida([c.id])}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                            Cancelar
                          </button>
                        )}
                        {c.status === 'cancelada' && (
                          <button onClick={() => apagarCorrida([c.id])}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }

              /* ── Card par ida e volta ── */
              const { ida, volta } = grupo
              const statusKey = statusPar(ida, volta)
              const cor = STATUS_COR[statusKey] ?? STATUS_COR.confirmada
              const valorTotal = Number(ida.valor) + Number(volta.valor)
              const nomeMotorista = ida.motoristas_empresa?.nome ?? volta.motoristas_empresa?.nome ?? null
              const idsCancelar = [ida, volta].filter(c => c.status === 'confirmada').map(c => c.id)

              return (
                <div key={`${ida.id}-${volta.id}`} className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {ida.origem} → {ida.destino}
                        </p>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                          ↔ Ida e volta
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ida {ida.data_hora.slice(11, 16)} · Volta {volta.data_hora.slice(11, 16)} · {ida.data_hora.slice(8, 10)}/{ida.data_hora.slice(5, 7)}/{ida.data_hora.slice(0, 4)}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                      style={{ background: cor.bg, color: cor.text }}>
                      {cor.label}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2"
                    style={{ borderTop: '1px solid #f5f5f5', paddingTop: '8px' }}>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{ida.cliente_nome}</p>
                      {nomeMotorista && (
                        <p className="text-xs text-gray-400 mt-0.5">🚐 {nomeMotorista}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                        R$ {valorTotal.toFixed(2).replace('.', ',')}
                      </p>
                      {eAtivo(ida.status) && (
                        <button onClick={() => abrirEditar(ida, volta.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                          ✏️
                        </button>
                      )}
                      {idsCancelar.length > 0 && (
                        <button onClick={() => cancelarCorrida(idsCancelar)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                          Cancelar
                        </button>
                      )}
                      {statusKey === 'cancelada' && (
                        <button onClick={() => apagarCorrida([ida.id, volta.id])}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal formulário nova/editar corrida */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
              {corridaEditando ? 'Editar corrida' : 'Nova corrida'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 flex flex-col gap-3">

            <Campo label="Tipo de serviço">
              <select value={form.tipo_servico}
                onChange={e => setForm(f => ({ ...f, tipo_servico: e.target.value }))}
                className="campo-input">
                <option value="transfer">Transfer</option>
                <option value="city_tour">City Tour</option>
              </select>
            </Campo>

            <Campo label="Rota">
              <select value={form.rota_id} onChange={e => selecionarRota(e.target.value)} className="campo-input">
                <option value="">Selecione uma rota...</option>
                {rotasOpcoes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.origem} → {r.destino} — R$ {Number(r.preco).toFixed(2).replace('.', ',')}
                  </option>
                ))}
                <option value="manual">✏️ Outra rota (digitar manualmente)</option>
              </select>
            </Campo>

            <Campo label="Origem *">
              <input
                value={form.origem}
                onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
                readOnly={camposRotaBloqueados}
                placeholder="Ex: Aeroporto Internacional"
                className="campo-input"
                style={{
                  background: camposRotaBloqueados ? '#f9fafb' : '#fff',
                  color: camposRotaBloqueados ? '#6B7280' : '#222',
                }}
              />
            </Campo>

            <Campo label="Destino *">
              <input
                value={form.destino}
                onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                readOnly={camposRotaBloqueados}
                placeholder="Ex: Hotel Tropical"
                className="campo-input"
                style={{
                  background: camposRotaBloqueados ? '#f9fafb' : '#fff',
                  color: camposRotaBloqueados ? '#6B7280' : '#222',
                }}
              />
            </Campo>

            <div className="grid grid-cols-2 gap-2">
              <Campo label="Data *">
                <input type="date" value={form.data}
                  onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  className="campo-input" />
              </Campo>
              <Campo label="Horário de saída *">
                <input type="time" value={form.horario}
                  onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
                  className="campo-input" />
              </Campo>
            </div>

            {!corridaEditando && (
              <div className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Ida e volta?</p>
                  <p className="text-xs text-gray-400 mt-0.5">Cria dois agendamentos automaticamente</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, ida_volta: !f.ida_volta, horario_retorno: '' }))}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ background: form.ida_volta ? '#1D9E75' : '#e5e7eb' }}>
                  <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ left: form.ida_volta ? '22px' : '2px' }} />
                </button>
              </div>
            )}

            {!corridaEditando && form.ida_volta && (
              <Campo label="Horário de retorno">
                <input type="time" value={form.horario_retorno}
                  onChange={e => setForm(f => ({ ...f, horario_retorno: e.target.value }))}
                  className="campo-input" />
              </Campo>
            )}

            <Campo label="Motorista">
              <select value={form.motorista_id}
                onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))}
                className="campo-input">
                <option value="">A definir</option>
                {motoristasOpcoes.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Nome do contratante *">
              <input value={form.cliente_nome}
                onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
                placeholder="Nome completo" className="campo-input" />
            </Campo>

            <Campo label="Telefone do contratante">
              <input value={form.cliente_telefone}
                onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))}
                placeholder="(XX) XXXXX-XXXX" className="campo-input" />
            </Campo>

            <Campo label="Forma de pagamento">
              <select value={form.forma_pagamento}
                onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                className="campo-input">
                <option value="a_definir">A definir</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
              </select>
            </Campo>

            <Campo label="Status do pagamento">
              <select value={form.status_pagamento}
                onChange={e => setForm(f => ({ ...f, status_pagamento: e.target.value, valor_recebido: '' }))}
                className="campo-input">
                <option value="a_receber">A receber</option>
                <option value="parcial">Recebido parcialmente</option>
                <option value="recebido">Recebido</option>
              </select>
            </Campo>

            {form.status_pagamento === 'parcial' && (
              <Campo label="Valor recebido (R$)">
                <input type="number" step="0.01" min={0}
                  value={form.valor_recebido}
                  onChange={e => setForm(f => ({ ...f, valor_recebido: e.target.value }))}
                  placeholder="0,00" className="campo-input" />
              </Campo>
            )}

            <Campo label="Preço (R$) *">
              <input type="number" step="0.01" min={0} value={form.preco}
                onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                placeholder="0,00" className="campo-input" />
            </Campo>

            <Campo label="Observações">
              <textarea value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Informações adicionais, ponto de encontro, etc."
                className="campo-input"
                rows={3}
                style={{ resize: 'none' }} />
            </Campo>

            {erro && (
              <div className="rounded-xl px-4 py-3 text-sm border"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                ⚠️ {erro}
              </div>
            )}

            {rotaManual && !corridaEditando && (
              <div className="rounded-xl px-4 py-3 text-xs"
                style={{ background: '#FAEEDA', color: '#854F0B' }}>
                💡 Rota manual: após confirmar, você poderá salvar essa rota para usar novamente.
              </div>
            )}

            <button onClick={salvar} disabled={salvando}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-1 mb-6 disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvando
                ? 'Salvando...'
                : corridaEditando
                  ? 'Salvar alterações'
                  : form.ida_volta
                    ? '✓ Confirmar corrida (ida + volta)'
                    : '✓ Confirmar corrida'}
            </button>
          </div>

          <style jsx>{`
            .campo-input {
              width: 100%; padding: 10px 12px; border-radius: 12px;
              border: 1px solid #e5e7eb; font-size: 14px; color: #222;
              background: #fff; outline: none;
            }
            .campo-input:focus { border-color: #1D9E75; }
          `}</style>
        </div>
      )}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  )
}
