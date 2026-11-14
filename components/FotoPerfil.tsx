'use client'
import { useState } from 'react'

// Circulo de perfil: a foto quando existe, senao a inicial do nome. Se a foto
// nao carregar (apagada, sem internet), cai na inicial em vez de imagem quebrada.
export default function FotoPerfil({ url, nome, tamanho = 40 }: {
  url?: string | null
  nome?: string | null
  tamanho?: number
}) {
  const [falhou, setFalhou] = useState(false)
  const inicial = (nome?.trim()[0] || '?').toUpperCase()

  if (url && !falhou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={nome ? `Foto de ${nome}` : 'Foto de perfil'}
        onError={() => setFalhou(true)}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: tamanho, height: tamanho }} />
    )
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      aria-hidden="true"
      style={{ width: tamanho, height: tamanho, background: '#E1F5EE', color: '#0F6E56', fontSize: Math.round(tamanho * 0.42) }}>
      {inicial}
    </div>
  )
}
