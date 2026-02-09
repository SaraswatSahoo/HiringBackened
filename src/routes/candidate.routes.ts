// src/routes/candidate.routes.ts
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as candidateController from '../controllers/candidate.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new candidate manually
// Create a new candidate manually
router.post(
  '/',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  validateRequest([
    // Basic Information
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .trim(),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .isMobilePhone('any')
      .withMessage('Valid phone number is required'),
    body('alternatePhone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Valid alternate phone number required'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Valid date of birth is required (YYYY-MM-DD)'),
    body('gender')
      .optional()
      .isIn(['Male', 'Female', 'Other', 'Prefer not to say'])
      .withMessage('Invalid gender value'),
    
    // College/Academic Information
    body('college')
      .notEmpty()
      .withMessage('College name is required')
      .trim(),
    body('degree')
      .notEmpty()
      .withMessage('Degree is required')
      .trim(),
    body('branch')
      .optional()
      .trim(),
    body('stream')
      .optional()
      .trim(),
    body('passOutYear')
      .isInt({ min: 2020, max: 2035 })
      .withMessage('Valid pass out year is required (2020-2035)'),
    body('cgpa')
      .optional()
      .isFloat({ min: 0, max: 10 })
      .withMessage('CGPA must be between 0 and 10'),
    body('backlogs')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Backlogs must be a non-negative integer'),
    body('activeBacklogs')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Active backlogs must be a non-negative integer'),
    body('tenthPercentage')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('10th percentage must be between 0 and 100'),
    body('twelfthPercentage')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('12th percentage must be between 0 and 100'),
    
    // Documents
    body('resumeLink')
      .optional()
      .isURL()
      .withMessage('Valid resume link is required'),
    body('photoUrl')
      .optional()
      .isURL()
      .withMessage('Valid photo URL is required'),
    body('idProofUrl')
      .optional()
      .isURL()
      .withMessage('Valid ID proof URL is required'),
    body('marksheetUrls')
      .optional()
      .isArray()
      .withMessage('Marksheet URLs must be an array'),
    body('marksheetUrls.*')
      .optional()
      .isURL()
      .withMessage('Each marksheet URL must be valid'),
    
    // Location
    body('address')
      .optional()
      .trim(),
    body('city')
      .optional()
      .trim(),
    body('state')
      .optional()
      .trim(),
    body('pincode')
      .optional()
      .isPostalCode('any')
      .withMessage('Valid pincode is required'),
    body('country')
      .optional()
      .trim(),
    
    // Skills & Experience
    body('skills')
      .optional()
      .isArray()
      .withMessage('Skills must be an array'),
    body('certifications')
      .optional()
      .isArray()
      .withMessage('Certifications must be an array'),
    body('projects')
      .optional()
      .isArray()
      .withMessage('Projects must be an array'),
    body('internships')
      .optional()
      .isArray()
      .withMessage('Internships must be an array'),
    body('hasWorkExperience')
      .optional()
      .isBoolean()
      .withMessage('hasWorkExperience must be boolean'),
    body('yearsOfExperience')
      .optional()
      .isFloat({ min: 0, max: 50 })
      .withMessage('Years of experience must be between 0 and 50'),
    
    // Application Status
    body('applicationStatus')
      .optional()
      .isIn(['PENDING', 'REVIEWING', 'PROCESSED', 'REJECTED'])
      .withMessage('Invalid application status'),
    body('ineligibilityReason')
      .optional()
      .trim(),
    
    // Assessment Scores
    body('interviewScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Interview score must be between 0 and 100'),
    body('technicalScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Technical score must be between 0 and 100'),
    body('hrScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('HR score must be between 0 and 100'),
    body('overallRating')
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage('Overall rating must be between 0 and 5'),
    
    // Offer Details
    body('offerStatus')
      .optional()
      .isIn(['PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'])
      .withMessage('Invalid offer status'),
    body('offerLetterUrl')
      .optional()
      .isURL()
      .withMessage('Valid offer letter URL is required'),
    body('offeredCTC')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Offered CTC must be positive'),
    body('joiningDate')
      .optional()
      .isISO8601()
      .withMessage('Valid joining date is required (YYYY-MM-DD)'),
    body('hasJoined')
      .optional()
      .isBoolean()
      .withMessage('hasJoined must be boolean'),
    
    // Required Fields
    body('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
  ]),
  candidateController.createCandidate
);


// Get all candidates for a specific JD with enhanced filters
router.get(
  '/jd/:jdId',
  validateRequest([
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    
    // Pagination
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    // Filters
    query('stageId')
      .optional()
      .isUUID()
      .withMessage('Valid stage ID required'),
    query('isEligible')
      .optional()
      .isBoolean()
      .withMessage('isEligible must be boolean'),
    query('applicationStatus')
      .optional()
      .isIn(['PENDING', 'REVIEWING', 'PROCESSED', 'REJECTED'])
      .withMessage('Invalid application status'),
    query('offerStatus')
      .optional()
      .isIn(['PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'])
      .withMessage('Invalid offer status'),
    query('college')
      .optional()
      .trim(),
    query('degree')
      .optional()
      .trim(),
    query('branch')
      .optional()
      .trim(),
    query('stream')
      .optional()
      .trim(),
    query('city')
      .optional()
      .trim(),
    query('state')
      .optional()
      .trim(),
    query('passOutYear')
      .optional()
      .isInt()
      .withMessage('Pass out year must be an integer'),
    query('minCGPA')
      .optional()
      .isFloat({ min: 0, max: 10 })
      .withMessage('Min CGPA must be between 0 and 10'),
    query('maxCGPA')
      .optional()
      .isFloat({ min: 0, max: 10 })
      .withMessage('Max CGPA must be between 0 and 10'),
    query('hasWorkExperience')
      .optional()
      .isBoolean()
      .withMessage('hasWorkExperience must be boolean'),
    query('hasJoined')
      .optional()
      .isBoolean()
      .withMessage('hasJoined must be boolean'),
    query('gender')
      .optional()
      .isIn(['Male', 'Female', 'Other'])
      .withMessage('Invalid gender value'),
    query('skills')
      .optional()
      .trim(),
    query('search')
      .optional()
      .trim(),
    
    // Sorting
    query('sortBy')
      .optional()
      .isIn(['name', 'email', 'college', 'cgpa', 'passOutYear', 'appliedAt', 'lastActivityAt', 'createdAt'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
  ]),
  candidateController.getCandidatesByJD
);

// Get candidates by college
router.get(
  '/jd/:jdId/college/:college',
  validateRequest([
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    param('college')
      .notEmpty()
      .withMessage('College name is required')
      .trim(),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ]),
  candidateController.getCandidatesByCollege
);

// Get eligible candidates for a JD
router.get(
  '/jd/:jdId/eligible',
  validateRequest([
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ]),
  candidateController.getEligibleCandidates
);

// Get candidates with offers
router.get(
  '/jd/:jdId/offers',
  validateRequest([
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    query('status')
      .optional()
      .isIn(['PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'])
      .withMessage('Invalid offer status'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ]),
  candidateController.getCandidatesWithOffers
);

// Get candidates by skills
router.get(
  '/jd/:jdId/skills',
  validateRequest([
    param('jdId')
      .isUUID()
      .withMessage('Valid JD ID is required'),
    query('skills')
      .notEmpty()
      .withMessage('Skills parameter is required')
      .trim(),
    query('matchAll')
      .optional()
      .isBoolean()
      .withMessage('matchAll must be boolean'),
  ]),
  candidateController.getCandidatesBySkills
);

// Get candidate by ID
router.get(
  '/:id',
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
  ]),
  candidateController.getCandidateById
);

// Update candidate
router.put(
  '/:id',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
    
    // All fields optional for update
    body('name').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone('any'),
    body('alternatePhone').optional().isMobilePhone('any'),
    body('dateOfBirth').optional().isISO8601(),
    body('gender').optional().isIn(['Male', 'Female', 'Other', 'Prefer not to say']),
    body('college').optional().trim(),
    body('degree').optional().trim(),
    body('branch').optional().trim(),
    body('stream').optional().trim(),
    body('passOutYear').optional().isInt({ min: 2020, max: 2035 }),
    body('cgpa').optional().isFloat({ min: 0, max: 10 }),
    body('backlogs').optional().isInt({ min: 0 }),
    body('activeBacklogs').optional().isInt({ min: 0 }),
    body('tenthPercentage').optional().isFloat({ min: 0, max: 100 }),
    body('twelfthPercentage').optional().isFloat({ min: 0, max: 100 }),
    body('resumeLink').optional().isURL(),
    body('photoUrl').optional().isURL(),
    body('idProofUrl').optional().isURL(),
    body('marksheetUrls').optional().isArray(),
    body('address').optional().trim(),
    body('city').optional().trim(),
    body('state').optional().trim(),
    body('pincode').optional().isPostalCode('any'),
    body('country').optional().trim(),
    body('skills').optional().isArray(),
    body('certifications').optional().isArray(),
    body('projects').optional().isArray(),
    body('internships').optional().isArray(),
    body('hasWorkExperience').optional().isBoolean(),
    body('yearsOfExperience').optional().isFloat({ min: 0, max: 50 }),
    body('applicationStatus').optional().isIn(['PENDING', 'REVIEWING', 'PROCESSED', 'REJECTED']),
    body('ineligibilityReason').optional().trim(),
    body('interviewScore').optional().isFloat({ min: 0, max: 100 }),
    body('technicalScore').optional().isFloat({ min: 0, max: 100 }),
    body('hrScore').optional().isFloat({ min: 0, max: 100 }),
    body('overallRating').optional().isFloat({ min: 0, max: 5 }),
    body('offerStatus').optional().isIn(['PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']),
    body('offerLetterUrl').optional().isURL(),
    body('offeredCTC').optional().isFloat({ min: 0 }),
    body('joiningDate').optional().isISO8601(),
    body('hasJoined').optional().isBoolean(),
    body('tags').optional().isArray(),
  ]),
  candidateController.updateCandidate
);

// Update offer status
router.patch(
  '/:id/offer-status',
  authorize('ADMIN', 'HR'),
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
    body('offerStatus')
      .isIn(['PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'])
      .withMessage('Invalid offer status'),
    body('offerLetterUrl')
      .optional()
      .isURL()
      .withMessage('Valid offer letter URL is required'),
    body('offeredCTC')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Offered CTC must be positive'),
    body('joiningDate')
      .optional()
      .isISO8601()
      .withMessage('Valid joining date is required'),
  ]),
  candidateController.updateOfferStatus
);

