'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Secao = {
  titulo: string
  emoji: string
  passos: { titulo: string; descricao: string }[]
}

const secoes: Secao[] = [
  {
    titulo: 'Primeiros passos',
    emoji: '🚀',
    passos: [
      {
        titulo: 'Instale o VanGenda no seu celular',
        descricao: 'Abra o site vangenda.vercel.app no navegador do seu celular. No Android, toque nos 3 pontinhos e selecione "Adicionar à tela inicial". No iPhone, toque no ícone de compartilhar e selecione "Adicionar à Tela de Início". Assim o VanGenda fica como um app no seu celular!',
      },
      {
        titulo: 'Cadastre-se com seu e-mail',
        descricao: 'Na tela inicial, toque em "Criar conta" e preencha seu e-mail e senha. Use o mesmo e-mail que usou na compra do plano — isso garante que seu acesso seja liberado automaticamente.',
      },
      {
        titulo: 'Acesso liberado automaticamente',
        descricao: 'Após o pagamento do plano, seu acesso é liberado automaticamente pelo sistema. Se tiver problemas, entre em contato com o suporte.',
      },
    ],
  },
  {
    titulo: 'Configurando sua rota',
    emoji: '🛣️',
    passos: [
      {
        titulo: 'Acesse as Configurações',
        descricao: 'Toque na aba "Config." no menu inferior. Lá você vai configurar tudo: sua rota, paradas, preços e dados de pagamento.',
      },
      {
        titulo: 'Adicione as paradas na ordem certa',
        descricao: 'Em "Paradas da rota", adicione primeiro o ponto de PARTIDA (onde você sai) e por último o DESTINO final (onde você chega). No meio, adicione todas as paradas intermediárias na ordem que você passa por elas.',
      },
      {
        titulo: 'Reordene arrastando',
        descricao: 'Se errou a ordem das paradas, não precisa apagar! Segure e arraste a parada para cima ou para baixo para colocá-la no lugar certo. As 3 linhas do lado esquerdo indicam que pode arrastar.',
      },
      {
        titulo: 'Configure os preços de cada trecho',
        descricao: 'Depois de adicionar todas as paradas, o sistema gera automaticamente todas as combinações de trechos. Basta digitar o valor de cada trecho. Exemplo: Rorainópolis → Boa Vista = R$ 120,00.',
      },
      {
        titulo: 'Defina a capacidade da van',
        descricao: 'Em "Capacidade da van", coloque quantos passageiros cabem na sua van. Quando atingir o limite, o sistema bloqueia novos agendamentos automaticamente para aquele dia.',
      },
      {
        titulo: 'Salve as configurações',
        descricao: 'Sempre toque em "💾 Salvar configurações" após fazer qualquer alteração. Sem salvar, as mudanças serão perdidas.',
      },
    ],
  },
  {
    titulo: 'Compartilhando seu link',
    emoji: '🔗',
    passos: [
      {
        titulo: 'Copie seu link exclusivo',
        descricao: 'Em Configurações, na seção "Link de agendamento", toque em "📋 Copiar link". Cada motorista tem um link único e exclusivo.',
      },
      {
        titulo: 'Envie para seus passageiros',
        descricao: 'Cole o link no WhatsApp e envie para seus passageiros. Eles vão abrir o link no celular deles e fazer o agendamento sem precisar de cadastro.',
      },
      {
        titulo: 'Instale o app no celular do passageiro',
        descricao: 'Oriente seus passageiros a também adicionar o link à tela inicial do celular deles. Assim sempre que quiserem agendar, já têm o app em mãos e não precisam procurar o link novamente.',
      },
    ],
  },
  {
    titulo: 'Pagamento via Pix',
    emoji: '💰',
    passos: [
      {
        titulo: 'Ative o pagamento obrigatório',
        descricao: 'Em Configurações → Pagamento via Pix, ative a chave "Exigir pagamento ao agendar". Quando ativado, o passageiro só confirma a viagem após pagar o Pix.',
      },
      {
        titulo: 'Configure sua chave Pix',
        descricao: 'Escolha o tipo da sua chave (telefone, CPF, e-mail ou aleatória) e cole o valor da chave. O sistema gera o QR Code automaticamente para o passageiro escanear.',
      },
      {
        titulo: 'O passageiro paga pelo celular dele',
        descricao: 'Quando o passageiro agendar pelo link, ele verá o QR Code Pix e a opção de copiar a chave. Ele paga pelo celular dele e envia o comprovante pelo WhatsApp para você confirmar.',
      },
      {
        titulo: 'Agendamento sem pagamento obrigatório',
        descricao: 'Se preferir cobrar na hora da viagem, deixe a chave desativada. O passageiro agenda normalmente e você cobra o dinheiro pessoalmente.',
      },
      {
        titulo: 'Motorista agendando manualmente',
        descricao: 'Quando você mesmo adiciona um passageiro pela Agenda, o Pix não é cobrado automaticamente — você controla o pagamento manualmente. Use esta opção para passageiros que pegam no meio do caminho ou que pagam em dinheiro.',
      },
    ],
  },
  {
    titulo: 'Gerenciando a Agenda',
    emoji: '📅',
    passos: [
      {
        titulo: 'Veja os passageiros do dia',
        descricao: 'Na aba "Agenda", toque em um dia no calendário para ver todos os passageiros agendados. Os dias com agendamentos têm um ponto verde.',
      },
      {
        titulo: 'Confirme a presença',
        descricao: 'Toque em "✓ Confirmar" no card do passageiro para marcar que ele confirmou a viagem. O status muda de "Agendado" para "Confirmado".',
      },
      {
        titulo: 'Entre em contato pelo WhatsApp',
        descricao: 'Toque em "💬 WhatsApp" para abrir uma conversa direta com o passageiro com uma mensagem já pronta de confirmação. Ou toque em "📞 Ligar" para ligar diretamente.',
      },
      {
        titulo: 'Cancele um agendamento',
        descricao: 'Se o passageiro cancelar, toque em "✕" no card dele. O sistema remove da agenda e libera a vaga para outro passageiro.',
      },
      {
        titulo: 'Adicione passageiros manualmente',
        descricao: 'Toque em "+ Agendar passageiro neste dia" para adicionar alguém que você pegou no meio do caminho ou que não agendou pelo link.',
      },
    ],
  },
  {
    titulo: 'Controle Financeiro',
    emoji: '💵',
    passos: [
      {
        titulo: 'Receitas dos agendamentos',
        descricao: 'Tudo que for pago via Pix pelo link de agendamento entra automaticamente na seção "Receitas via agendamento" do Financeiro.',
      },
      {
        titulo: 'Lance receitas manuais',
        descricao: 'No final do dia, some o dinheiro que recebeu em espécie e toque em "+ Receita". Escolha a categoria (Rota diária, Passagens avulsas, Frete, Tour etc.), coloque o valor e salve.',
      },
      {
        titulo: 'Registre suas despesas',
        descricao: 'Toque em "+ Despesa" para registrar gastos como combustível, manutenção, pedágio, pneu etc. Escolha a categoria, descreva e coloque o valor.',
      },
      {
        titulo: 'Acompanhe seu lucro',
        descricao: 'O sistema calcula automaticamente: Receitas - Despesas = Lucro. Use os filtros Hoje, 7 dias, 30 dias ou Mês para ver o resumo do período que quiser.',
      },
      {
        titulo: 'Veja por categoria',
        descricao: 'O financeiro mostra gráficos com quanto você gastou em cada categoria de despesa e quanto recebeu em cada tipo de receita.',
      },
    ],
  },
]

