const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
db.user.findMany({
  select: { id: true, username: true, displayName: true, role: true, isBanned: true, createdAt: true }
}).then(users => {
  console.log(JSON.stringify(users, null, 2))
  process.exit(0)
}).catch(e => { console.error(e); process.exit(1) })
