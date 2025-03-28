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
import { assert, expect } from "chai";
import {
    bnToBuffer,
    generateRandomU64ID,
    getCurrentTimestamp,
    getDefaultSigner,
    getProgramPDA,
    requestAirdrop,
} from "./helper";
import {
    MAX_POLL_AUTHORIZED_VOTERS,
    MAX_POLL_DESC_CHAR,
    MAX_POLL_OPTION_TITLE_CHAR,
    MIN_POLL_DESC_CHAR,
    MIN_POLL_DURATION,
} from "./constants";
import { VotingProgramAccounts } from "./types";

describe("Voting Program", () => {
    let VotingProgram: Program<Voting>;
    let connection = new web3.Connection("http://localhost:8899");

    let signer = getDefaultSigner();
    setProvider(new AnchorProvider(connection, new Wallet(signer)));
    VotingProgram = workspace.Voting as Program<Voting>;

    before(async () => {
        const signerBalance = await connection.getBalance(signer.publicKey);
        if (signerBalance < LAMPORTS_PER_SOL) {
            await requestAirdrop(connection, signer.publicKey);
        }
    });

    let PREV_INITIALIZED_POLL_ID: BN;

    describe("init_poll() instruction", () => {
        let POLL_ID: BN;
        let POLL_DESCRIPTION: string;
        let POLL_START: BN;
        let POLL_DURATION: BN;
        let IS_POLL_PUBLIC = true;
        let WHITELISTED_VOTERS: PublicKey[] | null;

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

        beforeEach(() => {
            resetPollID();
            resetPollStart();
            resetPollDescription();
            resetPollDuration();
            resetPollIsPublic();
            resetPollWhitelistedVoters();
        });
        const resetPollID = (value: BN = generateRandomU64ID()) => {
            POLL_ID = value;
        };

        const resetPollStart = (value: number = 0) => {
            POLL_START = new BN(value);
        };

        const resetPollDescription = (
            value: string = "Poll::TEST_DESCRIPTION",
        ) => {
            POLL_DESCRIPTION = value;
        };

        const resetPollDuration = (value: number = 86400) => {
            POLL_DURATION = new BN(value);
        };

        const resetPollIsPublic = (value: boolean = true) => {
            IS_POLL_PUBLIC = value;
        };

        const resetPollWhitelistedVoters = (
            value: PublicKey[] | null = null,
        ) => {
            WHITELISTED_VOTERS = value;
        };

        it("should create a poll, provided the init arguments are valid", async () => {
            try {
                const [pollPDA] = getProgramPDA(
                    VotingProgramAccounts.Poll,
                    VotingProgram.programId,
                    POLL_ID,
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

                PREV_INITIALIZED_POLL_ID = POLL_ID;
            } catch (err) {
                throw new Error((err as any).message);
            }
        });

        it("should throw an error if a poll with given ID already exists", async () => {
            try {
                resetPollID(PREV_INITIALIZED_POLL_ID);
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
                    Array(MAX_POLL_AUTHORIZED_VOTERS + 1).fill(
                        PublicKey.unique(),
                    ),
                );
                await initializePollInstruction();
            } catch (err) {
                if (
                    !JSON.stringify(err).includes("WhitelistThresholdOverflow.")
                ) {
                    throw new Error((err as any).message);
                }
            }
        });
    });

    describe("init_poll_option() instruction", () => {
        let PREV_INITIALIZED_POLL_PDA: PublicKey;
        let POLL_OPTION_TITLE: string;
        let POLL_OPTION_DESCRIPTION: string;

        before(() => {
            PREV_INITIALIZED_POLL_PDA = getProgramPDA(
                VotingProgramAccounts.Poll,
                VotingProgram.programId,
                PREV_INITIALIZED_POLL_ID,
            )[0];
        });

        beforeEach(() => {
            resetPollOptionTitle();
            resetPollOptionDescription();
        });

        const resetPollOptionTitle = (value: string = "Option::TITLE") => {
            POLL_OPTION_TITLE = value;
        };

        const resetPollOptionDescription = (
            value: string = "Option::DESCRIPTION",
        ) => {
            POLL_OPTION_DESCRIPTION = value;
        };

        const initializePollOption = async (
            pollId: BN = PREV_INITIALIZED_POLL_ID,
        ): Promise<string> => {
            return await VotingProgram.methods
                .initPollOption(
                    pollId,
                    POLL_OPTION_TITLE,
                    POLL_OPTION_DESCRIPTION,
                )
                .accounts({
                    admin: signer.publicKey,
                    pollAccount: getProgramPDA(
                        VotingProgramAccounts.Poll,
                        VotingProgram.programId,
                        pollId,
                    )[0],
                })
                .signers([signer])
                .rpc({ commitment: "confirmed" });
        };

        it("should initialize a poll option for the given poll ID", async () => {
            const [pollOptionPDA] = getProgramPDA(
                VotingProgramAccounts.PollOption,
                VotingProgram.programId,
                PREV_INITIALIZED_POLL_ID,
                POLL_OPTION_TITLE,
            );

            try {
                const initialPollData =
                    await VotingProgram.account.pollState.fetch(
                        PREV_INITIALIZED_POLL_PDA,
                        "confirmed",
                    );
                await initializePollOption();
                const finalPollData =
                    await VotingProgram.account.pollState.fetch(
                        PREV_INITIALIZED_POLL_PDA,
                        "confirmed",
                    );
                const pollOptionData =
                    await VotingProgram.account.pollOptionState.fetch(
                        pollOptionPDA,
                        "confirmed",
                    );

                assert.isTrue(
                    pollOptionData.id.eq(initialPollData.optionsIndex),
                );
                assert.equal(pollOptionData.title, POLL_OPTION_TITLE);
                assert.equal(
                    pollOptionData.description,
                    POLL_OPTION_DESCRIPTION,
                );
                assert.isTrue(pollOptionData.count.eq(new BN(0)));
                assert.isTrue(
                    finalPollData.optionsIndex.eq(
                        initialPollData.optionsIndex.add(new BN(1)),
                    ),
                );
            } catch (err) {
                throw new Error((err as any).message);
            }
        });

        it("should throw an error if poll with given ID does not exist", async () => {
            const RANDOM_POLL_ID = generateRandomU64ID();
            try {
                await initializePollOption(RANDOM_POLL_ID);
            } catch (err) {
                if (!JSON.stringify(err).includes("AccountNotInitialized")) {
                    throw new Error((err as any).message);
                }
            }
        });

        it("should throw an error if option title is an empty string", async () => {
            resetPollOptionTitle("");
            try {
                await initializePollOption();
            } catch (err) {
                if (!JSON.stringify(err).includes("EmptyOptionTitle")) {
                    throw new Error((err as any).message);
                }
            }
        });

        it("should throw an error if title length exceeds the max length allowed", async () => {
            resetPollOptionTitle("0".repeat(MAX_POLL_OPTION_TITLE_CHAR + 1));
            try {
                await initializePollOption();
            } catch (err) {
                if (!JSON.stringify(err).includes("OptionTitleOverflow")) {
                    throw new Error((err as any).message);
                }
            }
        });

        it("should throw an error if description exceeds the max length allowed", async () => {
            resetPollOptionTitle("Option::NEW");
            resetPollOptionDescription("0".repeat(MAX_POLL_DESC_CHAR + 1));
            try {
                await initializePollOption();
            } catch (err) {
                if (
                    !JSON.stringify(err).includes("OptionDescriptionOverflow")
                ) {
                    throw new Error((err as any).message);
                }
            }
        });
    });
});
