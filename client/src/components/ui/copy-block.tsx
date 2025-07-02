"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

interface CopyBlockProps {
  children: React.ReactNode
  value: string
  className?: string
}

export function CopyBlock({ children, value, className = "" }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div
      className={`relative group cursor-pointer ${className}`}
      onClick={handleCopy}
    >
      <div className="bg-muted rounded-md p-3 pr-12 font-mono text-sm hover:bg-muted/80 transition-colors">
        {children}
      </div>
      <div className="absolute right-1 top-1 h-8 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </div>
    </div>
  );
}
