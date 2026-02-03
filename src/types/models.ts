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
    HiringType,
    JDStatus,
    CandidateSource,
    StageType,
    CommChannel,
    CommStatus,
    UploadStatus
  } from '@prisma/client';
  
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
    HiringType,
    JDStatus,
    CandidateSource,
    StageType,
    CommChannel,
    CommStatus,
    UploadStatus
  };
  
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
  