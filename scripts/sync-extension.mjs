import fs from 'node:fs'
import path from 'node:path'

export function syncExtensionBuild(buildDir, targetDir, { requireExisting = false } = {}) {
  const source = path.resolve(buildDir)
  const target = path.resolve(targetDir)
  if (source === target) return
  if (target.startsWith(source + path.sep) || source.startsWith(target + path.sep)) throw new Error('Extension output must be separate from the build directory.')

  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'))
  const installedManifest = path.join(target, 'manifest.json')
  let installedKey
  if (fs.existsSync(installedManifest)) {
    const installed = JSON.parse(fs.readFileSync(installedManifest, 'utf8'))
    if (installed.name !== manifest.name) throw new Error('Extension sync target belongs to a different app.')
    installedKey = installed.key
  } else if (requireExisting) {
    throw new Error('INTER_EXTENSION_DIR must point to your existing unpacked Inter extension folder.')
  }

  fs.mkdirSync(target, { recursive: true })
  // Copy assets before the entry page. Keep the installed path/key so Chrome
  // retains the extension identity and its existing browser storage.
  for (const entry of fs.readdirSync(source)) {
    if (entry === 'index.html' || entry === 'manifest.json') continue
    fs.cpSync(path.join(source, entry), path.join(target, entry), { recursive: true, force: true })
  }
  fs.copyFileSync(path.join(source, 'index.html'), path.join(target, 'index.html'))
  fs.writeFileSync(installedManifest, JSON.stringify(installedKey ? { ...manifest, key: installedKey } : manifest, null, 2) + '\n')
  console.log(`Inter extension refreshed: ${target}`)
}
