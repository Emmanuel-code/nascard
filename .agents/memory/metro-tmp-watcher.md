---
name: Metro tmp-dir watcher crash fix
description: How to fix ENOENT Metro watcher crashes when pnpm installs Expo native packages (expo-camera, expo-notifications, etc.)
---

## The rule
Any Expo native package installed via pnpm (e.g. `expo-camera`, `expo-notifications`) can crash Metro with:
`ENOENT: no such file or directory, watch '/…/node_modules/.pnpm/<pkg>_tmp_<N>/android/src/…'`
because pnpm extracts native Android source to a `_tmp_` directory that is then deleted, leaving Metro watching a dead path.

**Fix:** Add a blockList regex to `metro.config.js` that excludes all `_tmp_` paths inside `.pnpm/`:

```js
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const blockList = [new RegExp(escape("/node_modules/.pnpm/") + ".*_tmp_.*")];
config.resolver = config.resolver ?? {};
const existing = config.resolver.blockList;
if (Array.isArray(existing)) config.resolver.blockList = [...existing, ...blockList];
else if (existing instanceof RegExp) config.resolver.blockList = [existing, ...blockList];
else config.resolver.blockList = blockList;
module.exports = config;
```

**Why:** The `_tmp_` directory is a pnpm artefact for patching native code at install time. Metro's FallbackWatcher picks up the path from the initial filesystem scan but the directory is gone by the time the watcher tries to attach.

**How to apply:** Any time a new Expo native package is added and Metro crashes with the above ENOENT pattern, update `metro.config.js` — no other changes needed.

## Version note (Expo SDK 54 / pnpm)
- `expo-camera@17.0.10` installed by `pnpm exec expo install expo-camera` triggered this crash.
- The same crash previously occurred with `expo-notifications@56.x`.
- The blockList approach resolves both without version pinning.
