'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
}

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
    quantidade_bagagem: 0,
  })
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null)
  const [rotaManual, setRotaManual] = useState(false)
  const [origemManual, setOrigemManual] = useState('')
  const [destinoManual, setDestinoManual] = useState('')
  const [numeroVoo, setNumeroVoo] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [showPassageiro2, setShowPassageiro2] = useState(false)
  const [nomePassageiro2, setNomePassageiro2] = useState('')
  const [telefonePassageiro2, setTelefonePassageiro2] = useState('')
  const [origemPassageiro2, setOrigemPassageiro2] = useState('')
  const [destinoPassageiro2, setDestinoPassageiro2] = useState('')
  type PassageiroExtra = {
    nome: string; telefone: string
    rua: string; numero: string; bairro: string; municipio: string; cep: string; referencia: string
    rua_desembarque: string; numero_desembarque: string; bairro_desembarque: string
    municipio_desembarque: string; cep_desembarque: string; referencia_desembarque: string
  }
  const PASSAGEIRO_EXTRA_VAZIO: PassageiroExtra = {
    nome: '', telefone: '',
    rua: '', numero: '', bairro: '', municipio: '', cep: '', referencia: '',
    rua_desembarque: '', numero_desembarque: '', bairro_desembarque: '',
    municipio_desembarque: '', cep_desembarque: '', referencia_desembarque: '',
  }
  const [passageirosExtras, setPassageirosExtras] = useState<PassageiroExtra[]>([])
  const [enderecosSugeridos, setEnderecosSugeridos] = useState<string[]>([])
  const [showRetorno, setShowRetorno] = useState(false)
  const [retornoData, setRetornoData] = useState('')
  const [retornoHorario, setRetornoHorario] = useState('')
  const [retornoOrigem, setRetornoOrigem] = useState('')
  const [retornoDestino, setRetornoDestino] = useState('')
  const [turnoRF, setTurnoRF] = useState<'ida' | 'volta'>('ida')
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
      .select('id, nome, origem, destino, preco, horario_ida, horario_volta, dias_semana, capacidade')
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

  // Sincroniza form.horario quando o turno muda (só rota_fixa)
  useEffect(() => {
    if (empresa.tipo_operacao !== 'rota_fixa' || !rotaSelecionada) return
    const hora = turnoRF === 'ida' ? rotaSelecionada.horario_ida : rotaSelecionada.horario_volta
    setForm(f => ({ ...f, horario: hora?.slice(0, 5) ?? '' }))
  }, [turnoRF, rotaSelecionada])

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
  }, [rotaSelecionada, form.data, form.horario, empresa.tipo_operacao])

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
    if (rotaManual && !origemManual.trim()) { setErro('Informe a origem da viagem'); return }
    if (rotaManual && !destinoManual.trim()) { setErro('Informe o destino da viagem'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    if (empresa.tipo_operacao === 'rota_fixa' && !isDiaOperacao) {
      setErro(`Esta rota não opera neste dia. Dias disponíveis: ${diasTexto}.`); return
    }
    if (!form.horario) { setErro('Horário é obrigatório'); return }
    if (empresa.tipo_operacao === 'rota_fixa' && (!embarque || !desembarque)) {
      setErro('Selecione o embarque e desembarque'); return
    }
    if (empresa.tipo_operacao === 'rota_fixa' && valorTrechoRF === null) {
      setErro('Trecho não disponível para esta rota'); return
    }
    if (!rotaManual && !rotaSelecionada) return

    // Verificar vagas disponíveis para rota_fixa (RPC bypassa RLS para anon)
    if (empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada?.capacidade) {
      const { data: ocupadas } = await supabase.rpc('count_vagas_ocupadas', {
        p_rota_id: rotaSelecionada.id,
        p_data: form.data,
        p_horario: form.horario,
      })
      const vagasDisponiveis = rotaSelecionada.capacidade - (ocupadas || 0)
      if (vagasDisponiveis <= 0) {
        setErro('Não há vagas disponíveis para esta rota nesta data e horário.')
        return
      }
    }

    setSalvando(true)
    setErro('')

    const origemSave = empresa.tipo_operacao === 'rota_fixa' ? embarque : (rotaManual ? origemManual.trim() : rotaSelecionada!.origem ?? '')
    const destinoSave = empresa.tipo_operacao === 'rota_fixa' ? desembarque : (rotaManual ? destinoManual.trim() : rotaSelecionada!.destino ?? '')

    // ── Caminho transfer/fretamento: salva em corridas_empresa como pendente ──
    if (empresa.tipo_operacao !== 'rota_fixa') {
      const { error } = await supabase.from('corridas_empresa').insert({
        empresa_id: empresa.id,
        cliente_nome: form.nome.trim(),
        cliente_telefone: form.telefone.trim(),
        email_solicitante: form.email.trim() || null,
        data_hora: `${form.data}T${form.horario}:00`,
        origem: origemSave,
        destino: destinoSave,
        numero_voo: numeroVoo.trim() || null,
        forma_pagamento: formaPagamento || 'a_definir',
        observacoes: form.observacoes.trim() || null,
        nome_passageiro2: showPassageiro2 && nomePassageiro2.trim() ? nomePassageiro2.trim() : null,
        telefone_passageiro2: showPassageiro2 && telefonePassageiro2.trim() ? telefonePassageiro2.trim() : null,
        retorno_data: showRetorno && retornoData ? retornoData : null,
        retorno_horario: showRetorno && retornoHorario ? retornoHorario : null,
        retorno_origem: showRetorno && retornoOrigem.trim() ? retornoOrigem.trim() : null,
        retorno_destino: showRetorno && retornoDestino.trim() ? retornoDestino.trim() : null,
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
        quantidade_bagagem: form.quantidade_bagagem || 0,
        passageiros_adicionais: passageirosExtras.length > 0
          ? passageirosExtras.map(p => ({
              nome: p.nome.trim(), telefone: p.telefone.trim(),
              rua: p.rua.trim() || null, numero: p.numero.trim() || null, bairro: p.bairro.trim() || null,
              municipio: p.municipio.trim() || null, cep: p.cep.trim() || null, referencia: p.referencia.trim() || null,
              rua_desembarque: p.rua_desembarque.trim() || null, numero_desembarque: p.numero_desembarque.trim() || null,
              bairro_desembarque: p.bairro_desembarque.trim() || null, municipio_desembarque: p.municipio_desembarque.trim() || null,
              cep_desembarque: p.cep_desembarque.trim() || null, referencia_desembarque: p.referencia_desembarque.trim() || null,
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

    // ── Caminho rota_fixa: salva em corridas_empresa (sem alteração) ─────────
    const valorSave = valorTrechoRF ?? 0

    const { error } = await supabase.from('corridas_empresa').insert({
      empresa_id: empresa.id,
      rota_id: rotaSelecionada!.id,
      origem: origemSave,
      destino: destinoSave,
      data_hora: `${form.data}T${form.horario}:00`,
      cliente_nome: form.nome.trim(),
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
    })

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
    setForm({ rota_id: '', data: '', horario: '', nome: '', telefone: '', email: '', observacoes: '', rua: '', numero: '', bairro: '', municipio: '', cep: '', referencia: '', rua_desembarque: '', numero_desembarque: '', bairro_desembarque: '', municipio_desembarque: '', cep_desembarque: '', referencia_desembarque: '', quantidade_bagagem: 0 })
    setRotaSelecionada(null)
    setRotaManual(false)
    setOrigemManual('')
    setDestinoManual('')
    setNumeroVoo('')
    setFormaPagamento('pix')
    setShowPassageiro2(false)
    setNomePassageiro2('')
    setTelefonePassageiro2('')
    setOrigemPassageiro2('')
    setDestinoPassageiro2('')
    setPassageirosExtras([])
    setEnderecosSugeridos([])
    setShowRetorno(false)
    setRetornoData('')
    setRetornoHorario('')
    setRetornoOrigem('')
    setRetornoDestino('')
    setTurnoRF('ida')
    setEmbarque('')
    setDesembarque('')
    setValorTrechoRF(null)
    setTrechosRF([])
    setParadasUnicas([])
    setVagasDisponiveis(null)
    setErro('')
  }

  const valorParaPix = empresa.tipo_operacao === 'rota_fixa' ? (valorTrechoRF ?? 0) : (rotaManual ? 0 : Number(rotaSelecionada?.preco ?? 0))
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
          <p className="text-sm mt-1.5 leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {empresa.descricao}
          </p>
        )}
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">

        {etapa === 'form' && (
          <div className="flex flex-col gap-4">

            {/* Dados pessoais */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">Seus dados</p>
              <Campo label="Seu nome *">
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: João Silva"
                  className="campo-input"
                />
              </Campo>
              <Campo label="Seu telefone *">
                <input
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  onBlur={e => buscarEnderecosPorTelefone(e.target.value)}
                  placeholder="(XX) XXXXX-XXXX"
                  type="tel"
                  className="campo-input"
                />
              </Campo>
              <Campo label="Seu e-mail (para receber confirmação)">
                <input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  type="email"
                  className="campo-input"
                />
              </Campo>
              {empresa.tipo_operacao !== 'rota_fixa' && (
                <Campo label="Número do voo">
                  <input value={numeroVoo} onChange={e => setNumeroVoo(e.target.value)}
                    placeholder="Ex: G3 1234 (opcional)" className="campo-input" />
                </Campo>
              )}
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

            {/* Passageiro adicional (só transfer) */}
            {empresa.tipo_operacao !== 'rota_fixa' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                <button type="button" onClick={() => setShowPassageiro2(v => !v)}
                  className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-700">👥 Passageiro adicional</span>
                  <span className="text-sm font-semibold" style={{ color: cor }}>
                    {showPassageiro2 ? '− Remover' : '+ Adicionar'}
                  </span>
                </button>
                {showPassageiro2 && (
                  <>
                    <Campo label="Nome do 2º passageiro">
                      <input value={nomePassageiro2} onChange={e => setNomePassageiro2(e.target.value)}
                        placeholder="Nome completo" className="campo-input" />
                    </Campo>
                    <Campo label="Telefone do 2º passageiro">
                      <input value={telefonePassageiro2} onChange={e => setTelefonePassageiro2(e.target.value)}
                        placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
                    </Campo>
                    <Campo label="Origem do 2º passageiro">
                      <input value={origemPassageiro2} onChange={e => setOrigemPassageiro2(e.target.value)}
                        placeholder="Ex: Aeroporto, Hotel, Endereço..."
                        className="campo-input" list="sugestoes-enderecos" />
                    </Campo>
                    <Campo label="Destino do 2º passageiro">
                      <input value={destinoPassageiro2} onChange={e => setDestinoPassageiro2(e.target.value)}
                        placeholder="Ex: Hotel, Aeroporto, Endereço..."
                        className="campo-input" list="sugestoes-enderecos" />
                    </Campo>
                  </>
                )}
              </div>
            )}

            {/* Mais passageiros (só transfer) — repetível, cada um com sua ficha */}
            {empresa.tipo_operacao !== 'rota_fixa' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-700">👥 Mais passageiros</span>
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
                  </div>
                ))}
              </div>
            )}

            {/* Detalhes da viagem */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">Sua viagem</p>

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
                          : `${r.nome || `${r.origem} → ${r.destino}`} — R$ ${Number(r.preco).toFixed(2).replace('.', ',')}`}
                      </option>
                    ))}
                    {empresa.tipo_operacao !== 'rota_fixa' && (
                      <option value="manual">✏️ Outra rota (digitar manualmente)</option>
                    )}
                  </select>
                )}
              </Campo>

              {rotaManual && (
                <>
                  <Campo label="Origem *">
                    <input value={origemManual}
                      onChange={e => setOrigemManual(e.target.value)}
                      placeholder="Ex: Aeroporto, Hotel, Endereço..."
                      className="campo-input"
                      list="sugestoes-enderecos" />
                  </Campo>
                  <Campo label="Destino *">
                    <input value={destinoManual}
                      onChange={e => setDestinoManual(e.target.value)}
                      placeholder="Ex: Hotel, Aeroporto, Endereço..."
                      className="campo-input"
                      list="sugestoes-enderecos" />
                  </Campo>
                </>
              )}

              {rotaSelecionada && empresa.tipo_operacao === 'rota_fixa' && (
                <>
                  {/* Paradas de embarque/desembarque */}
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

                  {valorTrechoRF !== null && (
                    <div className="rounded-xl px-4 py-3" style={{ background: '#f0f0ec' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Valor do trecho</span>
                        <span className="text-xl font-bold" style={{ color: cor }}>
                          R$ {valorTrechoRF.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    </div>
                  )}

                  {embarque && desembarque && valorTrechoRF === null && (
                    <div className="rounded-xl px-4 py-3 border" style={{ background: '#FCEBEB', borderColor: '#F5BCBC' }}>
                      <p className="text-xs text-center" style={{ color: '#A32D2D' }}>Trecho não disponível para esta rota.</p>
                    </div>
                  )}
                </>
              )}

              {rotaSelecionada && empresa.tipo_operacao !== 'rota_fixa' && (
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

              {/* Turno (rota_fixa) — horário fixo da rota */}
              {empresa.tipo_operacao === 'rota_fixa' && rotaSelecionada && (
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

            {/* Endereço detalhado embarque + desembarque (opcional) */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">📍 Endereço de embarque <span className="text-xs font-normal text-gray-400">(opcional)</span></p>
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

            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">🏁 Endereço de desembarque <span className="text-xs font-normal text-gray-400">(opcional)</span></p>
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

            {/* Retorno (só transfer) */}
            {empresa.tipo_operacao !== 'rota_fixa' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                <button type="button" onClick={() => setShowRetorno(v => !v)}
                  className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-700">🔄 Quer agendar seu retorno?</span>
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
                    <Campo label="Origem do retorno">
                      <input value={retornoOrigem} onChange={e => setRetornoOrigem(e.target.value)}
                        placeholder="Ex: Hotel, Endereço..." className="campo-input" list="sugestoes-enderecos" />
                    </Campo>
                    <Campo label="Destino do retorno">
                      <input value={retornoDestino} onChange={e => setRetornoDestino(e.target.value)}
                        placeholder="Ex: Aeroporto, Endereço..." className="campo-input" list="sugestoes-enderecos" />
                    </Campo>
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
              disabled={salvando}
              className="w-full py-4 rounded-2xl text-white text-base font-bold disabled:opacity-40"
              style={{ background: cor }}
            >
              {salvando ? 'Enviando...' : empresa.tipo_operacao !== 'rota_fixa' ? '✓ Enviar solicitação' : '✓ Confirmar agendamento'}
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
                </div>
              )}
            </div>

            {(() => {
              const tel = (empresa.whatsapp_comercial || empresa.telefone || '').replace(/\D/g, '')
              if (!tel) return null
              const telFormatado = tel.startsWith('55') ? tel : `55${tel}`
              const origem = empresa.tipo_operacao === 'rota_fixa' ? embarque : (rotaManual ? origemManual : rotaSelecionada?.origem ?? '')
              const destino = empresa.tipo_operacao === 'rota_fixa' ? desembarque : (rotaManual ? destinoManual : rotaSelecionada?.destino ?? '')
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
                      📍 {empresa.tipo_operacao === 'rota_fixa' ? `${embarque} → ${desembarque}` : rotaManual ? `${origemManual} → ${destinoManual}` : `${rotaSelecionada!.origem} → ${rotaSelecionada!.destino}`}
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
                    <p className="text-sm font-semibold" style={{ color: cor }}>
                      💰 R$ {valorParaPix.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {(() => {
              const tel = (empresa.whatsapp_comercial || empresa.telefone || '').replace(/\D/g, '')
              if (!tel) return null
              const telFormatado = tel.startsWith('55') ? tel : `55${tel}`
              const origem = empresa.tipo_operacao === 'rota_fixa' ? embarque : (rotaManual ? origemManual : rotaSelecionada?.origem ?? '')
              const destino = empresa.tipo_operacao === 'rota_fixa' ? desembarque : (rotaManual ? destinoManual : rotaSelecionada?.destino ?? '')
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
          border: 1px solid #e5e7eb; font-size: 14px; color: #222;
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
