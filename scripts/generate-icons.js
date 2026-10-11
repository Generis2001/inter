import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// Simple CRC32 implementation for PNG chunks
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const combined = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(combined), 0)
  return Buffer.concat([lenBuf, combined, crcBuf])
}

function encodeRGBAtoPNG(width, height, rgbaBuffer) {
  // scanlines: 1 filter byte (0 = None) followed by width * 4 bytes
  const scanlines = Buffer.alloc(height * (width * 4 + 1))
  let scanlineOffset = 0
  let rgbaOffset = 0

  for (let y = 0; y < height; y++) {
    scanlines[scanlineOffset++] = 0 // Filter type None
    for (let x = 0; x < width; x++) {
      scanlines[scanlineOffset++] = rgbaBuffer[rgbaOffset++] // R
      scanlines[scanlineOffset++] = rgbaBuffer[rgbaOffset++] // G
      scanlines[scanlineOffset++] = rgbaBuffer[rgbaOffset++] // B
      scanlines[scanlineOffset++] = rgbaBuffer[rgbaOffset++] // A
    }
  }

  const compressed = zlib.deflateSync(scanlines)

  // Header
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  // IHDR: 13 bytes
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  const ihdrChunk = createChunk('IHDR', ihdr)

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressed)

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk])
}

// Generate Inter icon (two crossing diagonal arrows with purple to blue gradient)
function renderInterIcon(size) {
  const buffer = Buffer.alloc(size * size * 4)
  const rCorner = size * 0.22 // rounded squircle corner radius

  // Distance to rounded rectangle
  function isInSquircle(x, y) {
    const cx = x - size / 2
    const cy = y - size / 2
    const hw = size / 2 - 2
    const hh = size / 2 - 2
    const dx = Math.abs(cx) - (hw - rCorner)
    const dy = Math.abs(cy) - (hh - rCorner)
    if (dx <= 0 || dy <= 0) return true
    return dx * dx + dy * dy <= rCorner * rCorner
  }

  // Draw arrow strokes
  // Arrow 1: line from (0.2, 0.8) to (0.8, 0.2), plus head at (0.8, 0.2)
  // Arrow 2: head at (0.2, 0.8)
  const strokeW = Math.max(1.8, size * 0.13)
  const halfW = strokeW / 2

  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
    if (l2 === 0) return Math.hypot(px - x1, py - y1)
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)))
  }

  const pStart = { x: size * 0.18, y: size * 0.82 }
  const pEnd = { x: size * 0.82, y: size * 0.18 }

  // Arrowhead 1 at top right: (0.54, 0.18) -> (0.82, 0.18) -> (0.82, 0.46)
  const a1_1 = { x: size * 0.52, y: size * 0.18 }
  const a1_2 = { x: size * 0.82, y: size * 0.18 }
  const a1_3 = { x: size * 0.82, y: size * 0.48 }

  // Arrowhead 2 at bottom left: (0.48, 0.82) -> (0.18, 0.82) -> (0.18, 0.52)
  const a2_1 = { x: size * 0.48, y: size * 0.82 }
  const a2_2 = { x: size * 0.18, y: size * 0.82 }
  const a2_3 = { x: size * 0.18, y: size * 0.52 }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      if (!isInSquircle(x + 0.5, y + 0.5)) {
        buffer[idx] = 0
        buffer[idx + 1] = 0
        buffer[idx + 2] = 0
        buffer[idx + 3] = 0
        continue
      }

      // Dark background gradient (#0b111e to #030712)
      const bgT = (x + y) / (2 * size)
      let r = Math.round(11 * (1 - bgT) + 3 * bgT)
      let g = Math.round(17 * (1 - bgT) + 7 * bgT)
      let b = Math.round(30 * (1 - bgT) + 18 * bgT)
      let a = 255

      // Check distance to main diagonal shaft
      const dShaft = distToSegment(x + 0.5, y + 0.5, pStart.x, pStart.y, pEnd.x, pEnd.y)
      const dA1_h = distToSegment(x + 0.5, y + 0.5, a1_1.x, a1_1.y, a1_2.x, a1_2.y)
      const dA1_v = distToSegment(x + 0.5, y + 0.5, a1_2.x, a1_2.y, a1_3.x, a1_3.y)
      const dA2_h = distToSegment(x + 0.5, y + 0.5, a2_1.x, a2_1.y, a2_2.x, a2_2.y)
      const dA2_v = distToSegment(x + 0.5, y + 0.5, a2_2.x, a2_2.y, a2_3.x, a2_3.y)

      const minD = Math.min(dShaft, dA1_h, dA1_v, dA2_h, dA2_v)

      if (minD <= halfW + 1.0) {
        // Antialiased edge
        const coverage = Math.max(0, Math.min(1, (halfW + 0.8 - minD) / 1.0))
        // Purple #A020F0 (160, 32, 240) to Blue #2A7BFF (42, 123, 255)
        const gradT = Math.max(0, Math.min(1, ((x - pStart.x) + (pStart.y - y)) / (2 * (pEnd.x - pStart.x))))
        const iconR = Math.round(160 * (1 - gradT) + 42 * gradT)
        const iconG = Math.round(32 * (1 - gradT) + 123 * gradT)
        const iconB = Math.round(240 * (1 - gradT) + 255 * gradT)

        r = Math.round(iconR * coverage + r * (1 - coverage))
        g = Math.round(iconG * coverage + g * (1 - coverage))
        b = Math.round(iconB * coverage + b * (1 - coverage))
      }

      buffer[idx] = r
      buffer[idx + 1] = g
      buffer[idx + 2] = b
      buffer[idx + 3] = a
    }
  }

  return encodeRGBAtoPNG(size, size, buffer)
}

const outDir = path.resolve('public/icons')
fs.mkdirSync(outDir, { recursive: true })

const sizes = [16, 32, 48, 128, 192, 512]
for (const s of sizes) {
  const png = renderInterIcon(s)
  fs.writeFileSync(path.join(outDir, `icon-${s}.png`), png)
  fs.writeFileSync(path.join(outDir, `icon${s}.png`), png) // alias without dash
}

console.log('Successfully generated icons:', sizes.map(s => `${s}x${s}`).join(', '))
