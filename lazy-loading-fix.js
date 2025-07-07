            // Render batch items with duplicate prevention
            const renderedIds = new Set();
            batch.forEach((item, index) => {
                try {
                    // Prevent duplicate rendering of same item
                    const itemId = item.id || `item-${startIndex + index}`;
                    if (renderedIds.has(itemId)) {
                        console.warn(`⚠️ DUPLICATE PREVENTION: Skipping duplicate render of item ${itemId}`);
                        return;
                    }
                    renderedIds.add(itemId);
                    
                    const element = renderItem(item, startIndex + index);
                    if (element) {
                        // Additional check: ensure this element isn't already in the grid
                        const existingElement = gridElement.querySelector(`[data-album-id="${itemId}"]`);
                        if (existingElement) {
                            console.warn(`⚠️ DOM DUPLICATE PREVENTION: Element with ID ${itemId} already exists in grid, skipping`);
                            return;
                        }
                        
                        gridElement.appendChild(element);
                        
                        // Add subtle animation for newly loaded items
                        this.animateNewItem(element);
                    }
                } catch (error) {
                    console.error(`❌ Error rendering item ${startIndex + index}:`, error);
                }
            });
