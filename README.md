# Dialogue Box Tool

Internal tool for generating and composing dialogue box brand assets with correct radius and descender geometry.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens at `http://localhost:5173`

## Deploy to GitHub Pages

### First time setup

1. Create a new repo on GitHub (can be private)
2. Update `base` in `vite.config.js` to match your repo name:
   ```js
   base: '/your-repo-name/'
   ```
3. Push the code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin git@github.com:your-org/your-repo-name.git
   git push -u origin main
   ```
4. Deploy:
   ```bash
   npm run deploy
   ```
5. In GitHub repo settings, go to **Pages** and set source to **Deploy from a branch**, branch **gh-pages**, root **/**.

Your tool will be live at `https://your-org.github.io/your-repo-name/`

### Subsequent deploys

After making changes:

```bash
npm run deploy
```

## Notes

- The page includes `<meta name="robots" content="noindex, nofollow">` so it won't be indexed by search engines
- The URL is unguessable unless you share it
- If using a private repo, GitHub Pages is available on GitHub Pro/Team/Enterprise plans
