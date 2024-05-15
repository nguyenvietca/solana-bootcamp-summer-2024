import {
    Connection,
    Keypair,
    Transaction,
    clusterApiUrl,
    LAMPORTS_PER_SOL,
    PublicKey,
    sendAndConfirmTransaction,
} from '@solana/web3.js';

import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    createTransferInstruction,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import { Metaplex, bundlrStorage, keypairIdentity, CreateNftInput } from '@metaplex-foundation/js';
import { payer, connection, STATIC_PUBLICKEY,CLUSTER_URL } from "@/lib/vars";
import { explorerURL, printConsoleSeparator } from "@/lib/helpers";
// Cấu hình và các hằng số
//   const connection = new Connection(clusterApiUrl('devnet'));
//   const payer = Keypair.generate();
  const tokenReceiverAddress = new PublicKey('63EEC9FfGyksm7PkVC6z8uAmqozbQcTzbkWJNsgqjkFs');
// const tokenReceiverAddress = STATIC_PUBLICKEY;

// Airdrop SOL để cung cấp phí giao dịch
async function airdropSol() {
    const currentBalance = await connection.getBalance(payer.publicKey);
    console.log("Current balance of 'payer' (in lamports):", currentBalance);
    console.log("Current balance of 'payer' (in SOL):", currentBalance / LAMPORTS_PER_SOL);
    if (currentBalance <= LAMPORTS_PER_SOL) {
        console.log("Low balance, requesting an airdrop...");
        console.log("payer: ", payer);
        console.log("payer.publicKey: ", payer.publicKey);
        await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
    }
    // const airdropSignature = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
    // await connection.confirmTransaction(airdropSignature);
}

// Tạo một token có thể thay thế
async function mintFungibleToken() {
    // Tạo một mint mới
    const mint = await createMint(
        connection,
        payer,
        payer.publicKey,
        payer.publicKey,
        6 // số thập phân
    );

    // Lấy tài khoản token của người trả phí
    const payerTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey
    );

    // Lấy tài khoản token của người nhận
    const receiverTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        tokenReceiverAddress
    );

    // Mint 100 token cho tài khoản của người trả phí
    await mintTo(
        connection,
        payer,
        mint,
        payerTokenAccount.address,
        payer.publicKey,
        100e6 // số lượng, 100 token
    );

    // Mint 10 token cho tài khoản của người nhận
    await mintTo(
        connection,
        payer,
        mint,
        receiverTokenAccount.address,
        payer.publicKey,
        10e6 // số lượng, 10 token
    );

    return { mint, payerTokenAccount, receiverTokenAccount };
}

// Tạo một token không thể thay thế (NFT)
async function mintNFT() {
    printConsoleSeparator("mintNFT created:");
    const metaplex = new Metaplex(connection)
        .use(keypairIdentity(payer))
        .use(bundlrStorage({
            address: 'https://devnet.bundlr.network',
            // providerUrl: clusterApiUrl('devnet'),
            providerUrl: CLUSTER_URL,
            timeout: 60000
        }));

    const { nft, response } = await metaplex.nfts().create({
        uri: 'https://raw.githubusercontent.com/nguyenvietca/solana-bootcamp-summer-2024/main/assets/sbs-token.json',
        name: 'My NFT nvca',
        symbol: 'MNFT nvca',
        sellerFeeBasisPoints: 1000, // 10%
        creators: [{ address: payer.publicKey, share: 100 }],
    });
    console.log(explorerURL({ txSignature: response.signature }));
    return nft;
}

(async () => {
    await airdropSol();

    const { mint, payerTokenAccount, receiverTokenAccount } = await mintFungibleToken();
    console.log('Fungible Token Mint:', mint.toBase58());
    console.log('Payer Token Account:', payerTokenAccount.address.toBase58());
    console.log('Receiver Token Account:', receiverTokenAccount.address.toBase58());

    const nft = await mintNFT();
    console.log('NFT Mint:', nft.address.toBase58());

    // Tạo một giao dịch duy nhất chứa tất cả các lệnh
    const transaction = new Transaction();

    // Thêm tất cả các lệnh cần thiết vào giao dịch
    transaction.add(createTransferInstruction(
        payerTokenAccount.address,
        receiverTokenAccount.address,
        payer.publicKey,
        10e6, // 10 token
        [],
        TOKEN_PROGRAM_ID
    ));

    // Gửi và xác nhận giao dịch
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
    console.log('Transaction completed with Signature:', signature);
    console.log(explorerURL({ txSignature: signature }));
})();
