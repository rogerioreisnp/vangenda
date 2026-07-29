// Pagina publica de disponibilidade — pedido do Julimar. Cliente potencial
// consulta agenda do transfer sem precisar perguntar. Escopo estrito:
// - Sem valor, sem nome de cliente, sem telefone, sem origem/destino.
// - So mostra data + hora + tipo (Transfer/Diaria/City Tour) + fim se diaria.
// - Proximos 30 dias, so status ativos (nao mostra cancelada nem concluida).
// Server component: usa service_role no server pra ler direto, cliente nunca
// ve dados brutos alem do que retornamos.
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Atendimento = {
  data_hora: string
  tipo_servico: string | null
  data_hora_termino: string | null
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function tipoLabel(t: string | null): string {
  if (t === 'diaria') return 'Diária'
  if (t === 'city_tour') return 'City tour'
  return 'Transfer'
}

function tipoIcon(t: string | null): string {
  if (t === 'diaria') return '📅'
  if (t === 'city_tour') return '🗺️'
  return '🚐'
}

export default async function DisponibilidadePage({ params }: { params: { slug: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nome, descricao, whatsapp_comercial, instagram, logo_url, tipo_operacao')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!empresa || empresa.tipo_operacao === 'rota_fixa') {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: '#f0f0ec' }}>
        <div className="text-center">
          <p className="text-4xl mb-3">🔎</p>
          <p className="text-base font-semibold text-gray-700">Empresa não encontrada</p>
          <p className="text-sm text-gray-500 mt-1">Confira o link e tente novamente.</p>
        </div>
      </div>
    )
  }

  const agora = new Date()
  const fim = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { data: raw } = await supabase
    .from('corridas_empresa')
    .select('data_hora, tipo_servico, data_hora_termino')
    .eq('empresa_id', empresa.id)
    .in('status', ['confirmada', 'em_andamento'])
    .gte('data_hora', agora.toISOString())
    .lte('data_hora', fim.toISOString())
    .order('data_hora', { ascending: true })

  const atendimentos = (raw ?? []) as Atendimento[]

  const porDia = new Map<string, Atendimento[]>()
  atendimentos.forEach(a => {
    const dia = a.data_hora.slice(0, 10)
    if (!porDia.has(dia)) porDia.set(dia, [])
    porDia.get(dia)!.push(a)
  })

  const dias = Array.from(porDia.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="min-h-dvh pb-12" style={{ background: '#f0f0ec' }}>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            {empresa.logo_url && (
              // object-contain (nao object-cover) preserva a proporcao real da
              // logo — importante pra wordmarks retangulares (texto largo tipo
              // "AAJP TRANSPORTES"), que ficavam cortados dentro do quadrado
              // fixo anterior. Fundo branco arredondado da acabamento quando a
              // logo tem fundo transparente.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logo_url} alt={empresa.nome}
                className="h-12 max-w-[120px] object-contain rounded-xl flex-shrink-0 bg-white p-1" />
            )}
            <div className="min-w-0">
              <p className="text-lg font-bold" style={{ color: '#fff' }}>{empresa.nome}</p>
              {empresa.descricao && (
                <p className="text-xs mt-0.5 whitespace-pre-line" style={{ color: '#9FE1CB' }}>{empresa.descricao}</p>
              )}
            </div>
          </div>
          <p className="text-sm mt-4 font-semibold" style={{ color: '#E1F5EE' }}>
            📅 Disponibilidade — próximos 30 dias
          </p>
          {/* Agenda informativa, nao mais rotulo de "ocupado/bloqueado" —
              empresas com mais de um veiculo podem atender varios clientes
              no mesmo horario. Pedido do Rogerio 2026-07-29. */}
          <p className="text-xs mt-1" style={{ color: '#9FE1CB' }}>
            Confira os atendimentos já confirmados e fale conosco para agendar o seu.
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 flex flex-col gap-3">
        {dias.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-4xl mb-2">✅</p>
            <p className="text-base font-semibold text-gray-700">Agenda totalmente livre!</p>
            <p className="text-sm text-gray-500 mt-1">Nenhum atendimento nos próximos 30 dias — fale conosco pra reservar.</p>
          </div>
        ) : (
          dias.map(([dia, lista]) => {
            const d = new Date(dia + 'T12:00:00')
            const diaSemana = DIAS_SEMANA[d.getDay()]
            const rotulo = `${diaSemana}, ${d.getDate()} de ${MESES[d.getMonth()]}`
            return (
              <div key={dia} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2" style={{ background: '#E1F5EE' }}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#085041' }}>{rotulo}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {lista.map((a, i) => {
                    const hora = a.data_hora.slice(11, 16)
                    const tipoTxt = tipoLabel(a.tipo_servico)
                    const icon = tipoIcon(a.tipo_servico)
                    // Diaria/city tour: mostra fim se preenchido — cliente sabe
                    // que motorista fica ocupado o dia todo.
                    let extra = ''
                    if ((a.tipo_servico === 'diaria' || a.tipo_servico === 'city_tour') && a.data_hora_termino) {
                      const fimDia = a.data_hora_termino.slice(0, 10) === dia
                        ? a.data_hora_termino.slice(11, 16)
                        : `${a.data_hora_termino.slice(8, 10)}/${a.data_hora_termino.slice(5, 7)} ${a.data_hora_termino.slice(11, 16)}`
                      extra = ` · até ${fimDia}`
                    }
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="text-xl flex-shrink-0">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{hora}{extra}</p>
                          <p className="text-xs text-gray-500">{tipoTxt}</p>
                        </div>
                        {/* "Confirmado" em vez de "Ocupado" — empresa pode ter
                            varios veiculos e atender outros clientes no mesmo
                            horario, entao "ocupado" sugeria bloqueio errado. */}
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: '#E1F5EE', color: '#085041' }}>
                          Confirmado
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}

        {/* Rodape — contato pra fechar */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mt-4 text-center flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-700 mb-1">Quer reservar um horário?</p>
          {empresa.whatsapp_comercial && (
            <Link
              href={`https://wa.me/${(empresa.whatsapp_comercial as string).replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: '#25D366', color: '#fff' }}>
              💬 Chamar no WhatsApp
            </Link>
          )}
          {/* Botao de agendamento direto — pedido do Julimar. Leva o cliente
              pro link publico de agendamento (/transfer/[slug]) pra ele
              reservar sozinho sem precisar chamar no WhatsApp primeiro. */}
          <Link
            href={`/transfer/${params.slug}`}
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#0F6E56', color: '#fff' }}>
            📋 Agendar transfer agora
          </Link>
          {empresa.instagram && (
            <p className="text-xs text-gray-400 mt-2">
              📸 <span style={{ color: '#0F6E56' }}>@{(empresa.instagram as string).replace(/^@/, '')}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
