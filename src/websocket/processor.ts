import { Connection, Keypair } from '@solana/web3.js';
import { PUMP_FUN_PROGRAM_ID, CONFIG, colors } from '../config/constants';
import { logError, logWarning, logFire } from '../utils/logger';
import { decodeCreateTransaction } from './decoder';
import { checkTokenRatio } from '../trading/ratio';
import { executeBuy } from '../trading/buy';

// Processing CREATE transactions
export async function processCreateTransaction(
    connection: Connection, 
    signature: string, 
    candidateTokens: Map<string, any>, 
    detectedTokens: Map<string, any>, 
    activePositions: Map<string, any>,
    wallet: Keypair
) {
    try {
        const tx = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });
        
        if (!tx?.transaction?.message || !tx.meta) {
            return;
        }
        
        const now = Math.floor(Date.now() / 1000);
        const txAge = now - (tx.blockTime || 0);
        
        if (txAge > CONFIG.MAX_TX_AGE) {
            return;
        }
        
        const accountKeys = tx.transaction.message.getAccountKeys().staticAccountKeys;
        const instructions = tx.transaction.message.compiledInstructions;
        
        for (const instruction of instructions) {
            const programId = accountKeys[instruction.programIdIndex];
            
            if (programId.equals(PUMP_FUN_PROGRAM_ID)) {
                const instructionData = Buffer.from(instruction.data);
                const createData = decodeCreateTransaction(instructionData);
                
                if (createData) {
                    const accounts = instruction.accountKeyIndexes.map((index: number) => accountKeys[index]);
                    
                    if (accounts.length >= 8) {
                        const mint = accounts[0];
                        const curve = accounts[2];
                        const creator = accounts[7];
                        
                        if (CONFIG.SCAN_MODE) {
                            // 🎯 SCANNER MODE: Collect candidates
                            if (!candidateTokens.has(mint.toString())) {
                                candidateTokens.set(mint.toString(), {
                                    mint,
                                    curve,
                                    creator,
                                    name: createData.name,
                                    symbol: createData.symbol,
                                    timestamp: Date.now()
                                });
                            }
                        } else {
                            // 🎯 RUSH MODE: Instant buy (old behavior)
                            console.log(`\n${colors.bright}${colors.magenta}🎯 NEW TOKEN DISCOVERED!${colors.reset}`);
                            console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────┐${colors.reset}`);
                            console.log(`${colors.cyan}│${colors.reset} 🪙 Name: ${colors.bright}${createData.name}${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
                            console.log(`${colors.cyan}│${colors.reset} 🏷️  Symbol: ${colors.bright}${createData.symbol}${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
                            console.log(`${colors.cyan}│${colors.reset} 🔑 Mint: ${colors.yellow}${mint.toString().slice(0, 8)}...${mint.toString().slice(-8)}${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
                            console.log(`${colors.cyan}│${colors.reset} 👤 Creator: ${colors.yellow}${creator.toString().slice(0, 8)}...${creator.toString().slice(-8)}${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
                            console.log(`${colors.cyan}│${colors.reset} ⏱️  Age: ${colors.green}${txAge}s${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
                            console.log(`${colors.cyan}└─────────────────────────────────────────────────────────┘${colors.reset}`);
                            
                            const tokenInfo = {
                                mint,
                                curve,
                                creator,
                                name: createData.name,
                                symbol: createData.symbol
                            };
                            
                            // Store token info
                            detectedTokens.set(mint.toString(), {
                                mint,
                                curve,
                                creator,
                                timestamp: Date.now()
                            });
                            
                            // Ratio verification and instant buy
                            if (CONFIG.INSTANT_BUY) {
                                const ratioOk = await checkTokenRatio(connection, curve);
                                if (!ratioOk) {
                                    logWarning(`❌ Token ${tokenInfo.symbol} avoided - insufficient tokens/SOL ratio!`);
                                    console.log(`${colors.red}❌ Insufficient ratio for ${tokenInfo.symbol}${colors.reset}\n`);
                                    return;
                                }
                                
                                // Clean token, ratio OK, buy immediately
                                logFire('INSTANT BUY TRIGGERED! 🎯');
                                await executeBuy(connection, tokenInfo, activePositions, detectedTokens, wallet);
                            }
                        }
                        
                        return;
                    }
                }
            }
        }
        
    } catch (error) {
        logError(`CREATE processing error: ${error}`);
    }
} 