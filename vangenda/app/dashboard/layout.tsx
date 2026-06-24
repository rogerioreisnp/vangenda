'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard', label: 'Início', emoji: '⌂' },
  { href: '/dashboard/agenda', label: 'Agenda', emoji: '📅' },
  { href: '/dashboard/financeiro', label: 'Finanças', emoji: '💰' },
  { href: '/dashboard/configuracoes', label: 'Config.', emoji: '⚙' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checando, setChecando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/')
      else setChecando(false)
    })
  }, [router])

  if (checando) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#f0f0ec' }}>
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
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#f0f0ec' }}>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Navegação inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-50">
        <div className="grid grid-cols-4 max-w-lg mx-auto">
          {navItems.map((item) => {
            const ativo = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center py-2 pb-3 gap-0.5 transition-colors"
                style={{ color: ativo ? '#0F6E56' : '#aaa' }}>
                <span className="text-xl leading-none">{item.emoji}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
