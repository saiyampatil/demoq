# Browser checks

`cdp.mjs` is a small Chrome DevTools driver (headless Chrome, bounded calls, no dependencies). Probes import it.

    npx vite --port 5199 --strictPort &       # the driver expects the dev server on 5199
    node tests/counts.mjs                     # prints every session count on every screen, and the invariant check

Output (screenshots, the Chrome profile) goes to `tests/.out`, which is git-ignored. Set `SP` to change it.
This is not the old test chain. It is only the driver and the probes that have been written since.

## Which probes assert

These end with `... OK` or `... FAILED: <reasons>` and exit 1 on a failure: `counts`, `bridge`, `emotion`, `a2-review`, `a2-themes`, `moderator-requests`, `moderator-m1`, `moderator-seed`, `escalation`, `gap-loop`, `issues`, `needs-you-s2`, `needs-you-s3`, `needs-you-s4`, `session-nav`, `stage2`, and the `moderators`, `highlights` and `report` scenarios (`node tests/setup-flow.mjs <prefix> moderators`, `node tests/setup-flow.mjs hl highlights`, `node tests/setup-flow.mjs rp report`). The rest (`pet`, `journey`, `needs-you`, the `*-shots` probes, and the `pool`, `reward`, `screening` scenarios) print what they see and fail only if the page breaks.

Things the probes had wrong, so they don't drift again:
- Dev controls live in the Screen jump panel, not on the page. A probe opens it, clicks, and closes it before reading the page.
- The sessions search box's "Search participant…" is a placeholder, not page text. Wait on visible text such as `Overview`.
- Removed on purpose, so not tested: the Issues tab, "Source more", the top-up card and the "new in reserve" line on the Fieldwork Overview.
- The driver waits for an earlier run's Chrome to release the debugging port before it starts, so probes can run back to back.
