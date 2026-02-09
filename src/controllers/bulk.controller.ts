// src/controllers/bulk.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import bulkService from '../services/bulk.service';
import csvParser from '../utils/csvParser';

export const bulkUploadCandidates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv',
    ];

    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExt = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (!allowedTypes.includes(file.mimetype) && !allowedExtensions.includes(fileExt)) {
      res.status(400).json({
        error: 'Invalid file type. Only CSV and Excel files are allowed.',
      });
      return;
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      res.status(400).json({
        error: `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`,
      });
      return;
    }

    // Check if JD exists
    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
    });

    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }

    // Check if JD has stages
    if (!jd.stages || jd.stages.length === 0) {
      res.status(400).json({
        error: 'Job Description must have at least one stage configured before uploading candidates',
      });
      return;
    }

    // Quick validate CSV structure
    const validation = await csvParser.quickValidate(file.buffer);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid CSV structure',
        details: validation.errors,
        info: validation.info,
      });
      return;
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      logger.warn('CSV upload warnings:', validation.warnings);
    }

    // Determine file type
    const fileType = fileExt.replace('.', '').toUpperCase();

    // Create bulk upload record
    const bulkUpload = await prisma.bulkUpload.create({
      data: {
        jdId,
        fileName: file.originalname,
        fileSize: file.size,
        fileType,
        uploadedBy: req.user!.id,
        status: 'PROCESSING',
        totalRows: validation.info.rowCount,
      },
    });

    logger.info(`Bulk upload initiated: ${bulkUpload.id} by user: ${req.user!.id}`);

    // Process async (don't await)
    bulkService
      .processBulkUpload(bulkUpload.id, file.buffer, jd)
      .catch((err) => logger.error('Bulk upload processing failed:', err));

    res.status(202).json({
      message: 'Bulk upload initiated successfully',
      uploadId: bulkUpload.id,
      status: 'PROCESSING',
      estimatedRows: validation.info.rowCount,
      warnings: validation.warnings,
    });
  } catch (error) {
    next(error);
  }
};

