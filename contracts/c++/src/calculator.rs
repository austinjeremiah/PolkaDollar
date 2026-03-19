#![no_std]
#![no_main]

use uapi::{HostFn, HostFnImpl as api, ReturnFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

extern "C" {
    fn compute_stability(
        total_collateral_usd: u64,
        total_debt: u64,
        volatility: u64,
        current_ratio: u64,
        score: *mut u64,
        flag: *mut u64,
    );
}

fn read_u64(buf: &[u8], offset: usize) -> u64 {
    let slice = &buf[offset + 24..offset + 32];
    u64::from_be_bytes(slice.try_into().unwrap())
}

fn write_u64(buf: &mut [u8], offset: usize, val: u64) {
    buf[offset..offset + 24].fill(0);
    buf[offset + 24..offset + 32].copy_from_slice(&val.to_be_bytes());
}

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Input: 4-byte selector + 4 × 32-byte slots = 132 bytes
    // Slot 0 (4..36):   total_collateral_usd
    // Slot 1 (36..68):  total_debt
    // Slot 2 (68..100): volatility (×100, e.g. 5.5% = 550)
    // Slot 3 (100..132): current_ratio (130/150/180/220)

    let mut input = [0u8; 132];
    api::call_data_copy(&mut input, 0);

    let total_collateral_usd = read_u64(&input, 4);
    let total_debt           = read_u64(&input, 36);
    let volatility           = read_u64(&input, 68);
    let current_ratio        = read_u64(&input, 100);

    let mut score: u64 = 0;
    let mut flag: u64  = 0;

    unsafe {
        compute_stability(
            total_collateral_usd,
            total_debt,
            volatility,
            current_ratio,
            &mut score,
            &mut flag,
        );
    }

    // Return 2 × 32-byte ABI-encoded uint64 = 64 bytes
    let mut output = [0u8; 64];
    write_u64(&mut output, 0,  score);
    write_u64(&mut output, 32, flag);

    api::return_value(ReturnFlags::empty(), &output);
}