export function random(from: number, to: number): number {
    return Math.floor(Math.random() * (to - from)) + from;
}

export function randomChar(
    chars: string = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
): string {
    return chars[random(0, chars.length - 1)]!;
}

export function randomStr(length: number = 5): string {
    if (length < 1) {
        length = 5;
    }

    let t = "";

    for (let i = 0; i < length; i++) {
        t += randomChar();
    }

    return t;
}
