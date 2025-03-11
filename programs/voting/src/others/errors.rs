use crate::others::constants::{MAX_POLL_DESC_CHAR, MAX_POLL_OPTION_TITLE_CHAR};
use anchor_lang::prelude::*;

#[error_code]
pub enum PollError {
    #[msg("Description length too low: 16 characters min!")]
    DescUnderflow,

    #[msg("Poll with given ID already initialized!")]
    AlreadyInitialized,

    #[msg("Poll start in the past!")]
    StartTimeExpired,

    #[msg("Poll duration too small: 24 hours min!")]
    DurationUnderflow,

    #[msg("Unauthorized to execute function!")]
    Unauthorized,

    #[msg("Whitelist is only available on private polls!")]
    PollIsPublic,

    #[msg("Whitelist voters exceeded. 16 PubKeys max!")]
    WhitelistThresholdOverflow,
}

#[error_code]
pub enum PollOptionError {
    #[msg("Poll with ID not found!")]
    PollNotFound,

    #[msg("Option Title can't be empty!")]
    EmptyOptionTitle,

    #[msg("Option Title length too high: {MAX_POLL_OPTION_TITLE_CHAR} characters max!")]
    OptionTitleOverflow,

    #[msg("Option Description length too high: {MAX_POLL_DESC_CHAR} characters max!")]
    OptionDescriptionOverflow,
}

#[error_code]
pub enum VoteError {
    #[msg("Unauthorized to vote on this poll!")]
    Unauthorized,

    #[msg("Poll has not started!")]
    PollNotStarted,

    #[msg("Poll has ended!")]
    PollHasEnded,

    #[msg("Signer has already voted!")]
    AlreadyVoted,
}
