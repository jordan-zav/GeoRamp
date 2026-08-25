export interface ColorStop {
  position: number;
  color: string; // Hex string #RRGGBB
}

export interface PaletteInfo {
  id: string;
  nameEs: string;
  nameEn: string;
  category: 'geophysics' | 'scientific' | 'diverging' | 'topographic' | 'classic' | 'custom';
  stops: ColorStop[];
}

function makePalette(hexColors: string[]): ColorStop[] {
  const len = hexColors.length;
  return hexColors.map((c, i) => ({
    position: i / (len - 1),
    color: c,
  }));
}

export const BUILTIN_PALETTES: PaletteInfo[] = [
  {
    id: "classic_geophysics",
    nameEs: "Geofísica clásica",
    nameEn: "Classic geophysics",
    category: "geophysics",
    stops: makePalette([
      "#0000ff", "#0055ff", "#007fff", "#00aaff", "#00d4ff", "#00e9ff", "#00ffff",
      "#00ffc8", "#00ff91", "#00ff3f", "#00ff31", "#00ff24", "#00ff00", "#48ff00",
      "#63ff00", "#6dff00", "#8eff00", "#b6ff00", "#c9ff00", "#f4ff00", "#ffec00",
      "#ffd500", "#ffcb00", "#ffbc00", "#ffaf00", "#ffaa00", "#ff9400", "#ff8700",
      "#ff7700", "#ff6a00", "#ff5500", "#ff3500", "#ff1500", "#ff0000", "#ff0037",
      "#ff006d", "#ff00b6", "#ff0bda", "#ff41ec", "#ff79ff", "#ff9fff",
    ]),
  },
  {
    id: "intense_geophysics",
    nameEs: "Geofísica intensa",
    nameEn: "Intense geophysics",
    category: "geophysics",
    stops: makePalette(["#000000", "#0000a0", "#006cff", "#00ffff", "#00c800", "#ffff00", "#ff7800", "#d00000", "#ffffff"]),
  },
  {
    id: "full_spectrum",
    nameEs: "Espectro completo",
    nameEn: "Full spectrum",
    category: "scientific",
    stops: makePalette(["#6a00a8", "#0000ff", "#00bfff", "#00ff80", "#ffff00", "#ff8000", "#ff0000"]),
  },
  {
    id: "viridis",
    nameEs: "Viridis",
    nameEn: "Viridis",
    category: "scientific",
    stops: makePalette(["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"]),
  },
  {
    id: "terrain",
    nameEs: "Terreno",
    nameEn: "Terrain",
    category: "topographic",
    stops: makePalette(["#0033a0", "#18a6a6", "#4caf50", "#d8c477", "#8c5a32", "#ffffff"]),
  },
  {
    id: "blue_white_red",
    nameEs: "Anomalías azul-blanco-rojo",
    nameEn: "Blue-white-red anomalies",
    category: "diverging",
    stops: makePalette(["#053061", "#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b", "#67001f"]),
  },
  {
    id: "grayscale",
    nameEs: "Escala de grises",
    nameEn: "Grayscale",
    category: "classic",
    stops: makePalette(["#000000", "#ffffff"]),
  },
  {
    id: "turbo",
    nameEs: "Turbo",
    nameEn: "Turbo",
    category: "scientific",
    stops: makePalette(["#30123b", "#4662d7", "#35abf8", "#1ae4b6", "#72fe5e", "#c8ef34", "#faba39", "#f66b19", "#ca2a04", "#7a0403"]),
  },
  {
    id: "plasma",
    nameEs: "Plasma",
    nameEn: "Plasma",
    category: "scientific",
    stops: makePalette(["#0d0887", "#6a00a8", "#b12a90", "#e16462", "#fca636", "#f0f921"]),
  },
  {
    id: "inferno",
    nameEs: "Inferno",
    nameEn: "Inferno",
    category: "scientific",
    stops: makePalette(["#000004", "#320a5f", "#781c6d", "#bb3754", "#ed6925", "#fbb61a", "#fcffa4"]),
  },
  {
    id: "magma",
    nameEs: "Magma",
    nameEn: "Magma",
    category: "scientific",
    stops: makePalette(["#000004", "#2c115f", "#721f81", "#b73779", "#f1605d", "#feb078", "#fcfdbf"]),
  },
  {
    id: "cividis",
    nameEs: "Cividis",
    nameEn: "Cividis",
    category: "scientific",
    stops: makePalette(["#00204c", "#31446b", "#666970", "#958f78", "#c8b866", "#ffea46"]),
  },
  {
    id: "cubehelix",
    nameEs: "Cubehelix",
    nameEn: "Cubehelix",
    category: "scientific",
    stops: makePalette(["#000000", "#1a2441", "#154e4b", "#5a6a3a", "#a07963", "#c29abd", "#c6d3f1", "#ffffff"]),
  },
  {
    id: "spectral",
    nameEs: "Espectral",
    nameEn: "Spectral",
    category: "diverging",
    stops: makePalette(["#9e0142", "#d53e4f", "#f46d43", "#fee08b", "#ffffbf", "#e6f598", "#66c2a5", "#3288bd", "#5e4fa2"]),
  },
  {
    id: "coolwarm",
    nameEs: "Frío-cálido",
    nameEn: "Cool to warm",
    category: "diverging",
    stops: makePalette(["#3b4cc0", "#7092f3", "#aac7fd", "#dddddd", "#f7b89c", "#e7755b", "#b40426"]),
  },
  {
    id: "seismic",
    nameEs: "Sísmica",
    nameEn: "Seismic",
    category: "geophysics",
    stops: makePalette(["#00004c", "#0000ff", "#00ffff", "#ffffff", "#ffff00", "#ff0000", "#4c0000"]),
  },
  {
    id: "jet",
    nameEs: "Jet",
    nameEn: "Jet",
    category: "classic",
    stops: makePalette(["#00007f", "#0000ff", "#007fff", "#00ffff", "#7fff7f", "#ffff00", "#ff7f00", "#ff0000", "#7f0000"]),
  },
  {
    id: "rainbow",
    nameEs: "Arcoíris",
    nameEn: "Rainbow",
    category: "scientific",
    stops: makePalette(["#6e40aa", "#417de0", "#1ac7c2", "#6ee263", "#d5e21a", "#ffb31a", "#f75c2f", "#d62f8c"]),
  },
  {
    id: "ocean",
    nameEs: "Océano",
    nameEn: "Ocean",
    category: "topographic",
    stops: makePalette(["#00112b", "#003f5c", "#007f8b", "#29b6a8", "#a8e6cf", "#f5ffff"]),
  },
  {
    id: "bathymetry",
    nameEs: "Batimetría",
    nameEn: "Bathymetry",
    category: "topographic",
    stops: makePalette(["#081d58", "#253494", "#225ea8", "#1d91c0", "#41b6c4", "#7fcdbb", "#c7e9b4", "#edf8b1"]),
  },
  {
    id: "elevation",
    nameEs: "Elevación",
    nameEn: "Elevation",
    category: "topographic",
    stops: makePalette(["#0b5d1e", "#4c9a2a", "#b7c95b", "#d9c28f", "#9b7653", "#6b4f3a", "#ffffff"]),
  },
  {
    id: "hot",
    nameEs: "Caliente",
    nameEn: "Hot",
    category: "classic",
    stops: makePalette(["#000000", "#7f0000", "#ff0000", "#ff7f00", "#ffff00", "#ffffff"]),
  },
  {
    id: "copper",
    nameEs: "Cobre",
    nameEn: "Copper",
    category: "classic",
    stops: makePalette(["#000000", "#3d2618", "#7a4b2f", "#b8734a", "#e8a878", "#ffd8b1"]),
  },
  {
    id: "blue_green",
    nameEs: "Azul-verde",
    nameEn: "Blue to green",
    category: "scientific",
    stops: makePalette(["#081d58", "#225ea8", "#1d91c0", "#41b6c4", "#7fcdbb", "#c7e9b4", "#ffffcc"]),
  },
  {
    id: "green_magenta",
    nameEs: "Verde-magenta",
    nameEn: "Green to magenta",
    category: "diverging",
    stops: makePalette(["#276419", "#7fbc41", "#d9f0d3", "#f7f7f7", "#fde0ef", "#de77ae", "#8e0152"]),
  },
  {
    id: "ice_fire",
    nameEs: "Hielo-fuego",
    nameEn: "Ice to fire",
    category: "diverging",
    stops: makePalette(["#001f4d", "#0066cc", "#66ccff", "#e8f8ff", "#fff2d8", "#ff9933", "#cc2200", "#4d0000"]),
  },
  {
    id: "earth",
    nameEs: "Tierra",
    nameEn: "Earth",
    category: "topographic",
    stops: makePalette(["#1b4332", "#52734d", "#9b8b5a", "#c2a878", "#8d6e63", "#5d4037", "#eeeeee"]),
  },
];

