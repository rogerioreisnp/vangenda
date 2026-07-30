'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'

function GuiaPage({ onFechar }: { onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Guia de uso</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs">Como usar o RotaGenda</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">

        <div className="text-center mb-8">
          <svg width="80" height="80" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="mb-3 mx-auto">
            <rect width="192" height="192" rx="42" fill="#04342C"/>
            <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
            <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
            <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
            <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
          </svg>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#0F6E56' }}>Bem-vindo ao RotaGenda!</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Este guia explica tudo que você precisa saber para organizar sua van com o app.
          </p>
        </div>

        <div className="h-px mb-6" style={{ background: '#e5e7eb' }} />

        {/* SEÇÃO 1 */}
        <h2 className="text-base font-bold mb-4" style={{ color: '#0F6E56' }}>🚀 Primeiros passos</h2>

        <p className="text-sm font-semibold text-gray-800 mb-1">1. Instale o RotaGenda no seu celular</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Abra o site <strong>vangenda.vercel.app</strong> no navegador do seu celular. No Android, toque nos 3 pontinhos e selecione "Adicionar à tela inicial". No iPhone, toque no ícone de compartilhar e selecione "Adicionar à Tela de Início". Assim o RotaGenda fica como um app no seu celular!
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">2. Cadastre-se com seu e-mail</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Na tela inicial, toque em "Criar conta" e preencha seu e-mail e senha. Use o mesmo e-mail que usou na compra do plano — isso garante que seu acesso seja liberado automaticamente.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">3. Acesso liberado automaticamente</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Após o pagamento do plano, seu acesso é liberado automaticamente pelo sistema. Se tiver problemas, entre em contato com o suporte.
        </p>

        <div className="h-px mb-6" style={{ background: '#e5e7eb' }} />

        {/* SEÇÃO 2 */}
        <h2 className="text-base font-bold mb-4" style={{ color: '#0F6E56' }}>🏠 Tela Início</h2>

        <p className="text-sm font-semibold text-gray-800 mb-1">1. Resumo do dia</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          A tela Início mostra um resumo rápido do seu dia: quantos passageiros você tem hoje e o total de receita do dia. É a primeira coisa que você vê ao abrir o app.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">2. Aviso de amanhã</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Um aviso amarelo aparece automaticamente informando quantos passageiros você tem agendados para o dia seguinte. Assim você já sabe com antecedência e pode confirmar com eles.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">3. Lista de passageiros de hoje</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Abaixo do resumo aparece a lista completa dos passageiros do dia com nome, rota e valor. Você pode confirmar a presença de cada passageiro diretamente desta tela sem precisar ir para a Agenda.
        </p>

        <div className="h-px mb-6" style={{ background: '#e5e7eb' }} />

        {/* SEÇÃO 3 */}
        <h2 className="text-base font-bold mb-4" style={{ color: '#0F6E56' }}>🛣️ Configurando sua rota</h2>

        <p className="text-sm font-semibold text-gray-800 mb-1">1. Acesse as Configurações</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Toque na aba "Config." no menu inferior. Lá você vai configurar tudo: sua rota, paradas, preços e dados de pagamento.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">2. Adicione as paradas na ordem certa</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Em "Paradas da rota", adicione primeiro o ponto de <strong>PARTIDA</strong> (onde você sai) e por último o <strong>DESTINO</strong> final (onde você chega). No meio, adicione todas as paradas intermediárias na ordem que você passa por elas.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">3. Reordene arrastando</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Se errou a ordem das paradas, não precisa apagar! Segure e arraste a parada para cima ou para baixo. As 3 linhas do lado esquerdo de cada parada indicam que pode arrastar.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">4. Configure os preços de cada trecho</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Depois de adicionar todas as paradas, o sistema gera automaticamente todas as combinações de trechos. Basta digitar o valor de cada combinação. Exemplo: Cidade A → Cidade B = R$ 80,00. Cada combinação de origem e destino tem seu próprio preço.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">5. Defina a capacidade da van</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Em "Capacidade da van", coloque quantos passageiros cabem na sua van. Quando atingir o limite, o sistema bloqueia novos agendamentos automaticamente para aquele dia.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">6. Salve as configurações</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Sempre toque em "💾 Salvar configurações" após fazer qualquer alteração. Sem salvar, as mudanças serão perdidas.
        </p>

        <div className="h-px mb-6" style={{ background: '#e5e7eb' }} />

        {/* SEÇÃO 4 */}
        <h2 className="text-base font-bold mb-4" style={{ color: '#0F6E56' }}>🔗 Compartilhando seu link</h2>

        <p className="text-sm font-semibold text-gray-800 mb-1">1. Copie seu link exclusivo</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Em Configurações, na seção "Link de agendamento", toque em "📋 Copiar link". Cada motorista tem um link único e exclusivo — nenhum dado de um motorista aparece para outro.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">2. Envie para seus passageiros</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Cole o link no WhatsApp e envie para seus passageiros. Eles vão abrir o link no celular deles e fazer o agendamento sem precisar de cadastro.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">3. Oriente o passageiro a instalar o app</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Peça para seus passageiros também adicionarem o link à tela inicial do celular deles. Assim sempre que quiserem agendar, já têm o app em mãos.
        </p>

        <div className="h-px mb-6" style={{ background: '#e5e7eb' }} />

        {/* SEÇÃO 5 */}
        <h2 className="text-base font-bold mb-4" style={{ color: '#0F6E56' }}>💰 Pagamento via Pix</h2>

        <p className="text-sm font-semibold text-gray-800 mb-1">1. Ative o pagamento obrigatório</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Em Configurações → Pagamento via Pix, ative a chave "Exigir pagamento ao agendar". Quando ativado, o passageiro verá o QR Code Pix ao agendar e deverá pagar antes de confirmar.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">2. Configure sua chave Pix</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Escolha o tipo da sua chave (telefone, CPF, e-mail ou aleatória) e cole o valor da chave. O sistema gera o QR Code automaticamente para o passageiro escanear.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">3. O passageiro paga pelo celular dele</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Quando o passageiro agendar pelo link, ele verá o QR Code Pix e a opção de copiar a chave. Ele paga pelo celular dele e envia o comprovante pelo WhatsApp para você confirmar.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">4. Agendamento sem pagamento obrigatório</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Se preferir cobrar na hora da viagem, deixe a chave desativada. O passageiro agenda normalmente e você cobra o dinheiro pessoalmente.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">5. Motorista agendando manualmente</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Quando você mesmo adiciona um passageiro pela Agenda, o Pix não é cobrado — você controla o pagamento manualmente. Use esta opção para passageiros que pegam no meio do caminho ou que pagam em dinheiro.
        </p>

        <div className="h-px mb-6" style={{ background: '#e5e7eb' }} />

        {/* SEÇÃO 6 */}
        <h2 className="text-base font-bold mb-4" style={{ color: '#0F6E56' }}>📅 Gerenciando a Agenda</h2>

        <p className="text-sm font-semibold text-gray-800 mb-1">1. Veja os passageiros do dia</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Na aba "Agenda", toque em um dia no calendário para ver todos os passageiros agendados. Os dias com agendamentos têm um ponto verde. O calendário mostra o mês completo e você pode navegar entre os meses.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">2. Confirme a presença</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Toque em "✓ Confirmar" no card do passageiro para marcar que ele confirmou a viagem. O status muda de "Agendado" para "Confirmado".
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">3. Entre em contato pelo WhatsApp ou telefone</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Toque em "💬 WhatsApp" para abrir uma conversa direta com o passageiro com uma mensagem já pronta de confirmação. Ou toque em "📞 Ligar" para ligar diretamente.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">4. Cancele um agendamento</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Se o passageiro cancelar, toque em "✕" no card dele. O sistema remove da agenda e libera a vaga para outro passageiro.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">5. Adicione passageiros manualmente</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Toque em "+ Agendar passageiro neste dia" para adicionar alguém que você pegou no meio do caminho ou que não agendou pelo link. Você preenche o nome, telefone, origem, destino e valor manualmente.
        </p>

        <div className="h-px mb-6" style={{ background: '#e5e7eb' }} />

        {/* SEÇÃO 7 */}
        <h2 className="text-base font-bold mb-4" style={{ color: '#0F6E56' }}>💵 Controle Financeiro</h2>

        <p className="text-sm font-semibold text-gray-800 mb-1">1. Receitas dos agendamentos</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Tudo que for pago via Pix pelo link de agendamento entra automaticamente na seção "Receitas via agendamento" do Financeiro.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">2. Lance receitas manuais</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          No final do dia, some o dinheiro que recebeu em espécie e toque em "+ Receita". Escolha a categoria (Rota diária, Passagens avulsas, Frete empresarial, Tour/Passeio, Entrega ou Outros), coloque o valor e salve. O sistema soma tudo automaticamente.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">3. Registre suas despesas</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Toque em "+ Despesa" para registrar gastos como combustível, manutenção, pedágio, pneu etc. Escolha a categoria, descreva e coloque o valor.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">4. Acompanhe seu lucro</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          O sistema calcula automaticamente: Receitas − Despesas = Lucro. Use os filtros <strong>Hoje, 7 dias, 30 dias</strong> ou <strong>Mês</strong> para ver o resumo do período que quiser. No filtro Mês você pode navegar entre os meses.
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">5. Veja por categoria</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-8">
          O financeiro mostra gráficos com quanto você gastou em cada categoria de despesa e quanto recebeu em cada tipo de receita. Assim você sabe exatamente onde está gastando mais e onde está ganhando mais.
        </p>

        {/* Suporte */}
        <div className="rounded-2xl p-4 mb-8" style={{ background: '#FAEEDA', border: '1px solid #FAC775' }}>
          <p className="text-sm font-bold mb-1" style={{ color: '#854F0B' }}>💬 Precisa de ajuda?</p>
         <p className="text-sm leading-relaxed mb-3" style={{ color: '#633806' }}>
            Se tiver dúvidas ou problemas, fale direto com o suporte:
          </p>
          <a href="https://wa.me/5595984143839?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20RotaGenda."
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold"
            style={{ background: '#25D366', color: '#fff' }}>
            💬 Falar com o suporte no WhatsApp
          </a>
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
  const [novaParadaCidade, setNovaParadaCidade] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [erroSalvar, setErroSalvar] = useState('')
  const [loading, setLoading] = useState(true)
  const [motorista, setMotorista] = useState<any>(null)
  const [empresaSlug, setEmpresaSlug] = useState<string | null>(null)
  const [temEmpresa, setTemEmpresa] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [mostrarGuia, setMostrarGuia] = useState(false)
  const qrRef = useRef<HTMLCanvasElement>(null)
  const dragIdx = useRef<number | null>(null)
  const dragOverIdx = useRef<number | null>(null)
  const diasTrabalhoExiste = useRef(false)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: mot } = await supabase.from('motoristas').select('*').eq('id', user.id).single()
    if (mot) {
      setMotorista(mot)
      diasTrabalhoExiste.current = 'dias_trabalho' in mot
    }
    // Verifica vínculo com empresa: motorista de empresa (motoristas_empresa) ou gestor (gestores)
    const [{ data: motEmpresa }, { data: gestorRow }] = await Promise.all([
      supabase.from('motoristas_empresa').select('empresa_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('gestores').select('empresa_id').eq('user_id', user.id).maybeSingle(),
    ])
    const empresaId = motEmpresa?.empresa_id ?? gestorRow?.empresa_id ?? null
    if (empresaId) {
      setTemEmpresa(true)
      const { data: empresa } = await supabase
        .from('empresas')
        .select('slug')
        .eq('id', empresaId)
        .single()
      if (empresa?.slug) setEmpresaSlug(empresa.slug)
    }
    const { data: rts } = await supabase.from('rotas').select('*').eq('motorista_id', user.id).limit(1).single()
    if (rts) {
      setRota(rts)
      const { data: pars } = await supabase.from('paradas').select('*').eq('rota_id', rts.id).order('ordem')
      const { data: prs } = await supabase.from('precos').select('*').eq('rota_id', rts.id)
      if (pars) setParadas(pars)
      // Gera tabela bidirecional (ida e volta) a partir dos preços já salvos no banco
      if (pars && prs) gerarPrecos(pars, prs)
      else if (prs) setPrecos(prs)
    } else {
      const { data: { user: u } } = await supabase.auth.getUser()
      const { data: novaRota } = await supabase.from('rotas').insert({
        motorista_id: u!.id, nome: 'Minha Rota', horario_ida: '05:00', horario_volta: '14:00', capacidade: 15,
      }).select().single()
      if (novaRota) setRota(novaRota)
    }
    setLoading(false)
  }

  // Normaliza horário para HH:MM — Supabase retorna "HH:MM:SS" mas iOS exige "HH:MM"
  function normalizarHorario(h: string | null | undefined, fallback: string): string {
    if (!h) return fallback
    return h.slice(0, 5)
  }

  async function salvarRota() {
    if (!rota) {
      setErroSalvar('Nenhuma rota encontrada. Recarregue a página e tente novamente.')
      return
    }
    setSaving(true)
    setErroSalvar('')

    const horarioIda = normalizarHorario(rota.horario_ida, '05:00')
    const horarioVolta = normalizarHorario(rota.horario_volta, '14:00')

    console.log('[configuracoes] salvando rota:', {
      horario_ida: horarioIda,
      horario_volta: horarioVolta,
      nome: rota.nome,
      capacidade: rota.capacidade,
    })

    const { error: erroRota } = await supabase.from('rotas').update({
      nome: rota.nome, horario_ida: horarioIda, horario_volta: horarioVolta, capacidade: rota.capacidade || 1,
      cidade_origem:  rota.cidade_origem?.trim()  || null,
      cidade_destino: rota.cidade_destino?.trim() || null,
    }).eq('id', rota.id)

    console.log('[configuracoes] resultado UPDATE rotas:', erroRota ?? 'ok')

    if (erroRota) {
      setErroSalvar('Erro ao salvar horários: ' + erroRota.message)
      setSaving(false)
      return
    }

    await supabase.from('paradas').delete().eq('rota_id', rota.id)
    if (paradas.length > 0) {
      const { error: erroParadas } = await supabase.from('paradas').insert(
        paradas.map((p, i) => ({ rota_id: rota.id, nome: p.nome, ordem: i, cidade: p.cidade?.trim() || null }))
      )
      if (erroParadas) {
        setErroSalvar('Erro ao salvar as paradas: ' + erroParadas.message)
        setSaving(false)
        return
      }
    }

    await supabase.from('precos').delete().eq('rota_id', rota.id)
    const precosValidos = precos.filter(p => p.valor > 0)
    if (precosValidos.length > 0) {
      await supabase.from('precos').insert(precosValidos.map(p => ({
        rota_id: rota.id, parada_origem: p.parada_origem, parada_destino: p.parada_destino, valor: parseFloat(p.valor),
      })))
    }

    if (motorista) {
      const motUpdate: any = {
        pix_tipo: motorista.pix_tipo,
        pix_chave: motorista.pix_chave,
        pagamento_obrigatorio: motorista.pagamento_obrigatorio,
        telefone: motorista.telefone?.trim() || null,
        mensagem_confirmacao: motorista.mensagem_confirmacao?.trim() || null,
      }
      if (diasTrabalhoExiste.current) {
        motUpdate.dias_trabalho = motorista.dias_trabalho ?? [1, 2, 3, 4, 5]
      }
      await supabase.from('motoristas').update(motUpdate).eq('id', motorista.id)
    }

    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  function adicionarParada() {
    if (!novaParada.trim()) return
    const ultima = paradas.length - 1
    const novas = [...paradas]
    const nova = { nome: novaParada.trim(), cidade: novaParadaCidade.trim() || null, ordem: 0 }
    if (novas.length >= 2) {
      novas.splice(ultima, 0, { ...nova, ordem: ultima })
    } else {
      novas.push({ ...nova, ordem: novas.length })
    }
    setParadas(novas.map((p, i) => ({ ...p, ordem: i })))
    setNovaParada('')
    setNovaParadaCidade('')
    gerarPrecos(novas)
  }

  function removerParada(idx: number) {
    const novas = paradas.filter((_, i) => i !== idx).map((p, i) => ({ ...p, ordem: i }))
    setParadas(novas)
    gerarPrecos(novas)
  }

  // precosBase: quando chamado na carga inicial, passa os preços do banco direto
  // para evitar race condition com o estado do React. Em mudanças de parada,
  // omitir e usar o estado atual (que já é bidirecional).
  function gerarPrecos(pars: any[], precosBase?: any[]) {
    const base = precosBase ?? precos
    const novosPrecos: any[] = []
    for (let i = 0; i < pars.length; i++) {
      for (let j = i + 1; j < pars.length; j++) {
        const existeIda = base.find(p =>
          p.parada_origem === pars[i].nome && p.parada_destino === pars[j].nome
        )
        novosPrecos.push({
          parada_origem: pars[i].nome,
          parada_destino: pars[j].nome,
          valor: existeIda?.valor || 0,
        })
        // Direção inversa (volta): pré-popula com o valor da ida se não houver valor próprio
        const existeVolta = base.find(p =>
          p.parada_origem === pars[j].nome && p.parada_destino === pars[i].nome
        )
        novosPrecos.push({
          parada_origem: pars[j].nome,
          parada_destino: pars[i].nome,
          valor: existeVolta?.valor ?? existeIda?.valor ?? 0,
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
    const link = temEmpresa
      ? (empresaSlug ? `${window.location.origin}/agendar/${empresaSlug}` : '')
      : `${window.location.origin}/agendar/${motorista?.slug || motorista?.id}`
    if (!link) return
    navigator.clipboard.writeText(link)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  function baixarQRCode() {
    const canvas = qrRef.current
    if (!canvas) return
    // Gera versão em alta resolução (600px) para impressão
    const scale = 600 / canvas.width
    const hiRes = document.createElement('canvas')
    hiRes.width = 600
    hiRes.height = 600
    const ctx = hiRes.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = false
      ctx.scale(scale, scale)
      ctx.drawImage(canvas, 0, 0)
    }
    const url = hiRes.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'qrcode-agendamento.png'
    a.click()
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function onDragStart(idx: number) {
    dragIdx.current = idx
    setDraggingIdx(idx)
  }

  function onDragEnter(idx: number) {
    dragOverIdx.current = idx
    if (dragIdx.current === null || dragIdx.current === idx) return
    const novas = [...paradas]
    const item = novas.splice(dragIdx.current, 1)[0]
    novas.splice(idx, 0, item)
    dragIdx.current = idx
    setDraggingIdx(idx)
    const atualizadas = novas.map((p, i) => ({ ...p, ordem: i }))
    setParadas(atualizadas)
    gerarPrecos(atualizadas)
  }

  function onDragEnd() {
    dragIdx.current = null
    dragOverIdx.current = null
    setDraggingIdx(null)
  }

  function handleTouchStartHandle(e: React.TouchEvent, idx: number) {
    e.preventDefault()
    dragIdx.current = idx
    setDraggingIdx(idx)

    let currentParadas = [...paradas]
    let currentPrecos = [...precos]
    let currentDragIdx = idx

    function move(ev: TouchEvent) {
      ev.preventDefault()
      const touch = ev.touches[0]
      const el = document.elementFromPoint(touch.clientX, touch.clientY)
      if (!el) return
      const itemEl = el.closest('[data-drag-idx]') as HTMLElement
      if (!itemEl) return
      const newIdx = parseInt(itemEl.dataset.dragIdx ?? '-1')
      if (isNaN(newIdx) || newIdx < 0 || newIdx === currentDragIdx) return

      const novas = [...currentParadas]
      const moved = novas.splice(currentDragIdx, 1)[0]
      novas.splice(newIdx, 0, moved)
      currentDragIdx = newIdx
      currentParadas = novas

      const novosPrecos: any[] = []
      for (let i = 0; i < novas.length; i++) {
        for (let j = i + 1; j < novas.length; j++) {
          const existe = currentPrecos.find(p =>
            p.parada_origem === novas[i].nome && p.parada_destino === novas[j].nome
          )
          novosPrecos.push({ parada_origem: novas[i].nome, parada_destino: novas[j].nome, valor: existe?.valor || 0 })
        }
      }
      currentPrecos = novosPrecos

      dragIdx.current = newIdx
      setDraggingIdx(newIdx)
      setParadas(novas.map((p, i) => ({ ...p, ordem: i })))
      setPrecos(novosPrecos)
    }

    function end() {
      dragIdx.current = null
      setDraggingIdx(null)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
    }

    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end)
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

  const linkPublico = typeof window !== 'undefined'
    ? temEmpresa
      ? (empresaSlug ? `${window.location.origin}/agendar/${empresaSlug}` : '')
      : `${window.location.origin}/agendar/${motorista?.slug || motorista?.id}`
    : ''

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Configurações</p>
        <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">Rota, preços e pagamento</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        <Secao titulo="👤 Meu perfil">
          <Campo label="WhatsApp / Telefone">
            <input
              value={motorista?.telefone || ''}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                let masked = digits
                if (digits.length > 10) {
                  masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
                } else if (digits.length > 6) {
                  masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
                } else if (digits.length > 2) {
                  masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`
                } else if (digits.length > 0) {
                  masked = `(${digits}`
                }
                setMotorista((m: any) => ({ ...m, telefone: masked }))
              }}
              type="tel"
              placeholder="(95) 99999-9999"
              className="campo-input"
            />
          </Campo>
          <p className="text-xs text-gray-400 mt-2">
            Usado para os passageiros enviarem comprovante de agendamento.
          </p>
        </Secao>

<Secao titulo="🔗 Meu link de agendamento">
          {temEmpresa && empresaSlug && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#E1F5EE', border: '1px solid #9FE1CB' }}>
              <p className="text-xs" style={{ color: '#085041' }}>
                Este é o link da sua empresa. Compartilhe com seus passageiros para que eles possam agendar.
              </p>
            </div>
          )}
          {temEmpresa && !empresaSlug && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
              <p className="text-xs" style={{ color: '#92400E' }}>
                Sua empresa ainda não configurou um link público. Peça ao gestor para definir o slug em Configurações da Empresa.
              </p>
            </div>
          )}
          {!temEmpresa && (
            <p className="text-xs text-gray-400 mb-3">Compartilhe este link ou QR Code com seus passageiros.</p>
          )}
          {linkPublico && (
            <>
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-600 break-all">{linkPublico}</p>
              </div>
              <div className="flex flex-col items-center mb-3">
                <QRCodeCanvas
                  ref={qrRef}
                  value={linkPublico}
                  size={240}
                  bgColor="#ffffff"
                  fgColor="#0F6E56"
                  level="H"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={copiarLink}
                  className="py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: linkCopiado ? '#E1F5EE' : '#0F6E56', color: linkCopiado ? '#0F6E56' : '#fff' }}>
                  {linkCopiado ? '✓ Copiado!' : '📋 Copiar link'}
                </button>
                <button onClick={baixarQRCode}
                  className="py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: '#085041', color: '#fff' }}>
                  ⬇️ Baixar QR Code
                </button>
              </div>
            </>
          )}
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
                    placeholder="Ex: (95) 99999-9999" className="campo-input" />
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

        <Secao titulo="📅 Dias de trabalho">
          <p className="text-xs text-gray-400 mb-3">
            Selecione os dias em que você trabalha. Na Agenda, dias fora da sua escala ficam acinzentados.
          </p>
          <div className="grid grid-cols-7 gap-1">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, i) => {
              const diasAtivos: number[] = motorista?.dias_trabalho ?? [1, 2, 3, 4, 5]
              const ativo = diasAtivos.includes(i)
              return (
                <button key={i}
                  onClick={() => {
                    const atual: number[] = motorista?.dias_trabalho ?? [1, 2, 3, 4, 5]
                    const novo = ativo
                      ? atual.filter((d: number) => d !== i)
                      : [...atual, i].sort((a, b) => a - b)
                    setMotorista((m: any) => ({ ...m, dias_trabalho: novo }))
                  }}
                  className="py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={ativo
                    ? { background: '#0F6E56', color: '#fff', borderColor: '#0F6E56' }
                    : { background: '#fff', color: '#9ca3af', borderColor: '#e5e7eb' }}>
                  {dia}
                </button>
              )
            })}
          </div>
          {((motorista?.dias_trabalho ?? [1, 2, 3, 4, 5]).length === 0) && (
            <p className="text-xs mt-2" style={{ color: '#A32D2D' }}>
              ⚠️ Nenhum dia selecionado — selecione ao menos um dia.
            </p>
          )}
        </Secao>

        <Secao titulo="🛣️ Dados da rota">
          <div className="flex flex-col gap-3">
            <Campo label="Nome da rota">
              <input value={rota?.nome || ''} onChange={e => setRota((r: any) => ({ ...r, nome: e.target.value }))}
                placeholder="Ex: São Paulo → Campinas" className="campo-input" />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Saída ida">
                <input type="time"
                  value={normalizarHorario(rota?.horario_ida, '05:00')}
                  onChange={e => setRota((r: any) => ({ ...r, horario_ida: e.target.value }))}
                  onBlur={e => { if (e.target.value) setRota((r: any) => ({ ...r, horario_ida: e.target.value })) }}
                  className="campo-input" />
              </Campo>
              <Campo label="Saída volta">
                <input type="time"
                  value={normalizarHorario(rota?.horario_volta, '14:00')}
                  onChange={e => setRota((r: any) => ({ ...r, horario_volta: e.target.value }))}
                  onBlur={e => { if (e.target.value) setRota((r: any) => ({ ...r, horario_volta: e.target.value })) }}
                  className="campo-input" />
              </Campo>
            </div>
            <Campo label="🚗 Capacidade da van (passageiros)">
              <input type="number" value={rota?.capacidade ?? 0}
                onChange={e => setRota((r: any) => ({ ...r, capacidade: parseInt(e.target.value) || 0 }))}
                min={1} max={100} placeholder="Ex: 15" className="campo-input" />
            </Campo>
            <div style={{ background: '#E1F5EE' }} className="rounded-xl p-3">
              <p className="text-xs" style={{ color: '#085041' }}>
                ✓ Quando a van atingir o limite, os passageiros não conseguirão mais agendar naquele dia.
              </p>
            </div>
          </div>
        </Secao>

        <Secao titulo="🏙️ Cidades da rota (opcional)">
          <p className="text-xs text-gray-400 mb-3">
            Se preenchidas, o passageiro vê as paradas separadas por cidade no
            momento de agendar — evita confusão entre ida e volta. Se deixar
            em branco, funciona como antes.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Cidade de origem">
              <input value={rota?.cidade_origem ?? ''}
                onChange={e => setRota((r: any) => ({ ...r, cidade_origem: e.target.value }))}
                placeholder="Ex: Piripiri" className="campo-input" />
            </Campo>
            <Campo label="Cidade de destino">
              <input value={rota?.cidade_destino ?? ''}
                onChange={e => setRota((r: any) => ({ ...r, cidade_destino: e.target.value }))}
                placeholder="Ex: Teresina" className="campo-input" />
            </Campo>
          </div>
        </Secao>

        <Secao titulo="📍 Paradas da rota">
          <p className="text-xs text-gray-400 mb-3">
            Adicione na ordem do trajeto — primeira é a origem, última é o destino.{' '}
            <span style={{ color: '#1D9E75' }}>Segure e arraste para reordenar.</span>
          </p>
          <div className="flex flex-col">
            {paradas.map((p, i) => (
              <div key={i} draggable
                data-drag-idx={i}
                onDragStart={() => onDragStart(i)}
                onDragEnter={() => onDragEnter(i)}
                onDragEnd={onDragEnd}
                onDragOver={e => e.preventDefault()}
                className="flex items-center gap-2 mb-2 rounded-xl transition-all"
                style={{ background: draggingIdx === i ? '#E1F5EE' : 'transparent', padding: '4px 0' }}>
                <div
                  className="flex flex-col gap-0.5 px-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
                  style={{ touchAction: 'none' }}
                  onTouchStart={(e) => handleTouchStartHandle(e, i)}>
                  <div className="w-4 h-0.5 rounded" style={{ background: '#9FE1CB' }} />
                  <div className="w-4 h-0.5 rounded" style={{ background: '#9FE1CB' }} />
                  <div className="w-4 h-0.5 rounded" style={{ background: '#9FE1CB' }} />
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: i === 0 || i === paradas.length - 1 ? '#085041' : '#1D9E75' }} />
                  {i < paradas.length - 1 && <div className="w-0.5 h-5 mt-0.5" style={{ background: '#9FE1CB' }} />}
                </div>
                <div className="flex-1 min-w-0 select-none">
                  <p className="text-sm text-gray-800 font-medium truncate">{p.nome}</p>
                  {p.cidade && (
                    <p className="text-[10px]" style={{ color: '#0F6E56' }}>📍 {p.cidade}</p>
                  )}
                </div>
                <button onClick={() => removerParada(i)}
                  className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                  style={{ background: '#FCEBEB', color: '#A32D2D' }}>✕</button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex gap-2">
              <input value={novaParada} onChange={e => setNovaParada(e.target.value)}
                placeholder="Nova parada..."
                onKeyDown={e => e.key === 'Enter' && adicionarParada()}
                className="campo-input flex-1" />
              <button onClick={adicionarParada}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: '#E1F5EE', color: '#0F6E56' }}>+ Add</button>
            </div>
            {(rota?.cidade_origem || rota?.cidade_destino) && (
              <select value={novaParadaCidade}
                onChange={e => setNovaParadaCidade(e.target.value)}
                className="campo-input">
                <option value="">Cidade desta parada (opcional)...</option>
                {rota?.cidade_origem  && <option value={rota.cidade_origem}>{rota.cidade_origem}</option>}
                {rota?.cidade_destino && <option value={rota.cidade_destino}>{rota.cidade_destino}</option>}
              </select>
            )}
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

        {erroSalvar && (
          <div className="rounded-xl px-4 py-3 text-sm border"
            style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
            ⚠️ {erroSalvar}
          </div>
        )}

        <button onClick={salvarRota} disabled={saving}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: '#1D9E75' }}>
          {saving ? 'Salvando...' : savedMsg ? '✓ Salvo!' : '💾 Salvar configurações'}
        </button>

        <button onClick={() => setMostrarGuia(true)}
          className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: '#E1F5EE', color: '#0F6E56' }}>
          📖 Guia de uso do RotaGenda
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
          border: 1px solid #e5e7eb; font-size: 16px; color: #222;
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
