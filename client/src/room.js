// Глобальные переменные
let socket = null;
let peer = null;
let currentRoomId = null;
let currentUserId = null;
let currentUserName = null;
let localStream = null;

// Инициализация комнаты
async function initRoom() {
    // Получаем данные из localStorage
    currentRoomId = localStorage.getItem('roomId');
    currentUserName = localStorage.getItem('userName') || 'Гость';
    
    if (!currentRoomId) {
        window.location.href = '/';
        return;
    }
    
    // Генерируем уникальный ID пользователя
    currentUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Обновляем интерфейс
    document.getElementById('currentRoomCode').textContent = currentRoomId;
    
    // Инициализируем Socket.io
    initSocket();
    
    // Инициализируем PeerJS
    initPeer();
    
    // Запрашиваем доступ к медиаустройствам
    await initMedia();
}

// Инициализация Socket.io
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Подключен к комнате');
        socket.emit('join-room', currentRoomId, currentUserId, currentUserName);
    });
    
    socket.on('room-users', (users) => {
        console.log('Пользователи в комнате:', users);
        updateUserCount(users.length + 1);
    });
    
    socket.on('user-connected', (userData) => {
        console.log('Пользователь подключился:', userData);
        addSystemMessage(`${userData.userName} присоединился к чату`);
        updateUserCount();
        
        // Инициируем WebRTC соединение с новым пользователем
        if (peer) {
            initCall(userData.userId);
        }
    });
    
    socket.on('user-disconnected', (userData) => {
        console.log('Пользователь отключился:', userData);
        addSystemMessage(`${userData.userName} покинул чат`);
        updateUserCount();
        
        // Удаляем видео пользователя
        removeVideo(userData.userId);
    });
    
    socket.on('receive-message', (messageData) => {
        addMessage(messageData);
    });
    
    socket.on('room-error', (errorMessage) => {
        showError(errorMessage);
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    });
    
    // WebRTC сигналинг
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
}

// Инициализация PeerJS
function initPeer() {
    peer = new Peer(currentUserId, {
        host: window.location.hostname,
        port: 9000,
        path: '/peerjs',
        debug: 3
    });
    
    peer.on('open', (id) => {
        console.log('Peer ID:', id);
    });
    
    peer.on('call', (call) => {
        console.log('Входящий звонок от:', call.peer);
        
        // Отвечаем на звонок с локальным потоком
        call.answer(localStream);
        
        // Обработка удаленного потока
        call.on('stream', (remoteStream) => {
            addVideo(call.peer, remoteStream);
        });
    });
    
    peer.on('error', (err) => {
        console.error('Peer error:', err);
    });
}

// Инициализация медиаустройств
async function initMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        
    } catch (error) {
        console.error('Ошибка доступа к медиаустройствам:', error);
        showError('Не удалось получить доступ к камере/микрофону');
    }
}

// Инициирование звонка
function initCall(peerId) {
    if (!localStream) {
        console.error('Локальный поток не доступен');
        return;
    }
    
    const call = peer.call(peerId, localStream);
    
    call.on('stream', (remoteStream) => {
        addVideo(peerId, remoteStream);
    });
}

// Добавление видео элемента
function addVideo(userId, stream) {
    // Удаляем сообщение об ожидании
    const waitingMessage = document.querySelector('.waiting-message');
    if (waitingMessage) {
        waitingMessage.remove();
    }
    
    // Проверяем, есть ли уже видео для этого пользователя
    const existingVideo = document.getElementById(`video_${userId}`);
    if (existingVideo) {
        existingVideo.srcObject = stream;
        return;
    }
    
    // Создаем новый контейнер для видео
    const videoContainer = document.createElement('div');
    videoContainer.className = 'remote-video-wrapper';
    videoContainer.id = `container_${userId}`;
    
    const video = document.createElement('video');
    video.id = `video_${userId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    
    const videoLabel = document.createElement('div');
    videoLabel.className = 'video-label';
    videoLabel.textContent = `Участник ${userId.slice(0, 8)}...`;
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(videoLabel);
    
    document.getElementById('remoteVideos').appendChild(videoContainer);
}

// Удаление видео элемента
function removeVideo(userId) {
    const videoContainer = document.getElementById(`container_${userId}`);
    if (videoContainer) {
        videoContainer.remove();
    }
    
    // Если не осталось удаленных видео, показываем сообщение об ожидании
    const remoteVideos = document.getElementById('remoteVideos');
    if (remoteVideos.children.length === 0) {
        const waitingMessage = document.createElement('div');
        waitingMessage.className = 'waiting-message';
        waitingMessage.innerHTML = `
            <i class="fas fa-user-clock fa-3x"></i>
            <p>Ожидание подключения других участников...</p>
        `;
        remoteVideos.appendChild(waitingMessage);
    }
}

// Управление медиа
function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const button = document.getElementById('toggleVideo');
            button.classList.toggle('active');
            button.innerHTML = videoTrack.enabled ? 
                '<i class="fas fa-video"></i>' : 
                '<i class="fas fa-video-slash"></i>';
        }
    }
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const button = document.getElementById('toggleAudio');
            button.classList.toggle('active');
            button.innerHTML = audioTrack.enabled ? 
                '<i class="fas fa-microphone"></i>' : 
                '<i class="fas fa-microphone-slash"></i>';
        }
    }
}

function toggleFullscreen() {
    const videoContainer = document.querySelector('.video-container');
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => {
            console.error('Ошибка полноэкранного режима:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// Чат
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (message && socket) {
        socket.emit('send-message', message);
        messageInput.value = '';
        
        // Добавляем собственное сообщение в чат
        addMessage({
            userId: currentUserId,
            userName: currentUserName,
            message: message,
            timestamp: new Date(),
            isOwn: true
        });
    }
}

function handleMessageKeypress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function addMessage(messageData) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    
    messageElement.className = messageData.isOwn ? 'message own' : 'message remote';
    
    const time = new Date(messageData.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${messageData.userName}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${escapeHtml(messageData.message)}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
    const chatMessages = document.getElementById('chatMessages');
    const systemMessage = document.createElement('div');
    systemMessage.className = 'system-message';
    systemMessage.textContent = text;
    
    chatMessages.appendChild(systemMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function toggleChat() {
    const chatSection = document.querySelector('.chat-section');
    chatSection.classList.toggle('collapsed');
}

// Вспомогательные функции
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateUserCount(count) {
    if (count !== undefined) {
        document.getElementById('userCount').textContent = count;
    } else {
        // Получаем количество видео контейнеров (исключая локальное)
        const remoteContainers = document.querySelectorAll('.remote-video-wrapper');
        document.getElementById('userCount').textContent = remoteContainers.length + 1;
    }
}

function showError(message) {
    const errorContainer = document.getElementById('roomError');
    errorContainer.textContent = `❌ ${message}`;
    errorContainer.classList.remove('hidden');
    
    setTimeout(() => {
        errorContainer.classList.add('hidden');
    }, 5000);
}

function leaveRoom() {
    // Останавливаем все медиапотоки
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    // Закрываем Peer соединение
    if (peer) {
        peer.destroy();
    }
    
    // Отключаем Socket
    if (socket) {
        socket.disconnect();
    }
    
    // Очищаем localStorage
    localStorage.removeItem('roomId');
    localStorage.removeItem('userName');
    
    // Возвращаемся на главную
    window.location.href = '/';
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initRoom);

// Обработка закрытия страницы
window.addEventListener('beforeunload', leaveRoom);
