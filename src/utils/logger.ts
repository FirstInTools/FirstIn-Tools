import { colors } from '../config/constants';

export function logSuccess(message: string) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

export function logError(message: string) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

export function logWarning(message: string) {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

export function logInfo(message: string) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

export function logFire(message: string) {
    console.log(`${colors.bright}${colors.red}🔥 ${message}${colors.reset}`);
} 