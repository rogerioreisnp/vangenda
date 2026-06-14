'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function EmpresaPage() {
  const [nomeEmpresa, setNomeEmpresa] = useState<string | null>(null)

  useEffect(() => {
    carregarEmpresa()
  }, [])

  async function carregarEmpresa() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: gestor } = await supabase
      .from('gestores')
      .select('empresa_id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) return

    const { data: empresa } = await supabase
      .from('empresas')
      .select('nome')
      .eq('id', gestor.empresa_id)
      .single()

    if (empresa) setNomeEmpresa(empresa.nome)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-8" style={{ background: '#f0f0ec' }}>
      <div className="text-5xl mb-4">🏢</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Painel Empresarial</h1>
      {nomeEmpresa && (
        <p className="text-base text-gray-500 mb-6">{nomeEmpresa}</p>
      )}
      <div className="bg-white rounded-2xl px-8 py-5 border border-gray-100 text-center">
        <p className="text-gray-400 text-sm">Em construção</p>
      </div>
    </div>
  )
}
