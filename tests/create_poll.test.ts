import {
    web3,
    AnchorProvider,
    setProvider,
    Wallet,
    Program,
    workspace,
    BN,
} from "@coral-xyz/anchor";
import { describe, it } from "node:test";
import { Voting } from "../target/types/voting";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
// import { expect } from "chai";

const generateRandomU64ID = (): BN => {
    return new BN(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
};

describe("Create Poll", () => {
    let VotingProgram: Program<Voting>;

    let signer = web3.Keypair.fromSecretKey(
        new Uint8Array([
            134, 187, 107, 218, 184, 103, 224, 208, 239, 235, 253, 97, 162, 250,
            204, 7, 214, 102, 229, 32, 41, 214, 55, 165, 8, 229, 143, 234, 169,
            230, 250, 102, 45, 13, 103, 182, 81, 191, 228, 165, 215, 109, 233,
            248, 171, 36, 148, 234, 66, 144, 139, 109, 39, 190, 182, 25, 240,
            54, 40, 224, 9, 115, 70, 24,
        ]),
    );
    let connection = new web3.Connection("http://localhost:8899");
    setProvider(new AnchorProvider(connection, new Wallet(signer)));

    VotingProgram = workspace.Voting as Program<Voting>;

    it("should create a poll, provided the init arguments are valid", async () => {
        const pollId = generateRandomU64ID();
        console.log({ pollId });

        try {
            const tx = await VotingProgram.methods
                .initPoll(
                    pollId,
                    "Poll::TEST",
                    new BN(0),
                    new BN(1000),
                    true,
                    null,
                )
                .accounts({
                    admin: signer.publicKey,
                })
                .signers([signer])
                .rpc();

            console.log({ tx });
        } catch (err) {
            console.error(err);
        }
    });
});
