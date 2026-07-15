import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://liodtsduojdesnzpqlxk.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WaKbEWi0V9s75kyQHMeF7Q_HT3OP7x_'

export const supabase = createClient(url, key)
