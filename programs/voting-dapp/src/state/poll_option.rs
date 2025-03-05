use crate::others::constants::{MAX_POLL_DESC_CHAR, MAX_POLL_OPTION_TITLE_CHAR};
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PollOptionState {
    pub id: u64,

    #[max_len(MAX_POLL_OPTION_TITLE_CHAR)]
    pub value: String,

    #[max_len(MAX_POLL_DESC_CHAR)]
    pub description: Option<String>,

    pub count: u64,
}
