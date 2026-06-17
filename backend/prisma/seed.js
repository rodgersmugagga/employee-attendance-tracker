const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  // Create initial users
  await prisma.user.upsert({
    where: { email: 'admin@blueox.com' },
    update: {
      name: 'Manager',
      password: 'password123',
      role: 'admin'
    },
    create: {
      name: 'Manager',
      email: 'admin@blueox.com',
      password: 'password123',
      role: 'admin'
    }
  });

  await prisma.user.upsert({
    where: { email: 'john@blueox.com' },
    update: {
      name: 'John Doe',
      password: 'password123',
      role: 'employee'
    },
    create: {
      name: 'John Doe',
      email: 'john@blueox.com',
      password: 'password123',
      role: 'employee'
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
