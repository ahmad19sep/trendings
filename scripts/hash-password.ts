import { stdin, stdout } from "node:process";

import { hashPassword } from "../src/lib/auth/password";

async function readPipedInput(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trimEnd();
}

function readMasked(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("A TTY is required for an interactive password prompt."));
      return;
    }
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (chunk: string) => {
      if (chunk === "\u0003") {
        cleanup();
        stdout.write("\n");
        reject(new Error("Password prompt cancelled."));
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        cleanup();
        stdout.write("\n");
        resolve(value);
        return;
      }
      if (chunk === "\u007f" || chunk === "\b") {
        if (value.length) {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }
      value += chunk;
      stdout.write("*");
    };
    stdin.on("data", onData);
  });
}

async function main() {
  let password: string;
  if (stdin.isTTY) {
    password = await readMasked("Administrator password: ");
    const confirmation = await readMasked("Confirm password: ");
    if (password !== confirmation) throw new Error("Passwords do not match.");
  } else {
    password = await readPipedInput();
  }
  if (password.length < 12) {
    throw new Error("Use an administrator password with at least 12 characters.");
  }
  stdout.write(`${await hashPassword(password)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

