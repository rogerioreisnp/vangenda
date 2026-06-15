'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [pronto, setPronto] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setPronto(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPronto(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErro('As senhas não coincidem. Verifique e tente novamente.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)

    if (error) {
      setErro('Erro ao atualizar a senha. O link pode ter expirado — solicite um novo na tela de login.')
      return
    }

    setSucesso(true)
    setTimeout(() => router.push('/'), 3000)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4" style={{ background: '#f0f0ec' }}>
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
          style={{ background: '#0F6E56' }}>
          <span className="text-3xl">🚐</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#0F6E56' }}>RotaGenda</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        {sucesso ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-base font-semibold text-gray-800">Senha atualizada!</p>
            <p className="text-sm text-gray-500 mt-1">Redirecionando para o login...</p>
          </div>
        ) : !pronto ? (
          <div className="text-center py-6">
            <div className="text-4xl animate-pulse mb-3">🔐</div>
            <p className="text-sm text-gray-500">Verificando link de redefinição...</p>
            <p className="text-xs text-gray-400 mt-2">Se demorar, feche e abra o link do e-mail novamente.</p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-800">Criar nova senha</h2>
              <p className="text-xs text-gray-500 mt-1">
                Digite e confirme sua nova senha para voltar a acessar o RotaGenda.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nova senha</label>
                <input
                  required
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Confirmar nova senha</label>
                <input
                  required
                  type="password"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600"
                />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm mt-1 transition-opacity"
                style={{ background: loading ? '#9FE1CB' : '#0F6E56' }}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/')}
                className="text-xs text-gray-400 hover:text-gray-600 text-center mt-1 transition-colors">
                ← Voltar para o login
              </button>
            </form>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        RotaGenda © {new Date().getFullYear()}
      </p>
    </div>
  )
}
