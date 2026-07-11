'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ModalListaPassageirosPDF from '@/components/ModalListaPassageirosPDF'

type RotaOpcao = {
  id: string
  nome: string | null
  origem: string | null
  destino: string | null
  preco: number
  motorista_id: string | null
}

type MotoristaOpcao = {
  id: string
  nome: string
  user_id: string | null
  telefone: string | null
  veiculo: string | null
  placa: string | null
  cor: string | null
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
  email_solicitante: string | null
  passageiro1_nome: string | null
  passageiro1_telefone: string | null
  valor: number
  status: string
  motorista_id: string | null
  tipo_servico: string | null
  forma_pagamento: string | null
  status_pagamento: string | null
  valor_recebido: number | null
  data_pagamento: string | null
  data_prevista_pagamento: string | null
  observacoes: string | null
  motoristas_empresa: { nome: string } | null
  numero_voo: string | null
  nome_passageiro2: string | null
  telefone_passageiro2: string | null
  rua: string | null; numero: string | null; bairro: string | null; municipio: string | null; cep: string | null; referencia: string | null
  rua_desembarque: string | null; numero_desembarque: string | null; bairro_desembarque: string | null
  municipio_desembarque: string | null; cep_desembarque: string | null; referencia_desembarque: string | null
  rua_retorno_embarque: string | null; numero_retorno_embarque: string | null; bairro_retorno_embarque: string | null
  municipio_retorno_embarque: string | null; cep_retorno_embarque: string | null; referencia_retorno_embarque: string | null
  rua_retorno_desembarque: string | null; numero_retorno_desembarque: string | null; bairro_retorno_desembarque: string | null
  municipio_retorno_desembarque: string | null; cep_retorno_desembarque: string | null; referencia_retorno_desembarque: string | null
  retorno_data: string | null
  retorno_horario: string | null
  retorno_origem: string | null
  retorno_destino: string | null
  data_hora_termino: string | null
  trajetos: string[] | null
  numero_reserva: number | null
  quantidade_bagagem: number | null
  passageiros_adicionais: Array<{
    nome: string; telefone: string
    rua: string | null; numero: string | null; bairro: string | null; municipio: string | null; cep: string | null; referencia: string | null
    rua_desembarque: string | null; numero_desembarque: string | null; bairro_desembarque: string | null
    municipio_desembarque: string | null; cep_desembarque: string | null; referencia_desembarque: string | null
    rua_retorno_embarque?: string | null; numero_retorno_embarque?: string | null; bairro_retorno_embarque?: string | null
    municipio_retorno_embarque?: string | null; cep_retorno_embarque?: string | null; referencia_retorno_embarque?: string | null
    rua_retorno_desembarque?: string | null; numero_retorno_desembarque?: string | null; bairro_retorno_desembarque?: string | null
    municipio_retorno_desembarque?: string | null; cep_retorno_desembarque?: string | null; referencia_retorno_desembarque?: string | null
  }> | null
}

type CorridaAgrupada =
  | { tipo: 'simples'; corrida: Corrida }
  | { tipo: 'par'; ida: Corrida; volta: Corrida }

