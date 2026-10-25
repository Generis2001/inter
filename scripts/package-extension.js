import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const distDir = path.resolve('dist')
const unpackedDir = path.resolve('unpacked-extension')
const zipOut = path.resolve('inter-chrome-extension.zip')

if (!fs.existsSync(distDir)) {
  console.log('Building dist assets first...')
  execSync('npm run build', { stdio: 'inherit' })
}

// Keep unpacked-extension directory synchronized with latest dist
console.log('Syncing dist assets to unpacked-extension/...')
fs.mkdirSync(unpackedDir, { recursive: true })
fs.cpSync(distDir, unpackedDir, { recursive: true, force: true })
console.log('✅ unpacked-extension directory updated')

if (fs.existsSync(zipOut)) {
  fs.unlinkSync(zipOut)
}

console.log('Packaging Chrome Extension into inter-chrome-extension.zip...')

try {
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${distDir}/*' -DestinationPath '${zipOut}' -Force"`, {
      stdio: 'inherit',
    })
  } else {
    execSync(`cd "${distDir}" && zip -r "${zipOut}" ./*`, { stdio: 'inherit' })
  }
  console.log('✅ Extension packaged successfully:', zipOut)
} catch (err) {
  console.error('Failed to package extension:', err.message)
}
