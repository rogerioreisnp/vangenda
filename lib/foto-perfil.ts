// Foto de perfil do motorista: bucket 'fotos-perfil', pasta = id do usuario
// (as policies so deixam cada um escrever na propria pasta). Ver
// supabase/migrations/foto_perfil_motorista.sql.

export const BUCKET_FOTOS = 'fotos-perfil'

// Foto de celular tem 3-8 MB; reduz pra no maximo `max` px no maior lado e
// grava em JPEG. Fica com ~50-100 KB e carrega rapido no link dos passageiros.
export async function reduzirImagem(file: File, max = 512): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => erro(new Error('Imagem invalida'))
      i.src = objectUrl
    })
    const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const largura = Math.max(1, Math.round(img.naturalWidth * escala))
    const altura = Math.max(1, Math.round(img.naturalHeight * escala))
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponivel')
    ctx.drawImage(img, 0, 0, largura, altura)
    return await new Promise<Blob>((ok, erro) =>
      canvas.toBlob(b => (b ? ok(b) : erro(new Error('Falha ao gerar JPEG'))), 'image/jpeg', 0.85))
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// Caminho dentro do bucket a partir da URL publica — pra apagar a foto antiga
// quando o motorista troca. null se a URL nao for deste bucket.
export function caminhoNoBucket(url: string | null | undefined): string | null {
  const marcador = `/storage/v1/object/public/${BUCKET_FOTOS}/`
  if (!url || !url.includes(marcador)) return null
  return decodeURIComponent(url.split(marcador)[1].split('?')[0])
}
