import { Router, Request, Response } from "express";
import { ussdService } from "../services/ussd.service";

const router = Router();

/**
 * POST /api/ussd
 * Africa's Talking USSD Callback
 * Body: { sessionId, serviceCode, phoneNumber, text }
 */
router.post("/", (req: Request, res: Response): void => {
  try {
    const { sessionId, phoneNumber, text } = req.body;

    if (!sessionId || !phoneNumber) {
      res.status(400).send("Invalid request format");
      return;
    }

    const response = ussdService.handleUssdRequest(sessionId, phoneNumber, text || "");

    res.set("Content-Type", "text/plain");
    res.send(response);
    return;
  } catch (error) {
    console.error("USSD Error:", error);
    res.set("Content-Type", "text/plain");
    res.send("END An error occurred. Please try again later.");
    return;
  }
});

export default router;
