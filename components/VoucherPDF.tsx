/**
 * Voucher em PDF do transfer empresarial — layout inspirado no modelo
 * Carrion (referencia enviada pelo Julimar). Comprovante de reserva formal
 * que o cliente pode apresentar/arquivar.
 *
 * Composicao:
 *  - Cabecalho: logo (se cadastrado) + nome empresa + subtitulo (descricao)
 *  - Tag "Voucher de transporte Nº" + subtitulo do servico (Diaria/etc)
 *  - Bloco Cliente (nome + telefone + endereco se PJ tiver)
 *  - Bloco Informacoes basicas (origem, destino, data/hora, voo)
 *  - Bloco Servicos com descricao detalhada + preco + total
 *  - Bloco Pagamento (meios aceitos + PIX + dados bancarios)
 *  - Assinatura "cidade, dd/mm/yyyy" + linha de agradecimento
 *  - Rodape: dados fiscais da empresa (razao/CNPJ/endereco + contatos)
 *
 * Retrocompatibilidade: cada linha aparece SO se o dado correspondente
 * estiver preenchido — empresa com poucos dados cadastrados gera um voucher
 * mais enxuto, sem "Sem CNPJ" ou linhas vazias.
 */
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

export type VoucherEmpresa = {
  nome: string
  descricao?: string | null
  cnpj?: string | null
  inscricao_estadual?: string | null
  logo_url?: string | null
  telefone?: string | null
  email_comercial?: string | null
  whatsapp_comercial?: string | null
  instagram?: string | null
  site?: string | null
  endereco_rua?: string | null
  endereco_numero?: string | null
  endereco_bairro?: string | null
  endereco_cep?: string | null
  cidade?: string | null
  estado?: string | null
  chave_pix?: string | null
  tipo_chave_pix?: string | null
  banco_nome?: string | null
  banco_agencia?: string | null
  banco_conta?: string | null
  banco_tipo_conta?: string | null
  banco_titular_nome?: string | null
  banco_titular_documento?: string | null
}

export type VoucherCliente = {
  nome: string
  telefone?: string | null
  email?: string | null
  endereco_linha?: string | null   // ex: "Hotel Intercity Pamplona 83, São Paulo -SP"
}

export type VoucherAtendimento = {
  numero: string | null            // formato exibido, ex: "123-2026"
  tipo_servico?: string | null     // transfer | diaria | city_tour
  subtitulo_servico?: string | null // ex: "1/2 diária 5 horas" (livre)
  origem: string
  destino: string
  data_hora: string                // ISO
  data_hora_termino?: string | null
  numero_voo?: string | null
  passageiros_nomes?: string[]     // opcional (P1 + adicionais)
  motorista_nome?: string | null
  motorista_veiculo?: string | null
  motorista_placa?: string | null
  observacoes?: string | null
  descricao_servico?: string | null // narrativa longa (ex: "Me pegar no hotel...")
  trajetos?: { origem?: string | null; destino?: string | null }[] | null
  valor: number
  // Corridas ida-volta sao gravadas como 2 linhas separadas em
  // corridas_empresa. Quando presente, o voucher mostra a volta tambem
  // (antes so gerava o voucher da ida, mesmo pra reservas ida-volta).
  volta?: { origem: string; destino: string; data_hora: string; valor?: number | null } | null
}

export type VoucherProps = {
  empresa: VoucherEmpresa
  cliente: VoucherCliente
  atendimento: VoucherAtendimento
}

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtData = (iso: string) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ''
const fmtHora = (iso: string) => iso ? iso.slice(11, 16) : ''

