'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Entrada direta no cadastro (2026-08-05). Antes, quem clicava "iniciar teste
// gratis" na pagina de vendas caia primeiro numa tela de escolha de plano com
// os precos. Isso era friccao pura: os planos so mudam o periodo de cobranca,
// nao os recursos — entao a escolha nao alterava nada no que a pessoa ia
// receber, e o periodo escolhido nem chegava a ser gravado (o cadastro sempre
// mandava um valor fixo). Quem clica em teste gratis quer testar, nao comprar.
// Os planos com link de pagamento continuam onde fazem sentido: na tela de
// bloqueio pos-trial (TelaTrialExpirado, em app/empresa/layout.tsx).

type FormDados = {
  nomeEmpresa: string
  nome: string
  telefone: string
  email: string
  senha: string
  confirmarSenha: string
  tipoOperacao: string
}

const FORM_VAZIO: FormDados = {
  nomeEmpresa: '',
  nome: '',
  telefone: '',
  email: '',
  senha: '',
  confirmarSenha: '',
  tipoOperacao: 'transfer',
}

export default function RegistroEmpresaPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormDados>(FORM_VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [erroTelefone, setErroTelefone] = useState('')

  const set = (k: keyof FormDados) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  async function cadastrar() {
    if (!form.nomeEmpresa.trim()) { setErro('Nome da empresa é obrigatório'); return }
    if (!form.nome.trim())        { setErro('Seu nome é obrigatório'); return }
    const tel = form.telefone.replace(/\D/g, '')
    if (!form.telefone.trim()) { setErroTelefone('Informe seu telefone para continuar'); return }
    if (tel.length < 10)       { setErroTelefone('Informe um telefone com DDD (mínimo 10 dígitos)'); return }
    setErroTelefone('')
    if (!form.email.trim())       { setErro('E-mail é obrigatório'); return }
    if (form.senha.length < 6)    { setErro('A senha precisa ter pelo menos 6 caracteres'); return }
    if (form.senha !== form.confirmarSenha) { setErro('As senhas não coincidem'); return }

    setLoading(true)
    setErro('')

    try {
      // 1. Criar usuário no Auth
      const { data: authData, error: errAuth } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.senha,
        options: { data: { nome: form.nome.trim(), telefone: form.telefone.trim(), tipo: 'gestor' } },
      })
      if (errAuth) throw errAuth

      const userId = authData.user?.id
      if (!userId) throw new Error('Erro ao criar usuário. Tente novamente.')

      // 2. Inserir empresa e gestor via API route (usa service_role, bypassa RLS)
      // O token ainda não está ativo no cliente logo após o signUp
      const res = await fetch('/api/empresa/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          nomeEmpresa:  form.nomeEmpresa.trim(),
          nomeGestor:   form.nome.trim(),
          email:        form.email.trim(),
          telefone:     form.telefone.trim(),
          tipoOperacao: form.tipoOperacao,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao criar empresa')

      router.push('/empresa')
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'User already registered':                    'Este e-mail já está cadastrado. Tente fazer login.',
        'Password should be at least 6 characters':   'A senha precisa ter pelo menos 6 caracteres.',
        'Database error saving new user':              'Erro ao salvar. Tente novamente ou fale com o suporte.',
      }
      setErro(msgs[err.message] || err.message || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh" style={{ background: '#f0f0ec' }}>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/" style={{ color: '#9FE1CB' }} className="text-sm font-medium leading-none">← Voltar</Link>
          <div className="flex-1 min-w-0">
            <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">
              Criar conta empresarial
            </p>
            <p style={{ color: '#5DCAA5' }} className="text-xs">
              RotaGenda Empresarial
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 pb-16">
        <div className="flex flex-col gap-3">

          {/* Reforço do que ele já clicou na página de vendas — sem preço,
              porque nesse momento ele quer testar, não comprar. */}
          <div className="rounded-xl px-4 py-3 text-center"
            style={{ background: '#E1F5EE', border: '1px solid #9FE1CB' }}>
            <p className="text-sm font-semibold" style={{ color: '#085041' }}>
              🎉 10 dias de teste grátis
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#0F6E56' }}>
              Sem cartão de crédito · acesso completo a todos os recursos
            </p>
          </div>

          <Campo label="Nome da empresa *">
            <input value={form.nomeEmpresa} onChange={set('nomeEmpresa')}
              placeholder="Ex: Turismo Costa Norte" className="campo-input" />
          </Campo>

          <Campo label="Seu nome completo *">
            <input value={form.nome} onChange={set('nome')}
              placeholder="Ex: Maria Souza" className="campo-input" />
          </Campo>

          <Campo label="Telefone / WhatsApp *">
            <input value={form.telefone}
              onChange={e => { set('telefone')(e); setErroTelefone('') }} type="tel"
              placeholder="(95) 99999-9999" className="campo-input"
              style={erroTelefone ? { borderColor: '#f87171' } : undefined} />
            {erroTelefone && <p className="text-xs text-red-600 mt-1">⚠️ {erroTelefone}</p>}
          </Campo>

          <Campo label="E-mail (será o login) *">
            <input value={form.email} onChange={set('email')} type="email"
              placeholder="empresa@email.com" className="campo-input" />
          </Campo>

          <Campo label="Senha *">
            <input value={form.senha} onChange={set('senha')} type="password"
              placeholder="Mínimo 6 caracteres" className="campo-input" />
          </Campo>

          <Campo label="Confirmar senha *">
            <input value={form.confirmarSenha} onChange={set('confirmarSenha')} type="password"
              placeholder="Repita a senha" className="campo-input" />
          </Campo>

          <Campo label="Tipo de operação">
            <select value={form.tipoOperacao} onChange={set('tipoOperacao')} className="campo-input">
              <option value="transfer">Transfer / Turismo</option>
              <option value="rota_fixa">Rota Fixa Intermunicipal</option>
            </select>
          </Campo>

          {erro && (
            <div className="rounded-xl px-4 py-3 text-sm border"
              style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
              ⚠️ {erro}
            </div>
          )}

          <button onClick={cadastrar} disabled={loading}
            className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-1 disabled:opacity-40 active:opacity-80"
            style={{ background: '#1D9E75' }}>
            {loading ? 'Criando conta...' : '🚀 Criar conta e começar o teste'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Ao criar sua conta você concorda com os termos de uso do RotaGenda.
          </p>

          <div className="text-center py-2">
            <p className="text-xs text-gray-400">
              Já tem uma conta?{' '}
              <Link href="/" className="font-semibold" style={{ color: '#0F6E56' }}>
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .campo-input {
          width: 100%; padding: 10px 12px; border-radius: 12px;
          border: 1px solid #e5e7eb; font-size: 16px; color: #222;
          background: #fff; outline: none;
        }
        .campo-input:focus { border-color: #1D9E75; }
      `}</style>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  )
}
