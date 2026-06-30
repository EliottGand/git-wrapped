import { execFileSync } from 'node:child_process';

/** Best-effort copy to the OS clipboard. Returns true on success. */
export function copyToClipboard(text: string): boolean {
  const attempts: [string, string[]][] =
    process.platform === 'darwin'
      ? [['pbcopy', []]]
      : process.platform === 'win32'
        ? [['clip', []]]
        : [
            ['wl-copy', []],
            ['xclip', ['-selection', 'clipboard']],
            ['xsel', ['--clipboard', '--input']],
          ];
  for (const [cmd, args] of attempts) {
    try {
      execFileSync(cmd, args, { input: text });
      return true;
    } catch {
      // try next
    }
  }
  return false;
}
