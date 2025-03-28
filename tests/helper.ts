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

export const requestAirdrop = async (
    connection: web3.Connection,
    target: PublicKey,
    amount: number = 10,
): Promise<void> => {
    await connection.requestAirdrop(target, amount * LAMPORTS_PER_SOL);
};

export const generateRandomU64ID = (): BN => {
    return new BN(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
};

export const bnToBuffer = (value: BN): Buffer => {
    return value.toArrayLike(Buffer, "le", 8);
};
