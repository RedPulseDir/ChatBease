// Конфигурация
const API_URL = window.location.origin;
let socket = null;
let currentRoomId = null;

// Инициализация Socket.io
function initSocket() {
    socket = io(API_URL);
    
    socket.on('connect', () => {
        console.log('Подключен к серверу');
    });
    
    socket.on('connect_error', (error) => {
        showError('Ошибка подключения к серверу');
        console.error('Socket error:', error);
    });
}

// Создание комнаты
async function createRoom(roomType) {
    try {
        const response = await fetch(`${API_URL}/api/create-room`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roomType })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при создании комнаты');
        }
        
        const data = await response.json();
        currentRoomId = data.roomId;
        
        displayRoomInfo(currentRoomId, data.roomType);
        showSuccess('Комната успешно создана!');
        
    } catch (error) {
        showError(error.message);
    }
}

// Присоединение к комнате
async function joinRoom(isGroup = false) {
    const roomId = document.getElementById('roomCodeInput').value.trim();
    
    if (!roomId) {
        showError('Введите код комнаты');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/check-room/${roomId}`);
        
        if (!response.ok) {
            throw new Error('Комната не найдена');
        }
        
        const data = await response.json();
        
        if (isGroup && data.type !== 'group') {
            throw new Error('Это не групповая комната');
        }
        
        if (!isGroup && data.type !== 'private') {
            throw new Error('Это не приватная комната');
        }
        
        if (data.currentUsers >= data.maxUsers) {
            throw new Error('Комната заполнена');
        }
        
        currentRoomId = roomId;
        displayRoomInfo(currentRoomId, data.type);
        showSuccess('Можно присоединиться к комнате!');
        
    } catch (error) {
        showError(error.message);
    }
}

// Присоединение к групповой комнате
function joinGroupRoom() {
    joinRoom(true);
}

// Отображение информации о комнате
function displayRoomInfo(roomId, roomType) {
    document.getElementById('roomIdDisplay').textContent = roomId;
    
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    document.getElementById('inviteLink').value = inviteLink;
    
    document.getElementById('roomInfo').classList.remove('hidden');
    
    // Прокрутка к информации о комнате
    document.getElementById('roomInfo').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// Копирование кода комнаты
function copyRoomCode() {
    const roomCode = document.getElementById('roomIdDisplay').textContent;
    navigator.clipboard.writeText(roomCode)
        .then(() => {
            alert('Код комнаты скопирован!');
        })
        .catch(err => {
            console.error('Ошибка копирования:', err);
        });
}

// Копирование ссылки приглашения
function copyInviteLink() {
    const inviteLink = document.getElementById('inviteLink').value;
    navigator.clipboard.writeText(inviteLink)
        .then(() => {
            alert('Ссылка скопирована!');
        })
        .catch(err => {
            console.error('Ошибка копирования:', err);
        });
}

// Вход в комнату
function enterRoom() {
    if (!currentRoomId) {
        showError('Сначала создайте или выберите комнату');
        return;
    }
    
    // Сохраняем данные в localStorage
    const userName = prompt('Введите ваше имя:', 'Гость');
    localStorage.setItem('roomId', currentRoomId);
    localStorage.setItem('userName', userName || 'Гость');
    
    // Переход в комнату
    window.location.href = `/room/${currentRoomId}`;
}

// Показать ошибку
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.textContent = `❌ ${message}`;
    errorContainer.classList.remove('hidden');
    
    // Автоматически скрыть через 5 секунд
    setTimeout(() => {
        errorContainer.classList.add('hidden');
    }, 5000);
}

// Показать успешное сообщение
function showSuccess(message) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.textContent = `✅ ${message}`;
    errorContainer.style.background = '#e8f5e9';
    errorContainer.style.color = '#2e7d32';
    errorContainer.classList.remove('hidden');
    
    setTimeout(() => {
        errorContainer.classList.add('hidden');
        errorContainer.style.background = '';
        errorContainer.style.color = '';
    }, 3000);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    
    // Проверка кода комнаты в URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    
    if (roomIdFromUrl) {
        document.getElementById('roomCodeInput').value = roomIdFromUrl;
    }
});
