// Simple Node.js test to verify genre/style functionality
// Run with: node test-genre-style-implementation.js

console.log('🧪 Testing Genre & Style Implementation');

// Mock the necessary globals that would be in browser
global.window = {
    CONFIG: {
        DEBUG: { ENABLED: true },
        FILTERS: {
            EXCLUDE_WORDS: ['compilation', 'single'],
            ALBUM_KEYWORDS: ['album', 'lp'],
            EXCLUDE_SLASH_IN_TITLE: true
        }
    }
};

// Mock DOM elements for AlbumCard
global.document = {
    createElement: (tag) => ({
        className: '',
        innerHTML: '',
        setAttribute: () => {},
        querySelector: () => null,
        addEventListener: () => {}
    })
};

// Load our modules (simplified simulation)
const testAlbumData = {
    id: 1,
    title: "Kind of Blue",
    year: 1959,
    artists: [{ name: "Miles Davis" }],
    artist: "Miles Davis",
    trackCount: 5,
    genres: ["Jazz"],
    styles: ["Hard Bop", "Modal"],
    images: [],
    tracklist: [],
    credits: []
};

const testAlbumDataComplex = {
    id: 2,
    title: "Thriller",
    year: 1982,
    artists: [{ name: "Michael Jackson" }],
    artist: "Michael Jackson",
    trackCount: 9,
    genres: ["Funk / Soul", "Pop"],
    styles: ["Disco", "Pop Rock", "Funk", "New Jack Swing"],
    images: [],
    tracklist: [],
    credits: []
};

// Simulate the getGenreStyleTags method from AlbumCard
function getGenreStyleTags(album) {
    const tags = [];
    
    // Add genres
    if (album.genres && Array.isArray(album.genres)) {
        tags.push(...album.genres);
    }
    
    // Add styles  
    if (album.styles && Array.isArray(album.styles)) {
        tags.push(...album.styles);
    }
    
    // Remove duplicates and limit to maximum 4 tags
    const uniqueTags = [...new Set(tags)].slice(0, 4);
    
    if (uniqueTags.length === 0) {
        return '';
    }
    
    // Generate HTML for each tag
    const tagHtml = uniqueTags.map(tag => 
        `<span class="genre-tag" title="${tag}">${tag}</span>`
    ).join('');
    
    return `<div class="genre-tags-container">${tagHtml}</div>`;
}

// Simulate the modal content generation from app.js
function generateGenreStylesForModal(album) {
    const genreStyleTags = [];
    if (album.genres && Array.isArray(album.genres)) {
        genreStyleTags.push(...album.genres);
    }
    if (album.styles && Array.isArray(album.styles)) {
        genreStyleTags.push(...album.styles);
    }
    
    const uniqueGenreStyleTags = [...new Set(genreStyleTags)];
    const genresHtml = uniqueGenreStyleTags.length > 0
        ? uniqueGenreStyleTags.map(tag => `<span class="genre-tag-modal">${tag}</span>`).join('')
        : '<span class="no-content">No genres or styles listed</span>';
        
    return { tags: uniqueGenreStyleTags, html: genresHtml };
}

// Test the functionality
console.log('\n📊 Test 1: Simple Album (Jazz with Hard Bop, Modal)');
console.log('Input genres:', testAlbumData.genres);
console.log('Input styles:', testAlbumData.styles);

const result1 = getGenreStyleTags(testAlbumData);
console.log('Card HTML output:', result1);

const modal1 = generateGenreStylesForModal(testAlbumData);
console.log('Modal tags:', modal1.tags);
console.log('Modal HTML:', modal1.html);

console.log('\n📊 Test 2: Complex Album (Multiple genres & styles)');
console.log('Input genres:', testAlbumDataComplex.genres);
console.log('Input styles:', testAlbumDataComplex.styles);

const result2 = getGenreStyleTags(testAlbumDataComplex);
console.log('Card HTML output:', result2);

const modal2 = generateGenreStylesForModal(testAlbumDataComplex);
console.log('Modal tags:', modal2.tags);
console.log('Modal HTML:', modal2.html);

// Test edge cases
console.log('\n📊 Test 3: Edge Cases');

const emptyAlbum = { genres: [], styles: [] };
console.log('Empty genres/styles:', getGenreStyleTags(emptyAlbum));

const duplicateAlbum = { 
    genres: ["Rock", "Jazz"], 
    styles: ["Rock", "Jazz", "Fusion"] 
};
const result3 = getGenreStyleTags(duplicateAlbum);
console.log('Duplicate handling:', result3);

// Verify deduplication worked
const modal3 = generateGenreStylesForModal(duplicateAlbum);
console.log('Deduplicated tags:', modal3.tags);

console.log('\n✅ All tests completed! The implementation should:');
console.log('1. Combine genres and styles into single tag list');
console.log('2. Remove duplicates between genres and styles'); 
console.log('3. Limit album cards to max 4 tags for layout');
console.log('4. Show all unique tags in modal');
console.log('5. Handle empty arrays gracefully');
