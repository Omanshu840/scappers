# Scappers

Scappers is a compact used-car listing dashboard that compares live inventory from Cars24 and Spinny in one place.

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. Open the repository settings and enable GitHub Pages using the GitHub Actions deployment method.
3. The workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) will publish the app automatically on every push to the main branch.
4. Your site will be available at https://omanshu840.github.io/scappers/.

## Local development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```
