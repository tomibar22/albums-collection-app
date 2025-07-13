// Year Range Slider Component for Albums Collection App
class YearRangeSlider {
    constructor(minYear, maxYear, onRangeChange) {
        this.minYear = minYear;
        this.maxYear = maxYear;
        this.onRangeChange = onRangeChange;
        this.selectedMin = minYear;
        this.selectedMax = maxYear;
        this.isDragging = false;
    }
    
    // Generate the HTML structure for the slider
    render() {
        return `
            <div class="year-range-slider-container" id="year-range-slider-container">
                <div class="year-range-header">
                    <span class="year-range-label">📅 Filter by Year:</span>
                    <span class="year-range-display" id="year-range-display">${this.selectedMin} - ${this.selectedMax}</span>
                    <button class="year-filter-reset" id="year-filter-reset" title="Reset to full range">
                        🔄 Reset
                    </button>
                </div>
                <div class="year-range-slider-wrapper">
                    <div class="year-range-slider" id="year-range-slider">
                        <input 
                            type="range" 
                            class="range-input range-min" 
                            id="range-min"
                            min="${this.minYear}" 
                            max="${this.maxYear}" 
                            value="${this.selectedMin}"
                            step="1"
                        >
                        <input 
                            type="range" 
                            class="range-input range-max" 
                            id="range-max"
                            min="${this.minYear}" 
                            max="${this.maxYear}" 
                            value="${this.selectedMax}"
                            step="1"
                        >
                        <div class="slider-track" id="slider-track"></div>
                        <div class="slider-range" id="slider-range"></div>
                    </div>
                    <div class="year-range-labels">
                        <span class="year-label-min">${this.minYear}</span>
                        <span class="year-label-max">${this.maxYear}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Setup event listeners for the slider
    setupEventListeners() {
        const rangeMin = document.getElementById('range-min');
        const rangeMax = document.getElementById('range-max');
        const resetBtn = document.getElementById('year-filter-reset');
        
        if (!rangeMin || !rangeMax) {
            console.error('❌ Year range slider elements not found');
            return;
        }
        
        // Input event listeners for real-time updates
        rangeMin.addEventListener('input', (e) => {
            this.handleMinChange(parseInt(e.target.value));
        });
        
        rangeMax.addEventListener('input', (e) => {
            this.handleMaxChange(parseInt(e.target.value));
        });
        
        // Change event listeners for final updates (when user releases slider)
        rangeMin.addEventListener('change', () => {
            this.triggerRangeChange();
        });
        
        rangeMax.addEventListener('change', () => {
            this.triggerRangeChange();
        });
        
        // Reset button functionality
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetRange();
            });
        }
        
        // Touch/mouse events for better mobile support
        rangeMin.addEventListener('touchstart', () => this.isDragging = true);
        rangeMin.addEventListener('touchend', () => this.isDragging = false);
        rangeMax.addEventListener('touchstart', () => this.isDragging = true);
        rangeMax.addEventListener('touchend', () => this.isDragging = false);
        
        // Initial visual update
        this.updateSliderVisuals();
        
        console.log('✅ Year range slider event listeners setup complete');
    }
    
    // Handle minimum value changes
    handleMinChange(newMin) {
        // Ensure min doesn't exceed max
        if (newMin >= this.selectedMax) {
            newMin = this.selectedMax - 1;
            document.getElementById('range-min').value = newMin;
        }
        
        // Ensure min doesn't go below bounds
        if (newMin < this.minYear) {
            newMin = this.minYear;
            document.getElementById('range-min').value = newMin;
        }
        
        this.selectedMin = newMin;
        this.updateDisplay();
        this.updateSliderVisuals();
    }
    
    // Handle maximum value changes
    handleMaxChange(newMax) {
        // Ensure max doesn't go below min
        if (newMax <= this.selectedMin) {
            newMax = this.selectedMin + 1;
            document.getElementById('range-max').value = newMax;
        }
        
        // Ensure max doesn't exceed bounds
        if (newMax > this.maxYear) {
            newMax = this.maxYear;
            document.getElementById('range-max').value = newMax;
        }
        
        this.selectedMax = newMax;
        this.updateDisplay();
        this.updateSliderVisuals();
    }
    
    // Update the display text
    updateDisplay() {
        const display = document.getElementById('year-range-display');
        if (display) {
            display.textContent = `${this.selectedMin} - ${this.selectedMax}`;
        }
    }
    
    // Update the visual range indicator
    updateSliderVisuals() {
        const sliderRange = document.getElementById('slider-range');
        if (!sliderRange) return;
        
        const range = this.maxYear - this.minYear;
        const leftPercent = ((this.selectedMin - this.minYear) / range) * 100;
        const rightPercent = ((this.maxYear - this.selectedMax) / range) * 100;
        
        sliderRange.style.left = `${leftPercent}%`;
        sliderRange.style.right = `${rightPercent}%`;
    }
    
    // Reset to full range
    resetRange() {
        this.selectedMin = this.minYear;
        this.selectedMax = this.maxYear;
        
        // Update input values
        const rangeMin = document.getElementById('range-min');
        const rangeMax = document.getElementById('range-max');
        
        if (rangeMin) rangeMin.value = this.selectedMin;
        if (rangeMax) rangeMax.value = this.selectedMax;
        
        // Update display and visuals
        this.updateDisplay();
        this.updateSliderVisuals();
        
        // Trigger the change callback
        this.triggerRangeChange();
        
        console.log('🔄 Year range reset to full range');
    }
    
    // Trigger the range change callback
    triggerRangeChange() {
        if (this.onRangeChange) {
            console.log(`📅 Year range changed: ${this.selectedMin} - ${this.selectedMax}`);
            this.onRangeChange(this.selectedMin, this.selectedMax);
        }
    }
    
    // Get current selected range
    getSelectedRange() {
        return {
            min: this.selectedMin,
            max: this.selectedMax
        };
    }
    
    // Set range programmatically
    setRange(minYear, maxYear) {
        // Validate input
        if (minYear < this.minYear) minYear = this.minYear;
        if (maxYear > this.maxYear) maxYear = this.maxYear;
        if (minYear >= maxYear) {
            console.warn('Invalid range: min >= max');
            return;
        }
        
        this.selectedMin = minYear;
        this.selectedMax = maxYear;
        
        // Update input values
        const rangeMin = document.getElementById('range-min');
        const rangeMax = document.getElementById('range-max');
        
        if (rangeMin) rangeMin.value = this.selectedMin;
        if (rangeMax) rangeMax.value = this.selectedMax;
        
        // Update display and visuals
        this.updateDisplay();
        this.updateSliderVisuals();
        
        console.log(`📅 Year range set programmatically: ${this.selectedMin} - ${this.selectedMax}`);
    }
    
    // Check if filter is active (not at full range)
    isFilterActive() {
        return this.selectedMin !== this.minYear || this.selectedMax !== this.maxYear;
    }
}

// Export for use in other modules
window.YearRangeSlider = YearRangeSlider;