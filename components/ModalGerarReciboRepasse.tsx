'use client'
/**
 * Modal pro gestor gerar recibo de repasse pro motorista parceiro.
 * So aparece o botao quando corridaFicha tem valor_repasse_motorista > 0.
 * Duas acoes: Baixar PDF ou Enviar por WhatsApp (link + PDF nao anexa,
 * usuario compartilha o arquivo baixado no chat).
 *
 * Ao contrario do recibo do cliente, aqui NAO temos email do motorista
 * necessariamente cadastrado, entao a acao secundaria e WhatsApp: abre
 * conversa com o motorista e ele pode receber o PDF baixado.
 */
import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { ReciboRepasseMotoristaPDF, type ReciboRepasseProps } from './ReciboRepasseMotoristaPDF'
import { formatarTelefoneWhatsApp } from '@/lib/telefone'

type Props = ReciboRepasseProps & {
  onFechar: () => void
}

export default function ModalGerarReciboRepasse({ onFechar, ...props }: Props) {
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function baixar() {
    setErro(''); setSucesso('')
    setGerando(true)
    try {
      const blob = await pdf(<ReciboRepasseMotoristaPDF {...props} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `repasse-${props.motorista.nome.replace(/[^a-zA-Z0-9]/g, '_')}-${props.atendimento.numero || 'atend'}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSucesso('Recibo baixado. Compartilhe com o motorista.')
    } catch (e: any) {
      setErro(e?.message || 'Erro ao gerar PDF')
    } finally { setGerando(false) }
  }

  function abrirWhatsApp() {
    const tel = formatarTelefoneWhatsApp(props.motorista.telefone)
    if (!tel) { setErro('Motorista sem telefone cadastrado.'); return }
    const nome = props.motorista.nome.split(' ')[0]
    const num = props.atendimento.numero || ''
    const valor = props.valor_repasse.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const msg = `Olá ${nome}! 🚐\n\nSegue o recibo de repasse do atendimento ${num} no valor de R$ ${valor}.\n\n_(Anexe o PDF baixado nesta conversa)_\n\n— ${props.empresa.nome}`
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onFechar}>
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">🤝 Recibo de repasse ao motorista</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="rounded-xl p-3" style={{ background: '#F5F6F8' }}>
          <p className="text-xs text-gray-500">
            {props.atendimento.numero ? `Nº ${props.atendimento.numero} · ` : ''}
            {props.atendimento.origem} → {props.atendimento.destino}
          </p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">Motorista: {props.motorista.nome}</p>
          <p className="text-lg font-bold mt-1" style={{ color: '#0F6E56' }}>
            R$ {props.valor_repasse.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <button onClick={baixar} disabled={gerando}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: '#0F6E56', color: '#fff' }}>
          {gerando ? 'Gerando PDF...' : '⬇️ Baixar recibo PDF'}
        </button>

        <button onClick={abrirWhatsApp} disabled={gerando || !props.motorista.telefone}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: '#25D366', color: '#fff' }}>
          {props.motorista.telefone
            ? '💬 Abrir WhatsApp do motorista'
            : '💬 Motorista sem telefone'}
        </button>

        {erro && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}
        {sucesso && <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-xl">✓ {sucesso}</p>}

        <p className="text-[10px] text-gray-400 mt-1 text-center">
          Baixe o PDF e anexe manualmente no WhatsApp do motorista. Motorista arquiva pra prestação de contas.
        </p>
      </div>
    </div>
  )
}
