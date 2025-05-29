import { Connection } from '@solana/web3.js';
import { logError } from './logger';

// Blockhash cache
let cachedBlockhash: string | null = null;

export function getCachedBlockhash(): string | null {
    return cachedBlockhash;
}

export function setCachedBlockhash(blockhash: string): void {
    cachedBlockhash = blockhash;
}

// Blockhash cache maintenance
export async function maintainBlockhashCache(connection: Connection): Promise<void> {
    while (true) {
        try {
            const blockHashInfo = await connection.getLatestBlockhash();
            cachedBlockhash = blockHashInfo.blockhash;
            await new Promise(resolve => setTimeout(resolve, 10000));
        } catch (error) {
            logError(`Blockhash cache error: ${error}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
} 