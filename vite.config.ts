import {defineConfig} from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import handlebars from 'vite-plugin-handlebars';
import basicSsl from '@vitejs/plugin-basic-ssl';
import {visualizer} from 'rollup-plugin-visualizer';
import checker from 'vite-plugin-checker';
// import devtools from 'solid-devtools/vite'
import autoprefixer from 'autoprefixer';
import {resolve} from 'path';
import {existsSync, copyFileSync, mkdirSync, readdirSync, statSync} from 'fs';
import {ServerOptions} from 'vite';
import {watchLangFile} from './watch-lang.js';
import path from 'path';

const rootDir = resolve(__dirname);
const ENV_LOCAL_FILE_PATH = path.join(rootDir, '.env.local');

const isDEV = process.env.NODE_ENV === 'development';
if(isDEV) {
  if(!existsSync(ENV_LOCAL_FILE_PATH)) {
    copyFileSync(path.join(rootDir, '.env.local.example'), ENV_LOCAL_FILE_PATH);
  }

  watchLangFile();
}

const handlebarsPlugin = handlebars({
  context: {
    title: 'Telegram Web',
    description: 'Telegram is a cloud-based mobile and desktop messaging app with a focus on security and speed.',
    url: 'https://web.telegram.org/k/',
    origin: 'https://web.telegram.org/'
  }
});

const serverOptions: ServerOptions = {
  // host: '192.168.95.17',
  port: 8080,
  sourcemapIgnoreList(sourcePath, sourcemapPath) {
    return sourcePath.includes('node_modules') || sourcePath.includes('logger');
  }
};

const SOLID_SRC_PATH = 'src/solid/packages/solid';
const SOLID_BUILT_PATH = 'src/vendor/solid';
const USE_SOLID_SRC = false;
const SOLID_PATH = USE_SOLID_SRC ? SOLID_SRC_PATH : SOLID_BUILT_PATH;
// Allow overriding via env: set USE_OWN_SOLID=false to force using node_modules solid-js
const ENV_USE_OWN_SOLID = process.env.USE_OWN_SOLID;
const USE_OWN_SOLID = ENV_USE_OWN_SOLID ? ENV_USE_OWN_SOLID === 'true' : existsSync(resolve(rootDir, SOLID_PATH));

function copyPublicSubsetPlugin() {
  let resolvedOutDir = 'dist';
  return {
    name: 'copy-public-subset',
    apply: 'build',
    configResolved(config: any) {
      // Resolve absolute outDir
      resolvedOutDir = resolve(rootDir, config.build.outDir || 'dist');
    },
    writeBundle() {
      const publicDir = resolve(rootDir, 'public');
      const outDir = resolvedOutDir;

      const copyRecursiveSync = (src: string, dest: string) => {
        if (!existsSync(src)) return;
        const st = statSync(src);
        if (st.isDirectory()) {
          if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
          for (const name of readdirSync(src)) {
            copyRecursiveSync(resolve(src, name), resolve(dest, name));
          }
        } else {
          const dirname = path.dirname(dest);
          if (!existsSync(dirname)) mkdirSync(dirname, { recursive: true });
          copyFileSync(src, dest);
        }
      };

      // Copy /public/assets -> /dist/assets (icons, fonts, images)
      copyRecursiveSync(resolve(publicDir, 'assets'), resolve(outDir, 'assets'));

      // Copy root-level manifest/config files
      for (const file of ['site.webmanifest', 'site_apple.webmanifest', 'browserconfig.xml']) {
        const src = resolve(publicDir, file);
        const dst = resolve(outDir, file);
        if (existsSync(src)) copyFileSync(src, dst);
      }

      // Copy known WASM binaries required by workers (rlottie/opus)
      for (const wasm of ['rlottie-wasm.wasm', 'encoderWorker.min.wasm', 'decoderWorker.min.wasm']) {
        const src = resolve(publicDir, wasm);
        const dst = resolve(outDir, wasm);
        if (existsSync(src)) copyFileSync(src, dst);
      }

      // Also copy favicon to root so /favicon.ico works
      const favSrc = resolve(publicDir, 'assets', 'img', 'favicon.ico');
      const favDst = resolve(outDir, 'favicon.ico');
      if (existsSync(favSrc)) copyFileSync(favSrc, favDst);
    }
  } as any;
}

const USE_SSL = false;
const USE_SSL_CERTS = false;
const NO_MINIFY = false;
const SSL_CONFIG: any = USE_SSL_CERTS && USE_SSL && {
  name: '192.168.95.17',
  certDir: './certs/'
};

const ADDITIONAL_ALIASES = {
  'solid-transition-group': resolve(rootDir, 'src/vendor/solid-transition-group')
};

if(USE_OWN_SOLID) {
  console.log('using own solid', SOLID_PATH, 'built', !USE_SOLID_SRC);
} else {
  console.log('using original solid');
}

export default defineConfig({
  plugins: [
    // devtools({
    //   /* features options - all disabled by default */
    //   autoname: true // e.g. enable autoname
    // }),
    (isDEV && !process.env.VITEST) ? checker({
      typescript: true,
      eslint: {
        // for example, lint .ts and .tsx
        lintCommand: 'eslint "./src/**/*.{ts,tsx}" --ignore-pattern "/src/solid/*"',
        useFlatConfig: true
      }
    }) : undefined,
    solidPlugin(),
    handlebarsPlugin as any,
    USE_SSL ? (basicSsl as any)(SSL_CONFIG) : undefined,
    visualizer({
      gzipSize: true,
      template: 'treemap'
    }),
    copyPublicSubsetPlugin()
  ].filter(Boolean),
  test: {
    // include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/solid/**'
    ],
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'lcov'],
    //   include: ['src/**/*.ts', 'store/src/**/*.ts', 'web/src/**/*.ts'],
    //   exclude: ['**/*.d.ts', 'src/server/*.ts', 'store/src/**/server.ts']
    // },
    environment: 'jsdom',
    testTransformMode: {web: ['.[jt]sx?$']},
    // otherwise, solid would be loaded twice:
    // deps: {registerNodeLoader: true},
    // if you have few tests, try commenting one
    // or both out to improve performance:
    threads: false,
    isolate: false,
    globals: true,
    setupFiles: ['./src/tests/setup.ts']
  },
  server: serverOptions,
  base: '',
  build: {
    target: 'es2020',
    sourcemap: true,
    assetsDir: '',
    copyPublicDir: false,
    emptyOutDir: true,
    minify: NO_MINIFY ? false : undefined,
    rollupOptions: {
      output: {
        sourcemapIgnoreList: serverOptions.sourcemapIgnoreList
      }
      // input: {
      //   main: './index.html',
      //   sw: './src/index.service.ts'
      // }
    }
    // cssCodeSplit: true
  },
  worker: {
    format: 'es'
  },
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [
        autoprefixer({}) // add options if needed
      ]
    }
  },
  resolve: {
    // conditions: ['development', 'browser'],
    alias: USE_OWN_SOLID ? {
      'rxcore': resolve(rootDir, SOLID_PATH, 'web/core'),
      'solid-js/jsx-runtime': resolve(rootDir, SOLID_PATH, 'jsx'),
      'solid-js/web': resolve(rootDir, SOLID_PATH, 'web'),
      'solid-js/store': resolve(rootDir, SOLID_PATH, 'store'),
      'solid-js': resolve(rootDir, SOLID_PATH),
      ...ADDITIONAL_ALIASES
    } : ADDITIONAL_ALIASES
  }
});
