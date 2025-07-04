// PDF Q&A Chat Bot - Frontend JavaScript

class PDFChatBot {
    constructor() {
        this.sessionId = null;
        this.isProcessing = false;
        this.messageHistory = [];
        this.initializeElements();
        this.attachEventListeners();
        this.showWelcomeMessage();
    }

    initializeElements() {
        // Form elements
        
        this.pdfFileInput = document.getElementById('pdfFile');
        this.dropZone = document.getElementById('dropZone');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.uploadStatus = document.getElementById('uploadStatus');
        
        // Chat elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatTitle = document.getElementById('chatTitle');
        this.chatSubtitle = document.getElementById('chatSubtitle');
        
        // Status elements
        this.documentInfo = document.getElementById('documentInfo');
        this.documentName = document.getElementById('documentName');
        this.quickActions = document.getElementById('quickActions');
        this.welcomeMessage = document.getElementById('welcomeMessage');
        this.typingIndicator = document.getElementById('typingIndicator');
        
        // Action buttons
        this.summaryBtn = document.getElementById('summaryBtn');
        this.conceptsBtn = document.getElementById('conceptsBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Loading elements
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingMessage = document.getElementById('loadingMessage');
        this.progressBar = document.getElementById('progressBar');
        
        // Toast container
        this.toastContainer = document.getElementById('toastContainer');
    }

    attachEventListeners() {
        // File upload events
        this.dropZone.addEventListener('click', () => this.pdfFileInput.click());
        this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
        this.pdfFileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.uploadBtn.addEventListener('click', this.uploadAndProcessPDF.bind(this));
        
        // Chat events
        this.messageInput.addEventListener('keypress', this.handleKeyPress.bind(this));
        this.sendBtn.addEventListener('click', this.sendMessage.bind(this));
        
        // Quick action events
        this.summaryBtn.addEventListener('click', () => this.sendQuickMessage('Please provide a comprehensive summary of this document, highlighting the main topics and key points.'));
        this.conceptsBtn.addEventListener('click', () => this.sendQuickMessage('What are the main concepts, terms, and definitions covered in this document?'));
        this.clearBtn.addEventListener('click', this.clearChatHistory.bind(this));
        
       
    }

    handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('drop-zone-active');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drop-zone-active');
    }

    handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drop-zone-active');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.pdfFileInput.files = files;
            this.handleFileSelect();
        }
    }

    handleFileSelect() {
        const file = this.pdfFileInput.files[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                this.showToast('Please select a PDF file', 'error');
                return;
            }
            
            if (file.size > 16 * 1024 * 1024) {
                this.showToast('File size must be less than 16MB', 'error');
                return;
            }
            
            this.updateUploadStatus(`Selected: ${file.name} (${this.formatFileSize(file.size)})`, 'info');
        }
    }

    handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    async uploadAndProcessPDF() {
    
        const file = this.pdfFileInput.files[0];
        
       
        
        if (!file) {
            this.showToast('Please select a PDF file', 'error');
            return;
        }
        
        this.isProcessing = true;
        this.showLoadingOverlay('Processing PDF...', 'Extracting text and creating embeddings...');
        this.updateProgress(20);
        
        const formData = new FormData();
        formData.append('pdf', file);
        
        
        try {
            this.updateProgress(40);
            this.updateLoadingMessage('Uploading file...');
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            this.updateProgress(70);
            this.updateLoadingMessage('Processing document...');
            
            const result = await response.json();
            
            if (result.success) {
                this.sessionId = result.session_id;
                this.updateProgress(100);
                this.updateLoadingMessage('Ready!');
                
                setTimeout(() => {
                    this.hideLoadingOverlay();
                    this.showDocumentReady(result.filename);
                    this.enableChat();
                    this.showToast('PDF processed successfully!', 'success');
                }, 500);
            } else {
                throw new Error(result.error || 'Failed to process PDF');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.hideLoadingOverlay();
            this.showToast(error.message || 'Failed to process PDF', 'error');
            this.updateUploadStatus('Upload failed', 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    async sendMessage() {
        if (!this.sessionId || this.isProcessing) return;
        
        const question = this.messageInput.value.trim();
        if (!question) return;
        
        this.messageInput.value = '';
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        
        // Add user message to chat
        this.addMessage(question, 'user');
        this.showTypingIndicator();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    question: question
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.hideTypingIndicator();
                this.addMessage(result.answer, 'bot', result.timestamp);
            } else {
                throw new Error(result.error || 'Failed to get answer');
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error while processing your question. Please try again.', 'bot', null, true);
            this.showToast(error.message || 'Failed to send message', 'error');
        } finally {
            this.messageInput.disabled = false;
            this.sendBtn.disabled = false;
            this.messageInput.focus();
        }
    }

    async sendQuickMessage(message) {
        if (!this.sessionId || this.isProcessing) return;
        
        this.messageInput.value = message;
        await this.sendMessage();
    }

    addMessage(content, sender, timestamp, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `mb-4 ${sender === 'user' ? 'flex justify-end' : 'flex justify-start'}`;
        
        const bubble = document.createElement('div');
        bubble.className = sender === 'user' ? 'user-message' : 'bot-message';
        
        if (isError) {
            bubble.style.borderLeft = '4px solid #f56565';
            bubble.style.backgroundColor = '#fed7d7';
        }
        
        // Format content for bot messages
        if (sender === 'bot') {
            bubble.innerHTML = this.formatBotMessage(content);
        } else {
            bubble.textContent = content;
        }
        
        // Add timestamp if provided
        if (timestamp) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.textContent = this.formatTimestamp(timestamp);
            bubble.appendChild(timeDiv);
        }
        
        messageDiv.appendChild(bubble);
        
        // Hide welcome message if it exists
        if (this.welcomeMessage) {
            this.welcomeMessage.style.display = 'none';
        }
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Store message in history
        this.messageHistory.push({ content, sender, timestamp, isError });
    }

    formatBotMessage(content) {
        // Convert markdown-like formatting to HTML
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\n/g, '<br>');
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'mb-4 flex justify-start';
        typingDiv.id = 'typing-indicator';
        
        const bubble = document.createElement('div');
        bubble.className = 'bot-message';
        bubble.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="fas fa-robot text-blue-600"></i>
                <span>AI is thinking</span>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        typingDiv.appendChild(bubble);
        this.messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async clearChatHistory() {
        if (!this.sessionId) return;
        
        try {
            const response = await fetch(`/api/sessions/${this.sessionId}/clear`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Clear messages from UI
                const messages = this.messagesContainer.querySelectorAll('.mb-4:not(#welcomeMessage)');
                messages.forEach(msg => msg.remove());
                
                // Clear message history
                this.messageHistory = [];
                
                // Show welcome message again
                if (this.welcomeMessage) {
                    this.welcomeMessage.style.display = 'block';
                }
                
                this.showToast('Chat history cleared', 'success');
            } else {
                throw new Error(result.error || 'Failed to clear chat history');
            }
        } catch (error) {
            console.error('Clear history error:', error);
            this.showToast(error.message || 'Failed to clear chat history', 'error');
        }
    }

    showWelcomeMessage() {
        // Welcome message is already in HTML
    }

    showDocumentReady(filename) {
        this.documentInfo.style.display = 'block';
        this.documentName.textContent = filename;
        this.quickActions.style.display = 'block';
        
        this.chatTitle.innerHTML = `<i class="fas fa-comments mr-2 text-blue-600"></i>Chat with ${filename}`;
        this.chatSubtitle.textContent = 'Ask questions about your document';
        
        this.updateUploadStatus('Document ready for questions', 'success');
    }

    enableChat() {
        this.messageInput.disabled = false;
        this.sendBtn.disabled = false;
        this.messageInput.placeholder = 'Ask a question about your PDF...';
        this.messageInput.focus();
    }

    updateUploadStatus(message, type) {
        this.uploadStatus.innerHTML = `
            <div class="flex items-center space-x-2 text-sm ${
                type === 'error' ? 'text-red-600' : 
                type === 'success' ? 'text-green-600' : 
                'text-blue-600'
            }">
                <i class="fas ${
                    type === 'error' ? 'fa-exclamation-circle' : 
                    type === 'success' ? 'fa-check-circle' : 
                    'fa-info-circle'
                }"></i>
                <span>${message}</span>
            </div>
        `;
    }

    showLoadingOverlay(title, message) {
        document.getElementById('loadingOverlay').querySelector('h3').textContent = title;
        this.updateLoadingMessage(message);
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoadingOverlay() {
        this.loadingOverlay.style.display = 'none';
        this.updateProgress(0);
    }

    updateLoadingMessage(message) {
        this.loadingMessage.textContent = message;
    }

    updateProgress(percent) {
        this.progressBar.style.width = `${percent}%`;
    }

    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <i class="fas ${this.getToastIcon(type)}"></i>
                    <span>${message}</span>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        this.toastContainer.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    }

    getToastIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    saveApiKey() {
        const apiKey = this.apiKeyInput.value;
        if (apiKey) {
            localStorage.setItem('gemini_api_key', apiKey);
        }
    }

    loadApiKey() {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            this.apiKeyInput.value = savedKey;
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PDFChatBot();
});

// Add some utility functions
window.utils = {
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    throttle: function(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
};