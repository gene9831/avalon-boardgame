import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MINIMUM_FONT_SIZE_PX = 12
const MINIMUM_NUMERIC_FONT_SIZE_PX = 10
const ROOT_FONT_SIZE_PX = 16
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])
const NUMERIC_TEXT_SELECTOR = /\[data-numeric-text=(?:'true'|"true")\]/

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(entryPath))
    else files.push(entryPath)
  }

  return files
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length
}

function toPixels(value, unit) {
  return Number(value) * (unit === 'rem' ? ROOT_FONT_SIZE_PX : 1)
}

function findLocalStyleImports(source, sourceFile) {
  const imports = []
  const pattern = /['"](\.\.?\/[^'"]+\.css)['"]/g
  let match

  while ((match = pattern.exec(source)) !== null) {
    imports.push(path.resolve(path.dirname(sourceFile), match[1]))
  }

  return imports
}

function fontSizeViolation(file, source, index, value, unit, kind, minimumPixels = MINIMUM_FONT_SIZE_PX) {
  const pixels = toPixels(value, unit)
  if (pixels >= minimumPixels) return undefined

  return {
    file,
    kind,
    line: lineNumberAt(source, index),
    minimumPixels,
    pixels,
    sourceValue: `${value}${unit}`,
  }
}

function auditCodeFile(file, source) {
  const violations = []
  const tailwindPattern = /\btext-\[(\d*\.?\d+)(px|rem)\]/g
  const inlinePattern = /\bfontSize\s*:\s*['"]?(\d*\.?\d+)(px|rem)?/g
  let match

  while ((match = tailwindPattern.exec(source)) !== null) {
    const violation = fontSizeViolation(file, source, match.index, match[1], match[2], 'Tailwind font size')
    if (violation) violations.push(violation)
  }

  while ((match = inlinePattern.exec(source)) !== null) {
    const violation = fontSizeViolation(file, source, match.index, match[1], match[2] ?? 'px', 'inline font size')
    if (violation) violations.push(violation)
  }

  return violations
}

function auditCssFile(file, source) {
  const violations = []
  const declarationPattern = /\b(font-size|font)\s*:\s*([^;}]+)/g
  let declaration

  while ((declaration = declarationPattern.exec(source)) !== null) {
    const blockStart = source.lastIndexOf('{', declaration.index)
    const previousBlockEnd = source.lastIndexOf('}', blockStart)
    const selector = source.slice(previousBlockEnd + 1, blockStart)
    const minimumPixels = NUMERIC_TEXT_SELECTOR.test(selector)
      ? MINIMUM_NUMERIC_FONT_SIZE_PX
      : MINIMUM_FONT_SIZE_PX
    const valuePattern = /(\d*\.?\d+)(px|rem)\b/g
    const values = [...declaration[2].matchAll(valuePattern)]
    const candidates = declaration[1] === 'font' ? values.slice(0, 1) : values

    for (const value of candidates) {
      const violation = fontSizeViolation(
        file,
        source,
        declaration.index,
        value[1],
        value[2],
        `CSS ${declaration[1]}`,
        minimumPixels,
      )
      if (violation) violations.push(violation)
    }
  }

  return violations
}

async function audit(sourceRoot) {
  const files = await listFiles(sourceRoot)
  const codeFiles = files.filter((file) => CODE_EXTENSIONS.has(path.extname(file)))
  const styleFiles = new Set()
  const violations = []

  for (const file of codeFiles) {
    const source = await readFile(file, 'utf8')
    violations.push(...auditCodeFile(file, source))
    for (const styleFile of findLocalStyleImports(source, file)) styleFiles.add(styleFile)
  }

  for (const file of styleFiles) {
    const source = await readFile(file, 'utf8')
    violations.push(...auditCssFile(file, source))
  }

  return violations.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line)
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultSourceRoot = path.resolve(scriptDirectory, '../src')
const sourceRoot = path.resolve(process.argv[2] ?? defaultSourceRoot)
const violations = await audit(sourceRoot)

if (violations.length > 0) {
  console.log(
    `Visible text must use a font size of at least ${MINIMUM_FONT_SIZE_PX}px; `
    + `explicitly marked standalone numbers may use ${MINIMUM_NUMERIC_FONT_SIZE_PX}px:`,
  )
  for (const violation of violations) {
    console.log(
      `${path.relative(sourceRoot, violation.file)}:${violation.line} `
      + `${violation.kind} ${violation.sourceValue} resolves to ${violation.pixels}px `
      + `(minimum ${violation.minimumPixels}px)`,
    )
  }
  process.exitCode = 1
}
