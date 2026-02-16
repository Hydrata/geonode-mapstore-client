# Compiling MapStore2 (Hydrata Fork)

## Overview

The geonode-mapstore-client frontend is a webpack-compiled React application. Compiled JS is committed to git in `geonode_mapstore_client/static/mapstore/dist/` and served by nginx as static files. Ansible does NOT compile — it runs `collectstatic` which copies the pre-compiled output.

**Build flow:**
1. `npm install` in `geonode_mapstore_client/client/`
2. `npm run compile` → runs webpack production build, then `postCompile.js` moves output from `client/dist/` to `static/mapstore/dist/`
3. `git add` + `git commit` the static output
4. Ansible deploy pulls the repo and runs `collectstatic`

## Prerequisites

- **Node.js 22+** (tested with v22.22.0)
- **npm 10+**
- **MapStore2 submodule** must be initialized: `git submodule update --init --recursive`
- ~30 min compile time, ~4GB RAM peak

## Step-by-Step

```bash
cd geonode_mapstore_client/client/

# 1. Initialize MapStore2 submodule (if not done)
cd ../.. && git submodule update --init --recursive && cd geonode_mapstore_client/client/

# 2. Install dependencies
npm install

# 3. Compile (production build)
npm run compile

# 4. Verify output
ls static/mapstore/dist/js/plugins/ | grep -i "hgeval\|swamm\|anuga"

# 5. Commit compiled output
cd ../..
git add geonode_mapstore_client/static/
git commit -m "compile client"
git push origin 5.x
```

### On a remote server (SSH)

Per CLAUDE.md safety rules, **always use resource limits** on remote servers:

```bash
systemd-run --scope -p "CPUQuota=400%" -p "MemoryMax=6G" \
  nice -n 15 bash -c 'cd /path/to/client && npm run compile'
```

Kill previous attempts before retrying:
```bash
pkill -f webpack || true; pkill -f 'npm run compile' || true
```

## Known Issues and Fixes

### 1. Hydrata plugins were never compiled on 5.x (fixed 2026-02-16)

The upstream GeoNode project auto-compiles via `[create-pull-request] automated change` PRs, but these don't include Hydrata custom plugins (Anuga, Swamm, Hydrology, HGeval, etc.) since those are only in our fork.

**Symptom:** Plugin chunks like `swamm-plugin.*.chunk.js` missing from `static/mapstore/dist/js/plugins/`. Plugins registered in `index.js` via `toModulePlugin()` silently fail to load at runtime (dynamic import returns 404).

**Fix:** Run a full `npm run compile` from the fork. First compile with Hydrata plugins was commit `3c1ac7fb5` (hash `6184fe57a6f1e30d`).

### 2. Missing component stubs for Anuga plugin

The Anuga plugin imports `@js/components/Button`, `@js/components/FaIcon`, `@js/components/ResourceCard`, `@js/components/Spinner` — these exist in upstream geonode-mapstore-client but were not present in the Hydrata fork's `js/components/` directory.

Similarly, `@js/reducers/gnsearch` and `@js/epics/gnsearch` are imported but don't exist.

**Fix:** Created minimal stub modules:
- `js/components/Button/index.js`
- `js/components/FaIcon/index.js`
- `js/components/Spinner/index.js`
- `js/components/ResourceCard/index.js`
- `js/reducers/gnsearch.js`
- `js/epics/gnsearch.js`

These are placeholder implementations that allow compilation. The Anuga plugin needs proper implementations of these components to be fully functional.

### 3. ag-grid v35 breaking changes (Hydrology plugin)

The Hydrology plugin imported ag-grid CSS from `ag-grid-community/dist/styles/` which was removed in ag-grid v28+. The import also used a fragile relative path through `node_modules`.

**Old (broken):**
```js
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-grid.css';
import '../../../../../../client/node_modules/ag-grid-community/dist/styles/ag-theme-blue.css';
```

**Fixed:**
```js
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
```

Also needed `ag-grid-react` installed (`npm install ag-grid-react`). The `ag-theme-blue` theme no longer exists in v35; replaced with `ag-theme-alpine`.

### 4. hashFunction configuration

The `MapStore2/build/buildConfig.js` sets `hashFunction: "xxhash64"`. This works with Node 22. If you encounter hash-related errors on different Node versions:

- Node < 17: change to `hashFunction: "md4"` (default)
- Node 17+: `xxhash64` or `sha256` both work
- If `xxhash64` fails: change to `sha256`

### 5. postCompile doesn't run with direct compile.js invocation

If you run `node node_modules/@mapstore/project/scripts/compile.js` directly (instead of `npm run compile`), the `postCompile.js` script won't execute. The compiled output stays in `client/dist/` and never gets moved to `static/mapstore/dist/`.

**Fix:** Always use `npm run compile`, or manually run `node postCompile` after compilation.

## Plugin Architecture

Hydrata plugins live in `js/plugins/hydrata/` and are registered in `js/plugins/index.js` using `toModulePlugin()` for lazy loading (webpack code splitting):

```js
HGevalPlugin: toModulePlugin(
    'HGeval',
    () => import(/* webpackChunkName: 'plugins/hgeval-plugin' */ '@js/plugins/hydrata/HGeval/HGeval')
)
```

Each plugin chunk is a separate `.chunk.js` file loaded on demand. The `webpackChunkName` comment controls the output filename.

Plugin files follow this structure:
```
js/plugins/hydrata/PluginName/
├── PluginName.js          # createPlugin() entry point
├── actionsPluginName.js   # Redux action types + creators
├── reducersPluginName.js  # Redux reducer
├── selectorsPluginName.js # Reselect selectors
├── epicsPluginName.js     # redux-observable epics (RxJS v5)
├── components/            # React components
├── utils/                 # Helper modules
└── styles/                # CSS files
```

## Dependencies

Key dependencies used by Hydrata plugins (add to `package.json` if missing):

| Package | Used by | Notes |
|---------|---------|-------|
| `ag-grid-community` | Hydrology | v35+, styles in `styles/` not `dist/styles/` |
| `ag-grid-react` | Hydrology | Must match ag-grid-community major version |
| `recharts` | Hydrology | Charting library |
| `moment` | Hydrology | Date formatting |
| `rxjs` | All plugins | v5 via MapStore2 (NOT v6 pipe syntax) |
| `axios` | All plugins | Via `MapStore2/web/client/libs/ajax` |

## Compile Checklist

Before compiling:
- [ ] MapStore2 submodule initialized (`git submodule update --init --recursive`)
- [ ] `npm install` completed without errors
- [ ] No previous webpack/compile processes running (`pkill -f webpack`)
- [ ] If on remote server: using `systemd-run` resource limits

After compiling:
- [ ] `npm run compile` exited with 0 errors (warnings OK)
- [ ] Plugin chunks exist in `static/mapstore/dist/js/plugins/`
- [ ] `git add geonode_mapstore_client/static/ && git commit`
- [ ] Pushed to `origin/5.x`
