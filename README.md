# PulseAI Qual: frontend prototype

A clickable prototype of PulseAI Qual. Frontend only: mock data and simulated AI, no backend.
React, Vite, TypeScript, Tailwind and React Router.

## Hosting

- **Live URL:** https://saiyampatil.github.io/demoq/
- Every push to the `launch-stage-2` branch redeploys the site through GitHub Actions, in about a minute
  (`.github/workflows/deploy.yml`). You can also run the workflow by hand from the Actions tab.
- The hosted build is a production build, so the dev-only Screen jump menu and dev controls do not show on it.
  A good place to start is the Pet Food Subscription Churn study.
- Opening or refreshing a deep link such as `/demoq/researcher/studies/pet-food-churn/analysis/base` works:
  the build copies `index.html` to `404.html`, which GitHub Pages serves for unknown paths. Because of that,
  the browser sees an HTTP 404 status for a deep link, but the app loads.

### Run locally

```
npm install
npm run dev
```

Opens at http://localhost:5173/ (the dev server uses `/` as its base path).

### Build

```
npm run build
```

This type-checks, builds into `dist/` for the `/demoq/` base path, and writes `dist/404.html`.
To try the built site: `npx vite preview --base /demoq/` and open http://localhost:4173/demoq/.

## Docs

`docs/PRD.md` is the source of truth. Decisions are in `docs/DECISIONS.md` and open questions in
`docs/OPEN_QUESTIONS.md`.
