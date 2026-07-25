'use client'
/**
 * Modal simples pro gestor gerar o voucher PDF de um atendimento.
 * Duas acoes: Baixar PDF (blob local) ou Enviar por email (Resend server-side).
 * O PDF e gerado 100% no cliente com @react-pdf/renderer — nao chama servico
 * externo pra criar (so pra enviar email).
 */
import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { VoucherPDF, type VoucherEmpresa, type VoucherCliente, type VoucherAtendimento } from './VoucherPDF'

type Props = {
  empresa: VoucherEmpresa
  cliente: VoucherCliente
  atendimento: VoucherAtendimento
  emailCliente?: string | null
  onFechar: () => void
}

export default function ModalGerarVoucher({ empresa, cliente, atendimento, emailCliente, onFechar }: Props) {
  const [gerando, setGerando] = useState<null | 'baixar' | 'email'>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function baixarPDF() {
    setErro(''); setSucesso('')
    setGerando('baixar')
    try {
      const blob = await pdf(
        <VoucherPDF empresa={empresa} cliente={cliente} atendimento={atendimento} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `voucher-${atendimento.numero || 'reserva'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSucesso('Voucher baixado com sucesso.')
    } catch (e: any) {
      setErro(e?.message || 'Erro ao gerar PDF')
    } finally {
      setGerando(null)
    }
  }

  async function enviarPorEmail() {
    setErro(''); setSucesso('')
    if (!emailCliente) {
      setErro('Cliente sem email cadastrado. Use "Baixar" e envie manualmente.')
      return
    }
    setGerando('email')
    try {
      const blob = await pdf(
        <VoucherPDF empresa={empresa} cliente={cliente} atendimento={atendimento} />
      ).toBlob()
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          const b64 = result.split(',')[1] || ''
          res(b64)
        }
        reader.onerror = () => rej(new Error('Falha ao ler PDF'))
        reader.readAsDataURL(blob)
      })
      const resp = await fetch('/api/enviar-voucher-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailCliente,
          cliente_nome: cliente.nome,
          empresa_nome: empresa.nome,
          numero: atendimento.numero,
          pdf_base64: base64,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Erro ao enviar')
      setSucesso(`Enviado para ${emailCliente}`)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao enviar email')
    } finally {
      setGerando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onFechar}>
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">📄 Voucher do atendimento</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="rounded-xl p-3" style={{ background: '#F5F6F8' }}>
          <p className="text-xs text-gray-500">
            {atendimento.numero ? `Nº ${atendimento.numero} · ` : ''}
            {atendimento.origem} → {atendimento.destino}
          </p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">Cliente: {cliente.nome}</p>
        </div>

        <button onClick={baixarPDF} disabled={gerando !== null}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: '#0F6E56', color: '#fff' }}>
          {gerando === 'baixar' ? 'Gerando PDF...' : '⬇️ Baixar PDF'}
        </button>

        <button onClick={enviarPorEmail} disabled={gerando !== null || !emailCliente}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: '#1D9E75', color: '#fff' }}>
          {gerando === 'email'
            ? 'Enviando...'
            : emailCliente
              ? `✉ Enviar para ${emailCliente}`
              : '✉ Sem email do cliente'}
        </button>

        {erro && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}
        {sucesso && <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-xl">✓ {sucesso}</p>}

        <p className="text-[10px] text-gray-400 mt-1 text-center">
          O voucher usa os dados fiscais e bancários da empresa. Preencha em <b>Configurações</b> se faltar informação.
        </p>
      </div>
    </div>
  )
}
