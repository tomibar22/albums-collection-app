// Simple Role Categorizer Test
// Run with: node test-role-categorizer.js

// Mock window object for Node.js environment
global.window = global;

// Load the role categorizer
require('./src/utils/roleCategorizer.js');

function testRoleCategorizer() {
    console.log('🚀 Testing Role Categorizer');
    console.log('=' * 50);
    
    // Test basic role categorization
    console.log('\n🧪 Testing Basic Role Categorization:');
    const testRoles = [
        'Guitar', 'Piano', 'Producer', 'Engineer', 'Vocals', 'Drums',
        'Photography', 'Artwork', 'Bass', 'Saxophone', 'Mastered By',
        'Conductor', 'Liner Notes', 'Violin', 'Mixed By', 'Trumpet',
        'Design', 'Cover Design', 'Electric Guitar', 'Recording Engineer'
    ];
    
    const musical = [];
    const technical = [];
    
    testRoles.forEach(role => {
        const category = window.roleCategorizer.categorizeRole(role);
        console.log(`   "${role}" → ${category}`);
        
        if (category === 'musical') {
            musical.push(role);
        } else {
            technical.push(role);
        }
    });
    
    console.log(`\n📊 Results: ${musical.length} musical, ${technical.length} technical`);
    console.log(`🎵 Musical: ${musical.join(', ')}`);
    console.log(`🔧 Technical: ${technical.join(', ')}`);
    
    // Test comma-separated roles
    console.log('\n🧪 Testing Comma-Separated Roles:');
    const testCredits = [
        { name: 'John Doe', role: 'Guitar, Vocals' },
        { name: 'Jane Smith', role: 'Producer, Engineer, Mixing' },
        { name: 'Bob Wilson', role: 'Piano, Keyboards, Arranging' }
    ];
    
    testCredits.forEach(credit => {
        console.log(`\n   Testing: ${credit.name} - "${credit.role}"`);
        const { musicalCredits, technicalCredits } = window.roleCategorizer.separateRoles([credit]);
        console.log(`   → Musical: ${musicalCredits.length}, Technical: ${technicalCredits.length}`);
        
        musicalCredits.forEach(mc => console.log(`     🎵 ${mc.name}: ${mc.role}`));
        technicalCredits.forEach(tc => console.log(`     🔧 ${tc.name}: ${tc.role}`));
    });
    
    // Test artist role separation
    console.log('\n🎭 Testing Artist Role Separation:');
    const sampleArtist = {
        name: 'Bill Evans',
        roles: ['Piano', 'Producer', 'Composer', 'Arrangement', 'Photography', 'Engineer']
    };
    
    const { musicalRoles, technicalRoles } = window.roleCategorizer.separateArtistRoles(sampleArtist);
    console.log(`   Artist "${sampleArtist.name}": ${musicalRoles.length} musical, ${technicalRoles.length} technical roles`);
    console.log(`   🎵 Musical: ${musicalRoles.join(', ')}`);
    console.log(`   🔧 Technical: ${technicalRoles.join(', ')}`);
    
    // Test stats
    console.log('\n📊 Role Categorizer Statistics:');
    const stats = window.roleCategorizer.getStats();
    console.log(`   Total predefined roles: ${stats.totalRoles}`);
    console.log(`   Musical roles: ${stats.musicalRolesCount}`);
    console.log(`   Technical roles: ${stats.technicalRolesCount}`);
    
    console.log('\n✅ Role Categorizer Test Complete!');
    console.log('=' * 50);
}

// Run the test
testRoleCategorizer();
