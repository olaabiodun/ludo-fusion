document.addEventListener('DOMContentLoaded', () => {
    // INITIALIZE NAVIGATION PILL
    initTabSlider();

    // LISTENERS FOR RESIZING
    window.addEventListener('resize', () => {
        positionTabIndicator(document.querySelector('.tab-trigger.active'));
    });
});

/*------------------------------------------------------------------
[SLIDING TAB TRIGGER CONTROLLER]
-------------------------------------------------------------------*/
function initTabSlider() {
    const tabsContainer = document.getElementById('nav-tabs-container');
    if (!tabsContainer) return;

    const triggers = tabsContainer.querySelectorAll('.tab-trigger');
    
    // Auto-align pill on load
    const activeTab = tabsContainer.querySelector('.tab-trigger.active');
    if (activeTab) {
        // Short delay to ensure browser completed initial layout calculations
        setTimeout(() => positionTabIndicator(activeTab), 100);
    }

    triggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            const targetTab = trigger.getAttribute('data-tab');
            
            // Set active class
            triggers.forEach(t => t.classList.remove('active'));
            trigger.classList.add('active');
            
            // Reposition indicator
            positionTabIndicator(trigger);

            // Display panel
            switchTabPanel(targetTab);
        });
    });
}

function positionTabIndicator(triggerElement) {
    const indicator = document.getElementById('tab-indicator');
    if (!indicator || !triggerElement) return;

    indicator.style.left = `${triggerElement.offsetLeft}px`;
    indicator.style.width = `${triggerElement.offsetWidth}px`;
}

function switchTabPanel(panelId) {
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(p => {
        p.classList.remove('active');
    });

    const activePanel = document.getElementById(panelId);
    if (activePanel) {
        activePanel.classList.add('active');
    }

    // Scroll to the content card safely
    const frame = document.querySelector('.content-frame');
    if (frame) {
        window.scrollTo({
            top: frame.offsetTop - 40,
            behavior: 'smooth'
        });
    }
}

// Global direct navigation redirect
function switchTabDirect(panelId) {
    let triggerDataAttr = 'tab-home';
    if (panelId === 'tab-privacy') triggerDataAttr = 'tab-privacy';
    else if (panelId === 'tab-deletion') triggerDataAttr = 'tab-deletion';
    else if (panelId === 'tab-support') triggerDataAttr = 'tab-support';

    const trigger = document.querySelector(`.tab-trigger[data-tab="${triggerDataAttr}"]`);
    if (trigger) {
        trigger.click();
    }
}

/*------------------------------------------------------------------
[3D PHYSICS PREMIUM DICE ROLLING]
-------------------------------------------------------------------*/
const premiumDotPlacements = {
    1: ['dot-center'],
    2: ['dot-t-left', 'dot-b-right'],
    3: ['dot-t-left', 'dot-center', 'dot-b-right'],
    4: ['dot-t-left', 'dot-t-right', 'dot-b-left', 'dot-b-right'],
    5: ['dot-t-left', 'dot-t-right', 'dot-center', 'dot-b-left', 'dot-b-right'],
    6: ['dot-t-left', 'dot-t-right', 'dot-m-left', 'dot-m-right', 'dot-b-left', 'dot-b-right']
};

let diceRollingLock = false;

function rollPremiumDie() {
    if (diceRollingLock) return;

    diceRollingLock = true;
    const wrapper = document.getElementById('home-die');
    const face = document.getElementById('die-face-body');
    
    if (!wrapper || !face) return;

    // Trigger high-fidelity 3D spin class
    wrapper.classList.add('dice-spinning-3d');

    // Simulate dice rolling physics
    setTimeout(() => {
        wrapper.classList.remove('dice-spinning-3d');

        // Roll outcome
        const rollValue = Math.floor(Math.random() * 6) + 1;
        
        // Re-render dots
        face.innerHTML = '';
        const dots = premiumDotPlacements[rollValue];
        
        dots.forEach(dotClass => {
            const span = document.createElement('span');
            span.className = `die-dot ${dotClass}`;
            face.appendChild(span);
        });

        diceRollingLock = false;
    }, 750); // Matches the CSS transition duration precisely
}

/*------------------------------------------------------------------
[FORM CONTROLLERS: DATA ERASURE & TICKETS]
-------------------------------------------------------------------*/
function handleDeletionSubmit(event) {
    event.preventDefault();
    
    const emailField = document.getElementById('del-email');
    const form = document.getElementById('deletion-form-premium');
    const successBox = document.getElementById('deletion-premium-success');
    const deleteEmailLabel = document.getElementById('delete-target-email');

    if (emailField && deleteEmailLabel) {
        deleteEmailLabel.textContent = emailField.value;
    }

    if (form && successBox) {
        form.classList.add('hidden');
        successBox.classList.remove('hidden');
    }
}

function resetDeletionForm() {
    const form = document.getElementById('deletion-form-premium');
    const successBox = document.getElementById('deletion-premium-success');
    
    if (form && successBox) {
        form.reset();
        form.classList.remove('hidden');
        successBox.classList.add('hidden');
    }
}

function handleSupportSubmit(event) {
    event.preventDefault();
    
    const form = document.getElementById('support-form-premium');
    const successBox = document.getElementById('support-premium-success');

    if (form && successBox) {
        form.classList.add('hidden');
        successBox.classList.remove('hidden');
    }
}

function resetSupportForm() {
    const form = document.getElementById('support-form-premium');
    const successBox = document.getElementById('support-premium-success');
    
    if (form && successBox) {
        form.reset();
        form.classList.remove('hidden');
        successBox.classList.add('hidden');
    }
}
