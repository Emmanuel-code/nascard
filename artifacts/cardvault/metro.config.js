const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Block Metro from watching pnpm's native-module tmp extraction directories.
// These are created then deleted during install, causing ENOENT watcher crashes.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const blockList = [
  new RegExp(escape("/node_modules/.pnpm/") + ".*_tmp_.*"),
];

config.resolver = config.resolver ?? {};
const existing = config.resolver.blockList;
if (Array.isArray(existing)) {
  config.resolver.blockList = [...existing, ...blockList];
} else if (existing instanceof RegExp) {
  config.resolver.blockList = [existing, ...blockList];
} else {
  config.resolver.blockList = blockList;
}

module.exports = config;
