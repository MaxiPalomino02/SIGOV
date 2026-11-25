"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Hoja } from "@/components/ui/hoja";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  pending?: boolean;
  onConfirm?: () => void;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  confirmDisabled = false,
  pending = false,
  onConfirm,
}: ModalProps) {
  const acciones = confirmLabel && onConfirm ? (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onClose} disabled={pending}>
        {cancelLabel}
      </Button>
      <Button variant="primary" onClick={onConfirm} disabled={pending || confirmDisabled}>
        {pending ? "Procesando…" : confirmLabel}
      </Button>
    </div>
  ) : undefined;

  return (
    <Hoja open={open} onClose={onClose} title={title} footer={acciones}>
      <div className="text-[17px] leading-relaxed text-label">{children}</div>
    </Hoja>
  );
}
