"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileText,
  History,
  Home,
  Menu,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Hoja } from "@/components/ui/hoja";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type GrupoMas = {
  titulo: string;
  items: NavItem[];
};

const INICIO: NavItem = { href: "/inicio", label: "Inicio", icon: Home };
const GUARDIAS: NavItem = { href: "/guardias", label: "Guardias", icon: Calendar };
const TAREAS: NavItem = { href: "/tareas", label: "Tareas", icon: ClipboardList };
const AVISOS_BASE: NavItem = { href: "/avisos", label: "Avisos", icon: Bell };
const CALENDARIO: NavItem = { href: "/calendario", label: "Calendario", icon: CalendarDays };
const HISTORIAL: NavItem = { href: "/historial", label: "Historial", icon: History };
const ADMINISTRACION: NavItem = { href: "/admin", label: "Administración", icon: ShieldAlert };
const ALARMA: NavItem = { href: "/alarma", label: "Alarma", icon: Siren };
const ALERTAS: NavItem = { href: "/alertas", label: "Alertas SMN", icon: TriangleAlert };

const REGISTRO: NavItem[] = [
  { href: "/incidentes", label: "Incidentes", icon: ClipboardList },
  { href: "/equipamiento", label: "Equipamiento", icon: Wrench },
  { href: "/chequeo", label: "Chequeo", icon: ClipboardCheck },
  { href: "/prevencion", label: "Prevención", icon: ShieldCheck },
];

