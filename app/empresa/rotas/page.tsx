'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type MotoristaOpcao = {
  id: string
  nome: string
}

type Rota = {
  id: string
  origem: string
  destino: string
  distancia_km: number | null
  preco: number
  motorista_id: string | null
  veiculo_placa: string | null
}

type FormRota = {
  origem: string
  destino: string
  distancia_km: string
  preco: string
  motorista_id: string
  veiculo_placa: string
}

type RotaRF = {
  id: string
  nome: string | null
  horario_ida: string | null
  horario_volta: string | null
  capacidade: number | null
  motorista_id: string | null
  veiculo_placa: string | null
  ativa: boolean
  dias_semana: number[] | null
}

type PrecoRF = {
  origem: string
  destino: string
  valor: string
}

type FormRotaRF = {
  nome: string
  horario_ida: string
  horario_volta: string
  capacidade: string
  motorista_id: string
  veiculo_placa: string
  ativa: boolean
  dias_semana: number[]
}

export default function RotasPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [rotas, setRotas] = useState<Rota[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Rota | null>(null)
  const [form, setForm] = useState<FormRota>({ origem: '', destino: '', distancia_km: '', preco: '', motorista_id: '', veiculo_placa: '' })
  const [motoristasOpcoes, setMotoristasOpcoes] = useState<MotoristaOpcao[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // rota_fixa state
  const [tipoOperacao, setTipoOperacao] = useState<string>('transfer')
  const [rotasRF, setRotasRF] = useState<RotaRF[]>([])
  const [modalRFAberto, setModalRFAberto] = useState(false)
  const [rotaRFEditando, setRotaRFEditando] = useState<RotaRF | null>(null)
  const [formRF, setFormRF] = useState<FormRotaRF>({
    nome: '', horario_ida: '05:00', horario_volta: '14:00',
    capacidade: '15', motorista_id: '', veiculo_placa: '',
    ativa: true, dias_semana: [1, 2, 3, 4, 5],
  })
  const [paradasRF, setParadasRF] = useState<string[]>([])
  const [precosRF, setPrecosRF] = useState<PrecoRF[]>([])
  const [novaParadaRF, setNovaParadaRF] = useState('')
  const [draggingIdxRF, setDraggingIdxRF] = useState<number | null>(null)
  const [salvandoRF, setSalvandoRF] = useState(false)
  const [erroRF, setErroRF] = useState('')
  const dragIdxRF = useRef<number | null>(null)

  useEffect(() => { carregarDados() }, [])

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

    const [{ data: empresa }, { data: rts }, { data: mots }] = await Promise.all([
      supabase
        .from('empresas')
        .select('tipo_operacao')
        .eq('id', gestor.empresa_id)
        .single(),
      supabase
        .from('rotas_empresa')
        .select('id, origem, destino, distancia_km, preco, motorista_id, veiculo_placa, nome, horario_ida, horario_volta, capacidade, ativa, dias_semana')
        .eq('empresa_id', gestor.empresa_id)
        .order('created_at'),
      supabase
        .from('motoristas_empresa')
        .select('id, nome')
        .eq('empresa_id', gestor.empresa_id)
        .eq('status', 'ativo')
        .order('nome'),
    ])

    const tp = empresa?.tipo_operacao || 'transfer'
    setTipoOperacao(tp)
    if (tp === 'rota_fixa') {
      if (rts) setRotasRF(rts as any)
    } else {
      if (rts) setRotas(rts)
    }
    if (mots) setMotoristasOpcoes(mots)
    setLoading(false)
  }

  function abrirAdicionar() {
    setEditando(null)
    setForm({ origem: '', destino: '', distancia_km: '', preco: '', motorista_id: '', veiculo_placa: '' })
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(r: Rota) {
    setEditando(r)
    setForm({
      origem: r.origem,
      destino: r.destino,
      distancia_km: r.distancia_km != null ? String(r.distancia_km) : '',
      preco: r.preco ? String(r.preco) : '',
      motorista_id: r.motorista_id || '',
      veiculo_placa: r.veiculo_placa || '',
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.origem.trim() || !form.destino.trim()) {
      setErro('Origem e destino são obrigatórios')
      return
    }
    // Preco e opcional: muitos gestores negociam valor por cliente, nao por
    // rota, e nesse caso o preco nao deve aparecer pro cliente no link
    // publico. Deixando em branco, salva 0 e a exibicao do valor fica oculta.
    const precoNum = form.preco.trim() ? parseFloat(form.preco) : 0
    if (isNaN(precoNum) || precoNum < 0) {
      setErro('Preço inválido')
      return
    }
    if (!empresaId) return
    setSalvando(true)
    setErro('')

    const payload = {
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      distancia_km: form.distancia_km.trim() ? parseInt(form.distancia_km) || null : null,
      preco: precoNum,
      motorista_id: form.motorista_id || null,
      veiculo_placa: form.veiculo_placa.trim() || null,
    }

    if (editando) {
      const { error } = await supabase
        .from('rotas_empresa')
        .update(payload)
        .eq('id', editando.id)

      if (error) {
        setErro('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('rotas_empresa')
        .insert({ ...payload, empresa_id: empresaId })

      if (error) {
        setErro('Erro ao adicionar: ' + error.message)
        setSalvando(false)
        return
      }
    }

    setSalvando(false)
    setModalAberto(false)
    carregarDados()
  }

  async function excluir(id: string) {
    await supabase.from('rotas_empresa').delete().eq('id', id)
    setRotas(prev => prev.filter(r => r.id !== id))
  }

  // ── rota_fixa functions ──

  function abrirAdicionarRF() {
    setRotaRFEditando(null)
    setFormRF({ nome: '', horario_ida: '05:00', horario_volta: '14:00', capacidade: '15', motorista_id: '', veiculo_placa: '', ativa: true, dias_semana: [1, 2, 3, 4, 5] })
    setParadasRF([])
    setPrecosRF([])
    setNovaParadaRF('')
    setErroRF('')
    setModalRFAberto(true)
  }

  async function abrirEditarRF(r: RotaRF) {
    setRotaRFEditando(r)
    setFormRF({
      nome: r.nome || '',
      horario_ida: r.horario_ida?.slice(0, 5) || '05:00',
      horario_volta: r.horario_volta?.slice(0, 5) || '14:00',
      capacidade: r.capacidade != null ? String(r.capacidade) : '15',
      motorista_id: r.motorista_id || '',
      veiculo_placa: r.veiculo_placa || '',
      ativa: r.ativa ?? true,
      dias_semana: (r.dias_semana ?? [1, 2, 3, 4, 5]).map(Number),
    })
    const { data: trechos } = await supabase
      .from('paradas_empresa')
      .select('nome, ordem, preco')
      .eq('rota_id', r.id)
      .order('ordem')
    const rows = trechos || []
    const stopSet = new Set<string>()
    const stops: string[] = []
    rows.forEach(t => {
      const parts = (t.nome as string).split(' → ')
      if (parts.length === 2) {
        if (!stopSet.has(parts[0])) { stopSet.add(parts[0]); stops.push(parts[0]) }
        if (!stopSet.has(parts[1])) { stopSet.add(parts[1]); stops.push(parts[1]) }
      }
    })
    setParadasRF(stops)
    setPrecosRF(rows.map(t => {
      const parts = (t.nome as string).split(' → ')
      return { origem: parts[0] || '', destino: parts[1] || '', valor: String(t.preco ?? 0) }
    }))
    setNovaParadaRF('')
    setErroRF('')
    setModalRFAberto(true)
  }

  async function salvarRF() {
    if (!formRF.nome.trim()) { setErroRF('Nome da rota é obrigatório'); return }
    if (!empresaId) return
    setSalvandoRF(true)
    setErroRF('')

    const payload = {
      nome: formRF.nome.trim(),
      horario_ida: formRF.horario_ida || null,
      horario_volta: formRF.horario_volta || null,
      capacidade: parseInt(formRF.capacidade) || null,
      motorista_id: formRF.motorista_id || null,
      veiculo_placa: formRF.veiculo_placa.trim() || null,
      ativa: formRF.ativa,
      dias_semana: Array.from(new Set(formRF.dias_semana.map(Number))),
    }

    let rotaId: string
    if (rotaRFEditando) {
      const { error, data: updated } = await supabase
        .from('rotas_empresa')
        .update(payload)
        .eq('id', rotaRFEditando.id)
        .eq('empresa_id', empresaId)
        .select('id')
      if (error) { setErroRF('Erro ao salvar: ' + error.message); setSalvandoRF(false); return }
      if (!updated || updated.length === 0) {
        setErroRF('Não foi possível salvar. Recarregue a página e tente novamente.')
        setSalvandoRF(false)
        return
      }
      rotaId = rotaRFEditando.id
    } else {
      const { data, error } = await supabase.from('rotas_empresa').insert({ ...payload, empresa_id: empresaId }).select('id').single()
      if (error || !data) { setErroRF('Erro ao criar rota: ' + (error?.message || '')); setSalvandoRF(false); return }
      rotaId = data.id
    }

    await supabase.from('paradas_empresa').delete().eq('rota_id', rotaId)
    if (precosRF.length > 0) {
      const { error: erroP } = await supabase.from('paradas_empresa').insert(
        precosRF.map((p, i) => ({
          rota_id: rotaId,
          empresa_id: empresaId,
          nome: `${p.origem} → ${p.destino}`,
          ordem: i,
          preco: parseFloat(p.valor) || 0,
        }))
      )
      if (erroP) { setErroRF('Erro ao salvar trechos: ' + erroP.message); setSalvandoRF(false); return }
    }

    setSalvandoRF(false)
    setModalRFAberto(false)
    carregarDados()
  }

  async function excluirRF(id: string) {
    if (!confirm('Excluir esta rota e todas as suas paradas?')) return
    await supabase.from('paradas_empresa').delete().eq('rota_id', id)
    await supabase.from('rotas_empresa').delete().eq('id', id)
    setRotasRF(prev => prev.filter(r => r.id !== id))
  }

  function gerarPrecosRF(pars: string[], base?: PrecoRF[]) {
    const baseRef = base ?? precosRF
    const novos: PrecoRF[] = []
    for (let i = 0; i < pars.length; i++) {
      for (let j = i + 1; j < pars.length; j++) {
        const existeIda = baseRef.find(p => p.origem === pars[i] && p.destino === pars[j])
        novos.push({ origem: pars[i], destino: pars[j], valor: existeIda?.valor || '0' })
        const existeVolta = baseRef.find(p => p.origem === pars[j] && p.destino === pars[i])
        novos.push({ origem: pars[j], destino: pars[i], valor: existeVolta?.valor ?? existeIda?.valor ?? '0' })
      }
    }
    setPrecosRF(novos)
  }

  function adicionarParadaRF() {
    if (!novaParadaRF.trim()) return
    const novas = [...paradasRF, novaParadaRF.trim()]
    setParadasRF(novas)
    gerarPrecosRF(novas)
    setNovaParadaRF('')
  }

  function removerParadaRF(idx: number) {
    const novas = paradasRF.filter((_, i) => i !== idx)
    setParadasRF(novas)
    gerarPrecosRF(novas)
  }

  function onDragStartRF(idx: number) {
    dragIdxRF.current = idx
    setDraggingIdxRF(idx)
  }

  function onDragEnterRF(idx: number) {
    if (dragIdxRF.current === null || dragIdxRF.current === idx) return
    const novas = [...paradasRF]
    const item = novas.splice(dragIdxRF.current, 1)[0]
    novas.splice(idx, 0, item)
    dragIdxRF.current = idx
    setDraggingIdxRF(idx)
    setParadasRF(novas)
  }

  function onDragEndRF() {
    dragIdxRF.current = null
    setDraggingIdxRF(null)
  }

  function handleTouchStartRF(e: React.TouchEvent, idx: number) {
    e.preventDefault()
    dragIdxRF.current = idx
    setDraggingIdxRF(idx)
    let current = [...paradasRF]
    let currentIdx = idx

    function move(ev: TouchEvent) {
      ev.preventDefault()
      const touch = ev.touches[0]
      const el = document.elementFromPoint(touch.clientX, touch.clientY)
      if (!el) return
      const itemEl = el.closest('[data-drag-rf]') as HTMLElement
      if (!itemEl) return
      const newIdx = parseInt(itemEl.dataset.dragRf ?? '-1')
      if (isNaN(newIdx) || newIdx < 0 || newIdx === currentIdx) return
      const novas = [...current]
      const moved = novas.splice(currentIdx, 1)[0]
      novas.splice(newIdx, 0, moved)
      currentIdx = newIdx
      current = novas
      dragIdxRF.current = newIdx
      setDraggingIdxRF(newIdx)
      setParadasRF(novas)
    }

    function end() {
      dragIdxRF.current = null
      setDraggingIdxRF(null)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
    }

    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse">
          <svg width="64" height="64" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
            <rect width="192" height="192" rx="42" fill="#04342C"/>
            <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
            <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
            <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
            <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    )
  }

  if (tipoOperacao === 'rota_fixa') {
    return (
      <div>
        <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
          <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
          <div>
            <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Rotas</p>
            <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">
              {rotasRF.length} rota{rotasRF.length !== 1 ? 's' : ''} cadastrada{rotasRF.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="px-4 py-4 flex flex-col gap-3 pb-20">
          <button onClick={abrirAdicionarRF}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#1D9E75', color: '#fff' }}>
            + Nova rota
          </button>

          {rotasRF.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <p className="text-3xl mb-2">🛣️</p>
              <p className="text-sm text-gray-500">Nenhuma rota cadastrada ainda.</p>
              <p className="text-xs text-gray-400 mt-1">Adicione as rotas com paradas e preços por trecho.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rotasRF.map(r => {
                const mot = motoristasOpcoes.find(m => m.id === r.motorista_id)
                return (
                  <div key={r.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">{r.nome || 'Sem nome'}</p>
                          {!r.ativa && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: '#F3F4F6', color: '#6B7280' }}>Inativa</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.horario_ida?.slice(0, 5)} → {r.horario_volta?.slice(0, 5)}
                          {r.capacidade ? ` · ${r.capacidade} lugares` : ''}
                        </p>
                        {mot && <p className="text-xs text-gray-400 mt-0.5">🚗 {mot.nome}</p>}
                        {r.veiculo_placa && <p className="text-xs text-gray-400">{r.veiculo_placa}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => abrirEditarRF(r)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                          Editar
                        </button>
                        <button onClick={() => excluirRF(r.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {modalRFAberto && (
          <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
            <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setModalRFAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
                {rotaRFEditando ? 'Editar rota' : 'Nova rota'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 flex flex-col gap-4">

              {/* Dados da rota */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-sm font-semibold text-gray-700">🛣️ Dados da rota</p>

                <Campo label="Nome da rota *">
                  <input value={formRF.nome} onChange={e => setFormRF(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: São Paulo → Campinas" className="campo-input" />
                </Campo>

                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Saída ida">
                    <input type="time" value={formRF.horario_ida}
                      onChange={e => setFormRF(f => ({ ...f, horario_ida: e.target.value }))}
                      className="campo-input" />
                  </Campo>
                  <Campo label="Saída volta">
                    <input type="time" value={formRF.horario_volta}
                      onChange={e => setFormRF(f => ({ ...f, horario_volta: e.target.value }))}
                      className="campo-input" />
                  </Campo>
                </div>

                <Campo label="Capacidade (passageiros)">
                  <input type="number" value={formRF.capacidade}
                    onChange={e => setFormRF(f => ({ ...f, capacidade: e.target.value }))}
                    placeholder="Ex: 15" className="campo-input" min={1} />
                </Campo>

                <Campo label="Motorista">
                  <select value={formRF.motorista_id}
                    onChange={e => setFormRF(f => ({ ...f, motorista_id: e.target.value }))}
                    className="campo-input">
                    <option value="">A definir</option>
                    {motoristasOpcoes.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </Campo>

                <Campo label="Placa do veículo">
                  <input value={formRF.veiculo_placa}
                    onChange={e => setFormRF(f => ({ ...f, veiculo_placa: e.target.value }))}
                    placeholder="Ex: ABC-1234" className="campo-input" />
                </Campo>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Dias de operação</p>
                  <div className="grid grid-cols-7 gap-1">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, i) => {
                      const ativo = formRF.dias_semana.includes(i)
                      return (
                        <button key={i} type="button"
                          onClick={() => setFormRF(f => ({
                            ...f,
                            dias_semana: ativo
                              ? f.dias_semana.filter(d => d !== i)
                              : [...f.dias_semana, i].sort((a, b) => a - b),
                          }))}
                          className="py-2 rounded-xl text-xs font-semibold border transition-all"
                          style={ativo
                            ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                            : { background: '#fff', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                          {dia}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <p className="text-sm font-medium text-gray-700">Rota ativa</p>
                  <button type="button"
                    onClick={() => setFormRF(f => ({ ...f, ativa: !f.ativa }))}
                    className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                    style={{ background: formRF.ativa ? '#1D9E75' : '#e5e7eb' }}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                      style={{ left: formRF.ativa ? '22px' : '2px' }} />
                  </button>
                </div>
              </div>

              {/* Paradas */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-sm font-semibold text-gray-700">📍 Paradas</p>
                <p className="text-xs text-gray-400">
                  Adicione na ordem do trajeto — primeira é a origem, última é o destino.{' '}
                  <span style={{ color: '#1D9E75' }}>Segure e arraste para reordenar.</span>
                </p>

                <div className="flex flex-col">
                  {paradasRF.map((p, i) => (
                    <div key={i} draggable
                      data-drag-rf={i}
                      onDragStart={() => onDragStartRF(i)}
                      onDragEnter={() => onDragEnterRF(i)}
                      onDragEnd={onDragEndRF}
                      onDragOver={e => e.preventDefault()}
                      className="flex items-center gap-2 mb-2 rounded-xl transition-all"
                      style={{ background: draggingIdxRF === i ? '#E1F5EE' : 'transparent', padding: '4px 0' }}>
                      <div className="flex flex-col gap-0.5 px-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                        onTouchStart={(e) => handleTouchStartRF(e, i)}>
                        <div className="w-4 h-0.5 rounded" style={{ background: '#9FE1CB' }} />
                        <div className="w-4 h-0.5 rounded" style={{ background: '#9FE1CB' }} />
                        <div className="w-4 h-0.5 rounded" style={{ background: '#9FE1CB' }} />
                      </div>
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-3 h-3 rounded-full"
                          style={{ background: i === 0 || i === paradasRF.length - 1 ? '#085041' : '#1D9E75' }} />
                        {i < paradasRF.length - 1 && (
                          <div className="w-0.5 h-5 mt-0.5" style={{ background: '#9FE1CB' }} />
                        )}
                      </div>
                      <span className="flex-1 text-sm text-gray-800 font-medium select-none truncate">{p}</span>
                      <button onClick={() => removerParadaRF(i)}
                        className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                        style={{ background: '#FCEBEB', color: '#A32D2D' }}>✕</button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input value={novaParadaRF} onChange={e => setNovaParadaRF(e.target.value)}
                    placeholder="Nova parada..."
                    onKeyDown={e => e.key === 'Enter' && adicionarParadaRF()}
                    className="campo-input flex-1" />
                  <button onClick={adicionarParadaRF}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium"
                    style={{ background: '#E1F5EE', color: '#0F6E56' }}>+ Add</button>
                </div>
              </div>

              {/* Trechos e preços */}
              {precosRF.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-gray-700">💰 Trechos e preços</p>
                  <p className="text-xs text-gray-400">Defina o preço de cada trecho gerado automaticamente.</p>
                  <div className="flex flex-col gap-2">
                    {precosRF.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-gray-700 truncate">{p.origem} → {p.destino}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs text-gray-400">R$</span>
                          <input type="number" step="0.01" value={p.valor}
                            onChange={e => setPrecosRF(prev => prev.map((pp, ii) =>
                              ii === i ? { ...pp, valor: e.target.value } : pp
                            ))}
                            className="w-20 text-right text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white"
                            style={{ color: '#0F6E56' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {erroRF && (
                <div className="rounded-xl px-4 py-3 text-sm border"
                  style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                  ⚠️ {erroRF}
                </div>
              )}

              <button onClick={salvarRF} disabled={salvandoRF}
                className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-1 disabled:opacity-40"
                style={{ background: '#1D9E75' }}>
                {salvandoRF ? 'Salvando...' : rotaRFEditando ? 'Salvar alterações' : 'Criar rota'}
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

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Rotas</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">
            {rotas.length} rota{rotas.length !== 1 ? 's' : ''} cadastrada{rotas.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        <button
          onClick={abrirAdicionar}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#1D9E75', color: '#fff' }}>
          + Adicionar rota
        </button>

        {rotas.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-3xl mb-2">🛣️</p>
            <p className="text-sm text-gray-500">Nenhuma rota cadastrada ainda.</p>
            <p className="text-xs text-gray-400 mt-1">As rotas serão usadas para pré-preencher valores no agendamento.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rotas.map(r => (
              <div key={r.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {r.origem} → {r.destino}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                        R$ {Number(r.preco).toFixed(2).replace('.', ',')}
                      </p>
                      {r.distancia_km != null && (
                        <p className="text-xs text-gray-400">{r.distancia_km} km</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => abrirEditar(r)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                      Editar
                    </button>
                    <button
                      onClick={() => excluir(r.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <div>
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
                {editando ? 'Editar rota' : 'Nova rota'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            <Campo label="Origem *">
              <input value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
                placeholder="Ex: Aeroporto de Manaus" className="campo-input" />
            </Campo>
            <Campo label="Destino *">
              <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                placeholder="Ex: Hotel Tropical" className="campo-input" />
            </Campo>
            <Campo label="Distância (km) — opcional">
              <input type="number" value={form.distancia_km}
                onChange={e => setForm(f => ({ ...f, distancia_km: e.target.value }))}
                placeholder="Ex: 25" className="campo-input" min={0} />
            </Campo>
            <Campo label="Preço (R$) — opcional">
              <input type="number" step="0.01" value={form.preco}
                onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                placeholder="Deixe em branco se o valor variar por cliente" className="campo-input" min={0} />
              <p className="text-xs mt-1.5" style={{ color: '#6B7280' }}>
                ℹ️ Se você negocia o valor caso a caso, deixe em branco — assim o preço não aparece pro cliente no link público.
              </p>
            </Campo>

            <Campo label="Motorista responsável">
              <select value={form.motorista_id}
                onChange={e => setForm(f => ({ ...f, motorista_id: e.target.value }))}
                className="campo-input">
                <option value="">Nenhum / A definir</option>
                {motoristasOpcoes.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Placa do veículo">
              <input value={form.veiculo_placa}
                onChange={e => setForm(f => ({ ...f, veiculo_placa: e.target.value }))}
                placeholder="Ex: ABC-1234"
                className="campo-input" />
            </Campo>

            {erro && (
              <div className="rounded-xl px-4 py-3 text-sm border"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                ⚠️ {erro}
              </div>
            )}

            <button onClick={salvar} disabled={salvando}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-2 disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar rota'}
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
