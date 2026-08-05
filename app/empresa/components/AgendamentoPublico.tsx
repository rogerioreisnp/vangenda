'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatarTelefoneWhatsApp } from '@/lib/telefone'

function gerarPayloadPix(chave: string, nome: string, valor: number, cidade: string = 'Brasil'): string {
  const pixNome = nome.substring(0, 25).replace(/[^a-zA-Z ]/g, '')
  const pixCidade = cidade.substring(0, 15).replace(/[^a-zA-Z ]/g, '')
  const pixValor = valor.toFixed(2)
  function field(id: string, value: string) {
    return `${id}${value.length.toString().padStart(2, '0')}${value}`
  }
  const merchantAccountInfo = field('00', 'BR.GOV.BCB.PIX') + field('01', chave)
  const payload =
    field('00', '01') +
    field('26', merchantAccountInfo) +
    field('52', '0000') +
    field('53', '986') +
    field('54', pixValor) +
    field('58', 'BR') +
    field('59', pixNome) +
    field('60', pixCidade) +
    field('62', field('05', '***'))
  function crc16(str: string): string {
    let crc = 0xFFFF
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
  }
  const withCrc = payload + '6304'
  return withCrc + crc16(withCrc)
}

type EmpresaPublica = {
  id: string
  nome: string
  descricao: string | null
  cor_destaque: string | null
  logo_url: string | null
  chave_pix: string | null
  tipo_chave_pix: string | null
  tipo_operacao: string | null
  telefone: string | null
  whatsapp_comercial: string | null
}

type Rota = {
  id: string
  nome: string | null
  origem: string | null
  destino: string | null
  preco: number
  horario_ida: string | null
  horario_volta: string | null
  dias_semana: number[] | null
  capacidade: number | null
  modo_endereco: 'paradas' | 'livre' | null
  oferece_porta?: boolean | null
  acrescimo_buscar?: number | null
  acrescimo_deixar?: number | null
}

// Modalidades de embarque/desembarque do rota fixa. A rota so mostra a
// escolha quando o gestor liga "oferece_porta" — quem faz so ponto a ponto
// nao ve nada disso (pedido Alexandre/Recife 2026-08-04).
// Uma saida da rota. Mesma rota pode ter varias no dia, cada uma com seu
// motorista e lotacao — o passageiro escolhe qual quer.
type SaidaRota = {
  id: string
  horario: string
  sentido: 'ida' | 'volta'
  capacidade: number | null
}

const MODALIDADES_PORTA = [
  { value: 'rota',        label: '📍 Ponto de Encontro',      desc: 'Embarque e desembarque nos pontos oficiais da rota' },
  { value: 'buscar',      label: '🏠 Buscar no meu Endereço', desc: 'Buscamos você no endereço informado e o desembarque será no ponto oficial' },
  { value: 'deixar',      label: '🚩 Deixar no meu Endereço', desc: 'Embarque no ponto oficial e desembarque no endereço informado' },
  { value: 'porta_porta', label: '🚐 Serviço Porta a Porta',  desc: 'Buscamos e deixamos você no endereço informado. Mais comodidade durante toda a viagem' },
] as const

