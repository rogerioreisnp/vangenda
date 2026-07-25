/**
 * Recibo de repasse ao motorista parceiro. Fase 4.4.
 *
 * Comprovante que Julimar entrega ao motorista agregado registrando o
 * valor repassado por um atendimento (ou conjunto — versao futura).
 * Motorista arquiva pra prestar contas / declarar imposto de renda dele.
 *
 * Layout compacto tipo recibo formal, mais simples que o recibo do cliente
 * (nao precisa CPF/CNPJ do motorista com dados fiscais completos — so
 * nome/documento se preenchido, valor, atendimento referente, assinatura).
 */
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { valorPorExtenso } from '@/lib/valor-por-extenso'
import type { VoucherEmpresa } from './VoucherPDF'

export type ReciboRepasseProps = {
  empresa: VoucherEmpresa
  motorista: {
    nome: string
    documento?: string | null   // CPF do motorista, se cadastrado
    telefone?: string | null
    veiculo?: string | null
    placa?: string | null
  }
  atendimento: {
    numero: string | null
    origem: string
    destino: string
    data_hora: string
  }
  valor_repasse: number
  data_pagamento?: string | null  // yyyy-mm-dd — quando gestor pagou o motorista
  forma_pagamento?: string | null
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
    fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 1,
  },
  valorBox: {
    backgroundColor: CINZA_BG, padding: 14, marginBottom: 14, marginTop: 12,
  },
  valorLabel: { fontSize: 9, color: CINZA_TXT, textTransform: 'uppercase' },
  valorNum: { fontFamily: 'Helvetica-Bold', fontSize: 22, color: AZUL, marginTop: 4 },
  valorExtenso: { fontSize: 9, color: '#333', marginTop: 4, fontStyle: 'italic' },
  faixa: { backgroundColor: CINZA_BG, padding: 6, marginTop: 8, marginBottom: 6 },
  faixaTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 10 },
  linha: { paddingVertical: 2 },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  valor: { fontSize: 9, color: '#333' },
  bloco2col: { flexDirection: 'row', gap: 20, paddingVertical: 3 },
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

function formaLabel(f?: string | null): string {
  const m: Record<string, string> = {
    dinheiro: 'Dinheiro', pix: 'Pix', transferencia: 'Transferência bancária',
  }
  return f ? (m[f] || f) : 'Não informada'
}

export function ReciboRepasseMotoristaPDF({ empresa, motorista, atendimento, valor_repasse, data_pagamento, forma_pagamento }: ReciboRepasseProps) {
  const dataEmissao = data_pagamento ? fmtData(data_pagamento) : new Date().toLocaleDateString('pt-BR')
  const dataAtend = fmtData(atendimento.data_hora)

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
            </View>
          </View>
          <Text style={s.tag}>RECIBO DE REPASSE</Text>
        </View>

        <View style={s.valorBox}>
          <Text style={s.valorLabel}>Valor pago ao motorista</Text>
          <Text style={s.valorNum}>R$ {fmtBRL(valor_repasse)}</Text>
          <Text style={s.valorExtenso}>({valorPorExtenso(valor_repasse)})</Text>
        </View>

        {/* Motorista */}
        <View style={s.faixa}><Text style={s.faixaTitulo}>Pago a</Text></View>
        <View style={s.linha}>
          <Text style={{ ...s.valor, fontFamily: 'Helvetica-Bold' }}>{motorista.nome}</Text>
          {motorista.documento && <Text style={s.valor}>CPF/Doc: {motorista.documento}</Text>}
          {motorista.telefone && <Text style={s.valor}>Tel: {motorista.telefone}</Text>}
          {(motorista.veiculo || motorista.placa) && (
            <Text style={s.valor}>
              Veículo: {[motorista.veiculo, motorista.placa].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        {/* Referente a */}
        <View style={s.faixa}><Text style={s.faixaTitulo}>Referente ao atendimento</Text></View>
        <View style={s.bloco2col}>
          <View style={s.coluna}>
            <Text style={s.label}>Nº do atendimento</Text>
            <Text style={s.valor}>{atendimento.numero || '—'}</Text>
          </View>
          <View style={s.coluna}>
            <Text style={s.label}>Data</Text>
            <Text style={s.valor}>{dataAtend}</Text>
          </View>
          <View style={s.coluna}>
            <Text style={s.label}>Forma de pagamento</Text>
            <Text style={s.valor}>{formaLabel(forma_pagamento)}</Text>
          </View>
        </View>
        <View style={s.linha}>
          <Text style={s.label}>Trecho</Text>
          <Text style={s.valor}>{atendimento.origem} → {atendimento.destino}</Text>
        </View>

        <Text style={s.declaracao}>
          Declaro ter recebido de {empresa.nome} a importância de R$ {fmtBRL(valor_repasse)} ({valorPorExtenso(valor_repasse)}),
          referente ao repasse do atendimento {atendimento.numero ? `nº ${atendimento.numero}` : ''} realizado em {dataAtend},
          dando plena e geral quitação pelo serviço prestado.
        </Text>

        <Text style={{ ...s.valor, textAlign: 'center', marginTop: 8 }}>
          {empresa.cidade || ''}{empresa.cidade ? ', ' : ''}{dataEmissao}
        </Text>

        <View style={s.assinaturaLinha}>
          <Text style={s.assinaturaTxt}>{motorista.nome}</Text>
          {motorista.documento && <Text style={s.assinaturaTxt}>CPF: {motorista.documento}</Text>}
        </View>

        <View style={s.rodape}>
          <Text style={s.rodapeLinha}>{empresa.nome.toUpperCase()}</Text>
          {empresa.cnpj && <Text style={s.rodapeLinha}>CNPJ: {empresa.cnpj}</Text>}
          <Text style={s.rodapeLinha}>
            {[empresa.telefone, empresa.email_comercial].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
