import { PublicKey } from '@solana/web3.js';

// Interface for token data
export interface CreateTokenData {
    mint: PublicKey;
    curve: PublicKey;
    creator: PublicKey;
    name: string;
    symbol: string;
    uri: string;
}

// Position data interface
export interface Position {
    mint: PublicKey;
    curve: PublicKey;
    creator: PublicKey;
    name: string;
    symbol: string;
    buyAmount: number;
    startTime: number;
    userTokenAccount: PublicKey;
    monitoringActive: boolean;
    intervalId?: NodeJS.Timeout;
    // 🎯 NEW: Data for dashboard
    currentBalance?: bigint;
    currentSolValue?: number;
    currentProfit?: number;
    lastUpdate?: number;
}

// Detected token data
export interface DetectedToken {
    mint: PublicKey;
    curve: PublicKey;
    creator: PublicKey;
    timestamp: number;
}

// Candidate token data
export interface CandidateToken {
    mint: PublicKey;
    curve: PublicKey;
    creator: PublicKey;
    name: string;
    symbol: string;
    timestamp: number;
    ratio?: number;
    score?: number;
}

// Token info for trading
export interface TokenInfo {
    mint: PublicKey;
    curve: PublicKey;
    creator: PublicKey;
    name: string;
    symbol: string;
} 