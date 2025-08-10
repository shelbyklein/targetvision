# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A **SmugMug-integrated** RAG (Retrieval Augmented Generation) application that connects to users' SmugMug accounts to access photos, generates AI-powered metadata using LLMs, and provides intelligent search capabilities. The system features a metadata management interface where users can review and edit LLM-generated descriptions, ensuring quality and accuracy of the AI-enhanced photo library.

### Current Implementation Status
✅ **FULLY IMPLEMENTED FEATURES:**
- **SmugMug OAuth Authentication**: Complete OAuth 1.0a flow with secure token management
- **Album & Photo Sync**: Full SmugMug album browsing, folder navigation, and photo synchronization
- **AI Processing System**: Claude Vision API integration with both single photo and batch processing
- **Interactive Photo Management**: Photo selection, status indicators with click-to-process, and grid view
- **Collections System**: Photo organization and management with collections interface
- **Real-time Chat Interface**: Natural language queries about photo collections
- **Progress Tracking**: Visual progress bars and status indicators for processing operations
- **API Key Management**: In-app settings for Anthropic and OpenAI API keys
- **Photo Modal**: Detailed photo view with metadata editing capabilities
- **Responsive UI**: Tailwind CSS-based interface with hover effects and visual feedback

### Key Features
- **SmugMug Integration**: OAuth-based connection to SmugMug accounts ✅ COMPLETE
- **AI Metadata Generation**: Automatic description generation using Claude Vision API ✅ COMPLETE
- **Photo Processing Options**: Individual photo processing via status indicator clicks ✅ COMPLETE
- **Batch Processing**: Efficient processing of selected photos ✅ COMPLETE
- **Collections Management**: Photo organization and curation system ✅ COMPLETE
- **Interactive Gallery**: Photo grid with selection, processing status, and modal views ✅ COMPLETE
- **Real-time Chat**: Natural language queries about photo collection ✅ COMPLETE

## Key Requirements
- SmugMug OAuth authentication and API integration
- LLM integration for photo description generation (Claude Vision API)
- Vector database for storing and querying photo embeddings
- Metadata management system
- Hybrid search combining SmugMug and AI-generated metadata
- Chat interface for natural language queries

## Architecture 

### Backend Stack (Python API Server)
- **Python 3.9+ with FastAPI**: Modern async web framework with automatic API documentation
- **PostgreSQL 15+ with pgvector**: Hybrid storage for metadata and vector embeddings
- **Anthropic Claude Vision API**: For generating photo descriptions and keywords
- **CLIP (OpenAI)**: For generating searchable image embeddings
- **SQLAlchemy 2.0**: ORM for database operations with async support
- **CORS middleware**: For secure cross-origin requests from frontend

### Frontend Stack (Web Client)
- **Vanilla JavaScript (ES6+)**: No build step, maximum simplicity for MVP
- **Tailwind CSS via CDN**: Rapid UI development without build process
- **Fetch API**: Native browser API for backend communication
- **No frameworks**: Direct DOM manipulation for MVP simplicity

### Core Components to Implement

1. **SmugMug Integration Service**
   - OAuth authentication flow
   - Photo and album synchronization
   - Incremental sync based on changes
   - Rate limiting and error handling

2. **Metadata Processing Service**
   - Fetch images from SmugMug URLs
   - Generate descriptions using Claude Vision API
   - Create and store embedding vectors
   - Queue management for batch processing

3. **Metadata Management Interface**
   - Review and edit AI descriptions
   - Bulk operations (approve, regenerate)
   - Version history tracking
   - Export functionality (CSV/JSON)

4. **Hybrid Search System**
   - Combine SmugMug metadata with AI descriptions
   - Vector similarity search using pgvector
   - Filter by processing status and approval
   - Natural language query processing

## Current Application State

### ✅ COMPLETED COMPONENTS:
1. **FastAPI Backend**: Complete with all major endpoints
2. **SmugMug OAuth**: Full authentication and API integration
3. **Photo Sync Service**: Album browsing, folder navigation, and photo sync
4. **Claude Vision Integration**: AI metadata generation with both providers (Anthropic/OpenAI)
5. **Photo Processing**: Both individual (click status indicator) and batch processing
6. **Frontend Interface**: Complete vanilla JS application with Tailwind CSS
7. **Collections System**: Photo organization and management
8. **Chat Interface**: Natural language queries with real-time responses
9. **Database Layer**: PostgreSQL with pgvector for photo metadata and embeddings

### 🔄 CURRENT FOCUS:
- **Collections Testing**: Validate collections functionality works end-to-end
- **Performance Optimization**: Ensure smooth operation with large photo sets
- **User Experience Polish**: Fine-tune interactions and feedback

