// src/types/prisma.d.ts
import { Prisma } from "@prisma/client";

declare global {
  type UserRole = Prisma.UserRole;
  type EmploymentType = Prisma.EmploymentType;
  type HiringType = Prisma.HiringType;
  type CandidateStage = Prisma.CandidateStage;
  type InterviewStatus = Prisma.InterviewStatus;
  type CommunicationChannel = Prisma.CommunicationChannel;
  type CommunicationStatus = Prisma.CommunicationStatus;
}

// Export for use in other files
export type {
  UserRole,
  EmploymentType,
  HiringType,
  CandidateStage,
  InterviewStatus,
  CommunicationChannel,
  CommunicationStatus
};
