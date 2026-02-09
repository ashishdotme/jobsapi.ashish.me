import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = process.cwd()
const sourceDir = join(rootDir, 'dashboard', 'dist')
const targetDir = join(rootDir, 'dist', 'dashboard')

if (!existsSync(sourceDir)) {
  throw new Error(`Dashboard build output not found at ${sourceDir}`)
}

mkdirSync(targetDir, { recursive: true })
cpSync(sourceDir, targetDir, { recursive: true, force: true })
console.log(`Copied dashboard assets from ${sourceDir} to ${targetDir}`)
