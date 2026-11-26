export const PRODUCTO = {
  nombre: "SIGOV",
  nombreCompleto: "Sistema Integral de Gestión Operativa de Bomberos Voluntarios",
} as const;

export const LOGOS = {
  principal: "/brand/LOGO SIGOV.jpg",
  isotipo: "/brand/LOGO SIGOV.jpg",
} as const;

// Compatibilidad con código existente; único lugar que nombra los archivos del logo.
export const MARCA = {
  sigov: {
    nombre: PRODUCTO.nombre,
    denominacion: PRODUCTO.nombreCompleto,
    icono: LOGOS.isotipo,
    logo: LOGOS.principal,
  },
  cuartel: {
    escudo: "/brand/cuartel-escudo.jpg",
  },
} as const;

export const SIGOV_NOMBRE = PRODUCTO.nombre;
export const SIGOV_DENOMINACION = PRODUCTO.nombreCompleto;
