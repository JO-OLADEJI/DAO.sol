use anchor_lang::prelude::*;

declare_id!("GMzRVSCFTemLNGjikvoGe8bmR1GJtyu2zL1VXDHs4YJb");

#[program]
pub mod voting_dapp {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
