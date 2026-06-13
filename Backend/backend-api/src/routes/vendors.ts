import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { Vendor, validateVendorPayload } from "../models/Vendor";

const router = Router();

const vendors: Vendor[] = [];

const normalizeQueryValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value.trim().toLowerCase() : undefined;

const parseNumberQuery = (value: unknown): number | undefined => {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isNaN(parsed) ? undefined : parsed;
};

const filterBySearch = (vendor: Vendor, query: Record<string, unknown>): boolean => {
  const city = query.city as string | undefined;
  const state = query.state as string | undefined;
  const country = query.country as string | undefined;
  const status = query.status as string | undefined;
  const category = query.businessCategory as string | undefined;
  const minLat = query.minLat as number | undefined;
  const maxLat = query.maxLat as number | undefined;
  const minLng = query.minLng as number | undefined;
  const maxLng = query.maxLng as number | undefined;

  if (status && vendor.status !== status) {
    return false;
  }

  if (city && vendor.address.city.toLowerCase() !== city) {
    return false;
  }

  if (state && vendor.address.state.toLowerCase() !== state) {
    return false;
  }

  if (country && vendor.address.country.toLowerCase() !== country) {
    return false;
  }

  if (category && vendor.businessCategory.toLowerCase() !== category) {
    return false;
  }

  const { latitude, longitude } = vendor.location;

  if (minLat !== undefined && latitude < minLat) {
    return false;
  }

  if (maxLat !== undefined && latitude > maxLat) {
    return false;
  }

  if (minLng !== undefined && longitude < minLng) {
    return false;
  }

  if (maxLng !== undefined && longitude > maxLng) {
    return false;
  }

  return true;
};

/**
 * GET /api/vendors
 * Get vendor list with optional filtering
 */
router.get("/", (req: Request, res: Response): void => {
  const filters = {
    city: normalizeQueryValue(req.query.city),
    state: normalizeQueryValue(req.query.state),
    country: normalizeQueryValue(req.query.country),
    status: normalizeQueryValue(req.query.status),
    businessCategory: normalizeQueryValue(req.query.businessCategory),
    minLat: parseNumberQuery(req.query.minLat),
    maxLat: parseNumberQuery(req.query.maxLat),
    minLng: parseNumberQuery(req.query.minLng),
    maxLng: parseNumberQuery(req.query.maxLng),
  };

  const filtered = vendors.filter((vendor) => filterBySearch(vendor, filters));

  res.json({
    success: true,
    count: filtered.length,
    data: filtered,
  });
});

/**
 * GET /api/vendors/:id
 * Get vendor by ID
 */
router.get("/:id", (req: Request, res: Response): void => {
  const { id } = req.params;
  const vendor = vendors.find((entry) => entry.id === id);

  if (!vendor) {
    res.status(404).json({ success: false, error: "Vendor not found" });
    return;
  }

  res.json({ success: true, data: vendor });
});

/**
 * POST /api/vendors
 * Create a new vendor profile
 */
router.post("/", (req: Request, res: Response): void => {
  const payload = req.body;
  const { valid, errors } = validateVendorPayload(payload);

  if (!valid) {
    res.status(400).json({ success: false, errors });
    return;
  }

  const now = new Date().toISOString();
  const vendor: Vendor = {
    id: uuidv4(),
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone.trim(),
    businessName: payload.businessName.trim(),
    businessCategory: payload.businessCategory.trim(),
    address: {
      street: payload.address.street?.trim(),
      city: payload.address.city.trim(),
      state: payload.address.state.trim(),
      country: payload.address.country.trim(),
      postalCode: payload.address.postalCode?.trim(),
    },
    location: {
      latitude: payload.location.latitude,
      longitude: payload.location.longitude,
    },
    documents: Array.isArray(payload.documents)
      ? payload.documents.map((doc: unknown) => String(doc).trim())
      : undefined,
    status: "pending",
    verificationRequestedAt: now,
    createdAt: now,
  };

  vendors.push(vendor);

  res.status(201).json({
    success: true,
    data: vendor,
    message: "Vendor profile created and pending verification",
  });
});

/**
 * PUT /api/vendors/:id
 * Update vendor profile by ID
 */
router.put("/:id", (req: Request, res: Response): void => {
  const { id } = req.params;
  const payload = req.body;
  const vendorIndex = vendors.findIndex((entry) => entry.id === id);

  if (vendorIndex === -1) {
    res.status(404).json({ success: false, error: "Vendor not found" });
    return;
  }

  const existingVendor = vendors[vendorIndex];
  const updatedVendor = {
    ...existingVendor,
    ...payload,
    address: {
      ...existingVendor.address,
      ...(payload.address || {}),
    },
    location: {
      ...existingVendor.location,
      ...(payload.location || {}),
    },
    documents: payload.documents
      ? Array.isArray(payload.documents)
        ? payload.documents.map((doc: unknown) => String(doc).trim())
        : existingVendor.documents
      : existingVendor.documents,
    email: payload.email
      ? String(payload.email).trim().toLowerCase()
      : existingVendor.email,
    updatedAt: new Date().toISOString(),
  } as Vendor;

  const { valid, errors } = validateVendorPayload(updatedVendor, true);

  if (!valid) {
    res.status(400).json({ success: false, errors });
    return;
  }

  vendors[vendorIndex] = updatedVendor;

  res.json({
    success: true,
    data: updatedVendor,
    message: "Vendor profile updated successfully",
  });
});

/**
 * DELETE /api/vendors/:id
 * Delete vendor by ID
 */
router.delete("/:id", (req: Request, res: Response): void => {
  const { id } = req.params;
  const vendorIndex = vendors.findIndex((entry) => entry.id === id);

  if (vendorIndex === -1) {
    res.status(404).json({ success: false, error: "Vendor not found" });
    return;
  }

  const deleted = vendors.splice(vendorIndex, 1)[0];
  res.json({ success: true, data: deleted, message: "Vendor deleted successfully" });
});

/**
 * PATCH /api/vendors/:id/verification
 * Approve or reject vendor verification
 */
router.patch("/:id/verification", (req: Request, res: Response): void => {
  const { id } = req.params;
  const { action, notes } = req.body as { action?: string; notes?: string };
  const vendorIndex = vendors.findIndex((entry) => entry.id === id);

  if (vendorIndex === -1) {
    res.status(404).json({ success: false, error: "Vendor not found" });
    return;
  }

  if (action !== "approve" && action !== "reject") {
    res.status(400).json({
      success: false,
      error: "Verification action must be 'approve' or 'reject'",
    });
    return;
  }

  vendors[vendorIndex] = {
    ...vendors[vendorIndex],
    status: action === "approve" ? "approved" : "rejected",
    verificationCompletedAt: new Date().toISOString(),
    verificationNotes: notes ? String(notes).trim() : vendors[vendorIndex].verificationNotes,
    updatedAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: vendors[vendorIndex],
    message: `Vendor verification ${action}d successfully`,
  });
});

export { vendors };
export default router;
