"""Embedding service for generating and managing text embeddings."""

import os
import logging
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
import pickle
import hashlib

# Sentence transformers for embeddings
from sentence_transformers import SentenceTransformer
import faiss

from ..models.models import DocumentChunk


logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating and managing text embeddings."""
    
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self.embedding_dim = 384  # Dimension for all-MiniLM-L6-v2
        self.cache_dir = "data/embeddings"
        self.model_cache_dir = "data/models"
        
        # Ensure directories exist
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.model_cache_dir, exist_ok=True)
        
        self._load_model()
    
    def _load_model(self):
        """Load the sentence transformer model."""
        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            
            # Use local cache directory for models
            self.model = SentenceTransformer(
                self.model_name,
                cache_folder=self.model_cache_dir
            )
            
            # Verify embedding dimension
            test_embedding = self.model.encode(["test"])
            self.embedding_dim = test_embedding.shape[1]
            
            logger.info(f"Model loaded successfully. Embedding dimension: {self.embedding_dim}")
            
        except Exception as e:
            logger.error(f"Error loading embedding model: {e}")
            raise
    
    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for a list of texts."""
        if not texts:
            return np.array([])
        
        try:
            # Generate embeddings in batches for efficiency
            batch_size = 32
            embeddings = []
            
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                batch_embeddings = self.model.encode(
                    batch,
                    convert_to_numpy=True,
                    normalize_embeddings=True  # Normalize for cosine similarity
                )
                embeddings.append(batch_embeddings)
            
            return np.vstack(embeddings) if embeddings else np.array([])
            
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            raise
    
    def generate_single_embedding(self, text: str) -> np.ndarray:
        """Generate embedding for a single text."""
        try:
            embedding = self.model.encode(
                [text],
                convert_to_numpy=True,
                normalize_embeddings=True
            )
            return embedding[0]  # Return single embedding vector
            
        except Exception as e:
            logger.error(f"Error generating single embedding: {e}")
            raise
    
    def cache_embeddings(self, chunk_id: str, embedding: np.ndarray) -> bool:
        """Cache embedding to disk."""
        try:
            cache_file = os.path.join(self.cache_dir, f"{chunk_id}.pkl")
            with open(cache_file, 'wb') as f:
                pickle.dump(embedding, f)
            return True
        except Exception as e:
            logger.error(f"Error caching embedding for {chunk_id}: {e}")
            return False
    
    def load_cached_embedding(self, chunk_id: str) -> Optional[np.ndarray]:
        """Load cached embedding from disk."""
        try:
            cache_file = os.path.join(self.cache_dir, f"{chunk_id}.pkl")
            if os.path.exists(cache_file):
                with open(cache_file, 'rb') as f:
                    return pickle.load(f)
        except Exception as e:
            logger.error(f"Error loading cached embedding for {chunk_id}: {e}")
        return None
    
    def compute_similarity(self, query_embedding: np.ndarray, document_embeddings: np.ndarray) -> np.ndarray:
        """Compute cosine similarity between query and document embeddings."""
        try:
            # Ensure embeddings are normalized
            query_norm = query_embedding / np.linalg.norm(query_embedding)
            doc_norms = document_embeddings / np.linalg.norm(document_embeddings, axis=1, keepdims=True)
            
            # Compute cosine similarity
            similarities = np.dot(doc_norms, query_norm)
            return similarities
            
        except Exception as e:
            logger.error(f"Error computing similarity: {e}")
            return np.array([])
    
    def get_embedding_hash(self, text: str) -> str:
        """Generate hash for text to check if embedding already exists."""
        return hashlib.md5(text.encode('utf-8')).hexdigest()


