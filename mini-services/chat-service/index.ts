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

// ============================================================
// In-memory state (online users only)
// ============================================================
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

// Deliver to a specific user (all their active sockets)
function sendToUser(userId: string, event: string, payload: any) {
  const user = onlineUsers.get(userId)
  if (user) {
    io.to(user.socketId).emit(event, payload)
  }
}

// Deliver to multiple users (used for group messages)
function sendToUsers(userIds: string[], event: string, payload: any) {
  for (const uid of userIds) {
    sendToUser(uid, event, payload)
  }
}

io.on('connection', (socket) => {
  console.log(`[connection] socket=${socket.id}`)

  // ----------------------------------------------------------
  // Direct: user comes online
  // ----------------------------------------------------------
  socket.on('user:online', (data: {
    userId: string
    username: string
    displayName: string
    avatarColor: string
  }) => {
    const online: OnlineUser = {
      ...data,
      socketId: socket.id,
      lastSeen: Date.now(),
    }
    onlineUsers.set(data.userId, online)
    socketToUser.set(socket.id, data.userId)

    io.emit('user:presence', { ...data, status: 'online' })
    emitOnlineUsersList()
    console.log(`[user:online] ${data.username}`)
  })

  // ----------------------------------------------------------
  // Direct message (1-on-1)
  // ----------------------------------------------------------
  socket.on('message:send', (data: any) => {
    // Forward to receiver if they are online
    sendToUser(data.receiverId, 'message:receive', data)
    // Echo back to sender for confirmation
    socket.emit('message:delivered', {
      messageId: data.messageId,
      chatId: data.chatId,
    })
  })

  // ----------------------------------------------------------
  // Group message (broadcast to all listed memberIds)
  // The client sends the list of recipient userIds (excluding sender).
  // ----------------------------------------------------------
  socket.on('group:message:send', (data: {
    messageId: string
    groupId: string
    senderId: string
    memberIds: string[]
    payload: any // full message object
  }) => {
    sendToUsers(data.memberIds, 'group:message:receive', {
      groupId: data.groupId,
      message: data.payload,
    })
    // Echo back to sender for confirmation
    socket.emit('group:message:delivered', {
      messageId: data.messageId,
      groupId: data.groupId,
    })
  })

  // ----------------------------------------------------------
  // Group typing indicator
  // ----------------------------------------------------------
  socket.on('group:typing', (data: {
    groupId: string
    fromUserId: string
    fromUsername: string
    fromDisplayName: string
    memberIds: string[]
    isTyping: boolean
  }) => {
    sendToUsers(data.memberIds, 'group:typing', {
      groupId: data.groupId,
      fromUserId: data.fromUserId,
      fromUsername: data.fromUsername,
      fromDisplayName: data.fromDisplayName,
      isTyping: data.isTyping,
    })
  })

  // ----------------------------------------------------------
  // Group event: a member was added/removed/updated
  // ----------------------------------------------------------
  socket.on('group:event', (data: {
    type: 'member-added' | 'member-removed' | 'group-updated' | 'group-deleted'
    groupId: string
    memberIds: string[]
    payload?: any
  }) => {
    sendToUsers(data.memberIds, 'group:event', data)
  })

  // ----------------------------------------------------------
  // Read receipt (direct messages)
  // ----------------------------------------------------------
  socket.on('message:read', (data: any) => {
    const sender = onlineUsers.get(data.senderId)
    if (sender) {
      io.to(sender.socketId).emit('message:read-receipt', data)
    }
  })

  // ----------------------------------------------------------
  // Typing indicator (direct)
  // ----------------------------------------------------------
  socket.on('typing', (data: any) => {
    sendToUser(data.toUserId, 'typing', data)
  })

  // ----------------------------------------------------------
  // New chat created (direct) - notify the other user
  // ----------------------------------------------------------
  socket.on('chat:new', (data: any) => {
    sendToUser(data.toUserId, 'chat:new-received', data)
  })

  // ----------------------------------------------------------
  // New group created - notify all members so they refresh their group list
  // ----------------------------------------------------------
  socket.on('group:new', (data: { memberIds: string[]; group: any }) => {
    sendToUsers(data.memberIds, 'group:new-received', { group: data.group })
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
  console.log(`Chat WebSocket service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...')
  httpServer.close(() => process.exit(0))
})
