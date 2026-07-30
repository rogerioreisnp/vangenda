'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NotificacoesStatusMotorista from '@/components/NotificacoesStatusMotorista'

export default function MotoristaConfig() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [veiculo, setVeiculo] = useState('')
  const [placa, setPlaca] = useState('')
  const [empresaNome, setEmpresaNome] = useState('')
  const [motEmpresaId, setMotEmpresaId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)

  // Senha
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [alterandoSenha, setAlterandoSenha] = useState(false)
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [okSenha, setOkSenha] = useState<string | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email || '')
    setUserId(user.id)

    const { data: motEmp } = await supabase
      .from('motoristas_empresa')
      .select('id, nome, telefone, veiculo, placa, empresa_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (motEmp) {
      setMotEmpresaId(motEmp.id)
      setNome(motEmp.nome || '')
      setTelefone(motEmp.telefone || '')
      setVeiculo(motEmp.veiculo || '')
      setPlaca(motEmp.placa || '')

      const { data: emp } = await supabase
        .from('empresas').select('nome').eq('id', motEmp.empresa_id).single()
      if (emp) setEmpresaNome(emp.nome || '')
    }
  }

  async function salvarPerfil() {
    if (!motEmpresaId) return
    setSalvando(true)
    setMensagem(null)
    const { error } = await supabase
      .from('motoristas_empresa')
      .update({ nome: nome.trim(), telefone: telefone.trim() })
      .eq('id', motEmpresaId)
    setSalvando(false)
    if (error) {
      setMensagem('Erro ao salvar: ' + error.message)
    } else {
      setMensagem('✓ Perfil atualizado.')
      setTimeout(() => setMensagem(null), 3000)
    }
  }

  async function alterarSenha() {
    setErroSenha(null); setOkSenha(null)
    if (novaSenha.length < 6) { setErroSenha('A nova senha precisa ter no mínimo 6 caracteres.'); return }
    if (novaSenha !== confirmaSenha) { setErroSenha('As senhas não coincidem.'); return }
    setAlterandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setAlterandoSenha(false)
    if (error) {
      setErroSenha('Erro: ' + error.message)
    } else {
      setOkSenha('✓ Senha alterada.')
      setNovaSenha(''); setConfirmaSenha('')
      setTimeout(() => setOkSenha(null), 3000)
    }
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="pb-4">
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4">
        <p style={{ color: '#9FE1CB' }} className="text-xs">Configurações</p>
        <p style={{ color: '#E1F5EE' }} className="text-lg font-bold">Meu perfil</p>
        {empresaNome && (
          <p style={{ color: '#9FE1CB' }} className="text-xs mt-1">
            Motorista da {empresaNome}
          </p>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">

        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados pessoais</p>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Nome</p>
            <input value={nome} onChange={e => setNome(e.target.value)}
              className="campo-input" />
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Telefone</p>
            <input value={telefone} onChange={e => setTelefone(e.target.value)}
              placeholder="(XX) XXXXX-XXXX"
              type="tel" className="campo-input" />
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">E-mail</p>
            <input value={email} readOnly className="campo-input"
              style={{ background: '#f9fafb', color: '#6B7280' }} />
            <p className="text-[10px] text-gray-400 mt-1">
              E-mail é usado pra login. Se precisar alterar, peça pro gestor.
            </p>
          </div>

          {(veiculo || placa) && (
            <div className="rounded-xl p-3" style={{ background: '#f9fafb' }}>
              <p className="text-xs font-semibold text-gray-500 mb-1">Veículo cadastrado</p>
              {veiculo && <p className="text-sm text-gray-700">🚗 {veiculo}</p>}
              {placa && <p className="text-sm text-gray-700">🔖 {placa}</p>}
              <p className="text-[10px] text-gray-400 mt-1">Alterações no veículo são feitas pelo gestor.</p>
            </div>
          )}

          <button onClick={salvarPerfil} disabled={salvando}
            className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: '#0F6E56' }}>
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>

          {mensagem && (
            <p className="text-xs" style={{ color: mensagem.startsWith('✓') ? '#0F6E56' : '#DC2626' }}>
              {mensagem}
            </p>
          )}
        </div>

        {/* Status de notificações push */}
        {userId && <NotificacoesStatusMotorista motoristaId={userId} />}

        {/* Trocar senha */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🔐 Alterar senha</p>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Nova senha</p>
            <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres" className="campo-input" />
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Confirmar nova senha</p>
            <input type="password" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)}
              placeholder="Repita a senha" className="campo-input" />
          </div>

          <button onClick={alterarSenha} disabled={alterandoSenha || !novaSenha || !confirmaSenha}
            className="py-3 rounded-xl text-sm font-semibold border disabled:opacity-40"
            style={{ background: '#E1F5EE', color: '#085041', borderColor: '#9FE1CB' }}>
            {alterandoSenha ? 'Alterando...' : 'Alterar senha'}
          </button>

          {erroSenha && <p className="text-xs" style={{ color: '#DC2626' }}>{erroSenha}</p>}
          {okSenha && <p className="text-xs" style={{ color: '#0F6E56' }}>{okSenha}</p>}
        </div>

        <button onClick={sair}
          className="py-3 rounded-xl text-sm font-semibold mt-2"
          style={{ background: '#fff', color: '#DC2626', border: '1px solid #FECACA' }}>
          Sair da conta
        </button>
      </div>

      <style jsx>{`
        .campo-input {
          width: 100%; padding: 10px 12px; border-radius: 12px;
          border: 1px solid #e5e7eb; font-size: 16px; color: #222;
          background: #fff; outline: none;
        }
        .campo-input:focus { border-color: #0F6E56; }
      `}</style>
    </div>
  )
}
