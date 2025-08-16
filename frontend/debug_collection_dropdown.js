/**
 * Collection Dropdown Debug Script
 * 
 * This script focuses specifically on debugging the collection dropdown refresh issue.
 */

function debugCollectionDropdown() {
    console.log('=== Collection Dropdown Debug Analysis ===');
    
    // 1. Check if collection dropdown exists
    const dropdown = document.getElementById('modal-collection-select');
    console.log('1. Collection dropdown element:', dropdown);
    
    if (!dropdown) {
        console.error('❌ Collection dropdown not found! Modal may not be open.');
        return;
    }
    
    // 2. Check current options
    const options = dropdown.querySelectorAll('option');
    console.log(`2. Current dropdown has ${options.length} options:`);
    options.forEach((option, index) => {
        console.log(`   ${index}: "${option.textContent}" (value: ${option.value})`);
    });
    
    // 3. Test API connectivity
    console.log('3. Testing API connectivity...');
    fetch('http://localhost:8000/collections')
        .then(response => response.json())
        .then(collections => {
            console.log(`✅ API returned ${collections.length} collections:`);
            collections.forEach((collection, index) => {
                console.log(`   ${index}: "${collection.name}" (id: ${collection.id})`);
            });
            
            // Compare API data vs dropdown
            console.log('4. Comparing API data vs dropdown options...');
            const apiCollectionNames = collections.map(c => c.name);
            const dropdownNames = Array.from(options).slice(1).map(o => o.textContent); // Skip first "Choose..." option
            
            console.log('API collections:', apiCollectionNames);
            console.log('Dropdown collections:', dropdownNames);
            
            // Find missing collections
            const missingInDropdown = apiCollectionNames.filter(name => !dropdownNames.includes(name));
            const extraInDropdown = dropdownNames.filter(name => !apiCollectionNames.includes(name));
            
            if (missingInDropdown.length > 0) {
                console.error('❌ Collections missing from dropdown:', missingInDropdown);
            }
            
            if (extraInDropdown.length > 0) {
                console.warn('⚠️ Extra collections in dropdown:', extraInDropdown);
            }
            
            if (missingInDropdown.length === 0 && extraInDropdown.length === 0) {
                console.log('✅ Dropdown and API data match perfectly!');
            }
        })
        .catch(error => {
            console.error('❌ API request failed:', error);
        });
    
    // 4. Check EventBus functionality
    console.log('5. Testing EventBus...');
    if (typeof eventBus !== 'undefined') {
        console.log('✅ EventBus is available');
        
        // Test event emission
        console.log('Testing collections:refresh-modal-dropdown event...');
        eventBus.emit('collections:refresh-modal-dropdown');
        console.log('✅ Event emitted');
        
    } else {
        console.error('❌ EventBus not available');
    }
    
    // 5. Check CollectionsManager
    console.log('6. Checking CollectionsManager...');
    if (typeof collectionsManager !== 'undefined') {
        console.log('✅ CollectionsManager is available');
        console.log('Current collections in manager:', collectionsManager.getCollections().length);
        
        // Test manual refresh
        console.log('Testing manual collections refresh...');
        collectionsManager.loadCollections().then(() => {
            console.log('✅ Collections loaded');
            collectionsManager.populateCollectionSelect();
            console.log('✅ Dropdown populated');
            
            // Check again
            const newOptions = dropdown.querySelectorAll('option');
            console.log(`Dropdown now has ${newOptions.length} options:`);
            newOptions.forEach((option, index) => {
                console.log(`   ${index}: "${option.textContent}" (value: ${option.value})`);
            });
        }).catch(error => {
            console.error('❌ Error loading collections:', error);
        });
        
    } else {
        console.error('❌ CollectionsManager not available');
    }
    
    console.log('=== Debug Analysis Complete ===');
}

