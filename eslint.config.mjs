import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // R3F / Three.js: camera FOV, shader uniforms, and ref sync in useFrame are intentional.
  {
    files: ["src/components/explorer/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "extension/screensaver.js",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
