import asyncio
import base64
import io
import logging
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import time

import httpx
from PIL import Image
import anthropic

from config import get_settings
from models import Photo, AIMetadata, ProcessingQueue
from database import get_db

logger = logging.getLogger(__name__)

class AIProcessor:
    """Handles AI-powered photo analysis using Claude Vision API"""
    
    def __init__(self, anthropic_api_key: Optional[str] = None, openai_api_key: Optional[str] = None):
        self.settings = get_settings()
        # Use provided API key or fallback to environment variable
        self.anthropic_api_key = anthropic_api_key or self.settings.ANTHROPIC_API_KEY
        self.openai_api_key = openai_api_key or getattr(self.settings, 'OPENAI_API_KEY', None)
        
        # Initialize Anthropic client if we have a key
        if self.anthropic_api_key:
            self.client = anthropic.Anthropic(api_key=self.anthropic_api_key)
        else:
            self.client = None
            
        self.max_image_size = 5 * 1024 * 1024  # 5MB limit for Claude API
        self.max_dimension = 2200  # Claude API recommendation
        
    async def resize_image_for_api(self, image_data: bytes) -> bytes:
        """Resize image to meet Claude API requirements"""
        try:
            # Open image with PIL
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            original_width, original_height = image.size
            
            # Calculate new dimensions maintaining aspect ratio
            if original_width > original_height:
                # Landscape: limit width
                if original_width > self.max_dimension:
                    new_width = self.max_dimension
                    new_height = int((original_height * new_width) / original_width)
                else:
                    new_width, new_height = original_width, original_height
            else:
                # Portrait: limit height
                if original_height > self.max_dimension:
                    new_height = self.max_dimension
                    new_width = int((original_width * new_height) / original_height)
                else:
                    new_width, new_height = original_width, original_height
            
            # Resize if necessary
            if (new_width, new_height) != (original_width, original_height):
                image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                logger.info(f"Resized image from {original_width}x{original_height} to {new_width}x{new_height}")
            
            # Save to bytes with progressive quality reduction if needed
            quality = 95
            while quality > 20:
                output = io.BytesIO()
                image.save(output, format='JPEG', quality=quality, optimize=True)
                output_data = output.getvalue()
                
                if len(output_data) <= self.max_image_size:
                    logger.info(f"Image compressed to {len(output_data)} bytes at quality {quality}")
                    return output_data
                
                quality -= 10
                
            # If still too large, try more aggressive compression
            output = io.BytesIO()
            image.save(output, format='JPEG', quality=20, optimize=True)
            return output.getvalue()
            
        except Exception as e:
            logger.error(f"Error resizing image: {e}")
            raise
    
    async def download_image(self, image_url: str) -> bytes:
        """Download image from SmugMug URL"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(image_url)
                response.raise_for_status()
                return response.content
        except Exception as e:
            logger.error(f"Error downloading image from {image_url}: {e}")
            raise
    
    def extract_keywords_from_description(self, description: str) -> List[str]:
        """Extract potential keywords from AI description"""
        # Simple keyword extraction - look for nouns and descriptive terms
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'this', 'that'}
        
        # Split description into words and filter
        words = description.lower().replace(',', '').replace('.', '').split()
        keywords = []
        
        for word in words:
            if len(word) > 3 and word not in common_words:
                keywords.append(word)
        
        # Return first 10 unique keywords
        return list(dict.fromkeys(keywords))[:10]
    
    def get_analysis_prompt(self) -> str:
        """Get the current analysis prompt (custom or default)"""
        try:
            prompt_file = "custom_prompt.txt"
            if os.path.exists(prompt_file):
                with open(prompt_file, 'r', encoding='utf-8') as f:
                    return f.read().strip()
        except Exception as e:
            logger.warning(f"Error reading custom prompt, using default: {e}")
        
        # Default prompt
        return """Analyze this image and provide a detailed description focusing on the main subjects, actions, and context. Then extract relevant keywords.

Return your response as a JSON object with these fields:
- "description": A detailed description of what you see in the image
- "keywords": An array of relevant keywords that describe the image content

Focus on:
- Main subjects and people
- Actions being performed
- Objects and equipment visible
- Setting and environment
- Events or activities
- Emotions or mood if apparent

