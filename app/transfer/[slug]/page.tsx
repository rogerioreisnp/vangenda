'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type EmpresaTransfer = {
  id: string
  nome: string
  descricao: string | null
  cor_destaque: string | null
  logo_url: string | null
  tipo_operacao: string | null
  telefone: string | null
  whatsapp_comercial: string | null
}

type RotaOpcao = {
  id: string
  nome: string | null
  origem: string | null
  destino: string | null
  preco: number
}

type FormTransfer = {
  nome: string
  telefone: string
  data: string
  horario: string
  origem: string
  destino: string
  numero_voo: string
  forma_pagamento: string
  observacoes: string
  nome_passageiro2: string
  telefone_passageiro2: string
  retorno_data: string
  retorno_horario: string
  retorno_origem: string
  retorno_destino: string
}

export default function TransferSlugPage({ params }: { params: { slug: string } }) {
  const [empresa, setEmpresa] = useState<EmpresaTransfer | null>(null)
  const [rotas, setRotas] = useState<RotaOpcao[]>([])
  const [rotaSelecionada, setRotaSelecionada] = useState<RotaOpcao | null>(null)
  const [rotaManual, setRotaManual] = useState(false)
  const [loading, setLoading] = useState(true)
  const [etapa, setEtapa] = useState<'form' | 'sucesso'>('form')
  const [showPassageiro2, setShowPassageiro2] = useState(false)
  const [showRetorno, setShowRetorno] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroMsg, setErroMsg] = useState<string | null>(null)

  const hoje = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<FormTransfer>({
    nome: '',
    telefone: '',
    data: hoje,
    horario: '',
    origem: '',
    destino: '',
    numero_voo: '',
    forma_pagamento: 'pix',
    observacoes: '',
    nome_passageiro2: '',
    telefone_passageiro2: '',
    retorno_data: hoje,
    retorno_horario: '',
    retorno_origem: '',
    retorno_destino: '',
  })

  useEffect(() => {
    carregarEmpresa()
    try {
      const nome = localStorage.getItem('transfer_nome') ?? ''
      const telefone = localStorage.getItem('transfer_telefone') ?? ''
      if (nome || telefone) setForm(f => ({ ...f, nome, telefone }))
    } catch {}
  }, [])

  async function carregarEmpresa() {
    const { data: emp } = await supabase
      .from('empresas')
      .select('id, nome, descricao, cor_destaque, logo_url, tipo_operacao, telefone, whatsapp_comercial')
      .eq('slug', params.slug)
      .single()
    if (emp) {
      setEmpresa(emp)
      const { data: rts } = await supabase
        .from('rotas_empresa')
        .select('id, nome, origem, destino, preco')
        .eq('empresa_id', emp.id)
        .order('created_at')
      if (rts && rts.length > 0) setRotas(rts)
    }
    setLoading(false)
  }

  function selecionarRota(rotaId: string) {
    if (rotaId === 'manual') {
      setRotaSelecionada(null)
      setRotaManual(true)
      setForm(f => ({ ...f, origem: '', destino: '' }))
      return
    }
    if (!rotaId) {
      setRotaSelecionada(null)
      setRotaManual(false)
      setForm(f => ({ ...f, origem: '', destino: '' }))
      return
    }
    const rota = rotas.find(r => r.id === rotaId) ?? null
    setRotaSelecionada(rota)
    setRotaManual(false)
    if (rota) {
      setForm(f => ({ ...f, origem: rota.origem ?? '', destino: rota.destino ?? '' }))
    }
  }

  async function enviar() {
    setErroMsg(null)
    if (!form.nome.trim()) { setErroMsg('Nome é obrigatório'); return }
    if (!form.telefone.trim()) { setErroMsg('Telefone é obrigatório'); return }
    if (!form.data) { setErroMsg('Data é obrigatória'); return }
    if (!form.horario) { setErroMsg('Horário é obrigatório'); return }
    if (!form.origem.trim()) { setErroMsg('Origem é obrigatória'); return }
    if (!form.destino.trim()) { setErroMsg('Destino é obrigatório'); return }
    if (showRetorno && !form.retorno_data) { setErroMsg('Data do retorno é obrigatória'); return }
    if (!empresa) return

    setSalvando(true)

    const { error } = await supabase.from('corridas_empresa').insert({
      empresa_id: empresa.id,
      cliente_nome: form.nome.trim(),
      cliente_telefone: form.telefone.trim(),
      data_hora: `${form.data}T${form.horario}-03:00`,
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      numero_voo: form.numero_voo.trim() || null,
      forma_pagamento: form.forma_pagamento,
      observacoes: form.observacoes.trim() || null,
      nome_passageiro2: showPassageiro2 && form.nome_passageiro2.trim() ? form.nome_passageiro2.trim() : null,
      telefone_passageiro2: showPassageiro2 && form.telefone_passageiro2.trim() ? form.telefone_passageiro2.trim() : null,
      retorno_data: showRetorno && form.retorno_data ? form.retorno_data : null,
      retorno_horario: showRetorno && form.retorno_horario ? form.retorno_horario : null,
      retorno_origem: showRetorno && form.retorno_origem.trim() ? form.retorno_origem.trim() : null,
      retorno_destino: showRetorno && form.retorno_destino.trim() ? form.retorno_destino.trim() : null,
      tipo_servico: 'transfer',
      valor: 0,
      status: 'pendente',
    })

    setSalvando(false)

    if (error) {
      setErroMsg('Erro ao enviar solicitação. Tente novamente.')
      console.error(error)
      return
    }

    try {
      localStorage.setItem('transfer_nome', form.nome.trim())
      localStorage.setItem('transfer_telefone', form.telefone.trim())
    } catch {}

    setEtapa('sucesso')
  }

  const cor = empresa?.cor_destaque || '#1D9E75'

  if (loading) return (
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

  if (!empresa || empresa.tipo_operacao !== 'transfer') return (
    <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: '#f0f0ec' }}>
      <div className="text-center">
        <p className="text-4xl mb-3">😕</p>
        <p className="text-gray-600">Página não encontrada.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh" style={{ background: '#f0f0ec' }}>
      <div style={{ background: cor }} className="px-4 pt-12 pb-6 text-center">
        {empresa.logo_url ? (
          <img src={empresa.logo_url} alt={empresa.nome}
            className="h-16 object-contain mx-auto mb-3 rounded-xl"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <svg width="64" height="64" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="mb-2 mx-auto">
            <rect width="192" height="192" rx="42" fill="#04342C"/>
            <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
            <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
            <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
            <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
          </svg>
        )}
        <h1 className="text-xl font-bold text-white">{empresa.nome}</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>✈️ Solicitar Transfer</p>
        {empresa.descricao && (
          <p className="text-sm mt-1.5 leading-snug" style={{ color: 'rgba(255,255,255,0.8)' }}>
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
              <Campo label="Nome completo *">
                <input value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: João Silva" className="campo-input" />
              </Campo>
              <Campo label="Telefone / WhatsApp *">
                <input value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
              </Campo>
            </div>

            {/* Detalhes da viagem (Ida) */}
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: '#E6F1FB' }}>
              <p className="text-sm font-semibold" style={{ color: '#0C447C' }}>✈️ Ida</p>

              {/* Seletor de rota — aparece se a empresa tem rotas cadastradas */}
              {rotas.length > 0 && (
                <Campo label="Rota">
                  <select
                    value={rotaSelecionada?.id ?? (rotaManual ? 'manual' : '')}
                    onChange={e => selecionarRota(e.target.value)}
                    className="campo-input"
                  >
                    <option value="">Selecione uma rota...</option>
                    {rotas.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.nome
                          ? `${r.nome} — ${r.origem} → ${r.destino}`
                          : `${r.origem} → ${r.destino}`}
                        {r.preco > 0 ? ` · R$ ${Number(r.preco).toFixed(2).replace('.', ',')}` : ''}
                      </option>
                    ))}
                    <option value="manual">✏️ Outra rota (digitar manualmente)</option>
                  </select>
                </Campo>
              )}

              {/* Valor da rota selecionada */}
              {rotaSelecionada && rotaSelecionada.preco > 0 && (
                <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{ background: '#E1F5EE' }}>
                  <span className="text-sm font-medium" style={{ color: '#085041' }}>Valor da corrida</span>
                  <span className="text-xl font-bold" style={{ color: cor }}>
                    R$ {Number(rotaSelecionada.preco).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Campo label="Data *">
                  <input type="date" value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    min={hoje} className="campo-input" />
                </Campo>
                <Campo label="Horário *">
                  <input type="time" value={form.horario}
                    onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
                    className="campo-input" />
                </Campo>
              </div>

              {/* Origem/Destino: bloqueado se rota selecionada, livre se manual ou sem rotas */}
              <Campo label="Origem *">
                <input value={form.origem}
                  onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
                  readOnly={!!rotaSelecionada && !rotaManual}
                  placeholder="Ex: Aeroporto, Hotel, Endereço..."
                  className="campo-input"
                  style={rotaSelecionada && !rotaManual ? { background: '#f9fafb', color: '#6B7280' } : {}} />
              </Campo>
              <Campo label="Destino *">
                <input value={form.destino}
                  onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
                  readOnly={!!rotaSelecionada && !rotaManual}
                  placeholder="Ex: Hotel, Aeroporto, Endereço..."
                  className="campo-input"
                  style={rotaSelecionada && !rotaManual ? { background: '#f9fafb', color: '#6B7280' } : {}} />
              </Campo>

              <Campo label="Número do voo">
                <input value={form.numero_voo}
                  onChange={e => setForm(f => ({ ...f, numero_voo: e.target.value }))}
                  placeholder="Ex: G3 1234 (opcional)" className="campo-input" />
              </Campo>
            </div>

            {/* Forma de pagamento */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-700">Forma de pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'cartao', label: '💳 Cartão' },
                  { value: 'pix', label: '📱 Pix' },
                  { value: 'faturado', label: '📄 Faturado' },
                ] as const).map(op => (
                  <button key={op.value}
                    onClick={() => setForm(f => ({ ...f, forma_pagamento: op.value }))}
                    className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={form.forma_pagamento === op.value
                      ? { background: cor, color: '#fff', borderColor: cor }
                      : { background: '#fff', color: '#555', borderColor: '#e5e7eb' }}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Observações */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <Campo label="Observações">
                <textarea value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Ex: número de malas, tamanho, pet, necessidades especiais..."
                  className="campo-input" rows={3} style={{ resize: 'none' }} />
              </Campo>
            </div>

            {/* Passageiro adicional */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <button onClick={() => setShowPassageiro2(v => !v)}
                className="flex items-center justify-between w-full">
                <span className="text-sm font-semibold text-gray-700">👥 Passageiro adicional</span>
                <span className="text-sm font-semibold" style={{ color: cor }}>
                  {showPassageiro2 ? '− Remover' : '+ Adicionar'}
                </span>
              </button>
              {showPassageiro2 && (
                <>
                  <Campo label="Nome do 2º passageiro">
                    <input value={form.nome_passageiro2}
                      onChange={e => setForm(f => ({ ...f, nome_passageiro2: e.target.value }))}
                      placeholder="Nome completo" className="campo-input" />
                  </Campo>
                  <Campo label="Telefone do 2º passageiro">
                    <input value={form.telefone_passageiro2}
                      onChange={e => setForm(f => ({ ...f, telefone_passageiro2: e.target.value }))}
                      placeholder="(XX) XXXXX-XXXX" type="tel" className="campo-input" />
                  </Campo>
                </>
              )}
            </div>

            {/* Retorno */}
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: showRetorno ? '#EEEDFE' : '#fff', border: showRetorno ? 'none' : '1px solid #f3f4f6' }}>
              <button onClick={() => setShowRetorno(v => {
                const novo = !v
                if (novo) {
                  setForm(f => ({
                    ...f,
                    retorno_origem: f.retorno_origem || f.destino,
                    retorno_destino: f.retorno_destino || f.origem,
                    retorno_data: f.retorno_data || f.data,
                  }))
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
                  <div className="flex justify-end -mt-2">
                    <button
                      onClick={() => setForm(f => ({ ...f, retorno_origem: f.destino, retorno_destino: f.origem }))}
                      type="button"
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ border: '1px solid #AFA9EC', color: '#3C3489' }}>
                      ↺ Inverter ida
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo label="Data do retorno">
                      <input type="date" value={form.retorno_data}
                        onChange={e => setForm(f => ({ ...f, retorno_data: e.target.value }))}
                        min={form.data || hoje} className="campo-input" />
                    </Campo>
                    <Campo label="Horário do retorno">
                      <input type="time" value={form.retorno_horario}
                        onChange={e => setForm(f => ({ ...f, retorno_horario: e.target.value }))}
                        className="campo-input" />
                    </Campo>
                  </div>
                  <Campo label="Origem do retorno">
                    <input value={form.retorno_origem}
                      onChange={e => setForm(f => ({ ...f, retorno_origem: e.target.value }))}
                      placeholder="Ex: Hotel, Endereço..." className="campo-input" />
                  </Campo>
                  <Campo label="Destino do retorno">
                    <input value={form.retorno_destino}
                      onChange={e => setForm(f => ({ ...f, retorno_destino: e.target.value }))}
                      placeholder="Ex: Aeroporto, Endereço..." className="campo-input" />
                  </Campo>
                </>
              )}
            </div>

            {erroMsg && (
              <div style={{ background: '#FCEBEB', borderColor: '#F5BCBC' }}
                className="border rounded-xl px-4 py-3">
                <p className="text-sm font-semibold" style={{ color: '#A32D2D' }}>⚠️ {erroMsg}</p>
              </div>
            )}

            <button onClick={enviar} disabled={salvando}
              className="w-full py-4 rounded-2xl text-white text-base font-bold disabled:opacity-40"
              style={{ background: cor }}>
              {salvando ? 'Enviando...' : '✓ Solicitar Transfer'}
            </button>

            <p className="text-center text-xs text-gray-400">Solicitação via RotaGenda · v2</p>
          </div>
        )}

        {etapa === 'sucesso' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <p className="text-5xl mb-3">🎉</p>
              <p className="text-lg font-bold text-gray-800 mb-2">Solicitação enviada!</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                A equipe da <span className="font-semibold">{empresa.nome}</span> entrará em contato
                para confirmar seu transfer.
              </p>

              <div className="mt-4 rounded-xl p-4 text-left" style={{ background: '#f0f0ec' }}>
                <p className="text-xs font-semibold text-gray-500 mb-2">Resumo da solicitação</p>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-gray-700">👤 {form.nome}</p>
                  <p className="text-sm text-gray-700">📍 {form.origem} → {form.destino}</p>
                  <p className="text-sm text-gray-700">
                    📅 {form.data.split('-').reverse().join('/')} às {form.horario}
                  </p>
                  {form.numero_voo && (
                    <p className="text-sm text-gray-700">✈️ Voo: {form.numero_voo}</p>
                  )}
                  {showRetorno && form.retorno_data && (
                    <p className="text-sm text-gray-700">
                      🔄 Retorno: {form.retorno_data.split('-').reverse().join('/')} às {form.retorno_horario}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {(() => {
              const tel = (empresa.whatsapp_comercial || empresa.telefone || '').replace(/\D/g, '')
              if (!tel) return null
              const telFmt = tel.startsWith('55') ? tel : `55${tel}`
              const dataFmt = form.data.split('-').reverse().join('/')
              const msg = encodeURIComponent(
                `Olá ${empresa.nome}, acabei de solicitar um transfer pelo site. Meu nome é ${form.nome}, para o dia ${dataFmt} às ${form.horario}, de ${form.origem} para ${form.destino}.`
              )
              return (
                <a href={`https://wa.me/${telFmt}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                  className="w-full py-4 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: '#25D366' }}>
                  💬 Confirmar pelo WhatsApp
                </a>
              )
            })()}

            <button onClick={() => {
              setEtapa('form')
              setErroMsg(null)
              setShowPassageiro2(false)
              setShowRetorno(false)
              setForm(f => ({
                nome: f.nome,
                telefone: f.telefone,
                data: hoje,
                horario: '',
                origem: '',
                destino: '',
                numero_voo: '',
                forma_pagamento: 'pix',
                observacoes: '',
                nome_passageiro2: '',
                telefone_passageiro2: '',
                retorno_data: hoje,
                retorno_horario: '',
                retorno_origem: '',
                retorno_destino: '',
              }))
            }} className="w-full py-3 rounded-2xl text-sm font-medium border border-gray-200 bg-white text-gray-600">
              Nova solicitação
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
