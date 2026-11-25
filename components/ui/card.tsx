import Image from "next/image";
import { CUARTEL } from "@/lib/cuartel.config";

type CardAcento = "fire" | "brass" | "alarm" | "none";

type CardProps = {
  children: React.ReactNode;
  /** Estampa el escudo como sello de confirmación en muy baja opacidad. */
  stamped?: boolean;
  className?: string;
  /** Si true, aplica efecto hover de elevación. */
  interactive?: boolean;
  /** Línea superior de acento. */
  acento?: CardAcento;
};

const ACENTO: Record<CardAcento, string> = {
  fire: "bg-gradient-to-r from-transparent via-fire to-transparent opacity-90",
  brass: "bg-gradient-to-r from-transparent via-brass to-transparent opacity-70",
  alarm: "bg-gradient-to-r from-transparent via-alarm to-transparent opacity-70",
  none: "bg-line/70",
};

export function Card({
  children,
  stamped = false,
  className = "",
  interactive = false,
  acento = "fire",
}: CardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[12px] border border-line bg-surface transition-all duration-150 ${
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-ink-muted/30 hover:shadow-[0_4px_16px_rgba(20,26,24,0.08)]"
          : "shadow-[0_1px_3px_rgba(20,26,24,0.06)]"
      } ${className}`}
    >
      <span
        aria-hidden
        className={`absolute left-0 right-0 top-0 z-20 block h-[2px] ${ACENTO[acento]}`}
      />

      {stamped ? (
        <Image
          src={CUARTEL.escudo}
          alt=""
          aria-hidden
          fill
          sizes="100%"
          className="pointer-events-none object-contain opacity-[0.04] mix-blend-multiply"
        />
      ) : null}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
