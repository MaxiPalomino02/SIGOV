"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export function AlertasRealtime() {
  const router = useRouter();

  useEffect(() => {
    let activo = true;
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let supabase: ReturnType<typeof createBrowserSupabaseClient> | null = null;

    try {
      supabase = createBrowserSupabaseClient();
    } catch {
      return;
    }

    const refrescar = () => {
      if (!activo) return;
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (activo) router.refresh();
      }, 300);
    };

    const canal = supabase
      .channel("sigov:alertas")
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas" }, refrescar)
      .subscribe();

    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") refrescar();
    }, 30000);

    return () => {
      activo = false;
      if (temporizador) clearTimeout(temporizador);
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      void supabase?.removeChannel(canal);
    };
  }, [router]);

  return null;
}
