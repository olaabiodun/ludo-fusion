const fs = require('fs');
const path = 'c:\\Users\\HP\\ludo\\components\\WalletPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update modalActions to column
content = content.replace(/modalActions: \{[\s\S]+?flexDirection: 'row',/, "modalActions: {\n    flexDirection: 'column',");

// Update modalCancel and modalConfirm to remove flex and set width
content = content.replace(/modalCancel: \{[\s\S]+?flex: 1,/, "modalCancel: {\n    width: '100%',");
content = content.replace(/modalConfirm: \{[\s\S]+?flex: 2,/, "modalConfirm: {\n    width: '100%',");

fs.writeFileSync(path, content);
console.log('Fixed button stack styles');
