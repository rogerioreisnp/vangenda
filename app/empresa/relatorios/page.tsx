'use client'
// Wrapper client que carrega o RelatoriosClient dinamicamente sem SSR.
// Necessario porque @react-pdf/renderer + exceljs quebram em SSG/SSR.
// Server components nao podem passar ssr:false pra dynamic, entao o
// wrapper e client tambem.
import dynamic from 'next/dynamic'

const RelatoriosClient = dynamic(() => import('./RelatoriosClient'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="animate-pulse text-4xl">📊</div>
    </div>
  ),
})

export default function Page() {
  return <RelatoriosClient />
}
