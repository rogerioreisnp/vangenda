'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import ModalNovaEncomenda from '@/components/ModalNovaEncomenda'

type Agendamento = {
  id: string
  nome_passageiro: string
  parada_origem: string
  parada_destino: string
  turno: 'ida' | 'volta'
  valor: number
  status: 'agendado' | 'confirmado' | 'cancelado'
  data_viagem: string
}

export default function DashboardPage() {
  const hoje = new Date()
  const amanha = new Date(); amanha.setDate(hoje.getDate() + 1)
  const [motorista, setMotorista] = useState<{ nome: string } | null>(null)
  const [agendamentosHoje, setAgendamentosHoje] = useState<Agendamento[]>([])
  const [agendamentosAmanha, setAgendamentosAmanha] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEncomenda, setModalEncomenda] = useState(false)

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: mot } = await supabase.from('motoristas').select('nome').eq('id', user.id).single()
    setMotorista(mot)

    const hojeStr = format(hoje, 'yyyy-MM-dd')
    const amanhaStr = format(amanha, 'yyyy-MM-dd')

    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('motorista_id', user.id)
      .in('data_viagem', [hojeStr, amanhaStr])
      .neq('status', 'cancelado')
      .order('turno')

    if (ags) {
      setAgendamentosHoje(ags.filter(a => a.data_viagem === hojeStr))
      setAgendamentosAmanha(ags.filter(a => a.data_viagem === amanhaStr))
    }

    setLoading(false)
  }

  async function confirmarPassageiro(id: string) {
    await supabase.from('agendamentos').update({ status: 'confirmado' }).eq('id', id)
    carregarDados()
  }

  const receitaHoje = agendamentosHoje.reduce((s, a) => s + a.valor, 0)
  const ida = agendamentosHoje.filter(a => a.turno === 'ida')
  const volta = agendamentosHoje.filter(a => a.turno === 'volta')

  const diaSemana = format(hoje, "EEE, dd 'de' MMM", { locale: ptBR })

  return (
    <div>
      {/* Header verde */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p style={{ color: '#9FE1CB' }} className="text-xs">Bom dia,</p>
            <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">
              {motorista?.nome || '...'}
            </p>
          </div>
          <span style={{ background: '#085041', color: '#5DCAA5' }}
            className="text-xs px-3 py-1.5 rounded-lg capitalize">{diaSemana}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div style={{ background: '#085041' }} className="rounded-xl p-3">
            <p style={{ color: '#5DCAA5' }} className="text-[10px]">Passageiros hoje</p>
            <p style={{ color: '#E1F5EE' }} className="text-xl font-semibold mt-0.5">
              {agendamentosHoje.length}
            </p>
          </div>
          <div style={{ background: '#085041' }} className="rounded-xl p-3">
            <p style={{ color: '#5DCAA5' }} className="text-[10px]">Receita do dia</p>
            <p style={{ color: '#E1F5EE' }} className="text-xl font-semibold mt-0.5">
              R$ {receitaHoje.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Alerta amanhã */}
        {agendamentosAmanha.length > 0 && (
          <div style={{ background: '#FAEEDA', borderColor: '#FAC775' }}
            className="border rounded-xl p-3 flex gap-3 mb-4">
            <span className="text-lg flex-shrink-0">🔔</span>
            <p style={{ color: '#633806' }} className="text-xs leading-relaxed">
              <strong>Amanhã</strong> você tem {agendamentosAmanha.length} passageiro{agendamentosAmanha.length > 1 ? 's' : ''} agendado{agendamentosAmanha.length > 1 ? 's' : ''}.
              Ligue para confirmar!
            </p>
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">Carregando...</p>
        ) : agendamentosHoje.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400 text-sm">Nenhum passageiro hoje</p>
          </div>
        ) : (
          <>
            {ida.length > 0 && (
              <TurnoBloco turno="ida" horario="05:00h" passageiros={ida} onConfirmar={confirmarPassageiro} />
            )}
            {volta.length > 0 && (
              <TurnoBloco turno="volta" horario="14:00h" passageiros={volta} onConfirmar={confirmarPassageiro} />
            )}

            {/* Total */}
            <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center mt-2">
              <span className="text-sm text-gray-500">Total do dia</span>
              <span className="text-lg font-bold" style={{ color: '#0F6E56' }}>
                R$ {receitaHoje.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </>
        )}

        {/* Botões de ação */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Link href="/dashboard/agenda"
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#1D9E75' }}>
            + Agendar passageiro
          </Link>
          <button
            onClick={() => setModalEncomenda(true)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#FAEEDA', color: '#854F0B' }}>
            📦 Agendar encomenda
          </button>
        </div>
      </div>

      {modalEncomenda && (
        <ModalNovaEncomenda
          onFechar={() => setModalEncomenda(false)}
          onSalvo={() => setModalEncomenda(false)}
        />
      )}
    </div>
  )
}

function TurnoBloco({ turno, horario, passageiros, onConfirmar }: {
  turno: 'ida' | 'volta', horario: string, passageiros: Agendamento[], onConfirmar: (id: string) => void
}) {
  const subTotal = passageiros.reduce((s, a) => s + a.valor, 0)
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {turno === 'ida' ? 'Ida' : 'Volta'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
            style={turno === 'ida'
              ? { background: '#E1F5EE', color: '#0F6E56' }
              : { background: '#FAEEDA', color: '#854F0B' }}>
            {horario}
          </span>
        </div>
        <span className="text-xs text-gray-400">{passageiros.length} · R$ {subTotal.toFixed(0)}</span>
      </div>

      {passageiros.map(p => (
        <PassageiroCard key={p.id} p={p} onConfirmar={onConfirmar} />
      ))}
    </div>
  )
}

function PassageiroCard({ p, onConfirmar }: { p: Agendamento, onConfirmar: (id: string) => void }) {
  const iniciais = p.nome_passageiro.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const cores = ['#E1F5EE|#0F6E56', '#FAEEDA|#854F0B', '#E6F1FB|#185FA5', '#EEEDFE|#534AB7']
  const cor = cores[p.nome_passageiro.charCodeAt(0) % cores.length].split('|')

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 mb-2 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: cor[0], color: cor[1] }}>{iniciais}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{p.nome_passageiro}</p>
        <p className="text-xs text-gray-400 mt-0.5">{p.parada_origem} → {p.parada_destino}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color: '#1D9E75' }}>R$ {p.valor.toFixed(0)}</p>
        {p.status === 'agendado' ? (
          <button onClick={() => onConfirmar(p.id)}
            className="text-[10px] mt-0.5 px-2 py-0.5 rounded-md font-medium"
            style={{ background: '#FAEEDA', color: '#854F0B' }}>
            Confirmar
          </button>
        ) : (
          <span className="text-[10px] mt-0.5 px-2 py-0.5 rounded-md font-medium"
            style={{ background: '#E1F5EE', color: '#0F6E56' }}>Confirmado</span>
        )}
      </div>
    </div>
  )
}
