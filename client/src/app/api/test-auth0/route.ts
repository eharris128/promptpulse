import { auth0 } from '@/lib/auth0';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Auth0 client...');
    
    // Test if auth0 client is initialized
    if (!auth0) {
      return NextResponse.json({ error: 'Auth0 client not initialized' }, { status: 500 });
    }

    // Try to get session
    const session = await auth0.getSession(request);
    
    return NextResponse.json({ 
      success: true, 
      hasSession: !!session,
      auth0Initialized: !!auth0
    });
  } catch (error) {
    console.error('Auth0 test error:', error);
    return NextResponse.json({ 
      error: 'Auth0 test failed', 
      message: error.message 
    }, { status: 500 });
  }
}