"""Launch an isolated, visible QGIS desktop and test the installed ZIP on real DEM data."""

import argparse
import hashlib
import json
import os
import subprocess
import time
import traceback
import zipfile
from pathlib import Path


def desktop_checks():
    from qgis import utils
    from qgis.core import Qgis, QgsProject, QgsRectangle, QgsSettings
    from qgis.PyQt.QtCore import QEvent, QPoint, QPointF, Qt, QTimer
    from qgis.PyQt.QtGui import QMouseEvent
    from qgis.PyQt.QtTest import QTest
    from qgis.PyQt.QtWidgets import QApplication, QMessageBox

    root = Path(os.environ["GEORAMP_DESKTOP_REVIEW_ROOT"])
    dem = Path(os.environ["GEORAMP_DESKTOP_REVIEW_DEM"])
    iface = utils.iface
    checks = []
    report = {
        "qgis_version": Qgis.QGIS_VERSION,
        "platform": QApplication.platformName(),
        "desktop": True,
        "automated_gui_interaction": True,
        "human_manual_review": False,
        "dem": str(dem),
        "dem_sha256_before": hashlib.sha256(dem.read_bytes()).hexdigest(),
        "source_url": "https://s3.amazonaws.com/elevation-tiles-prod/skadi/S13/S13W073.hgt.gz",
        "attribution": "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
        "checks": checks,
        "status": "running",
    }
    (root / "desktop-pid.json").write_text(
        json.dumps({"pid": os.getpid()}), encoding="utf-8"
    )
    plugin = None
    warnings = []
    original_warning = QMessageBox.warning
    original_information = QMessageBox.information
    QMessageBox.warning = lambda *args: warnings.append(str(args[-1]))
    QMessageBox.information = lambda *args: None

    def record(name):
        checks.append({"name": name, "passed": True})
        (root / "desktop-results.json").write_text(
            json.dumps(report, indent=2), encoding="utf-8"
        )

    def wait(predicate, seconds=120):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            QApplication.processEvents()
            if predicate():
                return
            time.sleep(0.03)
        raise AssertionError("QGIS desktop review timed out")

    try:
        assert report["platform"] != "offscreen"
        assert iface.mainWindow().isVisible()
        QgsSettings().setValue("georamp/language", "en")
        QgsSettings().setValue("georamp/render", "continuous")
        QgsSettings().setValue("qgis/askToSaveProjectChanges", False)
        assert utils.loadPlugin("georamp")
        assert utils.startPlugin("georamp")
        plugin = utils.plugins["georamp"]
        layer = iface.addRasterLayer(str(dem), "Public terrain — Peru S13W073")
        assert layer is not None and layer.isValid()
        project = QgsProject.instance()
        project.setCrs(layer.crs())
        project.setTitle("GeoRamp — public terrain desktop review")
        canvas = iface.mapCanvas()
        canvas.setDestinationCrs(layer.crs())
        canvas.setExtent(layer.extent())
        canvas.refresh()
        iface.mainWindow().showMaximized()
        plugin.action.trigger()
        dialog = plugin.dialog
        available = QApplication.primaryScreen().availableGeometry()
        dialog.resize(
            min(1600, available.width() - 40), min(1000, available.height() - 60)
        )

        def settled():
            wait(
                lambda: (
                    dialog.last_analysis is not None
                    and dialog.active_task is None
                    and not dialog.live_timer.isActive()
                )
            )
            assert not warnings, warnings

        settled()
        assert dialog.last_analysis["sample_count"] > 1000
        whole = dict(dialog.last_analysis)
        report["dem_extent"] = whole["sample_extent"]
        report["whole_statistics"] = {
            key: whole[key] for key in ("minimum", "maximum", "mean", "sample_count")
        }
        record(
            "Installed ZIP loaded through QGIS plugin manager; public DEM statistics"
        )

        bounds = layer.extent()
        x0, y0, x1, y1 = (
            bounds.xMinimum(),
            bounds.yMinimum(),
            bounds.xMaximum(),
            bounds.yMaximum(),
        )
        first = QgsRectangle(
            x0 + 0.1 * (x1 - x0),
            y0 + 0.15 * (y1 - y0),
            x0 + 0.45 * (x1 - x0),
            y0 + 0.55 * (y1 - y0),
        )
        second = QgsRectangle(
            x0 + 0.55 * (x1 - x0),
            y0 + 0.45 * (y1 - y0),
            x0 + 0.9 * (x1 - x0),
            y0 + 0.85 * (y1 - y0),
        )
        canvas.setExtent(first)
        dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("canvas"))
        dialog.capture_canvas_extent()
        settled()
        assert dialog.last_analysis["sample_extent"] != whole["sample_extent"]
        record("Fixed-canvas statistics on real elevations")

        dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("follow"))
        settled()
        dialog.start_calculation("apply")
        settled()
        before = json.loads(layer.customProperty("georamp/stretch"))
        dialog.close()
        assert not dialog.isVisible()
        canvas.setExtent(second)
        canvas.refresh()
        wait(
            lambda: (
                json.loads(layer.customProperty("georamp/stretch"))["sample_extent"]
                != before["sample_extent"]
            )
        )
        after = json.loads(layer.customProperty("georamp/stretch"))
        assert (after["minimum"], after["maximum"]) != (
            before["minimum"],
            before["maximum"],
        )
        assert layer.renderer().classificationMin() == after["minimum"]
        canvas.waitWhileRendering()
        QApplication.processEvents()
        assert iface.mainWindow().grab().save(str(root / "qgis-desktop-real-dem.png"))
        report["follow_statistics"] = {
            "before": [before["minimum"], before["maximum"]],
            "after": [after["minimum"], after["maximum"]],
        }
        record("Applied map renderer follows the canvas while GeoRamp window is closed")
        plugin.action.trigger()
        settled()
        dialog.follow_stop_button.click()
        assert not plugin.follow_manager.layers
        stopped = layer.renderer().classificationMax()
        canvas.setExtent(first)
        canvas.refresh()
        settled()
        assert layer.renderer().classificationMax() == stopped
        record("Explicit stop freezes applied colours")

        dialog.extent_combo.setCurrentIndex(dialog.extent_combo.findData("polygon"))
        dialog.start_polygon_draw()
        wait(lambda: not dialog.isVisible())
        for point in (
            QPoint(canvas.width() // 4, canvas.height() * 3 // 4),
            QPoint(canvas.width() * 3 // 4, canvas.height() * 3 // 4),
            QPoint(canvas.width() // 4, canvas.height() // 4),
        ):
            QTest.mouseClick(canvas.viewport(), Qt.LeftButton, pos=point)
        QTest.mouseClick(
            canvas.viewport(),
            Qt.RightButton,
            pos=QPoint(canvas.width() // 4, canvas.height() // 4),
        )
        wait(dialog.isVisible)
        settled()
        assert dialog.last_analysis["area_wkb_hex"]
        assert 1000 < dialog.last_analysis["sample_count"] < 512 * 512 * 0.75
        report["polygon_samples"] = dialog.last_analysis["sample_count"]
        record("Drawn polygon masks real DEM sample centres")

        dialog.tabs.setCurrentIndex(1)
        dialog.edit_curve_check.setChecked(True)
        dialog.custom_curve = [(0.0, 0.0), (0.25, 0.55), (0.7, 0.85), (1.0, 1.0)]
        dialog.refresh_curve_preview()
        hist = dialog.histogram_label
        lo, hi = dialog.last_analysis["minimum"], dialog.last_analysis["maximum"]
        added = hist.to_pixel(lo + 0.48 * (hi - lo), 0.7).toPoint()
        QTest.mouseDClick(hist, Qt.LeftButton, pos=added)
        assert len(dialog.custom_curve) == 5
        index = hist.selected
        old = dialog.custom_curve[index]
        point = hist.to_pixel(*hist.controls[index]).toPoint()
        QTest.mousePress(hist, Qt.LeftButton, pos=point)
        QApplication.sendEvent(
            hist,
            QMouseEvent(
                QEvent.MouseMove,
                QPointF(point + QPoint(10, -8)),
                Qt.NoButton,
                Qt.LeftButton,
                Qt.NoModifier,
            ),
        )
        QTest.mouseRelease(hist, Qt.LeftButton, pos=point + QPoint(10, -8))
        assert dialog.custom_curve[index] != old
        record("Native desktop histogram accepts double-click and drag edits")
        dialog.start_calculation("apply")
        settled()
        qml = root / "GeoRamp-public-terrain.qml"
        message, ok = layer.saveNamedStyle(str(qml))
        assert ok, message
        shade_before = (
            layer.renderer().shader().rasterShaderFunction().shade((lo + hi) / 2)
        )
        message, ok = layer.loadNamedStyle(str(qml))
        assert ok, message
        assert (
            layer.renderer().shader().rasterShaderFunction().shade((lo + hi) / 2)
            == shade_before
        )
        assert dialog.restore_stretch_style(layer)
        assert dialog.extent_combo.currentData() == "polygon"
        report["qml"] = str(qml)
        QApplication.processEvents()
        assert dialog.grab().save(str(root / "qgis-desktop-curve.png"))
        dialog.tabs.setCurrentIndex(0)
        dialog.viewer_canvas.refresh()
        dialog.viewer_canvas.waitWhileRendering()
        QApplication.processEvents()
        assert dialog.grab().save(str(root / "qgis-desktop-polygon.png"))
        record("QML reload preserves actual desktop colours and editable polygon/curve")
        project.setFileName(str(root / "GeoRamp-public-terrain.qgz"))
        assert project.write()
        assert (
            hashlib.sha256(dem.read_bytes()).hexdigest() == report["dem_sha256_before"]
        )
        record("Original public elevation tile remains byte-identical")
        report["status"] = "passed"
    except Exception:  # noqa: BLE001 - persist any GUI failure before exiting QGIS
        report["status"] = "failed"
        report["error"] = traceback.format_exc()
    finally:
        report["warnings"] = warnings
        (root / "desktop-results.json").write_text(
            json.dumps(report, indent=2), encoding="utf-8"
        )
        if plugin is not None:
            utils.unloadPlugin("georamp")
            wait(
                lambda: (
                    plugin.follow_manager.task is None
                    and plugin.dialog.active_task is None
                )
            )
        iface.mapCanvas().stopRendering()
        QgsProject.instance().removeAllMapLayers()
        QgsProject.instance().setDirty(False)
        QMessageBox.warning = original_warning
        QMessageBox.information = original_information
        QTimer.singleShot(300, iface.actionExit().trigger)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--dem", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--qgis-bin", type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    plugins = output / "profiles/profiles/GeoRampReview/python/plugins"
    plugins.mkdir(parents=True)
    with zipfile.ZipFile(args.bundle) as archive:
        assert all(
            name.startswith("georamp/") and ".." not in Path(name).parts
            for name in archive.namelist()
        )
        archive.extractall(plugins)
    (output / "auth").mkdir()
    env = os.environ.copy()
    env.update(
        QT_QPA_PLATFORM="windows",
        GEORAMP_DESKTOP_REVIEW_ROOT=str(output),
        GEORAMP_DESKTOP_REVIEW_DEM=str(args.dem.resolve()),
        QGIS_AUTH_DB_DIR_PATH=str(output / "auth"),
    )
    command = [
        str(args.qgis_bin),
        "--profiles-path",
        str(output / "profiles"),
        "--profile",
        "GeoRampReview",
        "--lang",
        "en",
        "--nologo",
        "--noplugins",
        "--noversioncheck",
        "--nocustomization",
        "--hide-browser",
        "--code",
        str(Path(__file__).resolve()),
    ]
    started = time.monotonic()
    with (output / "qgis-console.log").open("w", encoding="utf-8") as log:
        result = subprocess.run(
            command,
            env=env,
            stdout=log,
            stderr=subprocess.STDOUT,
            timeout=240,
            check=False,
        )
    (output / "process-result.json").write_text(
        json.dumps(
            {"exit_code": result.returncode, "seconds": time.monotonic() - started}
        ),
        encoding="utf-8",
    )
    report = output / "desktop-results.json"
    if not report.is_file():
        raise RuntimeError(
            f"QGIS produced no report; inspect {output / 'qgis-console.log'}"
        )
    content = json.loads(report.read_text(encoding="utf-8"))
    print(json.dumps(content, indent=2))
    return 0 if result.returncode == 0 and content["status"] == "passed" else 1


if os.environ.get("GEORAMP_DESKTOP_REVIEW_ROOT"):
    from qgis.PyQt.QtCore import QTimer

    QTimer.singleShot(1800, desktop_checks)
elif __name__ == "__main__":
    raise SystemExit(main())
