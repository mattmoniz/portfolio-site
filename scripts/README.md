# Handyman Photo Auto-Sync Tool

Upload photos directly from your phone (via Google Photos album or local incoming folder) and automatically publish them to your live website!

---

## 📱 How to Use with Google Photos

### 1. Create a Shared Album in Google Photos
1. Open the **Google Photos** app on your iPhone or Android.
2. Create an album named e.g. **`Handyman Website Photos`**.
3. Tap **Share** (icon with person/link) -> **Create link** (or copy link).
   - Your link will look like: `https://photos.app.goo.gl/abcdef123456`

### 2. Paste the Link into `photo-sync.config.json`
Open [`photo-sync.config.json`](file:///Users/matthewmoniz/Documents/portfolio/matt-portfolio-site/photo-sync.config.json) in your project root and paste your link:
```json
{
  "albums": [
    {
      "url": "https://photos.app.goo.gl/your-actual-album-link",
      "category": "Recent Work",
      "title": "Recent Jobsite Work & Upgrades"
    }
  ],
  "autoDeploy": true
}
```

### 3. Sync & Deploy
Whenever you take photos on the job and add them to your Google Photos album:
Run:
```bash
npm run sync-photos:deploy
```
The tool will:
1. Fetch and detect all newly uploaded photos from Google Photos.
2. Download high-resolution originals.
3. Automatically optimize, resize, and convert HEIC to web-ready JPEG.
4. Add them to the live project gallery in `src/assets/handyman/`.
5. Automatically `git push` to GitHub, triggering Netlify to deploy your live site in ~30 seconds!

---

## 📁 Alternate Method: Drop Photos Locally
You can also drag and drop photos directly into [`incoming-photos/`](file:///Users/matthewmoniz/Documents/portfolio/matt-portfolio-site/incoming-photos/):
```bash
npm run sync-photos:deploy
```
Any files dropped into `incoming-photos/` are instantly converted, optimized, added to the site, and auto-deployed!

---

## ☁️ 100% Automated Cloud Sync (GitHub Action)
A GitHub Action is pre-configured in [`.github/workflows/sync-photos.yml`](file:///Users/matthewmoniz/Documents/portfolio/matt-portfolio-site/.github/workflows/sync-photos.yml).
Once pushed to GitHub, it will automatically check your Google Photos album every 6 hours and update your website with zero manual steps!