const AZUL = '#0F6E56'
const CINZA_BG = '#F5F6F8'
const CINZA_BORDA = '#D9DCE3'
const CINZA_TXT = '#6B7280'

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: '#111' },

  // Cabecalho
  header: { alignItems: 'center', marginBottom: 14 },
  logo: { width: 60, height: 60, marginBottom: 6 },
  empresaNome: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#111', textAlign: 'center' },
  empresaSub: { fontSize: 9, color: CINZA_TXT, marginTop: 2, textAlign: 'center' },

  // Blocos com faixa cinza
  faixa: {
    backgroundColor: CINZA_BG,
    padding: 6,
    marginTop: 10,
    marginBottom: 6,
  },
  faixaTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#111' },
  faixaSub: { fontSize: 8, color: CINZA_TXT, marginTop: 1 },

  // Linhas de dado
  linha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#111' },
  valor: { fontSize: 9, color: '#333' },
  bloco2col: { flexDirection: 'row', gap: 20, paddingVertical: 4 },
  coluna: { flex: 1 },

  // Servicos
  servicoLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  servicoDesc: { fontSize: 9, color: '#333', lineHeight: 1.5, marginBottom: 6 },
  totalLinha: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: CINZA_BG,
    padding: 6,
    marginTop: 6,
  },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  totalValor: { fontFamily: 'Helvetica-Bold', fontSize: 11 },

  // Assinatura
  agradecimento: { fontSize: 9, color: CINZA_TXT, fontStyle: 'italic', textAlign: 'center', marginTop: 14 },
  cidadeData: { fontSize: 9, color: '#111', textAlign: 'center', marginTop: 4 },

  // Rodape fiscal
  rodape: {
    marginTop: 20, paddingTop: 10,
    borderTop: `1pt solid ${CINZA_BORDA}` as any,
    flexDirection: 'row', gap: 16,
  },
  rodapeCol: { flex: 1 },
  rodapeNome: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#111' },
  rodapeLinha: { fontSize: 8, color: CINZA_TXT, marginTop: 1 },
})

function enderecoLinhaEmpresa(e: VoucherEmpresa): string {
  const rua = [e.endereco_rua, e.endereco_numero].filter(Boolean).join(', ')
  const bairro = e.endereco_bairro || ''
  const cid = [e.cidade, e.estado].filter(Boolean).join('-')
  return [rua, bairro, cid].filter(Boolean).join(', ')
}

function tipoServicoLabel(t?: string | null): string {
  if (t === 'diaria') return 'Diária'
  if (t === 'city_tour') return 'City tour'
  return 'Transfer'
}

