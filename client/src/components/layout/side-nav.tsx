"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Trophy, Settings, Users, Activity, Leaf, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SideNavProps {
  className?: string
  onClose?: () => void
  showCloseButton?: boolean
}

export function SideNav({ className, onClose, showCloseButton }: SideNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: BarChart3,
      active: pathname === "/"
    },
    {
      href: "/sessions",
      label: "Sessions",
      icon: Activity,
      active: pathname === "/sessions"
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: Trophy,
      active: pathname === "/leaderboard"
    },
    {
      href: "/teams",
      label: "Teams",
      icon: Users,
      active: pathname === "/teams" || pathname?.startsWith("/teams/")
    },
    {
      href: "/environment",
      label: "Environment",
      icon: Leaf,
      active: pathname === "/environment"
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      active: pathname === "/settings"
    },
  ];

  return (
    <nav className={cn("w-64 bg-card border-r border-border h-full flex flex-col", className)}>
      {/* Mobile Header */}
      {showCloseButton && onClose && (
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="font-bold text-xl text-foreground">
            PromptPulse
          </span>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Navigation Items */}
      <div className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                item.active
                  ? "bg-primary/10 text-primary border-r-2 border-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer Links */}
      <div className="px-3 py-4 border-t border-border">
        <a
          href="https://github.com/eharris128/promptpulse/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <span>Community</span>
        </a>
      </div>
    </nav>
  );
}
