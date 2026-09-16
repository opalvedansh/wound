import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
const databaseUrl = process.env.DATABASE_URL; // Using transaction pooler for simple SQL

async function main() {
  console.log('Creating "images" bucket...');
  const { data, error } = await supabase.storage.createBucket('images', {
    public: false,
    fileSizeLimit: 10485760, // 10MB
  });
  
  if (error) {
    if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
      console.log('Bucket "images" already exists.');
    } else {
      console.error('Error creating bucket:', error);
    }
  } else {
    console.log('Bucket "images" created successfully.');
  }

  console.log('Configuring Storage RLS policies...');
  
  const sql = `
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
    CREATE POLICY "Allow authenticated uploads" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);

    DROP POLICY IF EXISTS "Allow users to view own images" ON storage.objects;
    CREATE POLICY "Allow users to view own images" 
    ON storage.objects FOR SELECT 
    TO authenticated 
    USING (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);
    
    DROP POLICY IF EXISTS "Allow users to delete own images" ON storage.objects;
    CREATE POLICY "Allow users to delete own images" 
    ON storage.objects FOR DELETE 
    TO authenticated 
    USING (bucket_id = 'images' AND (storage.foldername(name))[1] = auth.uid()::text);
  `;
  
  const client = new Client({
    host: 'aws-0-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.mmxtpivghwtvjxjvuycf',
    password: 'WU5oSJxMn9XbQEpf',
    database: 'postgres',
  });
  try {
    await client.connect();
    await client.query(sql);
    console.log('RLS policies applied successfully.');
  } catch (err) {
    console.error('Error applying RLS:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
