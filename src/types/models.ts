export interface JD {
  id: string;
  title: string;
  description: string;
  department: string;
  location?: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
  
  // Compensation
  salaryMin?: number;
  salaryMax?: number;
  openings: number;
  
  // Eligibility
  eligibleDegrees: string[];
  eligibleStreams: string[];
  eligibleYears: number[];
  minCGPA?: number;
  
  // Additional
  responsibilities?: string;
  skills: string[];
  employmentType?: string;
  experienceLevel?: string;
  workMode?: string;
  
  // Meta
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  
  // Counts
  _count?: {
    candidates: number;
    stages: number;
  };
}

export interface CreateJDData {
  title: string;
  description: string;
  department: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  openings?: number;
  eligibleDegrees?: string[];
  eligibleStreams?: string[];
  eligibleYears?: number[];
  minCGPA?: number;
  responsibilities?: string;
  skills?: string[];
  employmentType?: string;
  experienceLevel?: string;
  workMode?: string;
}

export interface UpdateJDData extends Partial<CreateJDData> {
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
}

export interface JDFilters {
  status?: string;
  department?: string;
  location?: string;
  workMode?: string;
  search?: string;
  page?: number;
  limit?: number;
}
