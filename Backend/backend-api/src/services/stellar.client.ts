const StellarSdk = require('@stellar/stellar-sdk');

/**
 * Stellar SDK client service for interacting with the Stellar network
 * Handles keypair generation and balance fetching
 */
export class StellarClient {
  private server: any;
  private networkPassphrase: string;

  constructor(
    horizonUrl: string = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    networkPassphrase: string = process.env.STELLAR_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET
  ) {
    this.server = new StellarSdk.Horizon.Server(horizonUrl);
    this.networkPassphrase = networkPassphrase;
  }

  /**
   * Generate a new Stellar keypair
   * Returns the public key and secret key (secret key should be encrypted before storage)
   */
  generateKeypair(): { publicKey: string; secretKey: string } {
    const keypair = StellarSdk.Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  }

  /**
   * Derive a keypair from a secret key (for future use with encrypted storage)
   */
  deriveKeypairFromSecret(secretKey: string): { publicKey: string; secretKey: string } {
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  }

  /**
   * Validate a Stellar public key
   */
  isValidPublicKey(publicKey: string): boolean {
    try {
      StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate a Stellar secret key
   */
  isValidSecretKey(secretKey: string): boolean {
    try {
      StellarSdk.StrKey.decodeEd25519SecretSeed(secretKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch account balance from Stellar network
   * Returns balance in stroops (1 XLM = 10,000,000 stroops)
   */
  async getBalance(publicKey: string): Promise<{ balance: number; currency: string }> {
    try {
      const account = await this.server.loadAccount(publicKey);
      const xlmBalance = account.balances.find(
        (balance: any) => balance.asset_type === 'native'
      );

      if (!xlmBalance) {
        return { balance: 0, currency: 'XLM' };
      }

      // Balance is returned as a string in XLM, convert to stroops
      const balanceInXlm = parseFloat(xlmBalance.balance);
      const balanceInStroops = Math.floor(balanceInXlm * 10_000_000);

      return { balance: balanceInStroops, currency: 'XLM' };
    } catch (error) {
      // Account might not exist or network error
      throw new Error(`Failed to fetch balance for ${publicKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if account exists on Stellar network
   */
  async accountExists(publicKey: string): Promise<boolean> {
    try {
      await this.server.loadAccount(publicKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fund a testnet account using friendbot (only works on testnet)
   */
  async fundTestnetAccount(publicKey: string): Promise<void> {
    if (this.networkPassphrase !== StellarSdk.Networks.TESTNET) {
      throw new Error('Friendbot only works on testnet');
    }

    try {
      const friendbotUrl = `https://friendbot.stellar.org?addr=${publicKey}`;
      const response = await fetch(friendbotUrl);
      if (!response.ok) {
        throw new Error(`Friendbot request failed: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to fund testnet account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
