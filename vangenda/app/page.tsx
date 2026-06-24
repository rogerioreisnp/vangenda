'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<'login' | 'cadastro'>('login')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', senha: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.senha,
        })
        if (error) throw error
        router.push('/dashboard')
      } else {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.senha,
          options: {
            data: { nome: form.nome, telefone: form.telefone },
          },
        })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'User already registered': 'Este e-mail já está cadastrado.',
        'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
      }
      setErro(msgs[err.message] || 'Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4" style={{ background: '#f0f0ec' }}>
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mb-3">
          <svg width="64" height="64" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
            <rect width="192" height="192" rx="42" fill="#04342C"/>
            <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
            <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
            <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
            <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#0F6E56' }}>RotaGenda</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Gestão de agendamentos e finanças</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(['login', 'cadastro'] as const).map((m) => (
            <button key={m} onClick={() => { setModo(m); setErro('') }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: modo === m ? '#0F6E56' : 'transparent',
                color: modo === m ? '#fff' : '#888',
              }}>
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {modo === 'cadastro' && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Seu nome</label>
                <input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Cláudio Silva"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Telefone / WhatsApp</label>
                <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(95) 99999-9999" type="tel"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600" />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">E-mail</label>
            <input required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="seuemail@email.com" type="email"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Senha</label>
            <input required value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
              placeholder="Mínimo 6 caracteres" type="password"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600" />
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-1 transition-opacity"
            style={{ background: loading ? '#9FE1CB' : '#0F6E56' }}>
            {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar minha conta'}
          </button>
        </form>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        VanGenda © {new Date().getFullYear()}
      </p>
    </div>
  )
}
