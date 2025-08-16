/**
 * Collection Dropdown Bug Fix Test Script
 * 
 * This script can be run in the browser console to test the collection
 * dropdown update functionality.
 * 
 * To use:
 * 1. Open the TargetVision app in browser
 * 2. Navigate to an album and open a photo modal
 * 3. Open browser console (F12)
 * 4. Copy and paste this script into the console
 * 5. Run testCollectionDropdownUpdate()
 */

// Test function to verify the collection dropdown update workflow
function testCollectionDropdownUpdate() {
    console.log('🧪 Starting Collection Dropdown Bug Fix Test...');
    
    // Check if EventBus is available
    if (typeof eventBus === 'undefined') {
        console.error('❌ EventBus not found. Make sure you are on the TargetVision app page.');
        return;
    }
    
    // Check if we can access the collections manager
    if (typeof collectionsManager === 'undefined') {
        console.error('❌ CollectionsManager not found. Module may not be loaded.');
        return;
    }
    
    // Test 1: Check if collection dropdown exists (modal should be open)
    const collectionSelect = document.getElementById('modal-collection-select');
    if (!collectionSelect) {
        console.warn('⚠️  Collection dropdown not found. Please open a photo modal first.');
        console.log('📝 To test: 1) Navigate to an album, 2) Click on a photo to open modal');
        return;
    }
    
    console.log('✅ Collection dropdown found');
    
    // Test 2: Get current collections count
    const currentOptions = collectionSelect.options.length;
    console.log(`📊 Current collections in dropdown: ${currentOptions - 1}`); // -1 for "Choose a collection..." option
    
    // Test 3: Simulate collection creation event
    console.log('🔄 Simulating collection creation...');
    
    const testCollection = {
        id: 999,
        name: `Test Collection ${new Date().getTime()}`,
        description: 'Created by test script',
        photo_count: 0
    };
    
    // Add test collection to collections array (simulate creation)
    if (collectionsManager.collections) {
        collectionsManager.collections.push(testCollection);
        console.log('✅ Test collection added to manager');
    }
    
    // Test 4: Trigger the refresh mechanism
    console.log('🔄 Triggering dropdown refresh...');
    eventBus.emit('collections:created', { collection: testCollection });
    
    // Test 5: Wait and verify dropdown updated
    setTimeout(() => {
        const newOptions = collectionSelect.options.length;
        console.log(`📊 Collections in dropdown after refresh: ${newOptions - 1}`);
        
        if (newOptions > currentOptions) {
            console.log('✅ SUCCESS: Dropdown updated successfully!');
            console.log('🎉 Collection dropdown bug fix is working correctly');
            
            // Verify our test collection is in the dropdown
            const testOption = Array.from(collectionSelect.options).find(opt => opt.textContent === testCollection.name);
            if (testOption) {
                console.log('✅ Test collection found in dropdown');
            } else {
                console.log('⚠️  Test collection not found in dropdown (but count increased)');
            }
        } else {
            console.log('❌ FAILED: Dropdown did not update');
            console.log('🔍 Check console for error messages');
        }
        
        // Cleanup: Remove test collection
        if (collectionsManager.collections) {
            const index = collectionsManager.collections.findIndex(c => c.id === 999);
            if (index > -1) {
                collectionsManager.collections.splice(index, 1);
                console.log('🧹 Test collection removed from manager');
            }
        }
        
    }, 200); // Wait for refresh delay + some buffer
}

// Function to monitor EventBus for collection events
function monitorCollectionEvents() {
    console.log('👁️  Monitoring collection events...');
    
    const events = [
        'collections:created',
        'collections:updated', 
        'collections:deleted',
        'collections:refresh-modal-dropdown'
    ];
    
    events.forEach(event => {
        eventBus.on(event, (data) => {
            console.log(`📡 Event received: ${event}`, data);
        });
    });
    
    console.log('✅ Event monitoring active for:', events.join(', '));
}

// Function to check current modal state
function checkModalState() {
    console.log('🔍 Checking modal state...');
    
    const photoModal = document.getElementById('photo-modal');
    const collectionSelect = document.getElementById('modal-collection-select');
    const createButton = document.querySelector('[onclick*="collections:create-from-modal"]');
    
    console.log('Modal open:', photoModal && !photoModal.classList.contains('hidden'));
    console.log('Collection dropdown present:', !!collectionSelect);
    console.log('Create collection button present:', !!createButton);
    
    if (collectionSelect) {
        console.log('Dropdown options count:', collectionSelect.options.length);
        console.log('Dropdown options:', Array.from(collectionSelect.options).map(opt => opt.textContent));
    }
}

// Main test execution
console.log('🚀 Collection Dropdown Test Suite Loaded');
console.log('📋 Available commands:');
console.log('  - testCollectionDropdownUpdate() - Test the dropdown refresh functionality');
console.log('  - monitorCollectionEvents() - Monitor EventBus for collection events');  
console.log('  - checkModalState() - Check current modal and dropdown state');
console.log('');
console.log('💡 Make sure to open a photo modal before running tests!');