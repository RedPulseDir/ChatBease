require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public')));

// Хранилище комнат
const rooms = new Map();

// Функция генерации случайного кода комнаты
function generateRoomCode() {
  const formats = [
    {
      length: 6,
      charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      prefix: 'P'
    },
    {
      length: 8,
      charset: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      prefix: 'G'
    },
    {
      length: 10,
      charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*',
      prefix: 'V'
    }
  ];
  
  const format = formats[Math.floor(Math.random() * formats.length)];
  let code = format.prefix;
  
  for (let i = 0; i < format.length; i++) {
    code += format.charset.charAt(
      Math.floor(Math.random() * format.charset.length)
    );
  }
  
  return code;
}

// Маршруты API
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

app.get('/room/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/room.html'));
});

app.post('/api/create-room', (req, res) => {
  const { roomType } = req.body;
  const roomId = generateRoomCode();
  const maxUsers = roomType === 'private' ? 2 : 10;
  
  rooms.set(roomId, {
    users: new Set(),
    type: roomType,
    maxUsers: maxUsers,
    createdAt: new Date()
  });
  
  console.log(`Комната создана: ${roomId}, тип: ${roomType}`);
  res.json({ roomId, roomType });
});

app.get('/api/check-room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Комната не найдена' });
  }
  
  if (room.users.size >= room.maxUsers) {
    return res.status(400).json({ error: 'Комната заполнена' });
  }
  
  res.json({
    exists: true,
    type: room.type,
    currentUsers: room.users.size,
    maxUsers: room.maxUsers
  });
});

// Обработка WebSocket соединений
io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);
  
  socket.on('join-room', (roomId, userId, userName) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('room-error', 'Комната не существует');
      return;
    }
    
    if (room.users.size >= room.maxUsers) {
      socket.emit('room-error', `Комната заполнена (макс: ${room.maxUsers})`);
      return;
    }
    
    socket.join(roomId);
    room.users.add(userId);
    
    socket.roomId = roomId;
    socket.userId = userId;
    socket.userName = userName;
    
    // Оповещаем других участников комнаты
    socket.to(roomId).emit('user-connected', {
      userId,
      userName,
      timestamp: new Date()
    });
    
    // Отправляем текущий список участников новому пользователю
    const usersInRoom = Array.from(room.users).filter(id => id !== userId);
    socket.emit('room-users', usersInRoom);
    
    console.log(`Пользователь ${userName} (${userId}) присоединился к комнате ${roomId}`);
    
    // Обмен сообщениями
    socket.on('send-message', (message) => {
      socket.to(roomId).emit('receive-message', {
        userId,
        userName,
        message,
        timestamp: new Date()
      });
    });
    
    // WebRTC сигналинг
    socket.on('offer', ({ to, offer }) => {
      socket.to(to).emit('offer', { from: userId, offer });
    });
    
    socket.on('answer', ({ to, answer }) => {
      socket.to(to).emit('answer', { from: userId, answer });
    });
    
    socket.on('ice-candidate', ({ to, candidate }) => {
      socket.to(to).emit('ice-candidate', { from: userId, candidate });
    });
    
    // Отключение пользователя
    socket.on('disconnect', () => {
      if (socket.roomId && socket.userId) {
        const room = rooms.get(socket.roomId);
        if (room) {
          room.users.delete(socket.userId);
          socket.to(socket.roomId).emit('user-disconnected', {
            userId: socket.userId,
            userName: socket.userName
          });
          
          if (room.users.size === 0) {
            rooms.delete(socket.roomId);
            console.log(`Комната ${socket.roomId} удалена (пустая)`);
          }
        }
      }
      console.log('Пользователь отключился:', socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
