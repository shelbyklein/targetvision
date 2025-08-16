# Multi-Model Selection for Photo Processing

## Feature Overview
Allow users to select from different AI models for photo processing, providing transparency about cost and performance trade-offs for each model option.

## Current State
- System currently uses Claude Vision API for photo description generation
- Single model option with no user choice or cost visibility
- Processing costs are hidden from users

## Proposed Feature

### Model Options
1. **Claude 3.5 Sonnet (Current)**
   - **Cost**: ~$3.00 per 1,000 images
   - **Speed**: Fast (2-3 seconds per image)
   - **Quality**: Excellent detailed descriptions, strong keyword extraction
   - **Best For**: High-quality metadata generation, professional use

2. **Claude 3 Haiku**
   - **Cost**: ~$0.25 per 1,000 images (12x cheaper)
   - **Speed**: Very fast (1-2 seconds per image)
   - **Quality**: Good basic descriptions, adequate keywords
   - **Best For**: Budget-conscious users, basic cataloging

3. **GPT-4 Vision**
   - **Cost**: ~$4.50 per 1,000 images
   - **Speed**: Moderate (3-4 seconds per image)
   - **Quality**: Excellent descriptions, different perspective than Claude
   - **Best For**: Cross-validation, alternative viewpoint

4. **GPT-4o mini**
   - **Cost**: ~$0.15 per 1,000 images (20x cheaper)
   - **Speed**: Very fast (1-2 seconds per image)
   - **Quality**: Basic descriptions, limited detail
   - **Best For**: Large-scale processing, basic tagging

### UI Implementation

#### Settings Panel Enhancement
- **Model Selection Dropdown**: Choose default processing model
- **Cost Calculator**: Show estimated costs based on photo count
- **Quality Preview**: Sample outputs from each model
- **Performance Metrics**: Speed and accuracy comparisons

#### Processing Interface
- **Per-Batch Model Selection**: Choose model for specific processing jobs
- **Cost Display**: Show estimated cost before processing
- **Quality Toggle**: Switch between "Fast & Cheap" vs "Detailed & Premium"
- **Batch Cost Summary**: Total estimated cost for selected photos

#### Progress Tracking
- **Cost Tracking**: Running total of processing costs
- **Model Performance**: Track accuracy and user satisfaction per model
- **Usage Analytics**: Monthly cost breakdown by model

### Technical Implementation

#### Backend Changes
```python
# New model configuration
SUPPORTED_MODELS = {
    'claude-3.5-sonnet': {
        'provider': 'anthropic',
        'cost_per_1k': 3.00,
        'avg_tokens': 150,
        'speed_rating': 'fast'
    },
    'claude-3-haiku': {
        'provider': 'anthropic', 
        'cost_per_1k': 0.25,
        'avg_tokens': 100,
        'speed_rating': 'very_fast'
    },
    'gpt-4-vision': {
        'provider': 'openai',
        'cost_per_1k': 4.50,
        'avg_tokens': 200,
        'speed_rating': 'moderate'
    },
    'gpt-4o-mini': {
        'provider': 'openai',
        'cost_per_1k': 0.15,
        'avg_tokens': 80,
        'speed_rating': 'very_fast'
    }
}
```

#### New API Endpoints
- `GET /api/models` - List available models with costs
- `POST /api/photos/process` - Accept model parameter
- `GET /api/usage/costs` - Cost tracking and analytics
- `POST /api/models/preview` - Generate sample descriptions

#### Frontend Changes
- **ModelSelector component**: Model selection UI
- **CostCalculator component**: Cost estimation widget
- **UsageTracker component**: Cost monitoring dashboard
- Settings integration for default model selection

### User Experience Flow

1. **First-Time Setup**
   - Model selection wizard with cost explanation
   - Budget preference setting
   - Quality vs cost trade-off explanation

2. **Daily Usage**
   - Model selection in processing interface
   - Real-time cost estimates
   - Batch processing with cost confirmation

3. **Cost Management**
   - Monthly usage dashboard
   - Budget alerts and warnings
   - Model performance comparisons

### Benefits
- **Cost Transparency**: Users see exactly what they're paying
- **Flexible Processing**: Choose quality vs speed based on needs
- **Budget Control**: Prevent unexpected API costs
- **Quality Options**: Different models for different use cases

### Implementation Priority
**Phase 1**: Backend model abstraction and cost calculation
**Phase 2**: Frontend model selection and cost display
**Phase 3**: Usage tracking and analytics dashboard
**Phase 4**: Advanced features (batch optimization, auto-selection)

### Success Metrics
- User adoption of different models
- Cost savings for budget-conscious users
- Processing volume increase due to cheaper options
- User satisfaction with model quality trade-offs