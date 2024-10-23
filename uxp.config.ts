import {UXP_Manifest, UXP_Config} from "vite-uxp-plugin";
import {version} from "./package.json";

const extraPrefs = {
  hotReloadPort: 8080,
  copyZipAssets: ["public-zip/*"],
};

const manifest: UXP_Manifest = {
  id: "lobatolobato.tex.tool.plugin",
  name: "Tex Tool",
  version,
  main: "index.html",
  manifestVersion: 6,
  host: [{app: "PS", minVersion: "24.2.0"}],
  entrypoints: [
    {
      type: "panel",
      id: "lobatolobato.tex.tool.plugin.export",
      label: {default: "Export Tex"},
      minimumSize: {width: 450, height: 360},
      maximumSize: {width: 450, height: 360},
      preferredDockedSize: {width: 230, height: 300},
      preferredFloatingSize: {width: 450, height: 360},
      icons: [
        {
          width: 23,
          height: 23,
          path: "icons/dark.png",
          scale: [1, 2],
          theme: ["darkest", "dark", "medium"],
        },
        {
          width: 23,
          height: 23,
          path: "icons/light.png",
          scale: [1, 2],
          theme: ["lightest", "light"],
        },
      ],
    },
    {
      type: "panel",
      id: "lobatolobato.tex.tool.plugin.import",
      label: {default: "Import Tex"},
      minimumSize: {width: 450, height: 200},
      maximumSize: {width: 450, height: 200},
      preferredDockedSize: {width: 230, height: 300},
      preferredFloatingSize: {width: 450, height: 200},
      icons: [
        {
          width: 23,
          height: 23,
          path: "icons/dark-panel.png",
          scale: [1, 2],
          theme: ["darkest", "dark", "medium"],
          species: ["chrome"],
        },
        {
          width: 23,
          height: 23,
          path: "icons/light-panel.png",
          scale: [1, 2],
          theme: ["lightest", "light"],
          species: ["chrome"],
        },
      ],
    },
    // //* Example of a UXP Command
    // {
    //   type: "command",
    //   id: "showAbout",
    //   label: {
    //     default: "Bolt UXP Command",
    //   },
    // },
  ],
  //@ts-ignore
  featureFlags: {
    enableAlerts: true,
    enableSWCSupport: true
  },
  requiredPermissions: {
    localFileSystem: "fullAccess",
    launchProcess: {
      schemes: ["https", "slack", "file", "ws"],
      extensions: [".xd", ".psd", ".bat", ".cmd"],
    },
    network: {
      domains: [
        "https://hyperbrew.co",
        "https://github.com",
        "https://vitejs.dev",
        "https://svelte.dev",
        "https://reactjs.org",
        "https://vuejs.org/",
        `ws://localhost:${extraPrefs.hotReloadPort}`, // Required for hot reload
      ],
    },
    clipboard: "readAndWrite",
    webview: {
      allow: "yes",
      domains: ["https://*.hyperbrew.co"],
    },
    ipc: {
      enablePluginCommunication: true,
    },
    allowCodeGenerationFromStrings: true,

    enableAddon: true,
  },
  addon: {
    name: "bolt-uxp-hybrid.uxpaddon",
  },
  icons: [
    {
      width: 48,
      height: 48,
      path: "icons/plugin-icon.png",
      scale: [1, 2],
      theme: ["darkest", "dark", "medium", "lightest", "light", "all"],
      species: ["pluginList"],
    },
  ],
};

export const config: UXP_Config = {
  manifest,
  ...extraPrefs,
};
