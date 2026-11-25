# Blutui Brief: Shaders (example project)

## Purpose
Example project that teaches how Canopy block settings can drive shader colours and options. Reference material for a blog post. See `SHADER_BLOCKS.md`.

## Sitemap
| URL | Page | Layout |
| --- | --- | --- |
| `/` | Home | `layouts/home.canvas` |

## Content model
None (no collections, blog, forms or menus).

## Editing
- `main` block area on Home: a fixed sequence of the 3 shader blocks, restricted to shader blocks.
- Blocks: `shader_mesh_hero`, `shader_grain_section`, `shader_dither_banner`. Each has Content and Shader tabs.
- Footer is fixed in the layout.

## Design
Dark and minimal, Figtree font, Tailwind CSS. Shader library: Paper Shaders (`@paper-design/shaders` 0.0.82).

## Content source
Placeholder copy (block defaults).

## Progress
- [x] Content model (none needed)
- [x] Template and components
- [x] Layouts and pages
- [x] Canopy blocks
- [x] Content
- [x] Pushed to staging
