// Ownership is independent of the drawing tool: modifiers must never receive a
// different painter's context, even when those pixels are visible in the stack.
export interface OwnedLayer<T> { owner: string; surface: T }
export function editOwnedLayers<T>(layers: OwnedLayer<T>[], painter: string, edit: (surface: T) => void): void {
  for (const layer of layers) {
    if (layer.owner === painter) edit(layer.surface);
  }
}
