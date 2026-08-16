'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatarTelefoneWhatsApp } from '@/lib/telefone'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { dataHoraBrasilia } from '@/lib/data-hora'

type PassageiroExtra = {
  nome: string; telefone: string; numero_voo?: string | null
  rua?: string | null; numero?: string | null; bairro?: string | null
  municipio?: string | null; cep?: string | null; referencia?: string | null
  rua_desembarque?: string | null; numero_desembarque?: string | null; bairro_desembarque?: string | null
  municipio_desembarque?: string | null; cep_desembarque?: string | null; referencia_desembarque?: string | null
}

type Corrida = {
  id: string
  origem: string | null
  destino: string | null
  data_hora: string
  data_hora_termino: string | null
  cliente_nome: string | null
  cliente_telefone: string | null
  passageiro1_nome: string | null
  passageiro1_telefone: string | null
  numero_voo: string | null
  observacoes: string | null
  anexo_observacoes_url: string | null
  status: string
  tipo_servico: string | null
  motorista_id: string | null
  km_inicial: number | null
  km_final: number | null
  iniciado_em: string | null
  finalizado_em: string | null
  observacao_motorista: string | null
  anexo_motorista_url: string | null
  veiculo_atribuido: string | null
  // Prova de que a corrida chegou até o motorista. visto = ele abriu a
  // ficha; confirmado = ele tocou no botão assumindo. O gestor não fica
  // mais dependendo de "será que o push chegou?".
  motorista_visto_em: string | null
  motorista_confirmado_em: string | null
  trajetos: string[] | null
  rua: string | null; numero: string | null; bairro: string | null
  municipio: string | null; cep: string | null; referencia: string | null
  rua_desembarque: string | null; numero_desembarque: string | null; bairro_desembarque: string | null
  municipio_desembarque: string | null; cep_desembarque: string | null; referencia_desembarque: string | null
  passageiros_adicionais: PassageiroExtra[] | null
  retorno_data: string | null
  retorno_horario: string | null
  retorno_origem: string | null
  retorno_destino: string | null
  forma_pagamento: string | null
  valor_repasse_motorista: number | null
}

// Só o rótulo em texto puro — a tela do motorista não mostra o valor
// TOTAL cobrado do cliente (informação comercial da empresa), só a forma
// de pagamento (pra saber se precisa cobrar em dinheiro) e o próprio
// repasse dele. Pedido do Alexandre (ASF, Curitiba), 2026-08-14.
const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  a_definir: 'A definir', pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', faturado: 'Faturado',
}

const STATUS_META: Record<string, { bg: string; text: string; label: string }> = {
  pendente:      { bg: '#FEF3C7', text: '#92400E', label: 'Pendente' },
  confirmada:    { bg: '#EFF6FF', text: '#1D4ED8', label: 'Confirmada' },
  em_andamento:  { bg: '#E1F5EE', text: '#0F6E56', label: 'Em andamento' },
  concluida:     { bg: '#F3F4F6', text: '#6B7280', label: 'Concluída' },
  cancelada:     { bg: '#FCEBEB', text: '#A32D2D', label: 'Cancelada' },
}

