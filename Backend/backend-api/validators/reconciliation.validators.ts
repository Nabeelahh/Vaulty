import { body } from 'express-validator';
//validation file
export const reconciliationValidators = {
  create: [
    body('mobile_money_payment_id')
      .isUUID()
      .withMessage('mobile_money_payment_id must be a valid UUID'),
    body('payment_amount')
      .isFloat({ min: 0.01 })
      .withMessage('payment_amount must be a positive number'),
    body('payment_currency')
      .isLength({ min: 3, max: 3 })
      .isUppercase()
      .withMessage('payment_currency must be a 3-letter uppercase ISO code'),
    body('payment_reference')
      .isString()
      .notEmpty()
      .trim()
      .withMessage('payment_reference is required'),
    body('mobile_money_provider')
      .isString()
      .notEmpty()
      .trim()
      .withMessage('mobile_money_provider is required'),
    body('mobile_money_number')
      .isString()
      .notEmpty()
      .trim()
      .withMessage('mobile_money_number is required'),
    body('transaction_id').optional().isString(),
  ],

  resolve: [
    body('resolution_notes')
      .isString()
      .notEmpty()
      .withMessage('resolution_notes is required'),
    body('resolved_by')
      .isUUID()
      .withMessage('resolved_by must be a valid user UUID'),
  ],
};