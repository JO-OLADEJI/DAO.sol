use crate::others::*;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePollCalldata<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = constants::ANCHOR_SPACE_DISCRIMINATOR + PollState::INIT_SPACE,
        seeds = [b"poll-account".as_ref(), &poll_id.to_le_bytes()],
        bump
    )]
    pub poll_account: Account<'info, PollState>,

    pub system_program: Program<'info, System>,
}

pub fn init(
    ctx: Context<InitializePollCalldata>,
    poll_id: u64,
    poll_desc: String,
    poll_start: u64, // -> 0: initialize to current time
    poll_duration: u64,
    is_poll_public: bool,
    whitelisted_voters: Option<Vec<Pubkey>>,
) -> Result<()> {
    let adj_start_time: u64;
    let now = Clock::get().unwrap().unix_timestamp as u64;

    if poll_start == 0 {
        adj_start_time = now;
    } else if poll_start >= now {
        adj_start_time = poll_start;
    } else {
        return Err(errors::PollError::StartTimeExpired.into());
    }

    if poll_desc.len() < constants::MIN_POLL_DESC_CHAR as usize {
        return Err(errors::PollError::DescUnderflow.into());
    }

    if poll_duration < constants::MIN_POLL_DURATION {
        return Err(errors::PollError::DurationUnderflow.into());
    }

    match &whitelisted_voters {
        Some(voter_ids) => {
            if is_poll_public {
                return Err(errors::PollError::PollIsPublic.into());
            }
            if voter_ids.len() > constants::MAX_POLL_AUTHORIZED_VOTERS as usize {
                return Err(errors::PollError::WhitelistThresholdOverflow.into());
            }
        }
        _ => (),
    }

    msg!("Initializing & writing data to {:?}", ctx.program_id);
    ctx.accounts.poll_account.set_inner(PollState {
        id: poll_id,
        description: poll_desc,
        admin: ctx.accounts.admin.key(),
        start_time: adj_start_time,
        duration: poll_duration,
        can_public_vote: is_poll_public,
        whitelisted_voters,
        options_index: 0,
    });

    Ok(())
}
