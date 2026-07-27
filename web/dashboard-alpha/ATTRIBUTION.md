# Attribution

## Bklit UI

Chart components under `src/components/charts/` are installed from the [Bklit UI](https://github.com/bklit/bklit-ui) shadcn registry and are **MIT licensed**.

Watchtower themes and wraps these charts for the ops dashboard. Studio (proprietary) is not included.

## Motion & chrome

Hero glow, CTAs, pill nav, and selectable lists under `src/components/{border-glow,specular-button,pill-nav,animated-list}/` plus `src/ui/motion/` are **Watchtower-owned** implementations inspired by common UI patterns (including ideas from React Bits). They are **not** Redistributed React Bits source and carry no Commons Clause.

## SpecularButton / ogl

`SpecularButton` uses [ogl](https://github.com/oframe/ogl) (**MIT**) for the WebGL specular rim. ogl is listed in `package.json` and ships with the Vite dashboard bundle.

## Watchtower

Fixture data, domain formatting concepts, and route catalog were adapted from the former Preact dashboard at `web/dashboard/` (archive). The React tree in this folder is what NeoForge `syncDashboard` ships.
