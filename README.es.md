<p align="center"><a href="README.md">English</a> · <strong>Español</strong></p>

# GeoRamp

**Rampas científicas de color y exploración interactiva de rásteres en QGIS.**

Inspecciona distribuciones, elige un realce explícito y aplica tablas de color
continuas o clasificadas sin perder la semántica de NoData.

> Una rampa cambia la visualización, no los valores del ráster. Conserva el
> original y registra límites, recorte y clasificación utilizados.

## Elige la interfaz

| Producto | Uso |
| --- | --- |
| Complemento QGIS | Estilos sobre capas, estadísticas, histograma y exportación QML |
| Extensión VS Code | Vista previa acotada de GeoTIFF/BigTIFF durante revisión o desarrollo |

QGIS es el flujo GIS principal. La extensión VS Code está en desarrollo interno
y no sustituye el análisis espacial con CRS explícito.

## Instalar y empezar en QGIS

Requiere QGIS 3.34 o superior. La versión local 1.1.0 es experimental y todavía
no se ha publicado; parte de la base 1.0.0. Se probó con QGIS 3.44.12.

1. Obtén un ZIP desde [Releases](https://github.com/jordan-zav/GeoRamp/releases)
   cuando esté disponible, o genéralo con el empaquetador.
2. Abre Complementos → Administrar e instalar complementos → Instalar a partir de ZIP.
3. Activa GeoRamp y abre Ráster → GeoRamp.
4. Selecciona capas, banda, distribución y rampa.
5. Revisa histograma, límites y vista previa antes de aplicar.
6. Guarda el estilo QML si necesitas reproducir la presentación.

~~~powershell
python scripts/package_plugin.py
~~~

## Funciones y formatos

Incluye distribuciones lineal, normal, igual área/histograma y log-lineal;
27 rampas; inversión; recorte sigma o percentil; 2–255 intervalos; y presentación
continua o discreta. El histograma muestra estadísticas y cobertura alrededor
de la media. Admite selección múltiple y vista previa de la primera capa.
La interfaz se ofrece en español e inglés.

## Estiramiento por extensión y curva editable

En Configuración, Extensión estadística permite elegir el ráster completo,
el lienzo actual fijo, seguir el lienzo, un rectángulo o un área poligonal. Puedes
escribir las coordenadas o dibujar el rectángulo en el mapa principal con el
selector nativo de QGIS. La extensión se transforma al CRS de cada ráster y se
intersecta con su cobertura; los rectángulos reproyectados usan envolventes.
Los polígonos se transforman como geometrías y enmascaran las muestras exteriores
y sus huecos. Se admiten capas, selecciones de polígonos y dibujo sobre el mapa.
No se recortan ni modifican los valores originales del ráster.

Aplicar en modo Seguir el lienzo activa el estiramiento automático de las capas
del proyecto. Mover o ampliar el mapa actualiza sus renderizadores incluso al
cerrar GeoRamp. Se detiene con el botón de la ventana o desde el menú Ráster;
cambiar el estilo por otro medio también detiene el seguimiento de esa capa.
Cada capa conserva su propia rampa y parámetros. El muestreo es una grilla determinista
de 512 por 512 sobre el área seleccionada, no estadísticas de todos los píxeles.
Los límites manuales tienen prioridad hasta que los desactives.

En Histograma y cortes aparece la transferencia entrada → posición de color en
verde, con un eje porcentual derecho separado de la frecuencia del histograma.
Activa Editar curva de estiramiento para manipularla:

- Doble clic añade un punto; cerca del borde inferior/superior define mín./máx.
- Arrastra los nodos. No pueden cruzarse ni invertir el orden del estiramiento.
- Doble clic en un nodo o Intro abre sus valores numéricos; las flechas lo mueven.
- Clic derecho o Supr elimina puntos interiores. Restablecer curva recupera la
  distribución integrada anterior.

En continuo se conservan los nodos exactos de curva y rampa. Los intervalos
configuran la representación discreta. Se admiten hasta 64 puntos monótonos,
normalizados dentro de los límites; otra área puede reescalar su dominio.
Aplicar confirma los cambios; cerrar la vista previa no los aplica.

QML guarda el renderizador nativo y metadatos para recuperar la edición,
incluidos curva, límites, rampa, banda, NoData y área estadística. Al importar,
el área se restaura como extensión fija. QGIS representa el estilo sin requerir
GeoRamp; la extensión VS Code conserva su alcance anterior y no incorpora los
nuevos controles. Las [capturas y detalles de validación](README.md#extent-stretches-and-editable-curves)
están en la documentación inglesa.

Validación ejecutada: 21 pruebas Python, Ruff y GUI empaquetada en QGIS 3.44.12
con ráster sintético y perfil aislado. Se comprobaron selección/dibujo de área,
CRS, seguimiento, edición con ratón/teclado, QML, transparencia NoData, bandas,
tareas sucesivas, varias capas seguidas con rampas independientes, máscaras con
huecos y descarga del plugin durante un cálculo. El SHA-256 del ráster
no cambió. No se modificó el perfil real del usuario ni se usaron datos privados.

También se instaló el ZIP con el gestor de complementos en una sesión normal y
visible de QGIS para Windows, con perfil temporal. Se probó un DEM real público
de Terrain Tiles, tesela S13W073, y se revisaron las capturas. Las interacciones
fueron automatizadas; no se presenta como aceptación de un operador humano ni
como equivalencia exacta con software comercial. El [informe de validación](docs/VALIDATION_1_1_0.md)
detalla el alcance, fuentes y evidencias.

Las tablas CSV, TXT, TBL, ZON, CLR y LUT aceptan filas R,G,B o posición,R,G,B,
con separadores de coma, punto y coma o espacios. RGB debe estar entre 0 y 255;
las posiciones se ordenan y normalizan a 0–1:

~~~text
position,R,G,B
0,0,0,255
25,0,255,255
50,0,255,0
75,255,255,0
100,255,0,0
~~~

NoData se excluye de estadísticas e histogramas. El modelo logarítmico requiere
un dominio positivo válido o un desplazamiento revisado. Las rampas incluidas
son aproximaciones visuales independientes, no tablas comerciales propietarias.

## Extensión VS Code

La extensión declara 0.4.1. En la carpeta vscode-georamp:

~~~powershell
npm install
npm run typecheck
npm test
npm run build
npm run package:vsix
~~~

GeoRamp: Open GeoTIFF Viewer abre archivos TIF/TIFF. La vista previa de archivos
grandes se limita mediante georamp.previewMaxDimension y no es una exportación
a resolución completa. Admite preferencias, inspección y QML de pseudocolor
monobanda con las limitaciones descritas en su guía.

## Documentación y comprobación

- [Guía del complemento](georamp/README.md).
- [Guía de la extensión](vscode-georamp/README.md).
- [README inglés](README.md), con catálogo técnico y desarrollo.

~~~powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
~~~

Complementa las pruebas con rásteres constantes, sesgados, con signos opuestos
y abundante NoData. El código QGIS vive en georamp; la extensión en
vscode-georamp y las pruebas en tests.

## Licencia y contacto

[GNU GPL v3](LICENSE). Los paquetes externos conservan sus licencias.
Jordan Zavaleta — [correo](mailto:jordanzav@gisgeo.dev) · [GisGeo Dev](https://gisgeo.dev).
