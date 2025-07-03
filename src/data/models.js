// Data Models for the Albums Collection App

/**
 * Album Model
 * Represents a single album in the collection
 */
class Album {
    constructor(data = {}) {
        this.id = data.id || null;
        this.title = data.title || '';
        this.year = data.year || null;
        this.artist = data.artist || '';
        this.role = data.role || '';
        this.type = data.type || 'release';
        
        // Additional metadata
        this.genres = data.genres || [];
        this.styles = data.styles || [];
        this.formats = data.formats || [];
        this.images = data.images || [];
        
        // Track and credits information
        this.tracklist = data.tracklist || [];
        this.trackCount = data.trackCount || 0;
        this.credits = data.credits || [];
        
        // Computed properties
        this.coverImage = this.getCoverImage();
        this.formattedYear = this.year ? this.year.toString() : 'Unknown';
    }

    getCoverImage() {
        if (this.images && this.images.length > 0) {
            // Return the first image, preferably a primary image
            const primaryImage = this.images.find(img => img.type === 'primary');
            return primaryImage ? primaryImage.uri : this.images[0].uri;
        }
        return '/src/assets/placeholder-album.jpg'; // Placeholder image
    }

    getSpotifySearchUrl() {
        const query = encodeURIComponent(`${this.artist} ${this.title}`);
        return `https://open.spotify.com/search/${query}/albums`;
    }

    hasTrack(trackTitle) {
        return this.tracklist.some(track => 
            track.title && track.title.toLowerCase() === trackTitle.toLowerCase()
        );
    }

    getArtistNames() {
        // Extract all artist names from credits and main artist
        const artists = new Set([this.artist]);
        this.credits.forEach(credit => {
            if (credit.name) artists.add(credit.name);
        });
        return Array.from(artists);
    }
}

/**
 * Artist Model
 * Represents an artist in the collection
 */
class Artist {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.image = data.image || '/src/assets/placeholder-artist.jpg';
        this.albumCount = data.albumCount || 0;
        this.albums = data.albums || [];
        this.roles = data.roles || [];
    }

    addAlbum(album) {
        if (!this.albums.find(a => a.id === album.id)) {
            this.albums.push(album);
            this.albumCount = this.albums.length;
        }
    }

    getMostCommonRole() {
        if (this.roles.length === 0) return 'Artist';
        
        const roleCounts = {};
        this.roles.forEach(role => {
            roleCounts[role] = (roleCounts[role] || 0) + 1;
        });
        
        return Object.keys(roleCounts).reduce((a, b) => 
            roleCounts[a] > roleCounts[b] ? a : b
        );
    }
}

/**
 * Track Model
 * Represents a track that appears across albums
 */
class Track {
    constructor(data = {}) {
        this.title = data.title || '';
        this.frequency = data.frequency || 0;
        this.albums = data.albums || [];
        this.duration = data.duration || null;
        this.position = data.position || null;
    }

    addAlbum(album) {
        if (!this.albums.find(a => a.id === album.id)) {
            this.albums.push(album);
            this.frequency = this.albums.length;
        }
    }

    getFormattedDuration() {
        if (!this.duration) return '';
        
        const parts = this.duration.split(':');
        if (parts.length === 2) {
            const minutes = parseInt(parts[0]);
            const seconds = parts[1];
            return `${minutes}:${seconds}`;
        }
        return this.duration;
    }
}

/**
 * Role Model
 * Represents a role/credit in album production
 */
class Role {
    constructor(data = {}) {
        this.name = data.name || '';
        this.frequency = data.frequency || 0;
        this.artists = data.artists || [];
        this.albums = data.albums || [];
    }

    addArtist(artistName, album) {
        if (!this.artists.includes(artistName)) {
            this.artists.push(artistName);
        }
        
        if (!this.albums.find(a => a.id === album.id)) {
            this.albums.push(album);
        }
        
        this.frequency = this.albums.length;
    }

    getMostActiveArtist() {
        if (this.artists.length === 0) return null;
        
        // Count how many albums each artist appears in for this role
        const artistCounts = {};
        this.albums.forEach(album => {
            album.credits.forEach(credit => {
                if (credit.role && credit.role.includes(this.name)) {
                    artistCounts[credit.name] = (artistCounts[credit.name] || 0) + 1;
                }
            });
        });
        
        return Object.keys(artistCounts).reduce((a, b) => 
            artistCounts[a] > artistCounts[b] ? a : b
        );
    }
}

/**
 * Collection Model
 * Manages the entire collection of albums, artists, tracks, and roles
 */
class Collection {
    constructor() {
        this.albums = [];
        this.artists = new Map();
        this.tracks = new Map();
        this.roles = new Map();
    }

    addAlbum(albumData) {
        const album = new Album(albumData);
        this.albums.push(album);
        
        // Update artists
        this.updateArtists(album);
        
        // Update tracks
        this.updateTracks(album);
        
        // Update roles
        this.updateRoles(album);
        
        return album;
    }

    updateArtists(album) {
        // Add main artist
        if (album.artist) {
            this.addOrUpdateArtist(album.artist, album);
        }
        
        // Add credited artists
        album.credits.forEach(credit => {
            if (credit.name) {
                this.addOrUpdateArtist(credit.name, album, credit.role);
            }
        });
    }

    addOrUpdateArtist(artistName, album, role = 'Artist') {
        if (!this.artists.has(artistName)) {
            this.artists.set(artistName, new Artist({ name: artistName }));
        }
        
        const artist = this.artists.get(artistName);
        artist.addAlbum(album);
        
        if (role && !artist.roles.includes(role)) {
            artist.roles.push(role);
        }
    }

    updateTracks(album) {
        album.tracklist.forEach(trackData => {
            if (trackData.title) {
                if (!this.tracks.has(trackData.title)) {
                    this.tracks.set(trackData.title, new Track({ title: trackData.title }));
                }
                
                const track = this.tracks.get(trackData.title);
                track.addAlbum(album);
            }
        });
    }

    updateRoles(album) {
        album.credits.forEach(credit => {
            if (credit.role) {
                // Split roles by comma and trim whitespace
                const roles = credit.role.split(',').map(r => r.trim());
                
                roles.forEach(roleName => {
                    if (roleName) {
                        if (!this.roles.has(roleName)) {
                            this.roles.set(roleName, new Role({ name: roleName }));
                        }
                        
                        const role = this.roles.get(roleName);
                        role.addArtist(credit.name, album);
                    }
                });
            }
        });
    }

    getAlbumsArray() {
        return this.albums;
    }

    getArtistsArray() {
        return Array.from(this.artists.values());
    }

    getTracksArray() {
        return Array.from(this.tracks.values());
    }

    getRolesArray() {
        return Array.from(this.roles.values());
    }

    findAlbumsByArtist(artistName) {
        return this.albums.filter(album => 
            album.artist === artistName || 
            album.credits.some(credit => credit.name === artistName)
        );
    }

    findAlbumsByTrack(trackTitle) {
        return this.albums.filter(album => album.hasTrack(trackTitle));
    }

    findArtistsByRole(roleName) {
        const role = this.roles.get(roleName);
        return role ? role.artists : [];
    }

    clear() {
        this.albums = [];
        this.artists.clear();
        this.tracks.clear();
        this.roles.clear();
    }
}

// Make models available globally
if (typeof window !== 'undefined') {
    window.Album = Album;
    window.Artist = Artist;
    window.Track = Track;
    window.Role = Role;
    window.Collection = Collection;
}