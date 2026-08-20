import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function backupDatabase() {
  console.log('\n💾 Veritabanı Yedekleme Başlatılıyor...\n');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  
  // Backup klasörü oluştur
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backup: Record<string, unknown[]> = {};
  
  // Tüm tabloları yedekle
  try {
    backup.surveys = await prisma.survey.findMany();
    backup.categories = await prisma.category.findMany();
    backup.subCategories = await prisma.subCategory.findMany();
    backup.subLevels = await prisma.subLevel.findMany();
    backup.questions = await prisma.question.findMany();
    backup.recommendations = await prisma.recommendation.findMany();
    backup.sectors = await prisma.sector.findMany();
    backup.subSectors = await prisma.subSector.findMany();
    backup.benchmarks = await prisma.benchmark.findMany();
    backup.ironmanBenchmarks = await prisma.ironmanBenchmark.findMany();
    
    // Kullanıcı verilerini de yedekle (hassas)
    backup.users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        organization: true,
        role: true,
        sectorId: true,
        subSectorId: true,
        isActive: true,
        createdAt: true
      }
    });
    backup.surveyResponses = await prisma.surveyResponse.findMany();
    
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    
    console.log('✅ Yedekleme tamamlandı!');
    console.log(`   Dosya: ${filepath}`);
    console.log('\n📊 Yedeklenen Kayıtlar:');
    Object.entries(backup).forEach(([table, records]) => {
      console.log(`   - ${table}: ${(records as unknown[]).length} kayıt`);
    });
    
  } catch (error) {
    console.error('❌ Yedekleme hatası:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
