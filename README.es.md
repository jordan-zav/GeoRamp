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

Requiere QGIS 3.34 o superior. La fuente del complemento declara 1.0.0; la
publicación en el repositorio oficial de complementos está pendiente.

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
