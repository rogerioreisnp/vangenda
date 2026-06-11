'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function gerarPayloadPix(chave: string, nome: string, valor: number, cidade: string = 'Brasil'): string {
  const pixChave = chave
  const pixNome = nome.substring(0, 25).replace(/[^a-zA-Z ]/g, '')
  const pixCidade = cidade.substring(0, 15).replace(/[^a-zA-Z ]/g, '')
  const pixValor = valor.toFixed(2)

  function field(id: string, value: string) {
    const len = value.length.toString().padStart(2, '0')
    return `${id}${len}${value}`
  }

  const merchantAccountInfo = field('00', 'BR.GOV.BCB.PIX') + field('01', pixChave)
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

  // CRC16
  function crc16(str: string): string {
    let crc = 0xFFFF
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1
      }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
  }

  const withCrc = payload + '6304'
  return withCrc + crc16(withCrc)
}

export default function AgendarPage({ params }: { params: { slug: string } }) {
  const [motorista, setMotorista] = useState<any>(null)
  const [rota, setRota] = useState<any>(null)
  const [paradas, setParadas] = useState<any[]>([])
  const [precos, setPrecos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [etapa, setEtapa] = useState<'form' | 'pix' | 'sucesso'>('form')
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    origem: '',
    destino: '',
    data: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    turno: 'ida',
  })
  const [valor, setValor] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [agendamentoId, setAgendamentoId] = useState<string | null>(null)

  useEffect(() => { carregarMotorista() }, [])

  async function carregarMotorista() {
    const { data: mot } = await supabase
      .from('motoristas')
      .select('*')
      .eq('slug', params.slug)
      .single()

    if (!mot) { setLoading(false); return }
    setMotorista(mot)

    const { data: rts } = await supabase
      .from('rotas')
      .select('*')
      .eq('motorista_id', mot.id)
      .eq('ativa', true)
      .limit(1)
      .single()

    if (rts) {
      setRota(rts)
      const { data: pars } = await supabase.from('paradas').select('*').eq('rota_id', rts.id).order('ordem')
      const { data: prs } = await supabase.from('precos').select('*').eq('rota_id', rts.id)
      if (pars) setParadas(pars)
      if (prs) setPrecos(prs)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (form.origem && form.destino) {
      const preco = precos.find(p => p.parada_origem === form.origem && p.parada_destino === form.destino)
      setValor(preco ? preco.valor : null)
    }
  }, [form.origem, form.destino, precos])

  async function agendar() {
    if (!form.nome || !form.origem || !form.destino || !form.data) return
    setSalvando(true)

    const { data } = await supabase.from('agendamentos').insert({
      rota_id: rota.id,
      motorista_id: motorista.id,
      nome_passageiro: form.nome,
      telefone_passageiro: form.telefone,
      parada_origem: form.origem,
      parada_destino: form.destino,
      data_viagem: form.data,
      turno: form.turno,
      valor: valor || 0,
      forma_pagamento: motorista.pagamento_obrigatorio ? 'pix' : 'pendente',
      status: motorista.pagamento_obrigatorio ? 'agendado' : 'agendado',
    }).select().single()

    setSalvando(false)
    if (data) {
      setAgendamentoId(data.id)
      if (motorista.pagamento_obrigatorio && motorista.pix_chave) {
        setEtapa('pix')
      } else {
        setEtapa('sucesso')
      }
    }
  }

  const pixPayload = motorista?.pix_chave && valor
    ? gerarPayloadPix(motorista.pix_chave, motorista.nome, valor)
    : null

  const dataSelecionada = form.data
    ? format(new Date(form.data + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })
    : ''

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: '#f0f0ec' }}>
      <div className="text-4xl animate-pulse">🚐</div>
    </div>
  )

  if (!motorista) return (
    <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: '#f0f0ec' }}>
      <div className="text-center">
        <p className="text-4xl mb-3">😕</p>
        <p className="text-gray-600">Motorista não encontrado.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh" style={{ background: '#f0f0ec' }}>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-6 text-center">
        <div className="text-4xl mb-2">🚐</div>
        <h1 style={{ color: '#E1F5EE' }} className="text-lg font-bold">RotaGenda</h1>
        <p style={{ color: '#9FE1CB' }} className="text-sm mt-1">Agendamento — {motorista.nome}</p>
        {rota && (
          <div style={{ background: '#085041' }} className="mt-3 rounded-xl px-4 py-2 inline-block">
            <p style={{ color: '#5DCAA5' }} className="text-xs">
              {rota.nome} · Saída {rota.horario_ida}h
            </p>
          </div>
        )}
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">

        {/* ETAPA FORMULÁRIO */}
        {etapa === 'form' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">Seus dados</p>
              <Campo label="Seu nome completo">
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: João Silva" className="campo-input" />
              </Campo>
              <Campo label="WhatsApp">
                <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(95) 99999-9999" type="tel" className="campo-input" />
              </Campo>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">Sua viagem</p>
              <Campo label="Data da viagem">
                <input value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  type="date" min={format(addDays(new Date(), 1), 'yyyy-MM-dd')} className="campo-input" />
              </Campo>
              <Campo label="Turno">
                <div className="grid grid-cols-2 gap-2">
                  {(['ida', 'volta'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, turno: t }))}
                      className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                      style={form.turno === t
                        ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                        : { background: '#fff', color: '#666', borderColor: '#e5e7eb' }}>
                      {t === 'ida' ? `↑ Ida (${rota?.horario_ida}h)` : `↓ Volta (${rota?.horario_volta}h)`}
                    </button>
                  ))}
                </div>
              </Campo>
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Embarca em">
                  <select value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
                    className="campo-input">
                    <option value="">Selecione...</option>
                    {paradas.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                </Campo>
                <Campo label="Desembarca em">
                  <select value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                    className="campo-input">
                    <option value="">Selecione...</option>
                    {paradas.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                </Campo>
              </div>

              {valor !== null && (
                <div style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}
                  className="border rounded-xl px-4 py-3 flex justify-between items-center">
                  <span style={{ color: '#085041' }} className="text-sm font-medium">Valor da passagem</span>
                  <span style={{ color: '#0F6E56' }} className="text-xl font-bold">
                    R$ {valor.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}
            </div>

            <button onClick={agendar}
              disabled={salvando || !form.nome || !form.origem || !form.destino || !form.data}
              className="w-full py-4 rounded-2xl text-white text-base font-bold disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvando ? 'Agendando...' : motorista.pagamento_obrigatorio ? '→ Avançar para pagamento' : '✓ Confirmar agendamento'}
            </button>

            {motorista.pagamento_obrigatorio && (
              <p className="text-center text-xs text-gray-400">
                Você será direcionado para o pagamento via Pix
              </p>
            )}
          </div>
        )}

        {/* ETAPA PIX */}
        {etapa === 'pix' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
              <p className="text-2xl mb-2">💰</p>
              <p className="text-base font-bold text-gray-800 mb-1">Pague sua passagem</p>
              <p className="text-sm text-gray-500 mb-4">Escaneie o QR Code ou copie a chave Pix</p>

              {/* QR Code gerado via API pública */}
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

              <div style={{ background: '#f0f0ec' }} className="rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Chave Pix</p>
                <p className="text-sm font-semibold text-gray-800 break-all">{motorista.pix_chave}</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">{motorista.pix_tipo}</p>
              </div>

              <div style={{ background: '#E1F5EE' }} className="rounded-xl p-3 mb-4">
                <p className="text-xs" style={{ color: '#085041' }}>Valor a pagar</p>
                <p className="text-2xl font-bold" style={{ color: '#0F6E56' }}>
                  R$ {valor?.toFixed(2).replace('.', ',')}
                </p>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                Após pagar, envie o comprovante pelo WhatsApp para o motorista confirmar sua vaga.
              </p>
            </div>

            <div style={{ background: '#FAEEDA', borderColor: '#FAC775' }}
              className="border rounded-xl p-3 flex gap-3">
              <span className="text-lg">📋</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#854F0B' }}>Resumo do agendamento</p>
                <p className="text-xs text-gray-600 mt-1 capitalize">{dataSelecionada}</p>
                <p className="text-xs text-gray-600">{form.origem} → {form.destino}</p>
                <p className="text-xs text-gray-600">{form.turno === 'ida' ? `Saída ${rota?.horario_ida}h` : `Saída ${rota?.horario_volta}h`}</p>
              </div>
            </div>

            <button onClick={() => setEtapa('sucesso')}
              className="w-full py-4 rounded-2xl text-white text-base font-bold"
              style={{ background: '#1D9E75' }}>
              ✓ Já paguei
            </button>
          </div>
        )}

        {/* ETAPA SUCESSO */}
        {etapa === 'sucesso' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <p className="text-5xl mb-3">🎉</p>
              <p className="text-lg font-bold text-gray-800 mb-1">Agendado com sucesso!</p>
              <p className="text-sm text-gray-500 mb-4">Sua vaga está reservada</p>

              <div style={{ background: '#E1F5EE' }} className="rounded-xl p-4 text-left mb-4">
                <p className="text-xs font-semibold" style={{ color: '#085041' }} >Detalhes da viagem</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  <p className="text-sm text-gray-700">👤 {form.nome}</p>
                  <p className="text-sm text-gray-700 capitalize">📅 {dataSelecionada}</p>
                  <p className="text-sm text-gray-700">📍 {form.origem} → {form.destino}</p>
                  <p className="text-sm text-gray-700">🕐 {form.turno === 'ida' ? `Saída ${rota?.horario_ida}h` : `Saída ${rota?.horario_volta}h`}</p>
                  {valor && <p className="text-sm font-semibold" style={{ color: '#0F6E56' }}>💰 R$ {valor.toFixed(2).replace('.', ',')}</p>}
                </div>
              </div>

              {motorista.pagamento_obrigatorio ? (
                <p className="text-xs text-gray-400 leading-relaxed">
                  Envie o comprovante de pagamento pelo WhatsApp para o motorista confirmar sua vaga.
                </p>
              ) : (
                <p className="text-xs text-gray-400 leading-relaxed">
                  O motorista entrará em contato para confirmar sua vaga. Aguarde!
                </p>
              )}
            </div>

            <button onClick={() => { setEtapa('form'); setForm({ nome: '', telefone: '', origem: '', destino: '', data: format(addDays(new Date(), 1), 'yyyy-MM-dd'), turno: 'ida' }); setValor(null) }}
              className="w-full py-3 rounded-2xl text-sm font-medium border border-gray-200 bg-white text-gray-600">
              Fazer novo agendamento
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
        .campo-input:focus { border-color: #1D9E75; }
      `}</style>
    </div>
  )
}

function Campo({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  )
}
