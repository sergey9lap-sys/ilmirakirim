import { randomBytes, scryptSync } from 'node:crypto';

let password = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/[\r\n]+$/, '');
if (password.length < 16) {
  console.error('Пароль должен содержать не менее 16 символов');
  process.exitCode = 1;
} else {
  const salt = randomBytes(16);
  process.stdout.write(`${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}\n`);
}
