import { createClient } from '@supabase/supabase-js'
import './preload-env'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!

export const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
