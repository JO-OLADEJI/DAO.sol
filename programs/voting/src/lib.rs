use anchor_lang::prelude::*;

mod methods;
mod others;
mod state;

use methods::cast_vote::{CastVoteCalldata, *};
use methods::create_poll::{InitializePollCalldata, *};
use methods::create_poll_option::{InitializePollOptionsCalldata, *};
use methods::whitelist::{WhitelistVotersCalldata, *};

declare_id!("GLcBgVhph3aMDLSxQxGsRjvEvNTNGQd4tQjY2gp9zaug");

#[program]
pub mod voting {
    use super::*;

    pub fn init_poll(
        ctx: Context<InitializePollCalldata>,
        poll_id: u64,
        poll_desc: String,
        poll_start: u64,
        poll_duration: u64,
        is_poll_public: bool,
        whitelisted_voters: Option<Vec<Pubkey>>,
    ) -> Result<()> {
        return init(
            ctx,
            poll_id,
            poll_desc,
            poll_start,
            poll_duration,
            is_poll_public,
            whitelisted_voters,
        );
    }

    pub fn init_poll_option(
        ctx: Context<InitializePollOptionsCalldata>,
        poll_id: u64,
        poll_option_name: String,
        poll_option_desc: Option<String>,
    ) -> Result<()> {
        return init_option(ctx, poll_id, poll_option_name, poll_option_desc);
    }

    pub fn vote(ctx: Context<CastVoteCalldata>, poll_id: u64) -> Result<()> {
        return init_vote(ctx, poll_id);
    }

    pub fn whitelist_voters(
        ctx: Context<WhitelistVotersCalldata>,
        poll_id: u64,
        addresses: Vec<Pubkey>,
    ) -> Result<()> {
        return authorize_voters(ctx, poll_id, addresses);
    }
}
