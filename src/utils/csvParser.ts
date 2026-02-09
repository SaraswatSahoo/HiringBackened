// src/utils/csvParser.ts
import Papa from 'papaparse';
import { CSVRow } from '../types/api';
import logger from './logger';

class CSVParser {
  private readonly REQUIRED_HEADERS = [
    'name',
    'email',
    'phone',
    'college',
    'degree',
    'passoutyear',
  ];

  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_ROWS = 10000; // Maximum rows allowed

  /**
   * Parse CSV buffer into structured data
   * Handles case-insensitive column names and validates structure
   */
  async parse(fileBuffer: Buffer): Promise<CSVRow[]> {
    return new Promise((resolve, reject) => {
      // Check file size
      if (fileBuffer.length > this.MAX_FILE_SIZE) {
        reject(new Error(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`));
        return;
      }

      const csvString = fileBuffer.toString('utf-8');

      // Check for BOM (Byte Order Mark) and remove if present
      const cleanedCSV = csvString.replace(/^\uFEFF/, '');

      Papa.parse(cleanedCSV, {
        header: true,
        skipEmptyLines: 'greedy', // Skip lines that are completely empty
        transformHeader: (header: string) => {
          // Normalize headers: lowercase, remove spaces and special characters
          return header
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '');
        },
        transform: (value: string, field: string) => {
          // Trim whitespace from all values
          const trimmed = value.trim();

          // Handle empty strings
          if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'n/a') {
            return undefined;
          }

          return trimmed;
        },
        complete: (results) => {
          try {
            // Check for parsing errors
            if (results.errors && results.errors.length > 0) {
              const criticalErrors = results.errors.filter(
                (err) => err.type === 'FieldMismatch' || err.type === 'Quotes'
              );

              if (criticalErrors.length > 0) {
                logger.warn('CSV parsing warnings:', results.errors);
              }
            }

            // Validate headers
            const headers = results.meta.fields || [];
            const headerValidation = this.validateHeaders(headers);

            if (!headerValidation.valid) {
              reject(
                new Error(
                  `Missing required columns: ${headerValidation.missing.join(', ')}. ` +
                  `Required columns are: ${this.REQUIRED_HEADERS.join(', ')}`
                )
              );
              return;
            }

            // Check row count
            if (results.data.length === 0) {
              reject(new Error('CSV file is empty or contains no valid data rows'));
              return;
            }

            if (results.data.length > this.MAX_ROWS) {
              reject(
                new Error(
                  `CSV contains ${results.data.length} rows, which exceeds the maximum of ${this.MAX_ROWS} rows`
                )
              );
              return;
            }

            // Filter out completely empty rows
            const validRows = (results.data as CSVRow[]).filter((row) => {
              // Check if row has at least one non-empty value
              return Object.values(row).some((value) => value !== undefined && value !== '');
            });

            if (validRows.length === 0) {
              reject(new Error('CSV file contains no valid data rows'));
              return;
            }

            logger.info(`Successfully parsed CSV: ${validRows.length} rows`);
            resolve(validRows);
          } catch (error: any) {
            logger.error('CSV parsing error:', error);
            reject(new Error(`Failed to process CSV: ${error.message}`));
          }
        },
        error: (error: any) => {
          logger.error('Papa Parse error:', error);
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  }

  /**
   * Validate that required headers are present
   */
  validateHeaders(headers: string[]): { valid: boolean; missing: string[] } {
    const normalizedHeaders = headers.map((h) =>
      h
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')
    );

    const missing = this.REQUIRED_HEADERS.filter(
      (required) => !normalizedHeaders.includes(required)
    );

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Generate sample CSV content for basic template
   */
  generateBasicSampleCSV(): string {
    const headers = [
      'Name',
      'Email',
      'Phone',
      'College',
      'Degree',
      'PassOutYear',
      'Branch',
      'Stream',
      'CGPA',
      'Backlogs',
      'ResumeLink',
    ];

    const sampleRows = [
      [
        'John Doe',
        'john.doe@example.com',
        '9876543210',
        'Indian Institute of Technology, Delhi',
        'B.Tech',
        '2025',
        'Computer Science',
        'Engineering',
        '8.5',
        '0',
        'https://drive.google.com/file/d/xxx/resume.pdf',
      ],
      [
        'Jane Smith',
        'jane.smith@example.com',
        '9876543211',
        'National Institute of Technology, Trichy',
        'B.Tech',
        '2026',
        'Electronics',
        'Engineering',
        '9.2',
        '0',
        'https://drive.google.com/file/d/yyy/resume.pdf',
      ],
    ];

    return [headers.join(','), ...sampleRows.map((row) => this.escapeCSVRow(row))].join('\n');
  }

  /**
   * Generate sample CSV content with all fields (extended template)
   */
  generateExtendedSampleCSV(): string {
    const headers = [
      // Required
      'Name',
      'Email',
      'Phone',
      'College',
      'Degree',
      'PassOutYear',

      // Optional - Contact
      'AlternatePhone',
      'DateOfBirth',
      'Gender',

      // Optional - Academic
      'Branch',
      'Stream',
      'CGPA',
      'Backlogs',
      'ActiveBacklogs',
      'TenthPercentage',
      'TwelfthPercentage',

      // Optional - Documents
      'ResumeLink',
      'PhotoURL',
      'IdProofURL',

      // Optional - Location
      'Address',
      'City',
      'State',
      'Pincode',
      'Country',

      // Optional - Skills & Experience
      'Skills',
      'Certifications',
      'Projects',
      'Internships',
      'HasWorkExperience',
      'YearsOfExperience',
    ];

    const sampleRow = [
      'John Doe',
      'john.doe@example.com',
      '9876543210',
      'Indian Institute of Technology, Delhi',
      'B.Tech',
      '2025',
      '9876543211',
      '2003-01-15',
      'Male',
      'Computer Science',
      'Engineering',
      '8.5',
      '0',
      '0',
      '85.5',
      '90.0',
      'https://drive.google.com/file/d/xxx/resume.pdf',
      'https://drive.google.com/file/d/xxx/photo.jpg',
      'https://drive.google.com/file/d/xxx/id_proof.pdf',
      '123 Main Street, Sector 15',
      'Delhi',
      'Delhi',
      '110001',
      'India',
      'React,Node.js,TypeScript,MongoDB',
      'AWS Certified Developer,Google Cloud Associate',
      'E-commerce Platform,Mobile App Development',
      'Summer Internship at TCS,Winter Internship at Infosys',
      'true',
      '1.5',
    ];

    return [headers.join(','), this.escapeCSVRow(sampleRow)].join('\n');
  }

  /**
   * Escape CSV row values (handle commas, quotes, newlines)
   */
  private escapeCSVRow(row: string[]): string {
    return row
      .map((value) => {
        const stringValue = String(value);
        // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',');
  }

  /**
   * Convert JSON array to CSV string
   */
  jsonToCSV(data: any[], headers?: string[]): string {
    if (data.length === 0) {
      return '';
    }

    const csvHeaders = headers || Object.keys(data[0]);
    const csvRows = data.map((row) =>
      this.escapeCSVRow(csvHeaders.map((header) => row[header] ?? ''))
    );

    return [csvHeaders.join(','), ...csvRows].join('\n');
  }

  /**
   * Detect CSV encoding (UTF-8, UTF-16, etc.)
   */
  detectEncoding(buffer: Buffer): string {
    // Check for BOM
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return 'UTF-8 with BOM';
    }
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      return 'UTF-16 LE';
    }
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      return 'UTF-16 BE';
    }
    return 'UTF-8';
  }

  /**
   * Get file info without parsing
   */
  async getFileInfo(fileBuffer: Buffer): Promise<{
    encoding: string;
    sizeInBytes: number;
    sizeInMB: string;
    estimatedRows: number;
  }> {
    const csvString = fileBuffer.toString('utf-8');
    const lines = csvString.split('\n').filter((line) => line.trim() !== '');

    return {
      encoding: this.detectEncoding(fileBuffer),
      sizeInBytes: fileBuffer.length,
      sizeInMB: (fileBuffer.length / (1024 * 1024)).toFixed(2),
      estimatedRows: Math.max(0, lines.length - 1), // Subtract header
    };
  }

  /**
   * Validate CSV structure without full parsing
   */
  async quickValidate(fileBuffer: Buffer): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    info: {
      rowCount: number;
      columnCount: number;
      headers: string[];
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check file size
      if (fileBuffer.length > this.MAX_FILE_SIZE) {
        errors.push(`File size exceeds ${this.MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
      }

      const csvString = fileBuffer.toString('utf-8');
      const cleanedCSV = csvString.replace(/^\uFEFF/, '');
      const lines = cleanedCSV.split('\n').filter((line) => line.trim() !== '');

      if (lines.length === 0) {
        errors.push('File is empty');
        return { valid: false, errors, warnings, info: { rowCount: 0, columnCount: 0, headers: [] } };
      }

      if (lines.length === 1) {
        errors.push('File contains only headers, no data rows');
      }

      // Parse first line to get headers
      const headerLine = lines[0];
      const headers = headerLine.split(',').map((h) =>
        h
          .trim()
          .toLowerCase()
          .replace(/^"|"$/g, '')
          .replace(/\s+/g, '')
      );

      // Validate required headers
      const headerValidation = this.validateHeaders(headers);
      if (!headerValidation.valid) {
        errors.push(`Missing required columns: ${headerValidation.missing.join(', ')}`);
      }

      // Check row count
      const rowCount = lines.length - 1; // Exclude header
      if (rowCount > this.MAX_ROWS) {
        errors.push(`File contains ${rowCount} rows, exceeds maximum of ${this.MAX_ROWS}`);
      }

      if (rowCount > 5000) {
        warnings.push(`Large file with ${rowCount} rows may take longer to process`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        info: {
          rowCount,
          columnCount: headers.length,
          headers,
        },
      };
    } catch (error: any) {
      errors.push(`Validation failed: ${error.message}`);
      return { valid: false, errors, warnings, info: { rowCount: 0, columnCount: 0, headers: [] } };
    }
  }
}

export default new CSVParser();
