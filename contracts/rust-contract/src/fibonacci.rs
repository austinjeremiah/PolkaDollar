//! fibonacci — Rust PVM contract for heavy computation
//!
//! Exposes: fib(uint256 n) returns (uint256)
//!
//! This contract demonstrates the core PVM value proposition:
//! computation that would be impractical in EVM (iterative Fibonacci
//! at large n) runs efficiently as a tight RISC-V loop.
//!
//! This contract is designed to be called FROM a Solidity EVM contract
//! (FibCaller.sol) — a cross-VM call where EVM delegates computation to PVM.
//!
//! ABI encoding for fib(uint256 n):
//!   bytes  0..4  : 4-byte function selector = keccak256("fib(uint256)")[0:4]
//!                  = 0x5e 0x2b 0x67 0x29
//!   bytes  4..36 : n (32-byte big-endian uint256)
//!
//! We work with u64 here — fib(93) = 12200160415121876738 fits in u64.
//! Beyond that, results wrap (this is fine for a demonstration).

#![no_std]
#![no_main]

use uapi::{input, HostFn, HostFnImpl as api, ReturnFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

/// Called once at deployment. Nothing to initialize.
#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

/// Called on every transaction.
/// Reads n from ABI-encoded calldata and returns fib(n).
#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Read 36 bytes: 4-byte selector + 32-byte uint256 argument
    input!(buf: &[u8; 36],);

    // The first 4 bytes are the function selector — we skip them.
    // n is in bytes 4..36 (big-endian uint256).
    // We read it as u64 from the last 8 bytes (sufficient for demo values).
    let n = u64::from_be_bytes(buf[28..36].try_into().unwrap());

    // Compute Fibonacci iteratively — O(n) time, O(1) space.
    // This is a tight RISC-V loop. At n=50, EVM would cost ~millions of gas.
    let result = fibonacci(n);

    // ABI-encode result as 32-byte big-endian uint256
    let mut output = [0u8; 32];
    output[24..32].copy_from_slice(&result.to_be_bytes());

    api::return_value(ReturnFlags::empty(), &output);
}

/// Iterative Fibonacci — safe for large n, no recursion stack.
fn fibonacci(n: u64) -> u64 {
    if n == 0 {
        return 0;
    }
    if n == 1 {
        return 1;
    }
    let mut a: u64 = 0;
    let mut b: u64 = 1;
    for _ in 2..=n {
        let next = a.wrapping_add(b);
        a = b;
        b = next;
    }
    b
}

// ── Sanity check (compile-time, not executed on-chain) ────────────────────
#[cfg(test)]
mod tests {
    use super::fibonacci;

    #[test]
    fn test_known_values() {
        assert_eq!(fibonacci(0), 0);
        assert_eq!(fibonacci(1), 1);
        assert_eq!(fibonacci(10), 55);
        assert_eq!(fibonacci(20), 6765);
        assert_eq!(fibonacci(50), 12586269025);
    }
}