export function VoucherPDF({ empresa, cliente, atendimento }: VoucherProps) {
  const dataViagem = fmtData(atendimento.data_hora)
  const horaViagem = fmtHora(atendimento.data_hora)
  const dataEmissao = new Date().toLocaleDateString('pt-BR')
  const cidadeEmissao = empresa.cidade || ''
  const passageiros = atendimento.passageiros_nomes?.filter(Boolean) || []
  const trajetos = (atendimento.trajetos || []).filter(t => t?.origem || t?.destino)
  const volta = atendimento.volta
  const valorVolta = volta?.valor ?? 0
  const valorTotal = atendimento.valor + valorVolta

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cabecalho */}
        <View style={s.header}>
          {empresa.logo_url && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={empresa.logo_url} style={s.logo} />
          )}
          <Text style={s.empresaNome}>{empresa.nome}</Text>
          {empresa.descricao && <Text style={s.empresaSub}>{empresa.descricao}</Text>}
        </View>

        {/* Titulo Voucher */}
        <View style={s.faixa}>
          <Text style={s.faixaTitulo}>
            Voucher de transporte {atendimento.numero ? `Nº ${atendimento.numero}` : ''}
          </Text>
          {atendimento.subtitulo_servico
            ? <Text style={s.faixaSub}>{atendimento.subtitulo_servico}</Text>
            : atendimento.tipo_servico
              ? <Text style={s.faixaSub}>{tipoServicoLabel(atendimento.tipo_servico)}</Text>
              : null}
        </View>

        {/* Cliente */}
        <View style={{ marginBottom: 4 }}>
          <Text style={{ ...s.label, marginBottom: 2 }}>Cliente: <Text style={s.valor}>{cliente.nome}</Text></Text>
          {cliente.endereco_linha && <Text style={s.valor}>{cliente.endereco_linha}</Text>}
          {cliente.telefone && <Text style={s.valor}>Tel: {cliente.telefone}</Text>}
          {cliente.email && <Text style={s.valor}>{cliente.email}</Text>}
        </View>

        {/* Informacoes basicas */}
        <View style={s.faixa}>
          <Text style={s.faixaTitulo}>Informações básicas{volta ? ' — Ida' : ''}</Text>
        </View>
        <View style={s.bloco2col}>
          <View style={s.coluna}>
            <Text style={s.label}>Origem</Text>
            <Text style={s.valor}>{atendimento.origem}</Text>
          </View>
          <View style={s.coluna}>
            <Text style={s.label}>Destino</Text>
            <Text style={s.valor}>{atendimento.destino}</Text>
          </View>
        </View>

        {/* Servicos */}
        <View style={s.faixa}>
          <View style={s.linha}>
            <Text style={s.faixaTitulo}>Serviços</Text>
            <Text style={{ ...s.label, fontSize: 8 }}>Preço</Text>
          </View>
        </View>
        <View style={s.servicoLinha}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{atendimento.subtitulo_servico || tipoServicoLabel(atendimento.tipo_servico)}</Text>
            <Text style={{ ...s.valor, marginTop: 2 }}>Data {dataViagem}</Text>
            <Text style={s.valor}>Horário {horaViagem}h</Text>
            {passageiros.length > 0 && (
              <Text style={s.valor}>Passageiros: {passageiros.length}</Text>
            )}
            {atendimento.numero_voo && <Text style={s.valor}>Voo: {atendimento.numero_voo}</Text>}
          </View>
          <Text style={s.valor}>R$ {fmtBRL(atendimento.valor)}</Text>
        </View>

        {atendimento.descricao_servico && (
          <Text style={s.servicoDesc}>{atendimento.descricao_servico}</Text>
        )}

        {trajetos.length > 0 && (
          <View style={{ marginTop: 4 }}>
            <Text style={s.label}>Próximas rotas:</Text>
            {trajetos.map((t, i) => (
              <Text key={i} style={s.valor}>• {t.origem || '...'} → {t.destino || '...'}</Text>
            ))}
          </View>
        )}

        {atendimento.observacoes && (
          <View style={{ marginTop: 6 }}>
            <Text style={s.label}>Observações</Text>
            <Text style={s.valor}>{atendimento.observacoes}</Text>
          </View>
        )}

        {/* Volta — reservas ida-volta sao 2 corridas separadas no banco;
            quando ha uma volta vinculada, mostra aqui pra sair no mesmo
            voucher (antes o voucher so trazia a ida). */}
        {volta && (
          <>
            <View style={s.faixa}><Text style={s.faixaTitulo}>Informações básicas — Volta</Text></View>
            <View style={s.bloco2col}>
              <View style={s.coluna}>
                <Text style={s.label}>Origem</Text>
                <Text style={s.valor}>{volta.origem}</Text>
              </View>
              <View style={s.coluna}>
                <Text style={s.label}>Destino</Text>
                <Text style={s.valor}>{volta.destino}</Text>
              </View>
            </View>
            <View style={s.servicoLinha}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...s.valor, marginTop: 2 }}>Data {fmtData(volta.data_hora)}</Text>
                <Text style={s.valor}>Horário {fmtHora(volta.data_hora)}h</Text>
              </View>
              {volta.valor != null && <Text style={s.valor}>R$ {fmtBRL(volta.valor)}</Text>}
            </View>
          </>
        )}

        {/* Total */}
        <View style={s.totalLinha}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValor}>R$ {fmtBRL(valorTotal)}</Text>
        </View>

        {/* Pagamento */}
        {(empresa.chave_pix || empresa.banco_nome) && (
          <>
            <View style={s.faixa}><Text style={s.faixaTitulo}>Pagamento</Text></View>
            <View style={s.bloco2col}>
              <View style={s.coluna}>
                <Text style={s.label}>Meios de pagamento</Text>
                <Text style={s.valor}>
                  Boleto, transferência bancária, dinheiro, cartão de crédito, cartão de débito ou pix.
                </Text>
              </View>
              {empresa.chave_pix && (
                <View style={s.coluna}>
                  <Text style={s.label}>PIX</Text>
                  <Text style={s.valor}>{empresa.chave_pix}</Text>
                  {empresa.tipo_chave_pix && (
                    <Text style={{ ...s.valor, fontSize: 8, color: CINZA_TXT }}>
                      ({empresa.tipo_chave_pix})
                    </Text>
                  )}
                </View>
              )}
            </View>

            {empresa.banco_nome && (
              <View style={{ marginTop: 4 }}>
                <Text style={s.label}>Dados bancários</Text>
                <Text style={s.valor}>Banco: {empresa.banco_nome}</Text>
                {empresa.banco_agencia && <Text style={s.valor}>Agência: {empresa.banco_agencia}</Text>}
                {empresa.banco_conta && <Text style={s.valor}>Conta: {empresa.banco_conta}</Text>}
                {empresa.banco_tipo_conta && <Text style={s.valor}>Tipo de conta: {empresa.banco_tipo_conta}</Text>}
                {empresa.banco_titular_nome && (
                  <Text style={s.valor}>
                    Titular da conta{empresa.banco_titular_documento ? ' (CPF/CNPJ)' : ''}:
                    {' '}{empresa.banco_titular_nome}
                    {empresa.banco_titular_documento ? ` — ${empresa.banco_titular_documento}` : ''}
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {/* Assinatura */}
        <Text style={s.agradecimento}>Sua confiança é o nosso sucesso, grato!</Text>
        {cidadeEmissao && (
          <Text style={s.cidadeData}>{cidadeEmissao}, {dataEmissao}</Text>
        )}

        {/* Rodape com dados fiscais */}
        <View style={s.rodape}>
          <View style={s.rodapeCol}>
            <Text style={s.rodapeNome}>{empresa.nome.toUpperCase()}</Text>
            {empresa.cnpj && <Text style={s.rodapeLinha}>CNPJ: {empresa.cnpj}</Text>}
            {empresa.inscricao_estadual && <Text style={s.rodapeLinha}>IE: {empresa.inscricao_estadual}</Text>}
            {enderecoLinhaEmpresa(empresa) && (
              <Text style={s.rodapeLinha}>{enderecoLinhaEmpresa(empresa)}</Text>
            )}
            {empresa.endereco_cep && (
              <Text style={s.rodapeLinha}>CEP {empresa.endereco_cep}</Text>
            )}
          </View>
          <View style={s.rodapeCol}>
            {/* Sem emoji no rodape — Helvetica do react-pdf nao renderiza
                todos os pictogramas (aparece como = ou < antes do texto).
                Labels em texto simples ficam mais formais e nunca quebram. */}
            {empresa.email_comercial && <Text style={s.rodapeLinha}>Email: {empresa.email_comercial}</Text>}
            {empresa.telefone && <Text style={s.rodapeLinha}>Tel: {empresa.telefone}</Text>}
            {empresa.whatsapp_comercial && <Text style={s.rodapeLinha}>WhatsApp: {empresa.whatsapp_comercial}</Text>}
            {empresa.instagram && <Text style={s.rodapeLinha}>Instagram: @{empresa.instagram.replace(/^@/, '')}</Text>}
            {empresa.site && <Text style={s.rodapeLinha}>Site: {empresa.site}</Text>}
          </View>
        </View>
      </Page>
    </Document>
  )
}
