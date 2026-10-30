"""Native Qt histogram with a transfer overlay and editable control handles."""

import math

from qgis.PyQt.QtCore import QPointF, Qt, pyqtSignal
from qgis.PyQt.QtGui import QColor, QPainter, QPainterPath, QPen
from qgis.PyQt.QtWidgets import QWidget


class CurveHistogram(QWidget):
    pointAdded = pyqtSignal(float, float)
    pointMoved = pyqtSignal(int, float, float)
    pointRemoved = pyqtSignal(int)
    pointEditRequested = pyqtSignal(int)

    def __init__(self, draw_histogram):
        super().__init__()
        self.draw_histogram = draw_histogram
        self.plot_data = None
        self.sigma_range = None
        self.stat_markers = []
        self.hover = None
        self.readout = None
        self.transfer = []  # Absolute input value, colour position [0,1].
        self.controls = []
        self.editable = False
        self.discrete = False
        self.selected = None
        self.dragging = None
        self.setMouseTracking(True)
        self.setFocusPolicy(Qt.StrongFocus)
        self.setMinimumSize(320, 220)

    def to_pixel(self, value, colour):
        _, _, lo, hi, _ = self.plot_data
        return QPointF(
            78 + (value - lo) / (hi - lo) * (self.width() - 113),
            self.height() - 58 - colour * (self.height() - 110),
        )

    def from_pixel(self, position):
        _, _, lo, hi, _ = self.plot_data
        x = max(0.0, min(1.0, (position.x() - 78) / (self.width() - 113)))
        y = max(
            0.0, min(1.0, (self.height() - 58 - position.y()) / (self.height() - 110))
        )
        return lo + x * (hi - lo), y

    def nearest_handle(self, position):
        if not self.editable or not self.plot_data:
            return None
        nearest, distance = None, 11.0
        for i, (value, colour) in enumerate(self.controls):
            point = self.to_pixel(value, colour)
            candidate = math.hypot(point.x() - position.x(), point.y() - position.y())
            if candidate <= distance:
                nearest, distance = i, candidate
        return nearest

    def paintEvent(self, event):
        if self.plot_data is None:
            return
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        self.draw_histogram(
            painter,
            *self.plot_data,
            width=self.width(),
            height=self.height(),
            sigma_range=self.sigma_range,
            stat_markers=self.stat_markers,
        )
        if self.transfer:
            painter.save()
            painter.setClipRect(77, 51, self.width() - 111, self.height() - 108)
            painter.setPen(QPen(QColor("#00796b"), 2.5))
            painter.setBrush(Qt.NoBrush)
            path = QPainterPath()
            previous = None
            for value, colour in self.transfer:
                point = self.to_pixel(value, colour)
                if previous is None:
                    path.moveTo(point)
                else:
                    if self.discrete:
                        path.lineTo(point.x(), previous.y())
                    path.lineTo(point)
                previous = point
            painter.drawPath(path)
            painter.restore()
            painter.setPen(QColor("#00796b"))
            language = self.plot_data[-1]
            painter.drawText(
                self.width() - 235,
                18,
                "Posición de color (%)" if language == "es" else "Colour position (%)",
            )
            for percent in (0, 25, 50, 75, 100):
                y = round(self.height() - 58 - percent / 100 * (self.height() - 110))
                painter.drawText(
                    self.width() - 32,
                    y - 8,
                    32,
                    18,
                    Qt.AlignLeft | Qt.AlignVCenter,
                    str(percent),
                )
        if self.editable:
            for i, (value, colour) in enumerate(self.controls):
                point = self.to_pixel(value, colour)
                painter.setPen(QPen(QColor("#004d40"), 2))
                painter.setBrush(QColor("#f59e0b" if i == self.selected else "#ffffff"))
                painter.drawEllipse(point, 5.0, 5.0)
        if self.hover:
            x, y = self.hover
            painter.setPen(QColor("#475569"))
            painter.drawLine(x, 52, x, self.height() - 58)
            painter.drawLine(78, y, self.width() - 35, y)
        painter.end()

    def mousePressEvent(self, event):
        if not self.plot_data:
            return
        handle = self.nearest_handle(event.pos())
        if handle is not None:
            self.selected = handle
            self.setFocus()
            if event.button() == Qt.RightButton:
                self.pointRemoved.emit(handle)
            elif event.button() == Qt.LeftButton:
                self.dragging = handle
            self.update()

    def mouseReleaseEvent(self, event):
        self.dragging = None

    def mouseDoubleClickEvent(self, event):
        if not self.editable or not self.plot_data or event.button() != Qt.LeftButton:
            return
        handle = self.nearest_handle(event.pos())
        if handle is not None:
            self.pointEditRequested.emit(handle)
        elif (
            78 <= event.pos().x() <= self.width() - 35
            and 52 <= event.pos().y() <= self.height() - 58
        ):
            self.pointAdded.emit(*self.from_pixel(event.pos()))
        self.dragging = None

    def mouseMoveEvent(self, event):
        if self.plot_data is None:
            return
        if self.dragging is not None:
            self.pointMoved.emit(self.dragging, *self.from_pixel(event.pos()))
            return
        counts, _, _, _, language = self.plot_data
        x, y = event.pos().x(), event.pos().y()
        if not (78 <= x <= self.width() - 35 and 52 <= y <= self.height() - 58):
            self.leaveEvent(event)
            return
        value, colour = self.from_pixel(event.pos())
        index = min(len(counts) - 1, int((x - 78) / (self.width() - 113) * len(counts)))
        frequency = counts[index]
        self.hover = (
            x,
            self.height()
            - 58
            - round(frequency / max(1, max(counts)) * (self.height() - 110)),
        )
        if self.readout:
            label = "Frecuencia" if language == "es" else "Frequency"
            self.readout.setText(
                f"X: {value:.8g} · {label}: {frequency:,} · "
                + ("Posición del cursor" if language == "es" else "Cursor position")
                + f": {colour:.1%}"
            )
        self.update()

    def keyPressEvent(self, event):
        if (
            not self.editable
            or self.selected is None
            or not 0 <= self.selected < len(self.controls)
        ):
            return super().keyPressEvent(event)
        if event.key() in (Qt.Key_Delete, Qt.Key_Backspace):
            self.pointRemoved.emit(self.selected)
            self.selected = None
        elif event.key() in (Qt.Key_Return, Qt.Key_Enter):
            self.pointEditRequested.emit(self.selected)
        elif event.key() in (Qt.Key_Left, Qt.Key_Right, Qt.Key_Up, Qt.Key_Down):
            x, y = self.controls[self.selected]
            span = self.plot_data[3] - self.plot_data[2]
            x += (
                span
                * 0.01
                * (int(event.key() == Qt.Key_Right) - int(event.key() == Qt.Key_Left))
            )
            y += 0.01 * (
                int(event.key() == Qt.Key_Up) - int(event.key() == Qt.Key_Down)
            )
            self.pointMoved.emit(self.selected, x, y)
        else:
            super().keyPressEvent(event)

    def leaveEvent(self, event):
        self.hover = None
        if self.readout:
            self.readout.setText("X: — · Y: —")
        self.update()
