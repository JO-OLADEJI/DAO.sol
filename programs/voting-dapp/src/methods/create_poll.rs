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
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_account: Account<'info, PollState>,

    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<InitializePollCalldata>,
    id: u64,
    desc: String,
    start: u64, // -> 0: initialize to current time
    duration: u64,
    is_public: bool,
    voters: Option<Vec<Pubkey>>,
) -> Result<()> {
    let adj_start_time: u64;
    let now = Clock::get().unwrap().unix_timestamp as u64;

    if ctx.accounts.poll_account.start_time != 0 {
        return Err(errors::PollError::AlreadyInitialized.into());
    }

    if start == 0 {
        adj_start_time = now;
    } else if start >= now {
        adj_start_time = start;
    } else {
        return Err(errors::PollError::StartTimeExpired.into());
    }

    if desc.len() < constants::MIN_POLL_DESC_CHAR as usize {
        return Err(errors::PollError::DescUnderflow.into());
    }

    if duration < constants::MIN_POLL_DURATION {
        return Err(errors::PollError::DurationUnderflow.into());
    }

    msg!("Initializing & writing data to {:?}", ctx.program_id);
    ctx.accounts.poll_account.set_inner(PollState {
        id,
        admin: ctx.accounts.admin.key(),
        description: desc,
        start_time: adj_start_time,
        duration,
        can_public_vote: is_public,
        authorized_voters: voters,
        options_index: 0,
    });

    Ok(())
}
