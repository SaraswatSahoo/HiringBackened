import { UserRole } from "./prisma";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      isActive: boolean;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
