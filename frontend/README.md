# TargetVision Frontend

A minimal, responsive web interface for the TargetVision AI-powered photo discovery system.

## Features

### 🎯 Core Functionality
- **Photo Gallery**: Grid display of synced SmugMug photos with thumbnails
- **AI-Powered Search**: Search photos by content, not just metadata
- **Smart Results**: See relevance scores and AI-generated descriptions
- **Photo Details**: View full photos with both original and AI metadata
- **Real-time Processing**: Process photos with AI directly from the interface

### 🔍 Search Capabilities
- **Smart Search** (Hybrid): Combines text and visual similarity
- **Text Search**: Searches descriptions, keywords, titles, captions
- **Visual Search**: Uses image embeddings for similarity matching

### 🤖 AI Features
- **Claude Vision Descriptions**: Detailed, accurate photo descriptions
- **Keyword Extraction**: AI-generated searchable keywords
- **Confidence Scores**: See AI confidence levels
- **Processing Status**: Track which photos have been analyzed

## Quick Start

### Prerequisites
- Backend server running on `http://localhost:8000`
- SmugMug account authenticated
- Photos synced from SmugMug

### Running the Frontend

1. **Start the web server:**
   ```bash
   cd frontend
   python -m http.server 3000
   ```

2. **Open in browser:**
   ```
   http://localhost:3000
   ```

### Testing the API
Open `http://localhost:3000/test_frontend.html` for API endpoint testing.

## User Interface

### Header
- **Status Indicator**: Shows SmugMug connection status
- **User Info**: Displays connected SmugMug username

### Search Interface
- **Search Bar**: Enter natural language queries
- **Search Type Selector**: Choose between Smart, Text, or Visual search
- **Results Info**: Shows number of matches and search type used

### Photo Gallery
- **Thumbnail Grid**: Responsive grid layout
- **AI Indicators**: Green badges show AI-processed photos  
- **Search Scores**: Blue badges show relevance percentages
- **Load More**: Pagination for large photo libraries

### Photo Details Modal
- **Full-Size Image**: View high-resolution photos
- **Original Metadata**: SmugMug title, caption, keywords
- **AI Metadata**: Generated descriptions, keywords, confidence
- **Process Button**: Generate AI metadata for unprocessed photos

## Search Examples

### Successful Test Queries
- `"archery"` - Finds archery-related photos
- `"medals"` - Locates medal and award photos  
- `"buckeye classic"` - Specific tournament identification
- `"usa archery"` - Organization-related photos
- `"competition awards"` - Event-specific searches

### Search Results
Results include:
- Relevance scores (0-100%)
- AI-generated descriptions
- Original photo metadata
- Thumbnail previews

## Technical Implementation

### Architecture
- **Pure HTML/CSS/JavaScript** - No build process required
- **Tailwind CSS** - Utility-first styling via CDN
- **Fetch API** - Native browser API for backend communication
- **Responsive Design** - Mobile-first approach

### Files Structure
```
frontend/
├── index.html          # Main application interface
├── app.js              # JavaScript application logic
├── styles.css          # Custom CSS styles
├── test_frontend.html  # API testing interface
└── README.md          # This documentation
```

### API Integration
The frontend communicates with these backend endpoints:
- `GET /auth/status` - Authentication status
- `GET /photos` - Photo gallery data
- `GET /photos/{id}` - Individual photo details
- `GET /search` - Search functionality
- `POST /photos/{id}/process` - AI processing

### CORS Configuration
Backend allows requests from:
- `http://localhost:8000` (backend)
- `http://localhost:3000` (frontend)

## Features in Detail

### Photo Gallery
- **Grid Layout**: Responsive 1-5 columns based on screen size
- **Lazy Loading**: Images load as they become visible
- **Hover Effects**: Smooth transitions and elevation
- **Status Badges**: Visual indicators for AI processing status

### Search System
- **Real-time Search**: Instant results as you type
- **Multi-mode Search**: Text, vector, and hybrid options
- **Result Ranking**: Photos sorted by relevance score
- **Search History**: Clear and retry options

### Modal System
- **Full-Screen View**: Large photo display
- **Metadata Comparison**: Side-by-side original vs AI data
- **Interactive Processing**: Process photos on-demand
- **Keyboard Navigation**: ESC to close, click outside to dismiss

### Responsive Design
- **Mobile First**: Optimized for phone screens
- **Tablet Support**: Adapted grid layouts
- **Desktop Enhanced**: Multi-column layouts and hover effects

## Browser Support
- **Chrome 90+** ✅
- **Firefox 88+** ✅  
- **Safari 14+** ✅
- **Edge 90+** ✅

## Accessibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Semantic HTML and ARIA labels
- **High Contrast**: Support for high contrast mode
- **Reduced Motion**: Respects motion preferences

## Performance
- **Lazy Loading**: Images load on demand
- **Efficient API**: Paginated results
- **Local Caching**: Reduced API calls
- **Optimized Images**: SmugMug thumbnails

## Development

### Customization
- Modify `styles.css` for visual changes
- Update `app.js` for functionality changes
- Edit `index.html` for layout modifications

### Adding Features
- Search filters (date, album, etc.)
- Photo editing capabilities
- Batch AI processing
- Export functionality

## Troubleshooting

### Common Issues
1. **Photos not loading**: Check backend server status
2. **Search not working**: Verify AI processing completed
3. **CORS errors**: Ensure backend CORS configuration
4. **Images not displaying**: Check SmugMug URLs

### Debug Mode
Open browser developer tools to see:
- API request/response details
- JavaScript console errors
- Network connectivity issues

## Success Metrics

### Tested Functionality ✅
- Authentication status display
- Photo gallery loading (2+ photos)
- Search results (archery, medals, buckeye)
- AI metadata display
- Modal photo details
- Responsive layout

### User Experience ✅
- Fast loading (<3 seconds)
- Intuitive navigation
- Clear visual feedback
- Error handling
- Mobile friendly

## Next Steps

### Immediate Enhancements
1. **Batch Processing**: Process multiple photos at once
2. **Advanced Filters**: Date, album, AI status filters
3. **Export Options**: Download search results
4. **Keyboard Shortcuts**: Power user features

### Future Features
1. **Similar Photos**: Find visually similar images
2. **Face Recognition**: People-based search
3. **Geolocation**: Location-based discovery
4. **Sharing**: Social media integration

## Demo Ready! 🚀

The frontend is **fully functional** and ready to demonstrate:
- AI-powered photo search working with real SmugMug data
- Smart search finding photos by content ("archery medals")
- Detailed AI descriptions from Claude Vision API
- Complete user workflow from gallery to search to details

**Access the demo at: http://localhost:3000**