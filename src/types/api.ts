// src/types/api.ts

/**
 * CSV row structure for bulk candidate upload
 * Used when parsing CSV files for bulk candidate import
 * 
 * Column names in CSV should match these field names (case-insensitive)
 * Required fields: name, email, phone, college, degree, passoutyear
 */
export interface CSVRow {
  // ============ REQUIRED FIELDS ============
  name: string;
  email: string;
  phone: string;
  college: string;
  degree: string;
  passoutyear: string | number;
  
  // ============ OPTIONAL - CONTACT ============
  alternatephone?: string;
  dateofbirth?: string; // Format: YYYY-MM-DD or DD/MM/YYYY
  gender?: string; // Male, Female, Other, Prefer not to say
  
  // ============ OPTIONAL - ACADEMIC ============
  branch?: string;
  stream?: string;
  cgpa?: string | number; // 0-10 scale
  backlogs?: string | number;
  activebacklogs?: string | number;
  tenthpercentage?: string | number; // 0-100
  twelfthpercentage?: string | number; // 0-100
  
  // ============ OPTIONAL - DOCUMENTS ============
  resumelink?: string;
  photourl?: string;
  idproofurl?: string;
  
  // ============ OPTIONAL - LOCATION ============
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  
  // ============ OPTIONAL - SKILLS & EXPERIENCE ============
  // Note: For comma-separated values, use format: "React,Node.js,TypeScript"
  skills?: string; // Comma-separated list
  certifications?: string; // Comma-separated list
  projects?: string; // Comma-separated list
  internships?: string; // Comma-separated list
  hasworkexperience?: string | boolean; // true/false or "true"/"false"
  yearsofexperience?: string | number; // Decimal value like 1.5
}

/**
 * Error structure for tracking bulk upload failures
 * Stored in BulkUpload.errorLog as JSON
 */
export interface BulkUploadError {
  row: number; // Row number in CSV (starts from 2, as row 1 is header)
  error: string; // Error message describing what went wrong
  data: CSVRow; // The actual row data that failed
}

/**
 * College performance analytics
 * Used by analytics service to track college-wise statistics
 */
export interface CollegePerformance {
  collegeName: string;
  totalApplied: number;
  totalEligible: number;
  totalShortlisted: number;
  totalSelected: number;
  avgCGPA: string | null;
  selectionRate?: string; // Percentage of selected/applied
}

/**
 * CSV validation result
 * Returned when validating CSV before upload
 */
export interface CSVValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: BulkUploadError[];
  preview: Array<{
    row: number;
    name: string;
    email: string;
    college: string;
    valid: boolean;
  }>;
  canUpload: boolean;
}

/**
 * Sample CSV template structure
 * Used to generate downloadable templates
 */
export interface SampleCSVTemplate {
  basic: string[]; // Basic required fields
  extended: string[]; // All fields including optional ones
}
