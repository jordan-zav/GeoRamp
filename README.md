# GeoRamp

<p align="center">
  <a href="https://github.com/jordan-zav/GeoRamp/actions/workflows/tests.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/jordan-zav/GeoRamp/tests.yml?branch=main&label=tests&style=flat-square"></a>
  <img alt="QGIS 3.34+" src="https://img.shields.io/badge/QGIS-3.34%2B-589632?style=flat-square&logo=qgis&logoColor=white">
  <a href="LICENSE"><img alt="GNU GPLv3" src="https://img.shields.io/badge/License-GPLv3-blue?style=flat-square"></a>
</p>

Plugin para QGIS que aplica rampas RGB y distribuciones estadísticas a bandas ráster, orientado a flujos de visualización geofísica.

## Funciones

- Distribuciones Linear, Normal, Equal Area y Log-Linear.
- Rampas integradas e importación de tablas RGB de texto.
- Histograma, estadísticas, límites manuales y previsualización.
- Visor ráster integrado con actualización en tiempo real.
- Selector visual de rampas y aplicación de una configuración a varias capas.
- Recorte por percentiles, procesamiento cancelable y manejo de NoData.
- Búsqueda y categorías de rampas, persistencia de tablas importadas y estilos QML.
- Interfaz en español e inglés con configuración persistente.
- Representación continua o discreta de 2 a 255 intervalos.

La guía de formatos y uso se encuentra en la documentación del plugin dentro de georamp/README.md.

## Instalación

1. Descarga el ZIP generado desde una release o desde los artefactos de GitHub Actions.
2. En QGIS abre Complementos → Administrar e instalar complementos.
3. Selecciona Instalar a partir de ZIP y elige el archivo descargado.

## Desarrollo

    python -m pip install -r requirements-dev.txt
    python -m pytest
    python scripts/package_plugin.py

| Path | Contenido |
| --- | --- |
| georamp | Código y metadatos del plugin |
| tests | Pruebas de las distribuciones y los metadatos |
| scripts/package_plugin.py | Empaquetado reproducible para QGIS |

## Licencia

Distribuido bajo la GNU General Public License v3.0 incluida en LICENSE. Este proyecto no distribuye tablas propietarias.