const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const NOMES_DIAS_COMPLETOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function AgendamentoPublico({
  empresa,
  slug,
}: {
  empresa: EmpresaPublica
  slug: string
}) {
  const cor = empresa.cor_destaque || '#1D9E75'

  const [rotas, setRotas] = useState<Rota[]>([])
  const [loadingRotas, setLoadingRotas] = useState(true)
  const [etapa, setEtapa] = useState<'form' | 'pix' | 'sucesso'>('form')
  const [form, setForm] = useState({
    rota_id: '',
    data: '',
    horario: '',
    nome: '',
    telefone: '',
    email: '',
    observacoes: '',
    // Endereço detalhado embarque
    rua: '',
    numero: '',
    bairro: '',
    municipio: '',
    cep: '',
    referencia: '',
    // Endereço detalhado desembarque
    rua_desembarque: '',
    numero_desembarque: '',
    bairro_desembarque: '',
    municipio_desembarque: '',
    cep_desembarque: '',
    referencia_desembarque: '',
    // Endereço detalhado embarque (volta) — pré-preenchido como inverso da ida
    rua_retorno_embarque: '',
    numero_retorno_embarque: '',
    bairro_retorno_embarque: '',
    municipio_retorno_embarque: '',
    cep_retorno_embarque: '',
    referencia_retorno_embarque: '',
    // Endereço detalhado desembarque (volta) — pré-preenchido como inverso da ida
    rua_retorno_desembarque: '',
    numero_retorno_desembarque: '',
    bairro_retorno_desembarque: '',
    municipio_retorno_desembarque: '',
    cep_retorno_desembarque: '',
    referencia_retorno_desembarque: '',
    quantidade_bagagem: 0,
    quantidade_passageiros: 1,
    modalidade_embarque: 'rota' as 'rota' | 'buscar' | 'deixar' | 'porta_porta',
  })
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null)
  const [rotaManual, setRotaManual] = useState(false)
  const [origemManual, setOrigemManual] = useState('')
  const [destinoManual, setDestinoManual] = useState('')
  // Passageiro 1 é quem efetivamente viaja — pode ser diferente de quem
  // preenche o formulário (form.nome/telefone/email = Responsável pela
  // solicitação, ex: empresa ou secretária agendando pra outra pessoa).
  const [passageiro1Nome, setPassageiro1Nome] = useState('')
  const [passageiro1Telefone, setPassageiro1Telefone] = useState('')
  const [numeroVoo, setNumeroVoo] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('pix')
  type PassageiroExtra = {
    nome: string; telefone: string; numero_voo: string
    rua: string; numero: string; bairro: string; municipio: string; cep: string; referencia: string
    rua_desembarque: string; numero_desembarque: string; bairro_desembarque: string
    municipio_desembarque: string; cep_desembarque: string; referencia_desembarque: string
    rua_retorno_embarque: string; numero_retorno_embarque: string; bairro_retorno_embarque: string
    municipio_retorno_embarque: string; cep_retorno_embarque: string; referencia_retorno_embarque: string
    rua_retorno_desembarque: string; numero_retorno_desembarque: string; bairro_retorno_desembarque: string
    municipio_retorno_desembarque: string; cep_retorno_desembarque: string; referencia_retorno_desembarque: string
  }
  const PASSAGEIRO_EXTRA_VAZIO: PassageiroExtra = {
    nome: '', telefone: '', numero_voo: '',
    rua: '', numero: '', bairro: '', municipio: '', cep: '', referencia: '',
    rua_desembarque: '', numero_desembarque: '', bairro_desembarque: '',
    municipio_desembarque: '', cep_desembarque: '', referencia_desembarque: '',
    rua_retorno_embarque: '', numero_retorno_embarque: '', bairro_retorno_embarque: '',
    municipio_retorno_embarque: '', cep_retorno_embarque: '', referencia_retorno_embarque: '',
    rua_retorno_desembarque: '', numero_retorno_desembarque: '', bairro_retorno_desembarque: '',
    municipio_retorno_desembarque: '', cep_retorno_desembarque: '', referencia_retorno_desembarque: '',
  }
  const [passageirosExtras, setPassageirosExtras] = useState<PassageiroExtra[]>([])
  const [enderecosSugeridos, setEnderecosSugeridos] = useState<string[]>([])
  const [showRetorno, setShowRetorno] = useState(false)
  const [retornoData, setRetornoData] = useState('')
  const [retornoHorario, setRetornoHorario] = useState('')
  const [retornoOrigem, setRetornoOrigem] = useState('')
  const [retornoDestino, setRetornoDestino] = useState('')
  const [turnoRF, setTurnoRF] = useState<'ida' | 'volta'>('ida')
  const [saidasRota, setSaidasRota] = useState<SaidaRota[]>([])
  const [saidaId, setSaidaId] = useState<string>('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [chavePix, setChavePix] = useState<string | null>(null)
  const [tipoChavePix, setTipoChavePix] = useState<string | null>(null)
  const [trechosRF, setTrechosRF] = useState<{ nome: string; preco: number }[]>([])
  const [paradasUnicas, setParadasUnicas] = useState<string[]>([])
  const [embarque, setEmbarque] = useState('')
  const [desembarque, setDesembarque] = useState('')
  const [valorTrechoRF, setValorTrechoRF] = useState<number | null>(null)
  const [vagasDisponiveis, setVagasDisponiveis] = useState<number | null>(null)

  useEffect(() => {
    document.title = `Agendar — ${empresa.nome}`
    let metaTheme = document.querySelector('meta[name="theme-color"]')
    if (!metaTheme) {
      metaTheme = document.createElement('meta')
      metaTheme.setAttribute('name', 'theme-color')
      document.head.appendChild(metaTheme)
    }
    metaTheme.setAttribute('content', cor)
    carregarRotas()
    if (empresa.tipo_operacao !== 'rota_fixa') {
      try {
        const n = localStorage.getItem('ag_nome') ?? ''
        const t = localStorage.getItem('ag_telefone') ?? ''
        if (n || t) setForm(f => ({ ...f, nome: n, telefone: t }))
      } catch {}
    }
  }, [])

  async function carregarRotas() {
    const { data } = await supabase
      .from('rotas_empresa')
      .select('id, nome, origem, destino, preco, horario_ida, horario_volta, dias_semana, capacidade, modo_endereco, oferece_porta, acrescimo_buscar, acrescimo_deixar')
      .eq('empresa_id', empresa.id)
      .order('created_at')
    if (data) setRotas(data)
    setLoadingRotas(false)
  }

  async function buscarEnderecosPorTelefone(telefone: string) {
    if (!telefone.trim() || empresa.tipo_operacao === 'rota_fixa') return
    try {
      const { data } = await supabase
        .from('enderecos_clientes')
        .select('endereco')
        .eq('empresa_id', empresa.id)
        .eq('telefone', telefone.trim())
        .order('contador', { ascending: false })
      setEnderecosSugeridos(data?.map(r => r.endereco) ?? [])
    } catch {}
  }

  // Concatena um endereço estruturado em texto legível para gravar em
  // origem/destino (o painel do gestor exibe esse texto direto). Ignora
  // campos vazios pra evitar vírgulas soltas.
  function concatEndereco(e: { rua: string; numero: string; bairro: string; municipio: string; referencia?: string }): string {
    const rua = e.rua.trim()
    const num = e.numero.trim()
    const bairro = e.bairro.trim()
    const mun = e.municipio.trim()
    const ref = (e.referencia || '').trim()
    const ruaNum = [rua, num].filter(Boolean).join(', ')
    const cidade = [bairro, mun].filter(Boolean).join(' — ')
    const linhas = [ruaNum, cidade].filter(Boolean).join(' · ')
    return ref ? `${linhas} (${ref})` : linhas
  }

  async function salvarEndereco(endereco: string) {
    if (!endereco.trim()) return
    try {
      const { data: existing } = await supabase
        .from('enderecos_clientes')
        .select('id, contador')
        .eq('empresa_id', empresa.id)
        .eq('telefone', form.telefone.trim())
        .eq('endereco', endereco.trim())
        .maybeSingle()
      if (existing) {
        await supabase
          .from('enderecos_clientes')
          .update({ contador: (existing.contador || 1) + 1 })
          .eq('id', existing.id)
      } else {
        await supabase.from('enderecos_clientes').insert({
          empresa_id: empresa.id,
          telefone: form.telefone.trim(),
          endereco: endereco.trim(),
          contador: 1,
        })
      }
    } catch {}
  }

  async function selecionarRota(rotaId: string) {
    if (rotaId === 'manual') {
      setRotaSelecionada(null)
      setRotaManual(true)
      setForm(f => ({ ...f, rota_id: 'manual', horario: '' }))
      setEmbarque('')
      setDesembarque('')
      setValorTrechoRF(null)
      setTrechosRF([])
      setParadasUnicas([])
      return
    }
    setRotaManual(false)
    setOrigemManual('')
    setDestinoManual('')
    const rota = rotas.find(r => r.id === rotaId) || null
    setRotaSelecionada(rota)
    setTurnoRF('ida')
    setSaidasRota([])
    setSaidaId('')

    // Saidas cadastradas nesta rota — o passageiro escolhe entre elas.
    if (rotaId && empresa.tipo_operacao === 'rota_fixa') {
      const { data: sds } = await supabase
        .from('horarios_rota')
        .select('id, horario, sentido, capacidade')
        .eq('rota_id', rotaId)
        .eq('ativo', true)
        .order('horario')
      const lista = (sds || []).map(s => ({
        id: s.id as string,
        horario: (s.horario as string).slice(0, 5),
        sentido: s.sentido as 'ida' | 'volta',
        capacidade: s.capacidade as number | null,
      }))
      setSaidasRota(lista)
      const primeiraIda = lista.find(s => s.sentido === 'ida') ?? lista[0]
      if (primeiraIda) {
        setSaidaId(primeiraIda.id)
        setTurnoRF(primeiraIda.sentido)
      }
    }
    // Para rota_fixa, o horário vem automaticamente da rota
    const horaInicial = rota?.horario_ida?.slice(0, 5) ?? ''
    setForm(f => ({ ...f, rota_id: rotaId, horario: horaInicial }))
    setEmbarque('')
    setDesembarque('')
    setValorTrechoRF(null)
    if (rotaId && empresa.tipo_operacao === 'rota_fixa') {
      const { data: trechos } = await supabase
        .from('paradas_empresa')
        .select('nome, preco')
        .eq('rota_id', rotaId)
      const paradas = new Set<string>()
      trechos?.forEach(t => {
        const partes = t.nome.split(' → ')
        if (partes.length === 2) {
          paradas.add(partes[0].trim())
          paradas.add(partes[1].trim())
        }
      })
      setParadasUnicas(Array.from(paradas))
      setTrechosRF(trechos || [])
    } else {
      setTrechosRF([])
      setParadasUnicas([])
    }
  }

  // Sincroniza form.horario com a SAÍDA escolhida. Rota sem saídas
  // cadastradas cai no comportamento antigo (horário fixo da rota).
  useEffect(() => {
    if (empresa.tipo_operacao !== 'rota_fixa' || !rotaSelecionada) return
    const saida = saidasRota.find(s => s.id === saidaId)
    if (saida) {
      setForm(f => ({ ...f, horario: saida.horario }))
      setTurnoRF(saida.sentido)
      return
    }
    const hora = turnoRF === 'ida' ? rotaSelecionada.horario_ida : rotaSelecionada.horario_volta
    setForm(f => ({ ...f, horario: hora?.slice(0, 5) ?? '' }))
  }, [turnoRF, rotaSelecionada, saidaId, saidasRota])

  useEffect(() => {
    if (!embarque || !desembarque || empresa.tipo_operacao !== 'rota_fixa') return
    const trecho = trechosRF.find(t => t.nome === `${embarque} → ${desembarque}`)
    setValorTrechoRF(trecho ? Number(trecho.preco) : null)
  }, [embarque, desembarque, trechosRF])

  // Carrega vagas disponíveis para rota_fixa quando data/turno/rota mudam
  // Usa RPC para contornar RLS (anon não tem SELECT em corridas_empresa)
  useEffect(() => {
    if (empresa.tipo_operacao !== 'rota_fixa' || !rotaSelecionada || !form.data || !form.horario) {
      setVagasDisponiveis(null)
      return
    }
    // Com saída escolhida, a lotação é DAQUELA saída (contagem exata pelo
    // vínculo). Sem saída cadastrada, cai na contagem antiga por horário.
    const saida = saidasRota.find(s => s.id === saidaId)
    if (saida) {
      supabase
        .rpc('count_vagas_saida', { p_horario_id: saida.id, p_data: form.data })
        .then(({ data: ocupadas }) => {
          const cap = saida.capacidade ?? rotaSelecionada.capacidade ?? 0
          setVagasDisponiveis(Math.max(0, cap - (Number(ocupadas) || 0)))
        })
      return
    }
    supabase
      .rpc('count_vagas_ocupadas', {
        p_rota_id: rotaSelecionada.id,
        p_data: form.data,
        p_horario: form.horario,
      })
      .then(({ data: ocupadas }) => {
        const cap = rotaSelecionada.capacidade ?? 0
        setVagasDisponiveis(Math.max(0, cap - (ocupadas || 0)))
      })
  }, [rotaSelecionada, form.data, form.horario, empresa.tipo_operacao, saidaId, saidasRota])

  // Validação de dia da semana para rota_fixa
  // Força conversão para number para evitar mismatch string vs number vindo do Postgres
  const diaSelecionadoNum = form.data ? new Date(form.data + 'T00:00:00').getDay() : -1
  const diasRota: number[] = (rotaSelecionada?.dias_semana ?? []).map(Number)
  const isDiaOperacao = empresa.tipo_operacao !== 'rota_fixa' || diasRota.length === 0 || diasRota.includes(diaSelecionadoNum)
  const diasNomesCompletos = diasRota.map(d => NOMES_DIAS_COMPLETOS[d])
  const diasTexto = diasNomesCompletos.length === 0 ? 'todos os dias'
    : diasNomesCompletos.length === 1 ? diasNomesCompletos[0]
    : diasNomesCompletos.slice(0, -1).join(', ') + ' e ' + diasNomesCompletos[diasNomesCompletos.length - 1]

  async function confirmar() {
    if (!form.nome.trim()) { setErro('Seu nome é obrigatório'); return }
    if (!form.telefone.trim()) { setErro('Seu telefone é obrigatório'); return }
    if (!form.rota_id) { setErro('Selecione uma rota'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    if (empresa.tipo_operacao === 'rota_fixa' && !isDiaOperacao) {
      setErro(`Esta rota não opera neste dia. Dias disponíveis: ${diasTexto}.`); return
    }
    if (!form.horario) { setErro('Horário é obrigatório'); return }
    // Rota_fixa modo 'paradas': exige seleção de embarque/desembarque e trecho válido
    if (empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada?.modo_endereco !== 'livre') {
      if (!embarque || !desembarque) {
        setErro('Selecione o embarque e desembarque'); return
      }
      if (valorTrechoRF === null) {
        setErro('Trecho não disponível para esta rota'); return
      }
      // Escolheu ser buscado/deixado em casa? Então o endereço deixa de ser
      // opcional — sem ele o motorista não tem onde ir.
      const m = form.modalidade_embarque
      const embPreenchido = (form.rua + form.bairro + form.municipio + form.referencia).trim()
      const desPreenchido = (form.rua_desembarque + form.bairro_desembarque + form.municipio_desembarque + form.referencia_desembarque).trim()
      if ((m === 'buscar' || m === 'porta_porta') && !embPreenchido) {
        setErro('Você escolheu ser buscado em casa — informe o endereço de embarque abaixo.'); return
      }
      if ((m === 'deixar' || m === 'porta_porta') && !desPreenchido) {
        setErro('Você escolheu ser deixado em casa — informe o endereço de desembarque abaixo.'); return
      }
    }
    // Rota_fixa modo 'livre': exige endereço estruturado do passageiro (rua ou bairro)
    if (empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada?.modo_endereco === 'livre') {
      const embPreenchido = (form.rua + form.bairro + form.municipio + form.referencia + form.cep).trim()
      const desPreenchido = (form.rua_desembarque + form.bairro_desembarque + form.municipio_desembarque + form.referencia_desembarque + form.cep_desembarque).trim()
      if (!embPreenchido) { setErro('Informe o endereço de embarque (pode ser o nome do local, ex: "Rodoviária")'); return }
      if (!desPreenchido) { setErro('Informe o endereço de desembarque'); return }
    }
    // Transfer: o endereço do Passageiro 1 vira origem/destino da corrida.
    // Aceita qualquer campo preenchido (rua, bairro, município ou referência) —
    // locais conhecidos como "Aeroporto do Rio" ou "Hotel Copacabana Palace"
    // podem ir só na Rua ou só na Referência, sem exigir endereço completo.
    if (empresa.tipo_operacao !== 'rota_fixa') {
      if (!passageiro1Nome.trim()) { setErro('Informe o nome do Passageiro 1'); return }
      const embarquePreenchido = (form.rua + form.bairro + form.municipio + form.referencia + form.cep).trim()
      const desembarquePreenchido = (form.rua_desembarque + form.bairro_desembarque + form.municipio_desembarque + form.referencia_desembarque + form.cep_desembarque).trim()
      if (!embarquePreenchido) { setErro('Informe o endereço de embarque do Passageiro 1 (pode ser o nome do local, ex: "Aeroporto")'); return }
      if (!desembarquePreenchido) { setErro('Informe o endereço de desembarque do Passageiro 1 (pode ser o nome do local, ex: "Hotel Copacabana")'); return }
    }
    if (!rotaManual && !rotaSelecionada) return

    // Verificar vagas disponíveis para rota_fixa (RPC bypassa RLS para anon).
    // Com saída escolhida, confere a lotação DAQUELA saída.
    const saidaEscolhida = saidasRota.find(s => s.id === saidaId)
    const capacidadeAlvo = saidaEscolhida
      ? (saidaEscolhida.capacidade ?? rotaSelecionada?.capacidade ?? 0)
      : (rotaSelecionada?.capacidade ?? 0)

    if (empresa.tipo_operacao === 'rota_fixa' && capacidadeAlvo > 0) {
      const { data: ocupadas } = saidaEscolhida
        ? await supabase.rpc('count_vagas_saida', { p_horario_id: saidaEscolhida.id, p_data: form.data })
        : await supabase.rpc('count_vagas_ocupadas', {
            p_rota_id: rotaSelecionada!.id,
            p_data: form.data,
            p_horario: form.horario,
          })
      const vagasDisponiveis = capacidadeAlvo - (Number(ocupadas) || 0)
      if (vagasDisponiveis <= 0) {
        setErro('Não há vagas disponíveis para esta rota nesta data e horário.')
        return
      }
      if (form.quantidade_passageiros > vagasDisponiveis) {
        setErro(`Só há ${vagasDisponiveis} vaga${vagasDisponiveis !== 1 ? 's' : ''} disponível${vagasDisponiveis !== 1 ? 'is' : ''} neste horário.`)
        return
      }
    }

    setSalvando(true)
    setErro('')

    // Transfer: origem/destino da corrida vêm do endereço estruturado do
    // Passageiro 1 (cada passageiro pode ter seu próprio endereço, mas o
    // painel do gestor exibe uma linha só — usa o do primeiro passageiro).
    // Rota_fixa mantém embarque/desembarque de parada.
    const p1Embarque = concatEndereco(form)
    const p1Desembarque = concatEndereco({ rua: form.rua_desembarque, numero: form.numero_desembarque, bairro: form.bairro_desembarque, municipio: form.municipio_desembarque, referencia: form.referencia_desembarque })
    const p1EmbarqueVolta = concatEndereco({ rua: form.rua_retorno_embarque, numero: form.numero_retorno_embarque, bairro: form.bairro_retorno_embarque, municipio: form.municipio_retorno_embarque, referencia: form.referencia_retorno_embarque })
    const p1DesembarqueVolta = concatEndereco({ rua: form.rua_retorno_desembarque, numero: form.numero_retorno_desembarque, bairro: form.bairro_retorno_desembarque, municipio: form.municipio_retorno_desembarque, referencia: form.referencia_retorno_desembarque })
    const origemSave = empresa.tipo_operacao === 'rota_fixa'
      ? (rotaSelecionada?.modo_endereco === 'livre' ? p1Embarque : embarque)
      : p1Embarque || (rotaSelecionada?.origem ?? '')
    const destinoSave = empresa.tipo_operacao === 'rota_fixa'
      ? (rotaSelecionada?.modo_endereco === 'livre' ? p1Desembarque : desembarque)
      : p1Desembarque || (rotaSelecionada?.destino ?? '')
    // Volta do Passageiro 1: usa os campos estruturados (que já vêm
    // pré-preenchidos como inverso da ida se cliente não editou).
    const retornoOrigemSave = showRetorno ? (p1EmbarqueVolta || p1Desembarque) : ''
    const retornoDestinoSave = showRetorno ? (p1DesembarqueVolta || p1Embarque) : ''

    // ── Caminho transfer/fretamento: salva em corridas_empresa como pendente ──
    if (empresa.tipo_operacao !== 'rota_fixa') {
      const { error } = await supabase.from('corridas_empresa').insert({
        empresa_id: empresa.id,
        cliente_nome: form.nome.trim(),
        cliente_telefone: form.telefone.trim(),
        email_solicitante: form.email.trim() || null,
        passageiro1_nome: passageiro1Nome.trim() || null,
        passageiro1_telefone: passageiro1Telefone.trim() || null,
        data_hora: `${form.data}T${form.horario}:00`,
        origem: origemSave,
        destino: destinoSave,
        numero_voo: numeroVoo.trim() || null,
        forma_pagamento: formaPagamento || 'a_definir',
        observacoes: form.observacoes.trim() || null,
        nome_passageiro2: null,
        telefone_passageiro2: null,
        retorno_data: showRetorno && retornoData ? retornoData : null,
        retorno_horario: showRetorno && retornoHorario ? retornoHorario : null,
        retorno_origem: retornoOrigemSave || null,
        retorno_destino: retornoDestinoSave || null,
        tipo_servico: empresa.tipo_operacao,
        valor: 0,
        status: 'pendente',
        motorista_id: null,
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
        // Volta estruturada do Passageiro 1 — colunas criadas na migration
        // endereco_retorno_estruturado.sql. Só grava se cliente ativou volta.
        rua_retorno_embarque:         showRetorno ? (form.rua_retorno_embarque.trim()         || null) : null,
        numero_retorno_embarque:      showRetorno ? (form.numero_retorno_embarque.trim()      || null) : null,
        bairro_retorno_embarque:      showRetorno ? (form.bairro_retorno_embarque.trim()      || null) : null,
        municipio_retorno_embarque:   showRetorno ? (form.municipio_retorno_embarque.trim()   || null) : null,
        cep_retorno_embarque:         showRetorno ? (form.cep_retorno_embarque.trim()         || null) : null,
        referencia_retorno_embarque:  showRetorno ? (form.referencia_retorno_embarque.trim()  || null) : null,
        rua_retorno_desembarque:         showRetorno ? (form.rua_retorno_desembarque.trim()         || null) : null,
        numero_retorno_desembarque:      showRetorno ? (form.numero_retorno_desembarque.trim()      || null) : null,
        bairro_retorno_desembarque:      showRetorno ? (form.bairro_retorno_desembarque.trim()      || null) : null,
        municipio_retorno_desembarque:   showRetorno ? (form.municipio_retorno_desembarque.trim()   || null) : null,
        cep_retorno_desembarque:         showRetorno ? (form.cep_retorno_desembarque.trim()         || null) : null,
        referencia_retorno_desembarque:  showRetorno ? (form.referencia_retorno_desembarque.trim()  || null) : null,
        quantidade_bagagem: form.quantidade_bagagem || 0,
        passageiros_adicionais: passageirosExtras.length > 0
          ? passageirosExtras.map(p => ({
              nome: p.nome.trim(), telefone: p.telefone.trim(), numero_voo: p.numero_voo.trim() || null,
              rua: p.rua.trim() || null, numero: p.numero.trim() || null, bairro: p.bairro.trim() || null,
              municipio: p.municipio.trim() || null, cep: p.cep.trim() || null, referencia: p.referencia.trim() || null,
              rua_desembarque: p.rua_desembarque.trim() || null, numero_desembarque: p.numero_desembarque.trim() || null,
              bairro_desembarque: p.bairro_desembarque.trim() || null, municipio_desembarque: p.municipio_desembarque.trim() || null,
              cep_desembarque: p.cep_desembarque.trim() || null, referencia_desembarque: p.referencia_desembarque.trim() || null,
              // Volta estruturada por passageiro extra (só se cliente ativou)
              rua_retorno_embarque:         showRetorno ? (p.rua_retorno_embarque.trim()         || null) : null,
              numero_retorno_embarque:      showRetorno ? (p.numero_retorno_embarque.trim()      || null) : null,
              bairro_retorno_embarque:      showRetorno ? (p.bairro_retorno_embarque.trim()      || null) : null,
              municipio_retorno_embarque:   showRetorno ? (p.municipio_retorno_embarque.trim()   || null) : null,
              cep_retorno_embarque:         showRetorno ? (p.cep_retorno_embarque.trim()         || null) : null,
              referencia_retorno_embarque:  showRetorno ? (p.referencia_retorno_embarque.trim()  || null) : null,
              rua_retorno_desembarque:         showRetorno ? (p.rua_retorno_desembarque.trim()         || null) : null,
              numero_retorno_desembarque:      showRetorno ? (p.numero_retorno_desembarque.trim()      || null) : null,
              bairro_retorno_desembarque:      showRetorno ? (p.bairro_retorno_desembarque.trim()      || null) : null,
              municipio_retorno_desembarque:   showRetorno ? (p.municipio_retorno_desembarque.trim()   || null) : null,
              cep_retorno_desembarque:         showRetorno ? (p.cep_retorno_desembarque.trim()         || null) : null,
              referencia_retorno_desembarque:  showRetorno ? (p.referencia_retorno_desembarque.trim()  || null) : null,
            }))
          : null,
      })

      if (error) {
        setSalvando(false)
        setErro('Erro ao enviar solicitação. Tente novamente.')
        return
      }

      // Salva endereços para autocomplete futuro
      await salvarEndereco(origemSave)
      await salvarEndereco(destinoSave)

      try {
        localStorage.setItem('ag_nome', form.nome.trim())
        localStorage.setItem('ag_telefone', form.telefone.trim())
      } catch {}

      // Notifica gestor
      fetch('/api/notificar-agendamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresa.id,
          nome_cliente: form.nome.trim(),
          origem: origemSave,
          destino: destinoSave,
        }),
      }).catch(() => {})

      setSalvando(false)
      setEtapa('sucesso')
      return
    }

    // ── Caminho rota_fixa: salva em corridas_empresa ─────────────────────────
    // Modo 'paradas': valor vem do trecho (paradas_empresa)
    // Modo 'livre': valor vem da rota inteira (rotas_empresa.preco)
    // Ja inclui o acrescimo do servico de porta, quando houver.
    const valorSave = valorUnitarioRF

    // Um registro por passageiro — mesmo padrao do app individual
    // (/agendar/[slug]). Precisa ser assim para o RPC count_vagas_ocupadas
    // (que conta linhas) refletir corretamente quantas vagas a familia ocupa.
    const qtd = Math.max(1, form.quantidade_passageiros || 1)
    const registros = Array.from({ length: qtd }, (_, i) => ({
      empresa_id: empresa.id,
      rota_id: rotaSelecionada!.id,
      origem: origemSave,
      destino: destinoSave,
      data_hora: `${form.data}T${form.horario}:00`,
      cliente_nome: qtd > 1 ? `${form.nome.trim()} (${i + 1}/${qtd})` : form.nome.trim(),
      cliente_telefone: form.telefone.trim(),
      email_solicitante: form.email.trim() || null,
      valor: valorSave,
      status: 'pendente',
      motorista_id: null,
      tipo_servico: 'rota_fixa',
      forma_pagamento: 'a_definir',
      observacoes: form.observacoes.trim() || null,
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
      quantidade_bagagem: form.quantidade_bagagem || 0,
      modalidade_embarque: form.modalidade_embarque,
      horario_rota_id: saidaId || null,
    }))

    const { error } = await supabase.from('corridas_empresa').insert(registros)

    if (error) {
      setSalvando(false)
      console.error('Erro ao agendar:', error)
      setErro('Erro ao enviar agendamento. Tente novamente.')
      return
    }

    // Notifica gestor
    fetch('/api/notificar-agendamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa_id: empresa.id,
        nome_cliente: form.nome.trim(),
        origem: origemSave,
        destino: destinoSave,
      }),
    }).catch(() => {})

    const { data: pixData } = await supabase
      .from('empresas')
      .select('chave_pix, tipo_chave_pix')
      .eq('slug', slug)
      .single()

    setSalvando(false)

    if (pixData?.chave_pix) {
      setChavePix(pixData.chave_pix)
      setTipoChavePix(pixData.tipo_chave_pix ?? null)
      setEtapa('pix')
    } else {
      setEtapa('sucesso')
    }
  }

  function resetForm() {
    setEtapa('form')
    setForm({ rota_id: '', data: '', horario: '', nome: '', telefone: '', email: '', observacoes: '', rua: '', numero: '', bairro: '', municipio: '', cep: '', referencia: '', rua_desembarque: '', numero_desembarque: '', bairro_desembarque: '', municipio_desembarque: '', cep_desembarque: '', referencia_desembarque: '', rua_retorno_embarque: '', numero_retorno_embarque: '', bairro_retorno_embarque: '', municipio_retorno_embarque: '', cep_retorno_embarque: '', referencia_retorno_embarque: '', rua_retorno_desembarque: '', numero_retorno_desembarque: '', bairro_retorno_desembarque: '', municipio_retorno_desembarque: '', cep_retorno_desembarque: '', referencia_retorno_desembarque: '', quantidade_bagagem: 0, quantidade_passageiros: 1, modalidade_embarque: 'rota' })
    setRotaSelecionada(null)
    setRotaManual(false)
    setOrigemManual('')
    setDestinoManual('')
    setPassageiro1Nome('')
    setPassageiro1Telefone('')
    setNumeroVoo('')
    setFormaPagamento('pix')
    setPassageirosExtras([])
    setEnderecosSugeridos([])
    setShowRetorno(false)
    setRetornoData('')
    setRetornoHorario('')
    setRetornoOrigem('')
    setRetornoDestino('')
    setTurnoRF('ida')
    setSaidasRota([])
    setSaidaId('')
    setEmbarque('')
    setDesembarque('')
    setValorTrechoRF(null)
    setTrechosRF([])
    setParadasUnicas([])
    setVagasDisponiveis(null)
    setErro('')
  }

  // Acrescimo do servico de porta, configurado na rota. Somado ao trecho —
  // "quando ele faz essa funcao o sistema ja recalcula o valor" (Alexandre).
  const acrescimoBuscar = Number(rotaSelecionada?.acrescimo_buscar ?? 0)
  const acrescimoDeixar = Number(rotaSelecionada?.acrescimo_deixar ?? 0)
  const acrescimoPorta = !rotaSelecionada?.oferece_porta ? 0
    : form.modalidade_embarque === 'buscar' ? acrescimoBuscar
    : form.modalidade_embarque === 'deixar' ? acrescimoDeixar
    : form.modalidade_embarque === 'porta_porta' ? acrescimoBuscar + acrescimoDeixar
    : 0

  const valorUnitarioRF = empresa.tipo_operacao === 'rota_fixa'
    ? (rotaSelecionada?.modo_endereco === 'livre'
        ? Number(rotaSelecionada.preco ?? 0)
        : (valorTrechoRF ?? 0) + acrescimoPorta)
    : 0
  const valorParaPix = empresa.tipo_operacao === 'rota_fixa'
    ? valorUnitarioRF * Math.max(1, form.quantidade_passageiros || 1)
    : (rotaManual ? 0 : Number(rotaSelecionada?.preco ?? 0))
  const pixPayload = chavePix && rotaSelecionada && valorParaPix > 0
    ? gerarPayloadPix(chavePix, empresa.nome, valorParaPix)
    : null

  const labelTurno = turnoRF === 'ida' ? 'Ida' : 'Volta'
  const horaExibicao = form.horario || '—'

  if (loadingRotas) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: '#f0f0ec' }}>
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

  return (
    <div className="min-h-dvh" style={{ background: '#f0f0ec' }}>
      {/* Header com identidade da empresa */}
      <div style={{ background: cor }} className="px-4 pt-12 pb-6 text-center">
        {empresa.logo_url ? (
          <img
            src={empresa.logo_url}
            alt={empresa.nome}
            className="h-16 object-contain mx-auto mb-3 rounded-xl"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <svg width="64" height="64" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="mb-2 mx-auto">
            <rect width="192" height="192" rx="42" fill="#04342C"/>
            <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
            <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
            <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
            <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
          </svg>
        )}
        <h1 className="text-xl font-bold" style={{ color: '#fff' }}>{empresa.nome}</h1>
        {empresa.descricao && (
          // whitespace-pre-line preserva quebras de linha digitadas em
          // Configuracoes — mesmo fix aplicado no /transfer/[slug].
          <p className="text-sm mt-1.5 leading-snug whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {empresa.descricao}
          </p>
        )}
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">

        {etapa === 'form' && (
          <div className="flex flex-col gap-4">

            {/* Dados pessoais / Responsável pela solicitação */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">
                {empresa.tipo_operacao !== 'rota_fixa' ? '📋 Responsável pela solicitação' : 'Seus dados'}
              </p>
              <Campo label={empresa.tipo_operacao !== 'rota_fixa' ? 'Nome do responsável *' : 'Seu nome *'}>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: João Silva"
                  className="campo-input"
                />
              </Campo>
              <Campo label={empresa.tipo_operacao !== 'rota_fixa' ? 'Telefone / WhatsApp do responsável *' : 'Seu telefone *'}>
                <input
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  onBlur={e => buscarEnderecosPorTelefone(e.target.value)}
                  placeholder="(11) 99999-9999 ou +1 555 123 4567"
                  type="tel"
                  className="campo-input"
                />
                {empresa.tipo_operacao !== 'rota_fixa' && (
                  <p className="text-[10px] text-gray-400 mt-1">Número de fora do Brasil? Comece com + e o código do país (ex: +1, +351).</p>
                )}
              </Campo>
              <Campo label="E-mail (para receber confirmação)">
                <input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  type="email"
                  className="campo-input"
                />
              </Campo>
            </div>

            {/* Detalhes da viagem */}
            <div className="rounded-2xl p-4 flex flex-col gap-3"
              style={empresa.tipo_operacao !== 'rota_fixa'
                ? { background: '#E6F1FB' }
                : { background: '#fff', border: '1px solid #f3f4f6' }}>
              <p className="text-sm font-semibold" style={{ color: empresa.tipo_operacao !== 'rota_fixa' ? '#0C447C' : '#374151' }}>
                {empresa.tipo_operacao !== 'rota_fixa' ? '🚗 Ida' : 'Sua viagem'}
              </p>

              <Campo label="Rota *">
                {rotas.length === 0 ? (
                  <div className="rounded-xl px-4 py-3 text-center" style={{ background: '#f9fafb' }}>
                    <p className="text-xs text-gray-400">Nenhuma rota disponível no momento.</p>
                  </div>
                ) : (
                  <select
                    value={form.rota_id}
                    onChange={e => selecionarRota(e.target.value)}
                    className="campo-input"
                  >
                    <option value="">Selecione a rota...</option>
                    {rotas.map(r => (
                      <option key={r.id} value={r.id}>
                        {empresa.tipo_operacao === 'rota_fixa'
                          ? (r.nome || 'Sem nome')
                          : `${r.nome || `${r.origem} → ${r.destino}`}${Number(r.preco) > 0 ? ` — R$ ${Number(r.preco).toFixed(2).replace('.', ',')}` : ''}`}
                      </option>
                    ))}
                    {empresa.tipo_operacao !== 'rota_fixa' && (
                      <option value="manual">✏️ Outra rota (digitar manualmente)</option>
                    )}
                  </select>
                )}
              </Campo>


              {rotaSelecionada && empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada.modo_endereco !== 'livre' && (
                <>
                  {/* Paradas de embarque/desembarque (modo 'paradas') */}
                  <div className="grid grid-cols-2 gap-2">
                    <Campo label="Embarque *">
                      <select value={embarque} onChange={e => setEmbarque(e.target.value)} className="campo-input">
                        <option value="">Selecione...</option>
                        {paradasUnicas.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </Campo>
                    <Campo label="Desembarque *">
                      <select value={desembarque} onChange={e => setDesembarque(e.target.value)} className="campo-input">
                        <option value="">Selecione...</option>
                        {paradasUnicas.filter(p => p !== embarque).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </Campo>
                  </div>

                  {embarque && desembarque && valorTrechoRF === null && (
                    <div className="rounded-xl px-4 py-3 border" style={{ background: '#FCEBEB', borderColor: '#F5BCBC' }}>
                      <p className="text-xs text-center" style={{ color: '#A32D2D' }}>Trecho não disponível para esta rota.</p>
                    </div>
                  )}
                </>
              )}

              {rotaSelecionada && empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada.modo_endereco === 'livre' && (
                <>
                  {/* Modo endereço livre: cliente digita nos campos de endereço abaixo */}
                  <div className="rounded-xl p-3" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                    <p className="text-xs" style={{ color: '#9A3412' }}>
                      🛣️ Rota <strong>{rotaSelecionada.origem} → {rotaSelecionada.destino}</strong>. Preencha seu endereço de embarque e desembarque nos campos abaixo.
                    </p>
                  </div>
                </>
              )}

              {rotaSelecionada && empresa.tipo_operacao !== 'rota_fixa' && Number(rotaSelecionada.preco) > 0 && (
                <div className="rounded-xl px-4 py-3" style={{ background: '#f0f0ec' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Valor da corrida</span>
                    <span className="text-xl font-bold" style={{ color: cor }}>
                      R$ {Number(rotaSelecionada.preco).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              )}

              {/* Data */}
              <Campo label="Data *">
                <input
                  type="date"
                  value={form.data}
                  onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  min={new Date().toISOString().slice(0, 10)}
                  className="campo-input"
                />
              </Campo>

              {/* Dias de operação (só rota_fixa, quando rota selecionada e tem dias configurados) */}
              {empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada && diasRota.length > 0 && (
                <div className="rounded-xl p-3 border border-gray-100" style={{ background: '#f9fafb' }}>
                  <p className="text-xs text-gray-500 mb-2">Dias de operação desta rota:</p>
                  <div className="grid grid-cols-7 gap-1">
                    {NOMES_DIAS.map((dia, i) => {
                      const ativo = diasRota.includes(i)
                      return (
                        <div key={i}
                          className="py-1.5 rounded-lg text-xs font-semibold text-center"
                          style={ativo
                            ? { background: cor, color: '#fff' }
                            : { background: '#fff', color: '#d1d5db', border: '1px solid #e5e7eb' }}>
                          {dia}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Aviso de dia inválido (rota_fixa) */}
              {empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada && form.data && !isDiaOperacao && (
                <div className="rounded-xl px-4 py-3 border" style={{ background: '#FCEBEB', borderColor: '#F5BCBC' }}>
                  <p className="text-sm font-semibold" style={{ color: '#A32D2D' }}>
                    🚫 Esta rota não opera neste dia
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#7f1d1d' }}>
                    Dias disponíveis: {diasTexto}
                  </p>
                </div>
              )}

              {/* Saídas da rota — o passageiro escolhe o horário que quer.
                  Mesma rota pode ter várias saídas no dia. Rota sem saídas
                  cadastradas cai nos botões antigos de Ida/Volta. */}
              {empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada && saidasRota.length > 0 && (
                <Campo label="Escolha o horário da sua viagem *">
                  <div className="flex flex-col gap-1.5">
                    {saidasRota.map(s => {
                      const sel = saidaId === s.id
                      return (
                        <button key={s.id} type="button" onClick={() => setSaidaId(s.id)}
                          className="w-full px-3 py-2.5 rounded-xl border transition-all flex items-center gap-2 text-left"
                          style={sel
                            ? { background: cor, color: '#fff', borderColor: cor }
                            : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>
                          <span className="text-base font-bold flex-shrink-0">{s.horario}h</span>
                          <span className="text-xs flex-1"
                            style={{ color: sel ? 'rgba(255,255,255,0.85)' : '#9ca3af' }}>
                            {s.sentido === 'ida' ? '↑ Ida' : '↓ Volta'}
                          </span>
                          {sel && <span className="text-xs font-semibold flex-shrink-0">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </Campo>
              )}

              {/* Turno (rota_fixa) — fallback pra rota sem saídas cadastradas */}
              {empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada && saidasRota.length === 0 && (
                <Campo label="Turno *">
                  <div className="grid grid-cols-2 gap-2">
                    {(['ida', 'volta'] as const).map(t => {
                      const hora = t === 'ida' ? rotaSelecionada.horario_ida : rotaSelecionada.horario_volta
                      return (
                        <button key={t} type="button" onClick={() => setTurnoRF(t)}
                          className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                          style={turnoRF === t
                            ? { background: cor, color: '#fff', borderColor: cor }
                            : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                          {t === 'ida' ? '↑ Ida' : '↓ Volta'}
                          {hora && (
                            <span className="block text-xs mt-0.5 opacity-80">
                              {hora.slice(0, 5)}h
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </Campo>
              )}

              {/* Modalidade de porta — logo abaixo dos horários de ida/volta,
                  como o Alexandre sugeriu. Marcar aqui faz os campos de
                  endereço aparecerem e recalcula o valor na hora. */}
              {empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada?.oferece_porta && rotaSelecionada.modo_endereco !== 'livre' && (
                <Campo label="Como será seu embarque e desembarque? *">
                  <div className="flex flex-col gap-1.5">
                    {MODALIDADES_PORTA.map(m => {
                      const sel = form.modalidade_embarque === m.value
                      const extra = m.value === 'buscar' ? acrescimoBuscar
                        : m.value === 'deixar' ? acrescimoDeixar
                        : m.value === 'porta_porta' ? acrescimoBuscar + acrescimoDeixar
                        : 0
                      // Mostra o valor final (base + acrescimo) em vez de so o
                      // acrescimo, pra passageiro nao precisar fazer conta
                      // (sugestao Alexandre/Recife). So da pra saber o valor
                      // final depois que o trecho foi escolhido.
                      const valorFinal = valorTrechoRF !== null ? valorTrechoRF + extra : null
                      return (
                        <button key={m.value} type="button"
                          onClick={() => setForm(f => ({ ...f, modalidade_embarque: m.value }))}
                          className="w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center gap-2"
                          style={sel
                            ? { background: cor, color: '#fff', borderColor: cor }
                            : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{m.label}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: sel ? 'rgba(255,255,255,0.85)' : '#9ca3af' }}>
                              {m.desc}
                            </p>
                          </div>
                          {valorFinal !== null ? (
                            <span className="text-xs font-bold flex-shrink-0 text-right"
                              style={{ color: sel ? '#fff' : cor }}>
                              Valor final<br />R$ {valorFinal.toFixed(2).replace('.', ',')}
                            </span>
                          ) : extra > 0 && (
                            <span className="text-xs font-bold flex-shrink-0"
                              style={{ color: sel ? '#fff' : cor }}>
                              +R$ {extra.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                    📌 O serviço de busca e/ou entrega em domicílio está sujeito à
                    cobertura da nossa área de atendimento.
                  </p>
                </Campo>
              )}

              {/* Vagas disponíveis (rota_fixa) */}
              {empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada && form.data && form.horario && vagasDisponiveis !== null && (
                <div className="rounded-xl px-4 py-3 border"
                  style={vagasDisponiveis === 0
                    ? { background: '#FCEBEB', borderColor: '#F5BCBC' }
                    : { background: '#E1F5EE', borderColor: '#9FE1CB' }}>
                  {vagasDisponiveis === 0 ? (
                    <p className="text-sm font-semibold" style={{ color: '#A32D2D' }}>🚫 Sem vagas disponíveis neste horário</p>
                  ) : (
                    <p className="text-sm font-medium" style={{ color: '#085041' }}>
                      ✅ {vagasDisponiveis} vaga{vagasDisponiveis !== 1 ? 's' : ''} disponível{vagasDisponiveis !== 1 ? 'is' : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Quantidade de passageiros (rota_fixa) — permite agendar pra
                  familia inteira numa unica solicitacao. Cada passageiro
                  vira uma linha propria em corridas_empresa. */}
              {empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada && (
                <Campo label="Quantidade de passageiros">
                  <div className="flex items-center gap-3">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, quantidade_passageiros: Math.max(1, f.quantidade_passageiros - 1) }))}
                      className="w-10 h-10 rounded-xl text-xl font-bold border border-gray-200 flex items-center justify-center"
                      style={{ background: '#f0f0ec', color: cor }}>
                      −
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-2xl font-bold text-gray-800">{form.quantidade_passageiros}</span>
                      <p className="text-xs text-gray-400">
                        {form.quantidade_passageiros === 1 ? 'passageiro' : 'passageiros'}
                      </p>
                    </div>
                    <button type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        quantidade_passageiros: vagasDisponiveis !== null
                          ? Math.min(vagasDisponiveis, f.quantidade_passageiros + 1)
                          : f.quantidade_passageiros + 1,
                      }))}
                      className="w-10 h-10 rounded-xl text-xl font-bold border border-gray-200 flex items-center justify-center"
                      style={{ background: cor, color: '#fff' }}>
                      +
                    </button>
                  </div>
                  {vagasDisponiveis !== null && form.quantidade_passageiros >= vagasDisponiveis && vagasDisponiveis > 0 && (
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      Máx. {vagasDisponiveis} vaga{vagasDisponiveis !== 1 ? 's' : ''} disponíve{vagasDisponiveis !== 1 ? 'is' : 'l'}
                    </p>
                  )}
                  {valorUnitarioRF > 0 && (
                    <div className="rounded-xl px-4 py-3 mt-2" style={{ background: '#f0f0ec' }}>
                      {form.quantidade_passageiros > 1 ? (
                        <>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-500">Valor por passageiro</span>
                            <span className="text-sm font-semibold text-gray-700">
                              R$ {valorUnitarioRF.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-t pt-2" style={{ borderColor: '#e5e7eb' }}>
                            <span className="text-sm font-medium text-gray-600">
                              Total ({form.quantidade_passageiros} passageiros)
                            </span>
                            <span className="text-xl font-bold" style={{ color: cor }}>
                              R$ {(valorUnitarioRF * form.quantidade_passageiros).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Valor</span>
                          <span className="text-xl font-bold" style={{ color: cor }}>
                            R$ {valorUnitarioRF.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </Campo>
              )}

              {/* Horário livre (transfer) */}
              {empresa.tipo_operacao !== 'rota_fixa' && (
                <Campo label="Horário *">
                  <input
                    type="time"
                    value={form.horario}
                    onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
                    className="campo-input"
                  />
                </Campo>
              )}

              <Campo label="Observações">
                <textarea
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Ex: local de embarque, necessidades especiais..."
                  className="campo-input"
                  rows={3}
                  style={{ resize: 'none' }}
                />
              </Campo>
            </div>

            {/* Forma de pagamento (só transfer) */}
            {empresa.tipo_operacao !== 'rota_fixa' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-sm font-semibold text-gray-700">Forma de pagamento</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'cartao', label: '💳 Cartão' },
                    { value: 'pix', label: '📱 Pix' },
                    { value: 'faturado', label: '📄 Faturado' },
                  ] as const).map(op => (
                    <button key={op.value} type="button"
                      onClick={() => setFormaPagamento(op.value)}
                      className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                      style={formaPagamento === op.value
                        ? { background: cor, color: '#fff', borderColor: cor }
                        : { background: '#fff', color: '#555', borderColor: '#e5e7eb' }}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Passageiro 1 (só transfer) — quem efetivamente viaja, ficha própria e obrigatória */}
            {empresa.tipo_operacao !== 'rota_fixa' && (
              <div className="bg-white rounded-2xl p-4 border-2 flex flex-col gap-3" style={{ borderColor: cor + '55' }}>
                <p className="text-sm font-semibold text-gray-700">🧍 Dados do Passageiro 1</p>
                <Campo label="Nome completo *">
                  <input value={passageiro1Nome} onChange={e => setPassageiro1Nome(e.target.value)}
                    placeholder="Nome completo" className="campo-input" />
                </Campo>
                <Campo label="Telefone">
                  <input value={passageiro1Telefone} onChange={e => setPassageiro1Telefone(e.target.value)}
                    placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
                </Campo>
                <Campo label="Número do voo">
                  <input value={numeroVoo} onChange={e => setNumeroVoo(e.target.value)}
                    placeholder="Ex: G3 1234 (opcional)" className="campo-input" />
                </Campo>

<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">📍 Endereço de embarque</p>
                <p className="text-xs text-gray-500 -mt-1">Pode ser o nome do local (ex: "Aeroporto de Boa Vista") — não precisa preencher todos os campos.</p>
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

<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">🏁 Endereço de desembarque</p>
                <p className="text-xs text-gray-500 -mt-1">Pode ser o nome do local (ex: "Hotel Copacabana Palace") — não precisa preencher todos os campos.</p>
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

                {/* ── Endereços da volta (só quando cliente ativou o retorno) ── */}
                {showRetorno && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🔁 Endereço de embarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se for outro lugar</span></p>
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

                    <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🏁 Endereço de desembarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se for outro lugar</span></p>
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

            {/* Passageiro adicional (só transfer) — repetível, cada um com sua ficha */}
            {empresa.tipo_operacao !== 'rota_fixa' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-700">👥 Passageiro adicional</span>
                  <button type="button"
                    onClick={() => setPassageirosExtras(prev => [...prev, { ...PASSAGEIRO_EXTRA_VAZIO }])}
                    className="text-sm font-semibold" style={{ color: cor }}>
                    + Adicionar passageiro
                  </button>
                </div>
                {passageirosExtras.map((p, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-100 p-3 flex flex-col gap-2" style={{ background: '#f9f9f7' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Passageiro {idx + 2}</span>
                      <button type="button"
                        onClick={() => setPassageirosExtras(prev => prev.filter((_, i) => i !== idx))}
                        className="text-xs font-semibold text-red-500">
                        − Remover
                      </button>
                    </div>
                    <Campo label="Nome completo">
                      <input value={p.nome}
                        onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, nome: e.target.value } : pp))}
                        placeholder="Nome completo" className="campo-input" />
                    </Campo>
                    <Campo label="Telefone">
                      <input value={p.telefone}
                        onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, telefone: e.target.value } : pp))}
                        placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
                    </Campo>
                    <Campo label="Número do voo">
                      <input value={p.numero_voo}
                        onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, numero_voo: e.target.value } : pp))}
                        placeholder="Ex: G3 1234 (opcional)" className="campo-input" />
                    </Campo>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">📍 Endereço de embarque</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={p.rua}
                          onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, rua: e.target.value } : pp))}
                          placeholder="Ex: Rua das Flores" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={p.numero}
                          onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, numero: e.target.value } : pp))}
                          placeholder="123" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={p.bairro}
                        onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, bairro: e.target.value } : pp))}
                        placeholder="Ex: Centro" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={p.municipio}
                          onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, municipio: e.target.value } : pp))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={p.cep}
                          onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, cep: e.target.value } : pp))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={p.referencia}
                        onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, referencia: e.target.value } : pp))}
                        placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                    </Campo>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">🏁 Endereço de desembarque</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                      <Campo label="Rua / Logradouro">
                        <input value={p.rua_desembarque}
                          onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, rua_desembarque: e.target.value } : pp))}
                          placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                      </Campo>
                      <Campo label="Número">
                        <input value={p.numero_desembarque}
                          onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, numero_desembarque: e.target.value } : pp))}
                          placeholder="456" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Bairro">
                      <input value={p.bairro_desembarque}
                        onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, bairro_desembarque: e.target.value } : pp))}
                        placeholder="Ex: Vila Nova" className="campo-input" />
                    </Campo>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Município">
                        <input value={p.municipio_desembarque}
                          onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, municipio_desembarque: e.target.value } : pp))}
                          placeholder="Ex: São Paulo" className="campo-input" />
                      </Campo>
                      <Campo label="CEP">
                        <input value={p.cep_desembarque}
                          onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, cep_desembarque: e.target.value } : pp))}
                          placeholder="00000-000" className="campo-input" />
                      </Campo>
                    </div>
                    <Campo label="Ponto de referência">
                      <input value={p.referencia_desembarque}
                        onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, referencia_desembarque: e.target.value } : pp))}
                        placeholder="Ex: Em frente à padaria" className="campo-input" />
                    </Campo>

                    {/* Endereços da volta deste passageiro (só se cliente ativou retorno) */}
                    {showRetorno && (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🔁 Embarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                        <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                          <Campo label="Rua / Logradouro">
                            <input value={p.rua_retorno_embarque}
                              onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, rua_retorno_embarque: e.target.value } : pp))}
                              placeholder="Ex: Rua das Palmeiras" className="campo-input" />
                          </Campo>
                          <Campo label="Número">
                            <input value={p.numero_retorno_embarque}
                              onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, numero_retorno_embarque: e.target.value } : pp))}
                              placeholder="456" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Bairro">
                          <input value={p.bairro_retorno_embarque}
                            onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, bairro_retorno_embarque: e.target.value } : pp))}
                            placeholder="Ex: Vila Nova" className="campo-input" />
                        </Campo>
                        <div className="grid grid-cols-2 gap-2">
                          <Campo label="Município">
                            <input value={p.municipio_retorno_embarque}
                              onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, municipio_retorno_embarque: e.target.value } : pp))}
                              placeholder="Ex: São Paulo" className="campo-input" />
                          </Campo>
                          <Campo label="CEP">
                            <input value={p.cep_retorno_embarque}
                              onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, cep_retorno_embarque: e.target.value } : pp))}
                              placeholder="00000-000" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Ponto de referência">
                          <input value={p.referencia_retorno_embarque}
                            onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, referencia_retorno_embarque: e.target.value } : pp))}
                            placeholder="Ex: Em frente à padaria" className="campo-input" />
                        </Campo>

                        <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3C3489' }}>🏁 Desembarque (volta) <span className="normal-case font-normal text-gray-400">— pré-preenchido, edite se necessário</span></p>
                        <div style={{ display: 'grid', gridTemplateColumns: '70% 30%', gap: '8px' }}>
                          <Campo label="Rua / Logradouro">
                            <input value={p.rua_retorno_desembarque}
                              onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, rua_retorno_desembarque: e.target.value } : pp))}
                              placeholder="Ex: Rua das Flores" className="campo-input" />
                          </Campo>
                          <Campo label="Número">
                            <input value={p.numero_retorno_desembarque}
                              onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, numero_retorno_desembarque: e.target.value } : pp))}
                              placeholder="123" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Bairro">
                          <input value={p.bairro_retorno_desembarque}
                            onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, bairro_retorno_desembarque: e.target.value } : pp))}
                            placeholder="Ex: Centro" className="campo-input" />
                        </Campo>
                        <div className="grid grid-cols-2 gap-2">
                          <Campo label="Município">
                            <input value={p.municipio_retorno_desembarque}
                              onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, municipio_retorno_desembarque: e.target.value } : pp))}
                              placeholder="Ex: São Paulo" className="campo-input" />
                          </Campo>
                          <Campo label="CEP">
                            <input value={p.cep_retorno_desembarque}
                              onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, cep_retorno_desembarque: e.target.value } : pp))}
                              placeholder="00000-000" className="campo-input" />
                          </Campo>
                        </div>
                        <Campo label="Ponto de referência">
                          <input value={p.referencia_retorno_desembarque}
                            onChange={e => setPassageirosExtras(prev => prev.map((pp, i) => i === idx ? { ...pp, referencia_retorno_desembarque: e.target.value } : pp))}
                            placeholder="Ex: Próximo ao mercado Boa Ideia" className="campo-input" />
                        </Campo>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Endereço detalhado embarque + desembarque (rota fixa).
                Quando a rota oferece serviço de porta, o bloco de endereço só
                aparece na ponta que o passageiro marcou — e aí deixa de ser
                opcional. Rota sem serviço de porta segue como sempre foi:
                os dois blocos visíveis e opcionais. */}
            {empresa.tipo_operacao === 'rota_fixa' && (() => {
              const usaPorta = !!rotaSelecionada?.oferece_porta && rotaSelecionada.modo_endereco !== 'livre'
              const m = form.modalidade_embarque
              const mostrarEmbarque    = !usaPorta || m === 'buscar' || m === 'porta_porta'
              const mostrarDesembarque = !usaPorta || m === 'deixar' || m === 'porta_porta'
              const rotuloOpcional = usaPorta
                ? <span className="text-xs font-normal" style={{ color: '#A32D2D' }}>(obrigatório)</span>
                : <span className="text-xs font-normal text-gray-400">(opcional)</span>
              return (
              <>
                {mostrarEmbarque && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-gray-700">📍 Endereço de embarque {rotuloOpcional}</p>
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
                </div>
                )}

                {mostrarDesembarque && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-gray-700">🏁 Endereço de desembarque {rotuloOpcional}</p>
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
                </div>
                )}
              </>
              )
            })()}

            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <Campo label="Quantidade de bagagem">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setForm(f => ({ ...f, quantidade_bagagem: Math.max(0, f.quantidade_bagagem - 1) }))}
                    className="w-10 h-10 rounded-xl text-xl font-bold border border-gray-200 flex items-center justify-center"
                    style={{ background: '#f0f0ec', color: '#0F6E56' }}>
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-gray-800">🧳 {form.quantidade_bagagem}</span>
                    <p className="text-xs text-gray-400">{form.quantidade_bagagem === 1 ? 'mala/volume' : 'malas/volumes'}</p>
                  </div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, quantidade_bagagem: f.quantidade_bagagem + 1 }))}
                    className="w-10 h-10 rounded-xl text-xl font-bold border border-gray-200 flex items-center justify-center"
                    style={{ background: '#0F6E56', color: '#fff' }}>
                    +
                  </button>
                </div>
              </Campo>
            </div>

            {/* Retorno (só transfer) — usa os endereços dos passageiros
                invertidos automaticamente (embarque vira desembarque). */}
            {empresa.tipo_operacao !== 'rota_fixa' && (
              <div className="rounded-2xl p-4 flex flex-col gap-3"
                style={showRetorno ? { background: '#EEEDFE' } : { background: '#fff', border: '1px solid #f3f4f6' }}>
                <button type="button" onClick={() => setShowRetorno(v => {
                  const novo = !v
                  if (novo) {
                    setRetornoData(prev => prev || form.data)
                    // Pré-preenche endereços da volta com o inverso da ida
                    // (embarque volta = desembarque ida; desembarque volta = embarque ida).
                    // Só preenche campos ainda vazios — se o cliente já editou, respeita.
                    setForm(f => ({
                      ...f,
                      rua_retorno_embarque:        f.rua_retorno_embarque        || f.rua_desembarque,
                      numero_retorno_embarque:     f.numero_retorno_embarque     || f.numero_desembarque,
                      bairro_retorno_embarque:     f.bairro_retorno_embarque     || f.bairro_desembarque,
                      municipio_retorno_embarque:  f.municipio_retorno_embarque  || f.municipio_desembarque,
                      cep_retorno_embarque:        f.cep_retorno_embarque        || f.cep_desembarque,
                      referencia_retorno_embarque: f.referencia_retorno_embarque || f.referencia_desembarque,
                      rua_retorno_desembarque:        f.rua_retorno_desembarque        || f.rua,
                      numero_retorno_desembarque:     f.numero_retorno_desembarque     || f.numero,
                      bairro_retorno_desembarque:     f.bairro_retorno_desembarque     || f.bairro,
                      municipio_retorno_desembarque:  f.municipio_retorno_desembarque  || f.municipio,
                      cep_retorno_desembarque:        f.cep_retorno_desembarque        || f.cep,
                      referencia_retorno_desembarque: f.referencia_retorno_desembarque || f.referencia,
                    }))
                    setPassageirosExtras(prev => prev.map(p => ({
                      ...p,
                      rua_retorno_embarque:        p.rua_retorno_embarque        || p.rua_desembarque,
                      numero_retorno_embarque:     p.numero_retorno_embarque     || p.numero_desembarque,
                      bairro_retorno_embarque:     p.bairro_retorno_embarque     || p.bairro_desembarque,
                      municipio_retorno_embarque:  p.municipio_retorno_embarque  || p.municipio_desembarque,
                      cep_retorno_embarque:        p.cep_retorno_embarque        || p.cep_desembarque,
                      referencia_retorno_embarque: p.referencia_retorno_embarque || p.referencia_desembarque,
                      rua_retorno_desembarque:        p.rua_retorno_desembarque        || p.rua,
                      numero_retorno_desembarque:     p.numero_retorno_desembarque     || p.numero,
                      bairro_retorno_desembarque:     p.bairro_retorno_desembarque     || p.bairro,
                      municipio_retorno_desembarque:  p.municipio_retorno_desembarque  || p.municipio,
                      cep_retorno_desembarque:        p.cep_retorno_desembarque        || p.cep,
                      referencia_retorno_desembarque: p.referencia_retorno_desembarque || p.referencia,
                    })))
                  }
                  return novo
                })}
                  className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold" style={{ color: showRetorno ? '#3C3489' : '#374151' }}>
                    {showRetorno ? '🔁 Volta' : '🔄 Quer agendar seu retorno?'}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: cor }}>
                    {showRetorno ? '− Remover' : '+ Sim, quero'}
                  </span>
                </button>
                {showRetorno && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Campo label="Data do retorno">
                        <input type="date" value={retornoData} onChange={e => setRetornoData(e.target.value)}
                          min={form.data || new Date().toISOString().slice(0, 10)} className="campo-input" />
                      </Campo>
                      <Campo label="Horário do retorno">
                        <input type="time" value={retornoHorario} onChange={e => setRetornoHorario(e.target.value)}
                          className="campo-input" />
                      </Campo>
                    </div>
                    <p className="text-xs" style={{ color: '#3C3489' }}>
                      ↺ Os endereços de embarque e desembarque da volta ficam pré-preenchidos
                      como inverso da ida em cada passageiro. Role até o Passageiro para conferir e editar se necessário.
                    </p>
                  </>
                )}
              </div>
            )}

            {enderecosSugeridos.length > 0 && (
              <datalist id="sugestoes-enderecos">
                {enderecosSugeridos.map(e => <option key={e} value={e} />)}
              </datalist>
            )}

            {erro && (
              <div style={{ background: '#FCEBEB', borderColor: '#F5BCBC' }}
                className="border rounded-xl px-4 py-3">
                <p className="text-sm font-semibold" style={{ color: '#A32D2D' }}>⚠️ {erro}</p>
              </div>
            )}

            <button
              onClick={confirmar}
              disabled={salvando || (empresa.tipo_operacao === 'rota_fixa' && (vagasDisponiveis === 0 || (vagasDisponiveis !== null && form.quantidade_passageiros > vagasDisponiveis)))}
              className="w-full py-4 rounded-2xl text-white text-base font-bold disabled:opacity-40"
              style={{ background: cor }}
            >
              {salvando
                ? 'Enviando...'
                : empresa.tipo_operacao === 'rota_fixa' && vagasDisponiveis === 0
                ? '🚫 Sem vagas neste horário'
                : empresa.tipo_operacao === 'rota_fixa' && vagasDisponiveis !== null && form.quantidade_passageiros > vagasDisponiveis
                ? `🚫 Só ${vagasDisponiveis} vaga${vagasDisponiveis !== 1 ? 's' : ''} disponível`
                : empresa.tipo_operacao !== 'rota_fixa'
                ? '✓ Enviar solicitação'
                : '✓ Confirmar agendamento'}
            </button>

            <p className="text-center text-xs text-gray-400">
              Agendamento via RotaGenda
            </p>
          </div>
        )}

        {etapa === 'pix' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
              <p className="text-2xl mb-2">💰</p>
              <p className="text-base font-bold text-gray-800 mb-1">Pague para garantir sua reserva</p>
              <p className="text-sm text-gray-500 mb-4">
                Agendamento confirmado! Realize o pagamento via Pix para garantir sua vaga.
              </p>

              {pixPayload && (
                <div className="flex justify-center mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}`}
                    alt="QR Code Pix"
                    className="rounded-xl border border-gray-100"
                    width={200}
                    height={200}
                  />
                </div>
              )}

              <div style={{ background: '#f0f0ec' }} className="rounded-xl p-3 mb-4 text-left">
                <p className="text-xs text-gray-500 mb-1">Chave Pix</p>
                <p className="text-sm font-semibold text-gray-800 break-all">{chavePix}</p>
                {tipoChavePix && (
                  <p className="text-xs text-gray-400 mt-1 capitalize">
                    {tipoChavePix.replace('_', ' ')}
                  </p>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(chavePix || '')
                    alert('Chave Pix copiada!')
                  }}
                  className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={{ borderColor: cor, color: cor, background: '#fff' }}
                >
                  📋 Copiar chave Pix
                </button>
              </div>

              <div style={{ background: '#E1F5EE' }} className="rounded-xl p-3 mb-4">
                <p className="text-xs mb-1" style={{ color: '#085041' }}>Valor a pagar</p>
                <p className="text-2xl font-bold" style={{ color: cor }}>
                  R$ {valorParaPix.toFixed(2).replace('.', ',')}
                </p>
              </div>

              {rotaSelecionada && (
                <div
                  style={{ background: '#FAEEDA', borderColor: '#FAC775' }}
                  className="border rounded-xl p-3 text-left"
                >
                  <p className="text-xs font-semibold mb-1" style={{ color: '#854F0B' }}>📋 Resumo</p>
                  <p className="text-xs text-gray-600">
                    📍 {empresa.tipo_operacao === 'rota_fixa' ? `${embarque} → ${desembarque}` : `${rotaSelecionada.origem} → ${rotaSelecionada.destino}`}
                  </p>
                  {empresa.tipo_operacao === 'rota_fixa' ? (
                    <p className="text-xs text-gray-600">
                      🕐 {labelTurno} · {horaExibicao}h · {form.data.slice(8, 10)}/{form.data.slice(5, 7)}/{form.data.slice(0, 4)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600">
                      📅 {form.data.slice(8, 10)}/{form.data.slice(5, 7)}/{form.data.slice(0, 4)} às {form.horario}
                    </p>
                  )}
                  <p className="text-xs text-gray-600">👤 {form.nome}</p>
                  {empresa.tipo_operacao === 'rota_fixa' && form.quantidade_passageiros > 1 && (
                    <p className="text-xs font-semibold text-gray-600">👥 {form.quantidade_passageiros} passageiros</p>
                  )}
                </div>
              )}
            </div>

            {(() => {
              const telFormatado = formatarTelefoneWhatsApp(empresa.whatsapp_comercial || empresa.telefone)
              if (!telFormatado) return null
              const origem = empresa.tipo_operacao === 'rota_fixa'
                ? embarque
                : (concatEndereco(form) || rotaSelecionada?.origem || '')
              const destino = empresa.tipo_operacao === 'rota_fixa'
                ? desembarque
                : (concatEndereco({ rua: form.rua_desembarque, numero: form.numero_desembarque, bairro: form.bairro_desembarque, municipio: form.municipio_desembarque, referencia: form.referencia_desembarque }) || rotaSelecionada?.destino || '')
              const dataFmt = form.data ? `${form.data.slice(8, 10)}/${form.data.slice(5, 7)}/${form.data.slice(0, 4)}` : ''
              const horarioFmt = empresa.tipo_operacao === 'rota_fixa' ? ` (${labelTurno} ${horaExibicao}h)` : ` às ${form.horario}`
              const msg = encodeURIComponent(
                `Olá ${empresa.nome}, segue o comprovante do meu agendamento para ${dataFmt}${horarioFmt} - ${origem} → ${destino}`
              )
              return (
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-600 mb-3">
                    Após realizar o pagamento, envie o comprovante para{' '}
                    <span className="font-semibold text-gray-800">{empresa.nome}</span> no WhatsApp:
                  </p>
                  <a
                    href={`https://wa.me/${telFormatado}?text=${msg}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setTimeout(() => setEtapa('sucesso'), 1500)}
                    className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: '#25D366' }}
                  >
                    💬 Enviar no WhatsApp
                  </a>
                </div>
              )
            })()}

            <button onClick={resetForm}
              className="w-full py-3 rounded-2xl text-sm font-medium border border-gray-200 bg-white text-gray-600">
              Fazer outro agendamento
            </button>
          </div>
        )}

        {etapa === 'sucesso' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <p className="text-5xl mb-3">🎉</p>
              <p className="text-lg font-bold text-gray-800 mb-2">
                {empresa.tipo_operacao !== 'rota_fixa' ? 'Solicitação enviada!' : 'Agendamento confirmado!'}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                {empresa.tipo_operacao !== 'rota_fixa'
                  ? <>Em breve você receberá a confirmação da <span className="font-semibold">{empresa.nome}</span>.</>
                  : <>A equipe da <span className="font-semibold">{empresa.nome}</span> entrará em contato para confirmar os detalhes.</>
                }
              </p>

              {rotaSelecionada && (
                <div className="mt-4 rounded-xl p-4 text-left" style={{ background: '#f0f0ec' }}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Resumo do agendamento</p>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm text-gray-700">👤 {form.nome}</p>
                    <p className="text-sm text-gray-700">
                      📍 {empresa.tipo_operacao === 'rota_fixa'
                        ? `${embarque} → ${desembarque}`
                        : `${concatEndereco(form) || rotaSelecionada?.origem || ''} → ${concatEndereco({ rua: form.rua_desembarque, numero: form.numero_desembarque, bairro: form.bairro_desembarque, municipio: form.municipio_desembarque, referencia: form.referencia_desembarque }) || rotaSelecionada?.destino || ''}`}
                    </p>
                    {empresa.tipo_operacao === 'rota_fixa' ? (
                      <p className="text-sm text-gray-700">
                        🕐 {labelTurno} · {horaExibicao}h · {form.data.slice(8, 10)}/{form.data.slice(5, 7)}/{form.data.slice(0, 4)}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-700">
                        📅 {form.data.slice(8, 10)}/{form.data.slice(5, 7)}/{form.data.slice(0, 4)} às {form.horario}
                      </p>
                    )}
                    {empresa.tipo_operacao === 'rota_fixa' && form.quantidade_passageiros > 1 && (
                      <p className="text-sm text-gray-700">👥 {form.quantidade_passageiros} passageiros</p>
                    )}
                    <p className="text-sm font-semibold" style={{ color: cor }}>
                      💰 R$ {valorParaPix.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {(() => {
              const telFormatado = formatarTelefoneWhatsApp(empresa.whatsapp_comercial || empresa.telefone)
              if (!telFormatado) return null
              const origem = empresa.tipo_operacao === 'rota_fixa'
                ? embarque
                : (concatEndereco(form) || rotaSelecionada?.origem || '')
              const destino = empresa.tipo_operacao === 'rota_fixa'
                ? desembarque
                : (concatEndereco({ rua: form.rua_desembarque, numero: form.numero_desembarque, bairro: form.bairro_desembarque, municipio: form.municipio_desembarque, referencia: form.referencia_desembarque }) || rotaSelecionada?.destino || '')
              const dataFmt = form.data ? `${form.data.slice(8, 10)}/${form.data.slice(5, 7)}/${form.data.slice(0, 4)}` : ''
              const horarioFmt = empresa.tipo_operacao === 'rota_fixa' ? ` (${labelTurno} ${horaExibicao}h)` : ` às ${form.horario}`
              const msg = encodeURIComponent(
                `Olá ${empresa.nome}, segue o comprovante do meu agendamento para ${dataFmt}${horarioFmt} - ${origem} → ${destino}`
              )
              return (
                <a
                  href={`https://wa.me/${telFormatado}?text=${msg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: '#25D366' }}
                >
                  💬 Enviar comprovante no WhatsApp
                </a>
              )
            })()}

            <button onClick={resetForm}
              className="w-full py-3 rounded-2xl text-sm font-medium border border-gray-200 bg-white text-gray-600">
              Fazer outro agendamento
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .campo-input {
          width: 100%; padding: 10px 12px; border-radius: 12px;
          border: 1px solid #e5e7eb; font-size: 16px; color: #222;
          background: #fff; outline: none;
        }
        .campo-input:focus { border-color: ${cor}; }
      `}</style>
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
