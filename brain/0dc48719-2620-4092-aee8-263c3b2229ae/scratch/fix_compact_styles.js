const fs = require('fs');
const path = 'c:\\Users\\HP\\ludo\\components\\WalletPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

const newStyles = `  modalMainRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  modalLeftCol: {
    flex: 1.2,
    gap: 12,
  },
  modalRightCol: {
    flex: 1,
  },
  numpadContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  numpadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  numpadKey: {
    width: '31%',
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  numpadKeyText: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});`;

const index = content.indexOf('modalMainRow: {');
if (index !== -1) {
    content = content.substring(0, index) + newStyles;
    fs.writeFileSync(path, content);
    console.log('Fixed compact styles');
} else {
    console.log('Not found modalMainRow');
}
