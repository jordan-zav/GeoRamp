# Oasis Montaj Colour para QGIS

Plugin para QGIS 3.34 o superior que aplica rampas RGB y distribuciones estadísticas a bandas ráster.

## Funciones

- Interfaz en español o inglés, con preferencia guardada.
- Configuración persistente de rampa, distribución, number of bins, modo de representación, sigma, límites y banda.
- **Linear**, **Normal**, **Equal Area (Histogram)** y **Log-Linear Distribution**.
- De 2 a 255 bins, con representación continua o discreta. El valor inicial es 39 y las tablas importadas ajustan los bins al número de filas de color.
- Inversión de rampa y límites automáticos o manuales.
- Sigma configurable para Normal y desplazamiento opcional para Log-Linear.
- Histograma, estadísticas y tabla de cortes antes de aplicar.
- Siete rampas integradas. La rampa geofísica clásica usa 39 colores muestreados para aproximar la tabla de Oasis Montaj.
- Importación de `.csv`, `.txt`, `.tbl`, `.zon`, `.clr` y `.lut` de texto.

## Formato de tabla

Se aceptan filas `R,G,B` o `posición,R,G,B`, separadas por comas, punto y coma o espacios. Las posiciones se ordenan y normalizan a 0-1. RGB debe estar entre 0 y 255.

```text
posición,R,G,B
0,0,0,255
25,0,255,255
50,0,255,0
75,255,255,0
100,255,0,0
```

## Uso

1. Carga un ráster y abre **Ráster -> Oasis Montaj Colour**.
2. Elige idioma, capa, banda, rampa, distribución y number of bins.
3. Pulsa **Previsualizar** para revisar histograma y cortes.
4. Pulsa **Aplicar**.

## Instalación

Instala `oasis_montaj_colour.zip` desde **Complementos -> Administrar e instalar complementos -> Instalar a partir de ZIP**.

## Alcance

Las rampas integradas son aproximaciones visuales, no tablas propietarias de Seequent/Geosoft. El importador procesa tablas de texto, no formatos binarios o propietarios. La equivalencia exacta debe comprobarse con el mismo ráster y una tabla exportada real.
