import asyncio
import logging
from typing import List, Optional, Dict, Any
import io
import time

import numpy as np
from PIL import Image
import torch
import open_clip

from config import get_settings
from models import AIMetadata
from database import get_db

logger = logging.getLogger(__name__)

class EmbeddingGenerator:
    """Generates embeddings for images and text using CLIP"""
    
    def __init__(self, model_name: str = "ViT-B-32", pretrained: str = "openai"):
        self.model_name = model_name
        self.pretrained = pretrained
        self.model = None
        self.preprocess = None
        self.tokenizer = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._load_model()
    
    def _load_model(self):
        """Load CLIP model and preprocessing functions"""
        try:
            logger.info(f"Loading CLIP model {self.model_name} ({self.pretrained}) on {self.device}")
            start_time = time.time()
            
            # Load model and preprocessing
            self.model, _, self.preprocess = open_clip.create_model_and_transforms(
                self.model_name, 
                pretrained=self.pretrained,
                device=self.device
            )
            
            # Load tokenizer
            self.tokenizer = open_clip.get_tokenizer(self.model_name)
            
            # Set to evaluation mode
            self.model.eval()
            
            load_time = time.time() - start_time
            logger.info(f"CLIP model loaded in {load_time:.2f}s")
            
        except Exception as e:
            logger.error(f"Error loading CLIP model: {e}")
            raise
    
    async def generate_image_embedding(self, image_data: bytes) -> np.ndarray:
        """Generate embedding for image data"""
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Preprocess image
            image_tensor = self.preprocess(image).unsqueeze(0).to(self.device)
            
            # Generate embedding
            with torch.no_grad():
                image_features = self.model.encode_image(image_tensor)
                
                # Normalize to unit vector
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                
                # Convert to numpy
                embedding = image_features.cpu().numpy().flatten()
            
            return embedding
            
        except Exception as e:
            logger.error(f"Error generating image embedding: {e}")
            raise
    
    async def generate_text_embedding(self, text: str) -> np.ndarray:
        """Generate embedding for text query"""
        try:
            # Tokenize text
            text_tokens = self.tokenizer([text]).to(self.device)
            
            # Generate embedding
            with torch.no_grad():
                text_features = self.model.encode_text(text_tokens)
                
                # Normalize to unit vector
                text_features = text_features / text_features.norm(dim=-1, keepdim=True)
                
                # Convert to numpy
                embedding = text_features.cpu().numpy().flatten()
            
            return embedding
            
        except Exception as e:
            logger.error(f"Error generating text embedding: {e}")
            raise
    
    def calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        try:
            # Ensure embeddings are normalized
            embedding1 = embedding1 / np.linalg.norm(embedding1)
            embedding2 = embedding2 / np.linalg.norm(embedding2)
            
            # Calculate cosine similarity
            similarity = np.dot(embedding1, embedding2)
            
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0
    
    async def batch_process_images(self, image_data_list: List[bytes], batch_size: int = 8) -> List[np.ndarray]:
        """Process multiple images in batches for efficiency"""
        embeddings = []
        
        for i in range(0, len(image_data_list), batch_size):
            batch = image_data_list[i:i + batch_size]
            batch_embeddings = []
            
            for image_data in batch:
                embedding = await self.generate_image_embedding(image_data)
                batch_embeddings.append(embedding)
            
            embeddings.extend(batch_embeddings)
            
            # Small delay between batches to prevent overheating
            if i + batch_size < len(image_data_list):
                await asyncio.sleep(0.1)
        
        return embeddings

