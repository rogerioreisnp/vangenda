/**
 * Relatorio consolidado PDF — Julimar filtra atendimentos por cliente PJ
 * (ou PF) + periodo, gera um documento formal pra cobrar. Padrao fatura
 * mensal.
 *
 * Diferenca vs Recibo individual: aqui e MULTIPLOS atendimentos agrupados.
 * Tabela de servicos com linha por atendimento + total geral.
 */
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { valorPorExtenso } from '@/lib/valor-por-extenso'
import type { VoucherEmpresa, VoucherCliente } from './VoucherPDF'

export type LinhaConsolidado = {
  numero: string | null
  data_hora: string
  origem: string
  destino: string
  passageiro?: string | null
  valor: number
}

export type LinhaReembolso = {
  data: string  // yyyy-mm-dd
  descricao: string
  categoria?: string | null
  atendimento_numero?: string | null
  valor: number
}

export type ReciboConsolidadoProps = {
  empresa: VoucherEmpresa
  cliente: VoucherCliente
  periodo: { inicio: string; fim: string }  // yyyy-mm-dd
  linhas: LinhaConsolidado[]
  reembolsos?: LinhaReembolso[]  // despesas reembolsaveis a cobrar
}

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtData = (iso: string) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ''

const AZUL = '#0F6E56'
const CINZA_BG = '#F5F6F8'
const CINZA_BORDA = '#D9DCE3'
const CINZA_TXT = '#6B7280'

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Helvetica', fontSize: 9, color: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  logo: { width: 40, height: 40 },
  empresaNome: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  empresaSub: { fontSize: 8, color: CINZA_TXT, marginTop: 1 },
  tag: {
    backgroundColor: AZUL, color: '#fff', paddingVertical: 5, paddingHorizontal: 12,
    fontFamily: 'Helvetica-Bold', fontSize: 10,
  },
  subtag: { fontSize: 8, color: CINZA_TXT, marginTop: 3, textAlign: 'right' },

  faixa: { backgroundColor: CINZA_BG, padding: 5, marginTop: 8, marginBottom: 5 },
  faixaTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 10 },

  label: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  valor: { fontSize: 9, color: '#333' },
  bloco2col: { flexDirection: 'row', gap: 20, paddingVertical: 3 },
  coluna: { flex: 1 },

  // Tabela
  thead: {
    flexDirection: 'row',
    backgroundColor: AZUL,
    color: '#fff',
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
  trow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottom: `0.5pt solid ${CINZA_BORDA}` as any,
  },
  trowAlt: { backgroundColor: '#FAFBFC' },
  td: { fontSize: 8, color: '#333' },
  colNumero:   { width: 40 },
  colData:     { width: 55 },
  colTrecho:   { flex: 1 },
  colPassag:   { width: 90 },
  colValor:    { width: 60, textAlign: 'right' },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: CINZA_BG, padding: 8, marginTop: 6,
  },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  totalValor: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: AZUL },
  extenso: { fontSize: 8, color: CINZA_TXT, marginTop: 2, fontStyle: 'italic' },

  rodape: {
    marginTop: 16, paddingTop: 8,
    borderTop: `1pt solid ${CINZA_BORDA}` as any,
  },
  rodapeLinha: { fontSize: 7, color: CINZA_TXT },
})

