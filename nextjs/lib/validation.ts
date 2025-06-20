/**
 * Input Validation Utilities
 * Provides standardized validation functions for API inputs
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validator class for input validation
 */
export class Validator {
  private errors: Record<string, string> = {};
  private data: Record<string, any>;

  /**
   * Create a new validator
   * @param data - The data to validate
   */
  constructor(data: Record<string, any>) {
    this.data = data || {};
  }

  /**
   * Check if a field is required
   * @param field - The field name
   * @param message - Custom error message
   */
  required(field: string, message: string = `${field} is required`): Validator {
    if (this.data[field] === undefined || this.data[field] === null || this.data[field] === '') {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field is a string
   * @param field - The field name
   * @param message - Custom error message
   */
  string(field: string, message: string = `${field} must be a string`): Validator {
    if (this.data[field] !== undefined && typeof this.data[field] !== 'string') {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field is a number
   * @param field - The field name
   * @param message - Custom error message
   */
  number(field: string, message: string = `${field} must be a number`): Validator {
    if (this.data[field] !== undefined && typeof this.data[field] !== 'number') {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field is a boolean
   * @param field - The field name
   * @param message - Custom error message
   */
  boolean(field: string, message: string = `${field} must be a boolean`): Validator {
    if (this.data[field] !== undefined && typeof this.data[field] !== 'boolean') {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field is an array
   * @param field - The field name
   * @param message - Custom error message
   */
  array(field: string, message: string = `${field} must be an array`): Validator {
    if (this.data[field] !== undefined && !Array.isArray(this.data[field])) {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field is an object
   * @param field - The field name
   * @param message - Custom error message
   */
  object(field: string, message: string = `${field} must be an object`): Validator {
    if (
      this.data[field] !== undefined && 
      (typeof this.data[field] !== 'object' || this.data[field] === null || Array.isArray(this.data[field]))
    ) {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field matches a regex pattern
   * @param field - The field name
   * @param pattern - The regex pattern
   * @param message - Custom error message
   */
  matches(field: string, pattern: RegExp, message: string): Validator {
    if (
      this.data[field] !== undefined && 
      typeof this.data[field] === 'string' && 
      !pattern.test(this.data[field])
    ) {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field is an email
   * @param field - The field name
   * @param message - Custom error message
   */
  email(field: string, message: string = `${field} must be a valid email address`): Validator {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return this.matches(field, emailRegex, message);
  }

  /**
   * Check if a field has a minimum length
   * @param field - The field name
   * @param length - The minimum length
   * @param message - Custom error message
   */
  minLength(field: string, length: number, message: string = `${field} must be at least ${length} characters`): Validator {
    if (
      this.data[field] !== undefined && 
      typeof this.data[field] === 'string' && 
      this.data[field].length < length
    ) {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field has a maximum length
   * @param field - The field name
   * @param length - The maximum length
   * @param message - Custom error message
   */
  maxLength(field: string, length: number, message: string = `${field} must be at most ${length} characters`): Validator {
    if (
      this.data[field] !== undefined && 
      typeof this.data[field] === 'string' && 
      this.data[field].length > length
    ) {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field is in a list of allowed values
   * @param field - The field name
   * @param values - The allowed values
   * @param message - Custom error message
   */
  oneOf(field: string, values: any[], message: string = `${field} must be one of: ${values.join(', ')}`): Validator {
    if (
      this.data[field] !== undefined && 
      !values.includes(this.data[field])
    ) {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field is a valid UUID
   * @param field - The field name
   * @param message - Custom error message
   */
  uuid(field: string, message: string = `${field} must be a valid UUID`): Validator {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return this.matches(field, uuidRegex, message);
  }

  /**
   * Check if a field is a valid date
   * @param field - The field name
   * @param message - Custom error message
   */
  date(field: string, message: string = `${field} must be a valid date`): Validator {
    if (
      this.data[field] !== undefined && 
      isNaN(Date.parse(this.data[field]))
    ) {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if a field is a valid URL
   * @param field - The field name
   * @param message - Custom error message
   */
  url(field: string, message: string = `${field} must be a valid URL`): Validator {
    try {
      if (this.data[field] !== undefined) {
        new URL(this.data[field]);
      }
    } catch (e) {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Custom validation function
   * @param field - The field name
   * @param validationFn - Custom validation function
   * @param message - Error message if validation fails
   */
  custom(field: string, validationFn: (value: any) => boolean, message: string): Validator {
    if (
      this.data[field] !== undefined && 
      !validationFn(this.data[field])
    ) {
      this.errors[field] = message;
    }
    return this;
  }

  /**
   * Check if validation passed
   */
  get isValid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  /**
   * Get validation errors
   */
  get validationErrors(): Record<string, string> {
    return this.errors;
  }

  /**
   * Get validation result
   */
  getResult(): ValidationResult {
    return {
      valid: this.isValid,
      errors: this.errors
    };
  }
}

/**
 * Create a new validator
 * @param data - The data to validate
 */
export function validate(data: Record<string, any>): Validator {
  return new Validator(data);
}