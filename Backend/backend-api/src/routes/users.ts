import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

interface CreateUserBody {
  name: string;
  email: string;
}

interface UpdateUserBody {
  name?: string;
  email?: string;
}

interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
}

// ─── In-memory store ─────────────────────────────────────────────────────────

const users: User[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidName = (name: string): boolean =>
  name.trim().length >= 2 && name.trim().length <= 100;

const sanitizeString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const findUserById = (id: string): { user: User; index: number } | null => {
  const index = users.findIndex((u) => u.id === id);
  return index !== -1 ? { user: users[index], index } : null;
};

const isEmailTaken = (email: string, excludeId?: string): boolean =>
  users.some((u) => u.email === email && u.id !== excludeId);

// ─── Middleware ───────────────────────────────────────────────────────────────

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ─── Routes ──────────────────────────────────────────────────────────────────
// Mock data for users file
const users: any[] = [];

/**
 * GET /api/users
 * Get all users with optional pagination and search
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, search } = req.query as PaginationQuery;

    let result = [...users];

    // Optional search by name or email
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term)
      );
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page ?? "1", 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? "20", 10)));
    const totalCount = result.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const offset = (pageNum - 1) * limitNum;
    const paginated = result.slice(offset, offset + limitNum);

    const response: ApiResponse<User[]> = {
      success: true,
      data: paginated,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const found = findUserById(id);

    if (!found) {
      res.status(404).json(<ApiResponse<null>>{
        success: false,
        error: `User with id '${id}' not found`,
      });
      return;
    }

    res.json(<ApiResponse<User>>{ success: true, data: found.user });
  })
);

/**
 * POST /api/users
 * Create a new user
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateUserBody;
    const name = sanitizeString(body.name);
    const email = sanitizeString(body.email).toLowerCase();

    // Validation
    const errors: string[] = [];
    if (!name) errors.push("Name is required");
    else if (!isValidName(name)) errors.push("Name must be 2–100 characters");

    if (!email) errors.push("Email is required");
    else if (!isValidEmail(email)) errors.push("Email format is invalid");

    if (errors.length > 0) {
      res.status(400).json(<ApiResponse<null>>{
        success: false,
        error: errors.join(". "),
      });
      return;
    }

    if (isEmailTaken(email)) {
      res.status(409).json(<ApiResponse<null>>{
        success: false,
        error: "A user with this email already exists",
      });
      return;
    }

    const user: User = {
      id: uuidv4(),
      name,
      email,
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    res.status(201).json(<ApiResponse<User>>{
      success: true,
      data: user,
      message: "User created successfully",
    });
  })
);

/**
 * PUT /api/users/:id
 * Update user by ID (partial update supported)
 */
router.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as UpdateUserBody;

    const found = findUserById(id);
    if (!found) {
      res.status(404).json(<ApiResponse<null>>{
        success: false,
        error: `User with id '${id}' not found`,
      });
      return;
    }

    const errors: string[] = [];
    let name: string | undefined;
    let email: string | undefined;

    if (body.name !== undefined) {
      name = sanitizeString(body.name);
      if (!isValidName(name)) errors.push("Name must be 2–100 characters");
    }

    if (body.email !== undefined) {
      email = sanitizeString(body.email).toLowerCase();
      if (!isValidEmail(email)) errors.push("Email format is invalid");
      else if (isEmailTaken(email, id))
        errors.push("A user with this email already exists");
    }

    if (errors.length > 0) {
      res.status(400).json(<ApiResponse<null>>{
        success: false,
        error: errors.join(". "),
      });
      return;
    }

    if (name === undefined && email === undefined) {
      res.status(400).json(<ApiResponse<null>>{
        success: false,
        error: "At least one field (name or email) must be provided",
      });
      return;
    }

    const updated: User = {
      ...found.user,
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      updatedAt: new Date().toISOString(),
    };

    users[found.index] = updated;

    res.json(<ApiResponse<User>>{
      success: true,
      data: updated,
      message: "User updated successfully",
    });
  })
);

/**
 * DELETE /api/users/:id
 * Delete user by ID
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const found = findUserById(id);

    if (!found) {
      res.status(404).json(<ApiResponse<null>>{
        success: false,
        error: `User with id '${id}' not found`,
      });
      return;
    }

    users.splice(found.index, 1);

    res.json(<ApiResponse<User>>{
      success: true,
      data: found.user,
      message: "User deleted successfully",
    });
  })
);

// ─── Global error handler for this router ────────────────────────────────────

router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[UserRouter Error] ${err.message}`, err.stack);
  res.status(500).json(<ApiResponse<null>>{
    success: false,
    error: "An unexpected error occurred",
  });
});

export default router;