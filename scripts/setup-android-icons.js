import fs from 'node:fs'
import path from 'node:path'

const resDir = path.resolve('android/app/src/main/res')
const icon16 = path.resolve('public/icons/icon-16.png')
const icon48 = path.resolve('public/icons/icon-48.png')
const icon128 = path.resolve('public/icons/icon-128.png')
const icon192 = path.resolve('public/icons/icon-192.png')

const mipmaps = [
  { dir: 'mipmap-mdpi', file: icon48 },
  { dir: 'mipmap-hdpi', file: icon48 },
  { dir: 'mipmap-xhdpi', file: icon128 },
  { dir: 'mipmap-xxhdpi', file: icon128 },
  { dir: 'mipmap-xxxhdpi', file: icon192 },
]

for (const m of mipmaps) {
  const targetDir = path.join(resDir, m.dir)
  fs.mkdirSync(targetDir, { recursive: true })
  fs.copyFileSync(m.file, path.join(targetDir, 'ic_launcher.png'))
  fs.copyFileSync(m.file, path.join(targetDir, 'ic_launcher_round.png'))
}

console.log('✅ Android mipmap launcher icons created successfully.')
