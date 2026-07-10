import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  return {
    manifest: `/api/transfer/${params.slug}/manifest.json`,
  }
}

export default function TransferLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
