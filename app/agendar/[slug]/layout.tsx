import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  return {
    manifest: `/api/agendar/${params.slug}/manifest.json`,
  }
}

export default function AgendarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