## Technical Considerations

### Web-Specific Considerations
- **Browser Compatibility**: Support modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- **Responsive Design**: Mobile-first approach for all screen sizes
- **Web Security**: Implement HTTPS, CSP headers, input sanitization
- **Session Management**: JWT tokens for authentication
- **File Upload Limits**: Configure max file size for web uploads (e.g., 10MB per photo)
- **CORS Configuration**: Properly configure cross-origin requests

### General Considerations
- **Image Processing**: Consider batch processing for large photo libraries
- **Embedding Cache**: Store generated embeddings to avoid recomputation
- **Rate Limiting**: Implement for LLM API calls to manage costs
- **Chunking Strategy**: For large albums, process in manageable batches
- **Privacy**: Ensure local processing options for sensitive photos
- **Performance**: Use pagination for search results and lazy loading for images
- **Web Performance**: Optimize for Core Web Vitals (LCP, FID, CLS)

## Current User Interface Features

### Photo Management Interface
- **Album Browser**: Navigate SmugMug folder structure with breadcrumb navigation
- **Photo Grid**: Responsive thumbnail grid with lazy loading
- **Status Indicators**: Color-coded status icons (✓ processed, ⏳ processing, ○ unprocessed)
- **Click-to-Process**: Click any status indicator to process individual photos
- **Photo Selection**: Multi-select photos with visual feedback (blue border/checkmark)
- **Batch Operations**: Process multiple selected photos simultaneously
- **Photo Modal**: Full-size photo view with AI metadata display and editing

### Collections System
- **Collections Management**: Organize photos into custom collections
- **Collection Browser**: Navigate between different photo collections
- **Photo Organization**: Add/remove photos from collections
- **Collection Metadata**: Name and manage collection properties

### Real-time Features
- **Progress Indicators**: Visual progress bars for batch processing
- **Status Updates**: Real-time UI updates during processing
- **Chat Interface**: Natural language queries about photos
- **Live Search**: Instant search across photo metadata

### Settings & Configuration
- **API Key Management**: In-app configuration for Anthropic/OpenAI keys
- **Provider Selection**: Choose between AI providers
- **Processing Options**: Configure batch processing behavior

## Important Instructions
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- allow the user to start and stop servers, don't try to do it manually
- avoid using typescript if possible, native javascript only

### Claude AI Integration
1. **Image Resizing**: Automatic dimension-based resizing for API compliance
   - Landscape: 2200px wide, auto height
   - Portrait: 2200px tall, auto width
   - File size optimization with progressive quality reduction for 5MB limit
2. **Analysis**: Structured JSON response with description and keywords
3. **Error Handling**: Comprehensive retry logic and fallback mechanisms

### SmugMug OAuth Flow
1. **Request Token**: Generate with proper API signature
2. **User Authorization**: Redirect to SmugMug authorization page
3. **Access Token**: Exchange authorized request token for access token
4. **API Access**: Use access token for all SmugMug API calls

## Development Guidelines

### File Structure Principles
- **Minimal Dependencies**: Only essential Python packages (see requirements.txt)
- **Clear Separation**: Backend (`backend/`), Frontend (`frontend/`), Database (`database/`)
- **Test Files**: Located in `tests/` directory using pytest
- **Documentation**: Maintain `claude_docs/` for project documentation

### Code Quality Standards
- **Python**: Type hints, async/await patterns, PEP 8 compliance
- **JavaScript**: Vanilla ES6+, no frameworks for MVP
- **Error Handling**: Try-except in Python, try-catch in JavaScript
- **Logging**: Python logging module for backend, console for frontend
- **Security**: Environment variables for secrets, OAuth 1.0a for SmugMug

### Testing Strategy
- **Integration Tests**: Test files for each major component
- **Manual Testing**: Test each feature incrementally during development
- **API Testing**: Verify external API connections before feature implementation

## Resources for Smugmug API Development
- https://api.smugmug.com/api/v2/doc: home page
- https://api.smugmug.com/api/v2/doc/tutorial/basics.html: your first API request
- https://api.smugmug.com/api/v2/doc/tutorial/paging.html: pagination
- https://api.smugmug.com/api/v2/doc/tutorial/authorization.html: authorization
- https://api.smugmug.com/api/v2/doc/tutorial/oauth/web.html: example, web app
- https://api.smugmug.com/api/v2/doc/reference/folder.html: folder
- https://api.smugmug.com/api/v2/doc/reference/album.html: album
- note that we will only read smugmug files.

## Important Links

Frontend: http://localhost:3000/