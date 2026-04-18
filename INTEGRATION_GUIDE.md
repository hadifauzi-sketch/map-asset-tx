# Supabase Integration Guide

This document explains how the Transformer Asset Management app integrates with Supabase.

## 🏗️ Architecture Overview

```
React Frontend (Your App)
    ↓
Supabase Client (lib/supabaseClient.js)
    ↓
Supabase Cloud
    ├── PostgreSQL Database (Tables)
    └── Storage (File uploads)
```

## 📦 Core Components

### 1. Supabase Client (`lib/supabaseClient.js`)

The central configuration point:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);
```

**What it does**:
- Creates authenticated connection to Supabase
- Uses environment variables for security
- Shared across all service modules

### 2. Service Layer (`lib/*Service.js`)

#### transformerService.js
Handles transformer CRUD operations:
- `getAll()` - Fetch all transformers with related data
- `getById(id)` - Fetch single transformer
- `create(data)` - Add new transformer
- `update(id, data)` - Update transformer
- `updatePosition(id, position)` - Update GPS coordinates
- `delete(id)` - Remove transformer (cascades to tests & docs)

**Key Features**:
- Joins with oil_tests and documents tables
- Transforms snake_case (DB) to camelCase (React)
- Error handling and logging

#### oilTestService.js
Manages oil test records:
- `getByTransformerId(id)` - Fetch tests for a transformer
- `create(transformerId, data)` - Add new test
- `update(testId, data)` - Update test
- `delete(testId)` - Remove test

**Key Features**:
- Foreign key relationship to transformers
- Handles nullable fields (optional test parameters)
- Date formatting

#### documentService.js
Handles file uploads and metadata:
- `upload(transformerId, file)` - Upload file to Storage
- `uploadMultiple(transformerId, files)` - Batch upload
- `getPublicUrl(path)` - Get viewable URL
- `download(path, name)` - Download file
- `delete(id, path)` - Remove from Storage and DB

**Key Features**:
- Uploads to Supabase Storage bucket
- Stores metadata in documents table
- Generates unique file paths
- Returns public URLs for viewing

## 🔄 Data Flow Examples

### Example 1: Adding a Transformer

```
User fills form → handleAddTransformer()
    ↓
transformerService.create(data)
    ↓
supabase.from('transformers').insert([{...}])
    ↓
PostgreSQL INSERT
    ↓
Returns new transformer with ID
    ↓
loadTransformers() refreshes UI
```

### Example 2: Uploading a Document

```
User selects file → handleFileUpload()
    ↓
documentService.upload(transformerId, file)
    ↓
[1] supabase.storage.from('transformer-documents').upload(path, file)
    → Uploads file to Storage
    ↓
[2] supabase.from('documents').insert([{...}])
    → Saves metadata to database
    ↓
Returns document with public URL
    ↓
onUpdate() refreshes document list
```

### Example 3: Viewing Oil Tests

```
User clicks "Oil Tests" tab
    ↓
Component mounts → useEffect()
    ↓
Already loaded via getAll() with join
    ↓
Displays transformer.oilTests array
```

## 🗃️ Database Relationships

```
transformers (1)
    ↓ has many
oil_tests (N)

transformers (1)
    ↓ has many
documents (N)
```

**Cascade Delete**: When a transformer is deleted, all related oil tests and documents are automatically deleted.

## 🔐 Security Implementation

### Row Level Security (RLS)

Currently configured for public access:

```sql
CREATE POLICY "Enable all for all users" ON transformers
    FOR ALL USING (true);
```

### For Production (Restricted Access):

```sql
-- Allow only authenticated users
CREATE POLICY "Authenticated users only" ON transformers
    FOR ALL USING (auth.role() = 'authenticated');

-- Or restrict by user_id
CREATE POLICY "Users see own data" ON transformers
    FOR SELECT USING (auth.uid() = user_id);
```

## 📡 API Calls Explained

### Reading Data

```javascript
const { data, error } = await supabase
  .from('transformers')                    // Select table
  .select(`                                 // Select columns
    *,                                      // All transformer columns
    oil_tests (*),                          // Join oil_tests
    documents (*)                           // Join documents
  `)
  .order('created_at', { ascending: false }); // Sort by newest
```

### Creating Data

```javascript
const { data, error } = await supabase
  .from('transformers')
  .insert([{                              // Insert array of objects
    site_name: 'Substation A',
    tx_name: 'TX-001',
    latitude: 3.1390,
    longitude: 101.6869
  }])
  .select()                               // Return inserted row
  .single();                              // Return single object
```

### Updating Data

```javascript
const { data, error } = await supabase
  .from('transformers')
  .update({                               // Update object
    site_name: 'Updated Name'
  })
  .eq('id', transformerId)                // WHERE id = ?
  .select()
  .single();
```

### Deleting Data

```javascript
const { error } = await supabase
  .from('transformers')
  .delete()
  .eq('id', transformerId);               // WHERE id = ?
```

## 📁 File Storage

### Storage Structure

```
transformer-documents/
├── {transformer-id}/
│   ├── {timestamp}-{random}.pdf
│   ├── {timestamp}-{random}.jpg
│   └── ...
```

### Upload Process

1. Generate unique path: `{transformerId}/{timestamp}-{random}.{ext}`
2. Upload to Storage bucket
3. Save metadata to `documents` table:
   - file_name (original name)
   - storage_path (generated path)
   - file_type, file_size, etc.

### Access Control

Public bucket allows:
- Anyone can view files with URL
- Authenticated users can upload/delete

For private access:
```sql
CREATE POLICY "Authenticated can access" ON storage.objects
    FOR ALL USING (bucket_id = 'transformer-documents' 
                   AND auth.role() = 'authenticated');
```

## 🔍 Query Optimization

### Indexes for Performance

```sql
CREATE INDEX idx_transformers_site ON transformers(site_name);
CREATE INDEX idx_oil_tests_transformer ON oil_tests(transformer_id);
CREATE INDEX idx_oil_tests_date ON oil_tests(test_date);
```

These speed up:
- Searching by site name
- Loading tests for a transformer
- Filtering tests by date

## 🐞 Debugging Tips

### Enable Logging

```javascript
// In supabaseClient.js
export const supabase = createClient(url, key, {
  auth: { debug: true }  // Enable auth debugging
});
```

### Check Network Tab

Browser DevTools → Network:
- Look for `supabase.co` requests
- Check request/response bodies
- Verify authentication headers

### Use Supabase Dashboard

- **Table Editor**: View/edit data directly
- **SQL Editor**: Run custom queries
- **Logs**: See database errors
- **Storage**: Browse uploaded files

### Common Issues

**"relation does not exist"**
→ Table not created. Run SQL from SUPABASE_SETUP.md

**"permission denied"**
→ RLS policy blocking access. Check policies in Dashboard

**"JWT expired"**
→ Using old authentication. Refresh page

**"storage bucket not found"**
→ Create bucket in Dashboard → Storage

## 🔄 State Management

### React State Flow

```
App.jsx (Main State)
    ├── transformers: []
    ├── loading: boolean
    └── error: string

    ↓ passes to

TransformerDetailModal
    ├── currentTransformer: object
    └── passes to child components

OilTestSection & DocumentSection
    ↓ call services
    ↓ onUpdate() callback
    ↑ updates parent state
```

### Optimistic vs Server State

**Current**: Server state (always reload after changes)
```javascript
await transformerService.create(data);
await loadTransformers();  // Reload from DB
```

**Alternative**: Optimistic updates (faster UX)
```javascript
setTransformers(prev => [...prev, newTransformer]); // Update UI
await transformerService.create(data);              // Save to DB
```

## 🚀 Performance Optimization

### Current Optimizations

1. **Indexed Queries** - Fast lookups by ID and foreign keys
2. **Single JOIN Query** - Load transformer + tests + docs in one call
3. **Selective Loading** - Only load data when needed
4. **CDN Delivery** - Supabase serves files via CDN

### Future Optimizations

1. **Pagination** - Load 50 transformers at a time
2. **Caching** - Cache frequently accessed data
3. **Lazy Loading** - Load oil tests only when viewing details
4. **Connection Pooling** - Supabase handles this automatically

## 🔧 Extending the App

### Adding a New Field

1. **Update Database**:
```sql
ALTER TABLE transformers ADD COLUMN new_field TEXT;
```

2. **Update Service** (transformerService.js):
```javascript
// In create() and update()
new_field: transformerData.newField
```

3. **Update Component** (TransformerModal.jsx):
```jsx
<input name="newField" value={formData.newField} />
```

### Adding a New Table

1. **Create Table**:
```sql
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transformer_id UUID REFERENCES transformers(id)
);
```

2. **Create Service** (`lib/newTableService.js`):
```javascript
export const newTableService = {
  async getAll() { ... },
  async create(data) { ... },
  // etc.
};
```

3. **Update Component** to use new service

## 📊 Monitoring & Analytics

### Supabase Dashboard

- **Database Health**: CPU, memory, connections
- **Storage Usage**: Files uploaded, bandwidth
- **API Requests**: Calls per minute, errors
- **Logs**: Real-time error logs

### Query Performance

```sql
-- In SQL Editor
EXPLAIN ANALYZE
SELECT * FROM transformers WHERE site_name = 'Test';
```

## 🔒 Production Checklist

Before deploying to production:

- [ ] Enable authentication (Supabase Auth)
- [ ] Restrict RLS policies to authenticated users
- [ ] Set up user roles (admin, viewer, etc.)
- [ ] Configure storage bucket as private
- [ ] Set up database backups (automatic with Supabase)
- [ ] Add monitoring/alerting
- [ ] Set up SSL (included with Supabase)
- [ ] Review and optimize queries
- [ ] Add error tracking (Sentry, etc.)
- [ ] Set up CI/CD pipeline

---

This integration provides a robust, scalable foundation for managing transformer assets in a production environment! 🚀
