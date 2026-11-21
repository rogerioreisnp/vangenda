'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ModalListaPassageirosPDF from '@/components/ModalListaPassageirosPDF'
import {
  PassageiroFretamento,
  lerTextoPassageiros,
  limparListaPassageiros,
  normalizarListaDoBanco,
} from '@/lib/lista-passageiros'

/**
 * Lista nominal de passageiros de UM fretamento (igreja, empresa, excursão).
 *
 * Fica guardada no próprio fretamento (coluna lista_passageiros) — não se
 * mistura com os passageiros da rota do dia. Usada nos dois apps:
 *   - individual:  tabela `fretamentos`
 *   - empresarial: tabela `corridas_empresa` (fretamento/excursão da rota fixa)
 *
 * A lista é lida só quando a tela abre: se o banco ainda não tiver a coluna,
 * só esta tela avisa — o resto da agenda segue funcionando.
 */

type Linha = { chave: number; nome: string; documento: string }

export type DadosPdfFretamento = {
  dia: Date
  motorista?: string
  origem?: string
  destino?: string
  horarioSaida?: string
  horarioVolta?: string
  dataVolta?: string // yyyy-MM-dd
  tituloEvento?: string
}

export default function ListaPassageirosFretamento({
  tabela,
  registroId,
  titulo,
  subtitulo,
  pdf,
  onFechar,
}: {
  tabela: 'fretamentos' | 'corridas_empresa'
  registroId: string
  titulo: string
  subtitulo?: string
  pdf: DadosPdfFretamento
  onFechar: () => void
}) {
  const proximaChave = useRef(1)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [salvoJson, setSalvoJson] = useState('[]')
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [colarAberto, setColarAberto] = useState(false)
  const [textoColar, setTextoColar] = useState('')
  const [focarChave, setFocarChave] = useState<number | null>(null)
  const [pdfAberto, setPdfAberto] = useState(false)

  const novaLinha = (p?: PassageiroFretamento): Linha => ({
    chave: proximaChave.current++,
    nome: p?.nome || '',
    documento: p?.documento || '',
  })

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const { data, error } = await supabase
        .from(tabela)
        .select('lista_passageiros')
        .eq('id', registroId)
        .maybeSingle()
      if (!ativo) return
      if (error) {
        const faltaColuna = error.code === '42703' || /lista_passageiros/.test(error.message || '')
        setErroCarga(faltaColuna
          ? 'A lista de passageiros ainda está sendo ativada no sistema. Tente de novo em alguns minutos.'
          : 'Não foi possível abrir a lista: ' + error.message)
        setCarregando(false)
        return
      }
      const lista = normalizarListaDoBanco((data as any)?.lista_passageiros)
      setSalvoJson(JSON.stringify(limparListaPassageiros(lista)))
      setLinhas(lista.length > 0 ? lista.map(p => novaLinha(p)) : [novaLinha()])
      setCarregando(false)
    })()
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabela, registroId])

  const listaLimpa = limparListaPassageiros(linhas)
  const alterado = !carregando && !erroCarga && JSON.stringify(listaLimpa) !== salvoJson
  const previaColar = colarAberto ? lerTextoPassageiros(textoColar) : []

  function adicionar() {
    const l = novaLinha()
    setLinhas(ls => [...ls, l])
    setFocarChave(l.chave)
    setAviso(null)
  }

  function alterar(chave: number, campo: 'nome' | 'documento', valor: string) {
    setLinhas(ls => ls.map(l => l.chave === chave ? { ...l, [campo]: valor } : l))
    setAviso(null)
  }

  function remover(chave: number) {
    setLinhas(ls => {
      const resto = ls.filter(l => l.chave !== chave)
      return resto.length > 0 ? resto : [novaLinha()]
    })
    setAviso(null)
  }

  function adicionarColados() {
    if (previaColar.length === 0) return
    setLinhas(ls => {
      // Linhas em branco no fim (a que já vem aberta) somem — a lista
      // colada entra no lugar delas.
      const preenchidas = ls.filter(l => l.nome.trim() || l.documento.trim())
      return [...preenchidas, ...previaColar.map(p => novaLinha(p))]
    })
    setTextoColar('')
    setColarAberto(false)
    setAviso({ tipo: 'ok', texto: `${previaColar.length} passageiro${previaColar.length !== 1 ? 's' : ''} adicionado${previaColar.length !== 1 ? 's' : ''}. Confira e toque em Salvar.` })
  }

  async function salvar(): Promise<boolean> {
    setSalvando(true)
    setAviso(null)
    const { data, error } = await supabase
      .from(tabela)
      .update({ lista_passageiros: listaLimpa.length > 0 ? listaLimpa : null })
      .eq('id', registroId)
      .select('id')
    setSalvando(false)
    if (error) {
      setAviso({ tipo: 'erro', texto: 'Não foi possível salvar: ' + error.message })
      return false
    }
    if (!data || data.length === 0) {
      setAviso({ tipo: 'erro', texto: 'Não foi possível salvar: sem permissão para alterar este fretamento.' })
      return false
    }
    setSalvoJson(JSON.stringify(listaLimpa))
    setAviso({ tipo: 'ok', texto: '✓ Lista salva' })
    return true
  }

  async function gerarPdf() {
    if (listaLimpa.length === 0) return
    if (alterado && !(await salvar())) return
    setPdfAberto(true)
  }

  function fechar() {
    if (alterado && !confirm('A lista tem alterações não salvas. Sair mesmo assim?')) return
    onFechar()
  }

  const qtd = listaLimpa.length

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#f0f0ec' }}>
      <div style={{ background: '#0F6E56' }} className="px-4 pt-8 pb-4 flex items-center gap-3">
        <button onClick={fechar} style={{ color: '#9FE1CB' }} className="text-2xl leading-none" aria-label="Voltar">‹</button>
        <div className="min-w-0">
          <p style={{ color: '#E1F5EE' }} className="text-sm font-semibold truncate">Lista de passageiros · {titulo}</p>
          <p style={{ color: '#5DCAA5' }} className="text-xs truncate">
            {subtitulo ? `${subtitulo} · ` : ''}{qtd} passageiro{qtd !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {carregando ? (
          <p className="text-center text-sm text-gray-400 py-8">Carregando...</p>
        ) : erroCarga ? (
          <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#FCEBEB', color: '#A32D2D' }}>
            {erroCarga}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              Lista só deste fretamento — não mistura com os passageiros da rota do dia.
              Nome completo é o que a fiscalização (ANTT/PRF) pede; RG/CPF é opcional.
            </p>

            <div className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-col gap-2">
              {linhas.map((l, i) => (
                <div key={l.chave} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-6 text-right flex-shrink-0">{i + 1}.</span>
                  <input
                    value={l.nome}
                    autoFocus={focarChave === l.chave}
                    onChange={e => alterar(l.chave, 'nome', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar() } }}
                    placeholder="Nome completo"
                    enterKeyHint="next"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white outline-none focus:border-green-700"
                  />
                  <input
                    value={l.documento}
                    onChange={e => alterar(l.chave, 'documento', e.target.value)}
                    placeholder="RG/CPF"
                    className="w-24 sm:w-32 flex-shrink-0 px-2 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 bg-white outline-none focus:border-green-700"
                  />
                  <button
                    type="button"
                    onClick={() => remover(l.chave)}
                    aria-label={`Remover passageiro ${i + 1}`}
                    className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-sm"
                    style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                    🗑️
                  </button>
                </div>
              ))}

              <div className="flex gap-2 mt-1">
                <button type="button" onClick={adicionar}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#E1F5EE', color: '#0F6E56' }}>
                  + Adicionar passageiro
                </button>
                <button type="button" onClick={() => setColarAberto(v => !v)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#E6F1FB', color: '#185FA5' }}>
                  📋 Colar lista
                </button>
              </div>
            </div>

            {colarAberto && (
              <div className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-col gap-2">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Cole a lista que o cliente mandou (WhatsApp, Excel…). Um passageiro por linha.
                  Numeração é ignorada e, se tiver RG/CPF no fim da linha, ele vai para o campo do documento.
                </p>
                <textarea
                  value={textoColar}
                  onChange={e => setTextoColar(e.target.value)}
                  rows={6}
                  placeholder={'1. João da Silva\n2. Maria Souza - 123.456.789-00\n3. Pedro Alves'}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white outline-none resize-y focus:border-green-700"
                />
                <button type="button" onClick={adicionarColados} disabled={previaColar.length === 0}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: '#185FA5' }}>
                  {previaColar.length > 0
                    ? `Adicionar ${previaColar.length} passageiro${previaColar.length !== 1 ? 's' : ''} à lista`
                    : 'Adicionar à lista'}
                </button>
              </div>
            )}

            {aviso && (
              <p className="text-xs px-3 py-2 rounded-xl"
                style={aviso.tipo === 'ok'
                  ? { background: '#E1F5EE', color: '#0F6E56' }
                  : { background: '#FCEBEB', color: '#A32D2D' }}>
                {aviso.texto}
              </p>
            )}

            <div className="h-4" />
          </>
        )}
      </div>

      {!carregando && !erroCarga && (
        <div className="px-4 py-4 border-t border-gray-200 bg-white grid grid-cols-2 gap-2">
          <button onClick={() => { salvar() }} disabled={salvando || !alterado}
            className="py-3 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: '#E1F5EE', color: '#0F6E56' }}>
            {salvando ? 'Salvando...' : alterado ? '💾 Salvar lista' : '✓ Salva'}
          </button>
          <button onClick={gerarPdf} disabled={salvando || qtd === 0}
            className="py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ background: '#0F6E56' }}>
            📥 Gerar PDF
          </button>
        </div>
      )}

      {pdfAberto && (
        <ModalListaPassageirosPDF
          diaSelecionado={pdf.dia}
          passageiros={listaLimpa.map((p, i) => ({ id: String(i), nome: p.nome, documento: p.documento }))}
          nomeMotoristaSugerido={pdf.motorista || ''}
          origemSugerida={pdf.origem || ''}
          destinoSugerido={pdf.destino || ''}
          horarioSaidaSugerido={pdf.horarioSaida || ''}
          horarioVoltaSugerido={pdf.horarioVolta || ''}
          dataVoltaSugerida={pdf.dataVolta || ''}
          tituloEvento={pdf.tituloEvento || 'FRETAMENTO'}
          onFechar={() => setPdfAberto(false)}
        />
      )}
    </div>
  )
}