export const getBulkUploadStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const bulkUpload = await prisma.bulkUpload.findUnique({
      where: { id },
      include: {
        jd: {
          select: {
            id: true,
            title: true,
            department: true,
          },
        },
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!bulkUpload) {
      res.status(404).json({ error: 'Bulk upload not found' });
      return;
    }

    // Calculate progress percentage
    const progress =
      bulkUpload.totalRows > 0
        ? Math.round(
            ((bulkUpload.successCount + bulkUpload.failureCount) / bulkUpload.totalRows) * 100
          )
        : 0;

    res.json({
      upload: {
        id: bulkUpload.id,
        fileName: bulkUpload.fileName,
        fileSize: bulkUpload.fileSize,
        fileType: bulkUpload.fileType,
        status: bulkUpload.status,
        totalRows: bulkUpload.totalRows,
        successCount: bulkUpload.successCount,
        failureCount: bulkUpload.failureCount,
        processedRows: bulkUpload.processedRows,
        progress,
        errorLog: bulkUpload.errorLog,
        errorMessage: bulkUpload.errorMessage,
        retryCount: bulkUpload.retryCount,
        jd: bulkUpload.jd,
        uploadedBy: bulkUpload.uploader,
        createdAt: bulkUpload.createdAt,
        updatedAt: bulkUpload.updatedAt,
        completedAt: bulkUpload.completedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBulkUploadsByJD = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;
    const { page = '1', limit = '20', status } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { jdId };
    if (status) {
      where.status = status;
    }

    const [uploads, total] = await Promise.all([
      prisma.bulkUpload.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.bulkUpload.count({ where }),
    ]);

    res.json({
      uploads,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllBulkUploads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [uploads, total] = await Promise.all([
      prisma.bulkUpload.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          jd: {
            select: {
              id: true,
              title: true,
              department: true,
            },
          },
        },
      }),
      prisma.bulkUpload.count({ where }),
    ]);

    res.json({
      uploads,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markEligibleCandidates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.params;

    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
    });

    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }

    // Get all candidates for this JD
    const candidates = await prisma.candidate.findMany({
      where: { jdId },
    });

    if (candidates.length === 0) {
      res.status(400).json({ error: 'No candidates found for this JD' });
      return;
    }

    let updatedCount = 0;
    let eligibleCount = 0;
    let notEligibleCount = 0;

    // Update eligibility for each candidate
    for (const candidate of candidates) {
      let isEligible = true;
      let ineligibilityReason = '';

      // Check degree eligibility
      if (jd.eligibleDegrees.length > 0 && !jd.eligibleDegrees.includes(candidate.degree)) {
        isEligible = false;
        ineligibilityReason += `Degree '${candidate.degree}' not eligible. `;
      }

      // Check stream eligibility
      if (
        jd.eligibleStreams.length > 0 &&
        candidate.stream &&
        !jd.eligibleStreams.includes(candidate.stream)
      ) {
        isEligible = false;
        ineligibilityReason += `Stream '${candidate.stream}' not eligible. `;
      }

      // Check year eligibility
      if (jd.eligibleYears.length > 0 && !jd.eligibleYears.includes(candidate.passOutYear)) {
        isEligible = false;
        ineligibilityReason += `Pass out year ${candidate.passOutYear} not eligible. `;
      }

      // Check CGPA eligibility
      if (jd.minCGPA && candidate.cgpa) {
        const minCGPA = parseFloat(jd.minCGPA.toString());
        const candidateCGPA = parseFloat(candidate.cgpa.toString());
        if (candidateCGPA < minCGPA) {
          isEligible = false;
          ineligibilityReason += `CGPA ${candidateCGPA} below minimum (${minCGPA}). `;
        }
      }

      // Convert current eligibility to boolean for comparison
      const currentEligibility = candidate.isEligible ?? false;

      // Only update if eligibility status changed
      if (currentEligibility !== isEligible) {
        await prisma.candidate.update({
          where: { id: candidate.id },
          data: {
            isEligible,
            ineligibilityReason: ineligibilityReason.trim() || null,
          },
        });
        updatedCount++;
      }

      // Count eligible vs not eligible
      if (isEligible) {
        eligibleCount++;
      } else {
        notEligibleCount++;
      }
    }

    logger.info(
      `Marked eligibility for ${updatedCount} candidates in JD ${jdId} (${eligibleCount} eligible, ${notEligibleCount} not eligible)`
    );

    // Update dashboard stats
    await bulkService.updateDashboardStats(jdId);

    res.json({
      message: 'Eligibility marking completed',
      totalCandidates: candidates.length,
      updatedCount,
      eligibleCount,
      notEligibleCount,
      criteria: {
        eligibleDegrees: jd.eligibleDegrees,
        eligibleStreams: jd.eligibleStreams,
        eligibleYears: jd.eligibleYears,
        minCGPA: jd.minCGPA?.toString() || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const retryBulkUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const upload = await prisma.bulkUpload.findUnique({
      where: { id },
    });

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    if (upload.status !== 'FAILED' && upload.status !== 'PARTIAL') {
      res.status(400).json({ error: 'Only failed or partial uploads can be retried' });
      return;
    }

    // Update retry count
    await prisma.bulkUpload.update({
      where: { id },
      data: {
        retryCount: upload.retryCount + 1,
      },
    });

    // Retry upload in background
    bulkService.retryUpload(id).catch((err) => logger.error('Retry upload failed:', err));

    logger.info(`Bulk upload retry initiated: ${id} by user: ${req.user!.id} (attempt ${upload.retryCount + 1})`);

    res.json({
      message: 'Upload retry initiated',
      uploadId: id,
      status: 'PROCESSING',
      retryAttempt: upload.retryCount + 1,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBulkUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const upload = await prisma.bulkUpload.findUnique({
      where: { id },
    });

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    // Delete bulk upload record
    await prisma.bulkUpload.delete({
      where: { id },
    });

    logger.info(`Bulk upload deleted: ${id} by user: ${req.user!.id}`);

    res.json({ message: 'Bulk upload deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const downloadErrorLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const upload = await prisma.bulkUpload.findUnique({
      where: { id },
      select: {
        fileName: true,
        errorLog: true,
        errorMessage: true,
        status: true,
      },
    });

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    if (!upload.errorLog) {
      res.status(404).json({ error: 'No error log available' });
      return;
    }

    // Convert error log to CSV
    const errors = upload.errorLog as any[];

    if (errors.length === 0) {
      res.status(404).json({ error: 'Error log is empty' });
      return;
    }

    // Build CSV with proper escaping
    const csvHeader = 'Row Number,Error Message,Candidate Data\n';
    const csvRows = errors
      .map((err) => {
        const dataStr = JSON.stringify(err.data).replace(/"/g, '""');
        const errorStr = err.error.replace(/"/g, '""');
        return `${err.row},"${errorStr}","${dataStr}"`;
      })
      .join('\n');

    const csv = '\uFEFF' + csvHeader + csvRows; // Add BOM for Excel

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="error_log_${id}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

export const downloadSampleCSV = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sampleCSV = csvParser.generateBasicSampleCSV();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="candidate_upload_template.csv"');
    res.send('\uFEFF' + sampleCSV); // Add BOM for Excel compatibility
  } catch (error) {
    next(error);
  }
};

export const downloadExtendedSampleCSV = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sampleCSV = csvParser.generateExtendedSampleCSV();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="candidate_upload_template_extended.csv"'
    );
    res.send('\uFEFF' + sampleCSV); // Add BOM for Excel compatibility
  } catch (error) {
    next(error);
  }
};

export const validateCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jdId } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Check JD exists
    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
    });

    if (!jd) {
      res.status(404).json({ error: 'Job Description not found' });
      return;
    }

    // Parse CSV
    let rows;
    try {
      rows = await csvParser.parse(file.buffer);
    } catch (parseError: any) {
      res.status(400).json({
        error: 'CSV parsing failed',
        details: parseError.message,
      });
      return;
    }

    // Validate CSV data
    const validation = await bulkService.validateCSVData(rows, jd);

    // Generate preview (first 10 valid rows)
    const preview = rows.slice(0, 10).map((row: any, index: number) => ({
      row: index + 2,
      name: row.name,
      email: row.email,
      college: row.college,
      degree: row.degree,
      valid: !validation.errors.find((err) => err.row === index + 2),
    }));

    res.json({
      totalRows: rows.length,
      validRows: validation.validRows,
      invalidRows: validation.invalidRows,
      errors: validation.errors.slice(0, 20), // Return first 20 errors
      preview,
      canUpload: validation.invalidRows === 0,
    });
  } catch (error) {
    next(error);
  }
};
