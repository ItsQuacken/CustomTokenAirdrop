import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { WalletData, wallets } from "./wallets"; // Update the path accordingly
import * as fs from "fs"; // Import the 'fs' module to write to a file

const tokenMintAddress = new PublicKey("Your token address"); // Updated Fishy token address
const connection = new Connection(
  "https://solemn-soft-lake.solana-mainnet.discover.quiknode.pro/bdfce7826d31d8ec41ed96e962f876fb01aa1e9b/",
  { commitment: "confirmed" }
);

const secret = [];
const senderWallet = Keypair.fromSecretKey(new Uint8Array(secret));

const failedTransfersFile = "failed_transfers.txt"; // File to log failed transfers
const retryDelay = 1000; // Delay in milliseconds before retrying after a rate limit error
const successfulTransfersFile = "successful_transfers.txt"; // File to log successful transfers

async function performTransfers() {
  const failedTransfers: string[] = [];

  for (const walletData of wallets) {
    const receiverPubkey = new PublicKey(walletData.address);
    const amount = walletData.amount;

    try {
      const receiverTokenAccount = await getAssociatedTokenAddress(
        tokenMintAddress,
        receiverPubkey
      );

      if (!receiverTokenAccount) {
        console.error(
          `Token account not found for ${walletData.address}. Creating token account...`
        );
        await createAssociatedTokenAccount(
          connection,
          senderWallet,
          receiverPubkey,
          tokenMintAddress
        );
      }

      const senderTokenAccount = await getAssociatedTokenAddress(
        tokenMintAddress,
        senderWallet.publicKey
      );

      await transfer(
        connection,
        senderWallet,
        senderTokenAccount,
        receiverTokenAccount,
        senderWallet.publicKey,
        amount * 1000000
      );

      console.log(`Transferred ${amount} tokens to ${walletData.address}`);

      // Log successful transfer with amount to the file
      fs.appendFileSync(
        successfulTransfersFile,
        `${walletData.address}: ${amount}\n`
      );
      console.log(`Successful transfer logged to ${successfulTransfersFile}`);
    } catch (error: any) {
      // Specify the 'error' variable type as 'any'
      if (error.message.includes("429")) {
        // Retry after a delay if rate limit error occurs
        console.error(
          `Rate limit exceeded. Retrying after ${retryDelay}ms delay...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        // Retry the same wallet transfer
        continue;
      }

      console.error(`Error performing transfer for ${walletData.address}.`);
      failedTransfers.push(`${walletData.address}: ${amount}`);
    }
  }

  // Write failed transfers to a file
  if (failedTransfers.length > 0) {
    const data = failedTransfers.join("\n");
    fs.writeFileSync(failedTransfersFile, data);
    console.log(`Failed transfers logged to ${failedTransfersFile}`);
  }
}

performTransfers().catch((error) => {
  console.error("Error performing transfers:", error);
});
