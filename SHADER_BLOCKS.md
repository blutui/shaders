# Shader Blocks: Canopy settings → WebGL shaders

Reference notes for the post. This project has three Canopy blocks. Each one renders an animated shader from [Paper Shaders](https://shaders.paper.design) (`@paper-design/shaders` v0.0.82), and editors change its colours and options from the Canopy editor.

## The idea in one line

**Block setting → `data-*` attribute → JavaScript reads `dataset` → shader uniform → GPU.**

Editors never touch code. Developers write one small JS runtime once, and each block template only has to print its settings into HTML attributes.

## Files

| File | What it does |
| --- | --- |
| `views/canopy/shader-mesh-hero.canvas` | Block 1: Mesh Gradient Hero |
| `views/canopy/shader-grain-section.canvas` | Block 2: Grain Gradient Section |
| `views/canopy/shader-dither-banner.canvas` | Block 3: Dithering Banner |
| `src/js/shaders.js` | The runtime: reads data attributes and mounts shaders (Parcel builds it to `public/js/shaders.js`) |
| `views/layouts/home.canvas` | Home page layout with the `main` block area |
| `views/templates/default.html` | Site shell; has a `scripts` block so `canopy.scripts('main')` lands at the end of `<body>` |

## Step 1: Define settings in the block config

Settings live in the block's `{% canopy config %}` JSON. Use the right setting type for each kind of shader option:

| Shader option | Setting type | Why |
| --- | --- | --- |
| Colours | `color` | Gives a hex string, e.g. `#f75092` |
| 0–1 strengths (distortion, softness, noise) | `number` with `min` 0 / `max` 100 | Editors think in percentages, so the JS divides by 100 |
| Fixed lists (shape, dither type) | `select` or `radio` | Editors can't type an invalid value |
| On/off (pause) | `checkbox` | Boolean |

Organise them with `tab` and `group` so the Content fields and the Shader fields don't mix:

```json
{ "name": "color_1", "type": "color", "label": "Colour 1", "tab": "Shader", "group": "Colours", "default": "#e0eaff" },
{ "name": "distortion", "type": "number", "tab": "Shader", "group": "Shape", "min": 0, "max": 100, "default": 80, "help": "Organic noise distortion (0–100)" },
{ "name": "shape", "type": "select", "tab": "Shader", "group": "Pattern", "default": "corners", "options": [{ "value": "wave", "label": "Wave" }, { "value": "corners", "label": "Corners" }] },
{ "name": "paused", "type": "checkbox", "label": "Pause animation", "tab": "Shader", "group": "Motion", "default": false }
```

Always give a `default`, so the block looks finished as soon as an editor adds it.

## Step 2: Print settings as data attributes in the template

The shader mounts into an empty `div` placed behind the content. Every setting becomes one attribute:

```canvas
<section class="relative isolate overflow-hidden" style="background-color: {{ settings.color_2 }}">
  <div
    class="absolute inset-0 -z-10"
    aria-hidden="true"
    data-shader="mesh-gradient"
    data-colors="{{ [settings.color_1, settings.color_2, settings.color_3, settings.color_4]|join(',') }}"
    data-distortion="{{ settings.distortion }}"
    data-swirl="{{ settings.swirl }}"
    data-speed="{{ settings.speed }}"
    data-paused="{{ settings.paused ? 'true' : 'false' }}"
  ></div>
  ...content...
</section>
```

Things to point out in the post:

- **`data-shader`** chooses which shader runs, and it's the key in the JS registry.
- **Several colours become one attribute.** Use `|join(',')` on an array of `color` settings, then split it again in JS.
- **Checkboxes are printed as `'true'`/`'false'`**, because every data attribute value is a string.
- **The section has a `background-color` fallback** that uses one of the shader colours. If WebGL isn't available, the block still looks intentional.
- **`aria-hidden="true"`** marks the canvas as decoration.

## Step 3: Load the runtime from the block's scripts section

```canvas
{% canopy scripts %}
{{ asset('js/shaders.js') | script_tag }}
{% endcanopy %}
```

Blutui only outputs the script on pages that actually use a shader block. The layout must call `canopy.scripts('main')` with the same handle as `canopy.blocks('main')`.

Each template's scripts section is output once per area. All three blocks include the same file, though, so the runtime protects itself against running twice (`window.__shaderBlocks`).

## Step 4: The runtime maps dataset → uniforms

`src/js/shaders.js` keeps a registry. Each entry pairs a fragment shader with a function that turns `element.dataset` into uniforms:

```js
const SHADERS = {
  'mesh-gradient': {
    fragment: meshGradientFragmentShader,
    uniforms: (data) => {
      const colors = colorList(data.colors);      // "#a,#b" → [[r,g,b,a], ...]
      return {
        ...sizing(data),                          // fit, scale, rotation, etc.
        u_colors: colors,
        u_colorsCount: colors.length,
        u_distortion: percent(data.distortion, 0.8), // "80" → 0.8
        u_swirl: percent(data.swirl, 0.1),
        u_grainMixer: 0,
        u_grainOverlay: percent(data.grain, 0),
      };
    },
  },
};
```

Then it mounts:

```js
new ShaderMount(el, def.fragment, def.uniforms(el.dataset), undefined, speed);
```

Helpers used:

- `getShaderColorFromString('#f75092')` (from Paper) turns a hex string into the `[r, g, b, a]` 0–1 array that shaders use.
- `percent(value, fallback)` divides editor-friendly 0–100 numbers by 100.
- Lookup tables (`GrainGradientShapes`, `DitheringShapes`, `DitheringTypes`) turn a `select` value like `"ripple"` into the number the shader expects.

**Dataset naming gotcha:** `data-color-back` becomes `dataset.colorBack`, and `data-pixel-size` becomes `dataset.pixelSize`. Write kebab-case in HTML and read camelCase in JS.

## Step 5: Live updates in the Canopy editor

When an editor changes a setting, the block re-renders. A `MutationObserver` in the runtime handles three cases:

- **New `[data-shader]` element** (block added or re-rendered): mount it.
- **Element removed** from the page: `mount.dispose()` frees the WebGL context. Browsers limit how many contexts a page can have, so this matters.
- **A data attribute changes** on an existing element: `mount.setUniforms(...)` and `mount.setSpeed(...)` update it without remounting.

## Motion and accessibility

- `speed` 0–200 maps to Paper's speed multiplier (100 = 1×). `0` stops the render loop entirely, so a still shader costs nothing.
- The **Pause animation** checkbox sets the speed to 0.
- `prefers-reduced-motion: reduce` also forces the speed to 0, and the runtime listens for that setting changing.
- Paper automatically pauses shaders that are off-screen or in a hidden tab.

## The three blocks

### 1. Mesh Gradient Hero (`shader_mesh_hero`), `data-shader="mesh-gradient"`

| Setting | Type | Attribute | Uniform |
| --- | --- | --- | --- |
| Colour 1–4 | color | `data-colors` (joined) | `u_colors`, `u_colorsCount` |
| Distortion | number 0–100 | `data-distortion` | `u_distortion` (÷100) |
| Swirl | number 0–100 | `data-swirl` | `u_swirl` (÷100) |
| Grain | number 0–100 | `data-grain` | `u_grainOverlay` (÷100) |
| Scale | number 10–400 | `data-scale` | `u_scale` (÷100) |
| Rotation | number 0–360 | `data-rotation` | `u_rotation` (degrees) |
| Speed / Pause | number / checkbox | `data-speed`, `data-paused` | `setSpeed()` |

Content tab: eyebrow, heading (h1/h2), description, button, and a light/dark text colour radio.

### 2. Grain Gradient Section (`shader_grain_section`), `data-shader="grain-gradient"`

| Setting | Type | Attribute | Uniform |
| --- | --- | --- | --- |
| Shape | select (wave, dots, truchet, corners, ripple, blob, sphere) | `data-shape` | `u_shape` via `GrainGradientShapes` |
| Background | color | `data-color-back` | `u_colorBack` |
| Colour 1–3 | color | `data-colors` | `u_colors`, `u_colorsCount` |
| Softness / Intensity / Noise | number 0–100 | `data-softness`, `data-intensity`, `data-noise` | ÷100 |
| Scale, Speed, Pause | | | as above |

This shader also needs a **noise texture** (`u_noiseTexture`, from `getShaderNoiseTexture()`), and the image must be fully loaded before mounting. The registry declares it under `textures`, and the runtime waits for it to load. That's a good example of a shader input that isn't an editor setting.

Content tab: section ID (for `#grain` anchor links), heading, rich text body (output with `|raw`), and alignment.

### 3. Dithering Banner (`shader_dither_banner`), `data-shader="dithering"`

| Setting | Type | Attribute | Uniform |
| --- | --- | --- | --- |
| Background / Ink | color | `data-color-back`, `data-color-front` | `u_colorBack`, `u_colorFront` |
| Pattern | select (noise, warp, dots, wave, ripple, swirl, sphere) | `data-shape` | `u_shape` via `DitheringShapes` |
| Dither type | radio (random, 2×2, 4×4, 8×8) | `data-type` | `u_type` via `DitheringTypes` |
| Pixel size | number 1–20 | `data-pixel-size` | `u_pxSize` (used as is) |
| Scale, Speed, Pause | | | as above |

The ink colour is also reused for the button background. It shows that the same setting can drive both the shader and normal CSS.

## Adding a new setting (recipe)

Example: add **Swirl** to the grain block.

1. **Config:** `{ "name": "swirl", "type": "number", "tab": "Shader", "min": 0, "max": 100, "default": 0 }`
2. **Template:** `data-swirl="{{ settings.swirl }}"`
3. **JS registry:** add `u_swirl: percent(data.swirl, 0)` in the shader's `uniforms()`. Check the shader's `.d.ts` file in `node_modules/@paper-design/shaders/dist/shaders/` to see which uniforms it accepts.
4. **Live updates:** if the attribute is new, add it to `attributeFilter` in `init()`.
5. Run `npm run build` and `courier push`.

## Adding a new shader (recipe)

1. Import its fragment shader (and any shape enums) from `@paper-design/shaders`.
2. Add a `SHADERS['your-shader']` entry with `fragment` and `uniforms(data)`.
3. Create `views/canopy/shader-your-block.canvas` with a `data-shader="your-shader"` div and a scripts section.
4. Add its name to the `canopy.blocks('main', ...)` list in `views/layouts/home.canvas`.

## Gotchas

- **The config must be strict JSON.** A typo in a setting silently hides the field in the editor.
- **Uniform names must match exactly.** Unknown uniforms are silently ignored.
- **Only uniforms passed at mount can be updated later,** because `setUniforms` only knows the uniforms set up at the start. Always return the full set from `uniforms()`.
- **Colour counts:** mesh gradient supports up to 10 colours and grain gradient up to 7. Keep `u_colorsCount` in sync with the array length.
- **Every data attribute value is a string.** Always parse numbers, and use a fallback for empty values.
- **WebGL context limits:** browsers cap live contexts (roughly 8–16). Three or four shader blocks per page is fine; dozens isn't.
- **Build step:** edit `src/js/shaders.js` and run `npm run build` (or `npm run dev`). Courier only syncs `public/` and `views/`.
