import {defineConfig} from "vite";
import {runAction, uxp} from "vite-uxp-plugin";
import react from "@vitejs/plugin-react";
import {config} from "./uxp.config";

const action = process.env.ACTION;
const mode = process.env.MODE;

if (action) {
  runAction({}, action);
  process.exit();
}

const shouldNotEmptyDir =
  mode === "dev" && config.manifest.requiredPermissions?.enableAddon;

export default defineConfig({
  plugins: [uxp(config, mode), react(),],
  build: {
    sourcemap: !!mode && ["dev", "build"].includes(mode),
    emptyOutDir: !shouldNotEmptyDir,
    rollupOptions: {
      external: [
        "photoshop", "bolt-uxp-hybrid.uxpaddon", "uxp",
        "fs",
        "os",
        "path",
        "process",
        "shell",
      ],
      output: {
        format: "cjs",
      },
    },
  },
  publicDir: "public",
});
