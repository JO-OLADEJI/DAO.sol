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
    generateRandomU64ID,
    getCurrentTimestamp,
    getDefaultSigner,
    getPollOptionPDA,
    getPollPDA,
    getPollVotePDA,
    requestAirdrop,
} from "./helper";
import {
    MAX_POLL_AUTHORIZED_VOTERS,
    MAX_POLL_DESC_CHAR,
    MAX_POLL_OPTION_TITLE_CHAR,
    MIN_POLL_DESC_CHAR,
    MIN_POLL_DURATION,
} from "./constants";
import { InitPollParams, InitPollOptionParams, VoteParams } from "./types";

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

    let LATEST_INITIALIZED_POLL_ID: BN;
    let LATEST_POLL_OPTION_PDA: PublicKey;

    const initializePoll = async (params: InitPollParams): Promise<string> => {
        return await VotingProgram.methods
            .initPoll(
                params.id,
                params.description,
                params.startTime,
                params.duration,
                params.isPublic,
                params.whitelistedVoters,
            )
            .accounts({
                admin: params.signer.publicKey,
            })
            .signers([params.signer])
            .rpc({ commitment: "confirmed" });
    };

    const initializePollOption = async (
        params: InitPollOptionParams,
    ): Promise<string> => {
        return await VotingProgram.methods
            .initPollOption(params.pollID, params.title, params.description)
            .accounts({
                admin: params.signer.publicKey,
                pollAccount: getPollPDA(
                    params.pollID,
                    VotingProgram.programId,
                )[0],
            })
            .signers([params.signer])
            .rpc({ commitment: "confirmed" });
    };

    const voteOnPoll = async (params: VoteParams): Promise<string> => {
        return await VotingProgram.methods
            .vote(params.pollID)
            .accounts({
                voter: params.voter.publicKey,
                pollAccount: getPollPDA(
                    params.pollID,
                    VotingProgram.programId,
                )[0],
                pollOptionAccount: params.pollOption,
            })
            .signers([params.voter])
            .rpc({ commitment: "confirmed" });
    };

    describe("init_poll() instruction", () => {
        let POLL_ID: BN;
        let POLL_DESCRIPTION: string;
        let POLL_START: BN;
        let POLL_DURATION: BN;
        let IS_POLL_PUBLIC = true;
        let WHITELISTED_VOTERS: PublicKey[] | null;

        const getCollatedParams = (): InitPollParams => {
            return {
                id: POLL_ID,
                description: POLL_DESCRIPTION,
                startTime: POLL_START,
                duration: POLL_DURATION,
                isPublic: IS_POLL_PUBLIC,
                whitelistedVoters: WHITELISTED_VOTERS,
                signer: signer,
            };
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
                const [pollPDA] = getPollPDA(POLL_ID, VotingProgram.programId);

                await initializePoll(getCollatedParams());
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

                LATEST_INITIALIZED_POLL_ID = POLL_ID;
            } catch (err) {
                throw new Error(JSON.stringify(err));
            }
        });

        it("should throw an error if a poll with given ID already exists", async () => {
            try {
                resetPollID(LATEST_INITIALIZED_POLL_ID);
                await initializePoll(getCollatedParams());
            } catch (err) {
                if (!JSON.stringify(err).includes("already in use")) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });

        it("should throw an error if start time is earlier than current timestamp", async () => {
            try {
                const currentTimestamp = await getCurrentTimestamp(connection);

                resetPollID();
                resetPollStart(currentTimestamp - 1);
                await initializePoll(getCollatedParams());
            } catch (err) {
                if (!JSON.stringify(err).includes("StartTimeExpired")) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });

        it("should throw an error if poll description is less than min allowed characters", async () => {
            try {
                resetPollDescription("0".repeat(MIN_POLL_DESC_CHAR - 1));
                await initializePoll(getCollatedParams());
            } catch (err) {
                if (!JSON.stringify(err).includes("DescUnderflow")) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });

        it("should throw an error if poll duration is less than a day", async () => {
            try {
                resetPollDuration(MIN_POLL_DURATION - 1);
                await initializePoll(getCollatedParams());
            } catch (err) {
                if (!JSON.stringify(err).includes("DurationUnderflow")) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });

        it("should throw an error if poll is public and whitelisted voters exists", async () => {
            try {
                resetPollWhitelistedVoters([PublicKey.unique()]);
                await initializePoll(getCollatedParams());
            } catch (err) {
                if (!JSON.stringify(err).includes("PollIsPublic")) {
                    throw new Error(JSON.stringify(err));
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
                await initializePoll(getCollatedParams());
            } catch (err) {
                if (
                    !JSON.stringify(err).includes("WhitelistThresholdOverflow.")
                ) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });
    });

    describe("init_poll_option() instruction", () => {
        let PREV_INITIALIZED_POLL_PDA: PublicKey;
        let POLL_OPTION_TITLE: string;
        let POLL_OPTION_DESCRIPTION: string;

        const getCollatedParams = (): InitPollOptionParams => {
            return {
                pollID: LATEST_INITIALIZED_POLL_ID,
                title: POLL_OPTION_TITLE,
                description: POLL_OPTION_DESCRIPTION,
                signer: signer,
            };
        };

        before(() => {
            PREV_INITIALIZED_POLL_PDA = getPollPDA(
                LATEST_INITIALIZED_POLL_ID,
                VotingProgram.programId,
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

        it("should initialize a poll option for the given poll ID", async () => {
            const [pollOptionPDA] = getPollOptionPDA(
                LATEST_INITIALIZED_POLL_ID,
                POLL_OPTION_TITLE,
                VotingProgram.programId,
            );

            try {
                const initialPollData =
                    await VotingProgram.account.pollState.fetch(
                        PREV_INITIALIZED_POLL_PDA,
                        "confirmed",
                    );
                await initializePollOption(getCollatedParams());
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

                LATEST_POLL_OPTION_PDA = pollOptionPDA;
            } catch (err) {
                throw new Error(JSON.stringify(err));
            }
        });

        it("should throw an error if poll with given ID does not exist", async () => {
            const params = getCollatedParams();
            params.pollID = generateRandomU64ID();

            try {
                await initializePollOption(params);
            } catch (err) {
                if (!JSON.stringify(err).includes("AccountNotInitialized")) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });

        it("should throw an error if option title is an empty string", async () => {
            resetPollOptionTitle("");
            try {
                await initializePollOption(getCollatedParams());
            } catch (err) {
                if (!JSON.stringify(err).includes("EmptyOptionTitle")) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });

        it("should throw an error if title length exceeds the max length allowed", async () => {
            resetPollOptionTitle("0".repeat(MAX_POLL_OPTION_TITLE_CHAR + 1));
            try {
                await initializePollOption(getCollatedParams());
            } catch (err) {
                if (!JSON.stringify(err).includes("OptionTitleOverflow")) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });

        it("should throw an error if description exceeds the max length allowed", async () => {
            resetPollOptionTitle("Option::NEW");
            resetPollOptionDescription("0".repeat(MAX_POLL_DESC_CHAR + 1));
            try {
                await initializePollOption(getCollatedParams());
            } catch (err) {
                if (
                    !JSON.stringify(err).includes("OptionDescriptionOverflow")
                ) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });
    });

    describe("vote() instruction", () => {
        const alice = web3.Keypair.generate();
        const bob = web3.Keypair.generate();
        const charlie = web3.Keypair.generate();
        const dawg = web3.Keypair.generate();

        const getCollatedParams = (
            signer: web3.Keypair = alice,
        ): VoteParams => {
            return {
                pollID: LATEST_INITIALIZED_POLL_ID,
                pollOption: LATEST_POLL_OPTION_PDA,
                voter: signer,
            };
        };

        before(async () => {
            await requestAirdrop(connection, alice.publicKey);
            await requestAirdrop(connection, bob.publicKey);
            await requestAirdrop(connection, charlie.publicKey);
            await requestAirdrop(connection, dawg.publicKey);
        });

        it("should increase the vote count on a poll option", async () => {
            const [aliceVotePDA] = getPollVotePDA(
                LATEST_INITIALIZED_POLL_ID,
                alice.publicKey,
                VotingProgram.programId,
            );
            const [bobVotePDA] = getPollVotePDA(
                LATEST_INITIALIZED_POLL_ID,
                bob.publicKey,
                VotingProgram.programId,
            );

            try {
                const initialPollOptionData =
                    await VotingProgram.account.pollOptionState.fetch(
                        LATEST_POLL_OPTION_PDA,
                        "confirmed",
                    );

                // -> ALICE VOTE
                await voteOnPoll(getCollatedParams());

                const nextPollOptionData =
                    await VotingProgram.account.pollOptionState.fetch(
                        LATEST_POLL_OPTION_PDA,
                        "confirmed",
                    );
                const aliceVoteData =
                    await VotingProgram.account.voterState.fetch(
                        aliceVotePDA,
                        "confirmed",
                    );

                assert.isTrue(
                    nextPollOptionData.count.eq(
                        initialPollOptionData.count.add(new BN(1)),
                    ),
                );
                assert.isTrue(aliceVoteData.hasVoted);

                // -> BOB VOTE
                await voteOnPoll(getCollatedParams(bob));

                const finalPollOptionData =
                    await VotingProgram.account.pollOptionState.fetch(
                        LATEST_POLL_OPTION_PDA,
                        "confirmed",
                    );
                const bobVoteData =
                    await VotingProgram.account.voterState.fetch(
                        bobVotePDA,
                        "confirmed",
                    );

                assert.isTrue(
                    finalPollOptionData.count.eq(
                        nextPollOptionData.count.add(new BN(1)),
                    ),
                );
                assert.isTrue(bobVoteData.hasVoted);
            } catch (err) {
                throw new Error(JSON.stringify(err));
            }
        });

        it("should throw an error if an address attempts to vote twice", async () => {
            try {
                await voteOnPoll(getCollatedParams(charlie));
                await voteOnPoll(getCollatedParams(charlie));
            } catch (err) {
                if (!JSON.stringify(err).includes("AlreadyVoted")) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });

        it("should throw an error if a poll start time has not elapsed", async () => {
            // TODO: find out how to manipulate test validator node
        });

        it("should throw an error if a poll duration has elapsed", async () => {
            // TODO: find out how to manipulate test validator node
        });

        it("should increase the vote count when a whitelisted address votes", async () => {
            const xPollParams: InitPollParams = {
                id: generateRandomU64ID(),
                description: "Poll::TEST_WHITELIST",
                startTime: new BN(0),
                duration: new BN(MIN_POLL_DURATION),
                isPublic: false,
                whitelistedVoters: [
                    alice.publicKey,
                    bob.publicKey,
                    charlie.publicKey,
                ],
                signer: signer,
            };
            const pollOptionA: InitPollOptionParams = {
                pollID: xPollParams.id,
                title: "Option::A",
                description: "private poll first option",
                signer: signer,
            };
            const pollOptionB: InitPollOptionParams = {
                pollID: xPollParams.id,
                title: "Option::B",
                description: "private poll second option",
                signer: signer,
            };
            const getVoteParams = (
                option: InitPollOptionParams,
                voter: web3.Keypair,
            ): VoteParams => {
                return {
                    pollID: xPollParams.id,
                    pollOption: getPollOptionPDA(
                        xPollParams.id,
                        option.title,
                        VotingProgram.programId,
                    )[0],
                    voter: voter,
                };
            };

            try {
                await initializePoll(xPollParams);

                await initializePollOption(pollOptionA);
                await initializePollOption(pollOptionB);

                await voteOnPoll(getVoteParams(pollOptionA, alice));
                await voteOnPoll(getVoteParams(pollOptionA, bob));
                await voteOnPoll(getVoteParams(pollOptionB, charlie));

                const optionAData =
                    await VotingProgram.account.pollOptionState.fetch(
                        getPollOptionPDA(
                            xPollParams.id,
                            pollOptionA.title,
                            VotingProgram.programId,
                        )[0],
                        "confirmed",
                    );
                const optionBData =
                    await VotingProgram.account.pollOptionState.fetch(
                        getPollOptionPDA(
                            xPollParams.id,
                            pollOptionB.title,
                            VotingProgram.programId,
                        )[0],
                        "confirmed",
                    );

                const aliceVoteData =
                    await VotingProgram.account.voterState.fetch(
                        getPollVotePDA(
                            xPollParams.id,
                            alice.publicKey,
                            VotingProgram.programId,
                        )[0],
                        "confirmed",
                    );
                const bobVoteData =
                    await VotingProgram.account.voterState.fetch(
                        getPollVotePDA(
                            xPollParams.id,
                            bob.publicKey,
                            VotingProgram.programId,
                        )[0],
                        "confirmed",
                    );
                const charlieVoteData =
                    await VotingProgram.account.voterState.fetch(
                        getPollVotePDA(
                            xPollParams.id,
                            charlie.publicKey,
                            VotingProgram.programId,
                        )[0],
                        "confirmed",
                    );

                assert.isTrue(aliceVoteData.hasVoted);
                assert.isTrue(bobVoteData.hasVoted);
                assert.isTrue(charlieVoteData.hasVoted);
                assert.isTrue(optionAData.count.eq(new BN(2)));
                assert.isTrue(optionBData.count.eq(new BN(1)));
            } catch (err) {
                console.error(err);
                throw new Error(JSON.stringify(err));
            }
        });

        it("should throw an error if a non-whitelisted voter attempts to vote on a private poll", async () => {
            const yPollParams: InitPollParams = {
                id: generateRandomU64ID(),
                description: "Poll::TEST_UNAUTHORIZED_WHITELIST",
                startTime: new BN(0),
                duration: new BN(MIN_POLL_DURATION),
                isPublic: false,
                whitelistedVoters: [
                    alice.publicKey,
                    bob.publicKey,
                    charlie.publicKey,
                ],
                signer: signer,
            };
            const pollOption: InitPollOptionParams = {
                pollID: yPollParams.id,
                title: "Option::SAMPLE",
                description: "private poll option",
                signer: signer,
            };

            const getVoteParams = (
                option: InitPollOptionParams,
                voter: web3.Keypair,
            ): VoteParams => {
                return {
                    pollID: yPollParams.id,
                    pollOption: getPollOptionPDA(
                        yPollParams.id,
                        option.title,
                        VotingProgram.programId,
                    )[0],
                    voter: voter,
                };
            };

            try {
                await initializePoll(yPollParams);
                await initializePollOption(pollOption);

                await voteOnPoll(getVoteParams(pollOption, dawg));
            } catch (err) {
                if (!JSON.stringify(err).includes("Unauthorized")) {
                    throw new Error(JSON.stringify(err));
                }
            }
        });
    });

    // describe("whitelist_voters() instruction", () => {
    //     //
    // });
});
