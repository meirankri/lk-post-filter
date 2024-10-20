export default {
  manifest: {
    manifest_version: 3,
    name: "Classificateur de texte LinkedIn",
    version: "0.0.1",
    permissions: [
      "activeTab",
      "scripting",
      "storage",
      "tabs"
    ],
    host_permissions: ["https://www.linkedin.com/feed"],
    background: {
      service_worker: "background.ts",
      type: "module"
    },
    content_scripts: [
      {
        matches: ["https://www.linkedin.com/feed*"],
        js: ["content.ts"]
      }
    ],
    action: {},
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
    },
    web_accessible_resources: [
      {
        resources: ["*.wasm"],
        matches: ["https://www.linkedin.com/feed"]
      }
    ]
  },
  build: {
    assets: {
      copy: [
        { from: "node_modules/@xenova/transformers/dist/*.wasm", to: "." }
      ]
    }
  }
};
