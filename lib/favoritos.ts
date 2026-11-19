// Ordenacao padrao das listas de clientes, motoristas e rotas: favoritos
// primeiro, depois o resto, cada grupo em ordem alfabetica (pt-BR, ignorando
// acento e maiuscula). Pedido Julimar 2026-11-19.

type ComFavorito = { favorito?: boolean | null }

export function ordenarFavNome<T extends ComFavorito>(itens: T[], nome: (x: T) => string): T[] {
  return [...itens].sort((a, b) => {
    const fa = a.favorito ? 0 : 1
    const fb = b.favorito ? 0 : 1
    if (fa !== fb) return fa - fb
    return (nome(a) || '').localeCompare(nome(b) || '', 'pt-BR', { sensitivity: 'base' })
  })
}

// Para dropdowns <select>: separa em dois grupos ja ordenados, pra renderizar
// um <optgroup> "Favoritos" no topo e outro com os demais.
export function agruparFavoritos<T extends ComFavorito>(itens: T[], nome: (x: T) => string) {
  const ordenados = ordenarFavNome(itens, nome)
  return {
    favoritos: ordenados.filter(x => x.favorito),
    demais: ordenados.filter(x => !x.favorito),
    temFavorito: ordenados.some(x => x.favorito),
  }
}
