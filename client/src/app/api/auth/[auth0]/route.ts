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
      const logoutUrl = new URL('/v2/logout', process.env.AUTH0_ISSUER_BASE_URL!)
      logoutUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID!)
      logoutUrl.searchParams.set('returnTo', process.env.AUTH0_BASE_URL!)
      
      return NextResponse.redirect(logoutUrl.toString())

    case 'callback':
      // Extract the authorization code from the callback
      const url = new URL(request.url)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      
      if (!code) {
        return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 })
      }

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch(`${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: process.env.AUTH0_CLIENT_ID,
            client_secret: process.env.AUTH0_CLIENT_SECRET,
            code,
            redirect_uri: `${process.env.AUTH0_BASE_URL}/api/auth/callback`,
          }),
        })

        if (!tokenResponse.ok) {
          throw new Error('Token exchange failed')
        }

        const tokens = await tokenResponse.json()
        
        // Create response with cookies to maintain session
        const response = NextResponse.redirect(`${process.env.AUTH0_BASE_URL}/`)
        
        // Set httpOnly cookies for tokens (secure way)
        response.cookies.set('access_token', tokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: tokens.expires_in || 3600
        })
        
        if (tokens.id_token) {
          response.cookies.set('id_token', tokens.id_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: tokens.expires_in || 3600
          })
        }

        return response
      } catch (error) {
        console.error('Callback error:', error)
        return NextResponse.redirect(`${process.env.AUTH0_BASE_URL}/?error=callback_failed`)
      }

    case 'me':
      // Get user info from stored tokens
      try {
        const accessToken = request.cookies.get('access_token')?.value
        const idToken = request.cookies.get('id_token')?.value
        
        if (!accessToken) {
          return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Get user info from Auth0
        const userResponse = await fetch(`${process.env.AUTH0_ISSUER_BASE_URL}/userinfo`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (!userResponse.ok) {
          return NextResponse.json({ error: 'Failed to get user info' }, { status: 401 })
        }

        const user = await userResponse.json()
        return NextResponse.json({ user })
      } catch (error) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }

    default:
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}