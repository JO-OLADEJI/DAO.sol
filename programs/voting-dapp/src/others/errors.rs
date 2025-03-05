use crate::others::constants::{MAX_POLL_DESC_CHAR, MAX_POLL_OPTION_TITLE_CHAR};
use anchor_lang::prelude::*;

#[error_code]
pub enum PollError {
    #[msg("Description length too low: 16 characters min.")]
    DescUnderflow,

    #[msg("Poll with given ID already initialized!")]
    AlreadyInitialized,

    #[msg("Poll start in the past")]
    StartTimeExpired,

    #[msg("Poll duration too small: 24 hours min.")]
    DurationUnderflow,
}

#[error_code]
pub enum PollOptionError {
    #[msg("Poll with ID not found!")]
    PollNotFound,

    #[msg("Option Title can't be empty.")]
    EmptyOptionTitle,

    #[msg("Option Title length too high: {MAX_POLL_OPTION_TITLE_CHAR} characters max.")]
    OptionTitleOverflow,

    #[msg("Option Description length too high: {MAX_POLL_DESC_CHAR} characters max.")]
    OptionDescriptionOverflow,
}
