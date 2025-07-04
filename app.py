from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
import os
import uuid
from werkzeug.utils import secure_filename
from utils.pdf_processor import PDFProcessor
import json
from datetime import datetime

app = Flask(__name__)

app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

CORS(app)

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Store active sessions
active_sessions = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    try:
        if 'pdf' not in request.files:
            return jsonify({'error': 'No PDF file provided'}), 400
        
        file = request.files['pdf']
        
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and file.filename.lower().endswith('.pdf'):
            # Generate unique session ID
            session_id = str(uuid.uuid4())
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{session_id}_{filename}")
            
            # Save file
            file.save(filepath)
            
            # Process PDF
            processor = PDFProcessor()
            success = processor.process_pdf(filepath, session_id)
            
            if success:
                active_sessions[session_id] = {
                    'processor': processor,
                    'filename': filename,
                    'created_at': datetime.now(),
                    'messages': []
                }
                
                return jsonify({
                    'success': True,
                    'session_id': session_id,
                    'filename': filename,
                    'message': 'PDF processed successfully!'
                })
            else:
                # Clean up file if processing failed
                if os.path.exists(filepath):
                    os.remove(filepath)
                return jsonify({'error': 'Failed to process PDF'}), 500
        
        return jsonify({'error': 'Invalid file format. Please upload a PDF.'}), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        question = data.get('question')
        
        if not session_id or session_id not in active_sessions:
            return jsonify({'error': 'Invalid session'}), 400
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400
        
        session_data = active_sessions[session_id]
        processor = session_data['processor']
        
        # Get answer
        answer = processor.get_answer(question)
        
        # Store conversation
        session_data['messages'].append({
            'question': question,
            'answer': answer,
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({
            'success': True,
            'answer': answer,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/<session_id>/history', methods=['GET'])
def get_chat_history(session_id):
    if session_id not in active_sessions:
        return jsonify({'error': 'Invalid session'}), 400
    
    return jsonify({
        'success': True,
        'messages': active_sessions[session_id]['messages'],
        'filename': active_sessions[session_id]['filename']
    })

@app.route('/api/sessions/<session_id>/clear', methods=['POST'])
def clear_chat_history(session_id):
    if session_id not in active_sessions:
        return jsonify({'error': 'Invalid session'}), 400
    
    active_sessions[session_id]['messages'] = []
    return jsonify({'success': True, 'message': 'Chat history cleared'})

@app.route('/api/sessions/<session_id>/summary', methods=['POST'])
def get_document_summary(session_id):
    if session_id not in active_sessions:
        return jsonify({'error': 'Invalid session'}), 400
    
    processor = active_sessions[session_id]['processor']
    summary = processor.get_answer("Please provide a comprehensive summary of this document, highlighting the main topics and key points.")
    
    return jsonify({'success': True, 'summary': summary})

@app.route('/api/sessions/<session_id>/concepts', methods=['POST'])
def get_key_concepts(session_id):
    if session_id not in active_sessions:
        return jsonify({'error': 'Invalid session'}), 400
    
    processor = active_sessions[session_id]['processor']
    concepts = processor.get_answer("What are the main concepts, terms, and definitions covered in this document?")
    
    return jsonify({'success': True, 'concepts': concepts})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)