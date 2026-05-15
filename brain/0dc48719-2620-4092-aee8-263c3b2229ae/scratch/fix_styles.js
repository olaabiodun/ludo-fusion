const fs = require('fs');
const path = 'c:\\Users\\HP\\ludo\\components\\WalletPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

const newStyles = `  modalMainRow: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  modalLeftCol: {
    flex: 1.1,
    gap: 20,
  },
  modalRightCol: {
    flex: 1,
  },
  numpadContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  numpadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  numpadKey: {
    width: '31%',
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  numpadKeyText: {
    color: C.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
});`;

// Find everything from "// ── Custom Numpad Styles ──" to the end
const index = content.indexOf('// ── Custom Numpad Styles ──');
if (index !== -1) {
    content = content.substring(0, index) + '// ── Custom Numpad Styles ──\n' + newStyles;
    fs.writeFileSync(path, content);
    console.log('Fixed styles');
} else {
    console.log('Not found marker');
}
