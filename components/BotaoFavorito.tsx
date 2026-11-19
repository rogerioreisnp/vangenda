'use client'

// Estrela de favoritar nas listas de clientes, motoristas e rotas. Amarela
// quando marcado, contorno cinza quando nao. stopPropagation pra nao disparar
// o clique do card em volta (abrir ficha, editar).
export default function BotaoFavorito({ ativo, onToggle, salvando = false }: {
  ativo: boolean
  onToggle: () => void
  salvando?: boolean
}) {
  return (
    <button type="button"
      onClick={e => { e.stopPropagation(); if (!salvando) onToggle() }}
      aria-label={ativo ? 'Remover dos favoritos' : 'Marcar como favorito'}
      aria-pressed={ativo}
      title={ativo ? 'Remover dos favoritos' : 'Marcar como favorito'}
      className="flex-shrink-0 flex items-center justify-center rounded-lg"
      style={{ width: 36, height: 36, fontSize: 20, lineHeight: 1, color: ativo ? '#F5A623' : '#CBD5E1', opacity: salvando ? 0.5 : 1 }}>
      {ativo ? '★' : '☆'}
    </button>
  )
}
