import { config } from 'dotenv'
import path from 'path'

const envFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../../.env'),
]

for (const file of envFiles) {
  const result = config({ path: file, override: false })
  if (result.error) {
    const err = result.error as NodeJS.ErrnoException
    if (err.code !== 'ENOENT') {
      console.warn(`[env] Failed to load ${file}:`, err.message)
    }
  }
}
