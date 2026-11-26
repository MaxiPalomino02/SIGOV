# Archivos de marca (SIGOV)

Reemplazá estos archivos para cambiar el logo sin tocar código. No los generes ni modifiques desde código.

## Archivos
- `LOGO SIGOV.jpg`: logo oficial de SIGOV. Se usa como logo principal y como isotipo; se muestra con `object-contain` para mantener sus proporciones.
- `cuartel-escudo.jpg`: escudo del cuartel de la instalación (complementario, no compite con el logo de SIGOV).

## Reglas
- Usar el logo oficial con sus proporciones originales, sin deformar, recortar, recolorear ni recrear.
- Los nombres y extensiones deben coincidir con los indicados arriba (la app los referencia desde `lib/marca.ts`).
- Si algún archivo falta, la interfaz muestra el texto "SIGOV" como respaldo y no rompe el build.
