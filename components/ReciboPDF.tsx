/**
 * Recibo de pagamento PDF — comprovante formal que Julimar envia ao
 * cliente APOS receber o pagamento. Diferenca vs Voucher:
 *  - Voucher: pre-serviço, comprova a reserva
 *  - Recibo: pos-pagamento, comprova quitacao (valor recebido, forma,
 *    data, valor por extenso — formato mais formal tipo duplicata)
 *
 * Layout mais compacto que o voucher, com foco no valor recebido.
 */
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { valorPorExtenso } from '@/lib/valor-por-extenso'
import type { VoucherEmpresa, VoucherCliente } from './VoucherPDF'

export type ReciboAtendimento = {
  numero: string | null
  tipo_servico?: string | null
  origem: string
  destino: string
  data_hora: string
  valor: number
  valor_recebido?: number | null
  forma_pagamento?: string | null
  data_pagamento?: string | null
}

export type ReciboProps = {
  empresa: VoucherEmpresa
  cliente: VoucherCliente
  atendimento: ReciboAtendimento
}

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtData = (iso: string) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ''

const AZUL = '#0F6E56'
const CINZA_BG = '#F5F6F8'
const CINZA_BORDA = '#D9DCE3'
const CINZA_TXT = '#6B7280'

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  logo: { width: 44, height: 44 },
  empresaNome: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  empresaSub: { fontSize: 9, color: CINZA_TXT, marginTop: 1 },
  tag: {
    backgroundColor: AZUL, color: '#fff', paddingVertical: 6, paddingHorizontal: 14,
    fontFamily: 'Helvetica-Bold', fontSize: 12, letterSpacing: 2,
  },
  numeroLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  numeroLabel: { fontSize: 9, color: CINZA_TXT, textTransform: 'uppercase' },
  numeroValor: { fontFamily: 'Helvetica-Bold', fontSize: 16, color: AZUL, marginTop: 2 },
  data: { fontSize: 9, color: CINZA_TXT, textAlign: 'right' },
  valorBox: {
    backgroundColor: CINZA_BG,
    padding: 14,
    marginBottom: 14,
  },
  valorLabel: { fontSize: 9, color: CINZA_TXT, textTransform: 'uppercase' },
  valorNum: { fontFamily: 'Helvetica-Bold', fontSize: 22, color: AZUL, marginTop: 4 },
  valorExtenso: { fontSize: 9, color: '#333', marginTop: 4, fontStyle: 'italic' },
  faixa: { backgroundColor: CINZA_BG, padding: 6, marginTop: 8, marginBottom: 6 },
  faixaTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  linha: { paddingVertical: 2 },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  valor: { fontSize: 9, color: '#333' },
  bloco2col: { flexDirection: 'row', gap: 20, paddingVertical: 4 },
  coluna: { flex: 1 },
  declaracao: {
    fontSize: 10, color: '#111', marginTop: 16, marginBottom: 20,
    lineHeight: 1.5, textAlign: 'justify',
  },
  assinaturaLinha: {
    marginTop: 40, borderTop: `1pt solid #111` as any, width: '60%', alignSelf: 'center',
    paddingTop: 4,
  },
  assinaturaTxt: { fontSize: 8, color: CINZA_TXT, textAlign: 'center' },
  rodape: {
    marginTop: 20, paddingTop: 10,
    borderTop: `1pt solid ${CINZA_BORDA}` as any,
  },
  rodapeLinha: { fontSize: 7, color: CINZA_TXT },
})

function formaPagamentoLabel(f?: string | null): string {
  const m: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão',
    faturado: 'Faturado', boleto: 'Boleto', transferencia: 'Transferência bancária',
  }
  return f ? (m[f] || f) : 'Não informada'
}

export function ReciboPDF({ empresa, cliente, atendimento }: ReciboProps) {
  const valorRecebido = atendimento.valor_recebido ?? atendimento.valor
  const dataEmissao = atendimento.data_pagamento
    ? fmtData(atendimento.data_pagamento)
    : new Date().toLocaleDateString('pt-BR')
  const dataServico = fmtData(atendimento.data_hora)
  const endEmpresa = [empresa.endereco_rua, empresa.endereco_numero].filter(Boolean).join(', ')
  const cidUF = [empresa.cidade, empresa.estado].filter(Boolean).join('/')

  return (
    <Document>
      <Page size="A4" style={s.page}>
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
          <Text style={s.tag}>RECIBO</Text>
        </View>

        <View style={s.numeroLinha}>
          <View>
            <Text style={s.numeroLabel}>Nº do atendimento</Text>
            <Text style={s.numeroValor}>{atendimento.numero || '—'}</Text>
          </View>
          <View>
            <Text style={s.data}>Emitido em {dataEmissao}</Text>
          </View>
        </View>

        <View style={s.valorBox}>
          <Text style={s.valorLabel}>Valor recebido</Text>
          <Text style={s.valorNum}>R$ {fmtBRL(valorRecebido)}</Text>
          <Text style={s.valorExtenso}>
            ({valorPorExtenso(valorRecebido)})
          </Text>
        </View>

        {/* Recebido de */}
        <View style={s.faixa}><Text style={s.faixaTitulo}>Recebido de</Text></View>
        <View style={s.linha}>
          <Text style={s.valor}>{cliente.nome}</Text>
          {cliente.endereco_linha && <Text style={s.valor}>{cliente.endereco_linha}</Text>}
          {cliente.telefone && <Text style={s.valor}>Tel: {cliente.telefone}</Text>}
        </View>

        {/* Referente a */}
        <View style={s.faixa}><Text style={s.faixaTitulo}>Referente a</Text></View>
        <View style={s.bloco2col}>
          <View style={s.coluna}>
            <Text style={s.label}>Serviço</Text>
            <Text style={s.valor}>{atendimento.origem} → {atendimento.destino}</Text>
            <Text style={s.valor}>Data: {dataServico}</Text>
          </View>
          <View style={s.coluna}>
            <Text style={s.label}>Forma de pagamento</Text>
            <Text style={s.valor}>{formaPagamentoLabel(atendimento.forma_pagamento)}</Text>
          </View>
        </View>

        <Text style={s.declaracao}>
          Declaramos ter recebido de {cliente.nome} a importância de R$ {fmtBRL(valorRecebido)} ({valorPorExtenso(valorRecebido)}),
          referente ao atendimento {atendimento.numero ? `nº ${atendimento.numero}` : ''} realizado em {dataServico},
          dando plena e geral quitação para o serviço descrito acima.
        </Text>

        <Text style={{ ...s.valor, textAlign: 'center', marginTop: 8 }}>
          {empresa.cidade || ''}{empresa.cidade ? ', ' : ''}{dataEmissao}
        </Text>

        <View style={s.assinaturaLinha}>
          <Text style={s.assinaturaTxt}>{empresa.nome}</Text>
          {empresa.cnpj && <Text style={s.assinaturaTxt}>CNPJ: {empresa.cnpj}</Text>}
        </View>

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
