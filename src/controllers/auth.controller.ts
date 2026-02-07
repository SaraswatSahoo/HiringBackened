// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import config from '../config/env';
import logger from '../utils/logger';
import { Tokens, TokenPayload } from '../types/models';

const JWT_SECRET: jwt.Secret = config.jwt.secret;
const JWT_EXPIRE: jwt.SignOptions["expiresIn"] = config.jwt.expire as jwt.SignOptions["expiresIn"];

const JWT_REFRESH_SECRET: jwt.Secret = config.jwt.refreshSecret;
const JWT_REFRESH_EXPIRE: jwt.SignOptions["expiresIn"] = config.jwt.refreshExpire as jwt.SignOptions["expiresIn"];

const generateTokens = (userId: string): Tokens => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
  
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRE,
  });
  
  return { accessToken, refreshToken };
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, name, role, phone } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'RECRUITER',
        phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    
    const tokens = generateTokens(user.id);
    
    logger.info(`User registered: ${email}`);
    
    // FIXED: Return tokens in correct structure
    res.status(201).json({
      message: 'User registered successfully',
      user,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }
    });
  } catch (error) {
    next(error);
  }
};


export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    if (!user.isActive) {
      res.status(403).json({ error: 'Account is deactivated' });
      return;
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    const tokens = generateTokens(user.id);
    
    logger.info(`User logged in: ${email}`);
    
    // FIXED: Return tokens in correct structure
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }
    });
  } catch (error) {
    next(error);
  }
};


export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }
    
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid user' });
      return;
    }
    
    const tokens = generateTokens(user.id);
    
    res.json(tokens);
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, phone } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name, phone },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
      },
    });
    
    res.json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const isValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });
    
    logger.info(`Password changed for user: ${user.email}`);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};
