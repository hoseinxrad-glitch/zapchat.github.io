import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ============================================================
// Types
// ============================================================
interface OnlineUser {
  userId: string
  username: string
  displayName: string
  avatarColor: string
  socketId: string
  lastSeen: number
}

interface TypingState {
  fromUserId: string
  fromUsername: string
  toUserId: string
  isTyping: boolean
}

// ============================================================
// In-memory state (online users only - real data is in DB)
// ============================================================
const onlineUsers = new Map<string, OnlineUser>() // userId -> OnlineUser
const socketToUser = new Map<string, string>() // socketId -> userId

// ============================================================
// Helpers
// ============================================================
function getOnlineUsersList(): OnlineUser[] {
  return Array.from(onlineUsers.values())
}

function emitOnlineUsersList() {
  const list = getOnlineUsersList().map((u) => ({
    userId: u.userId,
    username: u.username,
    displayName: u.displayName,
    avatarColor: u.avatarColor,
  }))
  io.emit('users-list', { users: list })
}

// ============================================================
// Socket event handlers
// ============================================================
io.on('connection', (socket) => {
  console.log(`[connection] socket=${socket.id}`)

  // ----------------------------------------------------------
  // User comes online
  // ----------------------------------------------------------
  socket.on('user:online', (data: {
    userId: string
    username: string
    displayName: string
    avatarColor: string
  }) => {
    const { userId, username, displayName, avatarColor } = data
    const online: OnlineUser = {
      userId,
      username,
      displayName,
      avatarColor,
      socketId: socket.id,
      lastSeen: Date.now(),
    }
    onlineUsers.set(userId, online)
    socketToUser.set(socket.id, userId)

    // Notify everyone that this user is online
    io.emit('user:presence', {
      userId,
      username,
      displayName,
      avatarColor,
      status: 'online',
    })

    // Send the full online list back to the new connection
    emitOnlineUsersList()

    console.log(`[user:online] ${username} (${userId})`)
  })

  // ----------------------------------------------------------
  // Direct message
  // ----------------------------------------------------------
  socket.on('message:send', (data: {
    messageId: string
    chatId: string
    senderId: string
    receiverId: string
    content: string
    type?: string
    fileUrl?: string | null
    fileName?: string | null
    fileSize?: number | null
    createdAt: string
  }) => {
    // Forward to receiver if they are online
    const receiver = onlineUsers.get(data.receiverId)
    if (receiver) {
      io.to(receiver.socketId).emit('message:receive', data)
    }
    // Echo back to sender for confirmation
    socket.emit('message:delivered', {
      messageId: data.messageId,
      chatId: data.chatId,
    })
    console.log(`[message:send] ${data.senderId} -> ${data.receiverId}: ${data.content?.slice(0, 50)}`)
  })

  // ----------------------------------------------------------
  // Message read receipt
  // ----------------------------------------------------------
  socket.on('message:read', (data: {
    chatId: string
    messageIds: string[]
    readerId: string
    senderId: string
  }) => {
    const sender = onlineUsers.get(data.senderId)
    if (sender) {
      io.to(sender.socketId).emit('message:read-receipt', {
        chatId: data.chatId,
        messageIds: data.messageIds,
        readerId: data.readerId,
      })
    }
  })

  // ----------------------------------------------------------
  // Typing indicator
  // ----------------------------------------------------------
  socket.on('typing', (data: TypingState) => {
    const receiver = onlineUsers.get(data.toUserId)
    if (receiver) {
      io.to(receiver.socketId).emit('typing', {
        fromUserId: data.fromUserId,
        fromUsername: data.fromUsername,
        isTyping: data.isTyping,
      })
    }
  })

  // ----------------------------------------------------------
  // New chat created - notify the other user
  // ----------------------------------------------------------
  socket.on('chat:new', (data: {
    chatId: string
    toUserId: string
    fromUser: { userId: string; username: string; displayName: string; avatarColor: string }
  }) => {
    const receiver = onlineUsers.get(data.toUserId)
    if (receiver) {
      io.to(receiver.socketId).emit('chat:new-received', data)
    }
  })

  // ----------------------------------------------------------
  // Disconnect
  // ----------------------------------------------------------
  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id)
    if (userId) {
      const user = onlineUsers.get(userId)
      onlineUsers.delete(userId)
      socketToUser.delete(socket.id)

      if (user) {
        // Notify everyone this user is now offline
        io.emit('user:presence', {
          userId,
          username: user.username,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
          status: 'offline',
          lastSeen: Date.now(),
        })
        console.log(`[user:offline] ${user.username} (${userId})`)
      }
    }
    emitOnlineUsersList()
  })

  socket.on('error', (error) => {
    console.error(`[socket error] ${socket.id}:`, error)
  })
})

httpServer.listen(PORT, () => {
  console.log(`🚀 Chat WebSocket service running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...')
  httpServer.close(() => process.exit(0))
})
