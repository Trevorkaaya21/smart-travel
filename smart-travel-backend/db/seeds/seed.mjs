import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY in .env')
  process.exit(1)
}
const supabase = createClient(url, key)

async function main() {
  const { error } = await supabase.from('users').insert([{ email: 'demo@local.test' }])
  if (error) console.error(error)
  else console.log('Seeded users table')
}
main()
