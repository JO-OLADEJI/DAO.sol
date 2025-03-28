import {
    web3,
    AnchorProvider,
    setProvider,
    Wallet,
    Program,
    workspace,
    BN,
    utils,
} from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { describe, it, before, beforeEach } from "mocha";
import { Voting } from "../target/types/voting";
import { assert } from "chai";
import {
    bnToBuffer,
    generateRandomU64ID,
    getCurrentTimestamp,
    requestAirdrop,
} from "./helper";
import {
    MAX_POLL_AUTHORIZED_VOTERS,
    MIN_POLL_DESC_CHAR,
    MIN_POLL_DURATION,
} from "./constants";

describe("Create Poll", () => {
    let VotingProgram: Program<Voting>;
    let connection = new web3.Connection("http://localhost:8899");

    // -> 42sCiPu4p6bA12xuKCsmoCGffRFcxxNjPd9nbUGLx5tK
    let signer = web3.Keypair.fromSecretKey(
        new Uint8Array([
            134, 187, 107, 218, 184, 103, 224, 208, 239, 235, 253, 97, 162, 250,
            204, 7, 214, 102, 229, 32, 41, 214, 55, 165, 8, 229, 143, 234, 169,
            230, 250, 102, 45, 13, 103, 182, 81, 191, 228, 165, 215, 109, 233,
            248, 171, 36, 148, 234, 66, 144, 139, 109, 39, 190, 182, 25, 240,
            54, 40, 224, 9, 115, 70, 24,
        ]),
    );
    setProvider(new AnchorProvider(connection, new Wallet(signer)));
    VotingProgram = workspace.Voting as Program<Voting>;

    let PREV_POLL_ID: BN;
    let POLL_ID: BN;
    let POLL_DESCRIPTION: string;
    let POLL_START: BN;
    let POLL_DURATION: BN;
    let IS_POLL_PUBLIC = true;
    let WHITELISTED_VOTERS: PublicKey[] | null;

    const resetPollID = (value: BN = generateRandomU64ID()) => {
        POLL_ID = value;
    };

    const resetPollStart = (value: number = 0) => {
        POLL_START = new BN(value);
    };

    const resetPollDescription = (value: string = "Poll::TEST_DESCRIPTION") => {
        POLL_DESCRIPTION = value;
    };

    const resetPollDuration = (value: number = 86400) => {
        POLL_DURATION = new BN(value);
    };

    const resetPollIsPublic = (value: boolean = true) => {
        IS_POLL_PUBLIC = value;
    };

    const resetPollWhitelistedVoters = (value: PublicKey[] | null = null) => {
        WHITELISTED_VOTERS = value;
    };

    const initializePollInstruction = async (): Promise<string> => {
        return await VotingProgram.methods
            .initPoll(
                POLL_ID,
                POLL_DESCRIPTION,
                POLL_START,
                POLL_DURATION,
                IS_POLL_PUBLIC,
                WHITELISTED_VOTERS,
            )
            .accounts({
                admin: signer.publicKey,
            })
            .signers([signer])
            .rpc({ commitment: "confirmed" });
    };

    before(async () => {
        const signerBalance = await connection.getBalance(signer.publicKey);
        if (signerBalance < LAMPORTS_PER_SOL) {
            await requestAirdrop(connection, signer.publicKey);
        }
    });

    beforeEach(() => {
        PREV_POLL_ID = POLL_ID;
        resetPollID();
        resetPollStart();
        resetPollDescription();
        resetPollDuration();
        resetPollIsPublic();
        resetPollWhitelistedVoters();
    });

    it("should create a poll, provided the init arguments are valid", async () => {
        try {
            const [pollPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("poll-account"), bnToBuffer(POLL_ID)],
                VotingProgram.programId,
            );

            await initializePollInstruction();
            const pollData = await VotingProgram.account.pollState.fetch(
                pollPDA,
                "confirmed",
            );

            assert.isTrue(pollData.id.eq(POLL_ID));
            assert.isTrue(pollData.admin.equals(signer.publicKey));
            assert.equal(pollData.description, POLL_DESCRIPTION);
            assert.isTrue(pollData.duration.eq(POLL_DURATION));
            assert.equal(pollData.canPublicVote, IS_POLL_PUBLIC);
            assert.equal(pollData.whitelistedVoters, WHITELISTED_VOTERS);
            assert.isTrue(pollData.optionsIndex.eq(new BN(0)));
            assert.equal(
                pollData.startTime.toNumber(),
                await getCurrentTimestamp(connection),
            );
            console.log("Passing Test");
        } catch (err) {
            throw new Error((err as any).message);
        }
    });

    it("should throw an error if a poll with given ID already exists", async () => {
        try {
            resetPollID(PREV_POLL_ID);
            await initializePollInstruction();
        } catch (err) {
            if (!JSON.stringify(err).includes("already in use")) {
                throw new Error((err as any).message);
            }
        }
    });

    it("should throw an error if start time is earlier than current timestamp", async () => {
        try {
            const currentTimestamp = await getCurrentTimestamp(connection);

            resetPollID();
            resetPollStart(currentTimestamp - 1);
            await initializePollInstruction();
        } catch (err) {
            if (!JSON.stringify(err).includes("StartTimeExpired")) {
                throw new Error((err as any).message);
            }
        }
    });

    it("should throw an error if poll description is less than min allowed characters", async () => {
        try {
            resetPollDescription("0".repeat(MIN_POLL_DESC_CHAR - 1));
            await initializePollInstruction();
        } catch (err) {
            if (!JSON.stringify(err).includes("DescUnderflow")) {
                throw new Error((err as any).message);
            }
        }
    });

    it("should throw an error if poll duration is less than a day", async () => {
        try {
            resetPollDuration(MIN_POLL_DURATION - 1);
            await initializePollInstruction();
        } catch (err) {
            if (!JSON.stringify(err).includes("DurationUnderflow")) {
                throw new Error((err as any).message);
            }
        }
    });

    it("should throw an error if poll is public and whitelisted voters exists", async () => {
        try {
            resetPollWhitelistedVoters([PublicKey.unique()]);
            await initializePollInstruction();
        } catch (err) {
            if (!JSON.stringify(err).includes("PollIsPublic")) {
                throw new Error((err as any).message);
            }
        }
    });

    it("should throw an error is whitelisted voters are more than max allowed private voters", async () => {
        try {
            resetPollIsPublic(false);
            resetPollWhitelistedVoters(
                Array(MAX_POLL_AUTHORIZED_VOTERS + 1).fill(PublicKey.unique()),
            );
            await initializePollInstruction();
        } catch (err) {
            if (!JSON.stringify(err).includes("WhitelistThresholdOverflow.")) {
                throw new Error((err as any).message);
            }
        }
    });
});