type AgendamentoRF = {
  id: string
  rota_id: string | null
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

type PassageiroExtraCorrida = {
  nome: string; telefone: string; numero_voo: string
  rua: string; numero: string; bairro: string; municipio: string; cep: string; referencia: string
  rua_desembarque: string; numero_desembarque: string; bairro_desembarque: string
  municipio_desembarque: string; cep_desembarque: string; referencia_desembarque: string
  rua_retorno_embarque: string; numero_retorno_embarque: string; bairro_retorno_embarque: string
  municipio_retorno_embarque: string; cep_retorno_embarque: string; referencia_retorno_embarque: string
  rua_retorno_desembarque: string; numero_retorno_desembarque: string; bairro_retorno_desembarque: string
  municipio_retorno_desembarque: string; cep_retorno_desembarque: string; referencia_retorno_desembarque: string
}
const PASSAGEIRO_EXTRA_CORRIDA_VAZIO: PassageiroExtraCorrida = {
  nome: '', telefone: '', numero_voo: '',
  rua: '', numero: '', bairro: '', municipio: '', cep: '', referencia: '',
  rua_desembarque: '', numero_desembarque: '', bairro_desembarque: '',
  municipio_desembarque: '', cep_desembarque: '', referencia_desembarque: '',
  rua_retorno_embarque: '', numero_retorno_embarque: '', bairro_retorno_embarque: '',
  municipio_retorno_embarque: '', cep_retorno_embarque: '', referencia_retorno_embarque: '',
  rua_retorno_desembarque: '', numero_retorno_desembarque: '', bairro_retorno_desembarque: '',
  municipio_retorno_desembarque: '', cep_retorno_desembarque: '', referencia_retorno_desembarque: '',
}

type FormCorrida = {
  tipo_servico: string
  rota_id: string
  origem: string
  destino: string
  data: string
  horario: string
  ida_volta: boolean
  origem_volta: string
  destino_volta: string
  data_retorno: string
  horario_retorno: string
  preco_volta: string
  observacoes_volta: string
  motorista_id: string
  cliente_nome: string
  cliente_telefone: string
  email_solicitante: string
  passageiro1_nome: string
  passageiro1_telefone: string
  numero_voo: string
  rua: string; numero: string; bairro: string; municipio: string; cep: string; referencia: string
  rua_desembarque: string; numero_desembarque: string; bairro_desembarque: string
  municipio_desembarque: string; cep_desembarque: string; referencia_desembarque: string
  rua_retorno_embarque: string; numero_retorno_embarque: string; bairro_retorno_embarque: string
  municipio_retorno_embarque: string; cep_retorno_embarque: string; referencia_retorno_embarque: string
  rua_retorno_desembarque: string; numero_retorno_desembarque: string; bairro_retorno_desembarque: string
  municipio_retorno_desembarque: string; cep_retorno_desembarque: string; referencia_retorno_desembarque: string
  // Diária / City Tour: término estimado e trajetos percorridos
  data_termino: string
  horario_termino: string
  trajetos: string[]
  passageiros_adicionais: PassageiroExtraCorrida[]
  forma_pagamento: string
  status_pagamento: string
  valor_recebido: string
  data_pagamento: string
  data_prevista_pagamento: string
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
  origem_volta: '',
  destino_volta: '',
  data_retorno: '',
  horario_retorno: '',
  preco_volta: '',
  observacoes_volta: '',
  motorista_id: '',
  cliente_nome: '',
  cliente_telefone: '',
  email_solicitante: '',
  passageiro1_nome: '',
  passageiro1_telefone: '',
  numero_voo: '',
  rua: '', numero: '', bairro: '', municipio: '', cep: '', referencia: '',
  rua_desembarque: '', numero_desembarque: '', bairro_desembarque: '',
  municipio_desembarque: '', cep_desembarque: '', referencia_desembarque: '',
  rua_retorno_embarque: '', numero_retorno_embarque: '', bairro_retorno_embarque: '',
  municipio_retorno_embarque: '', cep_retorno_embarque: '', referencia_retorno_embarque: '',
  rua_retorno_desembarque: '', numero_retorno_desembarque: '', bairro_retorno_desembarque: '',
  municipio_retorno_desembarque: '', cep_retorno_desembarque: '', referencia_retorno_desembarque: '',
  data_termino: '', horario_termino: '', trajetos: [],
  passageiros_adicionais: [],
  forma_pagamento: 'a_definir',
  status_pagamento: 'a_receber',
  valor_recebido: '',
  data_pagamento: '',
  data_prevista_pagamento: '',
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
  pendente:               { bg: '#FEF3C7', text: '#92400E', label: 'Pendente' },
  confirmada:             { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
  em_andamento:           { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
  concluida:              { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
  cancelada:              { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
  recusada:               { bg: '#FCEBEB', text: '#A32D2D', label: 'Recusada' },
  parcialmente_cancelada: { bg: '#FEF3C7', text: '#92400E', label: 'Parc. cancelada' },
}

type TipoMeta = { badge: string; bg: string; text: string; clienteLabel: string }
const TIPO_META: Record<string, TipoMeta> = {
  rota_fixa:  { badge: '🛣️ Rota Fixa',  bg: '#E1F5EE', text: '#085041', clienteLabel: 'Passageiro' },
  fretamento: { badge: '🚌 Fretamento', bg: '#FEF3C7', text: '#92400E', clienteLabel: 'Responsável' },
  excursao:   { badge: '🗺️ Excursão',   bg: '#EDE9FE', text: '#5B21B6', clienteLabel: 'Responsável' },
  transfer:   { badge: '🚗 Transfer',   bg: '#EFF6FF', text: '#1D4ED8', clienteLabel: 'Responsável' },
  city_tour:  { badge: '🏙️ City Tour',  bg: '#F0FDF4', text: '#166534', clienteLabel: 'Cliente'     },
  diaria:     { badge: '📆 Diária',     bg: '#FFEDD5', text: '#9A3412', clienteLabel: 'Cliente'     },
}
function tipoMeta(tipo: string | null): TipoMeta {
  return TIPO_META[tipo ?? ''] ?? { badge: tipo ?? 'Serviço', bg: '#F3F4F6', text: '#6B7280', clienteLabel: 'Cliente' }
}

function podeAbrirFichaTransfer(c: { tipo_servico: string | null; status: string }): boolean {
  // Transfer, diária e city tour usam a mesma ficha (todos abrem).
  // Fretamento e excursão tem outra estrutura.
  const ehTransferOuDispose = c.tipo_servico !== 'fretamento' && c.tipo_servico !== 'excursao'
  if (ehTransferOuDispose) return true
  return c.status === 'pendente' || c.status === 'confirmada' || c.status === 'em_andamento'
}

const STATUS_COR_AG: Record<string, { bg: string; text: string; label: string }> = {
  agendado:   { bg: '#EFF6FF', text: '#1D4ED8', label: 'Agendado' },
  confirmado: { bg: '#E1F5EE', text: '#0F6E56', label: 'Confirmado' },
  cancelado:  { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelado' },
}

const HOJE = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
})()

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
  const [empresaNome, setEmpresaNome] = useState<string>('')
  const [mensagemConfirmacaoTransfer, setMensagemConfirmacaoTransfer] = useState<string | null>(null)
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
  const [filtroData, setFiltroData] = useState(HOJE)
  const [verTodos, setVerTodos] = useState(false)
  const [filtroRotaId, setFiltroRotaId] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalFichaAberto, setModalFichaAberto] = useState(false)
  const [corridaFicha, setCorridaFicha] = useState<Corrida | null>(null)
  const [voltaDaFicha, setVoltaDaFicha] = useState<Corrida | null>(null)
  const [modalPDFAberto, setModalPDFAberto] = useState(false)
  const [confirmandoFicha, setConfirmandoFicha] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [motoristaFicha, setMotoristaFicha] = useState('')
  const [contactsApi, setContactsApi] = useState(false)
  const fichaAutoAberta = useRef(false)
  useEffect(() => { setContactsApi('contacts' in navigator) }, [])
  useEffect(() => {
    const fichaId = searchParams.get('ficha')
    if (!fichaId || corridas.length === 0 || fichaAutoAberta.current) return
    const corrida = corridas.find(c => c.id === fichaId)
    if (corrida) {
      fichaAutoAberta.current = true
      setCorridaFicha(corrida)
      setModalFichaAberto(true)
    }
  }, [corridas, searchParams])
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
    if (!loading) {
      if (searchParams.get('nova') === '1') abrirNovaCorrida()
      if (searchParams.get('todos') === '1') setVerTodos(true)
      const rotaParam = searchParams.get('rota')
      if (rotaParam) setFiltroRotaId(rotaParam)
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

    // Transição automática: confirmada -> em_andamento quando dá o horário.
    // Antes esse trecho movia em_andamento -> concluida automaticamente, o que
    // travava a ficha (não editável) mesmo quando o serviço ainda estava
    // rolando (ex: diária). Agora deixa a corrida "acessível" pro gestor
    // ajustar endereço/hora/etc; a mudança pra concluida é sempre manual
    // no botão "✓ Marcar como Concluído" da ficha.
    await supabase.from('corridas_empresa')
      .update({ status: 'em_andamento' })
      .eq('empresa_id', gestor.empresa_id)
      .eq('status', 'confirmada')
      .lt('data_hora', new Date().toISOString())

    // Ordenação das corridas: próximas primeiro (asc, do hoje pra frente),
    // depois passadas recentes (desc). O gestor vê o que precisa fazer HOJE
    // em cima, sem rolar até o fim da lista.
    const agoraISO = new Date().toISOString()
    const colsCorridas = 'id, rota_id, origem, destino, data_hora, created_at, cliente_nome, cliente_telefone, email_solicitante, passageiro1_nome, passageiro1_telefone, valor, status, motorista_id, tipo_servico, forma_pagamento, status_pagamento, valor_recebido, data_pagamento, data_prevista_pagamento, observacoes, motoristas_empresa(nome), numero_voo, nome_passageiro2, telefone_passageiro2, retorno_data, retorno_horario, retorno_origem, retorno_destino, numero_reserva, quantidade_bagagem, passageiros_adicionais, rua, numero, bairro, municipio, cep, referencia, rua_desembarque, numero_desembarque, bairro_desembarque, municipio_desembarque, cep_desembarque, referencia_desembarque'

    const [{ data: empresa }, { data: rts }, { data: mots }, { data: futuras }, { data: passadas }] = await Promise.all([
      supabase
        .from('empresas')
        .select('tipo_operacao, nome, mensagem_confirmacao_transfer')
        .eq('id', gestor.empresa_id)
        .single(),
      supabase
        .from('rotas_empresa')
        .select('id, nome, origem, destino, preco, motorista_id')
        .eq('empresa_id', gestor.empresa_id)
        .order('created_at'),
      supabase
        .from('motoristas_empresa')
        .select('id, nome, user_id, telefone, veiculo, placa, cor')
        .eq('empresa_id', gestor.empresa_id)
        .eq('status', 'ativo')
        .order('nome'),
      supabase
        .from('corridas_empresa')
        .select(colsCorridas)
        .eq('empresa_id', gestor.empresa_id)
        .gte('data_hora', agoraISO)
        .order('data_hora', { ascending: true })
        .limit(250),
      supabase
        .from('corridas_empresa')
        .select(colsCorridas)
        .eq('empresa_id', gestor.empresa_id)
        .lt('data_hora', agoraISO)
        .order('data_hora', { ascending: false })
        .limit(150),
    ])
    const corrds = [...(futuras || []), ...(passadas || [])]

    if (empresa) {
      setTipoOperacao(empresa.tipo_operacao || 'transfer')
      setEmpresaNome((empresa as any).nome || '')
      setMensagemConfirmacaoTransfer((empresa as any).mensagem_confirmacao_transfer || null)
    }
    if (rts) setRotasOpcoes(rts)
    if (mots) setMotoristasOpcoes(mots)
    if (corrds) setCorridas(corrds as any)

    if (empresa?.tipo_operacao === 'rota_fixa' && mots) {
      const userIds = (mots as any[]).filter(m => m.user_id).map(m => m.user_id as string)
      if (userIds.length > 0) {
        const { data: ags } = await supabase
          .from('agendamentos')
          .select('id, rota_id, motorista_id, nome_passageiro, telefone_passageiro, parada_origem, parada_destino, turno, valor, status, data_viagem, forma_pagamento, observacoes, rua, numero, bairro, municipio, cep, referencia')
          .in('motorista_id', userIds)
          .order('data_viagem', { ascending: false })
          .limit(300)
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
    // Duas formas de ida-e-volta existirem:
    // 1. PAR — duas linhas separadas em corridas_empresa (agrupadas por
    //    cliente_nome + created_at proximo). voltaId aponta pra outra linha.
    // 2. LINK PUBLICO — uma unica linha com retorno_data/retorno_horario/
    //    retorno_origem/retorno_destino preenchidos.
    // Em ambos os casos, o gestor precisa poder editar os dados da volta.
    const volta = voltaId ? corridas.find(x => x.id === voltaId) : null
    const temRetornoLinkPublico = !volta && !!c.retorno_data
    setCorridaEditando(c)
    setVoltaIdEditando(voltaId ?? null)
    setForm({
      tipo_servico: c.tipo_servico || 'transfer',
      rota_id: rotaExiste ? c.rota_id! : 'manual',
      origem: c.origem,
      destino: c.destino,
      data: c.data_hora.slice(0, 10),
      horario: c.data_hora.slice(11, 16),
      ida_volta: !!volta || temRetornoLinkPublico,
      origem_volta: volta?.origem || c.retorno_origem || '',
      destino_volta: volta?.destino || c.retorno_destino || '',
      data_retorno: volta?.data_hora.slice(0, 10) || c.retorno_data || '',
      horario_retorno: volta?.data_hora.slice(11, 16) || (c.retorno_horario ? c.retorno_horario.slice(0, 5) : ''),
      preco_volta: volta ? String(volta.valor) : '',
      observacoes_volta: volta?.observacoes || '',
      motorista_id: c.motorista_id || '',
      cliente_nome: c.cliente_nome,
      cliente_telefone: c.cliente_telefone || '',
      email_solicitante: c.email_solicitante || '',
      passageiro1_nome: c.passageiro1_nome || '',
      passageiro1_telefone: c.passageiro1_telefone || '',
      numero_voo: c.numero_voo || '',
      rua: c.rua || '', numero: c.numero || '', bairro: c.bairro || '', municipio: c.municipio || '', cep: c.cep || '', referencia: c.referencia || '',
      rua_desembarque: c.rua_desembarque || '', numero_desembarque: c.numero_desembarque || '', bairro_desembarque: c.bairro_desembarque || '',
      municipio_desembarque: c.municipio_desembarque || '', cep_desembarque: c.cep_desembarque || '', referencia_desembarque: c.referencia_desembarque || '',
      rua_retorno_embarque: c.rua_retorno_embarque || '', numero_retorno_embarque: c.numero_retorno_embarque || '', bairro_retorno_embarque: c.bairro_retorno_embarque || '',
      municipio_retorno_embarque: c.municipio_retorno_embarque || '', cep_retorno_embarque: c.cep_retorno_embarque || '', referencia_retorno_embarque: c.referencia_retorno_embarque || '',
      rua_retorno_desembarque: c.rua_retorno_desembarque || '', numero_retorno_desembarque: c.numero_retorno_desembarque || '', bairro_retorno_desembarque: c.bairro_retorno_desembarque || '',
      municipio_retorno_desembarque: c.municipio_retorno_desembarque || '', cep_retorno_desembarque: c.cep_retorno_desembarque || '', referencia_retorno_desembarque: c.referencia_retorno_desembarque || '',
      data_termino: c.data_hora_termino ? c.data_hora_termino.slice(0, 10) : '',
      horario_termino: c.data_hora_termino ? c.data_hora_termino.slice(11, 16) : '',
      trajetos: Array.isArray(c.trajetos) ? c.trajetos : [],
      passageiros_adicionais: (c.passageiros_adicionais || []).map(p => ({
        nome: p.nome || '', telefone: p.telefone || '', numero_voo: '',
        rua: p.rua || '', numero: p.numero || '', bairro: p.bairro || '', municipio: p.municipio || '', cep: p.cep || '', referencia: p.referencia || '',
        rua_desembarque: p.rua_desembarque || '', numero_desembarque: p.numero_desembarque || '', bairro_desembarque: p.bairro_desembarque || '',
        municipio_desembarque: p.municipio_desembarque || '', cep_desembarque: p.cep_desembarque || '', referencia_desembarque: p.referencia_desembarque || '',
        rua_retorno_embarque: p.rua_retorno_embarque || '', numero_retorno_embarque: p.numero_retorno_embarque || '', bairro_retorno_embarque: p.bairro_retorno_embarque || '',
        municipio_retorno_embarque: p.municipio_retorno_embarque || '', cep_retorno_embarque: p.cep_retorno_embarque || '', referencia_retorno_embarque: p.referencia_retorno_embarque || '',
        rua_retorno_desembarque: p.rua_retorno_desembarque || '', numero_retorno_desembarque: p.numero_retorno_desembarque || '', bairro_retorno_desembarque: p.bairro_retorno_desembarque || '',
        municipio_retorno_desembarque: p.municipio_retorno_desembarque || '', cep_retorno_desembarque: p.cep_retorno_desembarque || '', referencia_retorno_desembarque: p.referencia_retorno_desembarque || '',
      })),
      forma_pagamento: c.forma_pagamento || 'a_definir',
      status_pagamento: c.status_pagamento || (c.status === 'concluida' ? 'recebido' : 'a_receber'),
      valor_recebido: c.valor_recebido != null ? String(c.valor_recebido) : '',
      data_pagamento: c.data_pagamento || '',
      data_prevista_pagamento: c.data_prevista_pagamento || '',
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
        origem: rota.origem || '',
        destino: rota.destino || '',
        preco: String(rota.preco),
      }))
    }
  }

  async function salvar() {
    if (!form.cliente_nome.trim()) { setErro('Nome do solicitante é obrigatório'); return }
    const ehDispose = form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour'
    if (ehDispose) {
      if (!form.origem.trim()) { setErro('Local de início é obrigatório'); return }
      // Se preencheu um dos campos de término, exige o outro
      if ((form.data_termino && !form.horario_termino) || (!form.data_termino && form.horario_termino)) {
        setErro('Preencha data e hora de término, ou deixe os dois em branco'); return
      }
    } else {
      if (!form.origem.trim() || !form.destino.trim()) { setErro('Origem e destino são obrigatórios'); return }
    }
    if (!form.data) { setErro('Data é obrigatória'); return }
    if (!form.horario) { setErro('Horário de saída é obrigatório'); return }
    const preco = parseFloat(form.preco)
    if (isNaN(preco) || preco < 0) { setErro('Preço inválido'); return }
    if (!corridaEditando && form.ida_volta) {
      if (!form.horario_retorno) { setErro('Horário de retorno é obrigatório'); return }
      if (!(form.origem_volta || form.destino).trim() || !(form.destino_volta || form.origem).trim()) {
        setErro('Origem e destino do retorno são obrigatórios'); return
      }
      const dataRetorno = form.data_retorno || form.data
      if (dataRetorno < form.data) { setErro('A data de retorno não pode ser antes da data de ida'); return }
    }
    if (!empresaId) return

    setSalvando(true)
    setErro('')

    const valorRecebido = form.status_pagamento === 'recebido'
      ? preco
      : form.status_pagamento === 'parcial'
      ? (parseFloat(form.valor_recebido) || 0)
      : 0

    const hojeStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
    const dataPagamento = form.status_pagamento === 'recebido'
      ? (form.data_pagamento || hojeStr)
      : null

    const camposComuns = {
      motorista_id: form.motorista_id || null,
      rota_id: form.rota_id && form.rota_id !== 'manual' ? form.rota_id : null,
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      cliente_nome: form.cliente_nome.trim(),
      cliente_telefone: form.cliente_telefone.trim() || null,
      email_solicitante: form.email_solicitante.trim() || null,
      passageiro1_nome: form.passageiro1_nome.trim() || null,
      passageiro1_telefone: form.passageiro1_telefone.trim() || null,
      numero_voo: form.numero_voo.trim() || null,
      rua: form.rua.trim() || null,
      numero: form.numero.trim() || null,
      bairro: form.bairro.trim() || null,
      municipio: form.municipio.trim() || null,
      cep: form.cep.trim() || null,
      referencia: form.referencia.trim() || null,
      rua_desembarque: form.rua_desembarque.trim() || null,
      numero_desembarque: form.numero_desembarque.trim() || null,
      bairro_desembarque: form.bairro_desembarque.trim() || null,
      municipio_desembarque: form.municipio_desembarque.trim() || null,
      cep_desembarque: form.cep_desembarque.trim() || null,
      referencia_desembarque: form.referencia_desembarque.trim() || null,
      // Volta estruturada do Passageiro 1 — só grava se ida_volta ativo
      rua_retorno_embarque:         form.ida_volta ? (form.rua_retorno_embarque.trim()         || null) : null,
      numero_retorno_embarque:      form.ida_volta ? (form.numero_retorno_embarque.trim()      || null) : null,
      bairro_retorno_embarque:      form.ida_volta ? (form.bairro_retorno_embarque.trim()      || null) : null,
      municipio_retorno_embarque:   form.ida_volta ? (form.municipio_retorno_embarque.trim()   || null) : null,
      cep_retorno_embarque:         form.ida_volta ? (form.cep_retorno_embarque.trim()         || null) : null,
      referencia_retorno_embarque:  form.ida_volta ? (form.referencia_retorno_embarque.trim()  || null) : null,
      rua_retorno_desembarque:         form.ida_volta ? (form.rua_retorno_desembarque.trim()         || null) : null,
      numero_retorno_desembarque:      form.ida_volta ? (form.numero_retorno_desembarque.trim()      || null) : null,
      bairro_retorno_desembarque:      form.ida_volta ? (form.bairro_retorno_desembarque.trim()      || null) : null,
      municipio_retorno_desembarque:   form.ida_volta ? (form.municipio_retorno_desembarque.trim()   || null) : null,
      cep_retorno_desembarque:         form.ida_volta ? (form.cep_retorno_desembarque.trim()         || null) : null,
      referencia_retorno_desembarque:  form.ida_volta ? (form.referencia_retorno_desembarque.trim()  || null) : null,
      passageiros_adicionais: form.passageiros_adicionais.length > 0
        ? form.passageiros_adicionais.map(p => ({
            nome: p.nome.trim(), telefone: p.telefone.trim(), numero_voo: p.numero_voo.trim() || null,
            rua: p.rua.trim() || null, numero: p.numero.trim() || null, bairro: p.bairro.trim() || null,
            municipio: p.municipio.trim() || null, cep: p.cep.trim() || null, referencia: p.referencia.trim() || null,
            rua_desembarque: p.rua_desembarque.trim() || null, numero_desembarque: p.numero_desembarque.trim() || null,
            bairro_desembarque: p.bairro_desembarque.trim() || null, municipio_desembarque: p.municipio_desembarque.trim() || null,
            cep_desembarque: p.cep_desembarque.trim() || null, referencia_desembarque: p.referencia_desembarque.trim() || null,
            rua_retorno_embarque:         form.ida_volta ? (p.rua_retorno_embarque.trim()         || null) : null,
            numero_retorno_embarque:      form.ida_volta ? (p.numero_retorno_embarque.trim()      || null) : null,
            bairro_retorno_embarque:      form.ida_volta ? (p.bairro_retorno_embarque.trim()      || null) : null,
            municipio_retorno_embarque:   form.ida_volta ? (p.municipio_retorno_embarque.trim()   || null) : null,
            cep_retorno_embarque:         form.ida_volta ? (p.cep_retorno_embarque.trim()         || null) : null,
            referencia_retorno_embarque:  form.ida_volta ? (p.referencia_retorno_embarque.trim()  || null) : null,
            rua_retorno_desembarque:         form.ida_volta ? (p.rua_retorno_desembarque.trim()         || null) : null,
            numero_retorno_desembarque:      form.ida_volta ? (p.numero_retorno_desembarque.trim()      || null) : null,
            bairro_retorno_desembarque:      form.ida_volta ? (p.bairro_retorno_desembarque.trim()      || null) : null,
            municipio_retorno_desembarque:   form.ida_volta ? (p.municipio_retorno_desembarque.trim()   || null) : null,
            cep_retorno_desembarque:         form.ida_volta ? (p.cep_retorno_desembarque.trim()         || null) : null,
            referencia_retorno_desembarque:  form.ida_volta ? (p.referencia_retorno_desembarque.trim()  || null) : null,
          }))
        : null,
      valor: preco,
      tipo_servico: form.tipo_servico,
      // Diária/City Tour: término estimado + trajetos. Outros tipos gravam null.
      data_hora_termino: (form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour') && form.data_termino && form.horario_termino
        ? `${form.data_termino}T${form.horario_termino}:00`
        : null,
      trajetos: (form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour') && form.trajetos.some(t => t.trim())
        ? form.trajetos.map(t => t.trim()).filter(Boolean)
        : null,
      forma_pagamento: form.forma_pagamento,
      status_pagamento: form.status_pagamento,
      valor_recebido: valorRecebido,
      data_pagamento: dataPagamento,
      data_prevista_pagamento: form.data_prevista_pagamento || null,
      observacoes: form.observacoes.trim() || null,
    }

    if (corridaEditando) {
      const updateFields: Record<string, unknown> = {
        ...camposComuns,
        data_hora: `${form.data}T${form.horario}:00`,
      }
      // Se e edicao de corrida do link publico com ida-volta (uma so linha
      // com retorno_*), atualiza os campos retorno_* na mesma corrida.
      // Distinguimos do PAR pelo voltaIdEditando: se e null e ida_volta e true,
      // e link publico.
      if (!voltaIdEditando && form.ida_volta) {
        updateFields.retorno_data = form.data_retorno || null
        updateFields.retorno_horario = form.horario_retorno || null
        updateFields.retorno_origem = form.origem_volta.trim() || null
        updateFields.retorno_destino = form.destino_volta.trim() || null
      }
      const { error } = await supabase
        .from('corridas_empresa')
        .update(updateFields)
        .eq('id', corridaEditando.id)

      if (error) {
        setErro('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }

      // Se editando um par, atualiza os campos compartilhados na corrida de volta
      // + os campos especificos da volta (origem, destino, data, hora, valor,
      // observacoes) quando o usuario editar eles no formulario.
      if (voltaIdEditando) {
        const precoVoltaNum = parseFloat(form.preco_volta)
        const updateVolta: Record<string, unknown> = {
          motorista_id: camposComuns.motorista_id,
          cliente_nome: camposComuns.cliente_nome,
          cliente_telefone: camposComuns.cliente_telefone,
          forma_pagamento: camposComuns.forma_pagamento,
        }
        // Se o usuario alterou os dados da volta no form, propaga na volta
        if (form.origem_volta.trim()) updateVolta.origem = form.origem_volta.trim()
        if (form.destino_volta.trim()) updateVolta.destino = form.destino_volta.trim()
        if (form.data_retorno && form.horario_retorno) {
          updateVolta.data_hora = `${form.data_retorno}T${form.horario_retorno}:00`
        }
        if (!isNaN(precoVoltaNum) && form.preco_volta.trim() !== '') {
          updateVolta.valor = precoVoltaNum
        }
        updateVolta.observacoes = form.observacoes_volta.trim() || null

        const { error: erroVolta } = await supabase
          .from('corridas_empresa')
          .update(updateVolta)
          .eq('id', voltaIdEditando)

        if (erroVolta) {
          setErro('Erro ao salvar corrida de volta: ' + erroVolta.message)
          setSalvando(false)
          return
        }
      }
    } else {
      // Nova corrida nasce como 'confirmada'. Não amarra status ao pagamento
      // (o cliente pode pagar antecipado sem que o serviço tenha rolado ainda).
      // O gestor promove pra concluida manualmente no botão "✓ Marcar como
      // Concluído" da ficha quando o serviço acabar.
      const base = { empresa_id: empresaId, status: 'confirmada', ...camposComuns }
      const registros: typeof base[] = [
        { ...base, data_hora: `${form.data}T${form.horario}:00` } as any,
      ]

      if (form.ida_volta && form.horario_retorno) {
        const precoVolta = parseFloat(form.preco_volta)
        registros.push({
          ...base,
          data_hora: `${form.data_retorno || form.data}T${form.horario_retorno}:00`,
          origem: (form.origem_volta || form.destino).trim(),
          destino: (form.destino_volta || form.origem).trim(),
          valor: !isNaN(precoVolta) && form.preco_volta.trim() !== '' ? precoVolta : preco,
          observacoes: form.observacoes_volta.trim() || null,
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

  // Reativa uma corrida cancelada — volta pra 'pendente' pra o gestor poder
  // reprocessar. Preserva todos os dados (motorista, valor, endereços, etc).
  async function reativarCorrida(ids: string[]) {
    for (const id of ids) {
      await supabase.from('corridas_empresa').update({ status: 'pendente' }).eq('id', id)
    }
    setCorridas(prev => prev.map(c => ids.includes(c.id) ? { ...c, status: 'pendente' } : c))
  }

  async function apagarCorrida(ids: string[]) {
    if (!confirm('Tem certeza que deseja apagar este agendamento?')) return
    for (const id of ids) {
      await supabase.from('corridas_empresa').delete().eq('id', id)
    }
    setCorridas(prev => prev.filter(c => !ids.includes(c.id)))
  }

  function abrirFicha(c: Corrida) {
    // Detecta se essa corrida faz parte de um par ida-volta (mesmo cliente,
    // created_at com menos de 30s de diferenca — mesma regra do agruparPares).
    // Se sim, guarda a outra ponta em voltaDaFicha pra exibir na ficha.
    const par = corridas.find(other =>
      other.id !== c.id &&
      other.cliente_nome === c.cliente_nome &&
      Math.abs(new Date(other.created_at).getTime() - new Date(c.created_at).getTime()) < 30000
    ) ?? null

    // A ficha sempre exibe a IDA como principal e a VOLTA embaixo, mesmo se o
    // gestor clicou na volta na lista.
    let idaAtual: Corrida = c
    let voltaAtual: Corrida | null = par
    if (par && par.data_hora < c.data_hora) {
      idaAtual = par
      voltaAtual = c
    }

    setCorridaFicha(idaAtual)
    setVoltaDaFicha(voltaAtual)
    setMotoristaFicha(idaAtual.motorista_id ?? '')
    setModalFichaAberto(true)
  }

  function diaSemana(dataHora: string): string {
    const dias = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
    const d = new Date(dataHora)
    return dias[d.getDay()]
  }

  function montarMsgDetalhada(c: Corrida, motoristaId: string): string {
    const motorista = motoristasOpcoes.find(m => m.id === motoristaId)
    const data = `${c.data_hora.slice(8,10)}/${c.data_hora.slice(5,7)}/${c.data_hora.slice(0,4)}`
    const hora = c.data_hora.slice(11,16)
    const dia = diaSemana(c.data_hora)
    const num = c.numero_reserva ?? c.id.slice(-5).toUpperCase()

    // Passageiro 1 (quem viaja) é diferente do responsável quando preenchido.
    // Se não veio (reservas antigas ou responsável = passageiro), cai no
    // cliente_nome/telefone pra manter compatibilidade.
    let passageiros = c.passageiro1_nome || c.cliente_nome
    let telefones = c.passageiro1_telefone || c.cliente_telefone || ''
    if (c.nome_passageiro2) passageiros += `, ${c.nome_passageiro2}`
    if (c.telefone_passageiro2) telefones += telefones ? `, ${c.telefone_passageiro2}` : c.telefone_passageiro2
    for (const p of c.passageiros_adicionais || []) {
      if (p.nome) passageiros += `, ${p.nome}`
      if (p.telefone) telefones += telefones ? `, ${p.telefone}` : p.telefone
    }

    let msg = `Olá, tudo bem?\n\nSegue a confirmação do Transfer: ${num}`
    msg += `\n📅 *Data/Hora:* ${data} às ${hora} (${dia})`
    msg += `\n\n👤 *Passageiros:* ${passageiros}`
    if (telefones) msg += `\n📞 *Telefones:* ${telefones}`
    msg += `\n\n📍 *Origem:* ${c.origem}`
    msg += `\n📍 *Destino:* ${c.destino}`
    if (c.numero_voo) msg += `\n✈️ *Voo:* ${c.numero_voo}`
    if (motorista) {
      msg += `\n\n🚗 *Motorista:* ${motorista.nome}`
      if (motorista.veiculo) msg += `\n🚙 *Carro:* ${motorista.veiculo}${motorista.cor ? ` - ${motorista.cor}` : ''}`
      if (motorista.placa) msg += `\n🔢 *Placa:* ${motorista.placa}`
      if (motorista.telefone) msg += `\n📞 *Tel motorista:* ${motorista.telefone}`
    }
    if (c.retorno_data) {
      const retData = `${c.retorno_data.slice(8,10)}/${c.retorno_data.slice(5,7)}/${c.retorno_data.slice(0,4)}`
      msg += `\n\n🔄 *Retorno:* ${retData}${c.retorno_horario ? ` às ${c.retorno_horario.slice(0,5)}` : ''}`
      if (c.retorno_origem) msg += `\n📍 ${c.retorno_origem} → ${c.retorno_destino}`
    }
    if (c.observacoes) msg += `\n\n📝 *Obs:* ${c.observacoes}`
    if (empresaNome) msg += `\n\n*${empresaNome.toUpperCase()}*`
    return msg
  }

  async function enviarEmailConfirmacao(c: Corrida) {
    if (!c.email_solicitante) return
    setEnviandoEmail(true)
    try {
      const res = await fetch('/api/enviar-confirmacao-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: c.email_solicitante,
          cliente_nome: c.cliente_nome,
          origem: c.origem,
          destino: c.destino,
          data_hora: c.data_hora,
          numero_reserva: c.numero_reserva,
          numero_voo: c.numero_voo,
          observacoes: c.observacoes,
          empresa_nome: empresaNome,
        }),
      })
      if (res.ok) {
        alert('Confirmação enviada por e-mail!')
      } else {
        alert('Erro ao enviar e-mail. Tente novamente.')
      }
    } catch {
      alert('Erro ao enviar e-mail. Tente novamente.')
    } finally {
      setEnviandoEmail(false)
    }
  }

  function enviarWhatsAppConfirmacao(c: Corrida) {
    const tel = (c.cliente_telefone || '').replace(/\D/g, '')
    if (!tel) return
    const telFmt = tel.startsWith('55') ? tel : `55${tel}`
    const data = `${c.data_hora.slice(8,10)}/${c.data_hora.slice(5,7)}/${c.data_hora.slice(0,4)}`
    const hora = c.data_hora.slice(11,16)
    const dia = diaSemana(c.data_hora)
    const template = mensagemConfirmacaoTransfer
      || 'Olá {nome}, tudo bem!\n\nConfirmamos o seu transfer:\n\n📅 *Data/Hora:* {data} às {hora} ({dia})\n📍 *Origem:* {origem}\n📍 *Destino:* {destino}'
    let msg = template
      .replaceAll('{nome}', c.cliente_nome)
      .replaceAll('{data}', data)
      .replaceAll('{hora}', hora)
      .replaceAll('{dia}', dia)
      .replaceAll('{origem}', c.origem)
      .replaceAll('{destino}', c.destino)
    if (c.numero_voo) msg += `\n✈️ *Voo:* ${c.numero_voo}`
    if (c.retorno_data) {
      const retData = `${c.retorno_data.slice(8,10)}/${c.retorno_data.slice(5,7)}/${c.retorno_data.slice(0,4)}`
      msg += `\n\n🔄 *Retorno:* ${retData}${c.retorno_horario ? ` às ${c.retorno_horario.slice(0,5)}` : ''}`
      if (c.retorno_origem) msg += `\n📍 ${c.retorno_origem} → ${c.retorno_destino}`
    }
    if (c.observacoes) msg += `\n\n📝 *Obs:* ${c.observacoes}`
    msg += `\n\nEm breve informaremos o motorista responsável. Qualquer dúvida estamos à disposição!`
    if (empresaNome) msg += `\n\n*${empresaNome.toUpperCase()}*`
    window.open(`https://wa.me/${telFmt}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function enviarWhatsAppClienteComMotorista(c: Corrida, motoristaId: string) {
    const tel = (c.cliente_telefone || '').replace(/\D/g, '')
    if (!tel) { alert('Cliente não tem telefone cadastrado.'); return }
    const telFmt = tel.startsWith('55') ? tel : `55${tel}`
    const msg = montarMsgDetalhada(c, motoristaId)
    window.open(`https://wa.me/${telFmt}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function enviarWhatsAppMotorista(c: Corrida, motoristaId: string) {
    const motorista = motoristasOpcoes.find(m => m.id === motoristaId)
    if (!motorista) return
    const tel = motorista.telefone?.replace(/\D/g, '')
    if (!tel) { alert(`Motorista ${motorista.nome} não tem telefone cadastrado.`); return }
    const telFmt = tel.startsWith('55') ? tel : `55${tel}`
    const msg = montarMsgDetalhada(c, motoristaId)
    window.open(`https://wa.me/${telFmt}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function marcarConfirmada(c: Corrida) {
    setConfirmandoFicha(true)
    await supabase.from('corridas_empresa').update({ status: 'confirmada' }).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, status: 'confirmada' } : x))
    setCorridaFicha(prev => prev ? { ...prev, status: 'confirmada' } : prev)
    setConfirmandoFicha(false)
  }

  async function marcarEmAndamento(c: Corrida, motoristaId: string) {
    setConfirmandoFicha(true)
    const upd: Record<string, unknown> = { status: 'em_andamento' }
    if (motoristaId) upd.motorista_id = motoristaId
    const motorista = motoristasOpcoes.find(m => m.id === motoristaId) ?? null
    await supabase.from('corridas_empresa').update(upd).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, status: 'em_andamento', motorista_id: motoristaId || x.motorista_id, motoristas_empresa: motorista ? { nome: motorista.nome } : x.motoristas_empresa } : x))
    setCorridaFicha(prev => prev ? { ...prev, status: 'em_andamento', motorista_id: motoristaId || prev.motorista_id } : prev)
    setConfirmandoFicha(false)
  }

  async function recusarFicha(c: Corrida) {
    setConfirmandoFicha(true)
    await supabase.from('corridas_empresa').update({ status: 'recusada' }).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, status: 'recusada' } : x))
    setConfirmandoFicha(false)
    setModalFichaAberto(false)
  }

  async function marcarConcluida(c: Corrida) {
    setConfirmandoFicha(true)
    await supabase.from('corridas_empresa').update({ status: 'concluida' }).eq('id', c.id)
    setCorridas(prev => prev.map(x => x.id === c.id ? { ...x, status: 'concluida' } : x))
    setCorridaFicha(prev => prev ? { ...prev, status: 'concluida' } : prev)
    setConfirmandoFicha(false)
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
        ...(formAg.rota_empresa_id ? { rota_id: formAg.rota_empresa_id } : {}),
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
        rota_id: formAg.rota_empresa_id || null,
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

  function navegarDia(delta: number) {
    const d = new Date(filtroData + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const nova = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    setFiltroData(nova)
    setVerTodos(false)
  }

  const corridasFiltradas = (() => {
    let list = verTodos ? corridas : corridas.filter(c => c.data_hora.slice(0, 10) === filtroData)
    if (filtroRotaId) list = list.filter(c => c.rota_id === filtroRotaId)
    if (filtroStatus) list = list.filter(c => c.status === filtroStatus)
    return list
  })()
  const agendamentosFiltrados = (() => {
    let list = verTodos ? agendamentosRF : agendamentosRF.filter(ag => ag.data_viagem === filtroData)
    // Filtro de rota: quando o gestor escolhe uma rota especifica, so aparecem
    // os passageiros vinculados a ela. "Todas as rotas" (filtroRotaId vazio)
    // mostra tudo.
    if (filtroRotaId) list = list.filter(ag => ag.rota_id === filtroRotaId)
    return list
  })()
  const corridasAgrupadas = agruparPares(corridasFiltradas)
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

        {/* Seletor de rota (rota_fixa) */}
        {tipoOperacao === 'rota_fixa' && rotasOpcoes.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 px-3 py-2">
            <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Rota</p>
            <select
              value={filtroRotaId}
              onChange={e => setFiltroRotaId(e.target.value)}
              className="w-full text-sm font-semibold text-gray-800 bg-transparent outline-none"
            >
              <option value="">Todas as rotas</option>
              {rotasOpcoes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.nome || `${r.origem} → ${r.destino}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filtro de data */}
        <div className="bg-white rounded-2xl border border-gray-100 flex items-center px-2 py-2 gap-1">
          <button
            onClick={() => navegarDia(-1)}
            disabled={verTodos}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-xl font-bold flex-shrink-0 disabled:opacity-25"
            style={{ background: '#f9fafb', color: '#0F6E56' }}>
            ‹
          </button>
          <label className="flex-1 text-center cursor-pointer py-1 block">
            <input
              type="date"
              value={filtroData}
              onChange={e => { if (e.target.value) { setFiltroData(e.target.value); setVerTodos(false) } }}
              className="sr-only"
            />
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {verTodos ? 'Todos os fretamentos' : filtroData === HOJE ? 'Hoje' : formatarDataFiltro(filtroData)}
            </p>
            {!verTodos && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {filtroData === HOJE ? formatarDataFiltro(filtroData) : filtroData.split('-').reverse().join('/')}
              </p>
            )}
          </label>
          <button
            onClick={() => navegarDia(1)}
            disabled={verTodos}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-xl font-bold flex-shrink-0 disabled:opacity-25"
            style={{ background: '#f9fafb', color: '#0F6E56' }}>
            ›
          </button>
          {!verTodos ? (
            <button
              onClick={() => setVerTodos(true)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 flex-shrink-0"
              style={{ color: '#6B7280', background: '#f9fafb' }}>
              Ver todos
            </button>
          ) : (
            <button
              onClick={() => { setFiltroData(HOJE); setVerTodos(false) }}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border flex-shrink-0"
              style={{ color: '#0F6E56', borderColor: '#9FE1CB', background: '#E1F5EE' }}>
              Hoje
            </button>
          )}
        </div>

        {/* Filtro de status */}
        {tipoOperacao !== 'rota_fixa' && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {[
              { value: '', label: 'Todas' },
              { value: 'pendente', label: 'Pendente' },
              { value: 'confirmada', label: 'Confirmada' },
              { value: 'em_andamento', label: 'Em andamento' },
              { value: 'concluida', label: 'Concluída' },
            ].map(op => (
              <button
                key={op.value}
                onClick={() => setFiltroStatus(op.value)}
                className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all"
                style={filtroStatus === op.value
                  ? { background: '#0F6E56', color: '#fff' }
                  : { background: '#f3f4f6', color: '#6b7280' }}>
                {op.label}
              </button>
            ))}
          </div>
        )}

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
        <button onClick={abrirNovaCorrida}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#1D9E75', color: '#fff' }}>
          + Nova corrida
        </button>

        {/* Lista de corridas e agendamentos */}
        {corridasFiltradas.length === 0 && agendamentosFiltrados.length === 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-3xl mb-2">📋</p>
            {!verTodos && filtroData === HOJE ? (
              <>
                <p className="text-sm text-gray-500">Nenhum fretamento para hoje.</p>
                <button
                  onClick={() => setVerTodos(true)}
                  className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl border"
                  style={{ color: '#0F6E56', borderColor: '#9FE1CB', background: '#E1F5EE' }}>
                  Ver todos os fretamentos
                </button>
              </>
            ) : !verTodos ? (
              <>
                <p className="text-sm text-gray-500">Nenhum fretamento neste dia.</p>
                <button
                  onClick={() => setVerTodos(true)}
                  className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl border"
                  style={{ color: '#0F6E56', borderColor: '#9FE1CB', background: '#E1F5EE' }}>
                  Ver todos os fretamentos
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">Nenhum agendamento ainda.</p>
                <p className="text-xs text-gray-400 mt-1">
                  {tipoOperacao === 'rota_fixa' ? 'Toque em "+ Agendar passageiro" para começar.' : 'Toque em "+ Nova corrida" para começar.'}
                </p>
              </>
            )}
          </div>
        )}
        {corridasFiltradas.length > 0 && (
          <div className="flex flex-col gap-2">
            {corridasAgrupadas.map(grupo => {

              /* ── Card simples ── */
              if (grupo.tipo === 'simples') {
                const c = grupo.corrida
                const cor = STATUS_COR[c.status] ?? STATUS_COR.confirmada
                const nomeMotorista = c.motoristas_empresa?.nome ?? null
                const tm = tipoMeta(c.tipo_servico)
                // Detecta ida-e-volta feito pelo LINK PUBLICO — nao gera 2 linhas
                // separadas (que agruparPares detectaria), so preenche retorno_*
                // na propria corrida. Precisamos mostrar os 2 trechos e as 2 datas
                // no card, igual fazemos pro caso do gestor.
                const temVolta = !!c.retorno_data
                const dataIda = `${c.data_hora.slice(8, 10)}/${c.data_hora.slice(5, 7)}/${c.data_hora.slice(0, 4)}`
                const horaIda = c.data_hora.slice(11, 16)
                const dataVolta = c.retorno_data ? `${c.retorno_data.slice(8, 10)}/${c.retorno_data.slice(5, 7)}/${c.retorno_data.slice(0, 4)}` : null
                const horaVolta = c.retorno_horario ? c.retorno_horario.slice(0, 5) : null
                return (
                  <div key={c.id} className="bg-white rounded-2xl p-4 border border-gray-100" onClick={() => podeAbrirFichaTransfer(c) ? abrirFicha(c) : undefined} style={{ cursor: podeAbrirFichaTransfer(c) ? 'pointer' : undefined }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: tm.bg, color: tm.text }}>
                            {tm.badge}
                          </span>
                          {temVolta && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                              ↔ Ida e volta
                            </span>
                          )}
                        </div>
                        {temVolta ? (
                          <>
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              ↗ {c.origem} → {c.destino}
                            </p>
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              ↙ {c.retorno_origem || c.destino} → {c.retorno_destino || c.origem}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Ida {dataIda} {horaIda}
                              {dataVolta && ` · Volta ${dataVolta}${horaVolta ? ` ${horaVolta}` : ''}`}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {c.origem} → {c.destino}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {dataIda} às {horaIda}
                            </p>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: cor.bg, color: cor.text }}>
                        {cor.label}
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2"
                      style={{ borderTop: '1px solid #f5f5f5', paddingTop: '8px' }}>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400">{tm.clienteLabel}</p>
                        <p className="text-xs font-medium text-gray-700 truncate">{c.cliente_nome}</p>
                        {c.cliente_telefone && (
                          <p className="text-xs text-gray-400 mt-0.5">📞 {c.cliente_telefone}</p>
                        )}
                        {nomeMotorista && (
                          <p className="text-xs text-gray-400 mt-0.5">🚗 {nomeMotorista}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                          R$ {Number(c.valor).toFixed(2).replace('.', ',')}
                        </p>
                        {c.status === 'pendente' && (
                          <button onClick={() => abrirFicha(c)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                            style={{ background: '#FEF3C7', color: '#92400E' }}>
                            Ver ficha
                          </button>
                        )}
                        {c.status !== 'pendente' && (
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
                        {(c.status === 'cancelada' || c.status === 'recusada') && (
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
              const tmPar = tipoMeta(ida.tipo_servico)

              return (
                <div key={`${ida.id}-${volta.id}`} className="bg-white rounded-2xl p-4 border border-gray-100" onClick={() => podeAbrirFichaTransfer(ida) ? abrirFicha(ida) : undefined} style={{ cursor: podeAbrirFichaTransfer(ida) ? 'pointer' : undefined }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: tmPar.bg, color: tmPar.text }}>
                          {tmPar.badge}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                          ↔ Ida e volta
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        ↗ {ida.origem} → {ida.destino}
                      </p>
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        ↙ {volta.origem} → {volta.destino}
                      </p>
                      {(() => {
                        const dataIda = `${ida.data_hora.slice(8, 10)}/${ida.data_hora.slice(5, 7)}/${ida.data_hora.slice(0, 4)}`
                        const dataVolta = `${volta.data_hora.slice(8, 10)}/${volta.data_hora.slice(5, 7)}/${volta.data_hora.slice(0, 4)}`
                        const horaIda = ida.data_hora.slice(11, 16)
                        const horaVolta = volta.data_hora.slice(11, 16)
                        return (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {dataIda === dataVolta
                              ? `Ida ${horaIda} · Volta ${horaVolta} · ${dataIda}`
                              : `Ida ${dataIda} ${horaIda} · Volta ${dataVolta} ${horaVolta}`}
                          </p>
                        )
                      })()}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                      style={{ background: cor.bg, color: cor.text }}>
                      {cor.label}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2"
                    style={{ borderTop: '1px solid #f5f5f5', paddingTop: '8px' }}>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400">{tmPar.clienteLabel}</p>
                      <p className="text-xs font-medium text-gray-700 truncate">{ida.cliente_nome}</p>
                      {ida.cliente_telefone && (
                        <p className="text-xs text-gray-400 mt-0.5">📞 {ida.cliente_telefone}</p>
                      )}
                      {nomeMotorista && (
                        <p className="text-xs text-gray-400 mt-0.5">🚗 {nomeMotorista}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm font-bold" style={{ color: '#0F6E56' }}>
                        R$ {valorTotal.toFixed(2).replace('.', ',')}
                      </p>
                      {ida.status !== 'pendente' && (
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
        {tipoOperacao === 'rota_fixa' && agendamentosFiltrados.length > 0 && (
          <div className="flex flex-col gap-2">
            {corridasFiltradas.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Passageiros agendados</p>
            )}
            {agendamentosFiltrados.map(ag => {
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
                        <p className="text-xs text-gray-400 mt-0.5">🚗 {nomeMotorista}</p>
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
            {tipoOperacao === 'rota_fixa' && agendamentosFiltrados.length > 0 && (
              <button
                onClick={() => setModalPDFAberto(true)}
                className="w-full py-3 rounded-xl text-sm font-semibold mt-3 flex items-center justify-center gap-2"
                style={{ background: '#E6F1FB', color: '#185FA5' }}>
                📋 Gerar lista de passageiros (PDF)
              </button>
            )}
          </div>
        )}
      </div>

      {modalPDFAberto && (() => {
        const primeiraRota = rotasOpcoes[0]
        const primeiroMot = motoristasOpcoes[0]
        return (
          <ModalListaPassageirosPDF
            diaSelecionado={new Date(filtroData + 'T00:00:00')}
            passageiros={agendamentosFiltrados.map(ag => ({ id: ag.id, nome: ag.nome_passageiro }))}
            nomeMotoristaSugerido={primeiroMot?.nome || ''}
            origemSugerida={primeiraRota?.origem || ''}
            destinoSugerido={primeiraRota?.destino || ''}
            tituloEvento="ROTA FIXA"
            onFechar={() => setModalPDFAberto(false)}
          />
        )
      })()}

      {/* Modal ficha de solicitação pendente (transfer) */}
      {modalFichaAberto && corridaFicha && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalFichaAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <div className="flex-1">
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Solicitação de Transfer</p>
            </div>
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full"
              style={{ background: STATUS_COR[corridaFicha.status]?.bg ?? '#FEF3C7', color: STATUS_COR[corridaFicha.status]?.text ?? '#92400E' }}>
              {STATUS_COR[corridaFicha.status]?.label ?? corridaFicha.status}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 flex flex-col gap-3">

            {/* Viagem */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Viagem</p>
                {corridaFicha.tipo_servico !== 'fretamento' && corridaFicha.tipo_servico !== 'excursao' && (() => {
                  const idsAcao = voltaDaFicha ? [corridaFicha.id, voltaDaFicha.id] : [corridaFicha.id]
                  const statusFicha = corridaFicha.status
                  const eCancelada = statusFicha === 'cancelada' || (voltaDaFicha && voltaDaFicha.status === 'cancelada')
                  const eConcluida = statusFicha === 'concluida'
                  return (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          const c = corridaFicha
                          const voltaId = voltaDaFicha?.id
                          setModalFichaAberto(false)
                          abrirEditar(c, voltaId)
                        }}
                        title="Editar"
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                        ✏️
                      </button>
                      {!eCancelada && !eConcluida && (
                        <button
                          onClick={async () => {
                            if (!confirm('Cancelar este agendamento? Os dados ficam salvos e você pode reativar depois.')) return
                            await cancelarCorrida(idsAcao)
                            setCorridaFicha(prev => prev ? { ...prev, status: 'cancelada' } : prev)
                            setVoltaDaFicha(prev => prev ? { ...prev, status: 'cancelada' } : prev)
                          }}
                          title="Cancelar (mantém os dados)"
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                          ❌ Cancelar
                        </button>
                      )}
                      {eCancelada && (
                        <button
                          onClick={async () => {
                            await reativarCorrida(idsAcao)
                            setCorridaFicha(prev => prev ? { ...prev, status: 'pendente' } : prev)
                            setVoltaDaFicha(prev => prev ? { ...prev, status: 'pendente' } : prev)
                          }}
                          title="Reativar agendamento"
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                          ↩️ Reativar
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm('Apagar definitivamente este agendamento? Os dados serão perdidos.')) return
                          for (const id of idsAcao) {
                            await supabase.from('corridas_empresa').delete().eq('id', id)
                          }
                          setCorridas(prev => prev.filter(c => !idsAcao.includes(c.id)))
                          setModalFichaAberto(false)
                        }}
                        title="Excluir definitivamente"
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                        style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                        🗑️
                      </button>
                    </div>
                  )
                })()}
              </div>
              {corridaFicha.tipo_servico === 'diaria' || corridaFicha.tipo_servico === 'city_tour' ? (
                <p className="text-base font-bold text-gray-800">📍 {corridaFicha.origem}</p>
              ) : (
                <p className="text-base font-bold text-gray-800">{corridaFicha.origem} → {corridaFicha.destino}</p>
              )}
              <p className="text-sm text-gray-600">
                {corridaFicha.tipo_servico === 'diaria' || corridaFicha.tipo_servico === 'city_tour' ? '▶️ Início: ' : '📅 '}
                {corridaFicha.data_hora.slice(8,10)}/{corridaFicha.data_hora.slice(5,7)}/{corridaFicha.data_hora.slice(0,4)} às {corridaFicha.data_hora.slice(11,16)}
              </p>
              {corridaFicha.data_hora_termino && (corridaFicha.tipo_servico === 'diaria' || corridaFicha.tipo_servico === 'city_tour') && (
                <p className="text-sm text-gray-600">
                  ⏹️ Término: {corridaFicha.data_hora_termino.slice(8,10)}/{corridaFicha.data_hora_termino.slice(5,7)}/{corridaFicha.data_hora_termino.slice(0,4)} às {corridaFicha.data_hora_termino.slice(11,16)}
                </p>
              )}
              {Array.isArray(corridaFicha.trajetos) && corridaFicha.trajetos.length > 0 && (
                <div className="rounded-xl p-3 mt-1" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#166534' }}>🗺️ Trajetos ({corridaFicha.trajetos.length})</p>
                  <ol className="text-sm text-gray-700 flex flex-col gap-0.5" style={{ paddingLeft: '18px', listStyleType: 'decimal' }}>
                    {corridaFicha.trajetos.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ol>
                </div>
              )}
              {corridaFicha.numero_voo && (
                <p className="text-sm text-gray-600">✈️ Voo: {corridaFicha.numero_voo}</p>
              )}
              {corridaFicha.forma_pagamento && corridaFicha.forma_pagamento !== 'a_definir' && (
                <p className="text-sm text-gray-600">💳 Pagamento: {{
                  cartao: 'Cartão', pix: 'Pix', faturado: 'Faturado',
                  dinheiro: 'Dinheiro'
                }[corridaFicha.forma_pagamento] ?? corridaFicha.forma_pagamento}</p>
              )}
              {Number(corridaFicha.valor) > 0 && (
                <p className="text-sm font-semibold" style={{ color: '#0F6E56' }}>
                  R$ {Number(corridaFicha.valor).toFixed(2).replace('.', ',')}
                </p>
              )}
              {corridaFicha.status_pagamento === 'recebido' && corridaFicha.data_pagamento && (
                <p className="text-xs mt-1" style={{ color: '#0F6E56' }}>
                  ✅ Recebido em {corridaFicha.data_pagamento.slice(8,10)}/{corridaFicha.data_pagamento.slice(5,7)}/{corridaFicha.data_pagamento.slice(0,4)}
                </p>
              )}
              {corridaFicha.status_pagamento !== 'recebido' && corridaFicha.data_prevista_pagamento && (
                <p className="text-xs mt-1 text-gray-500">
                  🕐 Previsão de recebimento: {corridaFicha.data_prevista_pagamento.slice(8,10)}/{corridaFicha.data_prevista_pagamento.slice(5,7)}/{corridaFicha.data_prevista_pagamento.slice(0,4)}
                </p>
              )}
            </div>

            {/* Volta (quando o agendamento foi feito como ida-e-volta) */}
            {voltaDaFicha && (
              <div className="rounded-2xl p-4 border" style={{ background: '#EEEDFE', borderColor: '#AFA9EC' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#3C3489' }}>🔁 Volta</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: STATUS_COR[voltaDaFicha.status]?.bg ?? '#FEF3C7', color: STATUS_COR[voltaDaFicha.status]?.text ?? '#92400E' }}>
                    {STATUS_COR[voltaDaFicha.status]?.label ?? voltaDaFicha.status}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-800">{voltaDaFicha.origem} → {voltaDaFicha.destino}</p>
                <p className="text-sm text-gray-600 mt-1">
                  📅 {voltaDaFicha.data_hora.slice(8,10)}/{voltaDaFicha.data_hora.slice(5,7)}/{voltaDaFicha.data_hora.slice(0,4)} às {voltaDaFicha.data_hora.slice(11,16)}
                </p>
                {Number(voltaDaFicha.valor) > 0 && (
                  <p className="text-sm font-semibold mt-1" style={{ color: '#3C3489' }}>
                    R$ {Number(voltaDaFicha.valor).toFixed(2).replace('.', ',')}
                  </p>
                )}
                {voltaDaFicha.observacoes && (
                  <p className="text-xs text-gray-500 mt-2">📝 {voltaDaFicha.observacoes}</p>
                )}
              </div>
            )}

            {/* Responsável pela solicitação */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {tipoMeta(corridaFicha.tipo_servico).clienteLabel === 'Responsável' ? 'Responsável pela solicitação' : tipoMeta(corridaFicha.tipo_servico).clienteLabel}
              </p>
              <p className="text-sm font-semibold text-gray-800">👤 {corridaFicha.cliente_nome}</p>
              {corridaFicha.cliente_telefone && (
                <p className="text-sm text-gray-600">📞 {corridaFicha.cliente_telefone}</p>
              )}
              {corridaFicha.email_solicitante && (
                <p className="text-sm text-gray-600">✉️ {corridaFicha.email_solicitante}</p>
              )}
            </div>

            {/* Passageiro 1 — quem efetivamente viaja (pode ser diferente do responsável) */}
            {(corridaFicha.passageiro1_nome || corridaFicha.rua || corridaFicha.rua_desembarque || corridaFicha.numero_voo) && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🧍 Passageiro 1</p>
                <p className="text-sm font-semibold text-gray-800">👤 {corridaFicha.passageiro1_nome || corridaFicha.cliente_nome}</p>
                {corridaFicha.passageiro1_telefone && (
                  <p className="text-sm text-gray-600">📞 {corridaFicha.passageiro1_telefone}</p>
                )}
                {corridaFicha.numero_voo && (
                  <p className="text-sm text-gray-600">✈️ Voo: {corridaFicha.numero_voo}</p>
                )}
                {(corridaFicha.rua || corridaFicha.numero || corridaFicha.bairro || corridaFicha.municipio || corridaFicha.cep || corridaFicha.referencia) && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">📍 Embarque</p>
                    <p className="text-sm text-gray-700">{[corridaFicha.rua, corridaFicha.numero].filter(Boolean).join(', ')}</p>
                    <p className="text-sm text-gray-700">{[corridaFicha.bairro, corridaFicha.municipio].filter(Boolean).join(' - ')}</p>
                    {corridaFicha.cep && <p className="text-xs text-gray-400">CEP: {corridaFicha.cep}</p>}
                    {corridaFicha.referencia && <p className="text-xs text-gray-500">📌 {corridaFicha.referencia}</p>}
                  </div>
                )}
                {(corridaFicha.rua_desembarque || corridaFicha.numero_desembarque || corridaFicha.bairro_desembarque || corridaFicha.municipio_desembarque || corridaFicha.cep_desembarque || corridaFicha.referencia_desembarque) && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🏁 Desembarque</p>
                    <p className="text-sm text-gray-700">{[corridaFicha.rua_desembarque, corridaFicha.numero_desembarque].filter(Boolean).join(', ')}</p>
                    <p className="text-sm text-gray-700">{[corridaFicha.bairro_desembarque, corridaFicha.municipio_desembarque].filter(Boolean).join(' - ')}</p>
                    {corridaFicha.cep_desembarque && <p className="text-xs text-gray-400">CEP: {corridaFicha.cep_desembarque}</p>}
                    {corridaFicha.referencia_desembarque && <p className="text-xs text-gray-500">📌 {corridaFicha.referencia_desembarque}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Passageiro adicional */}
            {corridaFicha.nome_passageiro2 && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Passageiro adicional</p>
                <p className="text-sm font-semibold text-gray-800">👤 {corridaFicha.nome_passageiro2}</p>
                {corridaFicha.telefone_passageiro2 && (
                  <p className="text-sm text-gray-600">📞 {corridaFicha.telefone_passageiro2}</p>
                )}
              </div>
            )}

            {/* Mais passageiros (lista repetível, cada um com sua ficha) */}
            {(corridaFicha.passageiros_adicionais || []).map((p, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Passageiro {idx + (corridaFicha.nome_passageiro2 ? 3 : 2)}</p>
                <p className="text-sm font-semibold text-gray-800">👤 {p.nome}</p>
                {p.telefone && <p className="text-sm text-gray-600">📞 {p.telefone}</p>}
                {(p.rua || p.numero || p.bairro || p.municipio || p.cep || p.referencia) && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">📍 Embarque</p>
                    <p className="text-sm text-gray-700">{[p.rua, p.numero].filter(Boolean).join(', ')}</p>
                    <p className="text-sm text-gray-700">{[p.bairro, p.municipio].filter(Boolean).join(' - ')}</p>
                    {p.cep && <p className="text-xs text-gray-400">CEP: {p.cep}</p>}
                    {p.referencia && <p className="text-xs text-gray-500">📌 {p.referencia}</p>}
                  </div>
                )}
                {(p.rua_desembarque || p.numero_desembarque || p.bairro_desembarque || p.municipio_desembarque || p.cep_desembarque || p.referencia_desembarque) && (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🏁 Desembarque</p>
                    <p className="text-sm text-gray-700">{[p.rua_desembarque, p.numero_desembarque].filter(Boolean).join(', ')}</p>
                    <p className="text-sm text-gray-700">{[p.bairro_desembarque, p.municipio_desembarque].filter(Boolean).join(' - ')}</p>
                    {p.cep_desembarque && <p className="text-xs text-gray-400">CEP: {p.cep_desembarque}</p>}
                    {p.referencia_desembarque && <p className="text-xs text-gray-500">📌 {p.referencia_desembarque}</p>}
                  </div>
                )}
              </div>
            ))}

            {!!corridaFicha.quantidade_bagagem && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-sm text-gray-700">🧳 {corridaFicha.quantidade_bagagem} {corridaFicha.quantidade_bagagem === 1 ? 'mala/volume' : 'malas/volumes'}</p>
              </div>
            )}

            {/* Retorno */}
            {corridaFicha.retorno_data && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Retorno solicitado</p>
                <p className="text-sm text-gray-600">
                  📅 {corridaFicha.retorno_data.slice(8,10)}/{corridaFicha.retorno_data.slice(5,7)}/{corridaFicha.retorno_data.slice(0,4)}
                  {corridaFicha.retorno_horario && ` às ${corridaFicha.retorno_horario.slice(0,5)}`}
                </p>
                {(corridaFicha.retorno_origem || corridaFicha.retorno_destino) && (
                  <p className="text-sm text-gray-800 font-medium">
                    {corridaFicha.retorno_origem} → {corridaFicha.retorno_destino}
                  </p>
                )}
              </div>
            )}

            {/* Observações */}
            {corridaFicha.observacoes && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Observações</p>
                <p className="text-sm text-gray-700 leading-relaxed">{corridaFicha.observacoes}</p>
              </div>
            )}

            {/* Motorista — só aparece em "Confirmada" para definição */}
            {corridaFicha.status === 'confirmada' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Definir motorista</p>
                {motoristasOpcoes.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum motorista ativo cadastrado</p>
                ) : (
                  <select
                    value={motoristaFicha}
                    onChange={e => setMotoristaFicha(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white outline-none">
                    <option value="">Selecione o motorista...</option>
                    {motoristasOpcoes.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Ações — Pendente: confirmar com cliente */}
            {corridaFicha.status === 'pendente' && (
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => enviarEmailConfirmacao(corridaFicha)}
                  disabled={!corridaFicha.email_solicitante || enviandoEmail}
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#2563EB' }}>
                  {enviandoEmail ? 'Enviando...' : '✉️ Enviar confirmação por e-mail'}
                </button>
                <button
                  onClick={() => enviarWhatsAppConfirmacao(corridaFicha)}
                  disabled={!corridaFicha.cliente_telefone}
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#25D366' }}>
                  💬 Confirmar com cliente via WhatsApp
                </button>
                <button
                  onClick={() => marcarConfirmada(corridaFicha)}
                  disabled={confirmandoFicha}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold border disabled:opacity-40"
                  style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                  {confirmandoFicha ? 'Salvando...' : '✓ Mover para Confirmada'}
                </button>
                <button
                  onClick={() => recusarFicha(corridaFicha)}
                  disabled={confirmandoFicha}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold border disabled:opacity-40"
                  style={{ background: '#FCEBEB', color: '#A32D2D', borderColor: '#F5BCBC' }}>
                  Recusar solicitação
                </button>
              </div>
            )}

            {/* Ações — Confirmada: definir motorista e marcar em andamento */}
            {corridaFicha.status === 'confirmada' && (
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => enviarWhatsAppMotorista(corridaFicha, motoristaFicha)}
                  disabled={!motoristaFicha}
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#25D366' }}>
                  💬 Enviar ficha ao motorista
                </button>
                <button
                  onClick={() => enviarWhatsAppClienteComMotorista(corridaFicha, motoristaFicha)}
                  disabled={!motoristaFicha}
                  className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#128C7E' }}>
                  💬 Enviar ficha ao cliente
                </button>
                <button
                  onClick={() => marcarEmAndamento(corridaFicha, motoristaFicha)}
                  disabled={confirmandoFicha || !motoristaFicha}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold border disabled:opacity-40"
                  style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                  {confirmandoFicha ? 'Salvando...' : !motoristaFicha ? 'Selecione um motorista primeiro' : '✓ Marcar como Em andamento'}
                </button>
              </div>
            )}

            {/* Ações — Em andamento: reenviar fichas + marcar concluído */}
            {corridaFicha.status === 'em_andamento' && (
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => enviarWhatsAppMotorista(corridaFicha, corridaFicha.motorista_id ?? '')}
                  disabled={!corridaFicha.motorista_id}
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#25D366' }}>
                  💬 Reenviar ficha ao motorista
                </button>
                <button
                  onClick={() => enviarWhatsAppClienteComMotorista(corridaFicha, corridaFicha.motorista_id ?? '')}
                  disabled={!corridaFicha.motorista_id}
                  className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: '#128C7E' }}>
                  💬 Reenviar ficha ao cliente
                </button>
                <button
                  onClick={() => marcarConcluida(corridaFicha)}
                  disabled={confirmandoFicha}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold border disabled:opacity-40"
                  style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                  {confirmandoFicha ? 'Salvando...' : '✓ Marcar como Concluído'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                    <option value="diaria">Diária</option>
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

            <div className="rounded-xl px-3 py-3" style={{ background: '#E6F1FB' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#0C447C' }}>
                {form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? '🚗 Serviço' : '🚗 Ida'}
              </p>

              <Campo label={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Local de início *' : 'Origem *'}>
                <input
                  value={form.origem}
                  onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
                  readOnly={camposRotaBloqueados}
                  placeholder={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Ex: Aeroporto, hotel, residência do cliente' : 'Ex: Aeroporto Internacional'}
                  className="campo-input"
                  style={{
                    background: camposRotaBloqueados ? '#f9fafb' : '#fff',
                    color: camposRotaBloqueados ? '#6B7280' : '#222',
                  }}
                />
              </Campo>

              {form.tipo_servico !== 'diaria' && form.tipo_servico !== 'city_tour' && (
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
              )}

              <div className="grid grid-cols-2 gap-2">
                <Campo label={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Data de início *' : 'Data *'}>
                  <input type="date" value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="campo-input" />
                </Campo>
                <Campo label={form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour' ? 'Hora de início *' : 'Horário de saída *'}>
                  <SelectHorario value={form.horario}
                    onChange={v => setForm(f => ({ ...f, horario: v }))} />
                </Campo>
              </div>
            </div>

            {/* Diária e City Tour: término estimado (editável, opcional) + trajetos */}
            {(form.tipo_servico === 'diaria' || form.tipo_servico === 'city_tour') && (
              <>
                <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <p className="text-xs font-semibold" style={{ color: '#9A3412' }}>
                    ⏰ Previsão de término <span className="font-normal text-gray-500">(opcional — pode preencher depois quando o serviço acabar)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo label="Data de término">
                      <input type="date" value={form.data_termino}
                        onChange={e => setForm(f => ({ ...f, data_termino: e.target.value }))}
                        min={form.data}
                        className="campo-input" />
                    </Campo>
                    <Campo label="Hora de término">
                      <SelectHorario value={form.horario_termino}
                        onChange={v => setForm(f => ({ ...f, horario_termino: v }))} />
                    </Campo>
                  </div>
                </div>

                <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold" style={{ color: '#166534' }}>
                      🗺️ Trajetos percorridos
                    </p>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, trajetos: [...f.trajetos, ''] }))}
                      className="text-xs font-semibold" style={{ color: '#166534' }}>
                      + Adicionar
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Pode deixar vazio no cadastro. Adicione durante o serviço conforme os locais forem sendo visitados.
                  </p>
                  {form.trajetos.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Nenhum trajeto registrado ainda.</p>
                  )}
                  {form.trajetos.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-6">{idx + 1}.</span>
                      <input value={t}
                        onChange={e => setForm(f => ({ ...f, trajetos: f.trajetos.map((tt, i) => i === idx ? e.target.value : tt) }))}
                        placeholder="Ex: Fórmula 1, Salão do Automóvel, Restaurante Fasano..."
                        className="campo-input flex-1" />
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, trajetos: f.trajetos.filter((_, i) => i !== idx) }))}
                        className="text-xs font-semibold text-red-500 px-2">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!corridaEditando && form.tipo_servico !== 'diaria' && form.tipo_servico !== 'city_tour' && (
              <div className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div>
                  <p className="text-sm font-medium text-gray-700">Ida e volta?</p>
                  <p className="text-xs text-gray-400 mt-0.5">Cria dois agendamentos automaticamente</p>
                </div>
                <button
                  onClick={() => setForm(f => {
                    const ativando = !f.ida_volta
                    return {
                      ...f,
                      ida_volta: ativando,
                      horario_retorno: '',
                      origem_volta: ativando ? f.destino : '',
                      destino_volta: ativando ? f.origem : '',
                      data_retorno: ativando ? f.data : '',
                      preco_volta: ativando ? f.preco : '',
                      // Pré-preenche endereços da volta como inverso da ida
                      // (embarque volta = desembarque ida; desembarque volta = embarque ida)
                      rua_retorno_embarque:         ativando ? (f.rua_retorno_embarque         || f.rua_desembarque)         : '',
                      numero_retorno_embarque:      ativando ? (f.numero_retorno_embarque      || f.numero_desembarque)      : '',
                      bairro_retorno_embarque:      ativando ? (f.bairro_retorno_embarque      || f.bairro_desembarque)      : '',
                      municipio_retorno_embarque:   ativando ? (f.municipio_retorno_embarque   || f.municipio_desembarque)   : '',
                      cep_retorno_embarque:         ativando ? (f.cep_retorno_embarque         || f.cep_desembarque)         : '',
                      referencia_retorno_embarque:  ativando ? (f.referencia_retorno_embarque  || f.referencia_desembarque)  : '',
                      rua_retorno_desembarque:         ativando ? (f.rua_retorno_desembarque         || f.rua)         : '',
                      numero_retorno_desembarque:      ativando ? (f.numero_retorno_desembarque      || f.numero)      : '',
                      bairro_retorno_desembarque:      ativando ? (f.bairro_retorno_desembarque      || f.bairro)      : '',
                      municipio_retorno_desembarque:   ativando ? (f.municipio_retorno_desembarque   || f.municipio)   : '',
                      cep_retorno_desembarque:         ativando ? (f.cep_retorno_desembarque         || f.cep)         : '',
                      referencia_retorno_desembarque:  ativando ? (f.referencia_retorno_desembarque  || f.referencia)  : '',
                      passageiros_adicionais: f.passageiros_adicionais.map(p => ({
                        ...p,
                        rua_retorno_embarque:         ativando ? (p.rua_retorno_embarque         || p.rua_desembarque)         : '',
                        numero_retorno_embarque:      ativando ? (p.numero_retorno_embarque      || p.numero_desembarque)      : '',
                        bairro_retorno_embarque:      ativando ? (p.bairro_retorno_embarque      || p.bairro_desembarque)      : '',
                        municipio_retorno_embarque:   ativando ? (p.municipio_retorno_embarque   || p.municipio_desembarque)   : '',
                        cep_retorno_embarque:         ativando ? (p.cep_retorno_embarque         || p.cep_desembarque)         : '',
                        referencia_retorno_embarque:  ativando ? (p.referencia_retorno_embarque  || p.referencia_desembarque)  : '',
                        rua_retorno_desembarque:         ativando ? (p.rua_retorno_desembarque         || p.rua)         : '',
                        numero_retorno_desembarque:      ativando ? (p.numero_retorno_desembarque      || p.numero)      : '',
                        bairro_retorno_desembarque:      ativando ? (p.bairro_retorno_desembarque      || p.bairro)      : '',
                        municipio_retorno_desembarque:   ativando ? (p.municipio_retorno_desembarque   || p.municipio)   : '',
                        cep_retorno_desembarque:         ativando ? (p.cep_retorno_desembarque         || p.cep)         : '',
                        referencia_retorno_desembarque:  ativando ? (p.referencia_retorno_desembarque  || p.referencia)  : '',
                      })),
                    }
                  })}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ background: form.ida_volta ? '#1D9E75' : '#e5e7eb' }}>
                  <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ left: form.ida_volta ? '22px' : '2px' }} />
                </button>
              </div>
            )}

            {/* Bloco Volta — aparece em 3 casos:
                1. Criando nova corrida com ida-volta marcada
                2. Editando corrida do link publico (retorno_data na mesma linha)
                Nao aparece quando editando um PAR (voltaIdEditando != null), porque
                nesse caso a volta e outra linha completa e ha logica separada de
                atualizacao com origem_volta/destino_volta/etc. */}
            {!voltaIdEditando && form.ida_volta && (
              <div className="rounded-xl px-3 py-3" style={{ background: '#EEEDFE' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: '#3C3489' }}>🔁 Volta</p>
                  <button
                    onClick={() => setForm(f => ({
                      ...f,
                      origem_volta: f.destino,
                      destino_volta: f.origem,
                    }))}
                    type="button"
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ border: '1px solid #AFA9EC', color: '#3C3489' }}>
                    ↺ Inverter ida
                  </button>
                </div>

                <Campo label="Origem do retorno *">
                  <input value={form.origem_volta}
                    onChange={e => setForm(f => ({ ...f, origem_volta: e.target.value }))}
                    placeholder="Ex: Hotel Tropical" className="campo-input" />
                </Campo>

                <Campo label="Destino do retorno *">
                  <input value={form.destino_volta}
                    onChange={e => setForm(f => ({ ...f, destino_volta: e.target.value }))}
                    placeholder="Ex: Aeroporto Internacional" className="campo-input" />
                </Campo>

                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Data de retorno *">
                    <input type="date" value={form.data_retorno}
                      onChange={e => setForm(f => ({ ...f, data_retorno: e.target.value }))}
                      className="campo-input" />
                  </Campo>
                  <Campo label="Horário de retorno *">
                    <SelectHorario value={form.horario_retorno}
                      onChange={v => setForm(f => ({ ...f, horario_retorno: v }))} />
                  </Campo>
                </div>
              </div>
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

            <Campo label="Nome do solicitante *">
              <input value={form.cliente_nome}
                onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
                placeholder="Nome completo" className="campo-input" />
            </Campo>

            <Campo label="Telefone do solicitante">
              <input value={form.cliente_telefone}
                onChange={e => setForm(f => ({ ...f, cliente_telefone: e.target.value }))}
                placeholder="(XX) XXXXX-XXXX" className="campo-input" />
            </Campo>

            <Campo label="E-mail do solicitante">
              <input value={form.email_solicitante}
                onChange={e => setForm(f => ({ ...f, email_solicitante: e.target.value }))}
                placeholder="email@exemplo.com" type="email" className="campo-input" />
            </Campo>

            {/* Passageiro 1 (só transfer) — quem efetivamente viaja, ficha própria e obrigatória */}
            {tipoOperacao !== 'rota_fixa' && (
              <div className="rounded-2xl p-4 border-2 flex flex-col gap-3" style={{ borderColor: '#9FE1CB', background: '#fff' }}>
                <p className="text-sm font-semibold text-gray-700">🧍 Dados do Passageiro 1</p>
                <Campo label="Nome completo *">
                  <input value={form.passageiro1_nome}
                    onChange={e => setForm(f => ({ ...f, passageiro1_nome: e.target.value }))}
                    placeholder="Nome completo" className="campo-input" />
                </Campo>
                <Campo label="Telefone">
                  <input value={form.passageiro1_telefone}
                    onChange={e => setForm(f => ({ ...f, passageiro1_telefone: e.target.value }))}
                    placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
                </Campo>
                <Campo label="Número do voo">
                  <input value={form.numero_voo}
                    onChange={e => setForm(f => ({ ...f, numero_voo: e.target.value }))}
                    placeholder="Ex: G3 1234 (opcional)" className="campo-input" />
                </Campo>

                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">📍 Endereço de embarque <span className="normal-case font-normal">(opcional)</span></p>
                <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                  <Campo label="Rua / Logradouro">
                    <input value={form.rua} onChange={e => setForm(f => ({ ...f, rua: e.target.value }))}
                      placeholder="Ex: Rua das Flores" className="campo-input" />
                  </Campo>
                  <Campo label="Número">
                    <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                      placeholder="123" className="campo-input" />
                  </Campo>
                </div>
                <Campo label="Bairro">
                  <input value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))}
                    placeholder="Ex: Centro" className="campo-input" />
                </Campo>
                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Município">
                    <input value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))}
                      placeholder="Ex: São Paulo" className="campo-input" />
                  </Campo>
                  <Campo label="CEP">
                    <input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))}
                      placeholder="00000-000" className="campo-input" />
                  </Campo>
                </div>
                <Campo label="Ponto de referência">
                  <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                    placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                </Campo>

                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">🏁 Endereço de desembarque <span className="normal-case font-normal">(opcional)</span></p>
                <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                  <Campo label="Rua / Logradouro">
                    <input value={form.rua_desembarque} onChange={e => setForm(f => ({ ...f, rua_desembarque: e.target.value }))}
                      placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                  </Campo>
                  <Campo label="Número">
                    <input value={form.numero_desembarque} onChange={e => setForm(f => ({ ...f, numero_desembarque: e.target.value }))}
                      placeholder="456" className="campo-input" />
                  </Campo>
                </div>
                <Campo label="Bairro">
                  <input value={form.bairro_desembarque} onChange={e => setForm(f => ({ ...f, bairro_desembarque: e.target.value }))}
                    placeholder="Ex: Vila Nova" className="campo-input" />
                </Campo>
                <div className="grid grid-cols-2 gap-2">
                  <Campo label="Município">
                    <input value={form.municipio_desembarque} onChange={e => setForm(f => ({ ...f, municipio_desembarque: e.target.value }))}
                      placeholder="Ex: São Paulo" className="campo-input" />
                  </Campo>
                  <Campo label="CEP">
                    <input value={form.cep_desembarque} onChange={e => setForm(f => ({ ...f, cep_desembarque: e.target.value }))}
                      placeholder="00000-000" className="campo-input" />
                  </Campo>
                </div>
                <Campo label="Ponto de referência">
                  <input value={form.referencia_desembarque} onChange={e => setForm(f => ({ ...f, referencia_desembarque: e.target.value }))}
                    placeholder="Ex: Em frente à padaria" className="campo-input" />
                </Campo>

                {/* Endereços da volta (só se ida_volta ativo) */}
                {form.ida_volta && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🔁 Endereço de embarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={form.rua_retorno_embarque} onChange={e => setForm(f => ({ ...f, rua_retorno_embarque: e.target.value }))}
                          placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={form.numero_retorno_embarque} onChange={e => setForm(f => ({ ...f, numero_retorno_embarque: e.target.value }))}
                          placeholder="456" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={form.bairro_retorno_embarque} onChange={e => setForm(f => ({ ...f, bairro_retorno_embarque: e.target.value }))}
                        placeholder="Ex: Vila Nova" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={form.municipio_retorno_embarque} onChange={e => setForm(f => ({ ...f, municipio_retorno_embarque: e.target.value }))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={form.cep_retorno_embarque} onChange={e => setForm(f => ({ ...f, cep_retorno_embarque: e.target.value }))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={form.referencia_retorno_embarque} onChange={e => setForm(f => ({ ...f, referencia_retorno_embarque: e.target.value }))}
                        placeholder="Ex: Em frente à padaria" className="campo-input" />
                    </Campo>

                    <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🏁 Endereço de desembarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={form.rua_retorno_desembarque} onChange={e => setForm(f => ({ ...f, rua_retorno_desembarque: e.target.value }))}
                          placeholder="Ex: Rua das Flores" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={form.numero_retorno_desembarque} onChange={e => setForm(f => ({ ...f, numero_retorno_desembarque: e.target.value }))}
                          placeholder="123" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={form.bairro_retorno_desembarque} onChange={e => setForm(f => ({ ...f, bairro_retorno_desembarque: e.target.value }))}
                        placeholder="Ex: Centro" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={form.municipio_retorno_desembarque} onChange={e => setForm(f => ({ ...f, municipio_retorno_desembarque: e.target.value }))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={form.cep_retorno_desembarque} onChange={e => setForm(f => ({ ...f, cep_retorno_desembarque: e.target.value }))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={form.referencia_retorno_desembarque} onChange={e => setForm(f => ({ ...f, referencia_retorno_desembarque: e.target.value }))}
                        placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                    </Campo>
                  </>
                )}
              </div>
            )}

            {/* Mais passageiros (só transfer) — repetível */}
            {tipoOperacao !== 'rota_fixa' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-700">👥 Mais passageiros</span>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, passageiros_adicionais: [...f.passageiros_adicionais, { ...PASSAGEIRO_EXTRA_CORRIDA_VAZIO }] }))}
                    className="text-sm font-semibold" style={{ color: '#0F6E56' }}>
                    + Adicionar passageiro
                  </button>
                </div>
                {form.passageiros_adicionais.map((p, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-100 p-3 flex flex-col gap-2" style={{ background: '#f9f9f7' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Passageiro {idx + 2}</span>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.filter((_, i) => i !== idx) }))}
                        className="text-xs font-semibold text-red-500">
                        − Remover
                      </button>
                    </div>
                    <Campo label="Nome completo">
                      <input value={p.nome}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, nome: e.target.value } : pp) }))}
                        placeholder="Nome completo" className="campo-input" />
                    </Campo>
                    <Campo label="Telefone">
                      <input value={p.telefone}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, telefone: e.target.value } : pp) }))}
                        placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
                    </Campo>
                    <Campo label="Número do voo">
                      <input value={p.numero_voo}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero_voo: e.target.value } : pp) }))}
                        placeholder="Ex: G3 1234 (opcional)" className="campo-input" />
                    </Campo>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">📍 Endereço de embarque</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={p.rua}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, rua: e.target.value } : pp) }))}
                          placeholder="Ex: Rua das Flores" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={p.numero}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero: e.target.value } : pp) }))}
                          placeholder="123" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={p.bairro}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, bairro: e.target.value } : pp) }))}
                        placeholder="Ex: Centro" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={p.municipio}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, municipio: e.target.value } : pp) }))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={p.cep}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, cep: e.target.value } : pp) }))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={p.referencia}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, referencia: e.target.value } : pp) }))}
                        placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                    </Campo>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">🏁 Endereço de desembarque</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={p.rua_desembarque}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, rua_desembarque: e.target.value } : pp) }))}
                          placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={p.numero_desembarque}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero_desembarque: e.target.value } : pp) }))}
                          placeholder="456" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={p.bairro_desembarque}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, bairro_desembarque: e.target.value } : pp) }))}
                        placeholder="Ex: Vila Nova" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={p.municipio_desembarque}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, municipio_desembarque: e.target.value } : pp) }))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={p.cep_desembarque}
                          onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, cep_desembarque: e.target.value } : pp) }))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={p.referencia_desembarque}
                        onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, referencia_desembarque: e.target.value } : pp) }))}
                        placeholder="Ex: Em frente à padaria" className="campo-input" />
                    </Campo>

                    {/* Endereços da volta deste passageiro (só se ida_volta ativo) */}
                    {form.ida_volta && (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🔁 Embarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                        <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                          <Campo label="Rua / Logradouro">
                            <input value={p.rua_retorno_embarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, rua_retorno_embarque: e.target.value } : pp) }))}
                              placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                          </Campo>
                          <Campo label="Número">
                            <input value={p.numero_retorno_embarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero_retorno_embarque: e.target.value } : pp) }))}
                              placeholder="456" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Bairro">
                          <input value={p.bairro_retorno_embarque}
                            onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, bairro_retorno_embarque: e.target.value } : pp) }))}
                            placeholder="Ex: Vila Nova" className="campo-input" />
                        </Campo>
                        <div className="grid grid-cols-2 gap-2">
                          <Campo label="Município">
                            <input value={p.municipio_retorno_embarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, municipio_retorno_embarque: e.target.value } : pp) }))}
                              placeholder="Ex: São Paulo" className="campo-input" />
                          </Campo>
                          <Campo label="CEP">
                            <input value={p.cep_retorno_embarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, cep_retorno_embarque: e.target.value } : pp) }))}
                              placeholder="00000-000" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Ponto de referência">
                          <input value={p.referencia_retorno_embarque}
                            onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, referencia_retorno_embarque: e.target.value } : pp) }))}
                            placeholder="Ex: Em frente à padaria" className="campo-input" />
                        </Campo>

                        <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🏁 Desembarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                        <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                          <Campo label="Rua / Logradouro">
                            <input value={p.rua_retorno_desembarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, rua_retorno_desembarque: e.target.value } : pp) }))}
                              placeholder="Ex: Rua das Flores" className="campo-input" />
                          </Campo>
                          <Campo label="Número">
                            <input value={p.numero_retorno_desembarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, numero_retorno_desembarque: e.target.value } : pp) }))}
                              placeholder="123" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Bairro">
                          <input value={p.bairro_retorno_desembarque}
                            onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, bairro_retorno_desembarque: e.target.value } : pp) }))}
                            placeholder="Ex: Centro" className="campo-input" />
                        </Campo>
                        <div className="grid grid-cols-2 gap-2">
                          <Campo label="Município">
                            <input value={p.municipio_retorno_desembarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, municipio_retorno_desembarque: e.target.value } : pp) }))}
                              placeholder="Ex: São Paulo" className="campo-input" />
                          </Campo>
                          <Campo label="CEP">
                            <input value={p.cep_retorno_desembarque}
                              onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, cep_retorno_desembarque: e.target.value } : pp) }))}
                              placeholder="00000-000" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Ponto de referência">
                          <input value={p.referencia_retorno_desembarque}
                            onChange={e => setForm(f => ({ ...f, passageiros_adicionais: f.passageiros_adicionais.map((pp, i) => i === idx ? { ...pp, referencia_retorno_desembarque: e.target.value } : pp) }))}
                            placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                        </Campo>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Campo label="Forma de pagamento">
              <select value={form.forma_pagamento}
                onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                className="campo-input">
                <option value="a_definir">A definir</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="faturado">Faturado</option>
              </select>
            </Campo>

            {form.forma_pagamento === 'faturado' && (
              <Campo label="Previsão de recebimento (opcional)">
                <input type="date" value={form.data_prevista_pagamento}
                  onChange={e => setForm(f => ({ ...f, data_prevista_pagamento: e.target.value }))}
                  className="campo-input" />
              </Campo>
            )}

            <Campo label="Status do pagamento">
              <select value={form.status_pagamento}
                onChange={e => setForm(f => ({
                  ...f,
                  status_pagamento: e.target.value,
                  valor_recebido: '',
                  data_pagamento: e.target.value === 'recebido' && !f.data_pagamento
                    ? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
                    : f.data_pagamento,
                }))}
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

            {form.status_pagamento === 'recebido' && (
              <Campo label="Data do recebimento">
                <input type="date" value={form.data_pagamento}
                  onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))}
                  className="campo-input" />
              </Campo>
            )}

            {!corridaEditando && form.ida_volta ? (
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Valor ida (R$) *">
                  <input type="number" step="0.01" min={0} value={form.preco}
                    onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                    placeholder="0,00" className="campo-input" />
                </Campo>
                <Campo label="Valor volta (R$)">
                  <input type="number" step="0.01" min={0} value={form.preco_volta}
                    onChange={e => setForm(f => ({ ...f, preco_volta: e.target.value }))}
                    placeholder="0,00" className="campo-input" />
                </Campo>
              </div>
            ) : (
              <Campo label="Preço (R$) *">
                <input type="number" step="0.01" min={0} value={form.preco}
                  onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                  placeholder="0,00" className="campo-input" />
              </Campo>
            )}

            <Campo label={form.ida_volta && !corridaEditando ? 'Observações da ida' : 'Observações'}>
              <textarea value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Informações adicionais, ponto de encontro, etc."
                className="campo-input"
                rows={3}
                style={{ resize: 'none' }} />
            </Campo>

            {!corridaEditando && form.ida_volta && (
              <Campo label="Observações da volta">
                <textarea value={form.observacoes_volta}
                  onChange={e => setForm(f => ({ ...f, observacoes_volta: e.target.value }))}
                  placeholder="Informações adicionais, ponto de encontro, etc."
                  className="campo-input"
                  rows={3}
                  style={{ resize: 'none' }} />
              </Campo>
            )}

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

// Substitui <input type="time"> pra evitar picker nativo travado em
// certos celulares (cliente reportou "nao seleciona o horario" no mobile).
// Dois dropdowns simples sempre funcionam. Formato interno mantido: "HH:MM".
function SelectHorario({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h = '', m = ''] = (value || '').split(':')
  const horas = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutos = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
  function set(novaH: string, novoM: string) {
    if (novaH && novoM) onChange(`${novaH}:${novoM}`)
    else if (!novaH && !novoM) onChange('')
    else onChange(`${novaH || '00'}:${novoM || '00'}`)
  }
  return (
    <div className="flex items-center gap-1">
      <select value={h} onChange={e => set(e.target.value, m)}
        className="campo-input" style={{ flex: 1 }}>
        <option value="">Hora</option>
        {horas.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="text-gray-400 font-bold">:</span>
      <select value={m} onChange={e => set(h, e.target.value)}
        className="campo-input" style={{ flex: 1 }}>
        <option value="">Min</option>
        {minutos.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
    </div>
  )
}

function formatarDataFiltro(str: string): string {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [, mes, dia] = str.split('-')
  return `${parseInt(dia)} de ${meses[parseInt(mes) - 1]}`
}
