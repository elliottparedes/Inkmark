# Inkmark

A free, privacy-friendly photo annotation / markup tool that runs **entirely in
the browser**. Load a photo or screenshot, draw arrows, highlights, shapes and
text, then download the result as a PNG. No sign-up, no uploads, no backend.

Built with **Vite (vanilla JavaScript)** and designed to deploy for **$0 on
Cloudflare Pages**.

## Features

- ✏️ Freehand pen & 🖍️ highlighter
- ➡️ Arrow, 📏 line, ▭ rectangle, ⬭ ellipse
- 🔤 Text labels (click to place, type, press Enter)
- 🎨 Color picker + adjustable brush size
- ↩️ Undo / ↪️ redo / 🗑️ clear
- ⬇️ Export as PNG or copy to clipboard
- Drag & drop, file picker, and paste (Ctrl+V) image loading
- Keyboard shortcuts: `V H A L R O T` for tools, `Ctrl+Z` undo, `Ctrl+Shift+Z` redo, `Ctrl+S` download, `Ctrl+C` copy image

## Run locally

```bash
npm install
npm run dev        # development server with hot reload
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

## Deploy to Cloudflare Pages (free)

1. Push this folder to a GitHub/GitLab repository.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select your repo, then set the build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. **Save and Deploy.** You'll get a `https://<project>.pages.dev` URL.

Every push to `main` auto-deploys; pull requests get preview deployments.

## Enable analytics

Cloudflare Web Analytics (free, cookieless):

1. Dashboard → **Analytics & Logs** → **Web Analytics** → **Add a site**.
2. Copy the token it gives you.
3. Uncomment the beacon script in both `index.html` and `faq.html` and replace
   `YOUR_TOKEN_HERE` with your token.

The app also ships with `src/analytics.js`, a tiny `track()` helper that
forwards custom events (e.g. `image_loaded`, `draw`, `download`) to Plausible,
Umami, or GA4 if you add any of those later.

## SEO checklist (before going live)

- [ ] Point `inkmark.dev` at the Pages project (Pages → your project → Custom domains).
      Canonical URLs, `robots.txt` and `sitemap.xml` already use `https://inkmark.dev`.
- [ ] Update the `<title>` and meta description to match your final positioning.
- [ ] Add an Open Graph image (`og:image`) once you have one.
- [ ] Submit `sitemap.xml` in Google Search Console + Bing Webmaster Tools.

## Project structure

```
inkmark/
├── index.html            # the editor (single-page app)
├── faq.html              # secondary page for SEO / internal linking
├── vite.config.js        # multi-page build config
├── package.json
├── public/               # copied verbatim into dist/
│   ├── _headers          # Cloudflare Pages security headers
│   ├── _redirects        # /faq → /faq.html rewrite
│   ├── robots.txt
│   ├── sitemap.xml
│   └── favicon.svg
└── src/
    ├── main.js           # UI wiring, drag/drop, shortcuts, analytics events
    ├── editor.js         # canvas engine: drawing, undo/redo, export
    ├── analytics.js      # provider-agnostic track() helper
    └── style.css
```

## Ideas for extending

- Eraser tool, opacity control, zoom/pan
- Export at full image resolution (currently exports at screen resolution)
- Multiple text fonts, shape fill
- Save/restore annotations as JSON
- A blog/how-to section for more SEO surface area
