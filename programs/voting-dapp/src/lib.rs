use anchor_lang::prelude::*;

const ANCHOR_SPACE_DISCRIMINATOR: usize = 8;
declare_id!("GMzRVSCFTemLNGjikvoGe8bmR1GJtyu2zL1VXDHs4YJb");

#[error_code]
pub enum PollError {
    #[msg("Description length too low: 16 characters min.")]
    DescUnderflow,

    #[msg("Poll with given ID already initialized!")]
    AlreadyInitialized,

    #[msg("Poll start in the past")]
    StartTimeExpired,

    #[msg("Poll duration too small: 24 hours min.")]
    DurationUnderflow,
}

#[program]
pub mod voting_dapp {
    use super::*;
    const MIN_POLL_DURATION: u64 = 60 * 60 * 24;

    pub fn create_poll(
        ctx: Context<InitializePoll>,
        id: u64,
        desc: String,
        start: u64, // -> 0: initialize to current time
        duration: u64,
        is_public: bool,
    ) -> Result<()> {
        // panic if poll has been previously created
        if ctx.accounts.poll_account.start_time != 0 {
            return Err(PollError::AlreadyInitialized.into());
        }

        // panic if poll start time is in the past
        if start != 0 && start < (Clock::get().unwrap().unix_timestamp) as u64 {
            return Err(PollError::StartTimeExpired.into());
        }

        // panic if description is too little
        if desc.len() < 16 {
            return Err(PollError::DescUnderflow.into());
        }

        // panic if duration is less than 24 hours (1 day)
        if duration < MIN_POLL_DURATION {
            return Err(PollError::DurationUnderflow.into());
        }

        msg!("Initializing & writing data to {:?}", ctx.program_id);
        ctx.accounts.poll_account.set_inner(Poll {
            id,
            description: desc,
            start_time: start,
            duration,
            can_public_vote: is_public,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = ANCHOR_SPACE_DISCRIMINATOR + Poll::INIT_SPACE,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump
    )]
    poll_account: Account<'info, Poll>,

    system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Poll {
    id: u64,
    #[max_len(256)]
    description: String,
    start_time: u64,
    duration: u64,
    can_public_vote: bool,
}
