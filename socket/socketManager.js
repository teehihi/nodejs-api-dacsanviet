const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dacsanviet_secret_key_2024');
        socket.userId = String(decoded.userId || decoded.id);
        socket.userRole = decoded.role;
      } catch {}
    }
    next();
  });

  io.on('connection', (socket) => {
    if (socket.userId) {
      socket.join(`user_${socket.userId}`);
      console.log(`🔌 Socket connected: user_${socket.userId}`);
    }
    if (socket.userRole === 'admin' || socket.userRole === 'ADMIN') {
      socket.join('admin_room');
    }
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: user_${socket.userId}`);
    });
  });

  return io;
};

const getIO = () => io;

// Emit to specific user
const notifyUser = (userId, event, data) => {
  if (io) {
    const room = `user_${String(userId)}`;
    console.log(`📢 Notify room: ${room}`);
    io.to(room).emit(event, data);
  }
};

// Emit to all admins
const notifyAdmin = (event, data) => {
  if (io) io.to('admin_room').emit(event, data);
};

// Emit to everyone
const broadcast = (event, data) => {
  if (io) io.emit(event, data);
};

module.exports = { initSocket, getIO, notifyUser, notifyAdmin, broadcast };
