import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
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
    userId: u.userId, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor,
  }))
  io.emit('users-list', { users: list })
}

function sendToUser(userId: string, event: string, payload: any) {
  const user = onlineUsers.get(userId)
  if (user) io.to(user.socketId).emit(event, payload)
}

function sendToUsers(userIds: string[], event: string, payload: any) {
  for (const uid of userIds) sendToUser(uid, event, payload)
}

io.on('connection', (socket) => {
  console.log(`[connection] socket=${socket.id}`)

  // ============ Presence ============
  socket.on('user:online', (data: any) => {
    const online: OnlineUser = { ...data, socketId: socket.id, lastSeen: Date.now() }
    onlineUsers.set(data.userId, online)
    socketToUser.set(socket.id, data.userId)
    io.emit('user:presence', { ...data, status: 'online' })
    emitOnlineUsersList()
  })

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id)
    if (userId) {
      const user = onlineUsers.get(userId)
      onlineUsers.delete(userId)
      socketToUser.delete(socket.id)
      if (user) {
        io.emit('user:presence', {
          userId, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor,
          status: 'offline', lastSeen: Date.now(),
        })
      }
    }
    emitOnlineUsersList()
  })

  // ============ Direct messages ============
  socket.on('message:send', (data: any) => {
    sendToUser(data.receiverId, 'message:receive', data)
    socket.emit('message:delivered', { messageId: data.messageId, chatId: data.chatId })
  })

  socket.on('message:read', (data: any) => {
    sendToUser(data.senderId, 'message:read-receipt', data)
  })

  socket.on('typing', (data: any) => {
    sendToUser(data.toUserId, 'typing', data)
  })

  socket.on('chat:new', (data: any) => {
    sendToUser(data.toUserId, 'chat:new-received', data)
  })

  // ============ Group messages ============
  socket.on('group:message:send', (data: any) => {
    sendToUsers(data.memberIds, 'group:message:receive', {
      groupId: data.groupId, message: data.payload,
    })
    socket.emit('group:message:delivered', { messageId: data.messageId, groupId: data.groupId })
  })

  socket.on('group:typing', (data: any) => {
    sendToUsers(data.memberIds, 'group:typing', {
      groupId: data.groupId, fromUserId: data.fromUserId,
      fromUsername: data.fromUsername, fromDisplayName: data.fromDisplayName,
      isTyping: data.isTyping,
    })
  })

  socket.on('group:event', (data: any) => {
    sendToUsers(data.memberIds, 'group:event', data)
  })

  socket.on('group:new', (data: any) => {
    sendToUsers(data.memberIds, 'group:new-received', { group: data.group })
  })

  // ============ Reactions (NEW) ============
  socket.on('reaction:toggle', (data: {
    messageId: string
    emoji: string
    userId: string
    chatId?: string
    groupId?: string
    channelId?: string
    receiverIds: string[]
    action: 'added' | 'removed'
  }) => {
    sendToUsers(data.receiverIds, 'reaction:updated', {
      messageId: data.messageId,
      emoji: data.emoji,
      userId: data.userId,
      action: data.action,
      chatId: data.chatId,
      groupId: data.groupId,
      channelId: data.channelId,
    })
  })

  // ============ Message edit (NEW) ============
  socket.on('message:edited', (data: {
    message: any
    recipientIds: string[]
  }) => {
    sendToUsers(data.recipientIds, 'message:edited', { message: data.message })
  })

  // ============ Message pin/unpin (NEW) ============
  socket.on('message:pinned', (data: {
    chatId?: string
    groupId?: string
    messageId: string
    recipientIds: string[]
  }) => {
    sendToUsers(data.recipientIds, 'message:pinned', data)
  })

  socket.on('message:unpinned', (data: {
    chatId?: string
    groupId?: string
    recipientIds: string[]
  }) => {
    sendToUsers(data.recipientIds, 'message:unpinned', data)
  })

  // ============ Message delete for both (NEW) ============
  socket.on('message:deleted', (data: {
    messageId: string
    chatId?: string
    groupId?: string
    channelId?: string
    recipientIds: string[]
  }) => {
    sendToUsers(data.recipientIds, 'message:deleted', {
      messageId: data.messageId,
      chatId: data.chatId,
      groupId: data.groupId,
      channelId: data.channelId,
    })
  })

  // ============ Channel events (NEW) ============
  socket.on('channel:new', (data: { subscriberIds: string[], channel: any }) => {
    sendToUsers(data.subscriberIds, 'channel:new-received', { channel: data.channel })
  })

  socket.on('channel:post', (data: {
    channelId: string
    message: any
    subscriberIds: string[]
  }) => {
    sendToUsers(data.subscriberIds, 'channel:post-received', {
      channelId: data.channelId,
      message: data.message,
    })
  })

  socket.on('channel:event', (data: {
    type: 'subscribe' | 'unsubscribe' | 'updated' | 'deleted'
    channelId: string
    subscriberIds: string[]
    payload?: any
  }) => {
    sendToUsers(data.subscriberIds, 'channel:event', data)
  })

  // ============ Story events (NEW) ============
  socket.on('story:new', (data: { followerIds: string[], story: any }) => {
    sendToUsers(data.followerIds, 'story:new-received', { story: data.story })
  })

  socket.on('story:viewed', (data: { storyOwnerId: string, storyId: string, viewer: any }) => {
    sendToUser(data.storyOwnerId, 'story:viewed', {
      storyId: data.storyId,
      viewer: data.viewer,
    })
  })

  socket.on('story:deleted', (data: { storyId: string, followerIds: string[] }) => {
    sendToUsers(data.followerIds, 'story:deleted', { storyId: data.storyId })
  })

  // ============ Voice/Video Calls (NEW) ============
  // Calls signaling uses WebRTC; WebSocket is just for signaling relay.
  socket.on('call:invite', (data: {
    callId: string
    callerId: string
    callerName: string
    callerAvatarColor: string
    receiverId: string
    callType: 'audio' | 'video'
  }) => {
    sendToUser(data.receiverId, 'call:incoming', data)
  })

  socket.on('call:accept', (data: {
    callId: string
    callerId: string
    accepterId: string
  }) => {
    sendToUser(data.callerId, 'call:accepted', data)
  })

  socket.on('call:reject', (data: {
    callId: string
    callerId: string
    reason?: string
  }) => {
    sendToUser(data.callerId, 'call:rejected', data)
  })

  socket.on('call:end', (data: {
    callId: string
    otherUserId: string
    reason?: string
  }) => {
    sendToUser(data.otherUserId, 'call:ended', data)
  })

  // WebRTC SDP offer
  socket.on('call:sdp:offer', (data: {
    callId: string
    receiverId: string
    sdp: any
  }) => {
    sendToUser(data.receiverId, 'call:sdp:offer', data)
  })

  // WebRTC SDP answer
  socket.on('call:sdp:answer', (data: {
    callId: string
    callerId: string
    sdp: any
  }) => {
    sendToUser(data.callerId, 'call:sdp:answer', data)
  })

  // ICE candidate exchange
  socket.on('call:ice', (data: {
    callId: string
    targetUserId: string
    candidate: any
  }) => {
    sendToUser(data.targetUserId, 'call:ice', data)
  })

  socket.on('error', (error) => {
    console.error(`[socket error] ${socket.id}:`, error)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Chat WebSocket service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM received')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('SIGINT received')
  httpServer.close(() => process.exit(0))
})
