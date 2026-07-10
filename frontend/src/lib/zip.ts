/**
 * Minimal ZIP reader/writer, dependency-free.
 *
 * Campaign archives are a handful of small JSON files, so we write them
 * "stored" — deflate would buy a few kilobytes and cost a dependency. We still
 * *read* deflate, via the platform's DecompressionStream, because a user who
 * unzips an archive, edits a file and rezips it with their OS gets deflate back.
 */

export interface ZipEntry {
  name: string
  text: string
}

// ── CRC-32 (IEEE 802.3), table built once ────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ── Writer ───────────────────────────────────────────────────────────────────
export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = encoder.encode(entry.text)
    const crc = crc32(data)

    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)  // local file header signature
    lv.setUint16(4, 20, true)          // version needed
    lv.setUint16(6, 0x0800, true)      // flags: UTF-8 names
    lv.setUint16(8, 0, true)           // method: stored
    lv.setUint16(10, 0, true)          // mod time
    lv.setUint16(12, 0x21, true)       // mod date: 1980-01-01, deterministic
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)          // extra field length
    local.set(name, 30)

    const cd = new Uint8Array(46 + name.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)  // central directory signature
    cv.setUint16(4, 20, true)          // version made by
    cv.setUint16(6, 20, true)          // version needed
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint16(30, 0, true)          // extra
    cv.setUint16(32, 0, true)          // comment
    cv.setUint16(34, 0, true)          // disk number
    cv.setUint16(36, 0, true)          // internal attrs
    cv.setUint32(38, 0, true)          // external attrs
    cv.setUint32(42, offset, true)     // offset of local header
    cd.set(name, 46)

    parts.push(local, data)
    central.push(cd)
    offset += local.length + data.length
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)    // end of central directory
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)            // comment length

  return new Blob([...parts, ...central, end] as BlobPart[], { type: 'application/zip' })
}

// ── Reader ───────────────────────────────────────────────────────────────────
export class ZipError extends Error {}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new ZipError('Ce navigateur ne sait pas lire les archives compressées.')
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Reads a zip. Entry names map to their UTF-8 text contents. */
export async function readZip(blob: Blob): Promise<Map<string, string>> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const decoder = new TextDecoder()

  // The end-of-central-directory record sits at the tail, after an optional
  // comment, so scan backwards for its signature.
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new ZipError('Archive illisible : fin de répertoire introuvable.')

  const count = view.getUint16(eocd + 10, true)
  let pos = view.getUint32(eocd + 16, true)

  const files = new Map<string, string>()
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new ZipError('Archive corrompue.')
    const method = view.getUint16(pos + 10, true)
    const crc = view.getUint32(pos + 16, true)
    const compressedSize = view.getUint32(pos + 20, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extraLen = view.getUint16(pos + 30, true)
    const commentLen = view.getUint16(pos + 32, true)
    const localOffset = view.getUint32(pos + 42, true)
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen))

    if (method !== 0 && method !== 8) {
      throw new ZipError(`« ${name} » utilise une compression non reconnue.`)
    }

    // The local header repeats the name and extra field with its own lengths.
    const localNameLen = view.getUint16(localOffset + 26, true)
    const localExtraLen = view.getUint16(localOffset + 28, true)
    const start = localOffset + 30 + localNameLen + localExtraLen
    const raw = bytes.subarray(start, start + compressedSize)
    const data = method === 8 ? await inflateRaw(raw) : raw
    if (crc32(data) !== crc) throw new ZipError(`« ${name} » est corrompu.`)

    if (!name.endsWith('/')) files.set(name, decoder.decode(data))
    pos += 46 + nameLen + extraLen + commentLen
  }
  return files
}
