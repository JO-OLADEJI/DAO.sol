use crate::others::constants::{MAX_POLL_AUTHORIZED_VOTERS, MAX_POLL_DESC_CHAR};
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PollState {
    pub id: u64,

    pub admin: Pubkey,

    #[max_len(MAX_POLL_DESC_CHAR)]
    pub description: String,

    pub start_time: u64,

    pub duration: u64,

    pub can_public_vote: bool,

    #[max_len(MAX_POLL_AUTHORIZED_VOTERS)]
    pub whitelisted_voters: Option<Vec<Pubkey>>,

    pub options_index: u64,
}
