# Changelog

## 1.1.0 — Extent stretches and editable transfer curves (local development)

- Statistics from the whole raster, a fixed map-canvas extent, a following
  canvas extent, or a custom/drawn rectangle; per-layer CRS transformation.
- Histogram overlay of the rendered input-to-colour transfer on a separate
  percentage axis, with editable monotone control points, min/max handles,
  exact numeric entry, deletion and keyboard movement.
- Continuous manual curves include palette-stop crossings for exact shader
  interpolation; discrete rendering uses inverse-transfer upper bounds.
- Portable curve/extent metadata in QML custom properties; native shader
  colours remain usable in QGIS without GeoRamp.
- Source and user-defined NoData rules retained in statistics and preview.
- Applied layers follow canvas changes independently of the dialog, with
  per-layer styles, explicit stop controls and cancellation of outdated jobs.
- Polygon layers, selections, holes and drawn polygons define actual sample
  masks; masked areas and editable curves survive QML round trips.
- Visible Windows QGIS desktop review uses a public Terrain Tiles elevation
  tile in addition to synthetic GUI tests; original raster hashes are preserved.
- Scrollable settings keep polygon controls accessible in shorter windows.
- Local experimental build; not yet a public release.

## 1.0.0 — Primera versión para publicación

- Selección multicapa alfabética, por arrastre y por grupos de QGIS.
- Visor en tiempo real vinculado a la primera capa seleccionada.
- Galería de rampas adaptable a la altura de la ventana.
- Histograma con dibujo directo, coordenadas del cursor, media, mediana y moda aproximada.
- Cobertura observada de muestras dentro de media ± n desviaciones estándar.
- Saturación de valores extremos al usar percentiles y zonas discretas.

## Historial de desarrollo interno

Los números siguientes corresponden a compilaciones internas anteriores al
reinicio de numeración para la primera publicación 1.0.0.

## 1.5.0 - 2026-09-19

- Selección multicapa alfabética mediante arrastre, Ctrl o Shift.
- Vista alternativa que reproduce la jerarquía del Administrador de capas de QGIS.
- Selección de grupos para incluir todos sus rásteres descendientes.

## 1.4.2 - 2026-08-25

- Muestreo determinista de 512 por 512 compartido con la extensión de VS Code.
- Estadísticas, percentiles e histogramas reproducibles entre ambos plugins.

## 1.4.1 - 2026-08-25

- Selector desplegable sustituido por una galería permanente y filtrable de rampas.
- Indicador independiente para la rampa activa y su muestra de color.

## 1.4.0 - 2026-08-25

- Botones nativos para minimizar y maximizar la ventana.
- Muestra gráfica de colores para cada opción del selector de rampas.
- Modo de aplicación múltiple con selección de capas y procesamiento independiente.

## 1.3.0 - 2026-08-25

- Visor ráster integrado en la ventana de configuración.
- Actualización inmediata de rampas, distribución, intervalos y representación.
- Recálculo diferido y cancelable al cambiar banda, límites o percentiles.
- Navegación del visor mediante desplazamiento y rueda del ratón.

## 1.2.2 - 2026-08-25

- Casilla de leyenda compacta con ayuda integrada y cambio seguro a representación continua.

## 1.2.1 - 2026-08-25

- Interfaz de configuración reorganizada en dos columnas para pantallas con poca altura.

## 1.2.0 - 2026-08-25

- Veintisiete rampas integradas para datos geofísicos, científicos y topográficos.
- Mensajes de validación del motor localizados según el idioma de la interfaz.
- Nombres internos de rampas independientes del español y el inglés.
- Recorte por percentiles y exclusión segura de NoData, NaN e infinitos.
- Procesamiento en segundo plano con progreso y cancelación.
- Buscador, categorías, persistencia de tablas importadas e intercambio QML.

## 1.1.0 - 2026-08-14

- Interfaz en español e inglés.
- Configuración persistente de rampas y distribuciones.
- Empaquetado del plugin sin archivos de caché.

## 1.0.0 - 2026-08-14

- Primera versión pública del plugin.
