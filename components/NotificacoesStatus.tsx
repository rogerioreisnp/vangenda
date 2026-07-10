'use client'
import { useEffect, useState } from 'react'

type Estado = 'checando' | 'ativo' | 'inativo' | 'bloqueado' | 'nao_suportado'

/**
 * Card de status das notificações para o gestor/empresa.
 * - Mostra visualmente se o dispositivo está inscrito no OneSignal.
 * - Botão "Ativar" quando permission=default → dispara requestPermission.
 * - Botão "Enviar teste" para o gestor confirmar que chega push nele mesmo.
 */
export default function NotificacoesStatus({ empresaId }: { empresaId: string }) {
  const [estado, setEstado] = useState<Estado>('checando')
  const [ativando, setAtivando] = useState(false)
  const [enviandoTeste, setEnviandoTeste] = useState(false)
  const [msgTeste, setMsgTeste] = useState<string | null>(null)
  const [detalheTecnico, setDetalheTecnico] = useState<string>('')

  async function checarEstado() {
    if (typeof window === 'undefined') return
    if (typeof Notification === 'undefined') {
      setEstado('nao_suportado')
      setDetalheTecnico('Este navegador não suporta notificações.')
      return
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isStandalone = (window.matchMedia?.('(display-mode: standalone)').matches)
      || (window.navigator as any).standalone === true

    if (isIOS && !isStandalone) {
      setEstado('nao_suportado')
      setDetalheTecnico('iPhone só recebe push se o app estiver instalado na tela de início. Toque em Compartilhar → Adicionar à Tela de Início.')
      return
    }

    if (Notification.permission === 'denied') {
      setEstado('bloqueado')
      setDetalheTecnico(isIOS
        ? 'Vá em Ajustes → Notificações → RotaGenda e permita.'
        : 'Vá em Configurações do navegador → Notificações e permita para este site.')
      return
    }

    if (Notification.permission === 'default') {
      setEstado('inativo')
      setDetalheTecnico('O navegador ainda não pediu permissão neste dispositivo.')
      return
    }

    // Aguarda OneSignal terminar de carregar/logar (retry curto)
    let optedIn: boolean | undefined
    for (let i = 0; i < 10; i++) {
      const OS = (window as any).OneSignal
      optedIn = OS?.User?.PushSubscription?.optedIn
      if (typeof optedIn === 'boolean') break
      await new Promise(r => setTimeout(r, 300))
    }

    if (optedIn === true) {
      setEstado('ativo')
      setDetalheTecnico('')
    } else {
      setEstado('inativo')
      setDetalheTecnico('Permissão dada mas inscrição não completou. Toque em "Ativar" para tentar de novo.')
    }
  }

  useEffect(() => {
    checarEstado()
  }, [])

  async function ativar() {
    setAtivando(true)
    setMsgTeste(null)
    try {
      const OS = (window as any).OneSignal
      if (!OS) throw new Error('OneSignal ainda não carregou. Recarregue a página.')
      try { await OS.Notifications.requestPermission() } catch {}
      try { await OS.User.PushSubscription.optIn() } catch {}
    } catch (e: any) {
      setMsgTeste(`Erro: ${e?.message || e}`)
    } finally {
      setAtivando(false)
      await checarEstado()
    }
  }

  async function enviarTeste() {
    setEnviandoTeste(true)
    setMsgTeste(null)
    try {
      const res = await fetch('/api/notificar-agendamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId, teste: true }),
      })
      const data = await res.json()
      if (data?.recipients > 0 || data?.id) {
        setMsgTeste('✅ Enviado. Deve chegar em alguns segundos. Se não chegar, veja "Diagnóstico" abaixo.')
      } else if (data?.errors) {
        const err = Array.isArray(data.errors) ? data.errors.join(' | ') : JSON.stringify(data.errors)
        setMsgTeste(`⚠️ OneSignal recusou: ${err}`)
      } else {
        setMsgTeste(`⚠️ Nenhum dispositivo inscrito com tag motorista_id=${data?._tag_value || '?'}. Toque em "Ativar" e tente de novo.`)
      }
    } catch (e: any) {
      setMsgTeste(`Erro: ${e?.message || e}`)
    } finally {
      setEnviandoTeste(false)
    }
  }

  if (estado === 'checando' || estado === 'ativo') {
    // Ativo: mostra um card discreto com botão de teste
    return estado === 'ativo' ? (
      <div className="rounded-2xl p-4 border" style={{ background: '#E1F5EE', borderColor: '#9FE1CB' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: '#085041' }}>🔔 Notificações ativas</p>
            <p className="text-xs mt-0.5" style={{ color: '#0F6E56' }}>
              Você vai receber um aviso quando alguém solicitar transfer.
            </p>
          </div>
          <button
            onClick={enviarTeste}
            disabled={enviandoTeste}
            className="text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-40 whitespace-nowrap"
            style={{ background: '#0F6E56', color: '#fff' }}
          >
            {enviandoTeste ? 'Enviando…' : 'Enviar teste'}
          </button>
        </div>
        {msgTeste && (
          <p className="text-xs mt-2 leading-snug" style={{ color: '#085041' }}>{msgTeste}</p>
        )}
      </div>
    ) : null
  }

  const cores: Record<Estado, { bg: string; border: string; title: string; sub: string; btnBg: string; btnFg: string }> = {
    checando:      { bg: '#fff',     border: '#e5e7eb', title: '#374151', sub: '#6B7280', btnBg: '#0F6E56', btnFg: '#fff' },
    ativo:         { bg: '#E1F5EE', border: '#9FE1CB', title: '#085041', sub: '#0F6E56', btnBg: '#0F6E56', btnFg: '#fff' },
    inativo:       { bg: '#FAEEDA', border: '#FAC775', title: '#854F0B', sub: '#92400E', btnBg: '#0F6E56', btnFg: '#fff' },
    bloqueado:     { bg: '#FCEBEB', border: '#F5BCBC', title: '#A32D2D', sub: '#7f1d1d', btnBg: '#A32D2D', btnFg: '#fff' },
    nao_suportado: { bg: '#EEEDFE', border: '#AFA9EC', title: '#3C3489', sub: '#4c4392', btnBg: '#3C3489', btnFg: '#fff' },
  }
  const c = cores[estado]

  const titulo =
    estado === 'inativo'       ? '🔔 Notificações desativadas' :
    estado === 'bloqueado'     ? '🚫 Notificações bloqueadas'  :
    estado === 'nao_suportado' ? '📲 Instale o app para receber avisos' :
                                 ''

  return (
    <div className="rounded-2xl p-4 border" style={{ background: c.bg, borderColor: c.border }}>
      <p className="text-sm font-semibold" style={{ color: c.title }}>{titulo}</p>
      {detalheTecnico && (
        <p className="text-xs mt-1 leading-snug" style={{ color: c.sub }}>{detalheTecnico}</p>
      )}

      <div className="flex gap-2 mt-3">
        {estado === 'inativo' && (
          <button
            onClick={ativar}
            disabled={ativando}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: c.btnBg, color: c.btnFg }}
          >
            {ativando ? 'Ativando…' : 'Ativar notificações'}
          </button>
        )}
        {estado === 'inativo' && (
          <button
            onClick={enviarTeste}
            disabled={enviandoTeste}
            className="py-2.5 px-3 rounded-xl text-sm font-semibold border disabled:opacity-40"
            style={{ background: '#fff', color: c.title, borderColor: c.border }}
          >
            {enviandoTeste ? 'Enviando…' : 'Enviar teste'}
          </button>
        )}
      </div>

      {msgTeste && (
        <p className="text-xs mt-2 leading-snug" style={{ color: c.sub }}>{msgTeste}</p>
      )}
    </div>
  )
}
