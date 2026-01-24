import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Full system administrator with all permissions',
      permissions: JSON.stringify([
        'panel.admin',
        'servers.create',
        'servers.viewAll',
        'users.view',
        'users.create',
        'users.edit',
        'users.delete',
        'roles.view',
        'roles.create',
        'roles.edit',
        'roles.delete',
      ]),
      isSystem: true,
    },
  });
  console.log(`Created/updated Admin role: ${adminRole.id}`);

  const moderatorRole = await prisma.role.upsert({
    where: { name: 'Moderator' },
    update: {},
    create: {
      name: 'Moderator',
      description: 'Can view all servers and manage them as operator',
      permissions: JSON.stringify(['servers.viewAll', 'users.view']),
      isSystem: true,
    },
  });
  console.log(`Created/updated Moderator role: ${moderatorRole.id}`);

  const userRole = await prisma.role.upsert({
    where: { name: 'User' },
    update: {},
    create: {
      name: 'User',
      description: 'Basic user - only sees servers they have access to',
      permissions: JSON.stringify([]),
      isSystem: true,
    },
  });
  console.log(`Created/updated User role: ${userRole.id}`);

  // Migrate existing users: assign Admin role to first user if no role
  const existingUsers = await prisma.user.findMany({
    where: { roleId: null },
    orderBy: { createdAt: 'asc' },
  });

  if (existingUsers.length > 0) {
    // First user gets Admin
    await prisma.user.update({
      where: { id: existingUsers[0].id },
      data: { roleId: adminRole.id },
    });
    console.log(`Assigned Admin role to first user: ${existingUsers[0].email}`);

    // Remaining users get User role
    for (let i = 1; i < existingUsers.length; i++) {
      await prisma.user.update({
        where: { id: existingUsers[i].id },
        data: { roleId: userRole.id },
      });
      console.log(`Assigned User role to: ${existingUsers[i].email}`);
    }
  }

  // Migrate existing servers: make first user owner of all servers without access entries
  const existingServers = await prisma.server.findMany();
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

  if (firstUser && existingServers.length > 0) {
    for (const server of existingServers) {
      const existingAccess = await prisma.serverAccess.findUnique({
        where: { userId_serverId: { userId: firstUser.id, serverId: server.id } },
      });

      if (!existingAccess) {
        await prisma.serverAccess.create({
          data: {
            userId: firstUser.id,
            serverId: server.id,
            permissionLevel: 'owner',
          },
        });
        console.log(`Granted owner access to ${firstUser.email} for server: ${server.name}`);
      }
    }
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
