// Stages the two external binaries into resources/bin so dev and packaged
// builds resolve them the same way (see src/main/lib/binaries.ts):
//   - ffmpeg: copied out of the ffmpeg-static npm package
//   - yt-dlp: downloaded from the latest GitHub release (macos build)
import { createRequire } from 'node:module'
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const binDir = join(root, 'resources', 'bin')
mkdirSync(binDir, { recursive: true })

const require = createRequire(import.meta.url)
const ffmpegSrc = require('ffmpeg-static')
const ffmpegDest = join(binDir, 'ffmpeg')
copyFileSync(ffmpegSrc, ffmpegDest)
chmodSync(ffmpegDest, 0o755)
console.log(`ffmpeg  → ${ffmpegDest}`)

const ytdlpDest = join(binDir, 'yt-dlp')
const force = process.argv.includes('--force')
if (existsSync(ytdlpDest) && !force) {
  console.log(`yt-dlp  → ${ytdlpDest} (cached; pass --force to re-download)`)
} else {
  const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    console.error(`yt-dlp download failed: ${res.status} ${res.statusText}`)
    process.exit(1)
  }
  writeFileSync(ytdlpDest, Buffer.from(await res.arrayBuffer()))
  chmodSync(ytdlpDest, 0o755)
  console.log(`yt-dlp  → ${ytdlpDest} (downloaded latest)`)
}
