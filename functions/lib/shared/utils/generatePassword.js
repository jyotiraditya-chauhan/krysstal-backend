import { randomInt } from 'node:crypto';
const LOWERCASE = 'abcdefghijkmnpqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';
const ALL = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS;
function pick(charset) {
    return charset[randomInt(charset.length)];
}
export function generateTempPassword(length = 12) {
    const required = [pick(LOWERCASE), pick(UPPERCASE), pick(DIGITS), pick(SYMBOLS)];
    const rest = Array.from({ length: Math.max(0, length - required.length) }, () => pick(ALL));
    const chars = [...required, ...rest];
    for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}
//# sourceMappingURL=generatePassword.js.map