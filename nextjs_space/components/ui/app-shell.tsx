"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Building2,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Map,
  Menu,
  Search,
  Settings,
  Shield,
  X,
} from "lucide-react";

/**
 * Uygulama kabuğu: sabit sol menü + üst şerit.
 *
 * Her ikisi de `position: fixed`. İçeriğe yer açmayı sayfalara bırakmak
 * yerine kabuk `document.body`ye `shell-active` sınıfını yazar; boşluğu
 * globals.css'teki tek kural verir. Böylece <AppShell /> çağıran her sayfa
 * kendi <main> ölçülerini değiştirmeden doğru hizaya oturur.
 *
 * Menü öğeleri kullanıcının rolüne göre süzülür — yetkisi olmayan bağlantı
 * hiç çizilmez.
 */

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
  /** Alt yolları da aktif sayılsın mı (örn. /admin/users) */
  prefix?: boolean;
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Ana menü",
    items: [
      { href: "/dashboard", label: "Pano", icon: LayoutDashboard, roles: ["USER", "UNIT_MANAGER", "ADMIN"] },
      { href: "/survey", label: "Anket", icon: ClipboardList, roles: ["USER", "UNIT_MANAGER", "ADMIN"], prefix: true },
      { href: "/recommendations", label: "Öneriler", icon: Lightbulb, roles: ["USER", "UNIT_MANAGER", "ADMIN"] },
      { href: "/roadmap", label: "Yol haritası", icon: Map, roles: ["USER", "UNIT_MANAGER", "ADMIN"] },
      { href: "/unit-manager", label: "Birim takibi", icon: Building2, roles: ["UNIT_MANAGER", "ADMIN"], prefix: true },
    ],
  },
  {
    title: "Hesap",
    items: [
      { href: "/admin", label: "Yönetim", icon: Shield, roles: ["ADMIN"], prefix: true },
      { href: "/settings", label: "Ayarlar", icon: Settings, roles: ["USER", "UNIT_MANAGER", "ADMIN"] },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Yönetici",
  UNIT_MANAGER: "Birim yöneticisi",
  USER: "Kullanıcı",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toLocaleUpperCase("tr-TR")).join("") || "?";
}

