import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lhsxqqvtwpwfxeadxtoh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxoc3hxcXZ0d3B3ZnhlYWR4dG9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDA3NjYsImV4cCI6MjA2NzAxNjc2Nn0.rj90cEmV2meNCa7CMVc28PNfMKOwIx8whcLv0TrmPMA'

export const supabase = createClient(supabaseUrl, supabaseKey)
