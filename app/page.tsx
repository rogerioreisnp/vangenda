'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const WHATSAPP_SUPORTE = '5595984143839'
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_SUPORTE}?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20acessar%20minha%20conta%20no%20RotaGenda.`

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<'login' | 'cadastro' | 'recuperar'>('login')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', senha: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setLoading(true)

    try {
      if (modo === 'recuperar') {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/nova-senha`,
        })
        if (error) throw error
        setSucesso('Enviamos um link de recuperação para o seu e-mail. Verifique a caixa de entrada e o spam.')
      } else if (modo === 'login') {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.senha,
        })
        if (error) throw error

        // Verifica se o usuário é gestor de empresa → redireciona para o painel correto
        const { data: gestor } = await supabase
          .from('gestores')
          .select('id')
          .eq('user_id', authData.user.id)
          .maybeSingle()

        router.push(gestor ? '/empresa' : '/dashboard')
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
        'Database error saving new user': 'Erro ao criar perfil. Tente novamente ou fale com o suporte.',
      }
      setErro(msgs[err.message] || 'Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const trocarModo = (m: 'login' | 'cadastro') => {
    setModo(m)
    setErro('')
    setSucesso('')
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4" style={{ background: '#f0f0ec' }}>
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
          style={{ background: '#0F6E56' }}>
          <span className="text-3xl">🚐</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#0F6E56' }}>RotaGenda</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>Gestão de agendamentos, passagens e finanças para vans, táxis, transfers e operadores de turismo</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

        {modo === 'recuperar' ? (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-800">Recuperar acesso</h2>
              <p className="text-xs text-gray-500 mt-1">Digite o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">E-mail da conta</label>
                <input required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="seuemail@email.com" type="email"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600" />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{erro}</div>
              )}
              {sucesso && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-green-700">
                  {sucesso}
                  <p className="text-xs text-gray-400 mt-1.5">Não encontrou? Verifique sua caixa de spam ou lixeira.</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-1 transition-opacity"
                style={{ background: loading ? '#9FE1CB' : '#0F6E56' }}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <button type="button" onClick={() => trocarModo('login')}
                className="text-xs text-gray-400 hover:text-gray-600 text-center mt-1 transition-colors">
                ← Voltar para o login
              </button>
            </form>
          </>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              {(['login', 'cadastro'] as const).map((m) => (
                <button key={m} onClick={() => trocarModo(m)}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Senha</label>
                  {modo === 'login' && (
                    <button type="button" onClick={() => { setModo('recuperar'); setErro(''); setSucesso('') }}
                      className="text-xs transition-colors"
                      style={{ color: '#0F6E56' }}>
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <input required value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                  placeholder="Mínimo 6 caracteres" type="password"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600" />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{erro}</div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-1 transition-opacity"
                style={{ background: loading ? '#9FE1CB' : '#0F6E56' }}>
                {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar minha conta'}
              </button>
            </form>
          </>
        )}

        {/* Suporte WhatsApp */}
        <div className="mt-5 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 mb-2">Está com dificuldades para entrar?</p>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition-colors"
            style={{ background: '#f0faf6', color: '#0F6E56' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Falar com o suporte
          </a>
        </div>
      </div>

      {/* CTA empresa */}
      <div className="w-full max-w-sm mt-3">
        <a href="/empresa/registro"
          className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium border transition-colors"
          style={{ background: 'white', borderColor: '#e5e7eb', color: '#0F6E56' }}>
          🏢 Cadastrar minha empresa
        </a>
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        RotaGenda © {new Date().getFullYear()}
      </p>
    </div>
  )
}
