import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const files = await prisma.userFile.findMany({
    include: { storedFile: true }
  });
  console.log(files.length, "files found");
  if (files.length > 0) {
    console.log("First file:", files[0]);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
