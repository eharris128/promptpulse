"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function OAuthHandler() {
  const router = useRouter();

  useEffect(() => {
    // Clean up OAuth URL parameters if they exist
    const url = new URL(window.location.href);
    if (url.searchParams.has("code") || url.searchParams.has("state")) {
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      router.replace(url.pathname + url.search);
    }
  }, [router]);

  return null; // This component doesn't render anything
}
