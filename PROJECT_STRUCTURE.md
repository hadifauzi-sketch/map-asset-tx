# Project Structure

```
transformer-asset-map/
│
├── 📄 index.html                    # Entry HTML file (loads the app)
├── 📄 main.jsx                      # React initialization & rendering
├── 📄 App.jsx                       # Main app component (state & logic)
├── 📄 App.css                       # All styles (theme, colors, layouts)
│
├── 📄 package.json                  # Dependencies & scripts
├── 📄 vite.config.js                # Development server config
├── 📄 .gitignore                    # Files to ignore in Git
│
├── 📄 README.md                     # Full documentation
├── 📄 QUICK_START.md                # Quick reference guide
└── 📄 PROJECT_STRUCTURE.md          # This file
│
└── components/                      # React components folder
    │
    ├── 📄 TransformerMarker.jsx
    │   └── Handles map markers
    │       - Draggable pins
    │       - Popup with basic info
    │       - Edit/Delete buttons
    │
    ├── 📄 TransformerSidebar.jsx
    │   └── Left sidebar panel
    │       - Transformer list
    │       - Search functionality
    │       - Add button
    │       - Collapsible
    │
    ├── 📄 TransformerModal.jsx
    │   └── Add/Edit form
    │       - Basic transformer info
    │       - Form validation
    │       - Save/Cancel actions
    │
    ├── 📄 TransformerDetailModal.jsx
    │   └── Detailed view
    │       - Tabbed interface
    │       - Information tab
    │       - Oil Tests tab
    │       - Documents tab
    │
    ├── 📄 OilTestSection.jsx
    │   └── Oil test management
    │       - Test list view
    │       - Add/Edit test form
    │       - Physical tests
    │       - DGA parameters
    │
    └── 📄 DocumentSection.jsx
        └── Document management
            - Upload files
            - View PDFs
            - Download/Delete
```

---

## 🔄 Data Flow

```
User Action
    ↓
App.jsx (State Management)
    ↓
Component Updates
    ↓
LocalStorage (Persistence)
```

---

## 🎨 Styling Architecture

```
App.css
│
├── CSS Variables (Lines 1-25)
│   └── Colors, shadows, transitions
│
├── Global Styles (Lines 26-50)
│   └── Body, fonts, resets
│
├── Component Styles (Lines 51+)
│   ├── Sidebar styles
│   ├── Map styles
│   ├── Modal styles
│   ├── Form styles
│   ├── Card styles
│   └── Responsive styles
```

---

## 📦 Dependencies

```json
{
  "react": "UI framework",
  "react-dom": "React rendering",
  "leaflet": "Map library",
  "react-leaflet": "React wrapper for Leaflet",
  "vite": "Build tool & dev server"
}
```

---

## 🔌 Component Communication

```
App.jsx (Parent)
    │
    ├── TransformerSidebar
    │   └── Props: transformers, onAddClick, onEdit, onDelete
    │
    ├── Map Container
    │   └── TransformerMarker (for each transformer)
    │       └── Props: transformer, onDragEnd, onEdit, onDelete
    │
    ├── TransformerModal (when adding/editing)
    │   └── Props: transformer, onSave, onClose
    │
    └── TransformerDetailModal (when viewing)
        ├── Props: transformer, onClose
        │
        ├── OilTestSection
        │   └── Props: oilTests, onUpdate
        │
        └── DocumentSection
            └── Props: documents, onUpdate
```

---

## 💾 Data Structure

```javascript
Transformer Object:
{
  id: "unique_timestamp",
  position: [latitude, longitude],
  siteName: "Substation Name",
  txName: "TX-001",
  mnemonic: "TXSUB001",
  serialNumber: "SN123456",
  voltage: "132/33 kV",
  loadMVA: "60",
  maker: "ABB",
  yearBuilt: "2020",
  oilTests: [...],      // Array of test objects
  documents: [...]      // Array of document objects
}

Oil Test Object:
{
  id: "unique_id",
  testDate: "2024-02-06",
  testType: "Routine",
  breakdown: "50",
  acidity: "0.15",
  waterContent: "25",
  // ... more parameters
  h2: "50",
  ch4: "30",
  // ... DGA gases
  notes: "Test notes"
}

Document Object:
{
  id: "unique_id",
  name: "report.pdf",
  type: "application/pdf",
  size: 1024000,
  uploadDate: "2024-02-06T10:30:00",
  data: "base64_encoded_data"
}
```

---

## 🎯 Key Functions by File

### App.jsx
- `handleMapClick()` - Add transformer on map click
- `handleAddTransformer()` - Save new/edited transformer
- `handleEditTransformer()` - Open edit modal
- `handleDeleteTransformer()` - Remove transformer
- `handleMarkerDragEnd()` - Update position after drag
- `handleUpdateOilTests()` - Save oil test changes
- `handleUpdateDocuments()` - Save document changes

### TransformerSidebar.jsx
- Search filtering
- Transformer list rendering
- Click handlers for view/edit/delete

### TransformerModal.jsx
- Form state management
- Input validation
- Save handler

### TransformerDetailModal.jsx
- Tab navigation
- Data display
- Child component coordination

### OilTestSection.jsx
- Test list/form toggle
- Form submission
- Test CRUD operations

### DocumentSection.jsx
- File upload handler
- Base64 conversion
- View/download/delete handlers

---

## 🚀 Execution Flow

### 1. App Initialization
```
index.html → main.jsx → App.jsx
                         ↓
                    Load from localStorage
                         ↓
                    Render components
```

### 2. Adding Transformer
```
Click "Add" → Set add mode → Click map → Open modal
    ↓
Fill form → Click save → Update state → Save to localStorage
    ↓
Re-render → Show new marker
```

### 3. Adding Oil Test
```
Open details → Oil Tests tab → Click "Add Test"
    ↓
Fill form → Save → Update transformer.oilTests
    ↓
Save to localStorage → Re-render
```

### 4. Uploading Document
```
Click "Upload" → Select file → Convert to base64
    ↓
Add to documents array → Save to localStorage
    ↓
Display in list
```

---

## 📝 Modification Guide

### To add a new transformer field:
1. **App.jsx**: Add to initial state
2. **TransformerModal.jsx**: Add input field
3. **TransformerDetailModal.jsx**: Display in info tab
4. **TransformerSidebar.jsx**: (Optional) Show in card

### To add a new oil test parameter:
1. **OilTestSection.jsx**: Add to formData
2. **OilTestSection.jsx**: Add input in form
3. **OilTestSection.jsx**: Display in results grid

### To change theme colors:
1. **App.css**: Edit CSS variables at top
2. Colors cascade throughout the app

---

## 🔍 Important Sections

### Map Integration (App.jsx, lines ~200-220)
```jsx
<MapContainer center={mapCenter} zoom={mapZoom}>
  <TileLayer url="..." />
  {transformers.map(t => <TransformerMarker ... />)}
</MapContainer>
```

### State Management (App.jsx, lines ~30-40)
```jsx
const [transformers, setTransformers] = useState([]);
useEffect(() => { /* Load from localStorage */ }, []);
useEffect(() => { /* Save to localStorage */ }, [transformers]);
```

### Form Handling (TransformerModal.jsx, lines ~40-60)
```jsx
const handleSubmit = (e) => {
  e.preventDefault();
  onSave(formData);
};
```

---

This structure keeps everything modular and maintainable! 🎉
