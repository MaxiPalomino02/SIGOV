"use client";

import { useEffect } from "react";
import { iniciarSincronizador } from "@/lib/sincronizador";

export function Sincronizador() {
  useEffect(() => iniciarSincronizador(), []);
  return null;
}
