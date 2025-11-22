const socket = io();

const ui = {
    connectionStatus: document.getElementById('connectionStatus'),
    statusDot: document.querySelector('.status-dot'),
    statusText: document.querySelector('.status-text'),
    totalUsers: document.getElementById('totalUsers'),
    popularRoomName: document.getElementById('popularRoomName'),
    popularRoomCount: document.getElementById('popularRoomCount'),
    lastUpdate: document.getElementById('lastUpdate'),
    roomRankings: document.getElementById('roomRankings'),
    roomInput: document.getElementById('roomInput'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    currentRoom: document.getElementById('currentRoom'),
    userTrend: document.getElementById('userTrend')
};

let activeRoom = null;
let lastTotalUsers = 0;
let socketConnected = false;

const setConnectionState = (connected) => {
    socketConnected = connected;

    if (connected) {
        ui.statusDot.classList.remove('disconnected');
        ui.statusText.textContent = 'Connected';
    } else {
        ui.statusDot.classList.add('disconnected');
        ui.statusText.textContent = 'Disconnected';
    }
};

const refreshLastUpdateTime = () => {
    const now = new Date();
    const formatted = now.toLocaleTimeString('pt-BR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    ui.lastUpdate.textContent = formatted;
};

const renderUserTrend = (current, previous) => {
    if (current > previous) {
        ui.userTrend.innerHTML = `
            <span class="trend-text" style="color: #10b981;">
                ↗ +${current - previous} new users
            </span>
        `;
        return;
    }

    if (current < previous) {
        ui.userTrend.innerHTML = `
            <span class="trend-text" style="color: #ef4444;">
                ↘ -${previous - current} users left
            </span>
        `;
        return;
    }

    ui.userTrend.innerHTML = `
        <span class="trend-text">
            Real-time updates
        </span>
    `;
};

const blinkElement = (el) => {
    if (!el) return;
    el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 1000);
};

const renderRoomRankings = (rankingList) => {
    if (!rankingList || rankingList.length === 0) {
        ui.roomRankings.innerHTML = '<div class="empty-state">No active rooms</div>';
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];

    const template = rankingList.map((room, idx) => {
        const position = idx + 1;
        const badge = medals[idx] || `${position}.`;

        return `
            <div class="ranking-item fade-in">
                <span class="ranking-position">${badge}</span>
                <span class="ranking-room">${room.name}</span>
                <span class="ranking-count">${room.count} users</span>
            </div>
        `;
    }).join('');

    ui.roomRankings.innerHTML = template;
};

const updateCurrentRoomLabel = (roomName) => {
    const label = roomName || 'None';
    ui.currentRoom.textContent = label;
    ui.currentRoom.style.color = roomName ? '#10b981' : '#666';
};

const animateNumberChange = (element, newValue) => {
    element.style.transform = 'scale(1.1)';
    element.style.color = '#3b82f6';

    setTimeout(() => {
        element.textContent = newValue;
        element.style.transform = 'scale(1)';
        element.style.color = '';
    }, 150);
};

const showNotification = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `notification notification-${type}`;
    toast.textContent = message;

    const bg =
        type === 'success'
            ? '#10b981'
            : type === 'error'
                ? '#ef4444'
                : '#3b82f6';

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${bg};
        color: white;
        border-radius: 8px;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
};

// Eventos do socket
socket.on('connect', () => {
    console.log('Socket connected');
    setConnectionState(true);
});

socket.on('disconnect', () => {
    console.log('Socket disconnected');
    setConnectionState(false);
});

socket.on('connected', (payload) => {
    console.log('Connection confirmation:', payload);
});

socket.on('dashboard-update', (payload) => {
    console.log('Dashboard update:', payload);

    refreshLastUpdateTime();

    // total de usuários
    if (payload.totalUsers !== lastTotalUsers) {
        animateNumberChange(ui.totalUsers, payload.totalUsers);
        renderUserTrend(payload.totalUsers, lastTotalUsers);
        blinkElement(ui.totalUsers.parentElement);
        lastTotalUsers = payload.totalUsers;
    }

    // sala mais popular
    if (payload.mostPopularRoom.name !== ui.popularRoomName.textContent) {
        ui.popularRoomName.textContent = payload.mostPopularRoom.name;
        blinkElement(ui.popularRoomName.parentElement);
    }

    const currentPopularCount = parseInt(ui.popularRoomCount.textContent);
    if (payload.mostPopularRoom.count !== currentPopularCount) {
        ui.popularRoomCount.textContent = payload.mostPopularRoom.count;
    }

    // ranking de salas
    renderRoomRankings(payload.roomRankings);
});

socket.on('room-joined', (info) => {
    console.log('Room joined:', info);
    activeRoom = info.room;
    updateCurrentRoomLabel(activeRoom);

    ui.roomInput.value = '';

    showNotification(`Joined room: ${info.room}`, 'success');
});

socket.on('room-update', (data) => {
    console.log('Room update event:', data);
});

// Listeners de UI
ui.joinRoomBtn.addEventListener('click', () => {
    const roomName = ui.roomInput.value.trim();

    if (!roomName) {
        showNotification('Please enter a room name', 'error');
        return;
    }

    if (!socketConnected) {
        showNotification('Not connected to server', 'error');
        return;
    }

    socket.emit('join-room', roomName);
});

ui.leaveRoomBtn.addEventListener('click', () => {
    if (!activeRoom) {
        showNotification('You are not in any room', 'error');
        return;
    }

    if (!socketConnected) {
        showNotification('Not connected to server', 'error');
        return;
    }

    socket.emit('leave-room');
    activeRoom = null;
    updateCurrentRoomLabel(null);

    showNotification('Left the room', 'info');
});

ui.roomInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        ui.joinRoomBtn.click();
    }
});

ui.roomInput.addEventListener('focus', () => {
    ui.roomInput.style.borderColor = '#3b82f6';
});

ui.roomInput.addEventListener('blur', () => {
    ui.roomInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
});

// Estilos das notificações
const styleTag = document.createElement('style');
styleTag.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(styleTag);

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard ready');
    setConnectionState(false);
    updateCurrentRoomLabel(null);
});
