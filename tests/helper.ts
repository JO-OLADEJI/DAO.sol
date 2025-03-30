import { web3, BN } from "@coral-xyz/anchor";
import {
    PublicKey,
    SYSVAR_CLOCK_PUBKEY,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export const getCurrentTimestamp = async (
    connection: web3.Connection,
): Promise<number> => {
    const clock = await connection.getAccountInfo(
        SYSVAR_CLOCK_PUBKEY,
        "confirmed",
    );
    return clock
        ? new BN(clock.data.slice(32, 39), undefined, "le").toNumber()
        : 0;
};

export const getDefaultSigner = (): web3.Keypair => {
    const signer = web3.Keypair.generate();
    console.log({ defaultSigner: signer.publicKey.toString() });

    return signer;
};

export const getPollPDA = (pollId: BN, programId: PublicKey) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("poll-account"), bnToBuffer(pollId)],
        programId,
    );
};

export const getPollOptionPDA = (
    pollId: BN,
    pollOptionName: string,
    programId: PublicKey,
) => {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("poll-option-account"),
            Buffer.from(pollOptionName!),
            bnToBuffer(pollId),
        ],
        programId,
    );
};

export const getPollVotePDA = (
    pollId: BN,
    voter: PublicKey,
    programId: PublicKey,
) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vote-account"), bnToBuffer(pollId), voter.toBuffer()],
        programId,
    );
};

export const requestAirdrop = async (
    connection: web3.Connection,
    target: PublicKey,
    amount: number = 10,
): Promise<void> => {
    const signature = await connection.requestAirdrop(
        target,
        amount * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(signature, "confirmed");
};

export const generateRandomU64ID = (): BN => {
    return new BN(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
};

export const bnToBuffer = (value: BN): Buffer => {
    return value.toArrayLike(Buffer, "le", 8);
};
