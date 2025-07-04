import google.generativeai as genai
from PyPDF2 import PdfReader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import chromadb
from chromadb.config import Settings
import hashlib
import os
from typing import List, Optional
from dotenv import load_dotenv

class PDFProcessor:
    def __init__(self):
        """Initialize PDF processor with Google Gemini API key from environment."""
        load_dotenv()
        self.api_key = os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("Google API Key not found in environment. Please check your .env file.")

        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel("gemini-1.5-flash")
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001",
            google_api_key=self.api_key
        )

        # Initialize ChromaDB
        self.chroma_client = chromadb.Client(Settings(
            anonymized_telemetry=False,
            allow_reset=True
        ))

        self.collection = None
        self.processed_text = ""

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF file."""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
                return text.strip()
        except Exception as e:
            print(f"Error extracting text from PDF: {e}")
            return ""

    def create_text_chunks(self, text: str) -> List[str]:
        """Split text into manageable chunks for processing."""
        if not text.strip():
            return []

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )

        chunks = text_splitter.split_text(text)
        # Filter out very short chunks
        return [chunk for chunk in chunks if len(chunk.strip()) > 50]

    def create_vector_store(self, text_chunks: List[str], session_id: str) -> bool:
        """Create ChromaDB vector store from text chunks."""
        try:
            if not text_chunks:
                return False

            collection_name = f"session_{session_id.replace('-', '_')}"

            # Delete existing collection if it exists
            try:
                self.chroma_client.delete_collection(collection_name)
            except Exception:
                pass  # Collection doesn't exist, which is fine

            # Create new collection
            self.collection = self.chroma_client.create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )

            # Process chunks in batches to avoid memory issues
            batch_size = 10
            for i in range(0, len(text_chunks), batch_size):
                batch_chunks = text_chunks[i:i + batch_size]

                # Generate embeddings for batch
                embeddings_list = []
                for chunk in batch_chunks:
                    try:
                        embedding = self.embeddings.embed_query(chunk)
                        embeddings_list.append(embedding)
                    except Exception as e:
                        print(f"Error generating embedding for chunk: {e}")
                        continue

                if embeddings_list:
                    # Add batch to collection
                    self.collection.add(
                        embeddings=embeddings_list,
                        documents=batch_chunks[:len(embeddings_list)],
                        ids=[f"chunk_{i + j}" for j in range(len(embeddings_list))]
                    )

            return True

        except Exception as e:
            print(f"Error creating vector store: {e}")
            return False

    def process_pdf(self, pdf_path: str, session_id: str) -> bool:
        """Complete PDF processing pipeline."""
        try:
            # Extract text from PDF
            print(f"Extracting text from PDF: {pdf_path}")
            text = self.extract_text_from_pdf(pdf_path)

            if not text.strip():
                print("No text could be extracted from PDF")
                return False

            self.processed_text = text
            print(f"Extracted {len(text)} characters from PDF")

            # Create text chunks
            print("Creating text chunks...")
            chunks = self.create_text_chunks(text)

            if not chunks:
                print("No valid chunks could be created")
                return False

            print(f"Created {len(chunks)} text chunks")

            # Create vector store
            print("Creating vector store...")
            success = self.create_vector_store(chunks, session_id)

            # Clean up uploaded file
            try:
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
                    print(f"Cleaned up file: {pdf_path}")
            except Exception as e:
                print(f"Warning: Could not remove file {pdf_path}: {e}")

            if success:
                print("PDF processing completed successfully")
            else:
                print("Failed to create vector store")

            return success

        except Exception as e:
            print(f"Error processing PDF: {e}")
            return False

    def get_relevant_chunks(self, query: str, n_results: int = 5) -> List[str]:
        """Retrieve relevant text chunks for a given query."""
        try:
            if not self.collection:
                print("No collection available for search")
                return []

            # Generate query embedding
            query_embedding = self.embeddings.embed_query(query)

            # Search for similar chunks
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(n_results, 10)  # Limit to reasonable number
            )

            if results and results['documents'] and results['documents'][0]:
                return results['documents'][0]
            else:
                return []

        except Exception as e:
            print(f"Error retrieving relevant chunks: {e}")
            return []

    def get_answer(self, question: str) -> str:
        """Generate an answer for the given question using relevant context."""
        try:
            # Get relevant context chunks
            relevant_chunks = self.get_relevant_chunks(question)

            if not relevant_chunks:
                return "I couldn't find relevant information in the document to answer your question. Please try rephrasing your question or ask about different topics covered in the document."

            # Combine chunks into context
            context = "\n\n".join(relevant_chunks)

            # Create prompt for Gemini
            prompt = f"""
Based on the following context from the PDF document, please answer the user's question accurately and comprehensively.

Important guidelines:
- Only use information from the provided context
- If the answer cannot be found in the context, clearly state that
- Be specific and detailed in your response
- If the context is unclear or insufficient, mention that

Context from PDF:
{context}

User Question: {question}

Answer:
"""

            # Generate response using Gemini
            response = self.model.generate_content(prompt)

            if response and response.text:
                return response.text.strip()
            else:
                return "I'm sorry, I couldn't generate a response to your question. Please try asking differently."

        except Exception as e:
            print(f"Error generating answer: {e}")
            return f"I encountered an error while processing your question: {str(e)}. Please try again."

    def get_document_stats(self) -> dict:
        """Get statistics about the processed document."""
        stats = {
            'text_length': len(self.processed_text) if self.processed_text else 0,
            'has_collection': self.collection is not None
        }

        if self.collection:
            try:
                count_result = self.collection.count()
                stats['chunk_count'] = count_result
            except Exception:
                stats['chunk_count'] = 0
        else:
            stats['chunk_count'] = 0

        return stats
