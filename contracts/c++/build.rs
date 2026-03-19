fn main() {
    cc::Build::new()
        .cpp(true)
        .compiler("clang++-19")
        .cpp_link_stdlib(None)
        .flag("--target=riscv64-unknown-none-elf")
        .flag("-march=rv64emac")
        .flag("-mabi=lp64e")
        .flag("-O2")
        .flag("-ffreestanding")
        .flag("-fno-exceptions")
        .flag("-fno-rtti")
        .flag("-fno-stack-protector")
        .flag("-nostdlib")
        .flag("-nostdinc++")
        .file("cpp/calculator_math.cpp")
        .compile("calculator_math");
}