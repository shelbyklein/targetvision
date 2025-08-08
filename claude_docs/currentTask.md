# Current Task Tracker

## Active Sprint: MVP Development
**Sprint Goal:** Build working MVP with SmugMug sync and AI-powered search  
**Start Date:** January 8, 2025  
**Target Date:** January 22, 2025 (2 weeks)  

## Today's Focus
### 🎯 Immediate Next Steps (Day 1)
**1. Obtain Required API Keys**
- [x] Register for SmugMug API at https://api.smugmug.com/api/developer/apply
- [x] Get Anthropic API key from https://console.anthropic.com/
- [x] Save keys securely (never commit to git)

**2. Setup Development Environment**
- [ ] Install Python 3.9+ if not already installed
- [ ] Install PostgreSQL 15+ locally or via Docker
- [ ] Create project directory structure
- [ ] Initialize git repository

## Task Queue

### 🔴 Critical Path - Week 1
**Days 1-2: Foundation**
- [ ] Get API keys (SmugMug, Anthropic)
- [ ] Setup PostgreSQL with pgvector extension
- [ ] Create FastAPI project skeleton
- [ ] Configure environment variables

**Days 3-4: SmugMug Integration**
- [ ] Implement OAuth 1.0a flow
- [ ] Test authentication end-to-end
- [ ] Create photo sync endpoint
- [ ] Store photos in database

**Days 5-6: Core Sync**
- [ ] Fetch albums from SmugMug
- [ ] Implement pagination for large albums
- [ ] Add error handling and retries
- [ ] Test with 100 photos

**Day 7: Week 1 Testing**
- [ ] Verify OAuth flow works reliably
- [ ] Confirm photos stored correctly
- [ ] Document any issues
- [ ] Prepare for Week 2

## Current Blockers & Solutions

### Immediate Blockers
- 🔴 **No API Keys**: Must register for SmugMug and Anthropic APIs before any development
- 🔴 **No PostgreSQL**: Need database with pgvector for development

### How to Unblock
1. **SmugMug API**: 
   - Go to https://api.smugmug.com/api/developer/apply
   - Fill out application (usually approved within 24 hours)
   - Use "Development" as purpose

2. **Anthropic API**:
   - Sign up at https://console.anthropic.com/
   - Add payment method (required but has free tier)
   - Generate API key immediately

3. **PostgreSQL with pgvector**:
   ```bash
   # Option 1: Docker (recommended)
   docker run -d --name pgvector \
     -e POSTGRES_PASSWORD=password \
     -p 5432:5432 \
     ankane/pgvector
   
   # Option 2: Local install (Mac)
   brew install postgresql@15
   brew services start postgresql@15
   # Then install pgvector extension
   ```

## Progress Log

### Day 0 (Prep)
- ✅ Created project documentation structure
- ✅ Defined MVP scope and requirements
- ✅ Established 2-week timeline
- ⏳ Next: Get API keys and setup environment

## MVP File Structure (To Be Created)

```
targetvi sion/
├── backend/
│   ├── __init__.py
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings from .env
│   ├── database.py          # PostgreSQL connection
│   ├── models.py            # SQLAlchemy models
│   ├── smugmug_auth.py      # OAuth implementation
│   ├── smugmug_service.py   # API client
│   ├── ai_processor.py      # Claude Vision
│   ├── embeddings.py        # CLIP vectors
│   └── search.py            # Search logic
├── frontend/
│   ├── index.html           # Landing page
│   ├── gallery.html         # Photo grid
│   ├── app.js               # Main JavaScript
│   └── styles.css           # Basic styles
├── database/
│   └── schema.sql           # Table definitions
├── tests/
│   └── test_smugmug.py      # Integration tests
├── .env                     # API keys (create this)
├── .env.example             # Template
├── .gitignore               # Exclude .env, venv, etc.
├── requirements.txt         # Python dependencies
└── README.md                # Setup instructions
```

## Testing Checklist
- [ ] SmugMug OAuth flow works
- [ ] Can fetch user's photos
- [ ] Database stores photo metadata
- [ ] AI processing generates descriptions
- [ ] Search returns results
- [ ] Frontend displays photos

## Daily Standup Notes

### What I did yesterday
- Project planning and documentation

### What I'm doing today
- Setting up FastAPI backend
- Configuring PostgreSQL database
- Creating project structure

### Blockers
- Waiting for API credentials

## Week 1 Milestones
- [ ] **Day 1-2**: Environment setup complete
- [ ] **Day 3-4**: SmugMug OAuth working
- [ ] **Day 5-6**: Photos syncing to database
- [ ] **Day 7**: Week 1 integration tested

## Week 2 Milestones
- [ ] **Day 8-9**: AI processing functional
- [ ] **Day 10**: Vector search working
- [ ] **Day 11-12**: Frontend complete
- [ ] **Day 13-14**: MVP tested and documented

## Definition of Done
- [ ] Code written and tested
- [ ] Error handling implemented
- [ ] Basic documentation added
- [ ] Manual testing passed
- [ ] Deployed to local environment

## Key Technical Decisions

### Confirmed Choices
✅ **FastAPI** - Modern, fast, great docs, async support
✅ **PostgreSQL + pgvector** - Single database for all data types
✅ **Claude Vision API** - Best quality photo descriptions
✅ **Vanilla JavaScript** - No build step, faster MVP
✅ **100 photo limit** - Manageable scope for testing

### Deferred to Post-MVP
- User authentication (single user for now)
- React/Vue frontend (vanilla JS sufficient)
- Incremental sync (full sync only)
- Mobile responsive (desktop first)
- Export features (search only)

## Links & Resources
- [SmugMug API Docs](https://api.smugmug.com/api/v2/doc)
- [Claude Vision API](https://docs.anthropic.com/claude/docs/vision)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)

## Daily Checklist

### Start of Day
- [ ] Review this task list
- [ ] Check API key status
- [ ] Ensure dev environment running
- [ ] Pick top priority task

### End of Day
- [ ] Update completed tasks
- [ ] Document any blockers
- [ ] Commit code changes
- [ ] Plan tomorrow's focus
- [ ] Update this file