Do not include speculation about metadata like camera settings, date, or photographer information."""

    async def generate_description(self, image_data: bytes, provider: str = "anthropic") -> Tuple[str, List[str], float, str]:
        """Generate AI description using specified provider (anthropic or openai)"""
        start_time = time.time()
        
        try:
            # Prepare image for API
            processed_image = await self.resize_image_for_api(image_data)
            image_b64 = base64.b64encode(processed_image).decode('utf-8')
            
            # Get the current analysis prompt (custom or default)
            prompt = self.get_analysis_prompt()

            if provider.lower() == "anthropic":
                description, keywords, processing_time = await self._generate_with_anthropic(image_b64, prompt, start_time)
                return description, keywords, processing_time, prompt
            elif provider.lower() == "openai":
                description, keywords, processing_time = await self._generate_with_openai(image_b64, prompt, start_time)
                return description, keywords, processing_time, prompt
            else:
                raise ValueError(f"Unsupported provider: {provider}")
                
        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(f"Error generating description with {provider}: {e}")
            raise
    
    async def _generate_with_anthropic(self, image_b64: str, prompt: str, start_time: float) -> Tuple[str, List[str], float]:
        """Generate description using Anthropic Claude Vision API"""
        if not self.client:
            raise ValueError("Anthropic API key not configured")
            
        # Call Claude Vision API
        message = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=300,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_b64
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
        )
        
        # Extract content from response
        response_text = message.content[0].text.strip()
        return self._parse_ai_response(response_text, start_time)
    
    async def _generate_with_openai(self, image_b64: str, prompt: str, start_time: float) -> Tuple[str, List[str], float]:
        """Generate description using OpenAI GPT-4 Vision API"""
        if not self.openai_api_key:
            raise ValueError("OpenAI API key not configured")
        
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 300
        }
        
        # Retry logic for rate limiting
        max_retries = 3
        base_delay = 1.0
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers=headers,
                        json=payload
                    )
                    response.raise_for_status()
                    
                    result = response.json()
                    response_text = result["choices"][0]["message"]["content"].strip()
                    return self._parse_ai_response(response_text, start_time)
                    
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < max_retries - 1:
                    # Rate limit hit, wait with exponential backoff
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"OpenAI rate limit hit, waiting {delay}s before retry {attempt + 1}/{max_retries}")
                    await asyncio.sleep(delay)
                    continue
                else:
                    # Re-raise if not a rate limit error or max retries exceeded
                    raise
    
    def _parse_ai_response(self, response_text: str, start_time: float) -> Tuple[str, List[str], float]:
        """Parse AI response and extract description and keywords"""
        # Clean response text - remove markdown code blocks if present
        cleaned_text = response_text.strip()
        
        # Handle markdown code blocks (```json ... ```)
        if cleaned_text.startswith('```json') and cleaned_text.endswith('```'):
            # Extract JSON from markdown code block
            lines = cleaned_text.split('\n')
            json_lines = []
            in_json = False
            
            for line in lines:
                if line.strip() == '```json':
                    in_json = True
                    continue
                elif line.strip() == '```':
                    break
                elif in_json:
                    json_lines.append(line)
            
            cleaned_text = '\n'.join(json_lines).strip()
        elif cleaned_text.startswith('```') and cleaned_text.endswith('```'):
            # Handle generic code blocks
            cleaned_text = cleaned_text[3:-3].strip()
            # If it starts with a language identifier, remove the first line
            if '\n' in cleaned_text and not cleaned_text[0] in '{["':
                cleaned_text = '\n'.join(cleaned_text.split('\n')[1:])
        
        # Try to parse as JSON first (for new format prompts)
        try:
            import json
            response_data = json.loads(cleaned_text)
            description = response_data.get("description", "")
            keywords = response_data.get("keywords", [])
            
            # Ensure keywords is a list of strings
            if isinstance(keywords, str):
                keywords = [kw.strip() for kw in keywords.split(',')]
            elif not isinstance(keywords, list):
                keywords = []
            
            # Clean keywords
            keywords = [kw.strip() for kw in keywords if isinstance(kw, str) and kw.strip()]
            
        except (json.JSONDecodeError, AttributeError):
            # Fallback to old format - treat entire response as description
            description = response_text
            keywords = self.extract_keywords_from_description(description)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        logger.info(f"Generated description in {processing_time:.2f}s: {description[:100]}...")
        logger.info(f"Extracted keywords: {keywords}")
        
        return description, keywords, processing_time
            
    
    async def process_photo(self, photo_id: int, provider: str = "anthropic") -> Optional[Dict]:
        """Process a single photo with AI analysis"""
        db = next(get_db())
        
        try:
            # Get photo from database
            photo = db.query(Photo).filter(Photo.id == photo_id).first()
            if not photo:
                logger.error(f"Photo {photo_id} not found")
                return None
            
            # Check if already processed
            existing = db.query(AIMetadata).filter(AIMetadata.photo_id == photo_id).first()
            if existing:
                logger.info(f"Photo {photo_id} already has AI metadata")
                return existing.to_dict()
            
            # Download image
            logger.info(f"Processing photo {photo_id}: {photo.title}")
            image_data = await self.download_image(photo.image_url)
            
            # Generate AI description
            description, keywords, processing_time, prompt = await self.generate_description(image_data, provider)
            
            # Create AI metadata record
            ai_metadata = AIMetadata(
                photo_id=photo_id,
                description=description,
                ai_keywords=keywords,
                confidence_score=0.85,  # Default confidence - could be enhanced
                processing_time=processing_time,
                model_version=f"{provider}-{datetime.now().strftime('%Y-%m-%d')}",
                processed_at=datetime.now()
            )
            
            db.add(ai_metadata)
            
            # Update photo processing status to completed
            photo = db.query(Photo).filter(Photo.id == photo_id).first()
            if photo:
                photo.processing_status = "completed"
                photo.updated_at = datetime.now()
            
            # Update processing queue status
            queue_item = db.query(ProcessingQueue).filter(ProcessingQueue.photo_id == photo_id).first()
            if queue_item:
                queue_item.status = "completed"
                queue_item.completed_at = datetime.now()
            
            db.commit()
            db.refresh(ai_metadata)
            
            logger.info(f"Successfully processed photo {photo_id}")
            return ai_metadata.to_dict()
            
        except Exception as e:
            logger.error(f"Error processing photo {photo_id}: {e}")
            
            # Update photo processing status to failed
            photo = db.query(Photo).filter(Photo.id == photo_id).first()
            if photo:
                photo.processing_status = "failed"
                photo.updated_at = datetime.now()
            
            # Update queue with error status
            queue_item = db.query(ProcessingQueue).filter(ProcessingQueue.photo_id == photo_id).first()
            if queue_item:
                queue_item.status = "failed"
                queue_item.last_error = str(e)
                queue_item.attempts += 1
            
            db.commit()
            
            raise
        finally:
            db.close()
    
    async def process_batch(self, photo_ids: List[int], max_concurrent: int = 3) -> List[Dict]:
        """Process multiple photos concurrently with rate limiting"""
        
        async def process_single(photo_id: int):
            try:
                return await self.process_photo(photo_id)
            except Exception as e:
                logger.error(f"Failed to process photo {photo_id}: {e}")
                return {"photo_id": photo_id, "error": str(e)}
        
        # Process in batches to respect rate limits
        results = []
        for i in range(0, len(photo_ids), max_concurrent):
            batch = photo_ids[i:i + max_concurrent]
            
            # Process batch concurrently
            batch_tasks = [process_single(photo_id) for photo_id in batch]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            results.extend(batch_results)
            
            # Rate limiting - wait between batches
            if i + max_concurrent < len(photo_ids):
                await asyncio.sleep(2)  # 2 second delay between batches
        
        return results
    
    async def add_to_processing_queue(self, photo_ids: List[int], priority: int = 0):
        """Add photos to processing queue"""
        db = next(get_db())
        
        try:
            for photo_id in photo_ids:
                # Check if already in queue
                existing = db.query(ProcessingQueue).filter(ProcessingQueue.photo_id == photo_id).first()
                if not existing:
                    queue_item = ProcessingQueue(
                        photo_id=photo_id,
                        status="pending",
                        priority=priority
                    )
                    db.add(queue_item)
            
            db.commit()
            logger.info(f"Added {len(photo_ids)} photos to processing queue")
            
        except Exception as e:
            logger.error(f"Error adding to queue: {e}")
            db.rollback()
            raise
        finally:
            db.close()
    
    async def get_queue_status(self) -> Dict:
        """Get current processing queue status"""
        db = next(get_db())
        
        try:
            total = db.query(ProcessingQueue).count()
            pending = db.query(ProcessingQueue).filter(ProcessingQueue.status == "pending").count()
            processing = db.query(ProcessingQueue).filter(ProcessingQueue.status == "processing").count()
            completed = db.query(ProcessingQueue).filter(ProcessingQueue.status == "completed").count()
            failed = db.query(ProcessingQueue).filter(ProcessingQueue.status == "failed").count()
            
            return {
                "total": total,
                "pending": pending,
                "processing": processing,
                "completed": completed,
                "failed": failed
            }
        finally:
            db.close()

# Global instance (with default settings)
ai_processor = AIProcessor()