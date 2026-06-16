// IMPORTANT: every value must stay <= 0. In React Three Fiber a useFrame with a
// positive priority hands the render loop to you and DISABLES automatic rendering
// (it expects a manual gl.render()). We only want deterministic ordering, not to
// take over rendering, so all priorities are negative and merely sorted ascending.
export const RENDER_FRAME_PRIORITY = {
  simulation: -120,
  controls: -100,
  origin: -80,
  bodies: -60,
  overlays: -40,
  effects: -20,
} as const;
