import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const storedFiles = await prisma.storedFile.findMany();
  console.log(storedFiles.length, "stored files found");
  const userFiles = await prisma.userFile.findMany();
  console.log(userFiles.length, "user files found");
}
main().catch(console.error).finally(() => prisma.$disconnect());
