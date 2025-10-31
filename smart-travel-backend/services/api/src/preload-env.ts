import { config } from 'dotenv'
import path from 'path'

const envFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../../.env'),
]

for (const file of envFiles) {
  const result = config({ path: file, override: false })
  if (result.error && result.error.code !== 'ENOENT') {
    console.warn(`[env] Failed to load ${file}:`, result.error.message)
  }
}
