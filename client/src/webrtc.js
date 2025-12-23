// Обработчики WebRTC сигналов
function handleOffer(data) {
    if (!peer) return;
    
    const { from, offer } = data;
    
    // Создаем RTCPeerConnection
    const connection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });
    
    // Добавляем локальный поток
    if (localStream) {
        localStream.getTracks().forEach(track => {
            connection.addTrack(track, localStream);
        });
    }
    
    // Обработка удаленного потока
    connection.ontrack = (event) => {
        addVideo(from, event.streams[0]);
    };
    
    // ICE кандидаты
    connection.onicecandidate = (event) => {
        if (event.candidate && socket) {
            socket.emit('ice-candidate', {
                to: from,
                candidate: event.candidate
            });
        }
    };
    
    // Устанавливаем полученное offer и создаем answer
    connection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => connection.createAnswer())
        .then(answer => connection.setLocalDescription(answer))
        .then(() => {
            if (socket) {
                socket.emit('answer', {
                    to: from,
                    answer: connection.localDescription
                });
            }
        })
        .catch(error => {
            console.error('Ошибка обработки offer:', error);
        });
}

function handleAnswer(data) {
    const { from, answer } = data;
    
    // Находим соответствующее соединение и устанавливаем answer
    // (В реальном приложении нужно хранить соединения в Map)
    console.log('Получен answer от:', from, answer);
}

function handleIceCandidate(data) {
    const { from, candidate } = data;
    
    // Добавляем ICE кандидата в соответствующее соединение
    // (В реальном приложении нужно хранить соединения в Map)
    console.log('Получен ICE кандидат от:', from, candidate);
                  }
