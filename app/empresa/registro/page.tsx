'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Periodo = 'mensal' | 'semestral' | 'anual'
type Etapa = 'plano' | 'dados'

type PlanoPeriodo = {
  id: Periodo
  nome: string
  preco: number
  precoLabel: string
  subtitulo: string
  destaque: boolean
  badgeLabel: string | null
  badgeStyle?: { bg: string; text: string }
}

const PLANOS_PERIODO: PlanoPeriodo[] = [
  {
    id: 'mensal',
    nome: 'Mensal',
    preco: 97,90
    precoLabel: '/mês',
    subtitulo: 'Pague mês a mês, sem compromisso',
    destaque: false,
    badgeLabel: null,
  },
  {
    id: 'anual',
    nome: 'Anual',
    preco: 815,
    precoLabel: '/ano',
    subtitulo: 'equivale a R$ 67,90/mês · economia de 31%',
    destaque: true,
    badgeLabel: 'MAIS ESCOLHIDO',
    badgeStyle: { bg: '#FAC775', text: '#7C3E00' },
  },
  {
    id: 'semestral',
    nome: 'Semestral',
    preco: 479,
    precoLabel: '/semestre',
    subtitulo: 'equivale a R$ 79,90/mês · economia de 18%',
    destaque: false,
    badgeLabel: 'MELHOR CUSTO-BENEFÍCIO',
    badgeStyle: { bg: '#E1F5EE', text: '#085041' },
  },
]

const BENEFICIOS = [
  'Motoristas ilimitados',
  'Acesso completo a todos os recursos',
  'Rotas fixas e transfer/turismo',
  'Agenda e controle financeiro',
  'Suporte incluso',
]

const BENEFICIOS_ANUAL = [
  'Suporte prioritário via WhatsApp',
  'Suporte na configuração inicial',
  'Você recebe as novidades antes de todo mundo',
]

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
  const [etapa, setEtapa]   = useState<Etapa>('plano')
  const [periodo, setPeriodo] = useState<Periodo | null>(null)
  const [form, setForm]     = useState<FormDados>(FORM_VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro, setErro]     = useState('')
  const [erroTelefone, setErroTelefone] = useState('')

  function escolherPeriodo(p: Periodo) {
    setPeriodo(p)
    setEtapa('dados')
    setErro('')
    window.scrollTo(0, 0)
  }

  async function cadastrar() {
    if (!periodo) return
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
          plano: 'fleet',
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

  const planoInfo = periodo ? PLANOS_PERIODO.find(p => p.id === periodo) ?? null : null

  return (
    <div className="min-h-dvh" style={{ background: '#f0f0ec' }}>
      {/* Header */}
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-5">
        <div className="flex items-center gap-3">
          {etapa === 'dados' ? (
            <button onClick={() => setEtapa('plano')} style={{ color: '#9FE1CB' }} className="text-2xl leading-none">‹</button>
          ) : (
            <Link href="/" style={{ color: '#9FE1CB' }} className="text-sm font-medium leading-none">← Voltar</Link>
          )}
          <div className="flex-1 min-w-0">
            <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">
              {etapa === 'plano' ? 'Criar conta empresarial' : 'Dados da empresa'}
            </p>
            <p style={{ color: '#5DCAA5' }} className="text-xs">
              {etapa === 'plano' ? 'RotaGenda Empresarial' : planoInfo ? `${planoInfo.nome} — R$ ${planoInfo.preco}${planoInfo.precoLabel}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 pb-16">
        {etapa === 'plano' ? (
          <EtapaPlano onEscolher={escolherPeriodo} />
        ) : (
          <EtapaDados
            form={form}
            setForm={setForm}
            periodoInfo={PLANOS_PERIODO.find(p => p.id === periodo)!}
            loading={loading}
            erro={erro}
            erroTelefone={erroTelefone}
            onClearErroTelefone={() => setErroTelefone('')}
            onCadastrar={cadastrar}
          />
        )}
      </div>
    </div>
  )
}

/* ─── Etapa 1: Seleção de período ─── */

function EtapaPlano({ onEscolher }: { onEscolher: (p: Periodo) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Banner trial */}
      <div className="rounded-xl px-4 py-3 text-center"
        style={{ background: '#E1F5EE', border: '1px solid #9FE1CB' }}>
        <p className="text-sm font-semibold" style={{ color: '#085041' }}>
          🎉 10 dias de trial grátis
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#0F6E56' }}>
          Sem cartão de crédito. Cancele quando quiser.
        </p>
      </div>

      {/* Cards de período */}
      {PLANOS_PERIODO.map(pl => {
        const inv = pl.destaque
        return (
          <div key={pl.id} className="rounded-2xl border overflow-hidden"
            style={{
              background: inv ? '#0F6E56' : '#fff',
              borderColor: inv ? '#0F6E56' : '#e5e7eb',
              boxShadow: inv ? '0 8px 28px rgba(15,110,86,0.30)' : '0 1px 4px rgba(0,0,0,0.05)',
            }}>
            {pl.badgeLabel && (
              <div className="py-1.5 text-center text-xs font-bold tracking-wide"
                style={{ background: pl.badgeStyle!.bg, color: pl.badgeStyle!.text }}>
                {pl.badgeLabel}
              </div>
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-base font-bold" style={{ color: inv ? '#E1F5EE' : '#1a1a1a' }}>
                    {pl.nome}
                  </p>
                  {pl.id === 'anual' ? (
                    <p className="shimmer-text text-xs font-semibold mt-0.5">{pl.subtitulo}</p>
                  ) : (
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{pl.subtitulo}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold leading-none" style={{ color: inv ? '#fff' : '#0F6E56' }}>
                    R$ {pl.preco}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: inv ? '#9FE1CB' : '#9ca3af' }}>{pl.precoLabel}</p>
                </div>
              </div>

              <ul className="flex flex-col gap-1.5 mb-4">
                {BENEFICIOS.map(b => (
                  <li key={b} className="flex items-center gap-2 text-xs"
                    style={{ color: inv ? '#E1F5EE' : '#4b5563' }}>
                    <span style={{ color: inv ? '#FAC775' : '#1D9E75' }}>✓</span>
                    {b}
                  </li>
                ))}
                {inv && (
                  <>
                    <li className="my-1">
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }} />
                    </li>
                    {BENEFICIOS_ANUAL.map(b => (
                      <li key={b} className="flex items-center gap-2 text-xs font-semibold"
                        style={{ color: '#FAC775' }}>
                        <span>⭐</span>
                        {b}
                      </li>
                    ))}
                  </>
                )}
              </ul>

              <button onClick={() => onEscolher(pl.id)}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity active:opacity-75"
                style={inv
                  ? { background: '#fff', color: '#0F6E56' }
                  : { background: '#E1F5EE', color: '#0F6E56' }}>
                Começar trial grátis →
              </button>

              <p className="text-center text-xs mt-3" style={{ color: inv ? '#9FE1CB' : '#9ca3af' }}>
                10 dias grátis · sem cartão de crédito
              </p>
            </div>
          </div>
        )
      })}

      <div className="text-center py-2">
        <p className="text-xs text-gray-400">
          Já tem uma conta?{' '}
          <Link href="/" className="font-semibold" style={{ color: '#0F6E56' }}>
            Fazer login
          </Link>
        </p>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .shimmer-text {
          background: linear-gradient(90deg, #FAC775 0%, #ffe8a0 35%, #fff5cc 50%, #ffe8a0 65%, #FAC775 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 2.5s linear infinite;
        }
      `}</style>
    </div>
  )
}

