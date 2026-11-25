"use client";

import { useState, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserX, Search, Shield, Users, Award } from "lucide-react";
import { Badge, CARGOS, isCargo, type Cargo } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { crearBombero, darDeBajaBombero } from "./actions";
import type { RosterBombero } from "./page";

const inputClasses =
  "h-11 w-full rounded-xl border border-line bg-surface px-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-fire focus:outline-none focus:ring-2 focus:ring-fire/25 transition-all";

export function Admin({ bomberos }: { bomberos: RosterBombero[] }) {
  const router = useRouter();

  const [numeroIngreso, setNumeroIngreso] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState<Cargo>("Bombero");
  const [busqueda, setBusqueda] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [bajaId, setBajaId] = useState<string | null>(null);

  function limpiarAvisos() {
    setError(null);
    setAviso(null);
  }

  async function onAlta(event: FormEvent) {
    event.preventDefault();
    limpiarAvisos();
    setPendiente(true);
    const resultado = await crearBombero(Number(numeroIngreso), nombre, cargo);
    setPendiente(false);
    if (resultado.ok) {
      setNumeroIngreso("");
      setNombre("");
      setCargo("Bombero");
      setAviso("Bombero dado de alta exitosamente en el padrón.");
      router.refresh();
    } else {
      setError(resultado.error);
    }
  }

  async function onBaja(bomberoId: string) {
    limpiarAvisos();
    setPendiente(true);
    const resultado = await darDeBajaBombero(bomberoId);
    setPendiente(false);
    setBajaId(null);
    if (resultado.ok) {
      setAviso("Bombero dado de baja del padrón activo.");
      router.refresh();
    } else {
      setError(resultado.error);
    }
  }

  // KPIs
  const totalOficiales = useMemo(() => {
    return bomberos.filter((b) => b.cargo.includes("Oficial")).length;
  }, [bomberos]);

  // Filtrado en vivo del padrón
  const bomberosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return bomberos;
    const q = busqueda.toLowerCase().trim();
    return bomberos.filter(
      (b) =>
        b.nombre_completo.toLowerCase().includes(q) ||
        String(b.numero_ingreso).includes(q) ||
        b.cargo.toLowerCase().includes(q)
    );
  }, [bomberos, busqueda]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Cabecera */}
      <div>
        <h1 className="heading-display text-2xl text-ink sm:text-3xl">
          Panel de Administración del Padrón
        </h1>
        <p className="mt-1 text-[14px] sm:text-[15px] text-ink-muted">
          Gestión institucional de altas y bajas del cuerpo de bomberos.
        </p>
      </div>

      {/* Mini KPIs de la Dotación */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-2 text-ink-muted">
            <Users className="h-4 w-4 text-fire-soft" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider">
              Total Activos
            </span>
          </div>
          <p className="heading-display mt-1 text-2xl font-bold text-ink">
            {bomberos.length}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-2 text-ink-muted">
            <Shield className="h-4 w-4 text-brass" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider">
              Oficiales
            </span>
          </div>
          <p className="heading-display mt-1 text-2xl font-bold text-brass">
            {totalOficiales}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-2 text-ink-muted">
            <Award className="h-4 w-4 text-ok" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider">
              Estado de Dotación
            </span>
          </div>
          <p className="font-mono text-[13px] font-bold mt-1 text-ok">
            Padrón Sincronizado
          </p>
        </div>
      </div>

      {aviso ? (
        <p className="mt-4 rounded-xl border-l-4 border-ok bg-ok/10 px-4 py-3 text-[14px] font-bold text-ink animate-slide-up">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl border-l-4 border-fire bg-fire/10 px-4 py-3 text-[14px] font-bold text-ink animate-shake">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
        {/* Formulario de Alta */}
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-[0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <UserPlus className="h-5 w-5 text-fire-soft" />
            <h2 className="heading-display text-lg text-ink font-bold">
              Dar de Alta Bombero
            </h2>
          </div>

          <form onSubmit={onAlta} className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-ink-muted uppercase tracking-wider">
                Número de Ingreso / Legajo
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                required
                value={numeroIngreso}
                onChange={(e) => setNumeroIngreso(e.target.value)}
                className={inputClasses}
                placeholder="Ej.: 045"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-ink-muted uppercase tracking-wider">
                Apellido y Nombre
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClasses}
                placeholder="Ej.: Pérez, Juan Carlos"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-ink-muted uppercase tracking-wider">
                Jerarquía / Cargo
              </label>
              <select
                value={cargo}
                onChange={(e) => {
                  if (isCargo(e.target.value)) setCargo(e.target.value);
                }}
                className={inputClasses}
              >
                {CARGOS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              size="md"
              className="w-full h-11 text-[14px] font-bold uppercase tracking-wider shadow-[0_0_18px_rgba(198,40,40,0.22)]"
              disabled={pendiente}
            >
              <UserPlus className="h-4 w-4 mr-1" aria-hidden />
              {pendiente ? "Registrando…" : "Registrar en Padrón"}
            </Button>
          </form>
        </div>

        {/* Lista de Bomberos Activos con Buscador */}
        <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-[0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.16)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-ink-muted" />
              <h2 className="heading-display text-lg text-ink font-bold">
                Padrón Activo ({bomberosFiltrados.length})
              </h2>
            </div>

            {/* Buscador en vivo */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o legajo…"
                className="h-11 w-full sm:w-64 rounded-xl border border-line bg-surface-hover pl-9 pr-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-fire focus:outline-none focus:ring-2 focus:ring-fire/25"
              />
            </div>
          </div>

          {bomberosFiltrados.length === 0 ? (
            <p className="py-12 text-center text-[14px] text-ink-muted">
              No se encontraron bomberos que coincidan con la búsqueda.
            </p>
          ) : (
            <ul className="mt-4 max-h-[480px] overflow-y-auto space-y-2.5 pr-1 divide-y divide-line/40">
              {bomberosFiltrados.map((b) => (
                <li
                  key={b.id}
                  className="pt-2.5 first:pt-0 flex flex-wrap items-center justify-between gap-3 rounded-xl p-2.5 hover:bg-surface-hover transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-ink leading-tight">
                      {b.nombre_completo}
                    </p>
                    <p className="font-mono text-[12px] text-ink-muted">
                      Legajo N° {String(b.numero_ingreso).padStart(3, "0")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCargo(b.cargo) ? <Badge cargo={b.cargo} /> : null}

                    {bajaId === b.id ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => onBaja(b.id)}
                          disabled={pendiente}
                          className="h-11 px-3 text-[12px] bg-fire hover:bg-fire-dark"
                        >
                          Confirmar Baja
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setBajaId(null)}
                          disabled={pendiente}
                          className="h-11 px-3 text-[12px]"
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-11 px-2.5 text-[12px] text-ink-muted hover:text-fire-soft hover:bg-fire/10"
                        onClick={() => {
                          limpiarAvisos();
                          setBajaId(b.id);
                        }}
                        disabled={pendiente}
                      >
                        <UserX className="h-3.5 w-3.5 mr-1" aria-hidden />
                        Dar de baja
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
