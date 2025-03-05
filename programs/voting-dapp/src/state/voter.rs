use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VoterState {
    pub has_voted: bool,
}