export function reverseStops(stops: ColorStop[]): ColorStop[] {
  return stops.map((s, i) => ({
    position: s.position,
    color: stops[stops.length - 1 - i].color,
  }));
}

export function parseHex(colorStr: string): [number, number, number] {
  let hex = colorStr.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function interpolateColor(stops: ColorStop[], t: number): [number, number, number] {
  const clampedT = Math.max(0, Math.min(1, t));
  if (clampedT <= stops[0].position) return parseHex(stops[0].color);
  if (clampedT >= stops[stops.length - 1].position) return parseHex(stops[stops.length - 1].color);

  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (clampedT >= s1.position && clampedT <= s2.position) {
      const range = s2.position - s1.position;
      const factor = range > 0 ? (clampedT - s1.position) / range : 0;
      const [r1, g1, b1] = parseHex(s1.color);
      const [r2, g2, b2] = parseHex(s2.color);
      return [
        Math.round(r1 + factor * (r2 - r1)),
        Math.round(g1 + factor * (g2 - g1)),
        Math.round(b1 + factor * (b2 - b1)),
      ];
    }
  }
  return parseHex(stops[stops.length - 1].color);
}

export function parseRgbTable(content: string, name: string): PaletteInfo {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const rows: { pos?: number; r: number; g: number; b: number }[] = [];

  for (const line of lines) {
    const parts = line.split(/[,;\s]+/).map(Number).filter((n) => !isNaN(n));
    if (parts.length === 3) {
      rows.push({ r: parts[0], g: parts[1], b: parts[2] });
    } else if (parts.length >= 4) {
      rows.push({ pos: parts[0], r: parts[1], g: parts[2], b: parts[3] });
    }
  }

  if (rows.length < 2) {
    throw new Error("No se encontraron al menos dos filas RGB válidas en el archivo.");
  }

  const hasPositions = rows.every((r) => r.pos !== undefined);
  const stops: ColorStop[] = rows.map((r, i) => {
    const pos = hasPositions ? (r.pos! <= 1 ? r.pos! : r.pos! / 255) : i / (rows.length - 1);
    const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
    return {
      position: Math.max(0, Math.min(1, pos)),
      color: `#${toHex(r.r)}${toHex(r.g)}${toHex(r.b)}`,
    };
  });

  return {
    id: `custom_${Date.now()}`,
    nameEs: name,
    nameEn: name,
    category: "custom",
    stops,
  };
}
