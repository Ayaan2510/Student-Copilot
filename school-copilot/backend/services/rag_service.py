"""RAG (Retrieval-Augmented Generation) service for query processing."""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from ..models.models import Document, DocumentChunk, Class
from ..schemas.queries import QueryResponse, CitationResponse, DocumentReference
from .embedding_service import EmbeddingService, VectorDatabase
from .document_processor import DocumentProcessor


logger = logging.getLogger(__name__)


class RAGService:
    """Service for processing queries using Retrieval-Augmented Generation."""
    
    def __init__(self, db: Session):
        self.db = db
        self.embedding_service = EmbeddingService()
        self.vector_db = VectorDatabase(embedding_dim=self.embedding_service.embedding_dim)
        self.document_processor = DocumentProcessor()
        
        # RAG configuration
        self.similarity_threshold = 0.7  # Minimum similarity for relevant chunks
        self.max_chunks = 5  # Maximum chunks to retrieve
        self.max_context_length = 2000  # Maximum context length for generation
        
        # Load existing indexes
        self._load_existing_indexes()
    
    def _load_existing_indexes(self):
        """Load existing vector indexes for all classes."""
        try:
            classes = self.db.query(Class).all()
            for class_obj in classes:
                self.vector_db.load_index(class_obj.id)
            logger.info(f"Loaded indexes for {len(classes)} classes")
        except Exception as e:
            logger.error(f"Error loading existing indexes: {e}")
    
    async def process_query(self, query: str, class_id: str, student_id: str) -> QueryResponse:
        """Process a student query and return response with citations."""
        start_time = datetime.utcnow()
        
        try:
            # Get class information
            class_obj = self.db.query(Class).filter(Class.id == class_id).first()
            if not class_obj:
                return self._create_error_response("Class not found", start_time)
            
            # Generate query embedding
            query_embedding = self.embedding_service.generate_single_embedding(query)
            
            # Search for relevant chunks
            relevant_chunks = self._search_relevant_chunks(class_id, query_embedding)
            
            if not relevant_chunks:
                return self._create_no_results_response(start_time)
            
            # Generate response
            response = await self._generate_response(query, relevant_chunks, class_id)
            
            # Calculate processing time
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            response.processing_time = processing_time
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return self._create_error_response(str(e), start_time)
    
    def _search_relevant_chunks(self, class_id: str, query_embedding) -> List[Tuple[DocumentChunk, float]]:
        """Search for relevant document chunks."""
        try:
            # Search vector database
            search_results = self.vector_db.search(
                class_id=class_id,
                query_embedding=query_embedding,
                k=self.max_chunks * 2  # Get more results to filter
            )
            
            if not search_results:
                return []
            
            # Get chunk objects and filter by similarity threshold
            relevant_chunks = []
            for chunk_id, similarity_score in search_results:
                if similarity_score >= self.similarity_threshold:
                    chunk = self.db.query(DocumentChunk).filter(
                        DocumentChunk.id == chunk_id
                    ).first()
                    
                    if chunk:
                        relevant_chunks.append((chunk, similarity_score))
            
            # Sort by similarity score (descending) and limit results
            relevant_chunks.sort(key=lambda x: x[1], reverse=True)
            return relevant_chunks[:self.max_chunks]
            
        except Exception as e:
            logger.error(f"Error searching relevant chunks: {e}")
            return []
    
    async def _generate_response(self, query: str, relevant_chunks: List[Tuple[DocumentChunk, float]], class_id: str) -> QueryResponse:
        """Generate response based on relevant chunks."""
        try:
            if not relevant_chunks:
                return self._create_no_results_response(datetime.utcnow())
            
            # Extract context from chunks
            context_parts = []
            citations = []
            used_documents = {}
            
            for chunk, similarity_score in relevant_chunks:
                # Add chunk content to context
                context_parts.append(chunk.content)
                
                # Get document information
                document = self.db.query(Document).filter(
                    Document.id == chunk.document_id
                ).first()
                
                if document:
                    # Create citation
                    citation = CitationResponse(
                        document_id=document.id,
                        document_name=document.name,
                        page_number=chunk.page_number,
                        section=chunk.section,
                        chunk_id=chunk.id,
                        relevance_score=similarity_score,
                        content_preview=chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
                    )
                    citations.append(citation)
                    
                    # Track used documents
                    if document.id not in used_documents:
                        used_documents[document.id] = DocumentReference(
                            id=document.id,
                            name=document.name,
                            type=document.file_type,
                            last_accessed=datetime.utcnow()
                        )
            
            # Combine context (limit length)
            full_context = "\n\n".join(context_parts)
            if len(full_context) > self.max_context_length:
                full_context = full_context[:self.max_context_length] + "..."
            
            # Generate answer based on context
            answer = self._generate_answer_from_context(query, full_context)
            
            # Calculate confidence based on similarity scores
            avg_similarity = sum(score for _, score in relevant_chunks) / len(relevant_chunks)
            confidence = min(avg_similarity, 1.0)
            
            return QueryResponse(
                answer=answer,
                citations=citations,
                used_documents=list(used_documents.values()),
                confidence=confidence,
                processing_time=0,  # Will be set by caller
                success=True
            )
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return self._create_error_response(str(e), datetime.utcnow())
    
    def _generate_answer_from_context(self, query: str, context: str) -> str:
        """Generate answer from context (simplified implementation)."""
        # This is a simplified implementation
        # In production, you would use a language model like GPT or similar
        
        # For now, return a structured response based on context
        if not context.strip():
            return "I can't find this in the school materials."
        
        # Simple keyword matching and context extraction
        query_lower = query.lower()
        context_lower = context.lower()
        
        # Check if query keywords appear in context
        query_words = set(query_lower.split())
        context_words = set(context_lower.split())
        
        overlap = query_words.intersection(context_words)
        if len(overlap) < 2:  # Require at least 2 matching words
            return "I can't find this in the school materials."
        
        # Extract relevant sentences from context
        sentences = context.split('.')
        relevant_sentences = []
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            if any(word in sentence_lower for word in query_words):
                relevant_sentences.append(sentence.strip())
        
        if not relevant_sentences:
            return "I can't find this in the school materials."
        
        # Combine relevant sentences into answer
        answer = ". ".join(relevant_sentences[:3])  # Limit to 3 sentences
        
        # Clean up the answer
        answer = answer.strip()
        if not answer.endswith('.'):
            answer += '.'
        
        # Add context indicator
        answer = f"Based on the course materials: {answer}"
        
        return answer
    
    def _create_no_results_response(self, start_time: datetime) -> QueryResponse:
        """Create response when no relevant results are found."""
        processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        return QueryResponse(
            answer="I can't find this in the school materials. Please make sure your question relates to the course content provided by your teacher.",
            citations=[],
            used_documents=[],
            confidence=0.0,
            processing_time=processing_time,
            success=True
        )
    
    def _create_error_response(self, error_message: str, start_time: datetime) -> QueryResponse:
        """Create error response."""
        processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        return QueryResponse(
            answer="I'm sorry, I encountered an error processing your question. Please try again.",
            citations=[],
            used_documents=[],
            confidence=0.0,
            processing_time=processing_time,
            success=False,
            error=error_message
        )
    
    async def index_document(self, document: Document) -> bool:
        """Index a document for RAG search."""
        try:
            logger.info(f"Indexing document: {document.name}")
            
            # Process document to create chunks
            success = await self.document_processor.process_document(document)
            if not success:
                logger.error(f"Failed to process document: {document.name}")
                return False
            
            # Extract text and create chunks
            text_content = await self.document_processor._extract_text(document)
            chunks = self.document_processor._create_chunks(text_content, document.id)
            
            # Save chunks to database
            for chunk in chunks:
                self.db.add(chunk)
            self.db.commit()
            
            # Generate embeddings for chunks
            chunk_texts = [chunk.content for chunk in chunks]
            embeddings = self.embedding_service.generate_embeddings(chunk_texts)
            
            # Add embeddings to vector database for each assigned class
            for class_obj in document.assigned_classes:
                chunk_ids = [chunk.id for chunk in chunks]
                self.vector_db.add_embeddings(class_obj.id, embeddings, chunk_ids)
                self.vector_db.save_index(class_obj.id)
            
            # Update document status
            document.status = "ready"
            document.last_indexed = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"Successfully indexed document: {document.name} with {len(chunks)} chunks")
            return True
            
        except Exception as e:
            logger.error(f"Error indexing document {document.name}: {e}")
            document.status = "error"
            self.db.commit()
            return False
    
    async def reindex_document(self, document: Document) -> bool:
        """Reindex an existing document."""
        try:
            # Remove existing chunks and embeddings
            existing_chunks = self.db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document.id
            ).all()
            
            chunk_ids = [chunk.id for chunk in existing_chunks]
            
            # Remove from vector databases
            for class_obj in document.assigned_classes:
                self.vector_db.remove_document_embeddings(class_obj.id, document.id, chunk_ids)
            
            # Delete existing chunks
            for chunk in existing_chunks:
                self.db.delete(chunk)
            self.db.commit()
            
            # Reindex document
            return await self.index_document(document)
            
        except Exception as e:
            logger.error(f"Error reindexing document {document.name}: {e}")
            return False
    
    def assign_document_to_class(self, document: Document, class_id: str) -> bool:
        """Assign document embeddings to a class index."""
        try:
            # Get document chunks
            chunks = self.db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document.id
            ).all()
            
            if not chunks:
                logger.warning(f"No chunks found for document: {document.name}")
                return False
            
            # Generate embeddings if not cached
            chunk_texts = [chunk.content for chunk in chunks]
            embeddings = self.embedding_service.generate_embeddings(chunk_texts)
            
            # Add to class index
            chunk_ids = [chunk.id for chunk in chunks]
            success = self.vector_db.add_embeddings(class_id, embeddings, chunk_ids)
            
            if success:
                self.vector_db.save_index(class_id)
                logger.info(f"Assigned document {document.name} to class {class_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error assigning document to class: {e}")
            return False
    
    def remove_document_from_class(self, document: Document, class_id: str) -> bool:
        """Remove document embeddings from a class index."""
        try:
            # Get document chunks
            chunks = self.db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document.id
            ).all()
            
            chunk_ids = [chunk.id for chunk in chunks]
            
            # Remove from class index
            success = self.vector_db.remove_document_embeddings(class_id, document.id, chunk_ids)
            
            if success:
                self.vector_db.save_index(class_id)
                logger.info(f"Removed document {document.name} from class {class_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error removing document from class: {e}")
            return False
    
    def get_class_index_stats(self, class_id: str) -> Dict[str, Any]:
        """Get statistics for class vector index."""
        return self.vector_db.get_index_stats(class_id)