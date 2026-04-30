# Transformer Asset Management System (Supabase Edition)

A comprehensive cloud-based transformer substation asset management application with **PostgreSQL database** and **cloud storage** via Supabase.

## 🎉 What's New in v2.0 (Supabase Edition)

✅ **PostgreSQL Database** - All data stored in cloud database  
✅ **Cloud File Storage** - PDFs and documents in Supabase Storage  
✅ **Real-time Sync** - Access from multiple devices  
✅ **Automatic Backups** - Supabase handles database backups  
✅ **Scalable** - Handles unlimited transformers and tests  
✅ **Secure** - Row Level Security (RLS) policies  
✅ **No LocalStorage** - Professional cloud-based solution  

## 🚀 What's New in v3.2

✅ **Transformer import workflow** - PDF import and review flow for transformer records  
✅ **Asset visibility** - Asset card gallery and context menu for faster review  
✅ **DGA helpers** - Oil test normalization, trend support, and gas limit standard handling  
✅ **Data integrity** - Normalized serial uniqueness and paper type support  
✅ **Utility updates** - Mnemonic assistance and transformer import parsing improvements  

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Supabase account (free tier is fine)

### 1. Setup Supabase (5 minutes)

Follow the detailed guide: **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)**

Quick summary:
1. Create account at https://supabase.com
2. Create a new project
3. Run the SQL script to create tables
4. Create storage bucket for documents
5. Copy your API credentials

### 2. Install & Configure

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local and add your Supabase credentials
# VITE_SUPABASE_URL=your_project_url
# VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Run the App

```bash
npm run dev
```

Open http://localhost:3000

## 📋 Features

### Transformer Management
- **Add/Edit/Delete** transformers with complete details
- **GPS Tracking** with draggable map markers
- **Search & Filter** across all fields
- **Real-time Updates** across all devices

### Oil Test Tracking
- Complete physical and chemical test parameters
- DGA (Dissolved Gas Analysis) with all 7 gases
- Historical test records with trending
- Edit and delete capabilities

### Document Management
- **Cloud Storage** for PDFs and documents
- **Multiple file uploads** at once
- **View/Download** documents
- Support for PDF, Word, Excel, Images
- Up to 50MB per file

### Database Features
- **PostgreSQL** for reliable data storage
- **Foreign Keys** for data integrity
- **Indexes** for fast queries
- **Automatic Timestamps** for audit trails

## 📁 Project Structure

```
transformer-asset-map-supabase/
├── lib/
│   ├── supabaseClient.js          # Supabase configuration
│   ├── transformerService.js      # Transformer CRUD operations
│   ├── oilTestService.js          # Oil test CRUD operations
│   └── documentService.js         # Document upload/download
├── components/
│   ├── TransformerMarker.jsx      # Map markers
│   ├── TransformerSidebar.jsx     # Asset list
│   ├── TransformerModal.jsx       # Add/Edit forms
│   ├── TransformerDetailModal.jsx # Detail view
│   ├── OilTestSection.jsx         # Oil test management
│   └── DocumentSection.jsx        # Document management
├── App.jsx                         # Main application
├── App.css                         # Styling
├── .env.example                    # Environment template
└── SUPABASE_SETUP.md              # Setup instructions
```

## 🗄️ Database Schema

### Tables

**transformers**
- Complete transformer details
- GPS coordinates
- Timestamps for audit

**oil_tests**
- Physical and chemical tests
- DGA parameters
- Foreign key to transformers

**documents**
- File metadata
- Storage paths
- Foreign key to transformers

See `SUPABASE_SETUP.md` for complete SQL schema.

## 🔐 Security

- **Row Level Security (RLS)** enabled on all tables
- **Public policies** for easy access (can be restricted)
- **Storage policies** for file access control
- **Environment variables** for sensitive credentials
- **.env.local** excluded from Git

### Production Security Recommendations:
1. Enable Supabase Auth for user authentication
2. Restrict RLS policies to authenticated users only
3. Set up role-based access control
4. Use service role key only on backend
5. Enable SSL for all connections

## 📊 Data Management

### Viewing Data
Use Supabase Dashboard → Table Editor to view/edit data directly

### Exporting Data
```sql
-- In Supabase SQL Editor
COPY transformers TO STDOUT WITH CSV HEADER;
COPY oil_tests TO STDOUT WITH CSV HEADER;
```

### Backup
Supabase automatically backs up your database. You can also:
- Export data via SQL Editor
- Use Supabase CLI for automated backups
- Download storage files

## 🔧 Configuration

### Map Settings
Edit `App.jsx`:
```jsx
const [mapCenter, setMapCenter] = useState([3.1390, 101.6869]); // Your coordinates
const [mapZoom, setMapZoom] = useState(11); // Zoom level
```

### Theme Colors
Edit `App.css`:
```css
:root {
  --primary-color: #0f766e;
  --accent-color: #f59e0b;
  /* ... more variables ... */
}
```

### Storage Bucket
Edit `lib/documentService.js`:
```javascript
const BUCKET_NAME = 'transformer-documents'; // Your bucket name
```

## 🐛 Troubleshooting

### "Supabase is not configured"
- Check `.env.local` exists in project root
- Verify credentials are correct
- Restart dev server: `npm run dev`

### "relation does not exist"
- Run SQL schema from `SUPABASE_SETUP.md`
- Check table names are correct

### "Storage bucket not found"
- Create bucket in Supabase Dashboard → Storage
- Name it `transformer-documents`
- Set public bucket policy

### "Row Level Security" errors
- Check RLS policies are enabled
- Verify policies allow operations

### File upload fails
- Check bucket exists and is public
- Verify file size < 50MB
- Check storage policies

## 📈 Performance

- Supports **unlimited** transformers
- Efficient **indexed queries** for fast search
- **CDN delivery** for documents (Supabase handles this)
- **Connection pooling** by Supabase
- Optimized for **concurrent users**

## 🔄 Migration from LocalStorage Version

If you have data in the old LocalStorage version:

1. Export data from browser console:
```javascript
console.log(localStorage.getItem('transformers'));
```

2. Convert and import to Supabase via SQL Editor or create a migration script

## 🚀 Deployment

### Option 1: Vercel (Recommended)
```bash
npm run build
# Deploy dist/ folder to Vercel
# Add environment variables in Vercel dashboard
```

### Option 2: Netlify
```bash
npm run build
# Deploy dist/ folder to Netlify
# Add environment variables in Netlify settings
```

### Option 3: Traditional Hosting
```bash
npm run build
# Upload dist/ folder to your web server
```

**Important**: Add environment variables in your hosting platform settings.

## 📚 Additional Documentation

- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** - Complete Supabase setup guide
- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - How the app uses Supabase
- **[API_REFERENCE.md](API_REFERENCE.md)** - Service functions reference

## 🆚 Comparison with LocalStorage Version

| Feature | LocalStorage | Supabase |
|---------|-------------|----------|
| Storage | Browser only | Cloud database |
| Access | Single device | Multiple devices |
| Collaboration | No | Yes (real-time) |
| Backup | Manual | Automatic |
| File Storage | Base64 (limited) | Cloud storage (50MB+) |
| Scalability | ~10MB limit | Unlimited |
| Production Ready | No | Yes |

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review `SUPABASE_SETUP.md` for setup issues
3. Check Supabase Dashboard for errors
4. Contact your laboratory IT team

## 📄 License

MIT License - Personal Use

---

**Version**: 2.2.0 (Supabase Edition)  
**Last Updated**: April 2026  
**Database**: PostgreSQL via Supabase  
**Storage**: Supabase Storage  
**Status**: Personal Project
