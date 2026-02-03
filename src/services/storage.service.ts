// src/services/storage.service.ts
import AWS from 'aws-sdk';
import config from '../config/env';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

AWS.config.update({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region,
});

const s3 = new AWS.S3();

class StorageService {
  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    try {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${folder}/${uuidv4()}.${fileExtension}`;
      
      const params: AWS.S3.PutObjectRequest = {
        Bucket: config.aws.s3Bucket,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };
      
      const result = await s3.upload(params).promise();
      
      logger.info(`File uploaded to S3: ${fileName}`);
      
      return result.Location;
    } catch (error) {
      logger.error('S3 upload error:', error);
      throw new Error('File upload failed');
    }
  }
  
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const key = fileUrl.split('.com/')[1];
      
      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: config.aws.s3Bucket,
        Key: key,
      };
      
      await s3.deleteObject(params).promise();
      
      logger.info(`File deleted from S3: ${key}`);
    } catch (error) {
      logger.error('S3 delete error:', error);
      throw new Error('File deletion failed');
    }
  }
  
  async getSignedUrl(fileUrl: string, expiresIn: number = 3600): Promise<string> {
    try {
      const key = fileUrl.split('.com/')[1];
      
      const params = {
        Bucket: config.aws.s3Bucket,
        Key: key,
        Expires: expiresIn,
      };
      
      const signedUrl = await s3.getSignedUrlPromise('getObject', params);
      
      return signedUrl;
    } catch (error) {
      logger.error('S3 signed URL error:', error);
      throw new Error('Failed to generate signed URL');
    }
  }
}

export default new StorageService();
