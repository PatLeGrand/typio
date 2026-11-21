type Point = { x: number; y: number };

/** Échantillonnage de Bridson. La grille sert uniquement à chercher les voisins. */
export function sampleParticleOrigins(width: number, height: number, random = Math.random): Point[] {
  if (width <= 0 || height <= 0) return [];

  const distance = Math.max(18, Math.sqrt(width * height / 1900));
  const cell = distance / Math.SQRT2;
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const grid = new Int32Array(columns * rows).fill(-1);
  const points: Point[] = [];
  const active: Point[] = [];

  function add(point: Point) {
    const column = Math.floor(point.x / cell);
    const row = Math.floor(point.y / cell);
    grid[row * columns + column] = points.length;
    points.push(point);
    active.push(point);
  }

  function hasSpace(x: number, y: number) {
    const column = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    for (let j = Math.max(0, row - 2); j <= Math.min(rows - 1, row + 2); j++) {
      for (let i = Math.max(0, column - 2); i <= Math.min(columns - 1, column + 2); i++) {
        const index = grid[j * columns + i];
        if (index === -1) continue;
        const point = points[index];
        if ((point.x - x) ** 2 + (point.y - y) ** 2 < distance ** 2) return false;
      }
    }
    return true;
  }

  add({ x: random() * width, y: random() * height });
  while (active.length) {
    const index = Math.floor(random() * active.length);
    const origin = active[index];
    let placed = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = random() * Math.PI * 2;
      const radius = distance * Math.sqrt(1 + 3 * random());
      const x = origin.x + Math.cos(angle) * radius;
      const y = origin.y + Math.sin(angle) * radius;
      if (x < 0 || x >= width || y < 0 || y >= height || !hasSpace(x, y)) continue;
      add({ x, y });
      placed = true;
      break;
    }
    if (!placed) {
      active[index] = active[active.length - 1];
      active.pop();
    }
  }
  return points;
}