/* ─── Etapa 2: Dados da empresa e conta ─── */

function EtapaDados({
  form, setForm, periodoInfo, loading, erro, erroTelefone, onClearErroTelefone, onCadastrar,
}: {
  form: FormDados
  setForm: React.Dispatch<React.SetStateAction<FormDados>>
  periodoInfo: PlanoPeriodo
  loading: boolean
  erro: string
  erroTelefone: string
  onClearErroTelefone: () => void
  onCadastrar: () => void
}) {
  const set = (k: keyof FormDados) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="flex flex-col gap-3">
      {/* Resumo do plano escolhido */}
      <div className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: '#E1F5EE', border: '1px solid #9FE1CB' }}>
        <span className="text-xl">🚗</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#085041' }}>
            {periodoInfo.nome} — R$ {periodoInfo.preco}{periodoInfo.precoLabel}
          </p>
          <p className="text-xs" style={{ color: '#0F6E56' }}>
            10 dias grátis · motoristas ilimitados
          </p>
        </div>
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
          onChange={e => { set('telefone')(e); onClearErroTelefone() }} type="tel"
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

      <button onClick={onCadastrar} disabled={loading}
        className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-1 disabled:opacity-40 active:opacity-80"
        style={{ background: '#1D9E75' }}>
        {loading ? 'Criando conta...' : '🚀 Criar conta e começar trial'}
      </button>

      <p className="text-xs text-gray-400 text-center pb-4">
        Ao criar sua conta você concorda com os termos de uso do RotaGenda.
      </p>

      <style jsx>{`
        .campo-input {
          width: 100%; padding: 10px 12px; border-radius: 12px;
          border: 1px solid #e5e7eb; font-size: 14px; color: #222;
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
