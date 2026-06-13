import request from "supertest";
import app from "../index";
import { vendors } from "../routes/vendors";

const clearVendors = (): void => {
  vendors.splice(0, vendors.length);
};

describe("Vendor registry API", () => {
  beforeEach(() => {
    clearVendors();
  });

  test("creates a vendor profile with pending status", async () => {
    const response = await request(app).post("/api/vendors").send({
      name: "Acme Supplies",
      email: "vendor@example.com",
      phone: "+12345678901",
      businessName: "Acme Supplies Ltd",
      businessCategory: "agriculture",
      address: {
        street: "123 Farm Road",
        city: "Lagos",
        state: "Lagos",
        country: "NG",
      },
      location: {
        latitude: 6.5244,
        longitude: 3.3792,
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("pending");
    expect(response.body.data.email).toBe("vendor@example.com");
  });

  test("returns validation errors for invalid vendor payload", async () => {
    const response = await request(app).post("/api/vendors").send({
      name: "",
      email: "bad-email",
      phone: "123",
      businessName: "",
      businessCategory: "",
      address: { city: "", state: "", country: "" },
      location: { latitude: 1000, longitude: -200 },
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  test("gets a vendor by ID and supports location-based search filtering", async () => {
    const create = await request(app).post("/api/vendors").send({
      name: "Agro Vendor",
      email: "agro@example.com",
      phone: "+2348012345678",
      businessName: "Agro Vendor Ltd",
      businessCategory: "produce",
      address: {
        street: "1 Market Street",
        city: "Abuja",
        state: "FCT",
        country: "NG",
      },
      location: { latitude: 9.0765, longitude: 7.3986 },
    });

    const id = create.body.data.id;
    const getById = await request(app).get(`/api/vendors/${id}`);
    expect(getById.status).toBe(200);
    expect(getById.body.data.id).toBe(id);

    const search = await request(app).get("/api/vendors").query({ city: "Abuja" });
    expect(search.status).toBe(200);
    expect(search.body.count).toBe(1);
    expect(search.body.data[0].address.city).toBe("Abuja");
  });

  test("updates an existing vendor profile", async () => {
    const create = await request(app).post("/api/vendors").send({
      name: "Supply Co",
      email: "info@supplyco.com",
      phone: "+2348011111111",
      businessName: "Supply Co",
      businessCategory: "logistics",
      address: {
        street: "10 Trade Lane",
        city: "Ibadan",
        state: "Oyo",
        country: "NG",
      },
      location: { latitude: 7.3775, longitude: 3.9470 },
    });

    const id = create.body.data.id;
    const update = await request(app).put(`/api/vendors/${id}`).send({
      businessCategory: "transport",
      address: { city: "Ibadan", state: "Oyo", country: "NG" },
    });

    expect(update.status).toBe(200);
    expect(update.body.data.businessCategory).toBe("transport");
  });

  test("approves and rejects vendor verification status", async () => {
    const create = await request(app).post("/api/vendors").send({
      name: "Market Vendor",
      email: "market@example.com",
      phone: "+2348098765432",
      businessName: "Market Vendor",
      businessCategory: "retail",
      address: {
        street: "2 Market Row",
        city: "Enugu",
        state: "Enugu",
        country: "NG",
      },
      location: { latitude: 6.5244, longitude: 7.5183 },
    });

    const id = create.body.data.id;
    const approve = await request(app)
      .patch(`/api/vendors/${id}/verification`)
      .send({ action: "approve", notes: "Verified documents" });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("approved");
    expect(approve.body.data.verificationNotes).toBe("Verified documents");

    const rejectFail = await request(app)
      .patch(`/api/vendors/${id}/verification`)
      .send({ action: "reject" });
    expect(rejectFail.status).toBe(200);
    expect(rejectFail.body.data.status).toBe("rejected");
  });

  test("deletes a vendor profile", async () => {
    const create = await request(app).post("/api/vendors").send({
      name: "Delete Vendor",
      email: "delete@example.com",
      phone: "+2348023456789",
      businessName: "Delete Vendor Ltd",
      businessCategory: "services",
      address: {
        street: "33 Remove Rd",
        city: "Kano",
        state: "Kano",
        country: "NG",
      },
      location: { latitude: 12.0022, longitude: 8.5919 },
    });

    const id = create.body.data.id;
    const deleted = await request(app).delete(`/api/vendors/${id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.success).toBe(true);
    expect(deleted.body.data.id).toBe(id);

    const missing = await request(app).get(`/api/vendors/${id}`);
    expect(missing.status).toBe(404);
  });
});
