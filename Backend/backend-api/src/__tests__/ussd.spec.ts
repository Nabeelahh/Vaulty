import request from "supertest";
import app from "../index";
import { ussdService } from "../services/ussd.service";

describe("USSD Service", () => {
  it("should return the main menu for empty text", () => {
    const response = ussdService.handleUssdRequest("sess_123", "+254700000000", "");
    expect(response).toContain("CON Welcome to Arcana");
    expect(response).toContain("1. Check Balance");
  });

  it("should return balance for option 1", () => {
    const response = ussdService.handleUssdRequest("sess_123", "+254700000000", "1");
    expect(response).toContain("END Your Arcana balance is");
  });

  it("should ask for phone number for option 2", () => {
    const response = ussdService.handleUssdRequest("sess_123", "+254700000000", "2");
    expect(response).toContain("CON Enter the recipient's phone number:");
  });

  it("should ask for amount after phone number", () => {
    const response = ussdService.handleUssdRequest("sess_123", "+254700000000", "2*+254711111111");
    expect(response).toContain("CON Enter the amount to send to +254711111111:");
  });

  it("should confirm transaction after amount", () => {
    const response = ussdService.handleUssdRequest("sess_123", "+254700000000", "2*+254711111111*100");
    expect(response).toContain("END You have successfully sent 100 XLM");
  });
});

describe("USSD API Endpoint", () => {
  it("should respond to Africa's Talking POST request", async () => {
    const res = await request(app)
      .post("/api/ussd")
      .send({
        sessionId: "AT_sess_1",
        serviceCode: "*123#",
        phoneNumber: "+254700000000",
        text: ""
      });
    
    expect(res.status).toBe(200);
    expect(res.header["content-type"]).toContain("text/plain");
    expect(res.text).toContain("CON Welcome to Arcana");
  });

  it("should handle nested menu options via API", async () => {
    const res = await request(app)
      .post("/api/ussd")
      .send({
        sessionId: "AT_sess_1",
        serviceCode: "*123#",
        phoneNumber: "+254700000000",
        text: "3*1"
      });
    
    expect(res.status).toBe(200);
    expect(res.text).toContain("END Your Arcana Score is");
  });

  it("should return 400 for invalid body", async () => {
    const res = await request(app)
      .post("/api/ussd")
      .send({
        text: ""
      });
    
    expect(res.status).toBe(400);
  });
});
