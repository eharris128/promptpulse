import { NextResponse } from "next/server";

export async function middleware(request: any) {
    console.log('🔧 MIDDLEWARE TEST - Running for:', request.nextUrl.pathname);
    
    // Simple test - just return next() to see if middleware runs
    if (request.nextUrl.pathname.startsWith("/auth")) {
        console.log('🔐 AUTH ROUTE TEST - Would handle auth here');
        return NextResponse.next();
    }

    // For all other routes, just continue
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         * - api (API routes)
         */
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api).*)",
    ],
}