/**
 * Shader blocks runtime
 * ---------------------
 * Canopy block settings are written into `data-*` attributes by each block
 * template (views/canopy/shader-*.canvas). This file finds every element with
 * a `data-shader` attribute, reads those attributes, converts them into the
 * uniforms Paper Shaders expects, and mounts a WebGL canvas inside it.
 *
 * Settings → data-* attributes → read here → uniforms → GPU
 *
 * It also watches the page for changes, so when an editor changes a setting
 * in the Canopy editor and the block re-renders, the shader updates or
 * re-mounts without a page reload.
 */
import {
  ShaderMount,
  ShaderFitOptions,
  getShaderColorFromString,
  getShaderNoiseTexture,
  meshGradientFragmentShader,
  grainGradientFragmentShader,
  GrainGradientShapes,
  ditheringFragmentShader,
  DitheringShapes,
  DitheringTypes,
} from '@paper-design/shaders';

// ---------------------------------------------------------------------------
// Helpers: turn data-attribute strings into the values shaders need
// ---------------------------------------------------------------------------

/** Read a number attribute, falling back when empty or invalid. */
const num = (value, fallback) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Editors work in friendly 0–100 ranges; shaders want 0–1.
 * `percent("35")` → 0.35
 */
const percent = (value, fallback) => num(value, fallback * 100) / 100;

/** `"#ff0000,#00ff00"` → `[[1,0,0,1],[0,1,0,1]]` (RGBA in the 0–1 range) */
const colorList = (value) =>
  (value || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map(getShaderColorFromString);

/** Uniforms every Paper shader needs for sizing/positioning. */
const sizing = (data) => ({
  u_fit: ShaderFitOptions.cover,
  u_scale: percent(data.scale, 1),
  u_rotation: num(data.rotation, 0),
  u_originX: 0.5,
  u_originY: 0.5,
  u_offsetX: 0,
  u_offsetY: 0,
  u_worldWidth: 0,
  u_worldHeight: 0,
});

// ---------------------------------------------------------------------------
// The registry: one entry per `data-shader` value
// ---------------------------------------------------------------------------

/**
 * Each entry has:
 * - fragment: the GLSL fragment shader from Paper Shaders
 * - uniforms(data): maps the element's dataset → shader uniforms
 *
 * `data` is `element.dataset`, so `data-color-back` arrives as `data.colorBack`.
 */
const SHADERS = {
  'mesh-gradient': {
    fragment: meshGradientFragmentShader,
    uniforms: (data) => {
      const colors = colorList(data.colors);
      return {
        ...sizing(data),
        u_colors: colors,
        u_colorsCount: colors.length,
        u_distortion: percent(data.distortion, 0.8),
        u_swirl: percent(data.swirl, 0.1),
        u_grainMixer: 0,
        u_grainOverlay: percent(data.grain, 0),
      };
    },
  },

  'grain-gradient': {
    fragment: grainGradientFragmentShader,
    // Needs a noise texture; it must be fully loaded before mounting.
    textures: { u_noiseTexture: getShaderNoiseTexture },
    uniforms: (data) => {
      const colors = colorList(data.colors);
      return {
        ...sizing(data),
        u_colorBack: getShaderColorFromString(data.colorBack || '#000000'),
        u_colors: colors,
        u_colorsCount: colors.length,
        u_softness: percent(data.softness, 0.5),
        u_intensity: percent(data.intensity, 0.5),
        u_noise: percent(data.noise, 0.25),
        u_shape: GrainGradientShapes[data.shape] ?? GrainGradientShapes.wave,
      };
    },
  },

  dithering: {
    fragment: ditheringFragmentShader,
    uniforms: (data) => ({
      ...sizing(data),
      u_colorBack: getShaderColorFromString(data.colorBack || '#000000'),
      u_colorFront: getShaderColorFromString(data.colorFront || '#ffffff'),
      u_shape: DitheringShapes[data.shape] ?? DitheringShapes.warp,
      u_type: DitheringTypes[data.type] ?? DitheringTypes['4x4'],
      u_pxSize: num(data.pixelSize, 3),
    }),
  },
};

// ---------------------------------------------------------------------------
// Mounting
// ---------------------------------------------------------------------------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Speed is 0–200 in the editor (100 = normal). Paused or reduced motion → 0. */
const speedFor = (data) => {
  if (data.paused === 'true' || reducedMotion.matches) return 0;
  return percent(data.speed, 1);
};

/** Load any textures a shader needs, resolving once they are ready. */
const loadTextures = (def) =>
  Promise.all(
    Object.entries(def.textures || {}).map(
      ([name, create]) =>
        new Promise((resolve) => {
          const img = create();
          if (img.complete && img.naturalWidth) return resolve([name, img]);
          img.onload = () => resolve([name, img]);
        })
    )
  ).then(Object.fromEntries);

const mounts = new Map(); // element → { mount, textures }

async function mountShader(el) {
  if (mounts.has(el)) return;
  const def = SHADERS[el.dataset.shader];
  if (!def) {
    console.warn(`[shaders] Unknown data-shader="${el.dataset.shader}"`);
    return;
  }

  mounts.set(el, null); // reserve while textures load
  const textures = await loadTextures(def);
  if (!el.isConnected) return mounts.delete(el);

  try {
    const mount = new ShaderMount(
      el,
      def.fragment,
      { ...def.uniforms(el.dataset), ...textures },
      undefined,
      speedFor(el.dataset)
    );
    mounts.set(el, { mount, textures });
  } catch (error) {
    // WebGL unavailable: the block's CSS background colour stays visible.
    console.warn('[shaders]', error);
    mounts.delete(el);
  }
}

/** Push new data-* values into an existing shader without re-mounting. */
function updateShader(el) {
  const entry = mounts.get(el);
  if (!entry) return;
  const def = SHADERS[el.dataset.shader];
  entry.mount.setUniforms(def.uniforms(el.dataset));
  entry.mount.setSpeed(speedFor(el.dataset));
}

function unmountShader(el) {
  const entry = mounts.get(el);
  entry?.mount.dispose();
  mounts.delete(el);
}

function scan(root = document) {
  root.querySelectorAll('[data-shader]').forEach(mountShader);
}

// ---------------------------------------------------------------------------
// Keep in sync with the Canopy editor
// ---------------------------------------------------------------------------

const observer = new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === 'attributes') {
      const el = record.target;
      if (record.attributeName === 'data-shader') {
        unmountShader(el);
        mountShader(el);
      } else if (record.attributeName !== 'data-paper-shader') {
        updateShader(el);
      }
      continue;
    }
    record.addedNodes.forEach((node) => {
      if (node.nodeType !== 1) return;
      if (node.matches('[data-shader]')) mountShader(node);
      scan(node);
    });
  }
  // Dispose shaders whose elements left the page (block removed/re-rendered).
  for (const el of mounts.keys()) {
    if (!el.isConnected) unmountShader(el);
  }
});

function init() {
  if (window.__shaderBlocks) return; // script may be included by several blocks
  window.__shaderBlocks = { mounts, SHADERS };

  scan();
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'data-shader',
      'data-colors',
      'data-color-back',
      'data-color-front',
      'data-distortion',
      'data-swirl',
      'data-grain',
      'data-softness',
      'data-intensity',
      'data-noise',
      'data-shape',
      'data-type',
      'data-pixel-size',
      'data-scale',
      'data-rotation',
      'data-speed',
      'data-paused',
    ],
  });
  reducedMotion.addEventListener('change', () => mounts.forEach((_, el) => updateShader(el)));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
