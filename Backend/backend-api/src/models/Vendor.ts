export type VendorStatus = "pending" | "approved" | "rejected";

export interface VendorAddress {
  street?: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
}

export interface VendorLocation {
  latitude: number;
  longitude: number;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  businessCategory: string;
  address: VendorAddress;
  location: VendorLocation;
  documents?: string[];
  status: VendorStatus;
  verificationRequestedAt: string;
  verificationCompletedAt?: string;
  verificationNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;

export const isValidEmail = (value: unknown): boolean =>
  typeof value === "string" && emailRegex.test(value.trim());

export const isValidPhone = (value: unknown): boolean =>
  typeof value === "string" && phoneRegex.test(value.trim());

export const validateVendorPayload = (
  payload: any,
  isUpdate = false,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["Payload must be an object"] };
  }

  const {
    name,
    email,
    phone,
    businessName,
    businessCategory,
    address,
    location,
    documents,
  } = payload;

  const requireField = (field: string, value: unknown): void => {
    if (!isUpdate && (value === undefined || value === null || value === "")) {
      errors.push(`${field} is required`);
    }
  };

  requireField("name", name);
  requireField("email", email);
  requireField("phone", phone);
  requireField("businessName", businessName);
  requireField("businessCategory", businessCategory);
  requireField("address", address);
  requireField("location", location);

  if (name !== undefined && typeof name !== "string") {
    errors.push("Name must be a string");
  }

  if (email !== undefined && !isValidEmail(email)) {
    errors.push("A valid email is required");
  }

  if (phone !== undefined && !isValidPhone(phone)) {
    errors.push("A valid phone number is required (7-15 digits, optional leading +)");
  }

  if (businessName !== undefined && typeof businessName !== "string") {
    errors.push("Business name must be a string");
  }

  if (businessCategory !== undefined && typeof businessCategory !== "string") {
    errors.push("Business category must be a string");
  }

  if (address !== undefined) {
    if (typeof address !== "object" || Array.isArray(address) || address === null) {
      errors.push("Address must be an object");
    } else {
      const { city, state, country, street, postalCode } = address;
      if (!isUpdate && (!city || !state || !country)) {
        errors.push("Address city, state, and country are required");
      }
      if (city !== undefined && typeof city !== "string") {
        errors.push("Address city must be a string");
      }
      if (state !== undefined && typeof state !== "string") {
        errors.push("Address state must be a string");
      }
      if (country !== undefined && typeof country !== "string") {
        errors.push("Address country must be a string");
      }
      if (street !== undefined && typeof street !== "string") {
        errors.push("Address street must be a string");
      }
      if (postalCode !== undefined && typeof postalCode !== "string") {
        errors.push("Address postal code must be a string");
      }
    }
  }

  if (location !== undefined) {
    if (typeof location !== "object" || Array.isArray(location) || location === null) {
      errors.push("Location must be an object with latitude and longitude");
    } else {
      const { latitude, longitude } = location;
      if (latitude === undefined || longitude === undefined) {
        if (!isUpdate) {
          errors.push("Location latitude and longitude are required");
        }
      } else {
        if (typeof latitude !== "number" || Number.isNaN(latitude)) {
          errors.push("Location latitude must be a number");
        } else if (latitude < -90 || latitude > 90) {
          errors.push("Location latitude must be between -90 and 90");
        }

        if (typeof longitude !== "number" || Number.isNaN(longitude)) {
          errors.push("Location longitude must be a number");
        } else if (longitude < -180 || longitude > 180) {
          errors.push("Location longitude must be between -180 and 180");
        }
      }
    }
  }

  if (documents !== undefined) {
    if (!Array.isArray(documents) || documents.some((doc) => typeof doc !== "string")) {
      errors.push("Documents must be an array of strings");
    }
  }

  return { valid: errors.length === 0, errors };
};
