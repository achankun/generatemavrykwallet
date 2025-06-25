const { MavrykToolkit } = require('@mavrykdynamics/taquito');
const { InMemorySigner } = require('@mavrykdynamics/taquito-signer');
const { b58cencode, prefix } = require('@mavrykdynamics/taquito-utils');
const bip39 = require('bip39');
const sodium = require('libsodium-wrappers');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to get current timestamp
const getTimestamp = () => new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' });

// Function to append data to a file
const appendToFile = (file, data) => {
  try {
    fs.appendFileSync(file, data + '\n', 'utf8');
  } catch (error) {
    console.error(`[${getTimestamp()}] Error writing to ${file}:`, error.message);
  }
};

// Function to generate a single Mavryk wallet
async function generateSingleWallet() {
  try {
    // Initialize libsodium
    await sodium.ready;

    // Generate a 24-word mnemonic
    const mnemonic = bip39.generateMnemonic(256); // 256 bits for 24 words

    // Derive a seed from the mnemonic
    const seed = bip39.mnemonicToSeedSync(mnemonic).slice(0, 32); // Take first 32 bytes

    // Generate an Ed25519 key pair (Mavryk-compatible)
    const keyPair = sodium.crypto_sign_seed_keypair(seed);

    // Encode private key and public key in base58 with Mavryk prefixes
    const privateKey = b58cencode(keyPair.privateKey, prefix.edsk);
    const publicKey = b58cencode(keyPair.publicKey, prefix.edpk);

    // Initialize the toolkit with a Mavryk RPC node
    const mav = new MavrykToolkit('https://rpc.mavryk.org');

    // Set the signer using the generated private key
    const signer = await InMemorySigner.fromSecretKey(privateKey);
    mav.setSignerProvider(signer);

    // Get the wallet address (public key hash)
    const address = await signer.publicKeyHash();

    // Log wallet details
    console.log(`[${getTimestamp()}] Generated Wallet:`);
    console.log(`Mnemonic: ${mnemonic}`);
    console.log(`Private Key: ${privateKey}`);
    console.log(`Public Key: ${publicKey}`);
    console.log(`Address: ${address}`);

    // Save to files
    appendToFile('phrase.txt', mnemonic);
    appendToFile('privatekey.txt', privateKey);
    appendToFile('address.txt', address);

    return { mnemonic, privateKey, publicKey, address };
  } catch (error) {
    console.error(`[${getTimestamp()}] Error generating wallet:`, error.message);
    throw error;
  }
}

// Function to generate multiple wallets
async function generateWallets(count) {
  console.log(`[${getTimestamp()}] Starting generation of ${count} wallets...`);
  for (let i = 0; i < count; i++) {
    console.log(`[${getTimestamp()}] Generating wallet ${i + 1}/${count}`);
    await generateSingleWallet();
  }
  console.log(`[${getTimestamp()}] Wallet generation complete.`);
}

// Main function to prompt for wallet count and generate wallets
async function main() {
  try {
    // Check for command-line argument
    const args = process.argv.slice(2);
    let walletCount;

    if (args.length > 0 && !isNaN(parseInt(args[0]))) {
      walletCount = parseInt(args[0]);
      if (walletCount <= 0) {
        console.log(`[${getTimestamp()}] Please enter a positive number of wallets.`);
        process.exit(1);
      }
      await generateWallets(walletCount);
      rl.close();
    } else {
      // Prompt for wallet count
      rl.question(`[${getTimestamp()}] How many wallets do you want to generate? `, async (answer) => {
        walletCount = parseInt(answer);
        if (isNaN(walletCount) || walletCount <= 0) {
          console.log(`[${getTimestamp()}] Please enter a valid positive number.`);
          rl.close();
          process.exit(1);
        }
        await generateWallets(walletCount);
        rl.close();
      });
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] Failed to generate wallets:`, error.message);
    rl.close();
    process.exit(1);
  }
}

main();
