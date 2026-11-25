"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {
    error: null,
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="numero_ingreso"
            className="block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted"
          >
            Número de legajo
          </label>
          <span className="font-mono text-[11px] text-ink-faint">
            3 dígitos
          </span>
        </div>

        <input
          id="numero_ingreso"
          name="numero_ingreso"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          placeholder="042"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className="mt-2 h-16 w-full rounded-xl border border-line bg-bg/80 px-4 text-center font-mono text-3xl font-bold tracking-[0.3em] text-ink placeholder:tracking-normal placeholder:text-ink-faint transition-colors focus:border-fire focus:outline-none focus:ring-2 focus:ring-fire/30"
        />
      </div>

      {state.error ? (
        <p
          id="login-error"
          role="alert"
          className="animate-shake rounded-xl border border-fire/50 border-l-4 border-l-fire bg-fire/15 px-4 py-3 text-[14px] font-semibold text-ink"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
            className="group mt-1 inline-flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-fire/70 bg-fire px-6 text-[15px] font-bold uppercase tracking-[0.08em] text-ink shadow-[0_0_24px_rgba(198,40,40,0.28)] transition-all duration-200 hover:bg-fire-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? (
          "Ingresando al sistema…"
        ) : (
          <>
            <span>Ingresar</span>
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden
            />
          </>
        )}
      </button>
    </form>
  );
}