class VectorDatabase:
    """Vector database using FAISS for similarity search."""
    
    def __init__(self, embedding_dim: int = 384):
        self.embedding_dim = embedding_dim
        self.indexes = {}  # Class-specific indexes
        self.chunk_mappings = {}  # Map index positions to chunk IDs
        self.data_dir = "data/vector_db"
        
        os.makedirs(self.data_dir, exist_ok=True)
    
    def create_class_index(self, class_id: str) -> bool:
        """Create a new FAISS index for a class."""
        try:
            # Use FAISS IndexFlatIP for cosine similarity (with normalized vectors)
            index = faiss.IndexFlatIP(self.embedding_dim)
            self.indexes[class_id] = index
            self.chunk_mappings[class_id] = []
            
            logger.info(f"Created vector index for class: {class_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating index for class {class_id}: {e}")
            return False
    
    def add_embeddings(self, class_id: str, embeddings: np.ndarray, chunk_ids: List[str]) -> bool:
        """Add embeddings to class index."""
        try:
            if class_id not in self.indexes:
                self.create_class_index(class_id)
            
            index = self.indexes[class_id]
            
            # Ensure embeddings are float32 and normalized
            embeddings = embeddings.astype(np.float32)
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / norms
            
            # Add to index
            index.add(embeddings)
            
            # Update chunk mapping
            self.chunk_mappings[class_id].extend(chunk_ids)
            
            logger.info(f"Added {len(embeddings)} embeddings to class {class_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding embeddings to class {class_id}: {e}")
            return False
    
    def search(self, class_id: str, query_embedding: np.ndarray, k: int = 5) -> List[Tuple[str, float]]:
        """Search for similar embeddings in class index."""
        try:
            if class_id not in self.indexes:
                logger.warning(f"No index found for class: {class_id}")
                return []
            
            index = self.indexes[class_id]
            chunk_mapping = self.chunk_mappings[class_id]
            
            if index.ntotal == 0:
                logger.warning(f"Empty index for class: {class_id}")
                return []
            
            # Normalize query embedding
            query_embedding = query_embedding.astype(np.float32)
            query_embedding = query_embedding / np.linalg.norm(query_embedding)
            query_embedding = query_embedding.reshape(1, -1)
            
            # Search
            scores, indices = index.search(query_embedding, min(k, index.ntotal))
            
            # Convert to results
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx < len(chunk_mapping):
                    chunk_id = chunk_mapping[idx]
                    results.append((chunk_id, float(score)))
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching in class {class_id}: {e}")
            return []
    
    def remove_document_embeddings(self, class_id: str, document_id: str, chunk_ids: List[str]) -> bool:
        """Remove embeddings for a specific document from class index."""
        try:
            # For simplicity, we'll rebuild the index without the removed chunks
            # In production, you might want a more efficient approach
            if class_id not in self.indexes:
                return True
            
            # Get current chunk mapping
            current_mapping = self.chunk_mappings[class_id]
            
            # Find indices to remove
            indices_to_remove = set()
            for i, chunk_id in enumerate(current_mapping):
                if chunk_id in chunk_ids:
                    indices_to_remove.add(i)
            
            if not indices_to_remove:
                return True
            
            # Rebuild index without removed chunks
            # This is a simplified approach - in production you'd want more efficient removal
            logger.info(f"Rebuilding index for class {class_id} after document removal")
            
            # For now, just remove from mapping and log
            # Full implementation would require rebuilding the FAISS index
            new_mapping = [chunk_id for i, chunk_id in enumerate(current_mapping) 
                          if i not in indices_to_remove]
            self.chunk_mappings[class_id] = new_mapping
            
            return True
            
        except Exception as e:
            logger.error(f"Error removing document embeddings from class {class_id}: {e}")
            return False
    
    def save_index(self, class_id: str) -> bool:
        """Save class index to disk."""
        try:
            if class_id not in self.indexes:
                return False
            
            index_file = os.path.join(self.data_dir, f"{class_id}.index")
            mapping_file = os.path.join(self.data_dir, f"{class_id}.mapping")
            
            # Save FAISS index
            faiss.write_index(self.indexes[class_id], index_file)
            
            # Save chunk mapping
            with open(mapping_file, 'wb') as f:
                pickle.dump(self.chunk_mappings[class_id], f)
            
            logger.info(f"Saved index for class: {class_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving index for class {class_id}: {e}")
            return False
    
    def load_index(self, class_id: str) -> bool:
        """Load class index from disk."""
        try:
            index_file = os.path.join(self.data_dir, f"{class_id}.index")
            mapping_file = os.path.join(self.data_dir, f"{class_id}.mapping")
            
            if not os.path.exists(index_file) or not os.path.exists(mapping_file):
                logger.info(f"No saved index found for class: {class_id}")
                return False
            
            # Load FAISS index
            self.indexes[class_id] = faiss.read_index(index_file)
            
            # Load chunk mapping
            with open(mapping_file, 'rb') as f:
                self.chunk_mappings[class_id] = pickle.load(f)
            
            logger.info(f"Loaded index for class: {class_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading index for class {class_id}: {e}")
            return False
    
    def get_index_stats(self, class_id: str) -> Dict[str, Any]:
        """Get statistics for class index."""
        if class_id not in self.indexes:
            return {"exists": False}
        
        index = self.indexes[class_id]
        return {
            "exists": True,
            "total_vectors": index.ntotal,
            "dimension": index.d,
            "chunk_count": len(self.chunk_mappings.get(class_id, []))
        }