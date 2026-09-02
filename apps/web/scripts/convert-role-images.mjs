import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import sharp from 'sharp'

const TARGET_WIDTHS = [320, 480, 674]
const WEBP_OPTIONS = {
  quality: 82,
  alphaQuality: 100,
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(webRoot, '../..')
const sourceDir = path.join(repoRoot, 'images/source/roles')
const outputDir = path.join(webRoot, 'public/images/roles')

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

function roleSlug(filename) {
  return path
    .basename(filename, path.extname(filename))
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function requestedRoleSlugs() {
  return process.argv
    .slice(2)
    .filter((argument) => argument !== '--')
    .map(roleSlug)
}

async function discoverSources(requestedSlugs) {
  const entries = await readdir(sourceDir, { withFileTypes: true })
  const pngFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.startsWith('_') &&
        path.extname(entry.name).toLowerCase() === '.png',
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  if (requestedSlugs.length === 0) return { files: pngFiles, missing: [] }

  const filesBySlug = new Map(pngFiles.map((filename) => [roleSlug(filename), filename]))
  const files = []
  const missing = []

  for (const slug of requestedSlugs) {
    const filename = filesBySlug.get(slug)
    if (filename) files.push(filename)
    else missing.push(slug)
  }

  return { files: [...new Set(files)], missing }
}

async function writeVariant({ sourcePath, sourceMetadata, slug, width }) {
  if (sourceMetadata.width < width) {
    return {
      status: 'skipped',
      message: `${slug}: skipped ${width}w because the source is only ${sourceMetadata.width}px wide`,
    }
  }

  const expectedHeight = Math.round((sourceMetadata.height * width) / sourceMetadata.width)
  const filename = `${slug}-${width}.webp`
  const outputPath = path.join(outputDir, filename)
  const temporaryPath = path.join(
    outputDir,
    `.${filename}.${process.pid}.${crypto.randomUUID()}.tmp`,
  )

  try {
    await sharp(sourcePath)
      .resize({ width, withoutEnlargement: true })
      .toColourspace('srgb')
      .webp(WEBP_OPTIONS)
      .toFile(temporaryPath)

    const metadata = await sharp(temporaryPath).metadata()
    if (
      metadata.format !== 'webp' ||
      metadata.width !== width ||
      metadata.height !== expectedHeight ||
      (sourceMetadata.hasAlpha && !metadata.hasAlpha)
    ) {
      throw new Error(
        `validation failed for ${filename}: received ${metadata.format} ${metadata.width}x${metadata.height}, alpha=${metadata.hasAlpha}`,
      )
    }

    await rename(temporaryPath, outputPath)
    const outputStats = await stat(outputPath)

    return {
      status: 'written',
      filename,
      width: metadata.width,
      height: metadata.height,
      bytes: outputStats.size,
    }
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

async function convertSource(filename) {
  const sourcePath = path.join(sourceDir, filename)
  const sourceStats = await stat(sourcePath)
  const sourceMetadata = await sharp(sourcePath).metadata()
  const slug = roleSlug(filename)

  if (!slug) throw new Error(`${filename}: filename does not produce a valid URL slug`)
  if (!sourceMetadata.width || !sourceMetadata.height) {
    throw new Error(`${filename}: source dimensions could not be read`)
  }

  const variants = []
  for (const width of TARGET_WIDTHS) {
    variants.push(await writeVariant({ sourcePath, sourceMetadata, slug, width }))
  }

  return {
    filename,
    sourceBytes: sourceStats.size,
    variants,
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true })

  const requestedSlugs = requestedRoleSlugs()
  const { files, missing } = await discoverSources(requestedSlugs)
  const failures = missing.map((slug) => `${slug}: no matching PNG in ${sourceDir}`)
  const results = []

  if (files.length === 0 && failures.length === 0) {
    failures.push(`no PNG source files found in ${sourceDir}`)
  }

  for (const filename of files) {
    try {
      results.push(await convertSource(filename))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${filename}: ${message}`)
    }
  }

  for (const result of results) {
    console.log(`${result.filename} (${formatBytes(result.sourceBytes)})`)
    for (const variant of result.variants) {
      if (variant.status === 'skipped') {
        console.warn(`  ${variant.message}`)
        continue
      }

      const savings = 100 - (variant.bytes / result.sourceBytes) * 100
      console.log(
        `  ${variant.filename}: ${variant.width}x${variant.height}, ${formatBytes(variant.bytes)} (${savings.toFixed(1)}% smaller)`,
      )
    }
  }

  if (failures.length > 0) {
    console.error('Role image conversion failed:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
  }
}

await main()
