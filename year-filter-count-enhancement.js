// Year Filter Count Enhancement Patch
// Add this code to the updatePageTitleCounts() method to enhance count display

// Enhanced Albums count with year filter indication
const albumCount = this.collection.albums.length;
const totalAlbums = this.originalCollection?.albums?.length || albumCount;
const isYearFilterActive = this.yearFilter && this.yearFilter.enabled;

// Replace the albumsCountEl.textContent line with:
if (isYearFilterActive && albumCount < totalAlbums) {
    albumsCountEl.textContent = `(${albumCount} filtered)`;
    albumsCountEl.style.color = 'var(--accent-color)';
} else {
    albumsCountEl.textContent = `(${albumCount})`;
    albumsCountEl.style.color = '';
}

// Similarly, for other counts (artists, tracks, roles), replace their textContent lines with:
// For Artists:
const artistCount = this.collection.artists.length;
if (isYearFilterActive) {
    artistsCountEl.textContent = `(${artistCount} filtered)`;
    artistsCountEl.style.color = 'var(--accent-color)';
} else {
    artistsCountEl.textContent = `(${artistCount})`;
    artistsCountEl.style.color = '';
}

// For Tracks:
const trackCount = this.collection.tracks.length;
if (isYearFilterActive) {
    tracksCountEl.textContent = `(${trackCount} filtered)`;
    tracksCountEl.style.color = 'var(--accent-color)';
} else {
    tracksCountEl.textContent = `(${trackCount})`;
    tracksCountEl.style.color = '';
}

// For Roles:
const roleCount = this.collection.roles.length;
if (isYearFilterActive) {
    rolesCountEl.textContent = `(${roleCount} filtered)`;
    rolesCountEl.style.color = 'var(--accent-color)';
} else {
    rolesCountEl.textContent = `(${roleCount})`;
    rolesCountEl.style.color = '';
}
