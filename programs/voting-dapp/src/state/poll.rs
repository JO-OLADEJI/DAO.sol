use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PollState {
    pub id: u64,

    #[max_len(256)]
    pub description: String,

    pub start_time: u64,

    pub duration: u64,

    pub can_public_vote: bool,
}
