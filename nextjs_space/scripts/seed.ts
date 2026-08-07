import { PrismaClient, QuestionType, CostType, Timeframe, StrategicType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Güvenlik kontrolü: Mevcut verileri kontrol et
async function checkExistingData() {
  const counts = {
    categories: await prisma.category.count(),
    questions: await prisma.question.count(),
    responses: await prisma.surveyResponse.count(),
    users: await prisma.user.count()
  };
  
  console.log('\n📊 Mevcut Veritabanı Durumu:');
  console.log(`   - Kategoriler: ${counts.categories}`);
  console.log(`   - Sorular: ${counts.questions}`);
  console.log(`   - Cevaplar: ${counts.responses}`);
  console.log(`   - Kullanıcılar: ${counts.users}`);
  
  // Eğer önemli kullanıcı verileri varsa uyar
  if (counts.responses > 100 || counts.users > 10) {
    console.log('\n⚠️  UYARI: Veritabanında önemli miktarda kullanıcı verisi var!');
    console.log('   Seed işlemi bu verileri SİLECEKTİR.');
    console.log('   Devam etmek için FORCE_SEED=true environment variable kullanın.\n');
    
    if (process.env.FORCE_SEED !== 'true') {
      throw new Error('Seed işlemi iptal edildi. FORCE_SEED=true ile tekrar deneyin.');
    }
    console.log('   FORCE_SEED=true algılandı, devam ediliyor...\n');
  }
  
  return counts;
}

async function main() {
  console.log('Starting seed...');
  
  // Önce mevcut verileri kontrol et
  await checkExistingData();

  // Clear existing data
  await prisma.roadmapItem.deleteMany();
  await prisma.assessmentScore.deleteMany();
  await prisma.document.deleteMany();
  await prisma.surveyResponse.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.question.deleteMany();
  await prisma.subLevel.deleteMany();
  await prisma.subCategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.benchmark.deleteMany();
  await prisma.sectorScopeRule.deleteMany();
  await prisma.userSurveyAssignment.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      organization: 'System',
      role: 'ADMIN',
      emailVerified: true,
      isActive: true
    }
  });

  console.log('Created admin user');

  // Create test user
  const hashedPassword = await bcrypt.hash('johndoe123', 10);
  const testUser = await prisma.user.create({
    data: {
      email: 'john@doe.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Doe',
      organization: 'Test Corp',
      emailVerified: true,
      isActive: true
    }
  });

  console.log('Created test user');

  // Create default survey
  const defaultSurvey = await prisma.survey.create({
    data: {
      name: 'Sürdürülebilirlik',
      description: 'ESG ve sürdürülebilirlik değerlendirmesi',
      isActive: true,
      order: 1
    }
  });

  console.log('Created default survey:', defaultSurvey.name);

  await prisma.userSurveyAssignment.create({
    data: {
      userId: testUser.id,
      surveyId: defaultSurvey.id,
      assignedBy: adminUser.id,
      isActive: true
    }
  });

  console.log('Assigned default survey to test user');

  // Create survey structure
  const categories = [
    {
      name: 'Environmental Sustainability',
      description: 'Assess your environmental impact and sustainability practices',
      order: 1,
      subCategories: [
        {
          name: 'Carbon Management',
          order: 1,
          subLevels: [
            {
              name: 'Emissions Tracking',
              order: 1,
              questions: [
                { text: 'How mature is your carbon emissions measurement and tracking system?', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Do you have Scope 1, 2, and 3 emissions calculated?', type: QuestionType.YES_NO, requiresEvidence: true, order: 2 },
                { text: 'How frequently do you report on emissions?', type: QuestionType.MULTIPLE_CHOICE, requiresEvidence: false, order: 3, options: [{ value: 'never', label: 'Never', score: 1 }, { value: 'annually', label: 'Annually', score: 3 }, { value: 'quarterly', label: 'Quarterly', score: 4 }, { value: 'monthly', label: 'Monthly', score: 5 }] }
              ]
            },
            {
              name: 'Reduction Initiatives',
              order: 2,
              questions: [
                { text: 'Rate your carbon reduction initiative maturity', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Do you have science-based targets?', type: QuestionType.YES_NO, requiresEvidence: true, order: 2 }
              ]
            }
          ]
        },
        {
          name: 'Resource Efficiency',
          order: 2,
          subLevels: [
            {
              name: 'Energy Management',
              order: 1,
              questions: [
                { text: 'How effectively do you manage energy consumption?', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'What percentage of energy comes from renewable sources?', type: QuestionType.MULTIPLE_CHOICE, requiresEvidence: false, order: 2, options: [{ value: '0-25', label: '0-25%', score: 1 }, { value: '26-50', label: '26-50%', score: 2 }, { value: '51-75', label: '51-75%', score: 4 }, { value: '76-100', label: '76-100%', score: 5 }] }
              ]
            },
            {
              name: 'Waste & Circularity',
              order: 2,
              questions: [
                { text: 'Rate your waste reduction and circularity practices', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Do you have a circular economy strategy?', type: QuestionType.YES_NO, requiresEvidence: true, order: 2 }
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'Social Responsibility',
      description: 'Evaluate social impact and stakeholder engagement',
      order: 2,
      subCategories: [
        {
          name: 'Employee Wellbeing',
          order: 1,
          subLevels: [
            {
              name: 'Health & Safety',
              order: 1,
              questions: [
                { text: 'How mature are your health and safety programs?', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Do you have ISO 45001 or equivalent certification?', type: QuestionType.YES_NO, requiresEvidence: true, order: 2 }
              ]
            },
            {
              name: 'Diversity & Inclusion',
              order: 2,
              questions: [
                { text: 'Rate your D&I program maturity', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Do you have measurable D&I targets?', type: QuestionType.YES_NO, requiresEvidence: false, order: 2 }
              ]
            }
          ]
        },
        {
          name: 'Community Impact',
          order: 2,
          subLevels: [
            {
              name: 'Local Engagement',
              order: 1,
              questions: [
                { text: 'How effectively do you engage with local communities?', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Do you have formal community engagement programs?', type: QuestionType.YES_NO, requiresEvidence: true, order: 2 }
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'Governance & Ethics',
      description: 'Assess governance structures and ethical practices',
      order: 3,
      subCategories: [
        {
          name: 'Corporate Governance',
          order: 1,
          subLevels: [
            {
              name: 'Board Oversight',
              order: 1,
              questions: [
                { text: 'How effective is board oversight of ESG matters?', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Does your board have ESG expertise?', type: QuestionType.YES_NO, requiresEvidence: false, order: 2 }
              ]
            },
            {
              name: 'Risk Management',
              order: 2,
              questions: [
                { text: 'Rate your ESG risk management maturity', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Do you have climate risk assessments (TCFD)?', type: QuestionType.YES_NO, requiresEvidence: true, order: 2 }
              ]
            }
          ]
        },
        {
          name: 'Ethics & Compliance',
          order: 2,
          subLevels: [
            {
              name: 'Business Ethics',
              order: 1,
              questions: [
                { text: 'How robust are your business ethics policies?', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Do you have anti-corruption training for all employees?', type: QuestionType.YES_NO, requiresEvidence: false, order: 2 }
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'Digital Transformation',
      description: 'Evaluate digital maturity and technology adoption',
      order: 4,
      subCategories: [
        {
          name: 'Data & Analytics',
          order: 1,
          subLevels: [
            {
              name: 'Data Infrastructure',
              order: 1,
              questions: [
                { text: 'How mature is your data infrastructure?', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Do you have a centralized data platform?', type: QuestionType.YES_NO, requiresEvidence: false, order: 2 }
              ]
            },
            {
              name: 'Advanced Analytics',
              order: 2,
              questions: [
                { text: 'Rate your AI/ML adoption maturity', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'Are predictive analytics used for decision-making?', type: QuestionType.YES_NO, requiresEvidence: false, order: 2 }
              ]
            }
          ]
        },
        {
          name: 'Process Automation',
          order: 2,
          subLevels: [
            {
              name: 'Workflow Automation',
              order: 1,
              questions: [
                { text: 'How mature is your workflow automation?', type: QuestionType.SCALE, requiresEvidence: false, order: 1 },
                { text: 'What percentage of processes are automated?', type: QuestionType.MULTIPLE_CHOICE, requiresEvidence: false, order: 2, options: [{ value: '0-20', label: '0-20%', score: 1 }, { value: '21-40', label: '21-40%', score: 2 }, { value: '41-60', label: '41-60%', score: 3 }, { value: '61-80', label: '61-80%', score: 4 }, { value: '81-100', label: '81-100%', score: 5 }] }
              ]
            }
          ]
        }
      ]
    }
  ];

  // Create categories with subcategories, sublevels, and questions
  for (const categoryData of categories) {
    const category = await prisma.category.create({
      data: {
        name: categoryData.name,
        description: categoryData.description,
        order: categoryData.order,
        surveyId: defaultSurvey.id  // ✅ Ankete bağla
      }
    });

    for (const subCatData of categoryData.subCategories) {
      const subCategory = await prisma.subCategory.create({
        data: {
          name: subCatData.name,
          order: subCatData.order,
          categoryId: category.id
        }
      });

      for (const subLevelData of subCatData.subLevels) {
        const subLevel = await prisma.subLevel.create({
          data: {
            name: subLevelData.name,
            order: subLevelData.order,
            subCategoryId: subCategory.id
          }
        });

        for (const questionData of subLevelData.questions) {
          await prisma.question.create({
            data: {
              text: questionData.text,
              type: questionData.type,
              requiresEvidence: questionData.requiresEvidence,
              order: questionData.order,
              options: questionData.options ?? undefined,
              subLevelId: subLevel.id
            }
          });
        }
      }
    }
  }

  console.log('Created survey structure');

  // Get category IDs for recommendations
  const envCategory = await prisma.category.findFirst({ where: { name: 'Environmental Sustainability' } });
  const socialCategory = await prisma.category.findFirst({ where: { name: 'Social Responsibility' } });
  const govCategory = await prisma.category.findFirst({ where: { name: 'Governance & Ethics' } });
  const digitalCategory = await prisma.category.findFirst({ where: { name: 'Digital Transformation' } });

  // Create recommendations
  const recommendations = [
    // Environmental Quick Wins
    { title: 'LED Lighting Retrofit', description: 'Replace traditional lighting with LED alternatives across facilities for immediate energy savings', categoryId: envCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.SHORT_TERM, strategicType: StrategicType.QUICK_WIN, estimatedImpact: 3, order: 1 },
    { title: 'Employee Sustainability Training', description: 'Launch awareness programs to engage employees in daily sustainability practices', categoryId: envCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.SHORT_TERM, strategicType: StrategicType.QUICK_WIN, estimatedImpact: 2, order: 2 },
    { title: 'Waste Segregation Program', description: 'Implement comprehensive waste sorting and recycling across all locations', categoryId: envCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.SHORT_TERM, strategicType: StrategicType.QUICK_WIN, estimatedImpact: 2, order: 3 },
    
    // Environmental Projects
    { title: 'Carbon Accounting Platform', description: 'Deploy enterprise carbon tracking software for Scope 1, 2, and 3 emissions', categoryId: envCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.MEDIUM_TERM, strategicType: StrategicType.PROJECT, estimatedImpact: 5, order: 4 },
    { title: 'Renewable Energy PPA', description: 'Negotiate power purchase agreements for renewable energy sourcing', categoryId: envCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.MEDIUM_TERM, strategicType: StrategicType.PROJECT, estimatedImpact: 8, order: 5 },
    { title: 'Supply Chain Sustainability Audit', description: 'Comprehensive ESG assessment of key suppliers with improvement plans', categoryId: envCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.MEDIUM_TERM, strategicType: StrategicType.PROJECT, estimatedImpact: 4, order: 6 },
    
    // Environmental Big Bets
    { title: 'Net Zero Strategy', description: 'Develop and implement comprehensive net-zero roadmap with science-based targets', categoryId: envCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.LONG_TERM, strategicType: StrategicType.BIG_BET, estimatedImpact: 15, order: 7 },
    { title: 'Circular Economy Transformation', description: 'Redesign products and processes for full circularity', categoryId: envCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.LONG_TERM, strategicType: StrategicType.BIG_BET, estimatedImpact: 12, order: 8 },
    
    // Social Quick Wins
    { title: 'D&I Dashboard', description: 'Create transparency dashboard tracking diversity metrics across organization', categoryId: socialCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.SHORT_TERM, strategicType: StrategicType.QUICK_WIN, estimatedImpact: 2, order: 9 },
    { title: 'Mental Health Resources', description: 'Expand employee assistance programs with mental health support', categoryId: socialCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.SHORT_TERM, strategicType: StrategicType.QUICK_WIN, estimatedImpact: 3, order: 10 },
    
    // Social Projects
    { title: 'Community Investment Program', description: 'Structured program for community grants and volunteering', categoryId: socialCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.MEDIUM_TERM, strategicType: StrategicType.PROJECT, estimatedImpact: 4, order: 11 },
    { title: 'ISO 45001 Certification', description: 'Achieve occupational health and safety management certification', categoryId: socialCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.MEDIUM_TERM, strategicType: StrategicType.PROJECT, estimatedImpact: 5, order: 12 },
    
    // Governance Quick Wins
    { title: 'ESG Policy Updates', description: 'Review and strengthen ESG policies and procedures', categoryId: govCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.SHORT_TERM, strategicType: StrategicType.QUICK_WIN, estimatedImpact: 2, order: 13 },
    { title: 'Ethics Hotline Enhancement', description: 'Upgrade whistleblower channels with anonymous reporting options', categoryId: govCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.SHORT_TERM, strategicType: StrategicType.QUICK_WIN, estimatedImpact: 2, order: 14 },
    
    // Governance Projects
    { title: 'TCFD Reporting Implementation', description: 'Implement Task Force on Climate-related Financial Disclosures framework', categoryId: govCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.MEDIUM_TERM, strategicType: StrategicType.PROJECT, estimatedImpact: 6, order: 15 },
    { title: 'Board ESG Committee', description: 'Establish dedicated board committee for ESG oversight', categoryId: govCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.MEDIUM_TERM, strategicType: StrategicType.PROJECT, estimatedImpact: 4, order: 16 },
    
    // Digital Quick Wins
    { title: 'RPA Pilot Project', description: 'Implement robotic process automation for high-volume repetitive tasks', categoryId: digitalCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.SHORT_TERM, strategicType: StrategicType.QUICK_WIN, estimatedImpact: 3, order: 17 },
    { title: 'Cloud Migration Quick Wins', description: 'Migrate non-critical workloads to cloud for immediate efficiency gains', categoryId: digitalCategory?.id, costType: CostType.OPEX, timeframe: Timeframe.SHORT_TERM, strategicType: StrategicType.QUICK_WIN, estimatedImpact: 2, order: 18 },
    
    // Digital Projects
    { title: 'Data Lake Implementation', description: 'Build centralized data platform for enterprise analytics', categoryId: digitalCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.MEDIUM_TERM, strategicType: StrategicType.PROJECT, estimatedImpact: 7, order: 19 },
    { title: 'ESG Data Integration', description: 'Automate ESG data collection from operational systems', categoryId: digitalCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.MEDIUM_TERM, strategicType: StrategicType.PROJECT, estimatedImpact: 5, order: 20 },
    
    // Digital Big Bets
    { title: 'AI-Powered Sustainability Platform', description: 'Deploy AI/ML for predictive sustainability analytics and optimization', categoryId: digitalCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.LONG_TERM, strategicType: StrategicType.BIG_BET, estimatedImpact: 10, order: 21 },
    { title: 'Digital Twin for Operations', description: 'Create digital twin models for optimizing resource consumption', categoryId: digitalCategory?.id, costType: CostType.CAPEX, timeframe: Timeframe.LONG_TERM, strategicType: StrategicType.BIG_BET, estimatedImpact: 12, order: 22 }
  ];

  for (const recData of recommendations) {
    await prisma.recommendation.create({
      data: recData
    });
  }

  console.log('Created recommendations');

  // ============================================
  // TEST KULLANICISI İÇİN ÖRNEK ANKET CEVAPLARI
  // ============================================
  
  if (testUser) {
    console.log('Creating sample survey responses for test user...');

    // Tüm soruları al (kategori bağımsız)
    const allQuestions = await prisma.question.findMany({
      take: 15, // İlk 15 soruyu cevapla
      include: {
        subLevel: true,
        subCategory: true
      }
    });

    console.log(`Found ${allQuestions.length} questions to answer`);

    // Cevaplar kuruluşun değerlendirmesine bağlı; örnek veri için test
    // kullanıcısının tek kişilik değerlendirmesi kullanılır.
    const sampleSurvey = await prisma.survey.findFirst({ select: { id: true } });
    if (!sampleSurvey) throw new Error("Örnek cevap için anket bulunamadı");
    const sampleAssessmentId = (
      await prisma.assessment.create({
        data: { surveyId: sampleSurvey.id, ownerUserId: testUser.id },
      })
    ).id;

    // Her soru için rastgele bir skor ata (2-5 arası, VELOCITY ve ENDURANCE dengesine dikkat et)
    const surveyResponses = [];
    for (let i = 0; i < allQuestions.length; i++) {
      const question = allQuestions[i];
      
      // Velocity sorularına biraz daha yüksek puan verelim (hız odaklı)
      // Endurance sorularına biraz daha düşük (olgunluk geliştirilmeli)
      let score: number;
      
      if (question.axisType === 'VELOCITY') {
        // Velocity: 3-5 arası (hız yüksek)
        score = Math.floor(Math.random() * 3) + 3; // 3, 4, veya 5
      } else {
        // Endurance: 2-4 arası (olgunluk orta)
        score = Math.floor(Math.random() * 3) + 2; // 2, 3, veya 4
      }

      surveyResponses.push({
        assessmentId: sampleAssessmentId,
        answeredById: testUser.id,
        questionId: question.id,
        score: score,
        value: question.type === 'YES_NO' ? (score >= 3 ? 'evet' : 'hayir') : score.toString(),
        updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Son 7 gün içinde
      });
    }

    // Toplu olarak oluştur
    await prisma.surveyResponse.createMany({
      data: surveyResponses
    });

    console.log(`Created ${surveyResponses.length} sample survey responses`);
    
    // Velocity ve Endurance ortalamaları
    const velocityResponses = surveyResponses.filter(r => {
      const q = allQuestions.find(q => q.id === r.questionId);
      return q?.axisType === 'VELOCITY';
    });
    const enduranceResponses = surveyResponses.filter(r => {
      const q = allQuestions.find(q => q.id === r.questionId);
      return q?.axisType === 'ENDURANCE';
    });
    
    const avgVelocity = velocityResponses.length > 0 
      ? (velocityResponses.reduce((sum, r) => sum + r.score, 0) / velocityResponses.length).toFixed(1)
      : '0';
    const avgEndurance = enduranceResponses.length > 0
      ? (enduranceResponses.reduce((sum, r) => sum + r.score, 0) / enduranceResponses.length).toFixed(1)
      : '0';
    
    console.log(`Average Velocity: ${avgVelocity}/5, Average Endurance: ${avgEndurance}/5`);
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
