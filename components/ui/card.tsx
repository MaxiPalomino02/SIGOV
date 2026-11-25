import Image from "next/image";
import { CUARTEL } from "@/lib/cuartel.config";

type CardAcento = "fire" | "brass" | "alarm" | "none";

type CardProps = {
  children: React.ReactNode;
  stamped?: boolean;
  className?: string;
  interactive?: boolean;
  acento?: CardAcento;
};

const ACENTO: Record<CardAcento, string> = {
  fire: "bg-red",
  brass: "bg-yellow",
  alarm: "bg-yellow",
  none: "bg-separator",
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
      className={`relative overflow-hidden rounded-[16px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${
        interactive ? "tap cursor-pointer hover:bg-surface-2" : ""
      } ${className}`}
    >
      <span aria-hidden className={`absolute inset-x-0 top-0 z-20 block h-[2px] ${ACENTO[acento]}`} />

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
