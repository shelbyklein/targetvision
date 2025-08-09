# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A **SmugMug-integrated** RAG (Retrieval Augmented Generation) application that connects to users' SmugMug accounts to access photos, generates AI-powered metadata using LLMs, and provides intelligent search capabilities. The system features a metadata management interface where users can review and edit LLM-generated descriptions, ensuring quality and accuracy of the AI-enhanced photo library.

### Key Features
- **SmugMug Integration**: OAuth-based connection to SmugMug accounts
- **AI Metadata Generation**: Automatic description generation using Claude Vision API
- **Metadata Management**: Review, edit, and approve AI-generated descriptions and keywords
- **Intelligent Search**: RAG-powered search across original and AI metadata
- **Real-time Chat**: Natural language queries about photo collection
- **Batch Processing**: Efficient processing of large photo libraries

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

## MVP Implementation Priority (2 Weeks)

### Week 1: Core Backend
1. **Day 1-2**: Setup FastAPI project, PostgreSQL with pgvector, environment configuration
2. **Day 3-4**: Implement SmugMug OAuth 1.0a authentication flow
3. **Day 5-6**: Create photo sync service (fetch and store metadata)
4. **Day 7**: Test end-to-end SmugMug integration

### Week 2: AI & Frontend
5. **Day 8-9**: Implement Claude Vision API integration for descriptions
6. **Day 10**: Add CLIP embeddings and vector search
7. **Day 11-12**: Build minimal web interface (auth, gallery, search)
8. **Day 13-14**: Testing, bug fixes, and deployment

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