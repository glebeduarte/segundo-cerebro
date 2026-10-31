"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Hoje", d: "M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" },
  { href: "/tarefas", rotulo: "Tarefas", d: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
  { href: "/notas", rotulo: "Notas", d: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" },
  { href: "/mapa", rotulo: "Mapa", d: "M6 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M18 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 6.5 16 8M7 8l1.6 8M16.5 9.5 10.5 16.5" },
  { href: "/vida", rotulo: "Vida", d: "M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16zM12 4v8l6 4" },
];

export default function MenuMovel() {
  const p = usePathname();
  if (p.startsWith("/login") || p.startsWith("/auth")) return null;
  const ativo = (h: string) => (h === "/" ? p === "/" : p.startsWith(h));
  return (
    <nav className="menu-movel" aria-label="Navegação principal">
      {ITENS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={ativo(i.href) ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={i.d} /></svg>{i.rotulo}
        </Link>
      ))}
    </nav>
  );
}
