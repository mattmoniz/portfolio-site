import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function localProjectEditorPlugin() {
  return {
    name: 'local-project-editor',
    configureServer(server) {
      // Middleware for admin functions and saving
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : ''

        if (url === '/.netlify/functions/handyman-admin' || url === '/api/handyman-admin') {
          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', async () => {
              try {
                const data = JSON.parse(body || '{}')
                const action = data.action

                if (action === 'verify-google') {
                  const allowedEmail = process.env.ADMIN_ALLOWED_EMAIL || 'monizri@gmail.com'
                  try {
                    const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${data.credential}`)
                    if (gRes.ok) {
                      const payload = await gRes.json()
                      if (payload.email && payload.email.toLowerCase() === allowedEmail.toLowerCase()) {
                        res.writeHead(200, { 'Content-Type': 'application/json' })
                        return res.end(JSON.stringify({
                          authenticated: true,
                          token: 'google-token-verified',
                          user: { email: payload.email, name: payload.name || 'Matthew Moniz', picture: payload.picture || '' }
                        }))
                      }
                      res.writeHead(403, { 'Content-Type': 'application/json' })
                      return res.end(JSON.stringify({ error: `Access denied. Restricted to ${allowedEmail}` }))
                    }
                  } catch (e) {}
                  res.writeHead(401, { 'Content-Type': 'application/json' })
                  return res.end(JSON.stringify({ error: 'Invalid Google token' }))
                }

                if (action === 'load-cloud-data') {
                  const projectsPath = path.resolve(__dirname, 'src/data/projects.json')
                  const stagedPath = path.resolve(__dirname, 'src/data/stagedProjects.json')
                  const mediaPath = path.resolve(__dirname, 'src/data/syncedMedia.json')
                  const projects = fs.existsSync(projectsPath) ? JSON.parse(fs.readFileSync(projectsPath, 'utf8')) : []
                  const stagedProjects = fs.existsSync(stagedPath) ? JSON.parse(fs.readFileSync(stagedPath, 'utf8')) : []
                  const media = fs.existsSync(mediaPath) ? JSON.parse(fs.readFileSync(mediaPath, 'utf8')) : {}
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  return res.end(JSON.stringify({ projects, stagedProjects, seenBaseUrls: media.seenBaseUrls || [] }))
                }

                if (action === 'reject-photo') {
                  const mediaPath = path.resolve(__dirname, 'src/data/syncedMedia.json')
                  const stagedPath = path.resolve(__dirname, 'src/data/stagedProjects.json')
                  const media = fs.existsSync(mediaPath) ? JSON.parse(fs.readFileSync(mediaPath, 'utf8')) : { seenBaseUrls: [], rejectedUrls: [] }
                  if (!Array.isArray(media.seenBaseUrls)) media.seenBaseUrls = []
                  if (!Array.isArray(media.rejectedUrls)) media.rejectedUrls = []
                  for (const u of data.urls || []) {
                    const base = String(u || '').split('=')[0]
                    if (base && !media.seenBaseUrls.includes(base)) media.seenBaseUrls.push(base)
                    if (base && !media.rejectedUrls.includes(base)) media.rejectedUrls.push(base)
                  }
                  fs.writeFileSync(mediaPath, JSON.stringify(media, null, 2), 'utf8')
                  if (Array.isArray(data.stagedProjects)) {
                    fs.writeFileSync(stagedPath, JSON.stringify(data.stagedProjects, null, 2), 'utf8')
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  return res.end(JSON.stringify({ success: true, seenBaseUrls: media.seenBaseUrls }))
                }

                if (action === 'scan-album') {
                  const albumUrl = data.albumUrl || 'https://photos.app.goo.gl/rzsCye2XgjAZUvW69'
                  const resp = await fetch(albumUrl, { redirect: 'follow' })
                  const html = await resp.text()
                  const matches = html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g) || []
                  const uniquePhotos = Array.from(new Set(matches)).map((u) => `${u}=w1600-h1600-no`)

                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  return res.end(JSON.stringify({ totalFound: uniquePhotos.length, photos: uniquePhotos }))
                }

                if (action === 'save-staged') {
                  const stagedPath = path.resolve(__dirname, 'src/data/stagedProjects.json')
                  fs.writeFileSync(stagedPath, JSON.stringify(data.stagedProjects || [], null, 2), 'utf8')
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  return res.end(JSON.stringify({ ok: true }))
                }

                if (action === 'publish-live') {
                  if (data.projects) {
                    const projectsPath = path.resolve(__dirname, 'src/data/projects.json')
                    fs.writeFileSync(projectsPath, JSON.stringify(data.projects, null, 2), 'utf8')
                  }
                  if (data.stagedProjects) {
                    const stagedPath = path.resolve(__dirname, 'src/data/stagedProjects.json')
                    fs.writeFileSync(stagedPath, JSON.stringify(data.stagedProjects, null, 2), 'utf8')
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  return res.end(JSON.stringify({
                    success: true,
                    message: 'Changes saved locally! Run `npm run publish` or use the GitHub deploy function to push live to Netlify.'
                  }))
                }

                res.writeHead(400, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ error: 'Unknown action' }))
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ error: err.message }))
              }
            })
            return
          }
        }

        if (url === '/api/save-projects') {
          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', () => {
              try {
                const updatedData = JSON.parse(body)
                const projectsPath = path.resolve(__dirname, 'src/data/projects.json')
                fs.writeFileSync(projectsPath, JSON.stringify(updatedData, null, 2), 'utf8')
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: err.message }))
              }
            })
            return
          }
        }

        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localProjectEditorPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
})
