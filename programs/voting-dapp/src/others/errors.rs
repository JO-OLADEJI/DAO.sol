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
