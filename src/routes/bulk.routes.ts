import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  }
});

router.use(authenticate);
router.use(authorize("ADMIN", "HR"));

// POST /api/bulk/upload-candidates/:jobDescriptionId
router.post(
  "/upload-candidates/:jobDescriptionId",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const jobDescriptionId = req.params.jobDescriptionId;

      const jd = await prisma.jobDescription.findUnique({
        where: { id: jobDescriptionId }
      });

      if (!jd) {
        return res.status(404).json({ error: "Job description not found" });
      }

      const candidates: any[] = [];
      const errors: any[] = [];
      let rowNumber = 0;

      const stream = Readable.from(req.file.buffer);

      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csv())
          .on("data", (row) => {
            rowNumber++;

            if (!row.name || !row.email || !row.phone) {
              errors.push({
                row: rowNumber,
                error: "Missing required fields (name, email, phone)"
              });
              return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(row.email)) {
              errors.push({
                row: rowNumber,
                error: "Invalid email format"
              });
              return;
            }

            candidates.push({
              name: row.name.trim(),
              email: row.email.trim().toLowerCase(),
              phone: row.phone.trim(),
              college: row.college?.trim() || null,
              degree: row.degree?.trim() || null,
              yearOfPassing: row.yearOfPassing
                ? parseInt(row.yearOfPassing)
                : null,
              experienceYears: row.experienceYears
                ? parseFloat(row.experienceYears)
                : null,
              currentCompany: row.currentCompany?.trim() || null,
              skills: row.skills ? row.skills.split(",").map((s: string) => s.trim()) : [],
              location: row.location?.trim() || null,
              jobDescriptionId
            });
          })
          .on("end", resolve)
          .on("error", reject);
      });

      if (candidates.length === 0) {
        return res.status(400).json({
          error: "No valid candidates found in CSV",
          errors
        });
      }

      const result = await prisma.candidate.createMany({
        data: candidates,
        skipDuplicates: true
      });

      const createdCandidates = await prisma.candidate.findMany({
        where: {
          jobDescriptionId,
          email: { in: candidates.map((c) => c.email) }
        },
        select: { id: true }
      });

      await prisma.candidateHistory.createMany({
        data: createdCandidates.map((c) => ({
          candidateId: c.id,
          toStage: "APPLIED",
          changedById: req!.user!.id
        }))
      });

      res.json({
        message: "Bulk upload completed",
        uploaded: result.count,
        total: candidates.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/bulk/download-template/:hiringType
router.get("/download-template/:hiringType", (req: Request, res: Response) => {
  const { hiringType } = req.params;

  let headers: string;
  if (hiringType === "BULK") {
    headers = "name,email,phone,college,degree,yearOfPassing\n";
  } else {
    headers = "name,email,phone,experienceYears,currentCompany,skills,location\n";
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=candidate-template-${hiringType.toLowerCase()}.csv`
  );
  res.send(headers);
});

// POST /api/bulk/delete-candidates
router.post(
  "/delete-candidates",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { candidateIds } = req.body;

      if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
        return res.status(400).json({
          error: "candidateIds must be a non-empty array"
        });
      }

      const result = await prisma.candidate.deleteMany({
        where: { id: { in: candidateIds as string[] } }
      });

      res.json({
        message: "Candidates deleted successfully",
        count: result.count
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/bulk/export-candidates/:jobDescriptionId
router.get(
  "/export-candidates/:jobDescriptionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stage, college, isEligible } = req.query;
      const jobDescriptionId = req.params.jobDescriptionId;

      const where: any = { jobDescriptionId };
      if (stage) where.stage = stage as CandidateStage;
      if (college) where.college = String(college);
      if (isEligible !== undefined) where.isEligible = isEligible === "true";

      const candidates = await prisma.candidate.findMany({
        where,
        include: {
          jobDescription: {
            select: { title: true }
          }
        }
      });

      const headers =
        'Name,Email,Phone,College,Degree,Year of Passing,Experience,Current Company,Skills,Location,Stage,Eligible\n';
      const rows = candidates
        .map((c) =>
          `"${c.name}","${c.email}","${c.phone}","${
            c.college || ""
          }","${c.degree || ""}","${c.yearOfPassing || ""}","${
            c.experienceYears || ""
          }","${c.currentCompany || ""}","${c.skills.join(", ")}","${
            c.location || ""
          }","${c.stage}","${c.isEligible}"`
        )
        .join("\n");

      const csv = headers + rows;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=candidates-${jobDescriptionId}.csv`
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
