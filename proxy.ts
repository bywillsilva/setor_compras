import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session'

const PUBLIC_PAGE_PATHS = new Set(['/auth/login', '/configuracoes'])
const PUBLIC_API_PATHS = new Set(['/api/auth/login', '/api/auth/logout', '/api/setup'])

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)

  if (pathname === '/auth/login') {
    if (!session) {
      return NextResponse.next()
    }

    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (session || PUBLIC_PAGE_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = '/auth/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

function isStaticAsset(pathname: string) {
  return pathname.startsWith('/_next') || pathname.startsWith('/uploads/') || /\.[a-zA-Z0-9]+$/.test(pathname)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
