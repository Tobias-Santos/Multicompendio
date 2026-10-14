// Erros de domínio — traduzidos para códigos HTTP em utils/httpError.ts
export class ValidationError extends Error {}    // 400
export class UnauthorizedError extends Error {}  // 401
export class ForbiddenError extends Error {}     // 403
export class NotFoundError extends Error {}      // 404
export class ConflictError extends Error {}      // 409
