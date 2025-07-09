#!/usr/bin/env node

/**
 * Migration Script: Update app.js to use DataService instead of SupabaseService
 * This script will systematically replace all references to SupabaseService with DataService
 */

const fs = require('fs');
const path = require('path');

function migrateAppToDataService() {
    const appJsPath = './src/app.js';
    
    console.log('🔄 Migrating app.js to use DataService...');
    
    // Read the current app.js file
    let content = fs.readFileSync(appJsPath, 'utf8');
    
    // Define the replacements
    const replacements = [
        // Constructor update
        {
            from: '    // Initialize Supabase service\n    this.supabaseService = null;',
            to: '    // Initialize Data service (supports both Supabase and Google Sheets)\n    this.dataService = null;'
        },
        
        // Method name update
        {
            from: 'async initializeSupabase()',
            to: 'async initializeDataService()'
        },
        
        // Service initialization
        {
            from: 'this.supabaseService = new SupabaseService();',
            to: 'this.dataService = new DataService();\n        await this.dataService.initialize();'
        },
        
        // All method calls - supabaseService to dataService
        {
            from: /this\.supabaseService\./g,
            to: 'this.dataService.'
        },
        
        // Method call updates
        {
            from: 'await this.initializeSupabase()',
            to: 'await this.initializeDataService()'
        },
        
        // Update references in comments
        {
            from: '// Enhanced Supabase initialization with better error handling',
            to: '// Enhanced Data Service initialization with better error handling'
        }
    ];
    
    // Apply replacements
    replacements.forEach((replacement, index) => {
        console.log(`📝 Applying replacement ${index + 1}/${replacements.length}...`);
        
        if (replacement.from instanceof RegExp) {
            content = content.replace(replacement.from, replacement.to);
        } else {
            content = content.replace(replacement.from, replacement.to);
        }
    });
    
    // Write the updated content back
    fs.writeFileSync(appJsPath, content, 'utf8');
    
    console.log('✅ Migration complete! app.js now uses DataService');
    console.log('🔍 You should verify the changes and test the app');
}

// Run the migration
if (require.main === module) {
    try {
        migrateAppToDataService();
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

module.exports = { migrateAppToDataService };
