'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ConfiguracoesPage() {
  const router = useRouter()
  const [rota, setRota] = useState<any>(null)
  const [paradas, setParadas] = useState<any[]>([])
  const [precos, setPrecos] = useState<any[]>([])
  const [novaParada, setNovaParada] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: rts } = await supabase.from('rotas').select('*').eq('motorista_id', user.id).limit(1).single()

    if (rts) {
      setRota(rts)
      const { data: pars } = await supabase.from('paradas').select('*').eq('rota_id', rts.id).order('ordem')
      const { data: prs } = await supabase.from('precos').select('*').eq('rota_id', rts.id)
      if (pars) setParadas(pars)
      if (prs) setPrecos(prs)
    } else {
      // Cria rota padrão se não existir
      const { data: novaRota } = await supabase.from('rotas').insert({
        motorista_id: user.id,
        nome: 'Minha Rota',
        horario_ida: '05:00',
        horario_volta: '14:00',
      }).select().single()
      if (novaRota) setRota(novaRota)
    }
    setLoading(false)
  }

  async function salvarRota() {
    if (!rota) return
    setSaving(true)
    await supabase.from('rotas').update({
      nome: rota.nome,
      horario_ida: rota.horario_ida,
      horario_volta: rota.horario_volta,
    }).eq('id', rota.id)

    // Salva paradas
    await supabase.from('paradas').delete().eq('rota_id', rota.id)
    if (paradas.length > 0) {
      await supabase.from('paradas').insert(
        paradas.map((p, i) => ({ rota_id: rota.id, nome: p.nome, ordem: i }))
      )
    }

    // Salva precos
    await supabase.from('precos').delete().eq('rota_id', rota.id)
    const precosValidos = precos.filter(p => p.valor > 0)
    if (precosValidos.length > 0) {
      await supabase.from('precos').insert(
        precosValidos.map(p => ({
          rota_id: rota.id,
          parada_origem: p.parada_origem,
          parada_destino: p.parada_destino,
          valor: parseFloat(p.valor),
        }))
      )
    }

    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  function adicionarParada() {
    if (!novaParada.trim()) return
    const ultima = paradas.length - 1
    const novas = [...paradas]
    // Insere antes da última parada (terminal final)
    if (novas.length >= 2) {
      novas.splice(ultima, 0, { nome: novaParada.trim(), ordem: ultima })
    } else {
      novas.push({ nome: novaParada.trim(), ordem: novas.length })
    }
    setParadas(novas.map((p, i) => ({ ...p, ordem: i })))
    setNovaParada('')
    // Atualiza precos com novas combinações
    gerarPrecos(novas)
  }

  function removerParada(idx: number) {
    if (idx === 0 || idx === paradas.length - 1) return // Não remove terminais
    const novas = paradas.filter((_, i) => i !== idx).map((p, i) => ({ ...p, ordem: i }))
    setParadas(novas)
    gerarPrecos(novas)
  }

  function gerarPrecos(pars: any[]) {
    const novosPrecos: any[] = []
    for (let i = 0; i < pars.length; i++) {
      for (let j = i + 1; j < pars.length; j++) {
        const existe = precos.find(p => p.parada_origem === pars[i].nome && p.parada_destino === pars[j].nome)
        novosPrecos.push({
          parada_origem: pars[i].nome,
          parada_destino: pars[j].nome,
          valor: existe?.valor || 0,
        })
      }
    }
    setPrecos(novosPrecos)
  }

  function atualizarPreco(origem: string, destino: string, valor: string) {
    setPrecos(prev => prev.map(p =>
      p.parada_origem === origem && p.parada_destino === destino ? { ...p, valor } : p
    ))
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
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

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Configurações</p>
        <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">Rota e tabela de preços</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Dados da rota */}
        <Secao titulo="🛣️ Dados da rota">
          <div className="flex flex-col gap-3">
            <Campo label="Nome da rota">
              <input value={rota?.nome || ''} onChange={e => setRota((r: any) => ({ ...r, nome: e.target.value }))}
                placeholder="Ex: Caracaraí → Boa Vista" className="campo-input" />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Saída ida">
                <input type="time" value={rota?.horario_ida || '05:00'}
                  onChange={e => setRota((r: any) => ({ ...r, horario_ida: e.target.value }))}
                  className="campo-input" />
              </Campo>
              <Campo label="Saída volta">
                <input type="time" value={rota?.horario_volta || '14:00'}
                  onChange={e => setRota((r: any) => ({ ...r, horario_volta: e.target.value }))}
                  className="campo-input" />
              </Campo>
            </div>
          </div>
        </Secao>

        {/* Paradas */}
        <Secao titulo="📍 Paradas da rota">
          <p className="text-xs text-gray-400 mb-3">A primeira e a última são os terminais.</p>
          <div className="flex flex-col">
            {paradas.map((p, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: i === 0 || i === paradas.length - 1 ? '#085041' : '#1D9E75' }} />
                  {i < paradas.length - 1 && <div className="w-0.5 h-5 mt-0.5" style={{ background: '#9FE1CB' }} />}
                </div>
                <span className="flex-1 text-sm text-gray-800 font-medium">{p.nome}</span>
                {i !== 0 && i !== paradas.length - 1 && (
                  <button onClick={() => removerParada(i)}
                    className="text-xs px-2 py-1 rounded-lg" style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input value={novaParada} onChange={e => setNovaParada(e.target.value)}
              placeholder="Nova parada..."
              onKeyDown={e => e.key === 'Enter' && adicionarParada()}
              className="campo-input flex-1" />
            <button onClick={adicionarParada}
              className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: '#E1F5EE', color: '#0F6E56' }}>
              + Add
            </button>
          </div>
        </Secao>

        {/* Tabela de preços */}
        <Secao titulo="💰 Tabela de preços por trecho">
          <p className="text-xs text-gray-400 mb-3">O sistema usa esses valores automaticamente.</p>
          {precos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-3">Adicione paradas para gerar a tabela</p>
          ) : (
            <div className="flex flex-col gap-2">
              {precos.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="flex-1 text-xs text-gray-700 truncate">{p.parada_origem} → {p.parada_destino}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-gray-400">R$</span>
                    <input type="number" step="0.01" value={p.valor}
                      onChange={e => atualizarPreco(p.parada_origem, p.parada_destino, e.target.value)}
                      className="w-16 text-right text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-green-600 bg-white"
                      style={{ color: '#0F6E56' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Secao>

        {/* Botão salvar */}
        <button onClick={salvarRota} disabled={saving}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : savedMsg ? '✓ Salvo!' : '💾 Salvar configurações'}
        </button>

        {/* Sair */}
        <button onClick={sair}
          className="w-full py-3 rounded-xl text-sm font-medium mt-2"
          style={{ background: '#FCEBEB', color: '#A32D2D' }}>
          Sair da conta
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
  )
}

function Secao({ titulo, children }: { titulo: string, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <p className="text-sm font-semibold text-gray-700 mb-3">{titulo}</p>
      {children}
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
