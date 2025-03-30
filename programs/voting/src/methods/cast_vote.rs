use anchor_lang::prelude::*;

use crate::others::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct CastVoteCalldata<'info> {
    #[account(mut)]
    voter: Signer<'info>,

    poll_account: Account<'info, PollState>,

    #[account(mut)]
    poll_option_account: Account<'info, PollOptionState>,

    #[account(
        init_if_needed,
        payer = voter,
        space = constants::ANCHOR_SPACE_DISCRIMINATOR + VoterState::INIT_SPACE,
        seeds = [b"vote-account".as_ref(), &poll_id.to_le_bytes(), voter.key().as_ref()],
        bump
    )]
    voter_accout: Account<'info, VoterState>,

    system_program: Program<'info, System>,
}

pub fn init_vote(ctx: Context<CastVoteCalldata>, _poll_id: u64) -> Result<()> {
    let mut is_voter_authorized: bool = false;
    let now = Clock::get().unwrap().unix_timestamp as u64;

    let poll = &ctx.accounts.poll_account;
    let poll_option = &mut ctx.accounts.poll_option_account;
    let voter = &mut ctx.accounts.voter_accout;

    if !poll.can_public_vote {
        match &poll.whitelisted_voters {
            Some(auth_voters) => {
                for voter in auth_voters {
                    if voter.to_string() == ctx.accounts.voter.key().to_string() {
                        is_voter_authorized = true;
                        break;
                    }
                }
            }
            _ => (),
        }
    } else {
        is_voter_authorized = true;
    }

    if !is_voter_authorized {
        return Err(errors::VoteError::Unauthorized.into());
    }

    if now < poll.start_time {
        return Err(errors::VoteError::PollNotStarted.into());
    } else if now > poll.start_time + poll.duration {
        return Err(errors::VoteError::PollHasEnded.into());
    }

    if voter.has_voted {
        return Err(errors::VoteError::AlreadyVoted.into());
    }

    voter.has_voted = true;
    poll_option.count += 1;

    Ok(())
}
