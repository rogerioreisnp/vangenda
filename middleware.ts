import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// A proteção real de /empresa é feita em app/empresa/layout.tsx,
// que verifica a sessão e a tabela `gestores` no lado do cliente.
// Este middleware existe para registrar o matcher da rota — necessário
// para futuras proteções via @supabase/ssr quando o projeto migrar para SSR.
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/empresa/:path*'],
}
