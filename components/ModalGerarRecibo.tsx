'use client'
/**
 * Modal pro gestor gerar recibo PDF de pagamento de um atendimento.
 * So faz sentido chamar quando status_pagamento === 'recebido'.
 * Duas acoes: Baixar PDF ou Enviar por email.
 */
import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { ReciboPDF, type ReciboAtendimento } from './ReciboPDF'
import type { VoucherEmpresa, VoucherCliente } from './VoucherPDF'

type Props = {
  empresa: VoucherEmpresa
  cliente: VoucherCliente
  atendimento: ReciboAtendimento
  emailCliente?: string | null
  onFechar: () => void
}

export default function ModalGerarRecibo({ empresa, cliente, atendimento, emailCliente, onFechar }: Props) {
  const [gerando, setGerando] = useState<null | 'baixar' | 'email'>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function baixar() {
    setErro(''); setSucesso('')
    setGerando('baixar')
    try {
      const blob = await pdf(
        <ReciboPDF empresa={empresa} cliente={cliente} atendimento={atendimento} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recibo-${atendimento.numero || 'atendimento'}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSucesso('Recibo baixado.')
    } catch (e: any) {
      setErro(e?.message || 'Erro ao gerar PDF')
    } finally { setGerando(null) }
  }

  async function enviar() {
    setErro(''); setSucesso('')
    if (!emailCliente) { setErro('Cliente sem email cadastrado. Use "Baixar" e envie manualmente.'); return }
    setGerando('email')
    try {
      const blob = await pdf(
        <ReciboPDF empresa={empresa} cliente={cliente} atendimento={atendimento} />
      ).toBlob()
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onloadend = () => res(((r.result as string) || '').split(',')[1] || '')
        r.onerror = () => rej(new Error('Falha ao ler PDF'))
        r.readAsDataURL(blob)
      })
      const resp = await fetch('/api/enviar-recibo-email', {
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
    } finally { setGerando(null) }
  }

  const valor = atendimento.valor_recebido ?? atendimento.valor

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onFechar}>
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-5 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">🧾 Recibo de pagamento</p>
          <button onClick={onFechar} className="text-gray-400 text-xl leading-none">✕</button>
        </div>

        <div className="rounded-xl p-3" style={{ background: '#F5F6F8' }}>
          <p className="text-xs text-gray-500">
            {atendimento.numero ? `Nº ${atendimento.numero} · ` : ''}
            {atendimento.origem} → {atendimento.destino}
          </p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">
            Recebido de {cliente.nome}
          </p>
          <p className="text-lg font-bold mt-1" style={{ color: '#0F6E56' }}>
            R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <button onClick={baixar} disabled={gerando !== null}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: '#0F6E56', color: '#fff' }}>
          {gerando === 'baixar' ? 'Gerando PDF...' : '⬇️ Baixar recibo PDF'}
        </button>

        <button onClick={enviar} disabled={gerando !== null || !emailCliente}
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
      </div>
    </div>
  )
}
