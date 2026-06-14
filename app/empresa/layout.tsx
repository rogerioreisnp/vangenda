'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checando, setChecando] = useState(true)

  useEffect(() => {
    verificarGestor()
  }, [])

  async function verificarGestor() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/')
      return
    }

    const { data: gestor } = await supabase
      .from('gestores')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    if (!gestor) {
      router.push('/')
      return
    }

    setChecando(false)
  }

  if (checando) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#f0f0ec' }}>
        <div className="text-4xl animate-pulse">🚐</div>
      </div>
    )
  }

  return <>{children}</>
}
