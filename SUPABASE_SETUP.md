# Supabase Setup Guide for Transformer Asset Management

## 📋 Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub/Email
4. Create a new project:
   - **Project name**: `transformer-assets`
   - **Database password**: (save this!)
   - **Region**: Choose closest to Malaysia (Singapore recommended)
   - Click "Create new project"
   - Wait 2-3 minutes for setup

## 🗄️ Step 2: Create Database Tables

Go to **SQL Editor** in Supabase dashboard and run this SQL:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create transformers table
CREATE TABLE transformers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_name TEXT NOT NULL,
    state TEXT,
    tx_name TEXT NOT NULL,
    mnemonic TEXT,
    serial_number TEXT,
    voltage TEXT NOT NULL,
    load_mva TEXT,
    maker TEXT,
    year_built TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create oil_tests table
CREATE TABLE oil_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transformer_id UUID REFERENCES transformers(id) ON DELETE CASCADE,
    test_date DATE NOT NULL,
    test_type TEXT NOT NULL,
    breakdown DECIMAL(10, 2),
    acidity DECIMAL(10, 4),
    water_content DECIMAL(10, 2),
    interfacial_tension DECIMAL(10, 2),
    color TEXT,
    flash_point DECIMAL(10, 2),
    dielectric_strength DECIMAL(10, 2),
    power_factor DECIMAL(10, 4),
    h2 INTEGER,
    ch4 INTEGER,
    c2h6 INTEGER,
    c2h4 INTEGER,
    c2h2 INTEGER,
    co INTEGER,
    co2 INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table (storing metadata only)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transformer_id UUID REFERENCES transformers(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_transformers_site ON transformers(site_name);
CREATE INDEX idx_transformers_state ON transformers(state);
CREATE INDEX idx_transformers_tx_name ON transformers(tx_name);
CREATE INDEX idx_oil_tests_transformer ON oil_tests(transformer_id);
CREATE INDEX idx_oil_tests_date ON oil_tests(test_date);
CREATE INDEX idx_documents_transformer ON documents(transformer_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for transformers
CREATE TRIGGER update_transformers_updated_at
    BEFORE UPDATE ON transformers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE transformers ENABLE ROW LEVEL SECURITY;
ALTER TABLE oil_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - you can restrict later)
CREATE POLICY "Enable read access for all users" ON transformers FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON transformers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON transformers FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON transformers FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON oil_tests FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON oil_tests FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON oil_tests FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON oil_tests FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON documents FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON documents FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON documents FOR DELETE USING (true);
```

## 📦 Step 3: Create Storage Bucket for Documents

1. Go to **Storage** in Supabase dashboard
2. Click "Create a new bucket"
3. **Name**: `transformer-documents`
4. **Public bucket**: ✅ Check this (so you can view documents)
5. Click "Create bucket"

### Set Storage Policies:

Click on the bucket → Policies → "New Policy" → Choose "For full customization":

```sql
-- Allow all operations on transformer-documents bucket
CREATE POLICY "Public Access"
ON storage.objects FOR ALL
USING (bucket_id = 'transformer-documents');
```

Or use the UI:
- Policy name: "Public Access"
- Allowed operations: SELECT, INSERT, UPDATE, DELETE
- Target roles: public
- USING expression: `bucket_id = 'transformer-documents'`

## 🔑 Step 4: Get Your API Credentials

1. Go to **Project Settings** (⚙️ icon)
2. Go to **API** section
3. Copy these values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGc....(very long key)
```

## 💻 Step 5: Configure Your App

Create a file `.env.local` in your project root:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**IMPORTANT**: 
- Replace with YOUR actual values from Step 4
- Don't share these keys publicly
- Add `.env.local` to `.gitignore` (already done)

## ✅ Step 6: Install Dependencies

```bash
npm install @supabase/supabase-js
```

## 🚀 Step 7: Run Your App

```bash
npm run dev
```

## 🧪 Test the Database

After setup, you can verify in Supabase:

1. Go to **Table Editor**
2. You should see:
   - `transformers` table
   - `oil_tests` table
   - `documents` table

3. Go to **Storage**
4. You should see:
   - `transformer-documents` bucket

## 📊 Sample Data (Optional)

You can insert test data via SQL Editor:

```sql
-- Insert a sample transformer
INSERT INTO transformers (site_name, state, tx_name, mnemonic, serial_number, voltage, load_mva, maker, year_built, latitude, longitude)
VALUES 
('Substation Alpha', 'Selangor', 'TX-001', 'TXALP01', 'SN-2024-001', '132/33 kV', '60', 'ABB', '2020', 3.1390, 101.6869);

-- Get the transformer ID and insert sample oil test
-- (Replace 'transformer-id' with actual ID from above)
INSERT INTO oil_tests (transformer_id, test_date, test_type, breakdown, acidity, water_content, h2, ch4)
VALUES 
('transformer-id', '2024-02-01', 'Routine', 55.5, 0.12, 20, 45, 25);
```

## State Grouping Migration

If your `transformers` table already exists, run this once before saving manual state assignments from the app:

```sql
ALTER TABLE transformers
ADD COLUMN IF NOT EXISTS state TEXT;

CREATE INDEX IF NOT EXISTS idx_transformers_state ON transformers(state);
```

## DGA Workspace Preference Migration

If you want to persist each transformer's DGA workspace selections (insulating liquid, gas limit standard, and method view), run this once:

```sql
ALTER TABLE transformers
ADD COLUMN IF NOT EXISTS dga_oil_type TEXT,
ADD COLUMN IF NOT EXISTS dga_gas_limit_standard TEXT,
ADD COLUMN IF NOT EXISTS dga_method_view TEXT;
```

## 🔒 Security Notes (Production)

For production use, you should:

1. **Restrict RLS policies** to authenticated users only
2. **Add authentication** (Supabase has built-in auth)
3. **Secure storage bucket** with proper policies
4. **Use service role key** only on backend
5. **Never commit** .env.local to Git

## 🆘 Troubleshooting

### Issue: "relation does not exist"
**Fix**: Make sure you ran all SQL in Step 2

### Issue: "Storage bucket not found"
**Fix**: Create the bucket in Step 3

### Issue: "Row Level Security" errors
**Fix**: Check if policies are enabled in SQL (Step 2)

### Issue: Can't upload files
**Fix**: Check storage bucket policies are set correctly

### Issue: CORS errors
**Fix**: Supabase handles CORS automatically, check your API keys

## 📚 Useful Supabase Dashboard Links

- **Table Editor**: View/edit data directly
- **SQL Editor**: Run custom queries
- **Storage**: Manage uploaded files
- **API Docs**: Auto-generated API documentation
- **Logs**: Debug errors and monitor usage

## 🎉 You're Ready!

Your app is now connected to PostgreSQL via Supabase. All data will be stored in the cloud and accessible from anywhere!

---

**Next Steps**: Follow the INTEGRATION_GUIDE.md to understand how the app uses Supabase.
