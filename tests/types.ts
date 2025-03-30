import { BN, web3 } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export interface InitPollParams {
    id: BN;
    description: string;
    startTime: BN;
    duration: BN;
    isPublic: boolean;
    whitelistedVoters: PublicKey[] | null;
    signer: web3.Keypair;
}

export interface InitPollOptionParams {
    pollID: BN;
    title: string;
    description: string;
    signer: web3.Keypair;
}

export interface VoteParams {
    pollID: BN;
    pollOption: PublicKey;
    voter: web3.Keypair;
}
