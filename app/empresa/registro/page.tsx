'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Periodo = 'mensal' | 'semestral' | 'anual'
type Plano = 'starter' | 'pro' | 'business'
type Etapa = 'plano' | 'dados'

const PRECOS: Record<Plano, Record<Periodo, number>> = {
  starter:  { mensal: 97,  semestral: 87,  anual: 77  },
  pro:      { mensal: 197, semestral: 177, anual: 157 },
  business: { mensal: 297, semestral: 267, anual: 237 },
}

const PROMO_ANUAL: Record<Plano, { original: number; promo: number; economia: number; mensalEquiv: string }> = {
  starter:  { original: 924,  promo: 847,  economia: 77,  mensalEquiv: '70,58' },
  pro:      { original: 1884, promo: 1786, economia: 98,  mensalEquiv: '148,83' },
  business: { original: 2844, promo: 2697, economia: 147, mensalEquiv: '224,75' },
}

const PLANOS = [
  {
    id: 'starter' as Plano,
    nome: 'Starter',
    descricao: 'Para operações pequenas',
    limite: 'Até 3 motoristas',
    emoji: '🚐',
    destaque: false,
  },
  {
    id: 'pro' as Plano,
    nome: 'Pro',
    descricao: 'Para empresas em crescimento',
    limite: 'Até 8 motoristas',
    emoji: '⭐',
    destaque: true,
  },
  {
    id: 'business' as Plano,
    nome: 'Business',
    descricao: 'Para grandes operações',
    limite: 'Ilimitado',
    emoji: '🏢',
    destaque: false,
  },
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
  const [periodo, setPeriodo] = useState<Periodo>('mensal')
  const [plano, setPlano]   = useState<Plano | null>(null)
  const [form, setForm]     = useState<FormDados>(FORM_VAZIO)
  const [loading, setLoading] = useState(false)
  const [erro, setErro]     = useState('')
  const [erroTelefone, setErroTelefone] = useState('')

  function escolherPlano(p: Plano) {
    setPlano(p)
    setEtapa('dados')
    setErro('')
    window.scrollTo(0, 0)
  }

  async function cadastrar() {
    if (!plano) return
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
        options: { data: { nome: form.nome.trim() } },
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
          plano,
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

  const planoInfo = plano ? PLANOS.find(p => p.id === plano)! : null

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
              {etapa === 'plano' ? 'RotaGenda Empresarial' : planoInfo ? `Plano ${planoInfo.nome} selecionado` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 pb-16">
        {etapa === 'plano' ? (
          <EtapaPlano periodo={periodo} setPeriodo={setPeriodo} onEscolher={escolherPlano} />
        ) : (
          <EtapaDados
            form={form}
            setForm={setForm}
            plano={plano!}
            periodo={periodo}
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

/* ─── Etapa 1: Seleção de plano ─── */

function EtapaPlano({
  periodo, setPeriodo, onEscolher,
}: {
  periodo: Periodo
  setPeriodo: (p: Periodo) => void
  onEscolher: (p: Plano) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Banner trial */}
      <div className="rounded-xl px-4 py-3 text-center"
        style={{ background: '#E1F5EE', border: '1px solid #9FE1CB' }}>
        <p className="text-sm font-semibold" style={{ color: '#085041' }}>
          🎉 15 dias de trial grátis em todos os planos
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#0F6E56' }}>
          Sem cartão de crédito. Cancele quando quiser.
        </p>
      </div>

      {/* Toggle período */}
      <div>
        <p className="text-xs font-semibold text-center mb-2 uppercase tracking-widest" style={{ color: '#0F6E56' }}>
          Período de cobrança
        </p>
        <div className="rounded-2xl p-1.5 flex border-2" style={{ background: '#E1F5EE', borderColor: '#0F6E56' }}>
          {(['mensal', 'semestral', 'anual'] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className="flex-1 py-2.5 rounded-xl font-bold transition-all flex flex-col items-center gap-1"
              style={periodo === p
                ? { background: '#0F6E56', color: '#fff' }
                : { background: 'transparent', color: '#555' }}>
              <span className="text-xs">{p === 'mensal' ? 'Mensal' : p === 'semestral' ? 'Semestral' : 'Anual'}</span>
              <span
                className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                style={p === 'mensal'
                  ? { visibility: 'hidden' }
                  : periodo === p
                    ? { background: '#9FE1CB', color: '#085041' }
                    : { background: '#fff', color: '#0F6E56' }}>
                {p === 'semestral' ? '−10%' : '2 meses grátis'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cards de plano */}
      {PLANOS.map(pl => {
        const preco = PRECOS[pl.id][periodo]
        return (
          <div key={pl.id} className="bg-white rounded-2xl border overflow-hidden"
            style={{
              borderColor: pl.destaque ? '#0F6E56' : '#e5e7eb',
              boxShadow:   pl.destaque ? '0 4px 16px rgba(15,110,86,0.14)' : '0 1px 4px rgba(0,0,0,0.05)',
            }}>
            {pl.destaque && (
              <div className="py-1.5 text-center text-xs font-bold tracking-wide"
                style={{ background: '#0F6E56', color: '#E1F5EE' }}>
                ⭐ MAIS ESCOLHIDO
              </div>
            )}
            {periodo === 'anual' && (
              <div className="py-1.5 text-center text-xs font-bold tracking-wide"
                style={{ background: '#FED7AA', color: '#C2410C' }}>
                🎁 2 meses grátis
              </div>
            )}
            <div className="p-5">
              {/* Cabeçalho do plano */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-base font-bold text-gray-800">{pl.nome}</p>
                  <p className="text-xs text-gray-400">{pl.descricao}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs line-through text-gray-400 leading-none mb-0.5"
                    style={{ visibility: periodo === 'mensal' ? 'hidden' : 'visible' }}>
                    R$ {PRECOS[pl.id]['mensal']}/mês
                  </p>
                  <p className="text-2xl font-bold leading-none" style={{ color: '#0F6E56' }}>
                    R$ {preco}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    /mês{periodo !== 'mensal' ? ` · cobrado ${periodo}` : ''}
                  </p>
                </div>
              </div>
              {periodo === 'anual' ? (
                <div className="mb-3 rounded-xl p-3" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: '#C2410C' }}>
                    🎉 Promoção de lançamento — pague 10, use 12
                  </p>
                  <div className="flex justify-between text-xs" style={{ color: '#92400E' }}>
                    <span>10 meses × R$ {PRECOS[pl.id]['anual']}</span>
                    <span>R$ {PRECOS[pl.id]['anual'] * 10}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold mt-0.5" style={{ color: '#0F6E56' }}>
                    <span>+ 2 meses grátis</span>
                    <span>R$ 0</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold mt-1.5 pt-1.5"
                    style={{ borderTop: '1px solid #FED7AA', color: '#C2410C' }}>
                    <span>Total anual</span>
                    <span>R$ {PRECOS[pl.id]['anual'] * 10}</span>
                  </div>
                  <p className="text-[10px] mt-1.5" style={{ color: '#92400E' }}>
                    Você economiza R$ {PRECOS[pl.id]['mensal'] * 12 - PRECOS[pl.id]['anual'] * 10} vs pagar mês a mês
                  </p>
                </div>
              ) : periodo === 'semestral' ? (
                <div className="mb-3 rounded-xl px-3 py-2.5" style={{ background: '#E1F5EE', border: '1px solid #9FE1CB' }}>
                  <p className="text-xs font-semibold" style={{ color: '#085041' }}>
                    💰 Você economiza R$ {(PRECOS[pl.id]['mensal'] - preco) * 6} comparado ao plano mensal
                  </p>
                </div>
              ) : null}

              {/* Limite */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl"
                style={{ background: '#f9fafb' }}>
                <span className="text-base">{pl.emoji}</span>
                <span className="text-xs font-medium text-gray-700">{pl.limite}</span>
              </div>

              <button onClick={() => onEscolher(pl.id)}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity active:opacity-75"
                style={pl.destaque
                  ? { background: '#0F6E56', color: '#fff' }
                  : { background: '#E1F5EE', color: '#0F6E56' }}>
                Começar trial grátis →
              </button>
            </div>
          </div>
        )
      })}

      {periodo === 'anual' && (
        <p className="text-xs text-center px-2" style={{ color: '#92400E' }}>
          ⏳ Promoção válida por tempo limitado para os primeiros clientes. Após contratar, o preço fica garantido.
        </p>
      )}
      <div className="text-center py-2">
        <p className="text-xs text-gray-400">
          Já tem uma conta?{' '}
          <Link href="/" className="font-semibold" style={{ color: '#0F6E56' }}>
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  )
}

/* ─── Etapa 2: Dados da empresa e conta ─── */

function EtapaDados({
  form, setForm, plano, periodo, loading, erro, erroTelefone, onClearErroTelefone, onCadastrar,
}: {
  form: FormDados
  setForm: React.Dispatch<React.SetStateAction<FormDados>>
  plano: Plano
  periodo: Periodo
  loading: boolean
  erro: string
  erroTelefone: string
  onClearErroTelefone: () => void
  onCadastrar: () => void
}) {
  const set = (k: keyof FormDados) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const planoInfo = PLANOS.find(p => p.id === plano)!
  const preco     = PRECOS[plano][periodo]

  return (
    <div className="flex flex-col gap-3">
      {/* Resumo do plano escolhido */}
      <div className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: '#E1F5EE', border: '1px solid #9FE1CB' }}>
        <span className="text-xl">{planoInfo.emoji}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#085041' }}>
            Plano {planoInfo.nome} — R$ {preco}/mês
          </p>
          <p className="text-xs" style={{ color: '#0F6E56' }}>
            15 dias grátis · {planoInfo.limite}
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
