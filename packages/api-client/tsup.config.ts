import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: true,
  external: ["@hey-api/client-fetch"],
  outDir: "dist",
  esbuildOptions(options) {
    options.conditions = ["browser"];
  },
});
