# Quick Setup Guide - Transformer Asset Management

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
cd transformer-asset-map
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

### Step 3: Open Browser
Navigate to: http://localhost:3000

---

## 📂 File Structure Overview

### Main Files You'll Work With:
- **App.jsx** - Main application logic & state management
- **App.css** - All styling (dark theme, colors, layouts)

### Component Files (in /components folder):
1. **TransformerMarker.jsx** - Map markers (draggable pins)
2. **TransformerSidebar.jsx** - Left panel with transformer list
3. **TransformerModal.jsx** - Add/Edit form popup
4. **TransformerDetailModal.jsx** - Detailed view with tabs
5. **OilTestSection.jsx** - Oil test records management
6. **DocumentSection.jsx** - PDF/file upload handling

### Configuration Files:
- **package.json** - Dependencies list
- **vite.config.js** - Dev server configuration
- **index.html** - Entry HTML file
- **main.jsx** - React initialization

---

## 🎨 Customization Tips

### Change Default Map Location (Malaysia/KL by default):
**File**: App.jsx (Line ~33)
```jsx
const [mapCenter, setMapCenter] = useState([YOUR_LAT, YOUR_LNG]);
```

### Change Colors/Theme:
**File**: App.css (Lines 1-25)
```css
:root {
  --primary-color: #0f766e;  /* Change this */
  --accent-color: #f59e0b;   /* And this */
}
```

### Change Transformer Icon:
**File**: App.jsx (Lines ~16-35)
```jsx
html: `<div>⚡</div>` // Change ⚡ to your icon
```

---

## 💾 Data Storage

- **Where**: Browser's localStorage
- **Key**: 'transformers'
- **Format**: JSON array

### Export Your Data:
Open browser console (F12) and run:
```javascript
console.log(localStorage.getItem('transformers'));
```

### Import/Restore Data:
```javascript
localStorage.setItem('transformers', 'YOUR_JSON_DATA_HERE');
```

---

## 🔧 Common Modifications

### Add New Test Parameter:

1. **OilTestSection.jsx** - Add to formData (Line ~8)
2. **OilTestSection.jsx** - Add input field in form (Line ~200+)
3. **OilTestSection.jsx** - Display in results (Line ~100+)

### Add New Transformer Field:

1. **TransformerModal.jsx** - Add to formData (Line ~7)
2. **TransformerModal.jsx** - Add input in form (Line ~65+)
3. **TransformerDetailModal.jsx** - Display in info tab (Line ~90+)

### Change Sidebar Width:

**File**: App.css (Line ~76)
```css
.sidebar {
  width: 400px; /* Change this */
}
```

---

## 📱 Supported File Types

### Documents:
- PDF (.pdf)
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- Images (.jpg, .jpeg, .png)

### File Size Limit:
- Recommended: < 5MB per file
- LocalStorage limit: ~10MB total

---

## 🐛 Troubleshooting

### Issue: Map not showing
**Fix**: Check internet connection (needs OpenStreetMap tiles)

### Issue: Data disappeared
**Fix**: Check if localStorage was cleared. Use export feature regularly.

### Issue: Slow performance
**Fix**: Reduce number of documents or use smaller files

### Issue: Can't upload files
**Fix**: Check file size (< 5MB) and file type (PDF, Word, Excel, Images)

---

## 📊 Key Features at a Glance

✅ Interactive Leaflet map  
✅ Drag & drop transformer markers  
✅ Add/Edit/Delete transformers  
✅ GPS coordinates tracking  
✅ Oil test record management  
✅ DGA (Dissolved Gas Analysis) parameters  
✅ PDF/document upload & preview  
✅ Search & filter functionality  
✅ Dark industrial theme  
✅ Fully responsive design  
✅ LocalStorage persistence  
✅ No backend required  

---

## 🔐 Important Notes

- All data stored locally in browser
- Clear cache = lose data (export regularly!)
- Works offline after initial load
- Desktop/tablet optimized
- Mobile support available

---

## 📞 Need Help?

1. Check README.md for detailed documentation
2. Review component comments in code
3. Test in browser console for debugging
4. Contact your IT support team

---

**Happy Mapping! ⚡**
