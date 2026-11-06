# Handyman Cloud-Direct Photo & Project Sync

All handyman project cards and photos are managed **100% in the cloud** with zero local Mac file scanning.

## How It Works

1. **Google Cloud Photo Album** (`photo-sync.config.json`):
   - Upload jobsite photos from your phone to your shared Google Photos album.
   - Photos are served directly from Google's Cloud CDN (`lh3.googleusercontent.com`).
2. **Online Admin Portal (`/handyman/admin`)**:
   - Log in at `https://mattmoniz.io/handyman/admin`.
   - Click **Scan Album** to pull new photos directly from Google Cloud into your Staging Queue, or let the 6-hour GitHub Action (`sync-photos.yml`) auto-stage new uploads in the background.
   - Organize project titles, descriptions, categories, and cover photos, then click **Publish Live** to update `src/data/projects.json` in the cloud.
