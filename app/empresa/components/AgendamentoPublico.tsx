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
}

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
    observacoes: '',
  })
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [chavePix, setChavePix] = useState<string | null>(null)
  const [tipoChavePix, setTipoChavePix] = useState<string | null>(null)
  const [trechosRF, setTrechosRF] = useState<{ nome: string; preco: number }[]>([])
  const [paradasUnicas, setParadasUnicas] = useState<string[]>([])
  const [embarque, setEmbarque] = useState('')
  const [desembarque, setDesembarque] = useState('')
  const [valorTrechoRF, setValorTrechoRF] = useState<number | null>(null)

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
  }, [])

  async function carregarRotas() {
    const { data } = await supabase
      .from('rotas_empresa')
      .select('id, nome, origem, destino, preco')
      .eq('empresa_id', empresa.id)
      .order('created_at')
    if (data) setRotas(data)
    setLoadingRotas(false)
  }

  async function selecionarRota(rotaId: string) {
    const rota = rotas.find(r => r.id === rotaId) || null
    setRotaSelecionada(rota)
    setForm(f => ({ ...f, rota_id: rotaId }))
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

  useEffect(() => {
    if (!embarque || !desembarque || empresa.tipo_operacao !== 'rota_fixa') return
    const trecho = trechosRF.find(t => t.nome === `${embarque} → ${desembarque}`)
    setValorTrechoRF(trecho ? Number(trecho.preco) : null)
  }, [embarque, desembarque, trechosRF])

  async function confirmar() {
    if (!form.nome.trim()) { setErro('Seu nome é obrigatório'); return }
    if (!form.telefone.trim()) { setErro('Seu telefone é obrigatório'); return }
    if (!form.rota_id) { setErro('Selecione uma rota'); return }
    if (!form.data) { setErro('Data é obrigatória'); return }
    if (!form.horario) { setErro('Horário é obrigatório'); return }
    if (empresa.tipo_operacao === 'rota_fixa' && (!embarque || !desembarque)) {
      setErro('Selecione o embarque e desembarque'); return
    }
    if (empresa.tipo_operacao === 'rota_fixa' && valorTrechoRF === null) {
      setErro('Trecho não disponível para esta rota'); return
    }
    if (!rotaSelecionada) return

    setSalvando(true)
    setErro('')

    const origemSave = empresa.tipo_operacao === 'rota_fixa' ? embarque : rotaSelecionada.origem
    const destinoSave = empresa.tipo_operacao === 'rota_fixa' ? desembarque : rotaSelecionada.destino
    const valorSave = empresa.tipo_operacao === 'rota_fixa' ? (valorTrechoRF ?? 0) : rotaSelecionada.preco

    const { error } = await supabase.from('corridas_empresa').insert({
      empresa_id: empresa.id,
      rota_id: rotaSelecionada.id,
      origem: origemSave,
      destino: destinoSave,
      data_hora: `${form.data}T${form.horario}:00`,
      cliente_nome: form.nome.trim(),
      cliente_telefone: form.telefone.trim(),
      valor: valorSave,
      status: 'confirmada',
      motorista_id: null,
      tipo_servico: empresa.tipo_operacao === 'rota_fixa' ? 'rota_fixa' : 'transfer',
      forma_pagamento: 'a_definir',
      observacoes: form.observacoes.trim() || null,
    })

    if (error) {
      setSalvando(false)
      console.error('Erro ao agendar:', error)
      setErro('Erro ao enviar agendamento. Tente novamente.')
      return
    }

    // Busca chave Pix da empresa pelo slug — usa a mesma RLS pública que carrega a página
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

  const valorParaPix = empresa.tipo_operacao === 'rota_fixa' ? (valorTrechoRF ?? 0) : Number(rotaSelecionada?.preco ?? 0)
  const pixPayload = chavePix && rotaSelecionada && valorParaPix > 0
    ? gerarPayloadPix(chavePix, empresa.nome, valorParaPix)
    : null

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
                  placeholder="(XX) XXXXX-XXXX"
                  type="tel"
                  className="campo-input"
                />
              </Campo>
            </div>

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
                  </select>
                )}
              </Campo>

              {rotaSelecionada && empresa.tipo_operacao === 'rota_fixa' && (
                <>
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

              <div className="grid grid-cols-2 gap-2">
                <Campo label="Data *">
                  <input
                    type="date"
                    value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    min={new Date().toISOString().slice(0, 10)}
                    className="campo-input"
                  />
                </Campo>
                <Campo label="Horário *">
                  <input
                    type="time"
                    value={form.horario}
                    onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
                    className="campo-input"
                  />
                </Campo>
              </div>

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
              {salvando ? 'Enviando...' : '✓ Confirmar agendamento'}
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
                  R$ {(empresa.tipo_operacao === 'rota_fixa' ? (valorTrechoRF ?? 0) : Number(rotaSelecionada?.preco ?? 0)).toFixed(2).replace('.', ',')}
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
                  <p className="text-xs text-gray-600">
                    📅 {form.data.slice(8, 10)}/{form.data.slice(5, 7)}/{form.data.slice(0, 4)} às {form.horario}
                  </p>
                  <p className="text-xs text-gray-600">👤 {form.nome}</p>
                </div>
              )}
            </div>

            {(() => {
              const tel = (empresa.whatsapp_comercial || empresa.telefone || '').replace(/\D/g, '')
              if (!tel) return null
              const telFormatado = tel.startsWith('55') ? tel : `55${tel}`
              const origem = empresa.tipo_operacao === 'rota_fixa' ? embarque : rotaSelecionada?.origem ?? ''
              const destino = empresa.tipo_operacao === 'rota_fixa' ? desembarque : rotaSelecionada?.destino ?? ''
              const dataFmt = form.data ? `${form.data.slice(8, 10)}/${form.data.slice(5, 7)}/${form.data.slice(0, 4)}` : ''
              const msg = encodeURIComponent(
                `Olá ${empresa.nome}, segue o comprovante do meu agendamento para ${dataFmt} - ${origem} → ${destino}`
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

            <button
              onClick={() => {
                setEtapa('form')
                setForm({ rota_id: '', data: '', horario: '', nome: '', telefone: '', observacoes: '' })
                setRotaSelecionada(null)
                setEmbarque('')
                setDesembarque('')
                setValorTrechoRF(null)
                setTrechosRF([])
                setParadasUnicas([])
                setErro('')
              }}
              className="w-full py-3 rounded-2xl text-sm font-medium border border-gray-200 bg-white text-gray-600"
            >
              Fazer outro agendamento
            </button>
          </div>
        )}

        {etapa === 'sucesso' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <p className="text-5xl mb-3">🎉</p>
              <p className="text-lg font-bold text-gray-800 mb-2">Agendamento confirmado!</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                A equipe da <span className="font-semibold">{empresa.nome}</span> entrará em contato
                para confirmar os detalhes.
              </p>

              {rotaSelecionada && (
                <div className="mt-4 rounded-xl p-4 text-left" style={{ background: '#f0f0ec' }}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Resumo do agendamento</p>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm text-gray-700">👤 {form.nome}</p>
                    <p className="text-sm text-gray-700">📍 {empresa.tipo_operacao === 'rota_fixa' ? `${embarque} → ${desembarque}` : `${rotaSelecionada.origem} → ${rotaSelecionada.destino}`}</p>
                    <p className="text-sm text-gray-700">
                      📅 {form.data.slice(8, 10)}/{form.data.slice(5, 7)}/{form.data.slice(0, 4)} às {form.horario}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: cor }}>
                      💰 R$ {(empresa.tipo_operacao === 'rota_fixa' ? (valorTrechoRF ?? 0) : Number(rotaSelecionada.preco)).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {(() => {
              const tel = (empresa.whatsapp_comercial || empresa.telefone || '').replace(/\D/g, '')
              if (!tel) return null
              const telFormatado = tel.startsWith('55') ? tel : `55${tel}`
              const origem = empresa.tipo_operacao === 'rota_fixa' ? embarque : rotaSelecionada?.origem ?? ''
              const destino = empresa.tipo_operacao === 'rota_fixa' ? desembarque : rotaSelecionada?.destino ?? ''
              const dataFmt = form.data ? `${form.data.slice(8, 10)}/${form.data.slice(5, 7)}/${form.data.slice(0, 4)}` : ''
              const msg = encodeURIComponent(
                `Olá ${empresa.nome}, segue o comprovante do meu agendamento para ${dataFmt} - ${origem} → ${destino}`
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

            <button
              onClick={() => {
                setEtapa('form')
                setForm({ rota_id: '', data: '', horario: '', nome: '', telefone: '', observacoes: '' })
                setRotaSelecionada(null)
                setEmbarque('')
                setDesembarque('')
                setValorTrechoRF(null)
                setTrechosRF([])
                setParadasUnicas([])
                setErro('')
              }}
              className="w-full py-3 rounded-2xl text-sm font-medium border border-gray-200 bg-white text-gray-600"
            >
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
