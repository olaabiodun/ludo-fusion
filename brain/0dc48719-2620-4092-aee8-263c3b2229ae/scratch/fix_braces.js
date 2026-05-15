const fs = require('fs');
const path = 'c:\\Users\\HP\\ludo\\components\\WalletPanel.tsx';
let content = fs.readFileSync(path, 'utf8');
let lines = content.split(/\r?\n/);
if (lines[lines.length - 2].trim() === '},' && lines[lines.length - 1].trim() === '});') {
    lines.splice(lines.length - 2, 1);
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Fixed');
} else {
    console.log('Not matched', lines.slice(-3));
}
