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
- Extensión estadística del ráster completo, lienzo fijo, seguimiento del lienzo
  o rectángulo definido por coordenadas o dibujado en el mapa principal.
- Áreas poligonales desde capas, selecciones o dibujo libre; se excluyen los
  huecos y las muestras exteriores a la geometría real.
- Curva de transferencia superpuesta al histograma con eje porcentual propio,
  nodos editables, límites mín./máx., entrada numérica y controles de teclado.
- Curvas monótonas de hasta 64 nodos y metadatos de edición recuperables desde QML.
- Visor ráster integrado con actualización en tiempo real al cambiar los parámetros.
- Veintisiete rampas integradas, incluidas rampas geofísicas, científicas, divergentes, topográficas y batimétricas.
- Buscador y categorías para navegar el catálogo de rampas.
- Galería permanente y filtrable con muestras visuales de todas las rampas e indicador de la activa.
- Modo multicapa con vista alfabética y selección por arrastre, Ctrl o Shift.
- Vista del Administrador de capas que conserva la jerarquía de QGIS y permite seleccionar grupos completos.
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
2. Elige idioma, capa, banda, rampa, distribución y número de intervalos. En modo multicapa, usa la vista alfabética o la jerarquía del Administrador de capas.
3. Pulsa Previsualizar para revisar histograma y cortes.
4. Pulsa Aplicar.

## Instalación

Instala georamp-1.1.0.zip desde Complementos → Administrar e instalar complementos → Instalar a partir de ZIP. Requiere QGIS 3.34 o superior. Esta versión es experimental local; se probó en QGIS 3.44.12.

## Extensión y edición de curva

La selección de área afecta a estadísticas y límites, no recorta el ráster.
Las coordenadas se transforman al CRS de cada capa mediante QGIS y se usa su
envolvente rectangular. Las áreas vacías, sin variación o sin datos válidos
producen un aviso; no se sustituyen silenciosamente por la cobertura completa.
El muestreo es una grilla de 512 por 512 sobre esa área, no un recorrido completo.

Aplicar en modo Seguir el lienzo activa el estiramiento automático de las capas
del proyecto, incluso después de cerrar la ventana. El botón Detener o la acción
del menú Ráster lo desactiva. Cada capa mantiene su rampa, banda y parámetros.
Cambiar su estilo externamente también detiene el seguimiento. Los límites manuales
conservan prioridad hasta que se desactiven.

Puedes elegir un área poligonal desde una capa, usar solo los objetos
seleccionados o dibujarla con clics en el mapa. Clic derecho o Intro termina;
Esc cancela y Retroceso deshace un vértice. Las coordenadas se transforman al CRS
de cada ráster antes de muestrear; no basta con tomar su caja envolvente. QML
guarda la geometría del área como una instantánea, sin sus atributos.

La curva verde usa el eje derecho de posición de color; el histograma conserva
el eje izquierdo de frecuencia. Activa Editar curva de estiramiento para añadir
puntos con doble clic y arrastrarlos. Doble clic cerca de abajo/arriba ajusta
mín./máx.; doble clic en un nodo o Intro abre valores exactos. Las flechas mueven
el nodo seleccionado; Supr o clic derecho elimina nodos interiores. Los nodos
no pueden cruzarse ni invertir el orden de color. Restablecer curva recupera
la distribución integrada anterior.

Las curvas continuas usan los nodos de transferencia y cruces de la rampa;
el número de intervalos controla las curvas discretas. QML conserva colores
nativos, transparencia de rangos NoData y metadatos de edición. GeoRamp puede
recuperar la curva al importar el estilo; el área guardada se restaura fija.
Sin GeoRamp, QGIS sigue pudiendo representar el estilo nativo.

## Alcance

Las rampas integradas son aproximaciones visuales y no tablas propietarias. El importador procesa tablas de texto, no formatos binarios o propietarios. La equivalencia exacta debe comprobarse con el mismo ráster y una tabla de referencia.
