# Archivos de marca (SIGOV)

Reemplazá estos archivos para cambiar el logo sin tocar código. No los generes ni modifiques desde código.

## Archivos
- `sigov-logo.png` o `sigov-logo.svg`: logo principal oficial de SIGOV.
  - Medida sugerida: 1000 px de ancho o más, fondo transparente.
- `sigov-isotipo.png` o `sigov-isotipo.svg`: versión compacta/cuadrada (header, favicon, PWA).
  - Medida sugerida: cuadrado de 512 px o más, con el dibujo dentro del 80% central para que funcione como icono maskable.
  - Si falta, el sistema usa `sigov-logo`.
- `cuartel-escudo.jpg` (o .png): escudo del cuartel de la instalación (complementario, no compite con el logo de SIGOV).

## Reglas
- Usar el logo oficial con sus proporciones originales, sin deformar, recortar, recolorear ni recrear.
- Los nombres y extensiones deben coincidir con los indicados arriba (la app los referencia desde `lib/marca.ts`).
- Si algún archivo falta, la interfaz muestra el texto "SIGOV" como respaldo y no rompe el build.
