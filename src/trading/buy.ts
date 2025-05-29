import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { CONFIG, PUMP_FUN_PROGRAM_ID, GLOBAL_ACCOUNT, FEE_RECIPIENT, EVENT_AUTHORITY } from '../config/constants';
import { TokenInfo } from '../types/index';
import { logFire, logInfo, logSuccess, logError, logWarning } from '../utils/logger';
import { getCachedBlockhash } from '../utils/cache';
import { startTokenMonitoring } from '../monitoring/positions';

// 🎯 EXACT: Buy execution with same parameters as winning trader
export async function executeBuy(
    connection: Connection, 
    tokenInfo: TokenInfo, 
    activePositions: Map<string, any>, 
    detectedTokens: Map<string, any>,
    wallet: Keypair
): Promise<boolean> {
    try {
        // Check if we've reached maximum positions
        if (activePositions.size >= CONFIG.MAX_POSITIONS) {
            logWarning(`⚠️ Maximum of ${CONFIG.MAX_POSITIONS} positions reached`);
            return false;
        }
        
        // Check if we already have this position
        if (activePositions.has(tokenInfo.mint.toString())) {
            return false;
        }
        
        const userTokenAccount = await getAssociatedTokenAddress(tokenInfo.mint, wallet.publicKey);
        
        // Create position
        activePositions.set(tokenInfo.mint.toString(), {
            mint: tokenInfo.mint,
            curve: tokenInfo.curve,
            creator: tokenInfo.creator,
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            buyAmount: CONFIG.BUY_AMOUNT,
            startTime: Date.now(),
            userTokenAccount,
            monitoringActive: true
        });
        
        logFire(`BUY: ${tokenInfo.name} (${tokenInfo.symbol}) [Position ${activePositions.size}/${CONFIG.MAX_POSITIONS}]`);
        
        // 🎯 EXACT: Identical parameters to winning trader
        const targetTokens = BigInt(CONFIG.TARGET_TOKENS * 1000000); // 400123000000
        const maxSolCost = BigInt(Math.floor(CONFIG.BUY_AMOUNT * LAMPORTS_PER_SOL)); // 11800000 lamports
        
        logInfo(`🎯 TRADER COPY: ${CONFIG.TARGET_TOKENS.toLocaleString()} tokens for max ${CONFIG.BUY_AMOUNT} SOL`);
        
        // Derive accounts
        const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
            [tokenInfo.curve.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenInfo.mint.toBuffer()],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const [creatorVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("creator-vault"), tokenInfo.creator.toBuffer()],
            PUMP_FUN_PROGRAM_ID
        );
        
        // Build transaction
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
        
        // Create token account if necessary (like in trader's transaction)
        const accountInfo = await connection.getAccountInfo(userTokenAccount);
        if (!accountInfo) {
            const createIx = createAssociatedTokenAccountInstruction(
                wallet.publicKey, userTokenAccount, wallet.publicKey, tokenInfo.mint
            );
            tx.add(createIx);
        }
        
        // 🎯 EXACT: Buy instruction with same data as trader
        const buyIx = {
            programId: PUMP_FUN_PROGRAM_ID,
            keys: [
                { pubkey: GLOBAL_ACCOUNT, isSigner: false, isWritable: false },
                { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
                { pubkey: tokenInfo.mint, isSigner: false, isWritable: false },
                { pubkey: tokenInfo.curve, isSigner: false, isWritable: true },
                { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
                { pubkey: userTokenAccount, isSigner: false, isWritable: true },
                { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: creatorVault, isSigner: false, isWritable: true },
                { pubkey: EVENT_AUTHORITY, isSigner: false, isWritable: false },
                { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([
                0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea, // BUY signature
                ...new Uint8Array(new BigUint64Array([targetTokens]).buffer), // amount: 400123000000
                ...new Uint8Array(new BigUint64Array([maxSolCost]).buffer)    // max_sol_cost: 11800000
            ])
        };
        
        tx.add(buyIx);
        
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
            skipPreflight: true,
            preflightCommitment: 'processed',
            maxRetries: 0
        });
        
        logSuccess(`BUY SENT: ${sig.slice(0, 8)}...${sig.slice(-8)}`);
        logInfo(`Amount: ${CONFIG.BUY_AMOUNT} SOL`);
        logInfo(`Tokens requested: ${CONFIG.TARGET_TOKENS.toLocaleString()}`);
        
        // 🔥 CRITICAL POST-BUY VERIFICATION
        logInfo('🔍 Verifying purchase in 5 seconds...');
        
        setTimeout(async () => {
            try {
                // Check if we received tokens
                const tokenBalance = await connection.getTokenAccountBalance(userTokenAccount);
                const receivedTokens = BigInt(tokenBalance.value.amount);
                const minExpectedTokens = BigInt(CONFIG.TARGET_TOKENS * 1000000 * 0.5); // At least 50% of expected tokens
                
                if (receivedTokens >= minExpectedTokens) {
                    logSuccess(`✅ BUY CONFIRMED! ${Number(receivedTokens).toLocaleString()} tokens received`);
                    // Start monitoring only if buy succeeded
                    await startTokenMonitoring(connection, tokenInfo.mint.toString(), activePositions, detectedTokens, wallet);
                } else {
                    logError(`❌ BUY FAILED! Only ${Number(receivedTokens).toLocaleString()} tokens received (expected: ${CONFIG.TARGET_TOKENS.toLocaleString()})`);
                    logWarning('🔄 Removing failed position...');
                    activePositions.delete(tokenInfo.mint.toString());
                }
                
            } catch (verifyError) {
                logError(`❌ BUY VERIFICATION ERROR: ${verifyError}`);
                logWarning('🔄 Removing failed position...');
                activePositions.delete(tokenInfo.mint.toString());
            }
        }, 5000);
        
        return true;
        
    } catch (error: any) {
        logError(`BUY FAILED: ${error.message?.slice(0, 200)}`);
        activePositions.delete(tokenInfo.mint.toString());
        return false;
    }
} 