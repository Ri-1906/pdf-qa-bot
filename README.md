📚 Chat with Your Notes – AI-Powered PDF Q&A Assistant
Chat with Your Notes is an intelligent web application that allows users to upload PDF documents (like lecture notes, manuals, or research papers) and interact with them conversationally. Powered by Google Gemini and ChromaDB, it uses Retrieval-Augmented Generation (RAG) to understand your document and generate context-aware answers to user queries.

🚀 Features
🧠 Ask questions directly about your uploaded PDFs

🔍 Retrieves relevant chunks using vector embeddings (ChromaDB)

📎 Gemini API (via Google Generative AI) for natural language answers

📄 Handles large PDFs by chunking and embedding text

💬 Real-time conversational UI (Flask backend + JS frontend)

🔐 (Optional) Login system using Firebase or Flask-Login

🧪 Tested with various document types and edge cases

🛠 Tech Stack
Backend: Python, Flask, Google Generative AI SDK, ChromaDB

Frontend: HTML, CSS, JavaScript

AI Model: gemini-1.5-flash (Free-tier)

Vector DB: ChromaDB with cosine similarity

PDF Parsing: PyPDF2

Auth Options: Firebase Auth (Google/GitHub) + Flask + Argon2 (email/password)

📂 How It Works
Upload any PDF document

The app extracts text, chunks it, and stores embeddings in a vector DB

Ask questions — the app finds the most relevant chunks and feeds them to Gemini

Gemini generates a response based only on the document context

📌 Future Enhancements
Chat memory for multi-turn conversations

Summarization + keyword extraction tools

User dashboards with saved PDFs

Multilingual question support

Public demo deployment (Render/Hugging Face)



📁 Project Structure
/pdf-qa
│
├── app.py               # Flask backend
├── pdf_processor.py     # Chunking, embedding, QA logic
├── static/              # JS, CSS, assets
├── templates/           # index.html
├── .env                 # API keys
└── requirements.txt     # Dependencies
