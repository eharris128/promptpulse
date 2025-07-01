import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ auth0: string }> }) {
  const { auth0: auth0Route } = await params

  switch (auth0Route) {
    case 'login':
      const loginUrl = new URL('/authorize', process.env.AUTH0_ISSUER_BASE_URL!)
      loginUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID!)
      loginUrl.searchParams.set('response_type', 'code')
      loginUrl.searchParams.set('redirect_uri', `${process.env.AUTH0_BASE_URL}/api/auth/callback`)
      loginUrl.searchParams.set('scope', 'openid profile email')
      
      return NextResponse.redirect(loginUrl.toString())

    case 'logout':
      // Clear any session cookies and redirect to Auth0 logout
      const logoutUrl = new URL('/v2/logout', process.env.AUTH0_ISSUER_BASE_URL!)
      logoutUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID!)
      logoutUrl.searchParams.set('returnTo', process.env.AUTH0_BASE_URL!)
      
      const response = NextResponse.redirect(logoutUrl.toString())
      response.cookies.delete('auth0_session')
      return response

    case 'callback':
      // For now, just redirect to home - we'll implement proper callback later
      // The main goal is to get basic auth working for API key generation
      return NextResponse.redirect(`${process.env.AUTH0_BASE_URL}/?auth=success`)

    default:
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}