# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A **SmugMug-integrated** RAG (Retrieval Augmented Generation) application that connects to users' SmugMug accounts to access photos, generates AI-powered metadata using LLMs, and provides intelligent search capabilities. The system features a metadata management interface where users can review and edit LLM-generated descriptions, ensuring quality and accuracy of the AI-enhanced photo library.

### Key Features
- **SmugMug Integration**: OAuth-based connection to SmugMug accounts
- **AI Metadata Generation**: Automatic description generation using Claude Vision API
- **Metadata Management**: Review, edit, and approve AI-generated descriptions
- **Intelligent Search**: RAG-powered search across original and AI metadata
- **Real-time Chat**: Natural language queries about photo collection
- **Batch Processing**: Efficient processing of large photo libraries

## Key Requirements
- SmugMug OAuth authentication and API integration
- LLM integration for photo description generation (Claude Vision API)
- Vector database for storing and querying photo embeddings
- Metadata management system with versioning and approval workflow
- Hybrid search combining SmugMug and AI-generated metadata
- Chat interface for natural language queries

## Architecture Recommendations

### Backend Stack (Web API Server)
- **Python with FastAPI**: For RESTful web API server
- **PostgreSQL with pgvector**: For hybrid storage (metadata + vectors)
- **LangChain or LlamaIndex**: For RAG pipeline orchestration
- **OpenAI API or Anthropic Claude**: For LLM capabilities
- **CLIP or LLaVA**: For image understanding and embedding generation
- **CORS middleware**: For secure cross-origin web requests
- **WebSocket support**: For real-time chat communication

### Frontend Stack (Web Client)
- **Next.js 14+ with TypeScript**: For server-side rendered web application
- **React 18+**: For interactive UI components
- **Tailwind CSS**: For responsive web styling
- **WebSocket client**: For real-time chat updates
- **Axios or Fetch API**: For HTTP requests to backend
- **React Query**: For efficient data fetching and caching

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

## Development Commands

Since this is a new project, here are the recommended setup commands once the stack is chosen:

### Python Backend (if chosen)
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn langchain openai pillow numpy scikit-learn pgvector sqlalchemy

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest tests/

# Format code
black .
ruff check .
```

### Web Frontend (Next.js)
```bash
# Install dependencies
cd frontend
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run tests
npm test

# Lint code
npm run lint
```

## Implementation Priority

1. Register SmugMug API application and get credentials
2. Implement OAuth authentication flow
3. Create SmugMug photo sync service
4. Build metadata management database schema
5. Implement LLM processing pipeline
6. Create metadata management UI
7. Add hybrid search functionality
8. Enhance chat interface with RAG

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