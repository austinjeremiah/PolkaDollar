#![no_std]
#![no_main]

use uapi::{input, HostFn, HostFnImpl as api, ReturnFlags, StorageFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

const SEL_PUSH_PRICE:  [u8; 4] = [0x17, 0xb6, 0xc4, 0x47];
const SEL_ASSESS_RISK: [u8; 4] = [0xb5, 0xa3, 0xd2, 0x2a];

const KEY_VARIANCE:   [u8; 32] = key(0x01);
const KEY_PREV_PRICE: [u8; 32] = key(0x02);

const fn key(id: u8) -> [u8; 32] {
    let mut k = [0u8; 32];
    k[0] = id;
    k
}

const SCALE: u128 = 1_000_000_000_000;
const T1: u128 =  1_000_000_000_000_000_000_000;
const T2: u128 =  4_000_000_000_000_000_000_000;
const T3: u128 =  9_000_000_000_000_000_000_000;

fn store(key: &[u8; 32], val: u128) {
    api::set_storage(StorageFlags::empty(), key, &val.to_le_bytes());
}

fn load(key: &[u8; 32]) -> u128 {
    let mut buf = [0u8; 16];
    let mut out: &mut [u8] = &mut buf;
    let _ = api::get_storage(StorageFlags::empty(), key, &mut out);
    u128::from_le_bytes(buf)
}

fn push_price(price: u128) {
    let prev = load(&KEY_PREV_PRICE);
    let var  = load(&KEY_VARIANCE);
    let new_var = if prev > 0 {
        let diff = if price >= prev { price - prev } else { prev - price };
        let ret  = diff.saturating_mul(SCALE) / prev;
        let ret2 = ret.saturating_mul(ret);
        var.saturating_mul(94) / 100 + ret2.saturating_mul(6) / 100
    } else { var };
    store(&KEY_VARIANCE,   new_var);
    store(&KEY_PREV_PRICE, price);
}

fn assess_risk() -> (u8, u128) {
    let var = load(&KEY_VARIANCE);
    if      var < T1 { (0, 13000) }
    else if var < T2 { (1, 15000) }
    else if var < T3 { (2, 18000) }
    else             { (3, 22000) }
}

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Read just 4 bytes for the selector first
    input!(sel_buf: &[u8; 4],);
    let sel = [sel_buf[0], sel_buf[1], sel_buf[2], sel_buf[3]];

    if sel == SEL_PUSH_PRICE {
        // Re-read full 36 bytes to get the price argument
        input!(full: &[u8; 36],);
        let mut bytes = [0u8; 16];
        bytes.copy_from_slice(&full[20..36]);
        push_price(u128::from_be_bytes(bytes));
        api::return_value(ReturnFlags::empty(), &[]);
    } else if sel == SEL_ASSESS_RISK {
        // No extra args needed — just compute and return
        let (regime, ratio) = assess_risk();
        let mut out = [0u8; 64];
        out[31] = regime;
        out[48..64].copy_from_slice(&ratio.to_be_bytes());
        api::return_value(ReturnFlags::empty(), &out);
    } else {
        api::return_value(ReturnFlags::REVERT, b"bad selector");
    }
}