// Test collection creation and immediate dropdown refresh
async function testCollectionCreationAndRefresh() {
    console.log('=== Testing Collection Creation and Dropdown Refresh ===');
    
    const testName = `Debug Test ${Date.now()}`;
    
    try {
        // 1. Record current dropdown state
        const dropdown = document.getElementById('modal-collection-select');
        if (!dropdown) {
            console.error('❌ Dropdown not found - modal may not be open');
            return;
        }
        
        const optionsBefore = dropdown.querySelectorAll('option').length;
        console.log(`1. Dropdown has ${optionsBefore} options before creation`);
        
        // 2. Create collection via API
        console.log(`2. Creating collection "${testName}" via API...`);
        const response = await fetch(`http://localhost:8000/collections?name=${encodeURIComponent(testName)}&description=Debug test`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Collection created via API:', result.collection);
        
        // 3. Check dropdown immediately (before any refresh)
        const optionsAfterAPI = dropdown.querySelectorAll('option').length;
        console.log(`3. Dropdown has ${optionsAfterAPI} options after API call (before refresh)`);
        
        // 4. Manually trigger refresh methods
        console.log('4. Testing refresh methods...');
        
        // Method 1: EventBus refresh
        if (typeof eventBus !== 'undefined') {
            console.log('   - Testing EventBus refresh...');
            eventBus.emit('collections:refresh-modal-dropdown');
            
            // Check after event
            setTimeout(() => {
                const optionsAfterEvent = dropdown.querySelectorAll('option').length;
                console.log(`   - Dropdown has ${optionsAfterEvent} options after EventBus refresh`);
            }, 100);
        }
        
        // Method 2: Direct CollectionsManager refresh
        if (typeof collectionsManager !== 'undefined') {
            console.log('   - Testing CollectionsManager direct refresh...');
            await collectionsManager.loadCollections();
            collectionsManager.populateCollectionSelect();
            
            const optionsAfterDirect = dropdown.querySelectorAll('option').length;
            console.log(`   - Dropdown has ${optionsAfterDirect} options after direct refresh`);
            
            // List all options
            const options = dropdown.querySelectorAll('option');
            console.log('   - Current options:');
            options.forEach((option, index) => {
                console.log(`     ${index}: "${option.textContent}" (value: ${option.value})`);
            });
            
            // Check if our test collection is there
            const found = Array.from(options).some(option => option.textContent === testName);
            if (found) {
                console.log(`✅ Test collection "${testName}" found in dropdown!`);
            } else {
                console.error(`❌ Test collection "${testName}" NOT found in dropdown!`);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
    
    console.log('=== Test Complete ===');
}

// Quick test to see what happens when form is submitted
function testFormSubmission() {
    console.log('=== Testing Form Submission Flow ===');
    
    // Check if creation modal is open
    const modal = document.getElementById('create-collection-modal');
    const form = document.getElementById('create-collection-form');
    
    if (!modal || modal.classList.contains('hidden')) {
        console.error('❌ Collection creation modal is not open');
        return;
    }
    
    if (!form) {
        console.error('❌ Collection creation form not found');
        return;
    }
    
    console.log('✅ Form and modal found');
    
    // Check form inputs
    const nameInput = document.getElementById('collection-name');
    const descInput = document.getElementById('collection-description');
    
    if (!nameInput || !descInput) {
        console.error('❌ Form inputs not found');
        return;
    }
    
    // Fill form
    const testName = `Form Test ${Date.now()}`;
    nameInput.value = testName;
    descInput.value = 'Form submission test';
    
    console.log(`✅ Form filled with name: "${testName}"`);
    
    // Monitor what happens on submit
    console.log('Monitoring form submission...');
    
    // Intercept form submission
    const originalSubmit = form.onsubmit;
    form.onsubmit = function(e) {
        console.log('📝 Form submit event captured');
        console.log('Event details:', e);
        
        // Call original handler if it exists
        if (originalSubmit) {
            return originalSubmit.call(this, e);
        }
        
        return true;
    };
    
    // Submit the form
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);
    
    console.log('✅ Form submission event dispatched');
}

// Export functions
window.debugCollectionDropdown = debugCollectionDropdown;
window.testCollectionCreationAndRefresh = testCollectionCreationAndRefresh;
window.testFormSubmission = testFormSubmission;

console.log('Collection dropdown debug script loaded.');
console.log('Available functions:');
console.log('- debugCollectionDropdown() - Analyze current dropdown state');
console.log('- testCollectionCreationAndRefresh() - Test creation and refresh flow');
console.log('- testFormSubmission() - Test form submission (modal must be open)');