import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const distDir = path.resolve('dist')
const zipOut = path.resolve('inter-chrome-extension.zip')

if (!fs.existsSync(distDir)) {
  console.log('Building dist assets first...')
  execSync('npm run build', { stdio: 'inherit' })
}

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
