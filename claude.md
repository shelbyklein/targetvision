# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
A **web-based** RAG (Retrieval Augmented Generation) application for photo libraries that enables users to search and interact with their photos through natural language via a modern web browser. The system uses LLMs to generate descriptions of photos, stores them in a vector database, and provides a web-based chat interface for semantic search and conversation about the photo collection.

### Web Application Features
- Browser-based access (no installation required)
- Responsive design for desktop, tablet, and mobile
- Real-time chat interface with WebSocket support
- Drag-and-drop photo upload
- Progressive Web App (PWA) capabilities for offline access

## Key Requirements
- LLM integration for photo description generation
- Vector database for storing and querying photo embeddings
- Chat interface for natural language queries
- Semantic filtering based on photo descriptions and user prompts

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

1. **Photo Processor Service**
   - Batch processing of photo albums
   - Generate descriptions using vision-language models
   - Create embeddings for semantic search
   - Store metadata and vectors in database

2. **RAG Pipeline**
   - Query embedding generation
   - Vector similarity search
   - Context retrieval and ranking
   - Response generation with LLM

3. **Chat Interface**
   - Real-time message handling
   - Query history management
   - Photo result display with descriptions
   - Filter refinement capabilities

4. **Data Storage**
   - Vector store for embeddings
   - Metadata storage for photo details
   - Conversation history persistence
   - User session management

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

1. Set up project structure and dependencies
2. Implement photo ingestion and description generation
3. Set up vector database and embedding pipeline
4. Create basic API endpoints for search
5. Build minimal chat interface
6. Add semantic filtering and ranking
7. Enhance UI/UX with photo galleries
8. Add authentication and user management

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