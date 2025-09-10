// Test script to verify search API and DOM interaction
// This simulates what happens when a user performs a search

console.log('Testing Search API and DOM interaction...');

// Test 1: API Call
async function testSearchAPI() {
    try {
        const response = await fetch('http://localhost:8000/search?q=archery&search_type=hybrid&limit=20');
        const data = await response.json();
        
        console.log('✅ Search API Response:');
        console.log(`- Results found: ${data.results}`);
        console.log(`- Photos returned: ${data.photos?.length || 0}`);
        console.log(`- First photo: ${data.photos?.[0]?.photo?.title || 'N/A'}`);
        
        return data;
    } catch (error) {
        console.error('❌ Search API Error:', error);
        return null;
    }
}

// Test 2: DOM Element Analysis
function analyzeDOMElements() {
    console.log('\n🔍 DOM Element Analysis:');
    
    const container = document.getElementById('search-results-container');
    const grid = document.getElementById('search-results-grid');
    
    if (!container) {
        console.error('❌ search-results-container not found');
        return;
    }
    
    if (!grid) {
        console.error('❌ search-results-grid not found');
        return;
    }
    
    // Get computed styles
    const containerStyles = window.getComputedStyle(container);
    const gridStyles = window.getComputedStyle(grid);
    
    console.log('📦 Container Styles:');
    console.log(`- overflow: ${containerStyles.overflow}`);
    console.log(`- overflow-y: ${containerStyles.overflowY}`);
    console.log(`- height: ${containerStyles.height}`);
    console.log(`- max-height: ${containerStyles.maxHeight}`);
    console.log(`- Classes: ${container.className}`);
    
    console.log('\n📋 Grid Styles:');
    console.log(`- overflow: ${gridStyles.overflow}`);
    console.log(`- overflow-y: ${gridStyles.overflowY}`);
    console.log(`- height: ${gridStyles.height}`);
    console.log(`- max-height: ${gridStyles.maxHeight}`);
    console.log(`- Classes: ${grid.className}`);
    
    return { container, grid, containerStyles, gridStyles };
}

// Test 3: Simulate Search Results Population
function simulateSearchResults(searchData) {
    if (!searchData?.photos) {
        console.log('⚠️ No search data to simulate');
        return;
    }
    
    console.log('\n🎯 Simulating Search Results Population...');
    
    const grid = document.getElementById('search-results-grid');
    const gridContainer = grid?.querySelector('.grid');
    
    if (!gridContainer) {
        console.error('❌ Grid container not found');
        return;
    }
    
    // Clear existing content
    gridContainer.innerHTML = '';
    
    // Create cards (similar to SearchManager.createSearchResultCard)
    searchData.photos.forEach((result, index) => {
        const photo = result.photo || result;
        const card = document.createElement('div');
        card.className = 'search-result-card relative group cursor-pointer bg-gray-100 rounded-lg overflow-hidden';
        card.style.aspectRatio = '1';
        card.innerHTML = `
            <div class="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                Photo ${index + 1}<br/>
                ${photo.title || 'Untitled'}
            </div>
        `;
        gridContainer.appendChild(card);
    });
    
    // Show the grid
    grid.classList.remove('hidden');
    
    console.log(`✅ Added ${searchData.photos.length} photo cards to grid`);
    
    // Test scrolling
    setTimeout(() => testScrolling(gridContainer), 100);
}

// Test 4: Scrolling Behavior
function testScrolling(gridContainer) {
    console.log('\n📜 Testing Scrolling Behavior...');
    
    const container = document.getElementById('search-results-container');
    const grid = document.getElementById('search-results-grid');
    
    // Get dimensions
    const containerHeight = container.offsetHeight;
    const containerScrollHeight = container.scrollHeight;
    const gridHeight = grid.offsetHeight;
    const gridScrollHeight = grid.scrollHeight;
    
    console.log('📏 Dimensions:');
    console.log(`- Container height: ${containerHeight}px`);
    console.log(`- Container scroll height: ${containerScrollHeight}px`);
    console.log(`- Grid height: ${gridHeight}px`);
    console.log(`- Grid scroll height: ${gridScrollHeight}px`);
    
    // Check if content overflows
    const containerOverflows = containerScrollHeight > containerHeight;
    const gridOverflows = gridScrollHeight > gridHeight;
    
    console.log('\n🔄 Overflow Analysis:');
    console.log(`- Container content overflows: ${containerOverflows}`);
    console.log(`- Grid content overflows: ${gridOverflows}`);
    
    // Test scroll capability
    const containerCanScroll = container.scrollHeight > container.clientHeight && 
                               getComputedStyle(container).overflowY !== 'hidden';
    const gridCanScroll = grid.scrollHeight > grid.clientHeight && 
                          getComputedStyle(grid).overflowY !== 'hidden';
    
    console.log('\n⬇️ Scroll Capability:');
    console.log(`- Container can scroll: ${containerCanScroll}`);
    console.log(`- Grid can scroll: ${gridCanScroll}`);
    
    // Final diagnosis
    if (containerOverflows && !containerCanScroll) {
        console.log('\n❌ ISSUE CONFIRMED: Content overflows but cannot scroll!');
        console.log('💡 SOLUTION: Change overflow-hidden to overflow-y-auto on container');
    } else if (containerCanScroll) {
        console.log('\n✅ SCROLLING WORKS: Content can be scrolled properly');
    } else {
        console.log('\n✅ NO OVERFLOW: Content fits within container');
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting comprehensive search scrolling tests...\n');
    
    // Test API
    const searchData = await testSearchAPI();
    
    // Analyze DOM
    const domAnalysis = analyzeDOMElements();
    
    // Simulate results if we have data
    if (searchData && domAnalysis) {
        simulateSearchResults(searchData);
    }
    
    console.log('\n✅ All tests completed!');
}

// Auto-run if this script is loaded directly
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAllTests);
    } else {
        runAllTests();
    }
}

export { runAllTests, testSearchAPI, analyzeDOMElements, simulateSearchResults, testScrolling };