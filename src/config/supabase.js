import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey || !serviceKey) {
  throw new Error('Supabase URL과 Key가 필요합니다.');
}

// 일반 클라이언트 (익명 사용자용)
export const supabase = createClient(supabaseUrl, supabaseKey);

// 서비스 롤 클라이언트 (RLS 우회용)
export const serviceSupabase = createClient(supabaseUrl, serviceKey); 