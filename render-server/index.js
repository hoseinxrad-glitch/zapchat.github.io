// ZapChat WebSocket server — for Render deployment
// This is a standalone Node.js WebSocket server that handles real-time messaging.
// Deploy this to Render (free tier) as a Web Service.

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = process.env.PORT || 3003

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*', // In production, set this to your GitHub Pages URL
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface OnlineUser {
  userId: string
  username: string
  displayName: string
  avatarColor: string
  socketId: string
  lastSeen: number
}

const onlineUsers = new Map<string, OnlineUser>()
const socketToUser = new Map<string, string>()

function emitOnlineUsersList() {
  const list = Array.from(onlineUsers.values()).map((u) => ({
    userId: u.userId,
    username: u.username,
    displayName: u.displayName,
    avatarColor: u.avatarColor,
  }))
  io.emit('users-list', { users: list })
}

io.on('connection', (socket) => {
  console.log(`[connection] socket=${socket.id}`)

  socket.on('user:online', (data) => {
    const online = { ...data, socketId: socket.id, lastSeen: Date.now() }
    onlineUsers.set(data.userId, online)
    socketToUser.set(socket.id, data.userId)
    io.emit('user:presence', { ...data, status: 'online' })
    emitOnlineUsersList()
    console.log(`[user:online] ${data.username}`)
  })

  socket.on('message:send', (data) => {
    const receiver = onlineUsers.get(data.receiverId)
    if (receiver) {
      io.to(receiver.socketId).emit('message:receive', data)
    }
    socket.emit('message:delivered', {
      messageId: data.messageId,
      chatId: data.chatId,
    })
  })

  socket.on('message:read', (data) => {
    const sender = onlineUsers.get(data.senderId)
    if (sender) {
      io.to(sender.socketId).emit('message:read-receipt', data)
    }
  })

  socket.on('typing', (data) => {
    const receiver = onlineUsers.get(data.toUserId)
    if (receiver) {
      io.to(receiver.socketId).emit('typing', data)
    }
  })

  socket.on('chat:new', (data) => {
    const receiver = onlineUsers.get(data.toUserId)
    if (receiver) {
      io.to(receiver.socketId).emit('chat:new-received', data)
    }
  })

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id)
    if (userId) {
      const user = onlineUsers.get(userId)
      onlineUsers.delete(userId)
      socketToUser.delete(socket.id)
      if (user) {
        io.emit('user:presence', {
          userId,
          username: user.username,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
          status: 'offline',
          lastSeen: Date.now(),
        })
        console.log(`[user:offline] ${user.username}`)
      }
    }
    emitOnlineUsersList()
  })

  socket.on('error', (error) => {
    console.error(`[socket error] ${socket.id}:`, error)
  })
})

httpServer.listen(PORT, () => {
  console.log(`ZapChat WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...')
  httpServer.close(() => process.exit(0))
})
