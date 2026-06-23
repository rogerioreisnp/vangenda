'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type RotaOpcao = {
  id: string
  nome: string | null
  origem: string
  destino: string
  preco: number
  motorista_id: string | null
}

type MotoristaOpcao = {
  id: string
  nome: string
  user_id: string | null
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

type AgendamentoRF = {
  id: string
  motorista_id: string
  nome_passageiro: string
  telefone_passageiro: string | null
  parada_origem: string
  parada_destino: string
  turno: 'ida' | 'volta'
  valor: number
  status: 'agendado' | 'confirmado' | 'cancelado'
  data_viagem: string
  forma_pagamento: string | null
  observacoes: string | null
  rua: string | null
  numero: string | null
  bairro: string | null
  municipio: string | null
  cep: string | null
  referencia: string | null
}

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

type FormAgPassageiro = {
  rota_empresa_id: string
  embarque: string
  desembarque: string
  valor: string
  nome_passageiro: string
  telefone_passageiro: string
  data_viagem: string
  turno: 'ida' | 'volta'
  forma_pagamento: string
  observacoes: string
  motorista_empresa_id: string
  rua: string
  numero: string
  bairro: string
  municipio: string
  cep: string
  referencia: string
}

const FORM_AG_VAZIO: FormAgPassageiro = {
  rota_empresa_id: '',
  embarque: '',
  desembarque: '',
  valor: '',
  nome_passageiro: '',
  telefone_passageiro: '',
  data_viagem: '',
  turno: 'ida',
  forma_pagamento: 'dinheiro',
  observacoes: '',
  motorista_empresa_id: '',
  rua: '',
  numero: '',
  bairro: '',
  municipio: '',
  cep: '',
  referencia: '',
}

const STATUS_COR: Record<string, { bg: string; text: string; label: string }> = {
  confirmada:             { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
  em_andamento:           { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
  concluida:              { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
  cancelada:              { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
  parcialmente_cancelada: { bg: '#FEF3C7', text: '#92400E', label: 'Parc. cancelada' },
}

const STATUS_COR_AG: Record<string, { bg: string; text: string; label: string }> = {
  agendado:   { bg: '#EFF6FF', text: '#1D4ED8', label: 'Agendado' },
  confirmado: { bg: '#E1F5EE', text: '#0F6E56', label: 'Confirmado' },
  cancelado:  { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelado' },
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
  const [modalAgAberto, setModalAgAberto] = useState(false)
  const [formAg, setFormAg] = useState<FormAgPassageiro>(FORM_AG_VAZIO)
  const [trechosRF, setTrechosRF] = useState<{ nome: string; preco: number }[]>([])
  const [paradasUnicasRF, setParadasUnicasRF] = useState<string[]>([])
  const [valorTrechoRF, setValorTrechoRF] = useState<number | null>(null)
  const [salvandoAg, setSalvandoAg] = useState(false)
  const [erroAg, setErroAg] = useState('')
  const [agendamentosRF, setAgendamentosRF] = useState<AgendamentoRF[]>([])
  const [agEditando, setAgEditando] = useState<AgendamentoRF | null>(null)
  const [contactsApi, setContactsApi] = useState(false)
  useEffect(() => { setContactsApi('contacts' in navigator) }, [])
  async function selecionarContatoAg() {
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false })
      if (!contacts?.length) return
      const c = contacts[0]
      setFormAg(f => ({
        ...f,
        nome_passageiro: c.name?.[0] ?? f.nome_passageiro,
        telefone_passageiro: c.tel?.[0] ?? f.telefone_passageiro,
      }))
    } catch {}
  }

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
        .select('id, nome, origem, destino, preco, motorista_id')
        .eq('empresa_id', gestor.empresa_id)
        .order('created_at'),
      supabase
        .from('motoristas_empresa')
        .select('id, nome, user_id')
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

    if (empresa?.tipo_operacao === 'rota_fixa' && mots) {
      const userIds = (mots as any[]).filter(m => m.user_id).map(m => m.user_id as string)
      if (userIds.length > 0) {
        const { data: ags } = await supabase
          .from('agendamentos')
          .select('id, motorista_id, nome_passageiro, telefone_passageiro, parada_origem, parada_destino, turno, valor, status, data_viagem, forma_pagamento, observacoes, rua, numero, bairro, municipio, cep, referencia')
          .in('motorista_id', userIds)
          .order('data_viagem', { ascending: false })
          .limit(50)
        if (ags) setAgendamentosRF(ags as AgendamentoRF[])
      }
    }

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

  function abrirAgPassageiro() {
    setAgEditando(null)
    setFormAg(FORM_AG_VAZIO)
    setTrechosRF([])
    setParadasUnicasRF([])
    setValorTrechoRF(null)
    setErroAg('')
    setModalAgAberto(true)
  }

  function editarAgPassageiro(ag: AgendamentoRF) {
    setAgEditando(ag)
    const motorista = motoristasOpcoes.find(m => m.user_id === ag.motorista_id)
    setFormAg({
      rota_empresa_id: '',
      embarque: ag.parada_origem,
      desembarque: ag.parada_destino,
      valor: String(ag.valor),
      nome_passageiro: ag.nome_passageiro,
      telefone_passageiro: ag.telefone_passageiro || '',
      data_viagem: ag.data_viagem,
      turno: ag.turno,
      forma_pagamento: ag.forma_pagamento || 'dinheiro',
      observacoes: ag.observacoes || '',
      motorista_empresa_id: motorista?.id || '',
      rua: ag.rua || '',
      numero: ag.numero || '',
      bairro: ag.bairro || '',
      municipio: ag.municipio || '',
      cep: ag.cep || '',
      referencia: ag.referencia || '',
    })
    setTrechosRF([])
    setParadasUnicasRF([])
    setValorTrechoRF(null)
    setErroAg('')
    setModalAgAberto(true)
  }

  async function selecionarRotaAg(rotaId: string) {
    setFormAg(f => ({ ...f, rota_empresa_id: rotaId, embarque: '', desembarque: '' }))
    setValorTrechoRF(null)
    if (!rotaId) {
      setTrechosRF([])
      setParadasUnicasRF([])
      return
    }
    const { data } = await supabase
      .from('paradas_empresa')
      .select('nome, preco')
      .eq('rota_id', rotaId)
    const trechos = (data || []) as { nome: string; preco: number }[]
    setTrechosRF(trechos)
    const paradas = new Set<string>()
    trechos.forEach(t => {
      const partes = t.nome.split(' → ')
      if (partes.length === 2) {
        paradas.add(partes[0].trim())
        paradas.add(partes[1].trim())
      }
    })
    setParadasUnicasRF(Array.from(paradas))
  }

  async function salvarAgPassageiro() {
    if (!formAg.nome_passageiro.trim()) { setErroAg('Nome do passageiro é obrigatório'); return }
    if (!agEditando && !formAg.rota_empresa_id) { setErroAg('Selecione uma rota'); return }
    if (!formAg.embarque || !formAg.desembarque) { setErroAg('Selecione embarque e desembarque'); return }
    if (!formAg.data_viagem) { setErroAg('Data da viagem é obrigatória'); return }
    const valor = parseFloat(formAg.valor)
    if (isNaN(valor) || valor < 0) { setErroAg('Valor inválido'); return }
    if (!formAg.motorista_empresa_id) { setErroAg('Selecione um motorista'); return }

    const motorista = motoristasOpcoes.find(m => m.id === formAg.motorista_empresa_id)
    if (!motorista?.user_id) { setErroAg('Motorista não tem conta vinculada'); return }

    setSalvandoAg(true)
    setErroAg('')

    let dbError: any = null

    const camposEndereco = {
      rua: formAg.rua.trim() || null,
      numero: formAg.numero.trim() || null,
      bairro: formAg.bairro.trim() || null,
      municipio: formAg.municipio.trim() || null,
      cep: formAg.cep.trim() || null,
      referencia: formAg.referencia.trim() || null,
    }

    if (agEditando) {
      const res = await supabase.from('agendamentos').update({
        motorista_id: motorista.user_id,
        nome_passageiro: formAg.nome_passageiro.trim(),
        telefone_passageiro: formAg.telefone_passageiro.trim() || null,
        parada_origem: formAg.embarque,
        parada_destino: formAg.desembarque,
        turno: formAg.turno,
        valor,
        forma_pagamento: formAg.forma_pagamento,
        data_viagem: formAg.data_viagem,
        observacoes: formAg.observacoes.trim() || null,
        ...camposEndereco,
      }).eq('id', agEditando.id)
      dbError = res.error
    } else {
      const res = await supabase.from('agendamentos').insert({
        motorista_id: motorista.user_id,
        rota_id: null,
        nome_passageiro: formAg.nome_passageiro.trim(),
        telefone_passageiro: formAg.telefone_passageiro.trim() || null,
        parada_origem: formAg.embarque,
        parada_destino: formAg.desembarque,
        turno: formAg.turno,
        valor,
        forma_pagamento: formAg.forma_pagamento,
        data_viagem: formAg.data_viagem,
        status: 'agendado',
        fiado_pago: false,
        observacoes: formAg.observacoes.trim() || null,
        ...camposEndereco,
      })
      dbError = res.error
    }

    setSalvandoAg(false)
    if (dbError) {
      setErroAg('Erro ao salvar: ' + dbError.message)
      return
    }
    setModalAgAberto(false)
    carregarDados()
  }

  async function cancelarAgendamentoRF(id: string) {
    await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', id)
    setAgendamentosRF(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelado' as const } : a))
  }

  async function apagarAgendamentoRF(id: string) {
    if (!confirm('Tem certeza que deseja apagar este agendamento?')) return
    await supabase.from('agendamentos').delete().eq('id', id)
    setAgendamentosRF(prev => prev.filter(a => a.id !== id))
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
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">
            {tipoOperacao === 'rota_fixa' ? 'Fretamentos' : 'Agendamentos'}
          </p>
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

        {/* Botões de ação */}
        {tipoOperacao === 'rota_fixa' ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={abrirAgPassageiro}
              className="py-3 rounded-xl text-sm font-semibold"
              style={{ background: '#0F6E56', color: '#fff' }}>
              + Agendar passageiro
            </button>
            <button onClick={abrirNovaCorrida}
              className="py-3 rounded-xl text-sm font-semibold border-2"
              style={{ background: '#fff', color: '#0F6E56', borderColor: '#0F6E56' }}>
              + Nova corrida
            </button>
          </div>
        ) : (
          <button onClick={abrirNovaCorrida}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#1D9E75', color: '#fff' }}>
            + Nova corrida
          </button>
        )}

        {/* Lista de corridas e agendamentos */}
        {corridas.length === 0 && agendamentosRF.length === 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm text-gray-500">Nenhum agendamento ainda.</p>
            <p className="text-xs text-gray-400 mt-1">
              {tipoOperacao === 'rota_fixa' ? 'Toque em "+ Agendar passageiro" para começar.' : 'Toque em "+ Nova corrida" para começar.'}
            </p>
          </div>
        )}
        {corridas.length > 0 && (
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

        {/* Passageiros agendados (rota_fixa) */}
        {tipoOperacao === 'rota_fixa' && agendamentosRF.length > 0 && (
          <div className="flex flex-col gap-2">
            {corridas.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Passageiros agendados</p>
            )}
            {agendamentosRF.map(ag => {
              const cor = STATUS_COR_AG[ag.status] ?? { bg: '#EFF6FF', text: '#1D4ED8', label: ag.status }
              const nomeMotorista = motoristasOpcoes.find(m => m.user_id === ag.motorista_id)?.nome ?? null
              const dp = ag.data_viagem.split('-')
              const dataFmt = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : ag.data_viagem
              return (
                <div key={ag.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {ag.parada_origem} → {ag.parada_destino}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {dataFmt} · {ag.turno === 'ida' ? 'Ida' : 'Volta'}
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
                      <p className="text-xs font-medium text-gray-700 truncate">{ag.nome_passageiro}</p>
                      {nomeMotorista && (
                        <p className="text-xs text-gray-400 mt-0.5">🚐 {nomeMotorista}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                        R$ {Number(ag.valor).toFixed(2).replace('.', ',')}
                      </p>
                      <button onClick={() => editarAgPassageiro(ag)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                        ✏️
                      </button>
                      {ag.status === 'agendado' && (
                        <button onClick={() => cancelarAgendamentoRF(ag.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                          Cancelar
                        </button>
                      )}
                      <button onClick={() => apagarAgendamentoRF(ag.id)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                        🗑️
                      </button>
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
                {tipoOperacao === 'rota_fixa' ? (
                  <>
                    <option value="fretamento">Fretamento</option>
                    <option value="excursao">Excursão</option>
                  </>
                ) : (
                  <>
                    <option value="transfer">Transfer</option>
                    <option value="city_tour">City Tour</option>
                  </>
                )}
              </select>
            </Campo>

            {tipoOperacao !== 'rota_fixa' && (
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
            )}

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

      {/* Modal agendar passageiro (rota fixa) */}
      {modalAgAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAgAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
              {agEditando ? 'Editar passageiro' : 'Agendar passageiro'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 flex flex-col gap-3">

            <Campo label="Rota *">
              <select value={formAg.rota_empresa_id}
                onChange={e => selecionarRotaAg(e.target.value)}
                className="campo-input">
                <option value="">Selecione uma rota...</option>
                {rotasOpcoes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nome || `${r.origem} → ${r.destino}`}
                  </option>
                ))}
              </select>
            </Campo>

            {!formAg.rota_empresa_id && agEditando && (
              <div className="rounded-xl px-4 py-3 border border-gray-100" style={{ background: '#f9fafb' }}>
                <p className="text-xs text-gray-400 mb-1">Trecho atual</p>
                <p className="text-sm font-medium text-gray-800">{formAg.embarque} → {formAg.desembarque}</p>
                <p className="text-xs text-gray-400 mt-1">Selecione uma rota acima para alterar o trecho</p>
              </div>
            )}

            {paradasUnicasRF.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Embarque *">
                  <select value={formAg.embarque}
                    onChange={e => {
                      const emb = e.target.value
                      setFormAg(f => ({ ...f, embarque: emb, desembarque: '' }))
                      setValorTrechoRF(null)
                    }}
                    className="campo-input">
                    <option value="">Selecione...</option>
                    {paradasUnicasRF.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Desembarque *">
                  <select value={formAg.desembarque}
                    onChange={e => {
                      const des = e.target.value
                      const trecho = trechosRF.find(t => t.nome === `${formAg.embarque} → ${des}`)
                      if (trecho) {
                        setValorTrechoRF(Number(trecho.preco))
                        setFormAg(f => ({ ...f, desembarque: des, valor: String(trecho.preco) }))
                      } else {
                        setValorTrechoRF(null)
                        setFormAg(f => ({ ...f, desembarque: des }))
                      }
                    }}
                    className="campo-input">
                    <option value="">Selecione...</option>
                    {paradasUnicasRF.filter(p => p !== formAg.embarque).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Campo>
              </div>
            )}

            {valorTrechoRF !== null && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: '#E1F5EE' }}>
                <span className="text-sm font-medium" style={{ color: '#085041' }}>Valor do trecho</span>
                <span className="text-lg font-bold" style={{ color: '#0F6E56' }}>
                  R$ {valorTrechoRF.toFixed(2).replace('.', ',')}
                </span>
              </div>
            )}

            {formAg.embarque && formAg.desembarque && valorTrechoRF === null && (
              <div className="rounded-xl px-4 py-3 border"
                style={{ background: '#FCEBEB', borderColor: '#F5BCBC' }}>
                <p className="text-xs text-center" style={{ color: '#A32D2D' }}>
                  Trecho não disponível. Insira o valor manualmente.
                </p>
              </div>
            )}

            <Campo label="Valor (R$) *">
              <input type="number" step="0.01" min={0}
                value={formAg.valor}
                onChange={e => {
                  setFormAg(f => ({ ...f, valor: e.target.value }))
                  setValorTrechoRF(null)
                }}
                placeholder="0,00" className="campo-input" />
            </Campo>

            <Campo label="Nome do passageiro *">
              <div className="flex items-center gap-2">
                <input value={formAg.nome_passageiro}
                  onChange={e => setFormAg(f => ({ ...f, nome_passageiro: e.target.value }))}
                  placeholder="Nome completo" className="campo-input flex-1" />
                {contactsApi && (
                  <button type="button" onClick={selecionarContatoAg}
                    className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-green-700 border border-gray-200 bg-white whitespace-nowrap"
                    title="Importar da agenda do celular">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                    </svg>
                    <span>Buscar contato</span>
                  </button>
                )}
              </div>
            </Campo>

            <Campo label="Telefone">
              <input value={formAg.telefone_passageiro}
                onChange={e => setFormAg(f => ({ ...f, telefone_passageiro: e.target.value }))}
                placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
            </Campo>

            <div className="rounded-2xl p-4 border border-gray-100 flex flex-col gap-3" style={{ background: '#f9fafb' }}>
              <p className="text-sm font-semibold text-gray-700">
                📍 Endereço de embarque{' '}
                <span className="text-xs font-normal text-gray-400">(opcional)</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                <Campo label="Rua / Logradouro">
                  <input value={formAg.rua}
                    onChange={e => setFormAg(f => ({ ...f, rua: e.target.value }))}
                    placeholder="Ex: Rua das Flores" className="campo-input" />
                </Campo>
                <Campo label="Número">
                  <input value={formAg.numero}
                    onChange={e => setFormAg(f => ({ ...f, numero: e.target.value }))}
                    placeholder="123" className="campo-input" />
                </Campo>
              </div>
              <Campo label="Bairro">
                <input value={formAg.bairro}
                  onChange={e => setFormAg(f => ({ ...f, bairro: e.target.value }))}
                  placeholder="Ex: Centro" className="campo-input" />
              </Campo>
              <Campo label="Município">
                <input value={formAg.municipio}
                  onChange={e => setFormAg(f => ({ ...f, municipio: e.target.value }))}
                  placeholder="Ex: São Paulo" className="campo-input" />
              </Campo>
              <Campo label="CEP">
                <input value={formAg.cep}
                  onChange={e => setFormAg(f => ({ ...f, cep: e.target.value }))}
                  placeholder="00000-000" className="campo-input" />
              </Campo>
              <Campo label="Ponto de referência">
                <input value={formAg.referencia}
                  onChange={e => setFormAg(f => ({ ...f, referencia: e.target.value }))}
                  placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
              </Campo>
            </div>

            <Campo label="Data da viagem *">
              <input type="date" value={formAg.data_viagem}
                onChange={e => setFormAg(f => ({ ...f, data_viagem: e.target.value }))}
                className="campo-input" />
            </Campo>

            <Campo label="Turno">
              <div className="grid grid-cols-2 gap-2">
                {(['ida', 'volta'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setFormAg(f => ({ ...f, turno: t }))}
                    className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={formAg.turno === t
                      ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                      : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                    {t === 'ida' ? '↑ Ida' : '↓ Volta'}
                  </button>
                ))}
              </div>
            </Campo>

            <Campo label="Forma de pagamento">
              <select value={formAg.forma_pagamento}
                onChange={e => setFormAg(f => ({ ...f, forma_pagamento: e.target.value }))}
                className="campo-input">
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao">Cartão</option>
                <option value="fiado">Fiado</option>
                <option value="pendente">A cobrar na viagem</option>
              </select>
            </Campo>

            <Campo label="Motorista *">
              <select value={formAg.motorista_empresa_id}
                onChange={e => setFormAg(f => ({ ...f, motorista_empresa_id: e.target.value }))}
                className="campo-input">
                <option value="">Selecione um motorista...</option>
                {motoristasOpcoes.filter(m => m.user_id).map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
              {motoristasOpcoes.some(m => !m.user_id) && (
                <p className="text-xs text-gray-400 mt-1">
                  Motoristas sem conta vinculada não aparecem nesta lista.
                </p>
              )}
            </Campo>

            <Campo label="Observações">
              <textarea value={formAg.observacoes}
                onChange={e => setFormAg(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Informações adicionais..."
                className="campo-input"
                rows={3}
                style={{ resize: 'none' }} />
            </Campo>

            {erroAg && (
              <div className="rounded-xl px-4 py-3 text-sm border"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                ⚠️ {erroAg}
              </div>
            )}

            <button onClick={salvarAgPassageiro} disabled={salvandoAg}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-1 mb-6 disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvandoAg ? 'Salvando...' : agEditando ? '✓ Salvar alterações' : '✓ Confirmar agendamento'}
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