export default function AppShell() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession() || {};

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const user = session?.user as
    | { firstName?: string; name?: string; email?: string; role?: string }
    | undefined;
  const role = user?.role ?? "USER";
  const userName = user?.firstName || user?.name || "Kullanıcı";

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
        (g) => g.items.length > 0,
      ),
    [role],
  );

  const isActive = useCallback(
    (item: NavItem) => (item.prefix ? pathname?.startsWith(item.href) : pathname === item.href) ?? false,
    [pathname],
  );

  /* Menü genişliği tercihini cihaz hatırlar. */
  useEffect(() => {
    setCollapsed(window.localStorage.getItem("shell-collapsed") === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("shell-collapsed", collapsed ? "1" : "0");
    document.body.classList.toggle("shell-collapsed", collapsed);
  }, [collapsed]);

  /* İçeriğin boşluğunu kabuk açar; sayfalar bunu bilmek zorunda değil. */
  useEffect(() => {
    document.body.classList.add("shell-active");
    return () => {
      document.body.classList.remove("shell-active", "shell-collapsed");
    };
  }, []);

  /* Yol değişince gezinme çekmecesi kapanır. */
  useEffect(() => {
    setDrawerOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  /* ⌘K / Ctrl+K aramaya odaklanır, Esc bırakır. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setDrawerOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Kullanıcı menüsü dışarı tıklamayla kapanır. */
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [userMenuOpen]);

  /* Arama gezinme içindir: eşleşen sayfalar süzülür, Enter ilkine gider. */
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return [];
    return groups
      .flatMap((g) => g.items)
      .filter((i) => i.label.toLocaleLowerCase("tr-TR").includes(q));
  }, [query, groups]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (matches[0]) {
      router.push(matches[0].href);
      setQuery("");
      searchRef.current?.blur();
    }
  };

  const navList = (
    <nav className="flex flex-col gap-6" aria-label="Ana gezinme">
      {groups.map((group) => (
        <div key={group.title}>
          {!collapsed && <p className="sidebar-group">{group.title}</p>}
          <ul className="flex flex-col gap-0.5 pl-3 pr-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`sidebar-item ${active ? "active" : ""} ${collapsed ? "justify-center" : ""}`}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={18} strokeWidth={1.9} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link
      href="/dashboard"
      className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}
      aria-label="Panoya git"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-[13px] font-semibold"
        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
      >
        DP
      </span>
      {!collapsed && (
        <span className="truncate text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          Dönüşüm Platformu
        </span>
      )}
    </Link>
  );

  return (
    <>
      {/* ---- Sol menü (masaüstü) ---- */}
      <aside
        className="sidebar fixed left-0 top-0 z-[var(--z-sticky)] hidden h-screen flex-col lg:flex"
        style={{ width: collapsed ? "var(--shell-sidebar-collapsed)" : "var(--shell-sidebar)" }}
      >
        <div
          className="flex items-center px-4"
          style={{ height: "var(--shell-topbar)", borderBottom: "1px solid var(--line)" }}
        >
          {brand}
        </div>

        <div className="flex-1 overflow-y-auto py-5">{navList}</div>

        <div className="p-3" style={{ borderTop: "1px solid var(--line)" }}>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="btn-ghost w-full"
            aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          >
            <ChevronLeft
              size={16}
              className="transition-transform duration-fast ease-out-quart"
              style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
            />
            {!collapsed && <span className="text-[13px]">Daralt</span>}
          </button>
        </div>
      </aside>

      {/* ---- Sol menü (mobil çekmece) ---- */}
      {drawerOpen && (
        <div className="lg:hidden">
          <div
            className="modal-backdrop fixed inset-0"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="sidebar fixed left-0 top-0 z-[var(--z-modal)] flex h-screen w-[var(--shell-sidebar)] flex-col"
            role="dialog"
            aria-label="Gezinme"
          >
            <div
              className="flex items-center justify-between px-4"
              style={{ height: "var(--shell-topbar)", borderBottom: "1px solid var(--line)" }}
            >
              {brand}
              <button type="button" className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Kapat">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-5">{navList}</div>
          </aside>
        </div>
      )}

      {/* ---- Üst şerit ---- */}
      <header
        className="fixed right-0 top-0 z-[var(--z-sticky)] flex items-center gap-3 px-4"
        style={{
          height: "var(--shell-topbar)",
          left: 0,
          background: "var(--rail)",
          borderBottom: "1px solid var(--line)",
        }}
        data-shell-topbar
      >
        <button
          type="button"
          className="icon-btn lg:hidden"
          onClick={() => setDrawerOpen(true)}
          aria-label="Menüyü aç"
        >
          <Menu size={18} />
        </button>

        <form onSubmit={submitSearch} className="relative w-full max-w-sm" role="search">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--ink-3)" }}
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sayfa ara"
            aria-label="Sayfalarda ara"
            className="theme-input"
            /* Dolgu inline: .theme-input'in kendi padding kuralı Tailwind'in
               pl-* yardımcılarını eziyor, ikon metnin üstüne biniyordu. */
            style={{ height: 36, paddingLeft: 34, paddingRight: 52 }}
          />
          <kbd
            className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-[11px] sm:block"
            style={{ color: "var(--ink-3)" }}
          >
            ⌘K
          </kbd>

          {matches.length > 0 && (
            <ul className="dropdown-menu absolute left-0 right-0 top-[calc(100%+6px)] py-1">
              {matches.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="dropdown-item flex items-center gap-2" onClick={() => setQuery("")}>
                    <m.icon size={15} />
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="ml-auto flex items-center gap-2" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5 transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold"
              style={{ background: "var(--surface-3)", color: "var(--ink)" }}
              aria-hidden="true"
            >
              {initials(userName)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                {userName}
              </span>
              <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                {ROLE_LABEL[role] ?? ROLE_LABEL.USER}
              </span>
            </span>
          </button>

          {userMenuOpen && (
            <div className="dropdown-menu absolute right-4 top-[calc(var(--shell-topbar)-8px)] w-52 py-1" role="menu">
              <Link href="/settings" className="dropdown-item flex items-center gap-2" role="menuitem">
                <Settings size={15} />
                Ayarlar
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="dropdown-item flex w-full items-center gap-2 text-left"
                role="menuitem"
              >
                <LogOut size={15} />
                Çıkış yap
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
