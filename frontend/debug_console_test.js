// Debug test - run this in browser console
console.log('=== ProcessingPoller Debug Test ===');

// Test 1: Check if we can access the debug instance
if (window.debugProcessingPoller) {
    console.log('✅ ProcessingPoller instance found on window');
    console.log('Is polling active?', window.debugProcessingPoller.isActive());
    
    // Test manual trigger
    console.log('Testing manual trigger...');
    window.debugProcessingPoller.forceCheck();
} else {
    console.log('❌ ProcessingPoller instance NOT found on window');
}

// Test 2: Check EventBus
if (window.eventBus) {
    console.log('✅ EventBus found on window');
    
    // Test event emission
    console.log('Testing batch-started event emission...');
    window.eventBus.emit('processing:batch-started', { photoCount: 5 });
    
    setTimeout(() => {
        console.log('Checking polling status after event...');
        if (window.debugProcessingPoller) {
            console.log('Is polling active after event?', window.debugProcessingPoller.isActive());
        }
    }, 1000);
} else {
    console.log('❌ EventBus NOT found on window');
}

console.log('Debug test complete');