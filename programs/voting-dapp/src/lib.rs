use anchor_lang::prelude::*;

mod methods;
mod others;
mod state;

use methods::cast_vote::{CastVoteCalldata, *};
use methods::create_poll::{InitializePollCalldata, *};
use methods::create_poll_option::{InitializePollOptionsCalldata, *};

declare_id!("GMzRVSCFTemLNGjikvoGe8bmR1GJtyu2zL1VXDHs4YJb");

#[program]
pub mod voting_dapp {
    use super::*;

    pub fn init_poll(
        ctx: Context<InitializePollCalldata>,
        id: u64,
        desc: String,
        start: u64,
        duration: u64,
        is_public: bool,
        voters: Option<Vec<Pubkey>>,
    ) -> Result<()> {
        return execute(ctx, id, desc, start, duration, is_public, voters);
    }

    pub fn create_poll_option(
        ctx: Context<InitializePollOptionsCalldata>,
        poll_id: u64,
        option_name: String,
        option_desc: Option<String>,
    ) -> Result<()> {
        return init_option(ctx, poll_id, option_name, option_desc);
    }

    pub fn vote(ctx: Context<CastVoteCalldata>, poll_id: u64, poll_option_id: u64) -> Result<()> {
        return cast_vote(ctx, poll_id, poll_option_id);
    }
}
