use anchor_lang::prelude::*;

use crate::{
    others::{constants, errors},
    state::PollState,
};

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct WhitelistVotersCalldata<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(mut)]
    pub poll_account: Account<'info, PollState>,

    pub system_program: Program<'info, System>,
}

pub fn authorize_voters(
    ctx: Context<WhitelistVotersCalldata>,
    _poll_id: u64,
    addresses: Vec<Pubkey>,
) -> Result<()> {
    let poll = &mut ctx.accounts.poll_account;

    if ctx.accounts.caller.key().to_string() != poll.admin.to_string() {
        return Err(errors::PollError::Unauthorized.into());
    }

    if poll.can_public_vote {
        return Err(errors::PollError::PollIsPublic.into());
    }

    match &mut poll.whitelisted_voters {
        Some(wl_voter_ids) => {
            if wl_voter_ids.len() + addresses.len() > constants::MAX_POLL_AUTHORIZED_VOTERS as usize
            {
                return Err(errors::PollError::WhitelistThresholdOverflow.into());
            }
            wl_voter_ids.extend(addresses);
        }
        None => {
            if addresses.len() > constants::MAX_POLL_AUTHORIZED_VOTERS as usize {
                return Err(errors::PollError::WhitelistThresholdOverflow.into());
            }
            poll.whitelisted_voters = Some(addresses);
        }
    }

    Ok(())
}