class VectorSearch:
    """Handles vector similarity search operations"""
    
    def __init__(self):
        self.embedding_generator = EmbeddingGenerator()
    
    async def search_by_text(self, query: str, limit: int = 20, min_similarity: float = 0.1) -> List[Dict[str, Any]]:
        """Search photos by text query using vector similarity"""
        db = next(get_db())
        
        try:
            # Generate query embedding
            query_embedding = await self.embedding_generator.generate_text_embedding(query)
            
            # Get AI metadata with embeddings (only those that have embeddings stored)
            metadata_records = db.query(AIMetadata).filter(AIMetadata.embedding.isnot(None)).all()
            
            results = []
            for metadata in metadata_records:
                # Calculate cosine similarity using stored embedding
                stored_embedding = np.array(metadata.embedding)
                similarity = self.embedding_generator.calculate_similarity(
                    query_embedding,
                    stored_embedding
                )
                
                if similarity >= min_similarity:
                    results.append({
                        "photo_id": metadata.photo_id,
                        "similarity": similarity,
                        "description": metadata.description,
                        "ai_keywords": metadata.ai_keywords,
                        "photo": metadata.photo.to_dict() if metadata.photo else None
                    })
            
            # Sort by similarity (descending)
            results.sort(key=lambda x: x["similarity"], reverse=True)
            
            # Return top results
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Error in vector search: {e}")
            return []
        finally:
            db.close()
    
    async def search_similar_images(self, photo_id: int, limit: int = 10, min_similarity: float = 0.3) -> List[Dict[str, Any]]:
        """Find images similar to a given photo"""
        db = next(get_db())
        
        try:
            # Get the target photo's embedding
            target_metadata = db.query(AIMetadata).filter(AIMetadata.photo_id == photo_id).first()
            if not target_metadata or not target_metadata.embedding:
                return []
            
            target_embedding = np.array(target_metadata.embedding)
            
            # Get all other metadata records that have embeddings
            all_metadata = db.query(AIMetadata).filter(
                AIMetadata.photo_id != photo_id,
                AIMetadata.embedding.isnot(None)
            ).all()
            
            results = []
            for metadata in all_metadata:
                
                similarity = self.embedding_generator.calculate_similarity(
                    target_embedding,
                    np.array(metadata.embedding)
                )
                
                if similarity >= min_similarity:
                    results.append({
                        "photo_id": metadata.photo_id,
                        "similarity": similarity,
                        "description": metadata.description,
                        "photo": metadata.photo.to_dict() if metadata.photo else None
                    })
            
            # Sort by similarity
            results.sort(key=lambda x: x["similarity"], reverse=True)
            
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Error finding similar images: {e}")
            return []
        finally:
            db.close()

class HybridSearch:
    """Combines text search with vector similarity for better results"""
    
    def __init__(self):
        self.vector_search = VectorSearch()
    
    async def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Perform hybrid search combining text and vector similarity"""
        db = next(get_db())
        
        try:
            # Get vector similarity results
            vector_results = await self.vector_search.search_by_text(query, limit * 2)  # Get more for reranking
            
            # Get text-based results from descriptions and keywords
            # Simple text search in descriptions and keywords
            text_results = []
            metadata_records = db.query(AIMetadata).all()
            
            query_lower = query.lower()
            for metadata in metadata_records:
                score = 0.0
                
                # Search in description
                if metadata.description and query_lower in metadata.description.lower():
                    score += 0.8
                
                # Search in keywords
                if metadata.ai_keywords:
                    for keyword in metadata.ai_keywords:
                        if query_lower in keyword.lower():
                            score += 0.3
                
                # Search in original photo metadata
                if metadata.photo:
                    if metadata.photo.title and query_lower in metadata.photo.title.lower():
                        score += 0.6
                    if metadata.photo.caption and query_lower in metadata.photo.caption.lower():
                        score += 0.5
                    if metadata.photo.keywords:
                        for keyword in metadata.photo.keywords:
                            if query_lower in keyword.lower():
                                score += 0.4
                
                if score > 0:
                    text_results.append({
                        "photo_id": metadata.photo_id,
                        "text_score": score,
                        "description": metadata.description,
                        "ai_keywords": metadata.ai_keywords,
                        "photo": metadata.photo.to_dict() if metadata.photo else None
                    })
            
            # Combine results with weighted scoring
            combined_results = {}
            
            # Add vector results
            for result in vector_results:
                photo_id = result["photo_id"]
                combined_results[photo_id] = {
                    **result,
                    "vector_score": result["similarity"],
                    "text_score": 0.0
                }
            
            # Add text results
            for result in text_results:
                photo_id = result["photo_id"]
                if photo_id in combined_results:
                    combined_results[photo_id]["text_score"] = result["text_score"]
                else:
                    combined_results[photo_id] = {
                        **result,
                        "vector_score": 0.0,
                        "similarity": 0.0
                    }
            
            # Calculate combined score
            final_results = []
            for photo_id, result in combined_results.items():
                # Weighted combination: 60% vector similarity, 40% text matching
                combined_score = (0.6 * result["vector_score"]) + (0.4 * result["text_score"])
                result["combined_score"] = combined_score
                final_results.append(result)
            
            # Sort by combined score
            final_results.sort(key=lambda x: x["combined_score"], reverse=True)
            
            return final_results[:limit]
            
        except Exception as e:
            logger.error(f"Error in hybrid search: {e}")
            return []
        finally:
            db.close()

# Global instances
embedding_generator = EmbeddingGenerator()
vector_search = VectorSearch()
hybrid_search = HybridSearch()