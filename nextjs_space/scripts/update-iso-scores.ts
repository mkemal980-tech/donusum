import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ISO 46001 anketini bul
  const survey = await prisma.survey.findFirst({
    where: { name: { contains: 'ISO 46001' } }
  });
  
  if (!survey) {
    console.log('ISO 46001 anketi bulunamadı');
    return;
  }
  
  console.log('Anket bulundu:', survey.name, survey.id);
  
  // Bu ankete ait kategorileri bul
  const categories = await prisma.category.findMany({
    where: { surveyId: survey.id },
    include: {
      subCategories: {
        include: {
          questions: true
        }
      }
    }
  });
  
  let updatedCount = 0;
  
  for (const category of categories) {
    for (const subCat of category.subCategories) {
      for (const question of subCat.questions) {
        if (question.type === 'MULTIPLE_CHOICE' && question.options) {
          let options: any[];
          
          // Parse options if string
          if (typeof question.options === 'string') {
            try {
              options = JSON.parse(question.options);
            } catch {
              continue;
            }
          } else {
            options = question.options as any[];
          }
          
          // Yeni puanlama: A=1, B=2, C=3, D=4
          const newOptions = options.map((opt: any) => {
            if (opt.value === 'A') return { ...opt, score: 1 };
            if (opt.value === 'B') return { ...opt, score: 2 };
            if (opt.value === 'C') return { ...opt, score: 3 };
            if (opt.value === 'D') return { ...opt, score: 4 };
            return opt;
          });
          
          await prisma.question.update({
            where: { id: question.id },
            data: { options: newOptions }
          });
          
          updatedCount++;
          console.log('Güncellendi:', question.text.substring(0, 50) + '...');
        }
      }
    }
  }
  
  console.log('\nToplam ' + updatedCount + ' soru güncellendi.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