function GuiaPage({ onFechar }: { onFechar: () => void }) {
 const [secoesAbertas, setSecoesAbertas] = useState<number[]>([0, 1, 2, 3, 4, 5])

  function toggleSecao(i: number) {
    setSecoesAbertas(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Guia de uso</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs">Como usar o VanGenda</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <div style={{ background: '#E1F5EE' }} className="rounded-2xl p-4 flex gap-3 items-start">
          <span className="text-3xl">🚐</span>
          <div>
            <p className="text-sm font-bold" style={{ color: '#085041' }}>Bem-vindo ao VanGenda!</p>
            <p className="text-xs mt-1" style={{ color: '#0F6E56' }}>
              Este guia explica tudo que você precisa saber para usar o app e começar a organizar sua van hoje mesmo. Toque em cada seção para expandir.
            </p>
          </div>
        </div>

        {secoes.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggleSecao(i)}
              className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
              <span className="text-xl">{s.emoji}</span>
              <span className="flex-1 text-sm font-semibold text-gray-800">{s.titulo}</span>
              <span className="text-gray-400 text-sm">{secoesAbertas.includes(i) ? '▲' : '▼'}</span>
            </button>

            {secoesAbertas.includes(i) && (
              <div className="px-4 pb-4 flex flex-col gap-4 border-t border-gray-50">
                {s.passos.map((p, j) => (
                  <div key={j} className="flex gap-3 pt-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                      style={{ background: '#0F6E56', color: '#fff' }}>
                      {j + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 mb-1">{p.titulo}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{p.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ background: '#FAEEDA', borderColor: '#FAC775' }}
          className="border rounded-2xl p-4 flex gap-3 items-start mb-6">
          <span className="text-2xl">💬</span>
          <div>
            <p className="text-sm font-bold" style={{ color: '#854F0B' }}>Precisa de ajuda?</p>
            <p className="text-xs mt-1" style={{ color: '#633806' }}>
              Se tiver dúvidas ou problemas, entre em contato com o suporte pelo WhatsApp. Estamos aqui para ajudar!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  const router = useRouter()
  const [rota, setRota] = useState<any>(null)
  const [paradas, setParadas] = useState<any[]>([])
  const [precos, setPrecos] = useState<any[]>([])
  const [novaParada, setNovaParada] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [loading, setLoading] = useState(true)
  const [motorista, setMotorista] = useState<any>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [mostrarGuia, setMostrarGuia] = useState(false)
  const dragIdx = useRef<number | null>(null)
  const dragOverIdx = useRef<number | null>(null)

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: mot } = await supabase.from('motoristas').select('*').eq('id', user.id).single()
    if (mot) setMotorista(mot)

    const { data: rts } = await supabase.from('rotas').select('*').eq('motorista_id', user.id).limit(1).single()

    if (rts) {
      setRota(rts)
      const { data: pars } = await supabase.from('paradas').select('*').eq('rota_id', rts.id).order('ordem')
      const { data: prs } = await supabase.from('precos').select('*').eq('rota_id', rts.id)
      if (pars) setParadas(pars)
      if (prs) setPrecos(prs)
    } else {
      const { data: { user: u } } = await supabase.auth.getUser()
      const { data: novaRota } = await supabase.from('rotas').insert({
        motorista_id: u!.id,
        nome: 'Minha Rota',
        horario_ida: '05:00',
        horario_volta: '14:00',
        capacidade: 15,
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
      capacidade: rota.capacidade || 15,
    }).eq('id', rota.id)

    await supabase.from('paradas').delete().eq('rota_id', rota.id)
    if (paradas.length > 0) {
      await supabase.from('paradas').insert(
        paradas.map((p, i) => ({ rota_id: rota.id, nome: p.nome, ordem: i }))
      )
    }

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

    if (motorista) {
      await supabase.from('motoristas').update({
        pix_tipo: motorista.pix_tipo,
        pix_chave: motorista.pix_chave,
        pagamento_obrigatorio: motorista.pagamento_obrigatorio,
      }).eq('id', motorista.id)
    }

    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  function adicionarParada() {
    if (!novaParada.trim()) return
    const ultima = paradas.length - 1
    const novas = [...paradas]
    if (novas.length >= 2) {
      novas.splice(ultima, 0, { nome: novaParada.trim(), ordem: ultima })
    } else {
      novas.push({ nome: novaParada.trim(), ordem: novas.length })
    }
    setParadas(novas.map((p, i) => ({ ...p, ordem: i })))
    setNovaParada('')
    gerarPrecos(novas)
  }

  function removerParada(idx: number) {
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

  function copiarLink() {
    const link = `${window.location.origin}/agendar/${motorista?.slug || motorista?.id}`
    navigator.clipboard.writeText(link)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function onDragStart(idx: number) { dragIdx.current = idx }

  function onDragEnter(idx: number) {
    dragOverIdx.current = idx
    if (dragIdx.current === null || dragIdx.current === idx) return
    const novas = [...paradas]
    const item = novas.splice(dragIdx.current, 1)[0]
    novas.splice(idx, 0, item)
    dragIdx.current = idx
    const atualizadas = novas.map((p, i) => ({ ...p, ordem: i }))
    setParadas(atualizadas)
    gerarPrecos(atualizadas)
  }

  function onDragEnd() {
    dragIdx.current = null
    dragOverIdx.current = null
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-4xl animate-pulse">🚐</div>
    </div>
  )

  const linkPublico = typeof window !== 'undefined'
    ? `${window.location.origin}/agendar/${motorista?.slug || motorista?.id}`
    : ''

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Configurações</p>
        <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">Rota, preços e pagamento</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        <Secao titulo="🔗 Link de agendamento para clientes">
          <p className="text-xs text-gray-400 mb-3">Compartilhe este link no WhatsApp para os clientes agendarem.</p>
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2 mb-2">
            <p className="text-xs text-gray-600 flex-1 break-all">{linkPublico}</p>
          </div>
          <button onClick={copiarLink}
            className="w-full py-2.5 rounded-xl text-sm font-medium"
            style={{ background: linkCopiado ? '#E1F5EE' : '#0F6E56', color: linkCopiado ? '#0F6E56' : '#fff' }}>
            {linkCopiado ? '✓ Link copiado!' : '📋 Copiar link'}
          </button>
        </Secao>

        <Secao titulo="💰 Pagamento via Pix">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Exigir pagamento ao agendar</p>
                <p className="text-xs text-gray-400 mt-0.5">Cliente paga o Pix antes de confirmar</p>
              </div>
              <button
                onClick={() => setMotorista((m: any) => ({ ...m, pagamento_obrigatorio: !m?.pagamento_obrigatorio }))}
                className="relative w-12 h-6 rounded-full transition-colors flex-shrink-0"
                style={{ background: motorista?.pagamento_obrigatorio ? '#1D9E75' : '#e5e7eb' }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: motorista?.pagamento_obrigatorio ? '26px' : '2px' }} />
              </button>
            </div>

            {motorista?.pagamento_obrigatorio && (
              <>
                <Campo label="Tipo da chave Pix">
                  <select value={motorista?.pix_tipo || 'telefone'}
                    onChange={e => setMotorista((m: any) => ({ ...m, pix_tipo: e.target.value }))}
                    className="campo-input">
                    <option value="telefone">Telefone</option>
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="aleatoria">Chave aleatória</option>
                  </select>
                </Campo>
                <Campo label="Chave Pix">
                  <input value={motorista?.pix_chave || ''}
                    onChange={e => setMotorista((m: any) => ({ ...m, pix_chave: e.target.value }))}
                    placeholder="Ex: (95) 99999-9999"
                    className="campo-input" />
                </Campo>
                <div style={{ background: '#E1F5EE' }} className="rounded-xl p-3">
                  <p className="text-xs" style={{ color: '#085041' }}>
                    ✓ Quando ativado, o cliente verá um QR Code Pix ao agendar e deverá enviar o comprovante pelo WhatsApp.
                  </p>
                </div>
              </>
            )}
          </div>
        </Secao>

        <Secao titulo="🛣️ Dados da rota">
          <div className="flex flex-col gap-3">
            <Campo label="Nome da rota">
              <input value={rota?.nome || ''} onChange={e => setRota((r: any) => ({ ...r, nome: e.target.value }))}
                placeholder="Ex: Rorainópolis → Boa Vista" className="campo-input" />
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
            <Campo label="🚐 Capacidade da van (passageiros)">
              <input
                type="number"
                value={rota?.capacidade || 15}
                onChange={e => setRota((r: any) => ({ ...r, capacidade: parseInt(e.target.value) || 15 }))}
                min={1} max={50}
                placeholder="Ex: 15"
                className="campo-input" />
            </Campo>
            <div style={{ background: '#E1F5EE' }} className="rounded-xl p-3">
              <p className="text-xs" style={{ color: '#085041' }}>
                ✓ Quando a van atingir o limite, os passageiros não conseguirão mais agendar naquele dia.
              </p>
            </div>
          </div>
        </Secao>

        <Secao titulo="📍 Paradas da rota">
          <p className="text-xs text-gray-400 mb-3">
            Adicione na ordem do trajeto — primeira é a origem, última é o destino.{' '}
            <span style={{ color: '#1D9E75' }}>Segure e arraste para reordenar.</span>
          </p>
          <div className="flex flex-col">
            {paradas.map((p, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragEnter={() => onDragEnter(i)}
                onDragEnd={onDragEnd}
                onDragOver={e => e.preventDefault()}
                className="flex items-center gap-2 mb-2 rounded-xl transition-all cursor-grab active:cursor-grabbing"
                style={{ background: dragIdx.current === i ? '#E1F5EE' : 'transparent', padding: '4px 0' }}>
                <div className="flex flex-col gap-0.5 px-1 flex-shrink-0">
                  <div className="w-4 h-0.5 rounded" style={{ background: '#9FE1CB' }} />
                  <div className="w-4 h-0.5 rounded" style={{ background: '#9FE1CB' }} />
                  <div className="w-4 h-0.5 rounded" style={{ background: '#9FE1CB' }} />
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: i === 0 || i === paradas.length - 1 ? '#085041' : '#1D9E75' }} />
                  {i < paradas.length - 1 && <div className="w-0.5 h-5 mt-0.5" style={{ background: '#9FE1CB' }} />}
                </div>
                <span className="flex-1 text-sm text-gray-800 font-medium select-none">{p.nome}</span>
                <button onClick={() => removerParada(i)}
                  className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                  style={{ background: '#FCEBEB', color: '#A32D2D' }}>✕</button>
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
              style={{ background: '#E1F5EE', color: '#0F6E56' }}>+ Add</button>
          </div>
        </Secao>

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

        <button onClick={salvarRota} disabled={saving}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : savedMsg ? '✓ Salvo!' : '💾 Salvar configurações'}
        </button>

        <button onClick={() => setMostrarGuia(true)}
          className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
          📖 Guia de uso do VanGenda
        </button>

        <button onClick={sair}
          className="w-full py-3 rounded-xl text-sm font-medium mb-8"
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

      {mostrarGuia && <GuiaPage onFechar={() => setMostrarGuia(false)} />}
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
