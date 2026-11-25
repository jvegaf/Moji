# Moji Plus: just recipes that mirror the npm scripts in package.json.
#
# Every recipe only delegates to its npm script (or to the sync script), so the
# npm scripts stay the single source of truth for what each task does.
# Requires Node ^20.19.0 || >=22.12.0 (see "engines" in package.json).
#
# Note: just runs recipes with sh by default, including on Windows, so a POSIX
# shell (Git Bash, MSYS2, WSL, ...) must be on PATH. The Windows packaging
# recipe uses electron-builder's own cross-platform logic; it is not a native
# PowerShell/cmd path.

# List the available recipes.
default:
    @just --list

# Install dependencies from the lockfile (npm ci) plus the Electron binary.
install:
    npm ci

# Run the app in development mode with hot reload.
dev:
    npm run dev

# Run in development mode with the update flow mocked.
dev-update:
    npm run dev:update

# Build main, preload and renderer bundles with electron-vite.
build:
    npm run build

# Type-check the project with tsc (no emit).
typecheck:
    npm run typecheck

# Preview the production build.
preview:
    npm run preview

# Run typecheck and the branding check (used before packaging).
verify:
    npm run verify

# Regenerate the app icons from their sources.
icons:
    npm run icons

# Generate the benchmark input corpus.
benchmark-corpus:
    npm run benchmark:corpus

# Measure IPC transport performance.
benchmark-ipc:
    npm run benchmark:ipc

# Build, generate the corpus and record a new benchmark baseline.
benchmark-record:
    npm run benchmark:record

# Compare a benchmark run against the recorded baseline.
benchmark-compare:
    npm run benchmark:compare

# Package the app for every platform configured in electron-builder.
dist:
    npm run dist

# Package the app for Windows only (see the sh note at the top of this file).
dist-win:
    npm run dist:win

# Package the app for Linux only.
dist-linux:
    npm run dist:linux

# Package the app for macOS only.
dist-mac:
    npm run dist:mac

# Merge the upstream Moji changes into a sync branch; extra args go to the script.
sync-upstream *args:
    scripts/sync-upstream.sh {{ args }}
