# Shader blocks for Blutui

Three Canopy Blocks that each draw an animated WebGL shader, with every colour, shape and speed on a Shader tab in the Canopy editor. Editors tune the shader; nobody opens the code.

This is the demo project for **[Shaders, and how to let your editors tune them](https://blutui.com/articles/shaders-your-editors-can-tune)** on the Blutui blog. The post explains what a shader is and walks through how these blocks work.

![The three blocks, each with its default settings and two others](https://cdn.blutui.com/uploads/blutui_27/shaders-post/shaders-settings-grid.jpg?width=1600&format=webp)

*Each row is one block. Only its Shader settings change between the three.*

## The blocks

| Block | Shader | What an editor can change |
| --- | --- | --- |
| Shader: Mesh Gradient Hero (`shader_mesh_hero`) | Mesh gradient | Four colours, distortion, swirl, grain, scale, rotation, speed, pause |
| Shader: Grain Gradient Section (`shader_grain_section`) | Grain gradient | Shape (seven), background and three colours, softness, intensity, noise, scale, speed, pause |
| Shader: Dithering Banner (`shader_dither_banner`) | Dithering | Background and ink, pattern (seven), dither type, pixel size, scale, speed, pause |

The shaders come from [Paper Shaders](https://shaders.paper.design) (`@paper-design/shaders` 0.0.82).

![The Mesh Gradient Hero's Shader tab in the Canopy editor](https://cdn.blutui.com/uploads/blutui_27/shaders-post/shaders-canopy-shader-tab.jpg?width=1600&format=webp)

## How it works

```
block setting → data-* attribute → src/js/shaders.js reads it → uniform → GPU
```

Each block's template prints its settings as `data-*` attributes on an empty `div` behind its content. `src/js/shaders.js` finds every `[data-shader]` element, turns its attributes into the uniforms the shader takes and mounts it. A `MutationObserver` keeps it in step with the editor: when a setting changes, the running shader updates without a reload.

![Changing Colour 3, Distortion and Rotation in Canopy, with the preview updating as each value is typed](https://cdn.blutui.com/uploads/blutui_27/shaders-post/shaders-canopy-live-edit.gif)

[SHADER_BLOCKS.md](SHADER_BLOCKS.md) has the full reference: every setting, attribute and uniform for each block, how to add a setting or a new shader and the mistakes that are easy to make.

## Try it

You need [Courier](https://dev.blutui.com/docs/courier/getting-started) and a Blutui project.

```bash
git clone https://github.com/blutui/shaders.git
```

```bash
cd shaders && npm install && npm run build
```

Then change `handle` in `courier.json` to your own project's handle and push:

```bash
courier push
```

In the dashboard, set a page's layout to `layouts/home.canvas` and open it in Canopy. The three blocks are in its `main` area: select one and open its Shader tab.

`npm run dev` rebuilds `src/` into `public/` as you work. Courier only syncs `views/` and `public/`, so run a build before every push.

## Files

| File | What it is |
| --- | --- |
| `views/canopy/shader-mesh-hero.canvas` | Mesh Gradient Hero block |
| `views/canopy/shader-grain-section.canvas` | Grain Gradient Section block |
| `views/canopy/shader-dither-banner.canvas` | Dithering Banner block |
| `src/js/shaders.js` | The runtime: reads the attributes, mounts the shaders, follows the editor |
| `views/layouts/home.canvas` | The page with the `main` block area |
| `views/templates/default.html` | Site shell, with a `scripts` block for `canopy.scripts('main')` |
| `hello-shader.html` | The eight-line shader from the post, in plain WebGL. Open it in a browser |

## Credits

The shaders are [Paper Shaders](https://github.com/paper-design/shaders), Apache-2.0.
