'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Resumo = {
  nome: string
  plano: string
  status: string
  tipo_operacao: string
}

const PLANO_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', fleet: 'Fleet' }
const STATUS_LABEL: Record<string, string> = { trial: 'Trial', ativo: 'Ativo', inativo: 'Inativo' }

export default function EmpresaPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [nomeGestor, setNomeGestor] = useState<string | null>(null)

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: gestor } = await supabase
      .from('gestores')
      .select('nome, empresa_id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) return
    setNomeGestor(gestor.nome)

    const { data: empresa } = await supabase
      .from('empresas')
      .select('nome, plano, status, tipo_operacao')
      .eq('id', gestor.empresa_id)
      .single()

    if (empresa) setResumo(empresa)
  }

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-5">
        <div className="flex justify-between items-start">
          <div>
            <p style={{ color: '#9FE1CB' }} className="text-xs">{saudacao},</p>
            <p style={{ color: '#E1F5EE' }} className="text-lg font-bold">
              {nomeGestor?.split(' ')[0] || '...'}
            </p>
          </div>
          <span style={{ background: '#085041', color: '#5DCAA5' }}
            className="text-xs px-3 py-1.5 rounded-lg">
            🏢 Painel Empresarial
          </span>
        </div>
        {resumo && (
          <p style={{ color: '#9FE1CB' }} className="text-sm mt-2 font-medium">{resumo.nome}</p>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {resumo && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Plano atual</p>
              <p className="text-base font-bold text-gray-800 mt-0.5">
                {PLANO_LABEL[resumo.plano] || resumo.plano}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">
                {resumo.tipo_operacao === 'transfer' ? 'Transfer / Turismo' : 'Rota Fixa Intermunicipal'}
              </p>
            </div>
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{
                background: resumo.status === 'ativo' ? '#E1F5EE' : '#FAEEDA',
                color: resumo.status === 'ativo' ? '#0F6E56' : '#854F0B',
              }}>
              {STATUS_LABEL[resumo.status] || resumo.status}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            { emoji: '🚐', label: 'Motoristas', href: '/empresa/motoristas', desc: 'Gerencie sua equipe' },
            { emoji: '🛣️', label: 'Rotas', href: '/empresa/rotas', desc: 'Origens e destinos' },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-2xl flex flex-col items-center justify-center py-5 gap-1.5 active:opacity-75"
              style={{ border: '1px solid #f0f0f0', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
              <span className="text-3xl leading-none">{item.emoji}</span>
              <span className="text-sm font-semibold text-gray-700">{item.label}</span>
              <span className="text-xs text-gray-400">{item.desc}</span>
            </Link>
          ))}
        </div>

        <div style={{ background: '#FAEEDA', border: '1px solid #FAC775' }}
          className="rounded-xl p-3 flex gap-3">
          <span className="text-lg flex-shrink-0">🔔</span>
          <p style={{ color: '#633806' }} className="text-xs leading-relaxed">
            <strong>Etapa 2A ativa.</strong> Cadastre seus motoristas e rotas para liberar o agendamento de corridas na próxima etapa.
          </p>
        </div>

      </div>
    </div>
  )
}
