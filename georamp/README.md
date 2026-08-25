# GeoRamp para QGIS

Plugin para QGIS 3.34 o superior que aplica rampas RGB y distribuciones estadísticas a bandas ráster.

## Funciones

- Interfaz en español o inglés, con preferencia guardada.
- Configuración persistente de rampa, distribución, número de intervalos, modo de representación, sigma, límites y banda.
- Linear, Normal, Equal Area (Histogram) y Log-Linear Distribution.
- De 2 a 255 intervalos, con representación continua o discreta. El valor inicial es 39 y las tablas importadas ajustan los intervalos al número de filas de color.
- Inversión de rampa y límites automáticos o manuales.
- Sigma configurable para Normal y desplazamiento opcional para Log-Linear.
- Histograma, estadísticas y tabla de cortes antes de aplicar.
- Visor ráster integrado con actualización en tiempo real al cambiar los parámetros.
- Veintisiete rampas integradas, incluidas rampas geofísicas, científicas, divergentes, topográficas y batimétricas.
- Buscador y categorías para navegar el catálogo de rampas.
- Galería permanente y filtrable con muestras visuales de todas las rampas e indicador de la activa.
- Modo multicapa para aplicar una configuración a varios rásteres seleccionados.
- Recorte configurable por percentiles para controlar valores extremos.
- Procesamiento en segundo plano con progreso y cancelación; NoData se excluye de estadísticas e histogramas.
- Persistencia de la última tabla RGB importada e intercambio de estilos QGIS QML.
- Importación de archivos CSV, TXT, TBL, ZON, CLR y LUT de texto.

## Formato de tabla

Se aceptan filas R,G,B o posición,R,G,B, separadas por comas, punto y coma o espacios. Las posiciones se ordenan y normalizan a 0-1. RGB debe estar entre 0 y 255.

    posición,R,G,B
    0,0,0,255
    25,0,255,255
    50,0,255,0
    75,255,255,0
    100,255,0,0

## Uso

1. Carga un ráster y abre Ráster → GeoRamp.
2. Elige idioma, capa, banda, rampa, distribución y número de intervalos.
3. Pulsa Previsualizar para revisar histograma y cortes.
4. Pulsa Aplicar.

## Instalación

Instala georamp.zip desde Complementos → Administrar e instalar complementos → Instalar a partir de ZIP.

## Alcance

Las rampas integradas son aproximaciones visuales y no tablas propietarias. El importador procesa tablas de texto, no formatos binarios o propietarios. La equivalencia exacta debe comprobarse con el mismo ráster y una tabla de referencia.
