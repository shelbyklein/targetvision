import base64
from typing import Optional, Dict, Any
from pathlib import Path
import anthropic
from PIL import Image
import io
from app.core.config import settings

class VisionService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.ANTHROPIC_MODEL
    
    def encode_image(self, image_path: str) -> str:
        """Encode image to base64 for API calls"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def get_image_media_type(self, image_path: str) -> str:
        """Get the media type of an image"""
        extension = Path(image_path).suffix.lower()
        media_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        return media_types.get(extension, 'image/jpeg')
    
    async def generate_description(
        self, 
        image_path: str,
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a detailed description of an image using Claude Vision"""
        
        if not prompt:
            prompt = """Analyze this image and provide:
            1. A detailed description of what you see
            2. Key objects, people, or scenes present
            3. The mood or atmosphere
            4. Any text visible in the image
            5. Notable colors, lighting, or composition elements
            
            Format your response as a comprehensive paragraph that would help someone find this photo through text search."""
        
        try:
            # Encode the image
            base64_image = self.encode_image(image_path)
            media_type = self.get_image_media_type(image_path)
            
            # Call Anthropic Claude API
            message = self.client.messages.create(
                model=self.model,
                max_tokens=500,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": base64_image
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
            
            description = message.content[0].text if message.content else ""
            
            # Extract image metadata
            img = Image.open(image_path)
            metadata = {
                "width": img.width,
                "height": img.height,
                "format": img.format,
                "mode": img.mode
            }
            
            return {
                "description": description,
                "metadata": metadata,
                "model_used": self.model,
                "tokens_used": message.usage.input_tokens + message.usage.output_tokens if hasattr(message, 'usage') else None
            }
            
        except Exception as e:
            print(f"Error generating description: {e}")
            return {
                "description": None,
                "error": str(e),
                "metadata": {}
            }
    
    async def extract_tags(self, description: str) -> list:
        """Extract relevant tags from a description using Claude"""
        
        prompt = f"""Given this image description, extract 5-10 relevant tags that would be useful for searching.
        Tags should be single words or short phrases.
        
        Description: {description}
        
        Return only the tags as a comma-separated list, nothing else."""
        
        try:
            message = self.client.messages.create(
                model="claude-3-haiku-20240307",  # Use Haiku for simple tasks
                max_tokens=100,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            tags_text = message.content[0].text if message.content else ""
            tags = [tag.strip() for tag in tags_text.split(',')]
            
            return tags
            
        except Exception as e:
            print(f"Error extracting tags: {e}")
            return []