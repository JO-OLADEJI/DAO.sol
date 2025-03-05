use crate::others::*;
use anchor_lang::prelude::*;

use crate::state::{PollOptionState, PollState};

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePollOptionsCalldata<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_account: Account<'info, PollState>,

    #[account(
        init,
        payer = admin,
        space = constants::ANCHOR_SPACE_DISCRIMINATOR + PollOptionState::INIT_SPACE,
        seeds = [b"poll_option".as_ref(), poll_id.to_le_bytes().as_ref(), poll_account.options_index.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_option_account: Account<'info, PollOptionState>,

    pub system_program: Program<'info, System>,
}

pub fn init_option(
    ctx: Context<InitializePollOptionsCalldata>,
    _poll_id: u64,
    option_name: String,
    option_desc: Option<String>,
) -> Result<()> {
    let poll = &mut ctx.accounts.poll_account;

    // check that poll exists
    if poll.start_time == 0 {
        return Err(errors::PollOptionError::PollNotFound.into());
    }

    if option_name.is_empty() {
        return Err(errors::PollOptionError::EmptyOptionTitle.into());
    } else if option_name.len() > 16 {
        return Err(errors::PollOptionError::OptionTitleOverflow.into());
    }

    match &option_desc {
        Some(desc) => {
            if desc.len() > constants::MAX_POLL_DESC_CHAR as usize {
                return Err(errors::PollOptionError::OptionDescriptionOverflow.into());
            }
        }
        _ => (),
    }

    ctx.accounts.poll_option_account.set_inner(PollOptionState {
        id: poll.options_index,
        value: option_name,
        description: option_desc,
        count: 0,
    });
    poll.options_index += 1;

    Ok(())
}
