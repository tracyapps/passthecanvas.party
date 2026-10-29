// Homography: the matrix that maps a flat rectangle (an artwork image) onto
// any four screen points (the corners of a wall-canvas quad, as seen in the
// 360° room). Used as a CSS matrix3d() so the browser does the per-pixel
// work every frame while the camera moves.

export type Point = { x: number; y: number };

/**
 * Solve the homography mapping four source points to four destination
 * points (both in the same corner order). Returns the 16 matrix3d values,
 * or null when the points don't define a proper quad (degenerate system).
 */
export function homography3d(src: Point[], dst: Point[]): number[] | null {
  // Classic 8×8 linear system: each point pair contributes two equations.
  // Solved with plain Gaussian elimination — 8 unknowns, no library needed.
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]!;
    const { x: X, y: Y } = dst[i]!;
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = solve(A, b);
  if (!h) return null;
  // CSS matrix3d is column-major; this layout makes the browser apply the
  // same x' = (h0x + h1y + h2) / (h6x + h7y + 1) mapping.
  return [h[0]!, h[3]!, 0, h[6]!, h[1]!, h[4]!, 0, h[7]!, 0, 0, 1, 0, h[2]!, h[5]!, 0, 1];
}

/** Gaussian elimination with partial pivoting. Null when singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    // Bring the largest remaining pivot up (keeps rounding stable).
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row]![col]!) > Math.abs(A[pivot]![col]!)) pivot = row;
    }
    if (Math.abs(A[pivot]![col]!) < 1e-10) return null;
    [A[col], A[pivot]] = [A[pivot]!, A[col]!];
    [b[col], b[pivot]] = [b[pivot]!, b[col]!];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row]![col]! / A[col]![col]!;
      for (let k = col; k < n; k++) A[row]![k]! -= factor * A[col]![k]!;
      b[row]! -= factor * b[col]!;
    }
  }
  return b.map((v, i) => v / A[i]![i]!);
}
