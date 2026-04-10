---
'@lit-labs/ssr-client': patch
---

Fall back to client-side render when SSR output can't be hydrated. When the shadow root contains children with `defer-hydration` or non-reflected properties have been set before element upgrade, the SSR output won't match the client template. Instead of throwing a hydration mismatch error, the DSD content is replaced with a fresh render.
