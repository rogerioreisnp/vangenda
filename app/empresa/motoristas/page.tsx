'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Motorista = {
  id: string
  user_id: string | null
  nome: string
  telefone: string | null
  veiculo: string | null
  placa: string | null
  cor: string | null
  status: string
  percentual_repasse: number | null
  modo_repasse: 'percentual' | 'valor_fixo' | null
  valor_fixo_repasse: number | null
  veiculos?: VeiculoMotorista[]
}

type VeiculoMotorista = {
  id?: string
  veiculo: string
  placa: string
  cor: string
}

const VEICULO_VAZIO: VeiculoMotorista = { veiculo: '', placa: '', cor: '' }
const MAX_VEICULOS = 5

type FormMotorista = {
  nome: string
  email: string
  senha: string
  telefone: string
  modo_repasse: '' | 'percentual' | 'valor_fixo'  // '' = motorista sem repasse
  percentual_repasse: string  // input string, converte no save
  valor_fixo_repasse: string
  veiculos: VeiculoMotorista[]
}

export default function MotoristasPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Motorista | null>(null)
  const [form, setForm] = useState<FormMotorista>({ nome: '', email: '', senha: '', telefone: '', modo_repasse: '', percentual_repasse: '', valor_fixo_repasse: '', veiculos: [{ ...VEICULO_VAZIO }] })
  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
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
      .select('id')
      .eq('id', gestor.empresa_id)
      .single()

    if (!empresa) return

    setEmpresaId(empresa.id)

    const { data: mots } = await supabase
      .from('motoristas_empresa')
      .select('id, user_id, nome, telefone, veiculo, placa, cor, status, percentual_repasse, modo_repasse, valor_fixo_repasse, veiculos_motorista(id, veiculo, placa, cor, ordem)')
      .eq('empresa_id', empresa.id)
      .order('created_at')

    if (mots) {
      setMotoristas(mots.map((m: any) => ({
        ...m,
        veiculos: (m.veiculos_motorista || []).sort((a: any, b: any) => a.ordem - b.ordem),
      })))
    }
    setLoading(false)
  }

  function abrirAdicionar() {
    setEditando(null)
    setForm({ nome: '', email: '', senha: '', telefone: '', modo_repasse: '', percentual_repasse: '', valor_fixo_repasse: '', veiculos: [{ ...VEICULO_VAZIO }] })
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(m: Motorista) {
    setEditando(m)
    const veiculosCarregados = (m.veiculos && m.veiculos.length > 0)
      ? m.veiculos.map(v => ({ id: v.id, veiculo: v.veiculo || '', placa: v.placa || '', cor: v.cor || '' }))
      : [{ ...VEICULO_VAZIO }]
    setForm({
      nome: m.nome,
      email: '',
      senha: '',
      telefone: m.telefone || '',
      modo_repasse: m.modo_repasse ?? (m.percentual_repasse != null ? 'percentual' : ''),
      percentual_repasse: m.percentual_repasse != null ? String(m.percentual_repasse) : '',
      valor_fixo_repasse: m.valor_fixo_repasse != null ? String(m.valor_fixo_repasse) : '',
      veiculos: veiculosCarregados,
    })
    setErro('')
    setModalAberto(true)
  }

  async function salvar() {
    if (salvandoRef.current) return // guard contra double-fire antes do re-render
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    if (!empresaId) return

    salvandoRef.current = true
    setSalvando(true)
    setErro('')

    try {
      if (editando) {
        if (form.senha && form.senha.length < 6) {
          setErro('A nova senha deve ter no mínimo 6 caracteres')
          return
        }

        // Veículo principal (colunas legadas) = primeiro da lista, mantém
        // compatibilidade com mensagem de WhatsApp / tela do motorista.
        const veiculosValidos = form.veiculos.filter(v => v.veiculo.trim() || v.placa.trim() || v.cor.trim())
        const principal = veiculosValidos[0]

        // Repasse: se modo=percentual, usa percentual (0-100). Se modo=valor_fixo,
        // usa valor_fixo (>=0). Se modo='', motorista nao tem repasse (funcionario).
        let pctNum: number | null = null
        let valorFixoNum: number | null = null
        if (form.modo_repasse === 'percentual') {
          const raw = form.percentual_repasse.replace(',', '.').trim()
          pctNum = raw ? parseFloat(raw) : null
          if (pctNum !== null && (isNaN(pctNum) || pctNum < 0 || pctNum > 100)) {
            setErro('Percentual de repasse deve estar entre 0 e 100')
            return
          }
        }
        // modo=valor_fixo (valor combinado por corrida) nao guarda valor default —
        // gestor digita a cada atendimento. Nada a validar aqui.

        const { error } = await supabase
          .from('motoristas_empresa')
          .update({
            nome: form.nome.trim(),
            telefone: form.telefone.trim() || null,
            veiculo: principal?.veiculo.trim() || null,
            placa: principal?.placa.trim() || null,
            cor: principal?.cor.trim() || null,
            modo_repasse: form.modo_repasse || null,
            percentual_repasse: pctNum,
            valor_fixo_repasse: valorFixoNum,
          })
          .eq('id', editando.id)

        if (error) { setErro('Erro ao salvar: ' + error.message); return }

        // Sincroniza veiculos_motorista: apaga tudo e reinsere (volume baixo,
        // máx 5 — mesmo padrão usado em paradas_empresa pra rotas).
        await supabase.from('veiculos_motorista').delete().eq('motorista_empresa_id', editando.id)
        if (veiculosValidos.length > 0) {
          const { error: errVeiculos } = await supabase.from('veiculos_motorista').insert(
            veiculosValidos.map((v, i) => ({
              motorista_empresa_id: editando.id,
              veiculo: v.veiculo.trim() || null,
              placa: v.placa.trim() || null,
              cor: v.cor.trim() || null,
              ordem: i,
            }))
          )
          if (errVeiculos) { setErro('Erro ao salvar veículos: ' + errVeiculos.message); return }
        }

        if (form.email.trim() || form.senha) {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { setErro('Sessão expirada. Recarregue a página.'); return }

          const res = await fetch('/api/empresa/motoristas/atualizar', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              motoristaEmpresaId: editando.id,
              novoEmail: form.email.trim() || undefined,
              novaSenha: form.senha || undefined,
            }),
          })

          const json = await res.json()
          if (!res.ok) { setErro(json.error || 'Erro ao atualizar credenciais'); return }
        }
      } else {
        if (!form.email.trim()) { setErro('E-mail é obrigatório'); return }
        if (!form.senha) { setErro('Senha é obrigatória'); return }
        if (form.senha.length < 6) { setErro('A senha deve ter no mínimo 6 caracteres'); return }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setErro('Sessão expirada. Recarregue a página.'); return }

        const res = await fetch('/api/empresa/motoristas/criar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            nome: form.nome.trim(),
            email: form.email.trim(),
            senha: form.senha,
            telefone: form.telefone.trim() || null,
            veiculos: form.veiculos
              .filter(v => v.veiculo.trim() || v.placa.trim() || v.cor.trim())
              .map(v => ({ veiculo: v.veiculo.trim() || null, placa: v.placa.trim() || null, cor: v.cor.trim() || null })),
          }),
        })

        const json = await res.json()
        if (!res.ok) { setErro(json.error || 'Erro ao adicionar motorista'); return }
      }

      setModalAberto(false)
      carregarDados()
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  async function inativar(id: string) {
    await supabase
      .from('motoristas_empresa')
      .update({ status: 'inativo' })
      .eq('id', id)
    carregarDados()
  }

  async function ativar(id: string) {
    await supabase
      .from('motoristas_empresa')
      .update({ status: 'ativo' })
      .eq('id', id)
    carregarDados()
  }

  async function excluir(m: Motorista) {
    const ok = confirm(
      `Excluir "${m.nome}" da lista de motoristas?\n\n` +
      `• O cadastro dele será removido da sua empresa.\n` +
      `• O histórico de corridas e o financeiro serão preservados.\n\n` +
      `Esta ação não pode ser desfeita.`
    )
    if (!ok) return
    const { error } = await supabase
      .from('motoristas_empresa')
      .delete()
      .eq('id', m.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    carregarDados()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
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

  const motAtivos = motoristas.filter(m => m.status === 'ativo')
  const motInativos = motoristas.filter(m => m.status === 'inativo')

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Motoristas</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">
            {motAtivos.length} ativo{motAtivos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        <button
          onClick={abrirAdicionar}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#1D9E75', color: '#fff' }}>
          + Adicionar motorista
        </button>

        {motAtivos.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
            <svg width="48" height="48" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="mb-2 mx-auto">
              <rect width="192" height="192" rx="42" fill="#04342C"/>
              <text x="96" y="148" fontFamily="Arial,sans-serif" fontSize="90" fontWeight="700" fill="white" textAnchor="middle">RG</text>
              <ellipse cx="158" cy="38" rx="22" ry="22" fill="none" stroke="#5DCAA5" strokeWidth="8"/>
              <ellipse cx="158" cy="33" rx="11" ry="11" fill="#5DCAA5"/>
              <polygon points="145,56 171,56 158,76" fill="none" stroke="#5DCAA5" strokeWidth="8" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm text-gray-500">Nenhum motorista cadastrado ainda.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {motAtivos.map(m => (
              <div key={m.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{m.nome}</p>
                    {m.telefone && (
                      <p className="text-xs text-gray-400 mt-0.5">{m.telefone}</p>
                    )}
                    {(m.veiculos && m.veiculos.length > 0) ? (
                      <div className="mt-0.5">
                        <p className="text-xs text-gray-400">
                          {[m.veiculos[0].veiculo, m.veiculos[0].cor, m.veiculos[0].placa].filter(Boolean).join(' · ')}
                        </p>
                        {m.veiculos.length > 1 && (
                          <p className="text-[10px] text-gray-400">+ {m.veiculos.length - 1} veículo{m.veiculos.length - 1 !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                    ) : (m.veiculo || m.placa || m.cor) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[m.veiculo, m.cor, m.placa].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => abrirEditar(m)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                      Editar
                    </button>
                    <button
                      onClick={() => inativar(m.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                      Inativar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {motInativos.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Inativos</p>
            <div className="flex flex-col gap-2">
              {motInativos.map(m => (
                <div key={m.id} className="bg-white rounded-2xl p-4 border border-gray-100 opacity-70">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-500">{m.nome}</p>
                      {m.telefone && <p className="text-xs text-gray-400 mt-0.5">{m.telefone}</p>}
                      {(m.veiculo || m.placa) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[m.veiculo, m.placa].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => ativar(m.id)}
                        title="Reativar motorista"
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                        Reativar
                      </button>
                      <button
                        onClick={() => excluir(m)}
                        title="Excluir motorista"
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff' }}>
          <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setModalAberto(false)} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
            <div>
              <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">
                {editando ? 'Editar motorista' : 'Novo motorista'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 flex flex-col gap-3">
            <Campo label="Nome *">
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo" className="campo-input" />
            </Campo>

            <Campo label={editando ? 'Novo e-mail do motorista' : 'E-mail do motorista *'}>
              {/* autoComplete="off" + name customizado bloqueia o navegador de
                  auto-preencher com o email do gestor logado — bug reportado
                  pelo Rogério onde o campo aparecia com o email do Pedro
                  Transporte em toda edição. type="text" (não email) reforça. */}
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder={editando ? 'Deixe em branco para manter o atual' : 'motorista@email.com'}
                type="text" inputMode="email"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                name="motorista_email_novo"
                className="campo-input" />
              {editando && (
                <p className="text-[10px] text-gray-400 mt-1">
                  O e-mail atual do motorista continua salvo. Digite aqui só se quiser trocar por outro.
                </p>
              )}
            </Campo>

            <Campo label={editando ? 'Nova senha' : 'Senha provisória *'}>
              <input value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                placeholder={editando ? 'Deixe em branco para manter a atual' : 'Mínimo 6 caracteres'}
                type="password"
                autoComplete="new-password"
                name="motorista_senha_nova"
                className="campo-input" />
            </Campo>

            <Campo label="Telefone">
              <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(XX) XXXXX-XXXX" className="campo-input" />
            </Campo>

            {/* Repasse ao motorista parceiro — 3 modos possiveis. Auto-preenche
                o valor de repasse quando atribuido a um atendimento conforme
                o modo escolhido. */}
            <Campo label="Modo de repasse (motorista parceiro)">
              <select value={form.modo_repasse}
                onChange={e => setForm(f => ({ ...f, modo_repasse: e.target.value as any }))}
                className="campo-input">
                <option value="">Sem repasse (motorista funcionário)</option>
                <option value="percentual">% Porcentagem do valor da corrida</option>
                <option value="valor_fixo">R$ Valor combinado por corrida</option>
              </select>
            </Campo>

            {form.modo_repasse === 'percentual' && (
              <Campo label="Percentual (%)">
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={100} step={0.01}
                    value={form.percentual_repasse}
                    onChange={e => setForm(f => ({ ...f, percentual_repasse: e.target.value }))}
                    placeholder="Ex: 70"
                    className="campo-input flex-1" />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Corrida de R$ 100 com 70% = motorista recebe R$ 70. Auto-calcula ao atribuir.
                </p>
              </Campo>
            )}

            {form.modo_repasse === 'valor_fixo' && (
              <div className="rounded-xl p-3" style={{ background: '#FEF9E7', border: '1px solid #FAC775' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#854F0B' }}>
                  💡 Sobre "Valor combinado por corrida"
                </p>
                <p className="text-[11px]" style={{ color: '#854F0B' }}>
                  Cada corrida terá seu valor de repasse próprio (combinado com o motorista
                  no momento). Você digita esse valor a cada atendimento. Nada é salvo aqui
                  como padrão — evita erros de cobrar/repassar valor errado.
                </p>
              </div>
            )}

            {/* Lista repetível de veículos — motorista pode ter mais de um
                carro (próprio + cedido pela empresa, ou terceirizado com
                frota própria). Limite de 5 evita cadastro descontrolado.
                Mesmo padrão visual do "+ Adicionar passageiro" no transfer. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Veículos</p>
                {form.veiculos.length < MAX_VEICULOS && (
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, veiculos: [...f.veiculos, { ...VEICULO_VAZIO }] }))}
                    className="text-xs font-semibold" style={{ color: '#1D9E75' }}>
                    + Adicionar veículo
                  </button>
                )}
              </div>

              {form.veiculos.map((v, idx) => (
                <div key={idx} className="rounded-xl border border-gray-100 p-3 flex flex-col gap-2" style={{ background: '#f9f9f7' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Veículo {idx + 1}
                    </span>
                    {form.veiculos.length > 1 && (
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, veiculos: f.veiculos.filter((_, i) => i !== idx) }))}
                        className="text-xs font-semibold text-red-500">
                        − Remover
                      </button>
                    )}
                  </div>
                  <input value={v.veiculo}
                    onChange={e => setForm(f => ({ ...f, veiculos: f.veiculos.map((vv, i) => i === idx ? { ...vv, veiculo: e.target.value } : vv) }))}
                    placeholder="Ex: Van Sprinter" className="campo-input" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={v.placa}
                      onChange={e => setForm(f => ({ ...f, veiculos: f.veiculos.map((vv, i) => i === idx ? { ...vv, placa: e.target.value } : vv) }))}
                      placeholder="Placa: ABC-1234" className="campo-input" />
                    <input value={v.cor}
                      onChange={e => setForm(f => ({ ...f, veiculos: f.veiculos.map((vv, i) => i === idx ? { ...vv, cor: e.target.value } : vv) }))}
                      placeholder="Cor" className="campo-input" />
                  </div>
                </div>
              ))}

              {form.veiculos.length >= MAX_VEICULOS && (
                <p className="text-[10px] text-gray-400">Limite de {MAX_VEICULOS} veículos por motorista.</p>
              )}
            </div>

            {erro && (
              <div className="rounded-xl px-4 py-3 text-sm border"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C' }}>
                ⚠️ {erro}
              </div>
            )}

            <button onClick={salvar} disabled={salvando}
              className="w-full py-3.5 rounded-xl text-white text-sm font-semibold mt-2 disabled:opacity-40"
              style={{ background: '#1D9E75' }}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar motorista'}
            </button>
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
      )}
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