export default function CorridaFicha({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [c, setC] = useState<Corrida | null>(null)
  const [loading, setLoading] = useState(true)
  const [motEmpresaId, setMotEmpresaId] = useState<string | null>(null)
  const [kmInicial, setKmInicial] = useState('')
  const [kmFinal, setKmFinal] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [novoTrajeto, setNovoTrajeto] = useState('')
  const [salvandoTrajeto, setSalvandoTrajeto] = useState(false)
  // Mensagem de erro visível quando UPDATE falha (RLS, sem permissão etc).
  // Antes falhas silenciosas faziam a UI mentir sucesso e o gestor precisava
  // ajustar tudo manualmente.
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  // Observacao do motorista (separada da observacoes do gestor) + anexo —
  // pedido do Julimar 2026-08-05: motorista quer poder avisar de algo (ex:
  // pagou estacionamento, precisa de reembolso) e anexar a nota.
  const [observacaoMotorista, setObservacaoMotorista] = useState('')
  const [anexoFile, setAnexoFile] = useState<File | null>(null)
  const [salvandoObs, setSalvandoObs] = useState(false)
  const [erroObs, setErroObs] = useState<string | null>(null)
  const [obsSalva, setObsSalva] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => { carregar() }, [params.id])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: motEmp } = await supabase
      .from('motoristas_empresa').select('id').eq('user_id', user.id).maybeSingle()
    if (motEmp) setMotEmpresaId(motEmp.id)

    const { data } = await supabase
      .from('corridas_empresa')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()
    if (data) {
      const corrida = data as Corrida
      setC(corrida)
      setObservacaoMotorista(corrida.observacao_motorista || '')

      // Carimba a primeira abertura da ficha — só na corrida dele e só uma
      // vez. É o "abriu mas não confirmou" que o gestor precisa enxergar.
      // Falha aqui não atrapalha nada: é sinal, não regra de negócio.
      if (motEmp && corrida.motorista_id === motEmp.id && !corrida.motorista_visto_em) {
        const agora = new Date().toISOString()
        supabase.from('corridas_empresa')
          .update({ motorista_visto_em: agora })
          .eq('id', corrida.id)
          .then(({ error }) => {
            if (error) console.error('[visto] falha ao registrar:', error.message)
            else setC(prev => prev ? { ...prev, motorista_visto_em: agora } : prev)
          })
      }
    }
    setLoading(false)
  }

  async function confirmarRecebimento() {
    if (!c) return
    setConfirmando(true)
    setErroAcao(null)
    const agora = new Date().toISOString()
    const { data, error } = await supabase.from('corridas_empresa')
      .update({ motorista_confirmado_em: agora })
      .eq('id', c.id)
      .select('id')
    setConfirmando(false)
    if (error) { setErroAcao(`Erro ao confirmar: ${error.message}`); return }
    if (!data || data.length === 0) {
      setErroAcao('Sem permissão pra confirmar este atendimento.')
      return
    }
    setC({ ...c, motorista_confirmado_em: agora })
  }

  // Tratamento de erro sempre — sem isso, RLS bloqueando (motorista sem
  // policy pra UPDATE em corridas_empresa) fazia a UI fingir sucesso e o
  // banco não atualizava. Motorista via "Concluída" mas gestor via
  // "Confirmada". Julimar reportou esse cenário 2026-07-17.
  async function iniciarCorrida() {
    if (!c) return
    const km = parseFloat(kmInicial.replace(',', '.'))
    if (isNaN(km) || km < 0) return
    setSalvando(true)
    setErroAcao(null)
    const agora = new Date().toISOString()
    const { data, error } = await supabase.from('corridas_empresa')
      .update({ status: 'em_andamento', km_inicial: km, iniciado_em: agora })
      .eq('id', c.id)
      .select('id')
    setSalvando(false)
    if (error) { setErroAcao(`Erro ao iniciar: ${error.message}`); return }
    if (!data || data.length === 0) {
      setErroAcao('Sem permissão pra iniciar este atendimento. Confirme com o gestor que ele está atribuído a você e que a migration RLS foi rodada.')
      return
    }
    setC({ ...c, status: 'em_andamento', km_inicial: km, iniciado_em: agora })
  }

  async function finalizarCorrida() {
    if (!c) return
    const km = parseFloat(kmFinal.replace(',', '.'))
    if (isNaN(km) || km < 0) return
    if (c.km_inicial != null && km < c.km_inicial) return
    setSalvando(true)
    setErroAcao(null)
    const agora = new Date().toISOString()
    const { data, error } = await supabase.from('corridas_empresa')
      .update({ status: 'concluida', km_final: km, finalizado_em: agora })
      .eq('id', c.id)
      .select('id')
    setSalvando(false)
    if (error) { setErroAcao(`Erro ao finalizar: ${error.message}`); return }
    if (!data || data.length === 0) {
      setErroAcao('Sem permissão pra finalizar este atendimento. Confirme com o gestor que ele está atribuído a você.')
      return
    }
    setC({ ...c, status: 'concluida', km_final: km, finalizado_em: agora })
  }

  async function adicionarTrajeto() {
    if (!c || !novoTrajeto.trim()) return
    setSalvandoTrajeto(true)
    setErroAcao(null)
    const atuais = Array.isArray(c.trajetos) ? c.trajetos : []
    const novos = [...atuais, novoTrajeto.trim()]
    const { data, error } = await supabase.from('corridas_empresa')
      .update({ trajetos: novos }).eq('id', c.id).select('id')
    setSalvandoTrajeto(false)
    if (error) { setErroAcao(`Erro ao adicionar trajeto: ${error.message}`); return }
    if (!data || data.length === 0) {
      setErroAcao('Sem permissão pra adicionar trajeto neste atendimento.')
      return
    }
    setC({ ...c, trajetos: novos })
    setNovoTrajeto('')
  }

  async function salvarObservacaoMotorista() {
    if (!c) return
    setSalvandoObs(true)
    setErroObs(null)
    setObsSalva(false)
    let anexoUrl = c.anexo_motorista_url
    if (anexoFile) {
      const ext = anexoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${c.id}/${Date.now()}.${ext}`
      const { error: errUp } = await supabase.storage
        .from('anexos-motorista')
        .upload(path, anexoFile, { contentType: anexoFile.type, upsert: false })
      if (errUp) {
        setSalvandoObs(false)
        setErroObs(`Erro ao enviar o anexo: ${errUp.message}`)
        return
      }
      const { data: pub } = supabase.storage.from('anexos-motorista').getPublicUrl(path)
      anexoUrl = pub.publicUrl
    }
    const { data, error } = await supabase.from('corridas_empresa')
      .update({ observacao_motorista: observacaoMotorista.trim() || null, anexo_motorista_url: anexoUrl })
      .eq('id', c.id)
      .select('id')
    setSalvandoObs(false)
    if (error) { setErroObs(`Erro ao salvar: ${error.message}`); return }
    if (!data || data.length === 0) {
      setErroObs('Sem permissão pra salvar neste atendimento.')
      return
    }
    setC({ ...c, observacao_motorista: observacaoMotorista.trim() || null, anexo_motorista_url: anexoUrl })
    setAnexoFile(null)
    setObsSalva(true)
    setTimeout(() => setObsSalva(false), 3000)
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-xs text-gray-400">Carregando ficha...</p>
      </div>
    )
  }

  if (!c) {
    return (
      <div className="min-h-dvh px-4 py-8 flex flex-col items-center gap-3">
        <p className="text-3xl">😕</p>
        <p className="text-sm font-bold text-gray-800">Atendimento não encontrado</p>
        <Link href="/motorista/agenda" className="text-xs font-semibold" style={{ color: '#0F6E56' }}>
          Voltar para agenda
        </Link>
      </div>
    )
  }

  // Verifica se essa corrida está atribuída a este motorista.
  // Segurança: RLS já impede acesso a corridas de outra empresa, mas dentro
  // da mesma empresa o motorista pode ver corridas atribuídas a outros.
  // Aqui só bloqueia o botão de ação (nada de finalizar corrida de colega).
  const eDele = motEmpresaId != null && c.motorista_id === motEmpresaId

  const st = STATUS_META[c.status] ?? { bg: '#F3F4F6', text: '#6B7280', label: c.status }
  const ehDispose = c.tipo_servico === 'diaria' || c.tipo_servico === 'city_tour'
  // Passageiro 1 (quem viaja) e o Solicitante (quem contratou/pediu) sao
  // pessoas diferentes quando o form tem os dois preenchidos. So cai no
  // cliente_nome/cliente_telefone (dados do solicitante) quando NAO existe
  // passageiro1_nome — reservas antigas, ou caso em que o solicitante e o
  // proprio passageiro. Antes o telefone caia no fallback sozinho: nome do
  // passageiro (Isabela) aparecia com o telefone do solicitante embaixo,
  // como se fosse dela — reportado pelo Julimar, 2026-08-05.
  // ATUALIZACAO 2026-08-12: sem passageiro informado, o motorista nao ve NEM o
  // nome NEM o telefone do solicitante. O solicitante costuma ser o cliente
  // comercial da empresa (agencia de turismo, hotel) — dar esse contato pro
  // motorista permitiria ele fechar direto e passar por cima de quem repassou
  // a corrida. Palavras do Rogerio: "tem coisa que e sigilosa". Quando falta o
  // passageiro, o motorista fala com a empresa, nao com o cliente dela.
  const semPassageiroProprio = !c.passageiro1_nome
  const passageiro1 = c.passageiro1_nome || 'Passageiro a confirmar'
  const tel1 = semPassageiroProprio ? null : c.passageiro1_telefone

  return (
    <div className="pb-6">
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => router.back()} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <div className="flex-1">
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Ficha do atendimento</p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
          style={{ background: st.bg, color: st.text }}>
          {st.label}
        </span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {/* Confirmação de recebimento — fica no topo porque é a primeira
            coisa que o gestor espera. Enquanto não confirmar, ele vê
            "aguardando" do lado dele e sabe que precisa ligar. Só aparece
            em corrida ativa: confirmar depois de concluída não serve. */}
        {eDele && c.status !== 'cancelada' && c.status !== 'concluida' && (
          c.motorista_confirmado_em ? (
            <div className="rounded-2xl px-4 py-3 border" style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
              <p className="text-xs font-semibold" style={{ color: '#085041' }}>
                ✓ Você confirmou este atendimento às {format(new Date(c.motorista_confirmado_em), 'HH:mm')}h
              </p>
            </div>
          ) : (
            <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p className="text-xs" style={{ color: '#92400E' }}>
                Avise que você recebeu este atendimento — assim o gestor não precisa
                ligar pra saber se chegou.
              </p>
              <button onClick={confirmarRecebimento} disabled={confirmando}
                className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ background: '#0F6E56', color: '#fff' }}>
                {confirmando ? 'Confirmando…' : '✓ Confirmar que recebi'}
              </button>
            </div>
          )
        )}

        {/* Rota */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          {ehDispose ? (
            <p className="text-base font-bold text-gray-800">
              📍 {c.origem}{c.destino ? ` → ${c.destino}` : ''}
            </p>
          ) : (
            <p className="text-base font-bold text-gray-800">
              {c.origem || '—'} → {c.destino || '—'}
            </p>
          )}
          <p className="text-sm text-gray-600 mt-1">
            {ehDispose ? '▶️ Início: ' : '📅 '}
            {format(dataHoraBrasilia(c.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          {c.data_hora_termino && (
            <p className="text-sm text-gray-600">
              ⏹️ Término previsto: {format(dataHoraBrasilia(c.data_hora_termino), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
          {c.numero_voo && (
            <p className="text-sm text-gray-600 mt-1">✈️ Voo: {c.numero_voo}</p>
          )}
          {c.veiculo_atribuido && (
            <p className="text-sm text-gray-600 mt-1">🚐 Veículo: <strong>{c.veiculo_atribuido}</strong></p>
          )}
          {c.forma_pagamento && (
            <p className="text-sm text-gray-600 mt-1">
              💳 Pagamento: <strong>{FORMA_PAGAMENTO_LABEL[c.forma_pagamento] ?? c.forma_pagamento}</strong>
            </p>
          )}
          {c.valor_repasse_motorista != null && (
            <p className="text-sm text-gray-600 mt-1">
              💰 Seu repasse: <strong>R$ {c.valor_repasse_motorista.toFixed(2).replace('.', ',')}</strong>
            </p>
          )}
          {c.retorno_data && (
            <div className="mt-2 rounded-xl px-3 py-2" style={{ background: '#EEEDFE' }}>
              <p className="text-xs font-semibold" style={{ color: '#3C3489' }}>🔁 Volta</p>
              <p className="text-sm text-gray-700">
                {c.retorno_data.slice(8, 10)}/{c.retorno_data.slice(5, 7)}/{c.retorno_data.slice(0, 4)}
                {c.retorno_horario ? ` às ${c.retorno_horario.slice(0, 5)}` : ''}
              </p>
              {c.retorno_origem && c.retorno_destino && (
                <p className="text-xs text-gray-500 mt-1">{c.retorno_origem} → {c.retorno_destino}</p>
              )}
            </div>
          )}
        </div>

        {/* Endereço de embarque estruturado */}
        <BlocoEndereco titulo="📍 Endereço de embarque"
          rua={c.rua} numero={c.numero} bairro={c.bairro}
          municipio={c.municipio} cep={c.cep} referencia={c.referencia}
          fallback={c.origem} />

        {/* Endereço de desembarque estruturado */}
        <BlocoEndereco titulo="🏁 Endereço de desembarque"
          rua={c.rua_desembarque} numero={c.numero_desembarque} bairro={c.bairro_desembarque}
          municipio={c.municipio_desembarque} cep={c.cep_desembarque} referencia={c.referencia_desembarque}
          fallback={c.destino} />

        {/* Trajetos (diária / city tour) */}
        {ehDispose && (() => {
          const trajetos = Array.isArray(c.trajetos) ? c.trajetos : []
          return (
            <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-xs font-semibold" style={{ color: '#166534' }}>
                🗺️ Trajetos{trajetos.length > 0 ? ` (${trajetos.length})` : ''}
              </p>
              {trajetos.length === 0 && (
                <p className="text-xs text-gray-500 italic">Adicione conforme os locais forem sendo visitados.</p>
              )}
              {trajetos.length > 0 && (
                <ol className="text-sm text-gray-700 flex flex-col gap-1" style={{ paddingLeft: '18px', listStyleType: 'decimal' }}>
                  {trajetos.map((t, i) => <li key={i}>{t}</li>)}
                </ol>
              )}
              {eDele && c.status === 'em_andamento' && (
                <div className="flex gap-2 mt-1">
                  <input value={novoTrajeto}
                    onChange={e => setNovoTrajeto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && novoTrajeto.trim()) { e.preventDefault(); adicionarTrajeto() } }}
                    placeholder="Ex: Restaurante Fasano, Shopping..."
                    className="campo-input flex-1"
                    style={{ fontSize: '13px' }} />
                  <button type="button"
                    onClick={adicionarTrajeto}
                    disabled={salvandoTrajeto || !novoTrajeto.trim()}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                    style={{ background: '#166534' }}>
                    {salvandoTrajeto ? 'Salvando…' : '+ Adicionar'}
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* Passageiro 1 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🧍 Passageiro 1</p>
          {semPassageiroProprio ? (
            <div className="rounded-xl px-3 py-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <p className="text-sm font-semibold" style={{ color: '#92400E' }}>⏳ Passageiro a confirmar</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#B45309' }}>
                O nome ainda não foi informado. Confirme com a empresa antes de sair.
              </p>
            </div>
          ) : (
            <p className="text-sm font-semibold text-gray-800">{passageiro1}</p>
          )}
          {tel1 && (
            <a href={`tel:${tel1}`} className="text-sm" style={{ color: '#0F6E56' }}>
              📞 {tel1}
            </a>
          )}
          {tel1 && (
            <a href={waLink(tel1, passageiro1, c)}
              target="_blank" rel="noopener noreferrer"
              className="mt-1 py-2 rounded-xl text-white text-xs font-semibold text-center"
              style={{ background: '#25D366' }}>
              💬 Chamar no WhatsApp
            </a>
          )}
        </div>

        {/* Passageiros adicionais */}
        {c.passageiros_adicionais && c.passageiros_adicionais.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">👥 Mais passageiros</p>
            {c.passageiros_adicionais.map((p, i) => (
              <div key={i} className="rounded-xl border border-gray-100 p-3" style={{ background: '#f9f9f7' }}>
                <p className="text-sm font-semibold text-gray-800">Passageiro {i + 2}: {p.nome || 'Sem nome'}</p>
                {p.telefone && (
                  <a href={`tel:${p.telefone}`} className="text-sm block mt-1" style={{ color: '#0F6E56' }}>
                    📞 {p.telefone}
                  </a>
                )}
                {p.numero_voo && <p className="text-xs text-gray-500 mt-1">✈️ Voo: {p.numero_voo}</p>}
                {(p.rua || p.bairro) && (
                  <p className="text-xs text-gray-600 mt-1">
                    📍 {formatEnd({ rua: p.rua, numero: p.numero, bairro: p.bairro, municipio: p.municipio, referencia: p.referencia })}
                  </p>
                )}
                {(p.rua_desembarque || p.bairro_desembarque) && (
                  <p className="text-xs text-gray-600">
                    🏁 {formatEnd({ rua: p.rua_desembarque, numero: p.numero_desembarque, bairro: p.bairro_desembarque, municipio: p.municipio_desembarque, referencia: p.referencia_desembarque })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {(c.observacoes || c.anexo_observacoes_url) && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">📝 Observações</p>
            {c.observacoes && <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.observacoes}</p>}
            {c.anexo_observacoes_url && (
              <a href={c.anexo_observacoes_url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold mt-1 inline-block" style={{ color: '#0F6E56' }}>
                📎 Ver anexo
              </a>
            )}
          </div>
        )}

        {/* Observacao do motorista + anexo — separado da observacoes do
            gestor acima. Uso tipico: "paguei estacionamento, preciso de
            reembolso" + foto da notinha (pedido Julimar 2026-08-05). Só
            quem está atribuído pode editar; outros veem em modo leitura. */}
        {eDele ? (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🧾 Sua observação pro gestor</p>
            <p className="text-xs text-gray-400 -mt-1">
              Ex: "Paguei R$ 15 de estacionamento, preciso de reembolso" — anexe a nota se tiver.
            </p>
            <textarea value={observacaoMotorista} onChange={e => setObservacaoMotorista(e.target.value)}
              placeholder="Escreva aqui sua observação..."
              className="campo-input" rows={3} style={{ resize: 'vertical' }} />
            {c.anexo_motorista_url && !anexoFile && (
              <a href={c.anexo_motorista_url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold" style={{ color: '#0F6E56' }}>
                📎 Ver anexo enviado
              </a>
            )}
            <label className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer"
              style={{ background: '#f9fafb', color: '#374151', borderColor: '#e5e7eb' }}>
              📎 {anexoFile ? anexoFile.name : c.anexo_motorista_url ? 'Trocar anexo (foto ou PDF)' : 'Anexar foto ou PDF'}
              <input type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => setAnexoFile(e.target.files?.[0] || null)} />
            </label>
            {erroObs && <p className="text-xs" style={{ color: '#DC2626' }}>⚠️ {erroObs}</p>}
            {obsSalva && <p className="text-xs font-semibold" style={{ color: '#0F6E56' }}>✓ Salvo!</p>}
            <button onClick={salvarObservacaoMotorista} disabled={salvandoObs}
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: '#0F6E56', color: '#fff' }}>
              {salvandoObs ? 'Salvando…' : '✓ Salvar observação'}
            </button>
          </div>
        ) : (c.observacao_motorista || c.anexo_motorista_url) && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🧾 Observação do motorista</p>
            {c.observacao_motorista && <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.observacao_motorista}</p>}
            {c.anexo_motorista_url && (
              <a href={c.anexo_motorista_url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold mt-1 inline-block" style={{ color: '#0F6E56' }}>
                📎 Ver anexo
              </a>
            )}
          </div>
        )}

        {/* KM inicial/final — bloco expostivo. Horario junto do KM e o
            horario REAL de quando o motorista apertou Iniciar/Finalizar
            (iniciado_em/finalizado_em), diferente do horario agendado do
            atendimento — reportado pelo Julimar, 2026-08-05: KM final
            aparecia sem nenhum horario junto. */}
        {(c.km_inicial != null || c.km_final != null) && (
          <div className="rounded-2xl p-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#1D4ED8' }}>🛞 Quilometragem</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Inicial: <strong>{c.km_inicial != null ? String(c.km_inicial).replace('.', ',') : '—'}</strong>
                {c.iniciado_em && <span className="text-xs text-gray-400"> ({format(new Date(c.iniciado_em), 'HH:mm')}h)</span>}
              </span>
              <span className="text-gray-600">
                Final: <strong>{c.km_final != null ? String(c.km_final).replace('.', ',') : '—'}</strong>
                {c.finalizado_em && <span className="text-xs text-gray-400"> ({format(new Date(c.finalizado_em), 'HH:mm')}h)</span>}
              </span>
            </div>
            {c.km_inicial != null && c.km_final != null && c.km_final >= c.km_inicial && (
              <p className="text-sm font-bold mt-1" style={{ color: '#1D4ED8' }}>
                Total: {(c.km_final - c.km_inicial).toFixed(1).replace('.', ',')} km
              </p>
            )}
          </div>
        )}

        {/* Botões de ação — só pra motorista atribuído */}
        {eDele && c.status === 'confirmada' && (() => {
          const kmI = parseFloat(kmInicial.replace(',', '.'))
          const kmValido = !isNaN(kmI) && kmI >= 0
          return (
            <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>🛞 KM inicial <span className="font-normal text-gray-500">— obrigatório para iniciar</span></p>
              <input type="number" step="0.1" min={0}
                value={kmInicial}
                onChange={e => setKmInicial(e.target.value)}
                placeholder="Ex: 45230.5"
                className="campo-input" />
              <button
                onClick={iniciarCorrida}
                disabled={salvando || !kmValido}
                className="w-full py-3.5 rounded-xl text-sm font-bold border disabled:opacity-40"
                style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                {salvando ? 'Salvando…' : !kmValido ? 'Informe o KM inicial' : '▶️ Iniciar atendimento'}
              </button>
            </div>
          )
        })()}

        {/* Erro visível — se o UPDATE falhou por RLS/permissão/rede, o
            motorista precisa saber. Antes falhava silenciosamente e a UI
            fingia sucesso. */}
        {erroAcao && (
          <div className="rounded-2xl px-4 py-3 border" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
            <p className="text-xs" style={{ color: '#B91C1C' }}>⚠️ {erroAcao}</p>
          </div>
        )}

        {eDele && c.status === 'em_andamento' && (() => {
          const kmF = parseFloat(kmFinal.replace(',', '.'))
          const kmValido = !isNaN(kmF) && kmF >= 0
          const kmMenor = kmValido && c.km_inicial != null && kmF < c.km_inicial
          return (
            <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              {c.km_inicial != null && (
                <p className="text-xs text-gray-500">KM inicial: <strong>{String(c.km_inicial).replace('.', ',')}</strong></p>
              )}
              <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>🛞 KM final <span className="font-normal text-gray-500">— obrigatório para finalizar</span></p>
              <input type="number" step="0.1" min={0}
                value={kmFinal}
                onChange={e => setKmFinal(e.target.value)}
                placeholder="Ex: 45312.8"
                className="campo-input" />
              {kmMenor && (
                <p className="text-xs" style={{ color: '#DC2626' }}>⚠️ KM final não pode ser menor que o inicial.</p>
              )}
              {kmValido && !kmMenor && c.km_inicial != null && (
                <p className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>
                  Total: {(kmF - c.km_inicial).toFixed(1).replace('.', ',')} km
                </p>
              )}
              <button
                onClick={finalizarCorrida}
                disabled={salvando || !kmValido || kmMenor}
                className="w-full py-3.5 rounded-xl text-sm font-bold border disabled:opacity-40"
                style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
                {salvando ? 'Salvando…' : !kmValido ? 'Informe o KM final' : kmMenor ? 'KM inválido' : '⏹️ Finalizar atendimento'}
              </button>
            </div>
          )
        })()}

        {/* Ação — pendente/concluida/cancelada mostra info */}
        {c.status === 'pendente' && (
          <div className="rounded-xl px-4 py-3 border" style={{ background: '#FEF3C7', borderColor: '#FDE68A' }}>
            <p className="text-xs" style={{ color: '#92400E' }}>
              ⏳ Este atendimento ainda está pendente de confirmação do gestor. Aguarde a confirmação para iniciar.
            </p>
          </div>
        )}

        {c.status === 'concluida' && (
          <div className="rounded-xl px-4 py-3 border" style={{ background: '#F3F4F6', borderColor: '#E5E7EB' }}>
            <p className="text-xs text-gray-500">✅ Atendimento concluído.</p>
          </div>
        )}

        {!eDele && (
          <div className="rounded-xl px-4 py-3 border" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
            <p className="text-xs" style={{ color: '#9A3412' }}>
              ℹ️ Este atendimento não está atribuído a você. Você pode ver os dados, mas só o motorista atribuído pode iniciar/finalizar.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .campo-input {
          width: 100%; padding: 10px 12px; border-radius: 12px;
          border: 1px solid #e5e7eb; font-size: 16px; color: #222;
          background: #fff; outline: none;
        }
        .campo-input:focus { border-color: #0F6E56; }
      `}</style>
    </div>
  )
}

