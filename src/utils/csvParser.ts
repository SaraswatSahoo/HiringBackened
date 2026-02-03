// src/utils/csvParser.ts
import Papa from 'papaparse';
import { CSVRow } from '../types/api';

class CSVParser {
  async parse(fileBuffer: Buffer): Promise<CSVRow[]> {
    return new Promise((resolve, reject) => {
      const csvString = fileBuffer.toString('utf-8');
      
      Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          return header.trim().toLowerCase().replace(/\s+/g, '');
        },
        transform: (value: string) => {
          return value.trim();
        },
        complete: (results) => {
          resolve(results.data as CSVRow[]);
        },
        error: (error: any) => {
          reject(error);
        },
      });
    });
  }
}

export default new CSVParser();
