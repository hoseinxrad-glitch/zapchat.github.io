const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  // Promote hoseinxradgmailcom to admin
  const user = await db.user.update({
    where: { username: 'hoseinxradgmailcom' },
    data: { role: 'admin' },
    select: { id: true, username: true, displayName: true, role: true, isBanned: true, createdAt: true },
  })
  console.log('✅ User is now admin:')
  console.log(JSON.stringify(user, null, 2))

  // List all admins
  const admins = await db.user.findMany({
    where: { role: 'admin' },
    select: { id: true, username: true, displayName: true, role: true },
  })
  console.log('\n📋 All admins now:')
  console.log(JSON.stringify(admins, null, 2))

  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
