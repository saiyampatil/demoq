# Browser checks

`cdp.mjs` is a small Chrome DevTools driver (headless Chrome, bounded calls, no dependencies). Probes import it.

    npx vite --port 5199 --strictPort &       # the driver expects the dev server on 5199
    node tests/counts.mjs                     # prints every session count on every screen, and the invariant check

Output (screenshots, the Chrome profile) goes to `tests/.out`, which is git-ignored. Set `SP` to change it.
This is not the old test chain. It is only the driver and the probes that have been written since.
