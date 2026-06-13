export class UssdService {
  /**
   * Handles the USSD request from Africa's Talking
   * @param sessionId Unique session ID
   * @param phoneNumber User's phone number
   * @param text The accumulated text from the user (e.g., "1*2*100")
   */
  public handleUssdRequest(sessionId: string, phoneNumber: string, text: string): string {
    let response = "";

    if (text === "") {
      // Main Menu
      response = `CON Welcome to Arcana
1. Check Balance
2. Send Money
3. My Profile
4. Exit`;
    } else if (text === "1") {
      // Check Balance
      response = `END Your Arcana balance is 1,250.00 XLM`;
    } else if (text === "2") {
      // Send Money - Step 1: Enter Phone Number
      response = `CON Enter the recipient's phone number:`;
    } else if (text.startsWith("2*")) {
      const parts = text.split("*");
      if (parts.length === 2) {
        // Send Money - Step 2: Enter Amount
        response = `CON Enter the amount to send to ${parts[1]}:`;
      } else if (parts.length === 3) {
        // Send Money - Step 3: Confirmation
        response = `END You have successfully sent ${parts[2]} XLM to ${parts[1]}.
Your transaction ID is: ${Math.random().toString(36).substring(7).toUpperCase()}`;
      }
    } else if (text === "3") {
      // My Profile
      response = `CON My Profile
1. Arcana Score
2. Wallet Address
3. Back`;
    } else if (text === "3*1") {
      response = `END Your Arcana Score is 750 (Excellent!)`;
    } else if (text === "3*2") {
      response = `END Your Wallet: GD...3JK8`;
    } else if (text === "3*3") {
      // Back to main menu
      return this.handleUssdRequest(sessionId, phoneNumber, "");
    } else if (text === "4") {
      response = `END Thank you for using Arcana!`;
    } else {
      response = `END Invalid option. Please try again.`;
    }

    return response;
  }
}

export const ussdService = new UssdService();
