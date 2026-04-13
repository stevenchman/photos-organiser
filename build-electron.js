/**
 * Electron packaging script — avoids Windows shell quoting issues with --ignore.
 * Only the electron/ folder and package.json go into the asar.
 * Python backend and ffmpeg are added as extra-resources.
 */

const { packager } = require('@electron/packager');
const path = require('path');

// Directories/files to exclude from app.asar.
// The packager matches these regex patterns against paths relative to the app root.
const IGNORE = [
  /^\/venv/,
  /^\/node_modules/,
  /^\/dist/,
  /^\/build/,
  /^\/release/,
  /^\/ffmpeg/,
  /^\/scripts/,
  /^\/__pycache__/,
  /^\/flask_session/,
  /^\/\.git/,
  /^\/\.env/,
  /^\/\.secret_key/,
  /^\/\.claude/,
  // Python source — all served by the packaged Flask exe
  /^\/app\.py/,
  /^\/config\.py/,
  /^\/flex\.spec/,
  /^\/requirements\.txt/,
  /^\/CLAUDE\.md/,
  /^\/api/,
  /^\/core/,
  /^\/ui/,
  /^\/assets/,
  // Build scripts
  /^\/build-electron\.js/,
  /^\/package-lock\.json/,
];

(async () => {
  const appPaths = await packager({
    dir: '.',
    name: 'Flex',
    platform: 'win32',
    arch: 'x64',
    out: 'release',
    overwrite: true,
    icon: path.join('assets', 'icon.ico'),
    ignore: IGNORE,
    extraResource: [
      path.join('dist', 'flex-backend'),
      'ffmpeg',
    ],
    appVersion: '1.0.0',
  });

  console.log('Packaged to:', appPaths);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
