// Servidor de dashboard em tempo real usando Express + Socket.IO

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Arquivos estáticos (front-end)
app.use(express.static(path.join(__dirname, 'public')));

// Estado básico da aplicação
let onlineUsers = 0;
const roomCounters = {};
const userCurrentRoom = {};

// Utilitários de cálculo

const calculateMostPopularRoom = () => {
    let highestCount = 0;
    let roomName = 'None';

    for (const [name, count] of Object.entries(roomCounters)) {
        if (count > highestCount) {
            highestCount = count;
            roomName = name;
        }
    }

    return { name: roomName, count: highestCount };
};

const buildRoomRanking = () => {
    return Object.entries(roomCounters)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
};

const pushDashboardSnapshot = () => {
    const mostPopularRoom = calculateMostPopularRoom();
    const roomRankings = buildRoomRanking();

    io.emit('dashboard-update', {
        totalUsers: onlineUsers,
        mostPopularRoom,
        roomRankings,
        timestamp: new Date().toISOString()
    });
};

// Funções auxiliares de sala

const leaveUserRoomIfAny = (socket) => {
    const currentRoom = userCurrentRoom[socket.id];
    if (!currentRoom) return;

    socket.leave(currentRoom);

    roomCounters[currentRoom] = Math.max(0, (roomCounters[currentRoom] || 0) - 1);

    if (roomCounters[currentRoom] === 0) {
        delete roomCounters[currentRoom];
    }

    delete userCurrentRoom[socket.id];

    io.to(currentRoom).emit('room-update', {
        room: currentRoom,
        userCount: roomCounters[currentRoom] || 0
    });

    console.log(`User ${socket.id} left room: ${currentRoom}`);
};

const joinRoom = (socket, roomName) => {
    // Se já estava em uma sala, sai antes
    if (userCurrentRoom[socket.id]) {
        const previousRoom = userCurrentRoom[socket.id];
        socket.leave(previousRoom);

        roomCounters[previousRoom] = Math.max(
            0,
            (roomCounters[previousRoom] || 0) - 1
        );

        if (roomCounters[previousRoom] === 0) {
            delete roomCounters[previousRoom];
        }
    }

    socket.join(roomName);
    userCurrentRoom[socket.id] = roomName;
    roomCounters[roomName] = (roomCounters[roomName] || 0) + 1;

    console.log(
        `User ${socket.id} joined room: ${roomName}. Room count: ${roomCounters[roomName]}`
    );

    socket.emit('room-joined', {
        room: roomName,
        userCount: roomCounters[roomName]
    });

    io.to(roomName).emit('room-update', {
        room: roomName,
        userCount: roomCounters[roomName]
    });
};

// Eventos Socket.IO

io.on('connection', (socket) => {
    onlineUsers += 1;
    console.log(`User connected: ${socket.id}. Total users: ${onlineUsers}`);

    socket.emit('connected', { userId: socket.id });

    socket.on('join-room', (roomName) => {
        if (!roomName) return;
        joinRoom(socket, roomName);
    });

    socket.on('leave-room', () => {
        leaveUserRoomIfAny(socket);
    });

    socket.on('disconnect', () => {
        onlineUsers -= 1;

        leaveUserRoomIfAny(socket);

        console.log(`User disconnected: ${socket.id}. Total users: ${onlineUsers}`);
    });
});

// Atualização periódica do dashboard
setInterval(pushDashboardSnapshot, 1000);

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicialização do servidor
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Dashboard available at http://localhost:${PORT}`);
});
