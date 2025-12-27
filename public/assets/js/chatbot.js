(function () {
    'use strict';

    // Chatbot Configuration
    const API_BASE = '/api';
    let chatHistory = [];
    let isMinimized = true;

    // Create chatbot UI
    function createChatbotUI() {
        const chatbotHTML = `
            <div id="chatbot-container" class="chatbot-container minimized">
                <div id="chatbot-header" class="chatbot-header">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-robot me-2"></i>
                        <span class="fw-bold">AI Assistant</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button id="chatbot-clear" class="btn btn-sm btn-outline-light" title="Clear chat">
                            <i class="bi bi-trash"></i>
                        </button>
                        <button id="chatbot-toggle" class="btn btn-sm btn-outline-light">
                            <i class="bi bi-dash-lg"></i>
                        </button>
                    </div>
                </div>
                <div id="chatbot-body" class="chatbot-body">
                    <div id="chatbot-messages" class="chatbot-messages">
                        <div class="chat-message bot-message">
                            <div class="message-content">
                                Hi! I'm your Smart Attendance AI Assistant. I can help you with:
                                <ul class="mt-2 mb-0 small">
                                    <li>Attendance queries</li>
                                    <li>Timetable information</li>
                                    <li>System navigation</li>
                                    <li>General questions</li>
                                </ul>
                                How can I help you today?
                            </div>
                        </div>
                    </div>
                    <div class="chatbot-input-area">
                        <div class="quick-prompts mb-2">
                            <button class="quick-prompt" onclick="sendQuickPrompt('How do I mark attendance?')">Mark Attendance</button>
                            <button class="quick-prompt" onclick="sendQuickPrompt('Show my attendance report')">My Report</button>
                            <button class="quick-prompt" onclick="sendQuickPrompt('What are the timetable today?')">Today's Schedule</button>
                        </div>
                        <div class="input-group">
                            <input type="text" id="chatbot-input" class="form-control" placeholder="Type your message..." autocomplete="off">
                            <button id="chatbot-send" class="btn btn-primary">
                                <i class="bi bi-send"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <button id="chatbot-fab" class="chatbot-fab">
                <i class="bi bi-chat-dots-fill"></i>
            </button>
        `;

        // Add chatbot styles
        const styles = `
            <style>
                .chatbot-container {
                    position: fixed;
                    bottom: 90px;
                    right: 20px;
                    width: 380px;
                    max-width: calc(100vw - 40px);
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    z-index: 9999;
                    overflow: hidden;
                    transition: all 0.3s ease;
                    transform-origin: bottom right;
                }
                .chatbot-container.minimized {
                    transform: scale(0);
                    opacity: 0;
                    pointer-events: none;
                }
                .chatbot-header {
                    background: linear-gradient(135deg, #0d6efd, #0dcaf0);
                    color: white;
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                }
                .chatbot-body {
                    display: flex;
                    flex-direction: column;
                    height: 450px;
                    max-height: 60vh;
                }
                .chatbot-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    background: #f8f9fa;
                }
                .chat-message {
                    margin-bottom: 12px;
                    display: flex;
                }
                .user-message {
                    justify-content: flex-end;
                }
                .message-content {
                    max-width: 85%;
                    padding: 10px 14px;
                    border-radius: 16px;
                    font-size: 14px;
                    line-height: 1.4;
                }
                .bot-message .message-content {
                    background: white;
                    border: 1px solid #e9ecef;
                    border-bottom-left-radius: 4px;
                }
                .user-message .message-content {
                    background: linear-gradient(135deg, #0d6efd, #0dcaf0);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .chatbot-input-area {
                    padding: 12px;
                    background: white;
                    border-top: 1px solid #e9ecef;
                }
                .quick-prompts {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .quick-prompt {
                    font-size: 12px;
                    padding: 4px 10px;
                    border: 1px solid #0d6efd;
                    background: white;
                    color: #0d6efd;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .quick-prompt:hover {
                    background: #0d6efd;
                    color: white;
                }
                .chatbot-fab {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #0d6efd, #0dcaf0);
                    color: white;
                    border: none;
                    box-shadow: 0 4px 20px rgba(13, 110, 253, 0.4);
                    cursor: pointer;
                    z-index: 9998;
                    transition: transform 0.3s, box-shadow 0.3s;
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .chatbot-fab:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 25px rgba(13, 110, 253, 0.5);
                }
                .chatbot-fab.active {
                    transform: rotate(90deg);
                }
                .typing-indicator {
                    display: flex;
                    gap: 4px;
                    padding: 10px 14px;
                }
                .typing-indicator span {
                    width: 8px;
                    height: 8px;
                    background: #adb5bd;
                    border-radius: 50%;
                    animation: typing 1.4s infinite ease-in-out;
                }
                .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
                .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes typing {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
                    40% { transform: scale(1); opacity: 1; }
                }
                #chatbot-input:focus {
                    box-shadow: none;
                    border-color: #0d6efd;
                }
                @media (max-width: 480px) {
                    .chatbot-container {
                        bottom: 80px;
                        right: 10px;
                        left: 10px;
                        width: auto;
                    }
                    .chatbot-fab {
                        bottom: 15px;
                        right: 15px;
                    }
                }
            </style>
        `;

        // Insert into DOM
        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.insertAdjacentHTML('beforeend', chatbotHTML);

        // Bind events
        bindChatbotEvents();
    }

    function bindChatbotEvents() {
        const fab = document.getElementById('chatbot-fab');
        const container = document.getElementById('chatbot-container');
        const toggle = document.getElementById('chatbot-toggle');
        const clear = document.getElementById('chatbot-clear');
        const input = document.getElementById('chatbot-input');
        const send = document.getElementById('chatbot-send');

        // Toggle chatbot
        fab.addEventListener('click', () => {
            isMinimized = !isMinimized;
            container.classList.toggle('minimized', isMinimized);
            fab.classList.toggle('active', !isMinimized);
            if (!isMinimized) input.focus();
        });

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            isMinimized = true;
            container.classList.add('minimized');
            fab.classList.remove('active');
        });

        // Clear chat
        clear.addEventListener('click', (e) => {
            e.stopPropagation();
            clearChat();
        });

        // Send message
        send.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    async function sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();

        if (!message) return;

        // Add user message
        addMessage(message, 'user');
        input.value = '';

        // Show typing indicator
        showTyping();

        try {
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE}/chatbot/chat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ message, history: chatHistory.slice(-5) })
            });

            hideTyping();

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            addMessage(data.reply, 'bot');

            // Update history
            chatHistory.push({ role: 'user', content: message });
            chatHistory.push({ role: 'assistant', content: data.reply });

        } catch (error) {
            hideTyping();
            addMessage('Sorry, I encountered an error. Please try again later.', 'bot');
            console.error('Chatbot error:', error);
        }
    }

    window.sendQuickPrompt = function (prompt) {
        document.getElementById('chatbot-input').value = prompt;
        sendMessage();
    };

    function addMessage(content, type) {
        const messages = document.getElementById('chatbot-messages');
        const messageHTML = `
            <div class="chat-message ${type}-message">
                <div class="message-content">${formatMessage(content)}</div>
            </div>
        `;
        messages.insertAdjacentHTML('beforeend', messageHTML);
        messages.scrollTop = messages.scrollHeight;
    }

    function formatMessage(text) {
        // Convert markdown-like formatting
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    function showTyping() {
        const messages = document.getElementById('chatbot-messages');
        const typingHTML = `
            <div class="chat-message bot-message" id="typing-indicator">
                <div class="message-content">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `;
        messages.insertAdjacentHTML('beforeend', typingHTML);
        messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
    }

    function clearChat() {
        chatHistory = [];
        const messages = document.getElementById('chatbot-messages');
        messages.innerHTML = `
            <div class="chat-message bot-message">
                <div class="message-content">
                    Chat cleared! How can I help you?
                </div>
            </div>
        `;
    }

    // Initialize chatbot when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createChatbotUI);
    } else {
        createChatbotUI();
    }
})();
