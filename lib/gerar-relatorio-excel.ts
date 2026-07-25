/**
 * Gera Excel do relatorio consolidado usando exceljs. Cliente-side.
 * Formato profissional: cabecalho colorido, largura de colunas ajustada,
 * total na ultima linha em bold com formato R$.
 */
import ExcelJS from 'exceljs'
import type { LinhaConsolidado, ReciboConsolidadoProps } from '@/components/ReciboConsolidadoPDF'

const fmtData = (iso: string) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ''

export async function baixarRelatorioExcel(props: ReciboConsolidadoProps) {
  const { empresa, cliente, periodo, linhas } = props
  const wb = new ExcelJS.Workbook()
  wb.creator = empresa.nome
  wb.created = new Date()

  const ws = wb.addWorksheet('Atendimentos', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  })

  // Titulo empresa
  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = empresa.nome
  ws.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF0F6E56' } }
  ws.getCell('A1').alignment = { horizontal: 'left' }

  ws.mergeCells('A2:F2')
  ws.getCell('A2').value = [
    empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : null,
    empresa.inscricao_estadual ? `IE: ${empresa.inscricao_estadual}` : null,
    [empresa.endereco_rua, empresa.endereco_numero].filter(Boolean).join(', '),
    empresa.cidade && empresa.estado ? `${empresa.cidade}/${empresa.estado}` : null,
  ].filter(Boolean).join(' · ')
  ws.getCell('A2').font = { size: 9, color: { argb: 'FF6B7280' } }

  // Cliente + periodo
  ws.mergeCells('A4:F4')
  ws.getCell('A4').value = `Cliente: ${cliente.nome}`
  ws.getCell('A4').font = { size: 11, bold: true }

  ws.mergeCells('A5:F5')
  ws.getCell('A5').value =
    `Período: ${fmtData(periodo.inicio)} até ${fmtData(periodo.fim)} · ${linhas.length} atendimento${linhas.length !== 1 ? 's' : ''}`
  ws.getCell('A5').font = { size: 10 }

  // Header da tabela (linha 7)
  const headerRow = ws.getRow(7)
  headerRow.values = ['Nº', 'Data', 'Origem', 'Destino', 'Passageiro', 'Valor (R$)']
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6E56' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD9DCE3' } },
      left: { style: 'thin', color: { argb: 'FFD9DCE3' } },
      bottom: { style: 'thin', color: { argb: 'FFD9DCE3' } },
      right: { style: 'thin', color: { argb: 'FFD9DCE3' } },
    }
  })
  ws.getRow(7).height = 22

  // Linhas de dados
  linhas.forEach((l, i) => {
    const row = ws.addRow([
      l.numero || '—',
      fmtData(l.data_hora),
      l.origem,
      l.destino,
      l.passageiro || '—',
      Number(l.valor || 0),
    ])
    row.getCell(6).numFmt = 'R$ #,##0.00'
    if (i % 2 === 1) {
      row.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFBFC' } }
      })
    }
    row.eachCell(c => {
      c.border = {
        bottom: { style: 'hair', color: { argb: 'FFD9DCE3' } },
      }
    })
  })

  // Total
  const totalRow = ws.addRow(['', '', '', '', 'TOTAL', linhas.reduce((s, l) => s + Number(l.valor || 0), 0)])
  totalRow.font = { bold: true }
  totalRow.getCell(5).alignment = { horizontal: 'right' }
  totalRow.getCell(6).numFmt = 'R$ #,##0.00'
  totalRow.eachCell((c, colIdx) => {
    if (colIdx >= 5) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE1F5EE' } }
      c.font = { bold: true, color: { argb: 'FF0F6E56' } }
    }
  })

  // Largura das colunas
  ws.columns = [
    { width: 10 },  // Nº
    { width: 12 },  // Data
    { width: 30 },  // Origem
    { width: 30 },  // Destino
    { width: 25 },  // Passageiro
    { width: 15 },  // Valor
  ]

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const nomeArq = `relatorio-${cliente.nome.replace(/[^a-zA-Z0-9]/g, '_')}-${periodo.inicio}-a-${periodo.fim}.xlsx`
  a.href = url
  a.download = nomeArq
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
