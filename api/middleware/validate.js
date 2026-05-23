import { z } from 'zod';

export const validateBody = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors
      });
    }
    req.validatedBody = result.data;
    next();
  } catch (err) {
    next(err);
  }
};

export const validateQuery = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors
      });
    }
    req.validatedQuery = result.data;
    next();
  } catch (err) {
    next(err);
  }
};
