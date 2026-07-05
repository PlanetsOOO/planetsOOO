/**
 * Extension offline bundle alias for bare `three` imports.
 * Use a relative path to the real module so esbuild's `three` alias does not
 * remap this re-export back onto this file.
 */
// @ts-expect-error Extension offline bundle resolves this path at build time.
export * from "../../node_modules/three/build/three.module.js";
export { OrbitClock as Clock } from "./orbitClock";
