/**
 * Comprehensive Collection Creation Test Report
 * 
 * This script will test the collection creation workflow and generate a detailed report
 * that can be run in the browser console to diagnose issues.
 */

class CollectionWorkflowTester {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.steps = [];
        this.networkRequests = [];
        this.startTime = Date.now();
        
        // Capture console errors
        this.originalConsoleError = console.error;
        console.error = (...args) => {
            this.errors.push({
                timestamp: Date.now() - this.startTime,
                message: args.join(' '),
                stack: new Error().stack
            });
            this.originalConsoleError.apply(console, args);
        };
        
        // Capture network requests
        this.interceptNetworkRequests();
    }
    
    interceptNetworkRequests() {
        const self = this;
        
        // Intercept fetch requests
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const startTime = Date.now();
            self.networkRequests.push({
                type: 'fetch',
                url: args[0],
                options: args[1],
                timestamp: startTime - self.startTime,
                status: 'pending'
            });
            
            return originalFetch.apply(this, args)
                .then(response => {
                    const requestIndex = self.networkRequests.length - 1;
                    self.networkRequests[requestIndex].status = response.status;
                    self.networkRequests[requestIndex].duration = Date.now() - startTime;
                    self.networkRequests[requestIndex].response = response.clone();
                    return response;
                })
                .catch(error => {
                    const requestIndex = self.networkRequests.length - 1;
                    self.networkRequests[requestIndex].status = 'error';
                    self.networkRequests[requestIndex].error = error.message;
                    self.networkRequests[requestIndex].duration = Date.now() - startTime;
                    throw error;
                });
        };
    }
    
    addStep(description, status = 'info', details = null) {
        this.steps.push({
            timestamp: Date.now() - this.startTime,
            description,
            status,
            details
        });
        console.log(`${status.toUpperCase()}: ${description}`, details || '');
    }
    
    async waitFor(condition, timeout = 5000, interval = 100) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (await condition()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        return false;
    }
    
    async testCollectionCreationWorkflow() {
        this.addStep('Starting collection creation workflow test');
        
        try {
            // Step 1: Check initial state
            await this.checkInitialState();
            
            // Step 2: Navigate to albums and select one with photos
            await this.navigateToAlbumWithPhotos();
            
            // Step 3: Open photo modal
            await this.openPhotoModal();
            
            // Step 4: Test collection interface
            await this.testCollectionInterface();
            
            // Step 5: Create new collection
            await this.createNewCollection();
            
            // Step 6: Verify collection appears in dropdown
            await this.verifyCollectionInDropdown();
            
            this.addStep('Collection creation workflow test completed', 'success');
            
        } catch (error) {
            this.addStep(`Test failed: ${error.message}`, 'error', error);
        }
        
        return this.generateReport();
    }
    
    async checkInitialState() {
        this.addStep('Checking initial application state');
        
        // Check if main elements exist
        const requiredElements = [
            'nav-albums',
            'nav-collections', 
            'create-collection-modal',
            'photo-modal'
        ];
        
        for (const elementId of requiredElements) {
            const element = document.getElementById(elementId);
            if (!element) {
                throw new Error(`Required element not found: ${elementId}`);
            }
        }
        
        this.addStep('Initial state check passed', 'success');
    }
    
    async navigateToAlbumWithPhotos() {
        this.addStep('Navigating to albums tab');
        
        const albumsTab = document.getElementById('nav-albums');
        albumsTab.click();
        
        // Wait for albums to load
        const albumsLoaded = await this.waitFor(() => {
            const albumItems = document.querySelectorAll('.album-item');
            return albumItems.length > 0;
        });
        
        if (!albumsLoaded) {
            throw new Error('Albums did not load within timeout');
        }
        
        this.addStep(`Found ${document.querySelectorAll('.album-item').length} albums`);
        
        // Find album with photos
        const albumItems = document.querySelectorAll('.album-item');
        let albumWithPhotos = null;
        
        for (const album of albumItems) {
            const photoCountEl = album.querySelector('.photo-count');
            if (photoCountEl && parseInt(photoCountEl.textContent) > 0) {
                albumWithPhotos = album;
                break;
            }
        }
        
        if (!albumWithPhotos) {
            throw new Error('No albums with photos found');
        }
        
        const albumTitle = albumWithPhotos.querySelector('.album-title')?.textContent || 'Unknown';
        this.addStep(`Selected album with photos: ${albumTitle}`);
        
        albumWithPhotos.click();
        
        // Wait for photos to load
        const photosLoaded = await this.waitFor(() => {
            const photoThumbnails = document.querySelectorAll('.photo-thumbnail');
            return photoThumbnails.length > 0;
        });
        
        if (!photosLoaded) {
            throw new Error('Photos did not load within timeout');
        }
        
        this.addStep(`Photos loaded: ${document.querySelectorAll('.photo-thumbnail').length} photos found`);
    }
    
    async openPhotoModal() {
        this.addStep('Opening photo modal');
        
        const photoThumbnails = document.querySelectorAll('.photo-thumbnail');
        if (photoThumbnails.length === 0) {
            throw new Error('No photo thumbnails found');
        }
        
        photoThumbnails[0].click();
        
        // Wait for modal to open
        const modalOpened = await this.waitFor(() => {
            const photoModal = document.getElementById('photo-modal');
            return photoModal && !photoModal.classList.contains('hidden');
        });
        
        if (!modalOpened) {
            throw new Error('Photo modal did not open');
        }
        
        this.addStep('Photo modal opened successfully', 'success');
    }
    
    async testCollectionInterface() {
        this.addStep('Testing collection interface');
        
        // Check if collections section exists
        const collectionsSection = document.getElementById('modal-collections-section');
        if (!collectionsSection) {
            throw new Error('Collections section not found in modal');
        }
        
        // Click "Add to Collection" button
        const addToCollectionBtn = document.getElementById('modal-add-to-collection');
        if (!addToCollectionBtn) {
            throw new Error('Add to Collection button not found');
        }
        
        addToCollectionBtn.click();
        
        // Wait for collection interface to appear
        const interfaceShown = await this.waitFor(() => {
            const collectionInterface = document.getElementById('modal-collection-interface');
            return collectionInterface && !collectionInterface.classList.contains('hidden');
        });
        
        if (!interfaceShown) {
            throw new Error('Collection interface did not appear');
        }
        
        this.addStep('Collection interface displayed successfully', 'success');
        
        // Check dropdown state
        const collectionSelect = document.getElementById('modal-collection-select');
        if (!collectionSelect) {
            throw new Error('Collection dropdown not found');
        }
        
        const options = collectionSelect.querySelectorAll('option');
        this.addStep(`Collection dropdown has ${options.length} options`);
        
        // Log current options
        options.forEach((option, index) => {
            this.addStep(`Option ${index}: "${option.textContent}" (value: ${option.value})`, 'info');
        });
    }
    
    async createNewCollection() {
        this.addStep('Creating new collection');
        
        // Click "Create New Collection" button
        const createCollectionBtn = document.getElementById('modal-create-collection');
        if (!createCollectionBtn) {
            throw new Error('Create Collection button not found');
        }
        
        // Record network requests before creation
        const requestCountBefore = this.networkRequests.length;
        
        createCollectionBtn.click();
        
        // Wait for creation modal to open
        const creationModalOpened = await this.waitFor(() => {
            const createCollectionModal = document.getElementById('create-collection-modal');
            return createCollectionModal && !createCollectionModal.classList.contains('hidden');
        });
        
        if (!creationModalOpened) {
            throw new Error('Collection creation modal did not open');
        }
        
        this.addStep('Collection creation modal opened', 'success');
        
        // Fill form
        const testName = `Test Collection ${Date.now()}`;
        const testDesc = 'Test collection from automated workflow test';
        
        const nameInput = document.getElementById('collection-name');
        const descInput = document.getElementById('collection-description');
        
        if (!nameInput || !descInput) {
            throw new Error('Collection form inputs not found');
        }
        
        nameInput.value = testName;
        descInput.value = testDesc;
        
        this.addStep(`Form filled with name: "${testName}"`);
        
        // Submit form
        const createForm = document.getElementById('create-collection-form');
        if (!createForm) {
            throw new Error('Collection creation form not found');
        }
        
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        createForm.dispatchEvent(submitEvent);
        
        this.addStep('Collection creation form submitted');
        
        // Wait for submission to complete and modal to close
        const modalClosed = await this.waitFor(() => {
            const createCollectionModal = document.getElementById('create-collection-modal');
            return createCollectionModal.classList.contains('hidden');
        }, 10000);
        
        if (!modalClosed) {
            this.addStep('Collection creation modal still open after 10s', 'warning');
        } else {
            this.addStep('Collection creation modal closed', 'success');
        }
        
        // Check for new network requests
        const newRequests = this.networkRequests.slice(requestCountBefore);
        this.addStep(`${newRequests.length} network requests made during collection creation`);
        
        newRequests.forEach((request, index) => {
            this.addStep(`Request ${index + 1}: ${request.url} - Status: ${request.status}`, 'info', request);
        });
        
        this.testCollectionName = testName;
    }
    
    async verifyCollectionInDropdown() {
        this.addStep('Verifying new collection appears in dropdown');
        
        // Wait a bit for any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const collectionSelect = document.getElementById('modal-collection-select');
        if (!collectionSelect) {
            throw new Error('Collection dropdown not found');
        }
        
        const options = collectionSelect.querySelectorAll('option');
        this.addStep(`Collection dropdown now has ${options.length} options`);
        
        // Check if our new collection is in the dropdown
        let found = false;
        options.forEach((option, index) => {
            this.addStep(`Option ${index}: "${option.textContent}" (value: ${option.value})`, 'info');
            if (option.textContent === this.testCollectionName) {
                found = true;
            }
        });
        
        if (found) {
            this.addStep('New collection found in dropdown', 'success');
        } else {
            this.addStep('New collection NOT found in dropdown', 'error');
        }
        
        return found;
    }
    
    generateReport() {
        const report = {
            duration: Date.now() - this.startTime,
            steps: this.steps,
            errors: this.errors,
            warnings: this.warnings,
            networkRequests: this.networkRequests,
            summary: {
                totalSteps: this.steps.length,
                successSteps: this.steps.filter(s => s.status === 'success').length,
                errorSteps: this.steps.filter(s => s.status === 'error').length,
                warningSteps: this.steps.filter(s => s.status === 'warning').length,
                totalErrors: this.errors.length,
                totalNetworkRequests: this.networkRequests.length
            }
        };
        
        // Console output
        console.group('Collection Creation Workflow Test Report');
        console.log('Duration:', report.duration + 'ms');
        console.log('Summary:', report.summary);
        
        if (report.errors.length > 0) {
            console.group('Errors');
            report.errors.forEach(error => console.error(error));
            console.groupEnd();
        }
        
        if (report.networkRequests.length > 0) {
            console.group('Network Requests');
            report.networkRequests.forEach(req => console.log(req));
            console.groupEnd();
        }
        
        console.groupEnd();
        
        return report;
    }
    
    cleanup() {
        // Restore original console.error
        console.error = this.originalConsoleError;
        
        // Note: We don't restore fetch here to avoid breaking other code
    }
}

// Make available globally
window.CollectionWorkflowTester = CollectionWorkflowTester;

// Quick test function
window.testCollectionWorkflow = async function() {
    const tester = new CollectionWorkflowTester();
    try {
        return await tester.testCollectionCreationWorkflow();
    } finally {
        tester.cleanup();
    }
};

console.log('Collection workflow tester loaded. Run testCollectionWorkflow() to start the comprehensive test.');