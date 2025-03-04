use crate::others::*;
use crate::state::*;
use anchor_lang::prelude::*;
use constants::*;

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = ANCHOR_SPACE_DISCRIMINATOR + PollState::INIT_SPACE,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_account: Account<'info, PollState>,

    pub system_program: Program<'info, System>,
}

pub fn execute(
    ctx: Context<Initialize>,
    id: u64,
    desc: String,
    start: u64, // -> 0: initialize to current time
    duration: u64,
    is_public: bool,
) -> Result<()> {
    // panic if poll has been previously created
    if ctx.accounts.poll_account.start_time != 0 {
        return Err(errors::PollError::AlreadyInitialized.into());
    }

    // panic if poll start time is in the past
    if start != 0 && start < (Clock::get().unwrap().unix_timestamp) as u64 {
        return Err(errors::PollError::StartTimeExpired.into());
    }

    // panic if description is too little
    if desc.len() < 16 {
        return Err(errors::PollError::DescUnderflow.into());
    }

    // panic if duration is less than 24 hours (1 day)
    if duration < constants::MIN_POLL_DURATION {
        return Err(errors::PollError::DurationUnderflow.into());
    }

    msg!("Initializing & writing data to {:?}", ctx.program_id);
    ctx.accounts.poll_account.set_inner(PollState {
        id,
        description: desc,
        start_time: start,
        duration,
        can_public_vote: is_public,
    });

    Ok(())
}
