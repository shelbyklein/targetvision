// Simple test to trigger polling via browser console
// Copy and paste this into browser console to test

console.log('=== Testing PhotoProcessor Polling ===');

// Test manual status refresh
if (window.eventBus) {
    console.log('Testing manual refresh event...');
    window.eventBus.emit('photos:refresh-status');
    
    setTimeout(() => {
        console.log('Test complete - check for polling console messages');
    }, 2000);
} else {
    console.log('EventBus not found');
}

console.log('Test script loaded - should see polling messages if working');