export function ReciboConsolidadoPDF({ empresa, cliente, periodo, linhas, reembolsos = [] }: ReciboConsolidadoProps) {
  const totalAtendimentos = linhas.reduce((s, l) => s + Number(l.valor || 0), 0)
  const totalReembolsos = reembolsos.reduce((s, r) => s + Number(r.valor || 0), 0)
  const total = totalAtendimentos + totalReembolsos
  const dataEmissao = new Date().toLocaleDateString('pt-BR')
  const endEmpresa = [empresa.endereco_rua, empresa.endereco_numero].filter(Boolean).join(', ')
  const cidUF = [empresa.cidade, empresa.estado].filter(Boolean).join('/')

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <View style={s.header}>
          <View style={s.headerLeft}>
            {empresa.logo_url && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={empresa.logo_url} style={s.logo} />
            )}
            <View>
              <Text style={s.empresaNome}>{empresa.nome}</Text>
              {empresa.cnpj && <Text style={s.empresaSub}>CNPJ: {empresa.cnpj}</Text>}
              {empresa.inscricao_estadual && (
                <Text style={s.empresaSub}>IE: {empresa.inscricao_estadual}</Text>
              )}
            </View>
          </View>
          <View>
            <Text style={s.tag}>RELATÓRIO DE ATENDIMENTOS</Text>
            <Text style={s.subtag}>Emitido em {dataEmissao}</Text>
          </View>
        </View>

        {/* Cliente */}
        <View style={s.faixa}><Text style={s.faixaTitulo}>Cliente</Text></View>
        <Text style={{ ...s.valor, fontFamily: 'Helvetica-Bold' }}>{cliente.nome}</Text>
        {cliente.endereco_linha && <Text style={s.valor}>{cliente.endereco_linha}</Text>}
        {cliente.telefone && <Text style={s.valor}>Tel: {cliente.telefone}</Text>}
        {cliente.email && <Text style={s.valor}>Email: {cliente.email}</Text>}

        {/* Periodo */}
        <View style={s.faixa}><Text style={s.faixaTitulo}>Período de referência</Text></View>
        <Text style={s.valor}>
          De {fmtData(periodo.inicio)} até {fmtData(periodo.fim)}
          {' · '}{linhas.length} atendimento{linhas.length !== 1 ? 's' : ''}
        </Text>

        {/* Tabela */}
        <View style={s.faixa}><Text style={s.faixaTitulo}>Atendimentos</Text></View>
        <View style={s.thead}>
          <Text style={{ ...s.th, ...s.colNumero }}>Nº</Text>
          <Text style={{ ...s.th, ...s.colData }}>Data</Text>
          <Text style={{ ...s.th, ...s.colTrecho }}>Trecho</Text>
          <Text style={{ ...s.th, ...s.colPassag }}>Passageiro</Text>
          <Text style={{ ...s.th, ...s.colValor }}>Valor</Text>
        </View>
        {linhas.map((l, i) => (
          <View key={i} style={{ ...s.trow, ...(i % 2 === 1 ? s.trowAlt : {}) }} wrap={false}>
            <Text style={{ ...s.td, ...s.colNumero }}>{l.numero || '—'}</Text>
            <Text style={{ ...s.td, ...s.colData }}>{fmtData(l.data_hora)}</Text>
            <Text style={{ ...s.td, ...s.colTrecho }}>{l.origem} → {l.destino}</Text>
            <Text style={{ ...s.td, ...s.colPassag }}>{l.passageiro || '—'}</Text>
            <Text style={{ ...s.td, ...s.colValor }}>R$ {fmtBRL(l.valor)}</Text>
          </View>
        ))}

        {/* Subtotal atendimentos — so aparece quando tem reembolsos pra somar */}
        {reembolsos.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>Subtotal atendimentos</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>R$ {fmtBRL(totalAtendimentos)}</Text>
          </View>
        )}

        {/* Despesas reembolsaveis — so aparece quando tem alguma */}
        {reembolsos.length > 0 && (
          <>
            <View style={s.faixa}><Text style={s.faixaTitulo}>Despesas reembolsáveis</Text></View>
            <View style={{ ...s.thead, backgroundColor: '#854F0B' }}>
              <Text style={{ ...s.th, ...s.colData }}>Data</Text>
              <Text style={{ ...s.th, ...s.colTrecho }}>Descrição</Text>
              <Text style={{ ...s.th, ...s.colPassag }}>Atendimento</Text>
              <Text style={{ ...s.th, ...s.colValor }}>Valor</Text>
            </View>
            {reembolsos.map((r, i) => (
              <View key={i} style={{ ...s.trow, ...(i % 2 === 1 ? s.trowAlt : {}) }} wrap={false}>
                <Text style={{ ...s.td, ...s.colData }}>{fmtData(r.data)}</Text>
                <Text style={{ ...s.td, ...s.colTrecho }}>
                  {r.categoria ? `[${r.categoria}] ` : ''}{r.descricao}
                </Text>
                <Text style={{ ...s.td, ...s.colPassag }}>{r.atendimento_numero || '—'}</Text>
                <Text style={{ ...s.td, ...s.colValor }}>R$ {fmtBRL(r.valor)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>Subtotal reembolsos</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>R$ {fmtBRL(totalReembolsos)}</Text>
            </View>
          </>
        )}

        {/* Total geral */}
        <View style={s.totalRow}>
          <View>
            <Text style={s.totalLabel}>Total do período</Text>
            <Text style={s.extenso}>({valorPorExtenso(total)})</Text>
          </View>
          <Text style={s.totalValor}>R$ {fmtBRL(total)}</Text>
        </View>

        {/* Pagamento */}
        {(empresa.chave_pix || empresa.banco_nome) && (
          <>
            <View style={s.faixa}><Text style={s.faixaTitulo}>Formas de pagamento</Text></View>
            <View style={s.bloco2col}>
              {empresa.chave_pix && (
                <View style={s.coluna}>
                  <Text style={s.label}>PIX</Text>
                  <Text style={s.valor}>{empresa.chave_pix}</Text>
                  {empresa.tipo_chave_pix && (
                    <Text style={{ fontSize: 7, color: CINZA_TXT }}>({empresa.tipo_chave_pix})</Text>
                  )}
                </View>
              )}
              {empresa.banco_nome && (
                <View style={s.coluna}>
                  <Text style={s.label}>Dados bancários</Text>
                  <Text style={s.valor}>{empresa.banco_nome}</Text>
                  {empresa.banco_agencia && <Text style={s.valor}>Ag {empresa.banco_agencia}</Text>}
                  {empresa.banco_conta && <Text style={s.valor}>Conta {empresa.banco_conta}{empresa.banco_tipo_conta ? ` (${empresa.banco_tipo_conta})` : ''}</Text>}
                  {empresa.banco_titular_nome && (
                    <Text style={{ fontSize: 7, color: CINZA_TXT }}>
                      Titular: {empresa.banco_titular_nome}{empresa.banco_titular_documento ? ` — ${empresa.banco_titular_documento}` : ''}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {/* Rodape */}
        <View style={s.rodape}>
          <Text style={s.rodapeLinha}>{empresa.nome.toUpperCase()}</Text>
          {(endEmpresa || cidUF) && (
            <Text style={s.rodapeLinha}>
              {[endEmpresa, empresa.endereco_bairro, cidUF, empresa.endereco_cep ? `CEP ${empresa.endereco_cep}` : ''].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Text style={s.rodapeLinha}>
            {[empresa.telefone, empresa.email_comercial, empresa.instagram ? `@${empresa.instagram.replace(/^@/,'')}` : '', empresa.site].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