// Update assessment scores
router.patch(
  '/:id/scores',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
    body('interviewScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Interview score must be between 0 and 100'),
    body('technicalScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Technical score must be between 0 and 100'),
    body('hrScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('HR score must be between 0 and 100'),
    body('overallRating')
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage('Overall rating must be between 0 and 5'),
  ]),
  candidateController.updateScores
);

// Delete candidate
router.delete(
  '/:id',
  authorize('ADMIN', 'HR'),
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
  ]),
  candidateController.deleteCandidate
);

// Move candidate to a different stage
router.post(
  '/:id/move-stage',
  authorize('ADMIN', 'HR', 'RECRUITER'),
  validateRequest([
    param('id')
      .isUUID()
      .withMessage('Valid candidate ID is required'),
    body('stageId')
      .isUUID()
      .withMessage('Valid stage ID is required'),
    body('notes')
      .optional()
      .trim(),
    body('interviewDate')
      .optional()
      .isISO8601()
      .withMessage('Valid interview date is required (ISO 8601 format)'),
    body('interviewMode')
      .optional()
      .isIn(['Online', 'Offline', 'Telephonic', 'Video'])
      .withMessage('Invalid interview mode'),
    body('interviewerName')
      .optional()
      .trim(),
  ]),
  candidateController.moveCandidateStage
);

// Bulk move candidates to a stage
router.post(
  '/bulk/move-stage',
  authorize('ADMIN', 'HR'),
  validateRequest([
    body('candidateIds')
      .isArray({ min: 1 })
      .withMessage('At least one candidate ID is required'),
    body('candidateIds.*')
      .isUUID()
      .withMessage('All candidate IDs must be valid UUIDs'),
    body('stageId')
      .isUUID()
      .withMessage('Valid stage ID is required'),
    body('notes')
      .optional()
      .trim(),
  ]),
  candidateController.bulkMoveCandidates
);

// Bulk update offer status
router.post(
  '/bulk/update-offers',
  authorize('ADMIN', 'HR'),
  validateRequest([
    body('candidateIds')
      .isArray({ min: 1 })
      .withMessage('At least one candidate ID is required'),
    body('candidateIds.*')
      .isUUID()
      .withMessage('All candidate IDs must be valid UUIDs'),
    body('offerStatus')
      .isIn(['PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'])
      .withMessage('Invalid offer status'),
  ]),
  candidateController.bulkUpdateOffers
);

export default router;
