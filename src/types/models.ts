// src/types/models.ts
import { 
  User, 
  JobDescription, 
  Candidate, 
  Stage,
  Feedback,
  Communication,
  Template,
  BulkUpload,
  UserRole,
  JDStatus,
  StageType,
  CommChannel,
  CommStatus,
  UploadStatus
} from '@prisma/client';

// Re-export Prisma types
export type {
  User,
  JobDescription,
  Candidate,
  Stage,
  Feedback,
  Communication,
  Template,
  BulkUpload,
  UserRole,
  JDStatus,
  StageType,
  CommChannel,
  CommStatus,
  UploadStatus
};

// Authentication types
export interface TokenPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string | null;
  createdAt: Date;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: UserRole;
}

export interface CreateCandidateRequest {
  name: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  college: string;
  degree: string;
  branch?: string;
  passOutYear: number;
  cgpa?: number;
  resumeLink?: string;
  jdId: string;
  tags?: string[];
}

export interface CreateJDRequest {
  title: string;
  description: string;
  department: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  openings?: number;
  eligibleDegrees?: string[];
  eligibleYears?: number[];
  minCGPA?: number;
}

export interface UpdateJDRequest {
  title?: string;
  description?: string;
  department?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  openings?: number;
  status?: JDStatus;
}

export interface MoveCandidateStageRequest {
  stageId: string;
  notes?: string;
  interviewDate?: string;
  interviewMode?: string;
  interviewerName?: string;
}

export interface BulkMoveCandidatesRequest {
  candidateIds: string[];
  stageId: string;
  notes?: string;
}

export interface CreateFeedbackRequest {
  candidateId: string;
  rating: number;
  comments: string;
  technicalSkills?: number;
  communication?: number;
  cultureFit?: number;
  problemSolving?: number;
  recommendation?: string;
}

export interface CreateCommunicationRequest {
  jdId: string;
  channel: CommChannel;
  templateId?: string;
  subject?: string;
  message: string;
  candidateIds: string[];
  scheduledAt?: string;
}

// Extended types with relations
export interface CandidateWithRelations extends Candidate {
  currentStage?: Stage;
  jd?: JobDescription;
  feedbacks?: Feedback[];
  stageHistory?: any[];
}

export interface JDWithRelations extends JobDescription {
  createdBy?: User;
  stages?: Stage[];
  candidates?: Candidate[];
  _count?: {
    candidates?: number;
    stages?: number;
  };
}

export interface StageWithCount extends Stage {
  _count: {
    currentCandidates: number;
  };
}

export interface FeedbackWithUser extends Feedback {
  givenBy: {
    id: string;
    name: string;
    email: string;
  };
}

// Filter types
export interface CandidateFilters {
  jdId: string;
  page?: number;
  limit?: number;
  stageId?: string;
  isEligible?: boolean;
  college?: string;
  degree?: string;
  passOutYear?: number;
  search?: string;
}

export interface JDFilters {
  page?: number;
  limit?: number;
  status?: JDStatus;
  department?: string;
  search?: string;
}

// Dashboard types
export interface DashboardSummary {
  totalCandidates: number;
  eligibleCandidates: number;
  shortlisted: number;
  interviewed: number;
  selected: number;
  rejected: number;
  eligibilityRate: string;
  selectionRate: string;
  totalColleges: number;
}

export interface StageStats {
  stageId: string;
  stageName: string;
  stageType: StageType;
  count: number;
  percentage: string;
}

export interface CollegeStats {
  college: string;
  totalApplied: number;
  eligible: number;
  selected: number;
  avgCGPA: string | null;
  selectionRate: string;
}

export interface CGPADistribution {
  distribution: {
    '9.0-10.0': number;
    '8.0-8.9': number;
    '7.0-7.9': number;
    '6.0-6.9': number;
    'Below 6.0': number;
  };
  totalCandidates: number;
  avgCGPA: string | null;
}

export interface DegreeStats {
  degree: string;
  count: number;
  percentage: string;
}

export interface EligibilityStats {
  total: number;
  eligible: number;
  notEligible: number;
  eligibilityRate: string;
  ineligibilityReasons: {
    degree: number;
    year: number;
    cgpa: number;
  };
  criteria: {
    eligibleDegrees: string[];
    eligibleYears: number[];
    minCGPA: string | null;
  };
}
