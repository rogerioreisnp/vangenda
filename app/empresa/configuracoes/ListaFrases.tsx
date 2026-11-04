'use client'
import { useState } from 'react'

// A mensagem vai dentro de um link do WhatsApp (wa.me), entao os limites evitam
// um texto grande demais somado aos dados do atendimento.
const MAX_FRASES = 8
const MAX_CARACTERES = 150

// Lista de frases com editar, apagar e adicionar. Cada frase vira uma linha na
// mensagem. O que e digitado ja fica no estado da pagina: "Salvar alteracoes"
// nunca perde uma edicao que ficou aberta. Frase em branco some ao fechar.
export default function ListaFrases({ itens, onChange, exemplo }: {
  itens: string[]
  onChange: (itens: string[]) => void
  exemplo: string
}) {
  const [editando, setEditando] = useState<number | null>(null)
  const aberta = editando !== null && editando < itens.length ? editando : null
  const abertaEmBranco = aberta !== null && !itens[aberta].trim()

  function fechar() {
    if (abertaEmBranco) onChange(itens.filter((_, i) => i !== aberta))
    setEditando(null)
  }

  function editar(idx: number) {
    if (abertaEmBranco) {
      onChange(itens.filter((_, i) => i !== aberta))
      setEditando(idx > aberta! ? idx - 1 : idx)
      return
    }
    setEditando(idx)
  }

  function apagar(idx: number) {
    onChange(itens.filter((_, i) => i !== idx && !(abertaEmBranco && i === aberta)))
    setEditando(null)
  }

  function adicionar() {
    if (abertaEmBranco) return
    onChange([...itens, ''])
    setEditando(itens.length)
  }

  return (
    <div className="flex flex-col gap-2">
      {itens.length === 0 && (
        <p className="text-xs text-gray-400">Nenhuma frase. {exemplo}</p>
      )}

      {itens.map((frase, i) => i === aberta ? (
        <div key={i} className="flex flex-col gap-2 rounded-xl border p-2" style={{ borderColor: '#1D9E75' }}>
          <textarea
            autoFocus
            rows={3}
            maxLength={MAX_CARACTERES}
            value={frase}
            placeholder={exemplo}
            aria-label={`Frase ${i + 1}`}
            onChange={e => onChange(itens.map((f, j) => j === i ? e.target.value.replace(/\n/g, ' ') : f))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fechar() } }}
            className="w-full px-2 py-1.5 text-base text-gray-800 outline-none"
            style={{ resize: 'none' }}
          />
          <button type="button" onClick={fechar}
            className="self-end px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: '#1D9E75' }}>
            ✓ OK
          </button>
        </div>
      ) : (
        <div key={i} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
          <p className="flex-1 min-w-0 text-sm text-gray-700 break-words">{frase}</p>
          <button type="button" onClick={() => editar(i)}
            aria-label={`Editar frase: ${frase}`} title="Editar"
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: '#E1F5EE' }}>
            ✏️
          </button>
          <button type="button" onClick={() => apagar(i)}
            aria-label={`Apagar frase: ${frase}`} title="Apagar"
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: '#FCEBEB' }}>
            🗑️
          </button>
        </div>
      ))}

      {itens.length < MAX_FRASES && !abertaEmBranco && (
        <button type="button" onClick={adicionar}
          className="self-start px-3 py-2 rounded-lg text-xs font-semibold border"
          style={{ color: '#0F6E56', borderColor: '#9FE1CB' }}>
          + Adicionar frase
        </button>
      )}
    </div>
  )
}
