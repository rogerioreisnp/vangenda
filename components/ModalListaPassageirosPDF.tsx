'use client'
import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Modal de geração de "LISTA DE PASSAGEIROS — FRETAMENTO" para apresentação
 * à Polícia Rodoviária Federal / fiscalização.
 *
 * Reutilizável: recebe apenas os dados brutos (data + passageiros já filtrados).
 * Layout do PDF é idêntico ao já usado no /dashboard/agenda (individual).
 *
 * Persiste em localStorage: placa, nome_empresa, razao_social, cnpj (o
 * usuário digita uma vez e nas próximas volta preenchido).
 */

export type PassageiroLista = {
  id: string
  nome: string
  // RG/CPF já salvo (lista do fretamento). Sem ele, o campo vem vazio.
  documento?: string
}

export default function ModalListaPassageirosPDF({
  diaSelecionado,
  passageiros,
  nomeMotoristaSugerido = '',
  origemSugerida = '',
  destinoSugerido = '',
  horarioSaidaSugerido = '',
  horarioVoltaSugerido = '',
  dataVoltaSugerida = '',
  tituloEvento = 'FRETAMENTO',
  onFechar,
}: {
  diaSelecionado: Date
  passageiros: PassageiroLista[]
  nomeMotoristaSugerido?: string
  origemSugerida?: string
  destinoSugerido?: string
  horarioSaidaSugerido?: string
  horarioVoltaSugerido?: string
  dataVoltaSugerida?: string // yyyy-MM-dd
  tituloEvento?: string
  onFechar: () => void
}) {
  const [form, setForm] = useState({
    nome_empresa: '',
    razao_social: '',
    cnpj: '',
    placa: '',
    motorista: nomeMotoristaSugerido,
    origem: origemSugerida,
    destino: destinoSugerido,
    horario_saida: horarioSaidaSugerido,
    horario_volta: horarioVoltaSugerido,
    data_saida: format(diaSelecionado, 'yyyy-MM-dd'),
    data_volta: dataVoltaSugerida,
  })
  const [gerando, setGerando] = useState(false)
  const [documentos, setDocumentos] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {}
    for (const p of passageiros) if (p.documento) inicial[p.id] = p.documento
    return inicial
  })
  const documentosRef = useRef(documentos)
  useEffect(() => { documentosRef.current = documentos }, [documentos])

  useEffect(() => {
    try {
      const savedPlaca = localStorage.getItem('vangenda_pdf_placa')
      const savedEmpresa = localStorage.getItem('vangenda_pdf_empresa')
      const updates: Partial<typeof form> = {}
      if (savedPlaca) updates.placa = savedPlaca
      if (savedEmpresa) {
        const parsed = JSON.parse(savedEmpresa)
        if (parsed.nome_empresa) updates.nome_empresa = parsed.nome_empresa
        if (parsed.razao_social) updates.razao_social = parsed.razao_social
        if (parsed.cnpj) updates.cnpj = parsed.cnpj
      }
      if (Object.keys(updates).length > 0) setForm(f => ({ ...f, ...updates }))
    } catch {}
  }, [])

  async function gerarPDF() {
    setGerando(true)
    try {
      localStorage.setItem('vangenda_pdf_placa', form.placa)
      localStorage.setItem('vangenda_pdf_empresa', JSON.stringify({
        nome_empresa: form.nome_empresa,
        razao_social: form.razao_social,
        cnpj: form.cnpj,
      }))
    } catch {}

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    doc.setLineWidth(0.3)

    const pageW = 210
    const mg = 15
    const W = pageW - 2 * mg

    // Largura disponível pro texto da célula, em mm, no tamanho de fonte dado.
    // Serve pra calcular até onde o valor pode escrever antes de estourar.
    function larguraTexto(s: string, tamanho: number): number {
      doc.setFontSize(tamanho)
      return doc.getTextWidth(s)
    }
    // Encurta o texto pra caber dentro da coluna. Faz binary-search no tamanho
    // em vez de supor "N caracteres" — nomes grandes (ex: "Carlos Henrique
    // da Silva") agora cortam no ponto certo, independente da coluna.
    function encurtar(s: string, maxMm: number, tamanho: number): string {
      if (!s) return ''
      if (larguraTexto(s, tamanho) <= maxMm) return s
      let lo = 0, hi = s.length
      while (lo < hi) {
        const m = Math.floor((lo + hi + 1) / 2)
        if (larguraTexto(s.slice(0, m) + '…', tamanho) <= maxMm) lo = m
        else hi = m - 1
      }
      return s.slice(0, lo) + '…'
    }
    function fmtDate(d: string) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—' }

    // Célula compacta: rótulo em cima (6pt), valor embaixo (9pt), com altura
    // variável. Antes era fixo em 14mm; agora costuma vir com 10mm, o que
    // economiza ~16mm no cabeçalho inteiro.
    function cell(cx: number, cy: number, cw: number, ch: number, lbl: string, val: string) {
      doc.setDrawColor(0, 0, 0)
      doc.rect(cx, cy, cw, ch)
      doc.setFontSize(6)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(120, 120, 120)
      doc.text(lbl, cx + 1.8, cy + 3.2)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 20, 20)
      doc.text(encurtar(val || '—', cw - 3.6, 9), cx + 1.8, cy + ch - 2.2)
    }

    const rowH = 10
    const half = W / 2
    const col = W / 5
    const hdrH = 6
    const nameW = W * 0.68

    // Desenha cabeçalho (empresa + título + células) no topo da página atual.
    // Roda em TODA página pra que cada folha fique auto-contida — se o motorista
    // só levar uma, a fiscalização ainda consegue identificar placa, motorista,
    // trajeto e datas. Devolve o y onde o próximo elemento começa.
    function desenharCabecalho(): number {
      let y = 15
      if (form.nome_empresa) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text(form.nome_empresa.toUpperCase(), pageW / 2, y, { align: 'center' })
        y += 6
      }
      if (form.razao_social) {
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(form.razao_social, pageW / 2, y, { align: 'center' })
        y += 3.8
      }
      if (form.cnpj) {
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(`CNPJ: ${form.cnpj}`, pageW / 2, y, { align: 'center' })
        y += 3.8
      }
      if (form.nome_empresa || form.razao_social || form.cnpj) y += 3

      doc.setFontSize(form.nome_empresa ? 9.5 : 11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 20, 20)
      doc.text(`LISTA DE PASSAGEIROS — ${tituloEvento.toUpperCase()}`, pageW / 2, y, { align: 'center' })
      y += 5

      cell(mg, y, half, rowH, 'PLACA', form.placa)
      cell(mg + half, y, half, rowH, 'MOTORISTA', form.motorista)
      y += rowH
      cell(mg, y, half, rowH, 'ORIGEM', form.origem)
      cell(mg + half, y, half, rowH, 'DESTINO', form.destino)
      y += rowH
      cell(mg, y, col, rowH, 'SAÍDA', form.horario_saida)
      cell(mg + col, y, col, rowH, 'VOLTA', form.horario_volta)
      cell(mg + 2 * col, y, col, rowH, 'DATA SAÍDA', fmtDate(form.data_saida))
      cell(mg + 3 * col, y, col, rowH, 'DATA VOLTA', fmtDate(form.data_volta))
      cell(mg + 4 * col, y, col, rowH, 'Nº PASS.', String(passageiros.length))
      y += rowH + 3
      return y
    }

    // Faixa verde "PASSAGEIROS | DOCUMENTO DE PORTE" — também em toda página,
    // pra que a tabela nunca apareça sem título.
    function desenharCabecalhoTabela(y: number): number {
      doc.setFillColor(15, 110, 86)
      doc.rect(mg, y, W, hdrH, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.text('PASSAGEIROS', mg + 3, y + 4.1)
      doc.text('DOCUMENTO DE PORTE', mg + nameW + 3, y + 4.1)
      return y + hdrH
    }

    let y = desenharCabecalho()
    y = desenharCabecalhoTabela(y)

    // Linha de passageiro: 7mm. Quando quebra página, redesenha o cabeçalho
    // inteiro — custa alguns passageiros na folha nova, mas a folha vale sozinha.
    const passH = 7
    passageiros.forEach((p, i) => {
      if (y + passH > 285) {
        doc.addPage()
        y = desenharCabecalho()
        y = desenharCabecalhoTabela(y)
      }
      if (i % 2 === 1) { doc.setFillColor(245, 245, 245); doc.rect(mg, y, W, passH, 'F') }
      doc.setDrawColor(0, 0, 0)
      doc.rect(mg, y, W, passH)
      doc.line(mg + nameW, y, mg + nameW, y + passH)
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      const nomePass = p.nome.replace(/\s*\(\d+\/\d+\)\s*$/, '').toUpperCase()
      const prefixo = `${i + 1}.  `
      const larguraPrefixo = larguraTexto(prefixo, 8.5)
      doc.text(prefixo + encurtar(nomePass, nameW - 6 - larguraPrefixo, 8.5), mg + 3, y + 4.9)
      const docText = documentosRef.current[p.id] || ''
      if (docText) {
        doc.text(encurtar(docText, W - nameW - 6, 8.5), mg + nameW + 3, y + 4.9)
      } else {
        doc.setTextColor(180, 180, 180)
        doc.text('RG/CPF', mg + nameW + 3, y + 4.9)
        doc.setTextColor(30, 30, 30)
      }
      y += passH
    })

    // Rodapé em TODA página: "Página X de Y" à esquerda (pra fiscalização saber
    // que não falta folha) e "Gerado em ... via RotaGenda" à direita.
    const totalPaginas = doc.getNumberOfPages()
    const dataGeracao = new Date().toLocaleDateString('pt-BR')
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(150, 150, 150)
      doc.text(`Página ${p} de ${totalPaginas}`, mg, 293)
      doc.text(`Gerado em ${dataGeracao} via RotaGenda`, pageW - mg, 293, { align: 'right' })
    }

    doc.save(`lista-passageiros-${format(diaSelecionado, 'dd-MM-yyyy')}.pdf`)
    setGerando(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-8 pb-4 flex items-center gap-3">
        <button onClick={onFechar} style={{ color: '#9FE1CB' }} className="text-2xl">‹</button>
        <div>
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold">Lista de Passageiros</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs">
            {format(diaSelecionado, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · {passageiros.length} passageiro{passageiros.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        <p className="text-xs text-gray-500">Preencha os dados abaixo. Placa e empresa ficam salvos para a próxima vez.</p>

        <Bloco titulo="Empresa">
          <Campo label="Nome fantasia">
            <input value={form.nome_empresa} onChange={e => setForm(f => ({ ...f, nome_empresa: e.target.value }))}
              placeholder="Ex: Van Silva Transportes" className="campo-input" />
          </Campo>
          <Campo label="Razão social">
            <input value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))}
              placeholder="Ex: Silva Transportes LTDA" className="campo-input" />
          </Campo>
          <Campo label="CNPJ">
            <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
              placeholder="00.000.000/0000-00" className="campo-input" />
          </Campo>
        </Bloco>

        <Bloco titulo="Veículo e motorista">
          <Campo label="Placa">
            <input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))}
              placeholder="AAA-0A00" className="campo-input" />
          </Campo>
          <Campo label="Motorista">
            <input value={form.motorista} onChange={e => setForm(f => ({ ...f, motorista: e.target.value }))}
              placeholder="Nome completo" className="campo-input" />
          </Campo>
        </Bloco>

        <Bloco titulo="Trajeto">
          <Campo label="Origem">
            <input value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
              placeholder="Ex: Boa Vista, RR" className="campo-input" />
          </Campo>
          <Campo label="Destino">
            <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
              placeholder="Ex: Manaus, AM" className="campo-input" />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Horário saída">
              <input type="time" value={form.horario_saida} onChange={e => setForm(f => ({ ...f, horario_saida: e.target.value }))}
                className="campo-input" />
            </Campo>
            <Campo label="Horário volta">
              <input type="time" value={form.horario_volta} onChange={e => setForm(f => ({ ...f, horario_volta: e.target.value }))}
                className="campo-input" />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Data da saída">
              <input type="date" value={form.data_saida} onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))}
                className="campo-input" />
            </Campo>
            <Campo label="Data da volta">
              <input type="date" value={form.data_volta} onChange={e => setForm(f => ({ ...f, data_volta: e.target.value }))}
                className="campo-input" />
            </Campo>
          </div>
        </Bloco>

        <Bloco titulo={`Passageiros no PDF (${passageiros.length})`}>
          {passageiros.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Nenhum passageiro.</p>
          ) : (
            passageiros.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
                <p className="text-sm text-gray-700 flex-1 truncate">{p.nome}</p>
                <input
                  value={documentos[p.id] || ''}
                  onChange={e => setDocumentos(d => ({ ...d, [p.id]: e.target.value }))}
                  placeholder="RG/CPF"
                  className="w-32 px-2 py-1.5 rounded-lg border border-gray-200 text-xs outline-none"
                />
              </div>
            ))
          )}
        </Bloco>

        <div className="h-4" />
      </div>

      <div className="px-4 py-4 border-t border-gray-200 bg-white">
        <button
          onClick={gerarPDF}
          disabled={gerando || passageiros.length === 0}
          className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: '#0F6E56' }}>
          {gerando ? 'Gerando...' : '📥 Baixar PDF'}
        </button>
      </div>

      <style jsx>{`
        .campo-input {
          width: 100%; padding: 10px 12px; border-radius: 12px;
          border: 1px solid #e5e7eb; font-size: 14px; color: #222;
          background: #fff; outline: none;
        }
        .campo-input:focus { border-color: #0F6E56; }
      `}</style>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{titulo}</p>
      {children}
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
