mod methods;
mod others;
mod state;

use anchor_lang::prelude::*;
use methods::create_poll::{execute, Initialize};
#[allow(unused_imports)]
use others::*;
#[allow(unused_imports)]
use state::*;

declare_id!("GMzRVSCFTemLNGjikvoGe8bmR1GJtyu2zL1VXDHs4YJb");

#[program]
pub mod voting_dapp {
    use super::*;

    pub fn init_poll(
        ctx: Context<Initialize>,
        id: u64,
        desc: String,
        start: u64,
        duration: u64,
        is_public: bool,
    ) -> Result<()> {
        return execute(ctx, id, desc, start, duration, is_public);
    }
}
