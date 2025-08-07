from typing import List, Optional
import numpy as np
import openai
from sentence_transformers import SentenceTransformer
from app.core.config import settings

class EmbeddingService:
    def __init__(self):
        self.use_local = settings.USE_LOCAL_EMBEDDINGS
        
        if self.use_local:
            # Use local sentence-transformers model
            self.local_model = SentenceTransformer('all-MiniLM-L6-v2')  # Fast, good quality
            self.embedding_dim = 384  # Dimension for this model
        else:
            # Use OpenAI embeddings
            self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
            self.model = settings.EMBEDDING_MODEL
            self.embedding_dim = 1536  # OpenAI embedding dimension
    
    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a single text"""
        if not text:
            return None
            
        try:
            if self.use_local:
                # Use local model
                embedding = self.local_model.encode(text, convert_to_numpy=True)
                return embedding.tolist()
            else:
                # Use OpenAI API
                response = self.client.embeddings.create(
                    model=self.model,
                    input=text
                )
                return response.data[0].embedding
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return None
    
    async def generate_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Generate embeddings for multiple texts"""
        if not texts:
            return []
            
        try:
            if self.use_local:
                # Use local model - it handles batch natively
                embeddings = self.local_model.encode(texts, convert_to_numpy=True)
                return [emb.tolist() for emb in embeddings]
            else:
                # Use OpenAI API batch
                embeddings = []
                response = self.client.embeddings.create(
                    model=self.model,
                    input=texts
                )
                
                for data in response.data:
                    embeddings.append(data.embedding)
                    
                return embeddings
                
        except Exception as e:
            print(f"Error generating batch embeddings: {e}")
            # If batch fails, try one by one
            embeddings = []
            for text in texts:
                embedding = await self.generate_embedding(text)
                embeddings.append(embedding)
            return embeddings
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings produced by current model"""
        return self.embedding_dim