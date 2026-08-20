// ============================================
// ENUMS - Prisma enum'larını re-export et
// ============================================

// Prisma tarafından oluşturulan enum'ları kullan
export {
  UserRole,
  BenchmarkLevel,
  AxisType,
  CompletionStatus,
  QuestionType,
  CostType,
  Timeframe,
  StrategicType,
  RoadmapStatus
} from '@prisma/client';

// Prisma tiplerini import et
import type {
  UserRole,
  BenchmarkLevel,
  AxisType,
  CompletionStatus,
  QuestionType,
  CostType,
  Timeframe,
  StrategicType,
  RoadmapStatus
} from '@prisma/client';

// ============================================
// BASE INTERFACES - Temel model tipleri
// ============================================

export interface IUser {
  id: string;
  email: string;
  password?: string;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  createdAt: Date;
  updatedAt: Date;
  sectorId: string | null;
  subSectorId: string | null;
  role: UserRole;
  unitId: string | null;
  region: string | null;
  targetDate: Date | null;
  targetVelocity: number | null;
  targetEndurance: number | null;
  currentScoreDate: Date | null;
  emailVerified: boolean;
  isActive: boolean;
}

export interface IUnit {
  id: string;
  name: string;
  description: string | null;
  organization: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISector {
  id: string;
  name: string;
  order: number;
  naicsCode: string | null;
  createdAt: Date;
}

export interface ISubSector {
  id: string;
  name: string;
  sectorId: string;
  order: number;
  createdAt: Date;
}

export interface ISurvey {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory {
  id: string;
  name: string;
  description: string | null;
  order: number;
  surveyId: string | null;
  createdAt: Date;
}

export interface ISubCategory {
  id: string;
  name: string;
  description: string | null;
  order: number;
  categoryId: string;
  hasSubLevels: boolean;
  createdAt: Date;
}

export interface ISubLevel {
  id: string;
  name: string;
  description: string | null;
  order: number;
  subCategoryId: string;
  axisType: AxisType;
  createdAt: Date;
}

export interface IQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: QuestionOption[] | null;
  weight: number;
  requiresEvidence: boolean;
  order: number;
  subLevelId: string | null;
  subCategoryId: string | null;
  axisType: AxisType;
  conditionalOptions: ConditionalOption | null;
  createdAt: Date;
}

export interface ISurveyResponse {
  id: string;
  value: string;
  score: number;
  userId: string;
  questionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocument {
  id: string;
  fileName: string;
  fileType: string;
  cloudStoragePath: string;
  isPublic: boolean;
  userId: string;
  responseId: string | null;
  createdAt: Date;
}

export interface IBenchmark {
  id: string;
  sectorId: string;
  subSectorId: string | null;
  surveyId: string;
  level: BenchmarkLevel;
  targetId: string | null;
  bestScore: number;
  averageScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IIronmanBenchmark {
  id: string;
  sectorId: string;
  subSectorId: string | null;
  velocityAverage: number;
  velocityBest: number;
  velocityAverageTarget: number;
  enduranceAverage: number;
  enduranceBest: number;
  enduranceAverageTarget: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecommendation {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  subCategoryId: string | null;
  subLevelId: string | null;
  questionId: string | null;
  costType: CostType;
  timeframe: Timeframe;
  strategicType: StrategicType;
  estimatedImpact: number;
  minScoreThreshold: number;
  maxScoreThreshold: number;
  capexLevel: number;
  opexLevel: number;
  xPosition: number;
  yPosition: number;
  points: number;
  triggerOptions: string | null;
  videoUrl: string | null;
  order: number;
  createdAt: Date;
}

export interface IRoadmapItem {
  id: string;
  userId: string;
  recommendationId: string;
  priority: number;
  plannedQuarter: number | null;
  plannedYear: number | null;
  status: RoadmapStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IScoreHistory {
  id: string;
  userId: string;
  surveyId: string | null;
  overallScore: number;
  overallPercentage: number;
  velocityScore: number | null;
  enduranceScore: number | null;
  quadrant: string | null;
  completedQuestions: number;
  totalQuestions: number;
  completedRecommendations: number;
  triggerType: string;
  triggerEntityId: string | null;
  recordedAt: Date;
}

// ============================================
// EXTENDED INTERFACES - İlişkiler dahil tipler
// ============================================

export interface IUserWithRelations extends IUser {
  sector?: ISector | null;
  subSector?: ISubSector | null;
  unit?: IUnit | null;
  surveyResponses?: ISurveyResponse[];
  surveyAssignments?: IUserSurveyAssignment[];
}

export interface ISectorWithRelations extends ISector {
  subSectors?: ISubSector[];
  _count?: { users: number };
}

export interface ISurveyWithRelations extends ISurvey {
  categories?: ICategoryWithRelations[];
  _count?: { categories: number };
}

export interface ICategoryWithRelations extends ICategory {
  survey?: ISurvey | null;
  subCategories?: ISubCategoryWithRelations[];
}

export interface ISubCategoryWithRelations extends ISubCategory {
  category?: ICategory;
  subLevels?: ISubLevelWithRelations[];
  questions?: IQuestion[];
}

export interface ISubLevelWithRelations extends ISubLevel {
  subCategory?: ISubCategory;
  questions?: IQuestion[];
}

export interface IQuestionWithRelations extends IQuestion {
  subLevel?: ISubLevel | null;
  subCategory?: ISubCategory | null;
  responses?: ISurveyResponse[];
}

export interface IBenchmarkWithRelations extends IBenchmark {
  sector?: ISector;
  subSector?: ISubSector | null;
  survey?: ISurvey;
}

export interface IRecommendationWithRelations extends IRecommendation {
  subLevel?: ISubLevel | null;
  subCategory?: ISubCategory | null;
  question?: IQuestion | null;
  roadmapItems?: IRoadmapItem[];
}

export interface IRoadmapItemWithRelations extends IRoadmapItem {
  recommendation?: IRecommendation;
  user?: IUser;
}

export interface IUserSurveyAssignment {
  id: string;
  userId: string;
  surveyId: string;
  assignedAt: Date;
  assignedBy: string | null;
  isActive: boolean;
  survey?: ISurvey;
  user?: IUser;
}

// ============================================
// FORM/INPUT TYPES - Form verileri için tipler
// ============================================

export interface QuestionOption {
  value: string;
  label: string;
  score: number;
}

export interface ConditionalOption {
  thresholdQuestion: string;
  yesLabel: string;
  noLabel: string;
  options: ConditionalSubOption[];
}

export interface ConditionalSubOption {
  id: string;
  label: string;
  score: number;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  sectorId?: string;
  subSectorId?: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  organization?: string;
  sectorId?: string;
  subSectorId?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface CreateSurveyInput {
  name: string;
  description?: string;
  isActive?: boolean;
  order?: number;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  surveyId: string;
  order?: number;
}

export interface CreateSubCategoryInput {
  name: string;
  description?: string;
  categoryId: string;
  hasSubLevels?: boolean;
  order?: number;
}

export interface CreateSubLevelInput {
  name: string;
  description?: string;
  subCategoryId: string;
  axisType?: AxisType;
  order?: number;
}

export interface CreateQuestionInput {
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  conditionalOptions?: ConditionalOption;
  weight?: number;
  requiresEvidence?: boolean;
  subLevelId?: string;
  subCategoryId?: string;
  axisType?: AxisType;
  order?: number;
}

export interface CreateBenchmarkInput {
  surveyId: string;
  sectorId: string;
  subSectorId?: string;
  level: BenchmarkLevel;
  targetId?: string;
  bestScore: number;
  averageScore: number;
}

export interface CreateRecommendationInput {
  title: string;
  description: string;
  subLevelId?: string;
  subCategoryId?: string;
  questionId?: string;
  costType?: CostType;
  timeframe?: Timeframe;
  strategicType?: StrategicType;
  estimatedImpact?: number;
  minScoreThreshold?: number;
  maxScoreThreshold?: number;
  capexLevel?: number;
  opexLevel?: number;
  xPosition?: number;
  yPosition?: number;
  points?: number;
  triggerOptions?: string;
  videoUrl?: string;
}

export interface SaveSurveyResponseInput {
  questionId: string;
  value: string;
  documentIds?: string[];
}

// ============================================
// API RESPONSE TYPES - API yanıt tipleri
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// SCORING TYPES - Puanlama sistem tipleri
// ============================================

export interface ScoreResult {
  score: number;
  percentage: number;
  maxScore: number;
  totalWeight: number;
}

export interface CategoryScore {
  categoryId: string;
  categoryName: string;
  score: number;
  percentage: number;
  subCategories: SubCategoryScore[];
}

export interface SubCategoryScore {
  subCategoryId: string;
  subCategoryName: string;
  score: number;
  percentage: number;
  subLevels?: SubLevelScore[];
}

export interface SubLevelScore {
  subLevelId: string;
  subLevelName: string;
  score: number;
  percentage: number;
  axisType: AxisType;
}

export interface UserScoreData {
  overallScore: number;
  overallPercentage: number;
  categories: CategoryScore[];
  velocityScore?: number;
  enduranceScore?: number;
  quadrant?: IronmanQuadrant;
}

// ============================================
// IRONMAN ANALYSIS TYPES
// ============================================

export type IronmanQuadrant = 'IRONMAN' | 'SPRINTER' | 'MARATHON_RUNNER' | 'WALKER';

export interface IronmanData {
  current: {
    velocity: number;
    endurance: number;
    date: string;
    quadrant: IronmanQuadrant;
    quadrantInfo: QuadrantInfo;
  };
  target: {
    velocity: number;
    endurance: number;
    date: string;
  };
  benchmark: {
    current: {
      velocity: number;
      endurance: number;
    };
    target: {
      velocity: number;
      endurance: number;
    };
  };
  company: {
    name: string;
    industry: string;
    region: string;
  };
  stats: {
    totalQuestions: number;
    answeredQuestions: number;
    velocityQuestions: number;
    enduranceQuestions: number;
  };
}

export interface QuadrantInfo {
  title: string;
  titleEn: string;
  description: string;
  color: string;
}

// ============================================
// DASHBOARD TYPES - Dashboard veri tipleri
// ============================================

export interface DashboardData {
  user: IUserWithRelations;
  scores: UserScoreData;
  benchmarks: BenchmarkComparison;
  progress: ProgressData;
  recentActivity: ActivityItem[];
}

export interface BenchmarkComparison {
  overall: {
    userScore: number;
    averageScore: number;
    bestScore: number;
  };
  categories: {
    categoryId: string;
    categoryName: string;
    userScore: number;
    averageScore: number;
    bestScore: number;
  }[];
}

export interface ProgressData {
  totalQuestions: number;
  answeredQuestions: number;
  completionPercentage: number;
  completedRecommendations: number;
  totalRecommendations: number;
}

export interface ActivityItem {
  id: string;
  type: 'survey_response' | 'recommendation_completed' | 'score_change';
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================
// ROADMAP TYPES
// ============================================

export interface RoadmapData {
  items: IRoadmapItemWithRelations[];
  summary: {
    total: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  quarters: QuarterData[];
}

export interface QuarterData {
  quarter: number;
  year: number;
  items: IRoadmapItemWithRelations[];
  totalPoints: number;
}

// ============================================
// EXPORT TYPES - Veri dışa aktarım tipleri
// ============================================

export interface ExportData {
  exportedAt: Date;
  version: string;
  data: {
    users: IUser[];
    sectors: ISectorWithRelations[];
    surveys: ISurveyWithRelations[];
    categories: ICategoryWithRelations[];
    subCategories: ISubCategoryWithRelations[];
    subLevels: ISubLevelWithRelations[];
    questions: IQuestion[];
    recommendations: IRecommendation[];
    benchmarks: IBenchmark[];
    ironmanBenchmarks: IIronmanBenchmark[];
    surveyResponses: ISurveyResponse[];
    roadmapItems: IRoadmapItem[];
    scoreHistory: IScoreHistory[];
  };
}

// ============================================
// UTILITY TYPES
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type Nullable<T> = T | null;

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

// ============================================
// SESSION TYPES - NextAuth oturum tipleri
// ============================================

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  sectorId: string | null;
  subSectorId: string | null;
  organization: string | null;
  unitId: string | null;
  emailVerified?: boolean;
}

// NextAuth modül genişletmeleri
declare module 'next-auth' {
  interface Session {
    user: SessionUser;
  }

  interface User extends SessionUser {}
}

declare module 'next-auth/jwt' {
  interface JWT extends SessionUser {}
}
