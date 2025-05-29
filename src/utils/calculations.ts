import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Calculate tokens for SOL amount
export async function calculateTokensForSol(connection: Connection, curve: PublicKey, solAmount: number): Promise<bigint | null> {
    try {
        const curveAccount = await connection.getAccountInfo(curve);
        if (!curveAccount || !curveAccount.data) {
            return null;
        }
        
        const PUMP_CURVE_STATE_SIGNATURE = Uint8Array.from([0x17, 0xb7, 0xf8, 0x37, 0x60, 0xd8, 0xac, 0x60]);
        const signature = curveAccount.data.subarray(0, 8);
        if (!signature.equals(Buffer.from(PUMP_CURVE_STATE_SIGNATURE))) {
            return null;
        }
        
        const virtualTokenReserves = curveAccount.data.readBigUInt64LE(0x08);
        const virtualSolReserves = curveAccount.data.readBigUInt64LE(0x10);
        
        const solLamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL));
        
        // pump.fun formula
        const numerator = solLamports * virtualTokenReserves;
        const denominator = virtualSolReserves + solLamports;
        const tokensWeCanBuy = numerator / denominator;
        
        // 2% safety margin
        const tokensWithSlippage = (tokensWeCanBuy * BigInt(98)) / BigInt(100);
        
        return tokensWithSlippage;
    } catch (error) {
        return null;
    }
}

// Calculate SOL value for tokens
export async function calculateSolForTokens(connection: Connection, curve: PublicKey, tokenAmount: bigint): Promise<number | null> {
    try {
        const curveAccount = await connection.getAccountInfo(curve);
        if (!curveAccount || !curveAccount.data) {
            return null;
        }
        
        const PUMP_CURVE_STATE_SIGNATURE = Uint8Array.from([0x17, 0xb7, 0xf8, 0x37, 0x60, 0xd8, 0xac, 0x60]);
        const signature = curveAccount.data.subarray(0, 8);
        if (!signature.equals(Buffer.from(PUMP_CURVE_STATE_SIGNATURE))) {
            return null;
        }
        
        const virtualTokenReserves = curveAccount.data.readBigUInt64LE(0x08);
        const virtualSolReserves = curveAccount.data.readBigUInt64LE(0x10);
        
        // pump.fun sell formula
        const numerator = tokenAmount * virtualSolReserves;
        const denominator = virtualTokenReserves + tokenAmount;
        const solLamports = numerator / denominator;
        
        // 2% slippage
        const solWithSlippage = (solLamports * BigInt(98)) / BigInt(100);
        
        return Number(solWithSlippage) / LAMPORTS_PER_SOL;
        
    } catch (error) {
        return null;
    }
} 