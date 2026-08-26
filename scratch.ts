import { prisma } from './src/lib/prisma'; 
async function run() { 
  const qs = await prisma.quotation.findMany({ 
    include: { items: true } 
  }); 
  qs.forEach(q => {
    console.log(q.id);
    if (q.id.includes('1786526416096-3')) {
      console.log(JSON.stringify(q.items, null, 2)); 
    }
  });
} 
run();
