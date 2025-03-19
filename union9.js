import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import pkg from "@cosmjs/stargate";
const { SigningStargateClient } = pkg;
import readline from "readline/promises";

const STRIDE_RPC = "https://rpc.stride-internal-1.stride.chain.kitchen/";
const STRIDE_DENOM = "ustrd"; 
const IBC_CHANNEL = "channel-XYZ";
const GAS_LIMIT = 200000;

// Setup readline untuk input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function bridgeToken() {
    const mnemonic = await rl.question("Masukkan mnemonic phrase: ");
    const recipient = await rl.question("Masukkan alamat tujuan di Union Testnet: ");
    const amount = await rl.question("Masukkan jumlah STRD yang ingin di-bridge (per transaksi): ");
    rl.close(); // Tutup input setelah selesai

    // Cek prefix alamat tujuan (Union Testnet biasanya memiliki prefix "union")
    if (!recipient.startsWith("union")) {
        console.error("⚠️ Error: Alamat tujuan harus dimulai dengan 'union'");
        process.exit(1);
    }

    // Membuat wallet dari mnemonic
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "stride" });
    const [account] = await wallet.getAccounts();

    console.log("Alamat Pengirim (Stride):", account.address);

    // Membuat client untuk koneksi ke Stride Testnet
    const client = await SigningStargateClient.connectWithSigner(STRIDE_RPC, wallet);

    // Jumlah iterasi transaksi
    const totalTransactions = 500; 

    for (let i = 1; i <= totalTransactions; i++) {
        console.log(`🔄 Mengirim transaksi ke-${i}...`);

        // Membuat pesan IBC Transfer
        const amountToSend = {
            denom: STRIDE_DENOM,
            amount: (parseFloat(amount) * 1e6).toFixed(0), // Konversi STRD ke uSTRD
        };

        const fee = {
            amount: [{ denom: STRIDE_DENOM, amount: "5000" }], // Biaya transaksi (5000 uSTRD)
            gas: GAS_LIMIT.toString(),
        };

        const timeoutTimestamp = (Date.now() + 5 * 60 * 1000) * 1_000_000; // Timeout dalam 5 menit

        const msg = {
            typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
            value: {
                sourcePort: "transfer",
                sourceChannel: IBC_CHANNEL,
                token: amountToSend,
                sender: account.address,
                receiver: recipient,
                timeoutTimestamp,
            },
        };

        // Menandatangani dan mengirim transaksi
        try {
            const result = await client.signAndBroadcast(account.address, [msg], fee);
            console.log(`✅ Transaksi ke-${i} berhasil dikirim! Hash: ${result.transactionHash}`);
        } catch (error) {
            console.error(`❌ Gagal mengirim transaksi ke-${i}:`, error);
        }

        // Delay 5 detik sebelum transaksi berikutnya untuk menghindari rate limit
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log("🎉 Semua transaksi telah selesai!");
}

bridgeToken().catch(console.error);