function BlocoEndereco({ titulo, rua, numero, bairro, municipio, cep, referencia, fallback }: {
  titulo: string
  rua: string | null; numero: string | null; bairro: string | null
  municipio: string | null; cep: string | null; referencia: string | null
  fallback: string | null
}) {
  const linhas: string[] = []
  const ruaNum = [rua, numero].filter(Boolean).join(', ')
  if (ruaNum) linhas.push(ruaNum)
  const bairroMun = [bairro, municipio].filter(Boolean).join(' — ')
  if (bairroMun) linhas.push(bairroMun)
  if (cep) linhas.push(`CEP: ${cep}`)
  if (referencia) linhas.push(`Ref: ${referencia}`)

  const enderecoStr = linhas.length > 0 ? linhas.join('\n') : (fallback || 'Não informado')
  const enderecoParaMaps = linhas.length > 0
    ? linhas.filter(l => !l.startsWith('CEP:') && !l.startsWith('Ref:')).join(', ')
    : fallback

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{enderecoStr}</p>
      {enderecoParaMaps && (
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoParaMaps)}`}
          target="_blank" rel="noopener noreferrer"
          className="mt-3 py-2 rounded-xl text-white text-xs font-semibold text-center flex items-center justify-center gap-2"
          style={{ background: '#4285F4' }}>
          🗺️ Abrir no Google Maps
        </a>
      )}
    </div>
  )
}

function formatEnd(e: { rua?: string | null; numero?: string | null; bairro?: string | null; municipio?: string | null; referencia?: string | null }): string {
  const ruaNum = [e.rua, e.numero].filter(Boolean).join(', ')
  const bairroMun = [e.bairro, e.municipio].filter(Boolean).join(' — ')
  const partes = [ruaNum, bairroMun].filter(Boolean).join(' · ')
  return e.referencia ? `${partes} (${e.referencia})` : partes
}

function waLink(tel: string, nome: string, c: Corrida): string {
  const t = formatarTelefoneWhatsApp(tel)
  const dataFmt = c.data_hora.slice(8, 10) + '/' + c.data_hora.slice(5, 7)
  const horaFmt = c.data_hora.slice(11, 16)
  const msg = encodeURIComponent(
    `Olá ${nome.split(' ')[0]}, sou o motorista do seu atendimento de ${dataFmt} às ${horaFmt}. Estou a caminho!`
  )
  return `https://wa.me/${t}?text=${msg}`
}