const CONOCIMIENTO: NavItem[] = [
  { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
  { href: "/reportes", label: "Reportes", icon: FileText },
];

const ITEM_BASE =
  "relative inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const ITEM_ACTIVE = "bg-fire-light text-ink";
const ITEM_INACTIVE = "text-ink-muted hover:text-ink";

function esActivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ContadorBadge({ valor }: { valor: number }) {
  if (valor <= 0) return null;
  return (
    <span className="rounded-full bg-fire px-1.5 py-0.5 font-mono text-[10px] font-semibold text-surface">
      {valor}
    </span>
  );
}

function Subrayado() {
  return (
    <span
      aria-hidden
      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-fire"
    />
  );
}

function MenuMas({ grupos }: { grupos: GrupoMas[] }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abrirConTeclado = useRef(false);
  const items = grupos.flatMap((g) => g.items);
  const activo = items.some((item) => esActivo(pathname, item.href));

  useEffect(() => {
    if (!abierto) return;
    const actualizarPos = () => {
      const rect = botonRef.current?.getBoundingClientRect();
      if (rect) {
        setPos({ top: rect.bottom + 4, left: rect.left, minWidth: Math.max(rect.width, 240) });
      }
    };
    actualizarPos();
    window.addEventListener("resize", actualizarPos);
    window.addEventListener("scroll", actualizarPos, true);
    return () => {
      window.removeEventListener("resize", actualizarPos);
      window.removeEventListener("scroll", actualizarPos, true);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!contenedorRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setAbierto(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAbierto(false);
        botonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [abierto]);

  useEffect(() => {
    if (abierto && abrirConTeclado.current) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
      abrirConTeclado.current = false;
    }
  }, [abierto]);

  const navegarMenu = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const teclas = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!teclas.includes(event.key)) return;
    event.preventDefault();
    const nodos = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (nodos.length === 0) return;
    const actual = nodos.indexOf(document.activeElement as HTMLElement);
    let siguiente = actual;
    if (event.key === "ArrowDown") siguiente = (actual + 1) % nodos.length;
    if (event.key === "ArrowUp") siguiente = (actual - 1 + nodos.length) % nodos.length;
    if (event.key === "Home") siguiente = 0;
    if (event.key === "End") siguiente = nodos.length - 1;
    nodos[siguiente]?.focus();
  };

  return (
    <div ref={contenedorRef} className="relative shrink-0">
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={(event) => {
          if (!abierto && event.detail === 0) abrirConTeclado.current = true;
          setAbierto((valor) => !valor);
        }}
        className={`${ITEM_BASE} cursor-pointer ${activo ? ITEM_ACTIVE : ITEM_INACTIVE}`}
      >
        <span>Más</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-150 ${abierto ? "rotate-180" : ""} ${
            activo ? "text-fire" : "text-ink-muted"
          }`}
          aria-hidden
        />
        {activo ? <Subrayado /> : null}
      </button>

      {abierto && pos ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Más secciones"
          onKeyDown={navegarMenu}
          className="fixed z-50 rounded-[12px] border border-line bg-surface p-2 shadow-[0_8px_24px_rgba(20,26,24,0.12)] animate-slide-down"
          style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
        >
          {grupos.map((grupo, gi) => (
            <div key={grupo.titulo}>
              {gi > 0 ? <div className="my-1 h-px bg-line-subtle" aria-hidden /> : null}
              <p className="px-3 py-1.5 text-[13px] font-medium text-ink-muted">{grupo.titulo}</p>
              {grupo.items.map((item) => {
                const ItemIcono = item.icon;
                const itemActivo = esActivo(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={itemActivo ? "page" : undefined}
                    onClick={() => setAbierto(false)}
                    className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[16px] font-normal transition-colors ${
                      itemActivo
                        ? "bg-fire-light text-ink"
                        : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                    }`}
                  >
                    <ItemIcono
                      className={`h-4 w-4 ${itemActivo ? "text-fire" : "text-ink-muted"}`}
                      aria-hidden
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined ? <ContadorBadge valor={item.badge} /> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EnlaceNav({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const activo = esActivo(pathname, item.href);
  const Icono = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={activo ? "page" : undefined}
      aria-label={item.label}
      className={`${ITEM_BASE} ${activo ? ITEM_ACTIVE : ITEM_INACTIVE}`}
    >
      <Icono
        className={`h-4 w-4 ${activo ? "text-fire" : "text-ink-muted"}`}
        aria-hidden
      />
      <span>{item.label}</span>
      {item.badge !== undefined ? <ContadorBadge valor={item.badge} /> : null}
      {activo ? <Subrayado /> : null}
    </Link>
  );
}

function gruposMas(oficial: boolean): GrupoMas[] {
  return [
    { titulo: "Cuartel", items: [CALENDARIO, ALERTAS, HISTORIAL] },
    { titulo: "Registro", items: REGISTRO },
    { titulo: "Conocimiento", items: CONOCIMIENTO },
    ...(oficial ? [{ titulo: "Administración", items: [ADMINISTRACION] }] : []),
  ];
}

export function AppNav({
  oficial = false,
  avisosNoLeidos = 0,
}: {
  oficial?: boolean;
  avisosNoLeidos?: number;
}) {
  const avisos: NavItem = { ...AVISOS_BASE, badge: avisosNoLeidos || undefined };
  const principal: NavItem[] = [INICIO, GUARDIAS, TAREAS, avisos];

  return (
    <nav
      aria-label="Secciones del cuartel"
      className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {principal.map((item) => (
        <EnlaceNav key={item.href} item={item} />
      ))}
      <MenuMas grupos={gruposMas(oficial)} />
    </nav>
  );
}

const ITEM_MOVIL_BASE =
  "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors";

export function NavMovil({
  oficial = false,
  avisosNoLeidos = 0,
}: {
  oficial?: boolean;
  avisosNoLeidos?: number;
}) {
  const pathname = usePathname();
  const [masAbierto, setMasAbierto] = useState(false);
  const avisos: NavItem = { ...AVISOS_BASE, badge: avisosNoLeidos || undefined };
  const tabs = [INICIO, GUARDIAS, TAREAS, avisos];
  const grupos = [
    { titulo: "Cuartel", items: [CALENDARIO, ALERTAS, HISTORIAL] },
    { titulo: "Registro", items: REGISTRO },
    { titulo: "Conocimiento", items: CONOCIMIENTO },
    { titulo: "Administración", items: oficial ? [ADMINISTRACION, ALARMA] : [] },
  ].filter((g) => g.items.length > 0);
  const masActivo = grupos.flatMap((g) => g.items).some((item) => esActivo(pathname, item.href));

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-surface lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-1">
          {tabs.map((item) => {
            const activo = esActivo(pathname, item.href);
            const Icono = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={`${ITEM_MOVIL_BASE} rounded-md ${activo ? "bg-fire-light text-ink" : "text-ink-muted hover:text-ink"}`}
              >
                <span className="relative">
                  <Icono className={`h-5 w-5 ${activo ? "text-fire" : ""}`} aria-hidden />
                  {item.badge !== undefined ? (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fire px-1 dato-mono text-[9px] font-semibold text-surface">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span>{item.label}</span>
                {activo ? <span className="mt-0.5 h-0.5 w-6 rounded-full bg-fire" /> : null}
              </Link>
            );
          })}

          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={masAbierto}
            onClick={() => setMasAbierto(true)}
            className={`${ITEM_MOVIL_BASE} cursor-pointer rounded-md ${masActivo ? "bg-fire-light text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            <Menu className={`h-5 w-5 ${masActivo ? "text-fire" : ""}`} aria-hidden />
            <span>Más</span>
            {masActivo ? <span className="mt-0.5 h-0.5 w-6 rounded-full bg-fire" /> : null}
          </button>
        </div>
      </nav>

      <Hoja open={masAbierto} onClose={() => setMasAbierto(false)} title="Más secciones">
        <div className="space-y-5">
          {grupos.map((grupo) => (
            <section key={grupo.titulo}>
              <p className="text-[13px] font-medium text-ink-muted">{grupo.titulo}</p>
              <div className="mt-2 space-y-1">
                {grupo.items.map((item) => {
                  const activo = esActivo(pathname, item.href);
                  const Icono = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={activo ? "page" : undefined}
                      onClick={() => setMasAbierto(false)}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[16px] font-normal transition-colors ${
                        activo
                          ? "bg-fire-light text-ink"
                          : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                      }`}
                    >
                      <Icono
                        className={`h-5 w-5 ${activo ? "text-fire" : "text-ink-muted"}`}
                        aria-hidden
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined ? <ContadorBadge valor={item.badge} /> : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Hoja>
    </>
  );
}

