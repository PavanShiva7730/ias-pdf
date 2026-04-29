# IAS PDF Generator for Testbook LMS

This app lets you paste IAS preparation content and generate three downloadable PDFs:

1. Study Notes by Ravi Kapoor
2. Short Notes by Ravi Kapoor
3. Mind Map by Ravi Kapoor

It uses OpenAI on the server side, so your API key is not exposed in browser code.

## Deploy

Recommended deployment: Vercel.

### 1. Install

```bash
npm install
npm run dev
```

### 2. Add environment variables

Create `.env.local`:

```bash
OPENAI_API_KEY=sk-your-key-here
```

Optional CDN links through Vercel Blob:

```bash
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

Without Vercel Blob, the app still creates direct browser downloads.

### 3. Push to GitHub

```bash
git init
git add .
git commit -m "Add IAS PDF generator"
git branch -M main
git remote add origin YOUR_REPO_URL
git push -u origin main
```

### 4. Deploy on Vercel

- Import the GitHub repo in Vercel.
- Add `OPENAI_API_KEY` in Project Settings > Environment Variables.
- Add `BLOB_READ_WRITE_TOKEN` only if CDN URLs are needed.
- Deploy.

## Why not GitHub Pages?

GitHub Pages is static. It cannot safely keep your OpenAI API key secret. Use Vercel, Render, Railway or another server-capable host.

## Template details

Each PDF includes:

- Clean A4 layout
- Strict margins and padding
- Header and footer branding
- Ravi Kapoor attribution
- End quote in Hindi
- Separate visual mind map PDF
