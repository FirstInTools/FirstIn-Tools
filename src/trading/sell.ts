import { Connection, PublicKey, Keypair, Transaction, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { CONFIG, PUMP_FUN_PROGRAM_ID, GLOBAL_ACCOUNT, FEE_RECIPIENT, EVENT_AUTHORITY } from '../config/constants';
import { logInfo, logSuccess, logError, logWarning } from '../utils/logger';
import { getCachedBlockhash } from '../utils/cache';

// 🔥 ENHANCED SELL with post-sell verification (like in original bot)
export async function executeSell(
    connection: Connection, 
    mint: PublicKey, 
    curve: PublicKey, 
    tokenAmount: bigint, 
    detectedTokens: Map<string, any>,
    wallet: Keypair
): Promise<boolean> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        attempt++;
        
        try {
            logInfo(`EXECUTING SELL (attempt ${attempt}/${maxRetries})...`);
            
            // Check balance BEFORE sell
            const userTokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);
            const balanceBeforeSell = await connection.getTokenAccountBalance(userTokenAccount);
            const tokensBeforeSell = BigInt(balanceBeforeSell.value.amount);
            
            if (tokensBeforeSell === BigInt(0)) {
                logSuccess('✅ Tokens already sold (balance = 0)');
                return true;
            }
            
            logInfo(`📊 Balance before sell: ${Number(tokensBeforeSell).toLocaleString()} tokens`);
            
            // Use real balance if different
            const actualTokensToSell = tokensBeforeSell < tokenAmount ? tokensBeforeSell : tokenAmount;
            
            // Find creator
            let creator: PublicKey | null = null;
            for (const [mintStr, tokenData] of detectedTokens.entries()) {
                if (mintStr === mint.toString()) {
                    creator = tokenData.creator;
                    break;
                }
            }
            
            if (!creator) {
                creator = PublicKey.default; // Fallback
            }
            
            const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
                [curve.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
                ASSOCIATED_TOKEN_PROGRAM_ID
            );
            const [creatorVault] = PublicKey.findProgramAddressSync(
                [Buffer.from("creator-vault"), creator.toBuffer()],
                PUMP_FUN_PROGRAM_ID
            );
            
            // Build sell transaction
            const tx = new Transaction();
            
            // 🎯 EXACT: ComputeBudget instructions identical to winning trader
            const computeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
                units: CONFIG.COMPUTE_UNIT_LIMIT // 100000
            });
            
            const computeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: CONFIG.COMPUTE_UNIT_PRICE // 10000 (0.01 lamports/CU)
            });
            
            tx.add(computeUnitLimitIx);
            tx.add(computeUnitPriceIx);
            
            // Sell instruction
            const sellIx = {
                programId: PUMP_FUN_PROGRAM_ID,
                keys: [
                    { pubkey: GLOBAL_ACCOUNT, isSigner: false, isWritable: false },
                    { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
                    { pubkey: mint, isSigner: false, isWritable: false },
                    { pubkey: curve, isSigner: false, isWritable: true },
                    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
                    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
                    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    { pubkey: creatorVault, isSigner: false, isWritable: true },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    { pubkey: EVENT_AUTHORITY, isSigner: false, isWritable: false },
                    { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
                ],
                data: Buffer.from([
                    0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad,
                    ...new Uint8Array(new BigUint64Array([actualTokensToSell]).buffer),
                    ...new Uint8Array(new BigUint64Array([BigInt(0)]).buffer)
                ])
            };
            
            tx.add(sellIx);
            
            // 🔥 FEE RECOVERY: Add closeAccount instruction
            const closeAccountIx = {
                programId: TOKEN_PROGRAM_ID,
                keys: [
                    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
                    { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // Destination for recovered SOL
                    { pubkey: wallet.publicKey, isSigner: true, isWritable: false },  // Owner/Authority
                ],
                data: Buffer.from([9]) // CloseAccount instruction discriminator
            };
            
            tx.add(closeAccountIx);
            
            // Blockhash
            let cachedBlockhash = getCachedBlockhash();
            if (!cachedBlockhash) {
                const blockHashInfo = await connection.getLatestBlockhash();
                cachedBlockhash = blockHashInfo.blockhash;
            }
            tx.recentBlockhash = cachedBlockhash;
            tx.feePayer = wallet.publicKey;
            tx.sign(wallet);
            
            // Send transaction
            const sig = await connection.sendRawTransaction(tx.serialize(), {
                skipPreflight: false, // Enable preflight to detect errors
                preflightCommitment: 'processed',
                maxRetries: 2
            });
            
            logSuccess(`SELL SENT: ${sig.slice(0, 8)}...${sig.slice(-8)}`);
            logInfo(`Tokens to sell: ${Number(actualTokensToSell).toLocaleString()}`);
            
            // 🔥 CRITICAL: POST-SELL VERIFICATION
            logInfo('🔍 Verifying that the sell went through...');
            await new Promise(resolve => setTimeout(resolve, 4000)); // Wait 4 seconds
            
            // Check balance AFTER sell
            try {
                const balanceAfterSell = await connection.getTokenAccountBalance(userTokenAccount);
                const tokensAfterSell = BigInt(balanceAfterSell.value.amount);
                
                logInfo(`📊 Balance after sell: ${Number(tokensAfterSell).toLocaleString()} tokens`);
                
                if (tokensAfterSell === BigInt(0)) {
                    logSuccess(`🎉 SELL CONFIRMED! All tokens sold + fees recovered`);
                    logSuccess(`💰 Token account closed - Recovered ~0.002 SOL (rent exemption)`);
                    return true;
                } else if (tokensAfterSell < tokensBeforeSell) {
                    const tokensSold = tokensBeforeSell - tokensAfterSell;
                    logSuccess(`✅ PARTIAL SELL: ${Number(tokensSold).toLocaleString()} tokens sold`);
                    
                    if (tokensAfterSell > BigInt(0) && attempt < maxRetries) {
                        logWarning(`🔄 ${Number(tokensAfterSell).toLocaleString()} tokens remaining - RETRY`);
                        tokenAmount = tokensAfterSell; // Sell the rest
                        continue; // Retry with remaining tokens
                    }
                    
                    return true; // Consider as success even if partial
                } else {
                    throw new Error(`SELL FAILED - Balance unchanged: ${Number(tokensAfterSell).toLocaleString()} tokens`);
                }
                
            } catch (balanceError) {
                logError(`Balance verification error: ${balanceError}`);
                if (attempt < maxRetries) {
                    logWarning(`🔄 Retry verification in 2s...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                throw balanceError;
            }
            
        } catch (error: any) {
            logError(`SELL FAILED (attempt ${attempt}): ${error.message?.slice(0, 150)}`);
            
            if (attempt < maxRetries) {
                logWarning(`🔄 RETRY in 3 seconds... (${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                logError(`💀 FINAL FAILURE after ${maxRetries} attempts`);
                return false;
            }
        }
    }
    
    return false;
} 