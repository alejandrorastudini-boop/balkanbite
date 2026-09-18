import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// LINT.IfChange(aistudio_media_plugin)
function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(
              __dirname,
              'public',
              'assets',
              'aistudio',
            );
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.ico': 'image/x-icon',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
              };
              res.setHeader(
                'Content-Type',
                mimeMap[ext] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // Fall through if URI decoding or file access fails
          }
        }
        next();
      });
    },
  };
}
// LINT.ThenChange(//depot/google3/java/com/google/alkali/boq/makersuite/applet_dev_service/templates/initializers/react_theme/vite.config.ts:aistudio_media_plugin)

function resolveBuildGitSha(): string {
  const viteVercelSha = process.env.VITE_VERCEL_GIT_COMMIT_SHA?.trim();
  if (viteVercelSha) return viteVercelSha;

  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (vercelSha) return vercelSha;

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function runtimeQaFingerprintFiles(): string[] {
  const manifestPath = path.resolve(
    __dirname,
    'qa',
    'runtime',
    'fingerprint-files.json',
  );
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
    throw new Error('Invalid runtime QA fingerprint manifest');
  }
  return parsed;
}

function runtimeQaSourceFingerprint(): string {
  const hash = createHash('sha256');
  for (const relativePath of runtimeQaFingerprintFiles()) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.resolve(__dirname, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aistudioMediaPlugin()],
    define: {
      __BALKANBITE_VERCEL_ENV__: JSON.stringify(process.env.VERCEL_ENV || ""),
      __BALKANBITE_VERCEL_GIT_SHA__: JSON.stringify(resolveBuildGitSha()),
      __BALKANBITE_VERCEL_DEPLOYMENT_ID__: JSON.stringify(
        process.env.VERCEL_DEPLOYMENT_ID || ""
      ),
      __BALKANBITE_RUNTIME_QA_FINGERPRINT__: JSON.stringify(
        runtimeQaSourceFingerprint()
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
