import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://prsqsdxuqbeylplanqdf.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_zjzGNTwR_t2IHmJKDfnzWg_OB0BqQMD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
