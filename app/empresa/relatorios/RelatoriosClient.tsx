'use client'
/**
 * Relatorio consolidado por cliente + periodo. Fase 4.3 do projeto
 * vouchers/recibos/relatorios do Julimar.
 *
 * Fluxo:
 * 1. Gestor seleciona cliente cadastrado (dropdown)
 * 2. Escolhe periodo (data inicial + final)
 * 3. Ve preview: lista dos atendimentos + total
 * 4. Baixa PDF ou Excel — dois formatos porque contador quer Excel e
 *    dono/gestor do cliente PJ prefere PDF pra visao rapida.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { ReciboConsolidadoPDF, type LinhaConsolidado, type LinhaReembolso } from '@/components/ReciboConsolidadoPDF'
import { baixarRelatorioExcel } from '@/lib/gerar-relatorio-excel'
import type { VoucherEmpresa } from '@/components/VoucherPDF'

type Cliente = {
  id: string
  tipo: 'pj' | 'pf'
  razao_social: string | null
  nome_fantasia: string | null
  nome: string | null
  cnpj: string | null
  cpf: string | null
  telefone: string | null
  email: string | null
  endereco_rua: string | null
  endereco_numero: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
  endereco_cep: string | null
}

type Corrida = {
  id: string
  numero_reserva: number | null
  origem: string
  destino: string
  data_hora: string
  cliente_id: string | null
  cliente_nome: string
  passageiro1_nome: string | null
  valor: number
  status: string
}

function fmt(iso: string): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ''
}
function nomeExibicao(c: Cliente): string {
  if (c.tipo === 'pj') return c.nome_fantasia || c.razao_social || 'Sem nome'
  return c.nome || 'Sem nome'
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RelatoriosPage() {
  const [empresa, setEmpresa] = useState<VoucherEmpresa | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [corridas, setCorridas] = useState<Corrida[]>([])
  const [reembolsos, setReembolsos] = useState<LinhaReembolso[]>([])
  const [clienteId, setClienteId] = useState<string>('')
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date(); d.setDate(1)
    return toIso(d)
  })
  const [dataFim, setDataFim] = useState<string>(() => toIso(new Date()))
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState<null | 'pdf' | 'excel'>(null)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])
  useEffect(() => { if (empresaId) carregarCorridas() }, [empresaId, clienteId, dataInicio, dataFim])

  async function carregar() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: gestor } = await supabase.from('gestores').select('empresa_id').eq('user_id', session.user.id).single()
    if (!gestor) { setLoading(false); return }
    setEmpresaId(gestor.empresa_id)

    const [{ data: emp }, { data: cls }] = await Promise.all([
      supabase.from('empresas')
        .select('nome, descricao, cnpj, inscricao_estadual, logo_url, telefone, email_comercial, whatsapp_comercial, instagram, site, endereco_rua, endereco_numero, endereco_bairro, endereco_cep, cidade, estado, chave_pix, tipo_chave_pix, banco_nome, banco_agencia, banco_conta, banco_tipo_conta, banco_titular_nome, banco_titular_documento')
        .eq('id', gestor.empresa_id).single(),
      supabase.from('clientes_empresa').select('*').eq('empresa_id', gestor.empresa_id).eq('ativo', true).order('atualizado_em', { ascending: false }),
    ])
    if (emp) setEmpresa(emp as any)
    if (cls) setClientes(cls as Cliente[])
    setLoading(false)
  }

  async function carregarCorridas() {
    if (!empresaId) return
    let q = supabase.from('corridas_empresa')
      .select('id, numero_reserva, origem, destino, data_hora, cliente_id, cliente_nome, passageiro1_nome, valor, status')
      .eq('empresa_id', empresaId)
      .neq('status', 'cancelada')
      .gte('data_hora', `${dataInicio}T00:00:00`)
      .lte('data_hora', `${dataFim}T23:59:59`)
      .order('data_hora', { ascending: true })
      .limit(500)
    if (clienteId) q = q.eq('cliente_id', clienteId)
    const { data: cds } = await q
    const listaCorridas = (cds as Corrida[]) ?? []
    setCorridas(listaCorridas)

    // Reembolsos: despesas reembolsaveis A COBRAR (reembolsado_em IS NULL)
    // vinculadas as corridas do filtro. Filtro por cliente vem via corrida_id
    // das corridas ja carregadas.
    const corridaIds = listaCorridas.map(c => c.id)
    if (corridaIds.length === 0) {
      setReembolsos([])
      return
    }
    const { data: reemb } = await supabase
      .from('despesas_empresa')
      .select('id, corrida_id, data, categoria, descricao, valor')
      .eq('empresa_id', empresaId)
      .eq('reembolsavel', true)
      .is('reembolsado_em', null)
      .in('corrida_id', corridaIds)
      .order('data', { ascending: true })
    const mapaCorridas: Record<string, Corrida> = {}
    listaCorridas.forEach(c => { mapaCorridas[c.id] = c })
    setReembolsos(((reemb as any[]) ?? []).map(r => {
      const c = r.corrida_id ? mapaCorridas[r.corrida_id] : null
      const num = c ? (c.numero_reserva ? String(c.numero_reserva) : c.id.slice(-5).toUpperCase()) : null
      return {
        data: r.data,
        descricao: r.descricao || '(sem descrição)',
        categoria: r.categoria,
        atendimento_numero: num,
        valor: Number(r.valor) || 0,
      }
    }))
  }

  const cliente = clientes.find(c => c.id === clienteId) || null
  const linhas: LinhaConsolidado[] = corridas.map(c => ({
    numero: c.numero_reserva ? String(c.numero_reserva) : c.id.slice(-5).toUpperCase(),
    data_hora: c.data_hora,
    origem: c.origem,
    destino: c.destino,
    passageiro: c.passageiro1_nome || null,
    valor: Number(c.valor) || 0,
  }))
  const totalAtendimentos = linhas.reduce((s, l) => s + l.valor, 0)
  const totalReembolsos = reembolsos.reduce((s, r) => s + r.valor, 0)
  const total = totalAtendimentos + totalReembolsos

  function montarClientePayload() {
    if (!cliente) {
      // Se filtro vazio (todos clientes), monta cliente generico "Diversos"
      return { nome: 'Diversos', telefone: null, email: null, endereco_linha: null }
    }
    const endereco = [
      [cliente.endereco_rua, cliente.endereco_numero].filter(Boolean).join(', '),
      cliente.endereco_bairro,
      [cliente.endereco_cidade, cliente.endereco_estado].filter(Boolean).join('-'),
    ].filter(Boolean).join(', ')
    const documento = cliente.tipo === 'pj' ? cliente.cnpj : cliente.cpf
    return {
      nome: nomeExibicao(cliente) + (documento ? ` (${cliente.tipo === 'pj' ? 'CNPJ' : 'CPF'} ${documento})` : ''),
      telefone: cliente.telefone,
      email: cliente.email,
      endereco_linha: endereco || null,
    }
  }

  async function baixarPDF() {
    if (!empresa) return
    setErro(''); setGerando('pdf')
    try {
      const blob = await pdf(
        <ReciboConsolidadoPDF
          empresa={empresa}
          cliente={montarClientePayload()}
          periodo={{ inicio: dataInicio, fim: dataFim }}
          linhas={linhas}
          reembolsos={reembolsos}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const nomeCli = (cliente ? nomeExibicao(cliente) : 'diversos').replace(/[^a-zA-Z0-9]/g, '_')
      a.href = url
      a.download = `relatorio-${nomeCli}-${dataInicio}-a-${dataFim}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setErro(e?.message || 'Erro ao gerar PDF')
    } finally { setGerando(null) }
  }

  async function baixarExcel() {
    if (!empresa) return
    setErro(''); setGerando('excel')
    try {
      await baixarRelatorioExcel({
        empresa,
        cliente: montarClientePayload(),
        periodo: { inicio: dataInicio, fim: dataFim },
        linhas,
        reembolsos,
      })
    } catch (e: any) {
      setErro(e?.message || 'Erro ao gerar Excel')
    } finally { setGerando(null) }
  }

  return (
    <div>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/empresa" style={{ color: '#9FE1CB' }} className="text-2xl leading-none flex-shrink-0">‹</Link>
        <div className="flex-1 min-w-0">
          <p style={{ color: '#E1F5EE' }} className="text-base font-semibold">Relatórios</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs mt-0.5">Consolidado de atendimentos por cliente + período</p>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Cliente</p>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600">
              <option value="">Todos os clientes</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.tipo === 'pj' ? '🏢' : '👤'} {nomeExibicao(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">De</p>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Até</p>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                min={dataInicio}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">
                {linhas.length} atendimento{linhas.length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-gray-700">
                R$ {totalAtendimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            {reembolsos.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: '#854F0B' }}>
                  🔄 + {reembolsos.length} reembolso{reembolsos.length !== 1 ? 's' : ''} a cobrar
                </p>
                <p className="text-xs" style={{ color: '#854F0B' }}>
                  R$ {totalReembolsos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 mt-0.5" style={{ borderTop: '1px solid #f0f0f0' }}>
              <p className="text-sm font-semibold text-gray-800">Total a cobrar</p>
              <p className="text-lg font-bold" style={{ color: '#0F6E56' }}>
                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-6">Carregando...</p>
          ) : linhas.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">
              Nenhum atendimento no filtro selecionado.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {linhas.slice(0, 30).map((l, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 truncate">
                      <span className="font-mono text-gray-400">{l.numero}</span>
                      {' · '}{l.origem} → {l.destino}
                    </p>
                    <p className="text-[10px] text-gray-400">{fmt(l.data_hora)}{l.passageiro ? ` · ${l.passageiro}` : ''}</p>
                  </div>
                  <p className="font-semibold text-gray-700 flex-shrink-0 ml-2">
                    R$ {l.valor.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              ))}
              {linhas.length > 30 && (
                <p className="text-[10px] text-gray-400 text-center py-2">
                  + {linhas.length - 30} atendimento{linhas.length - 30 !== 1 ? 's' : ''} no relatório completo
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={baixarPDF} disabled={gerando !== null || linhas.length === 0}
            className="py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#0F6E56', color: '#fff' }}>
            {gerando === 'pdf' ? 'Gerando...' : '📄 Baixar PDF'}
          </button>
          <button onClick={baixarExcel} disabled={gerando !== null || linhas.length === 0}
            className="py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#1D9E75', color: '#fff' }}>
            {gerando === 'excel' ? 'Gerando...' : '📊 Baixar Excel'}
          </button>
        </div>

        {erro && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{erro}</p>}

        <p className="text-[10px] text-gray-400 text-center mt-2">
          Cadastre clientes em <Link href="/empresa/clientes" className="underline" style={{ color: '#0F6E56' }}>Clientes</Link> pra filtrar aqui.
        </p>
      </div>
    </div>
  )
}
