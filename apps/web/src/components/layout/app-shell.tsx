"use client";

import {
  BarChart3,
  Calendar,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Menu,
  ScrollText,
  Search,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_BY_ROLE, type NavIcon, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";

const ICONS: Record<NavIcon, LucideIcon> = {
  calendar: Calendar,
  search: Search,
  "credit-card": CreditCard,
  "calendar-clock": CalendarClock,
  stethoscope: Stethoscope,
  users: Users,
  "scroll-text": ScrollText,
  clipboard: ClipboardList,
  chart: BarChart3,
};

interface ShellUser {
  fullName: string;
  email: string;
  role: Role;
  roleLabel: string;
}

function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function SidebarContent({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[user.role];

  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Logo tone="light" showTagline size="sm" />

      <nav aria-label="Menú principal" className="flex flex-1 flex-col gap-1">
        <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-white/50 uppercase">
          {user.roleLabel}
        </p>
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-white shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border pt-4">
        <div className="flex items-center gap-3 px-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary text-sm font-bold text-white">
            {initials(user.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
            <p className="truncate text-xs text-white/60">{user.email}</p>
          </div>
        </div>
        <LogoutButton className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white" />
      </div>
    </div>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr] print:block">
      {/* Barra lateral fija en escritorio */}
      <aside className="sticky top-0 hidden h-dvh bg-sidebar lg:block print:hidden">
        <SidebarContent user={user} />
      </aside>

      {/* Barra superior con menú desplegable en celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-white/95 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        <Logo size="sm" />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Abrir menú">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-none bg-sidebar p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menú</SheetTitle>
              <SheetDescription>Opciones disponibles para tu perfil</SheetDescription>
            </SheetHeader>
            <SidebarContent user={user} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
