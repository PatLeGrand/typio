import { expect, it } from "vitest";
import { sampleParticleOrigins } from "./particleSampling";

it("répartit les particules sur tout le champ en respectant leur distance minimale", () => {
  let seed = 42;
  const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const width = 1280;
  const height = 800;
  const origins = sampleParticleOrigins(width, height, random);
  const regions = new Uint16Array(16);
  let nearestSquared = Infinity;

  for (const [index, point] of origins.entries()) {
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThan(width);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThan(height);
    regions[Math.floor(point.y * 4 / height) * 4 + Math.floor(point.x * 4 / width)]++;
    for (let i = 0; i < index; i++) {
      const other = origins[i];
      nearestSquared = Math.min(nearestSquared, (point.x - other.x) ** 2 + (point.y - other.y) ** 2);
    }
  }

  expect(origins.length).toBeLessThan(1500);
  expect(Math.min(...regions)).toBeGreaterThan(30);
  expect(nearestSquared).toBeGreaterThanOrEqual(width * height / 1900);
});
