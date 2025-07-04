// Role Categorizer Utility
// Separates musical/performance roles from technical/production roles

class RoleCategorizer {
    constructor() {
        this.initializeRoleCategories();
    }

    initializeRoleCategories() {
        // Technical/Production roles (to be hidden by default)
        this.technicalRoles = new Set([
            // Production
            'producer', 'co-producer', 'executive producer', 'associate producer',
            'reissue producer', 'executive-producer', 'product manager',
            'produced by', 'production', 'session production',
            
            // Engineering
            'engineer', 'recording engineer', 'mixing engineer', 'mastering engineer',
            'sound engineer', 'audio engineer', 'mix engineer', 'master engineer',
            'mixed by', 'mastered by', 'recorded by', 'engineered by',
            'remastered by', 'remastering by', 're-record', 'transferred by', 'restoration', 'edited by',
            'digitally', 'digital remastering', 'digital editing', 'uncredited',
            
            // Design & Artwork
            'design', 'cover design', 'art direction', 'artwork', 'artwork by',
            'illustration', 'graphic design', 'layout', 'typography',
            'creative director', 'sleeve design', 'package design', 'painting',
            
            // Photography
            'photography', 'photography by', 'photographer', 'cover photography',
            'band photography', 'portrait photography', 'photos', 'individual photographs',
            
            // Documentation
            'liner notes', 'sleeve notes', 'notes', 'text by', 'booklet editor',
            'research', 'transcription by', 'annotation',
            
            // Management & Coordination
            'management', 'coordinator', 'project manager', 'supervisor',
            'recording supervisor', 'supervised by', 'contractor',
            'a&r', 'a&r coordinator', 'presenter', 'hosted by',
            'consultant', 'advisor', 'advisement',
            'original session', 'original sessions', 'session',
            
            // Compilation & Release Coordination
            'for release', 'compiled by', 'sequenced by', 'supervision', 'supervision by',
            
            // Technical Production
            'technician', 'lacquer cut by', 'cutting engineer',
            'post production', 'digital editing', 'remix', 'remixed by',
            
            // Legal & Business
            'legal', 'copyright', 'rights', 'licensing', 'clearance',
            'publisher', 'publishing',
            
            // Direction & Coordination
            'directed by', 'copyist', 'graphics', 'crew', 'booking',
            'adapted by', 'promotion', 'assisting', 'stylist', 'hair',
            'public relations', 'assistants', 'french translation',
            'additional assistant', 'translation', 'assistance', 'assistent',
            'technical support'
        ]);

        // Musical/Performance roles (to be shown prominently)
        this.musicalRoles = new Set([
            // Vocals
            'vocals', 'lead vocals', 'backing vocals', 'background vocals',
            'harmony vocals', 'choir', 'chorus', 'voice', 'singer',
            'soprano', 'alto', 'tenor', 'baritone', 'bass vocals',
            
            // String Instruments
            'guitar', 'electric guitar', 'acoustic guitar', 'classical guitar',
            'lead guitar', 'rhythm guitar', 'slide guitar', 'steel guitar',
            'twelve-string guitar', '12-string guitar', 'bass guitar',
            'electric bass', 'acoustic bass', 'upright bass', 'double bass',
            'fretless bass', 'violin', 'viola', 'cello', 'double bass',
            'fiddle', 'mandolin', 'banjo', 'ukulele', 'harp', 'sitar',
            
            // Keyboard Instruments
            'piano', 'keyboards', 'electric piano', 'acoustic piano',
            'grand piano', 'upright piano', 'organ', 'hammond organ',
            'church organ', 'synthesizer', 'synth', 'moog', 'mellotron',
            'harpsichord', 'celeste', 'accordion', 'harmonium',
            
            // Percussion
            'drums', 'drum kit', 'drum set', 'percussion', 'timpani',
            'congas', 'bongos', 'djembe', 'tabla', 'hand percussion',
            'tambourine', 'shaker', 'maracas', 'cowbell', 'triangle',
            'cymbals', 'gong', 'vibraphone', 'xylophone', 'marimba',
            
            // Wind Instruments
            'saxophone', 'alto saxophone', 'tenor saxophone', 'soprano saxophone',
            'baritone saxophone', 'sax', 'trumpet', 'cornet', 'flugelhorn',
            'trombone', 'french horn', 'tuba', 'euphonium', 'flute',
            'piccolo', 'clarinet', 'oboe', 'bassoon', 'english horn',
            'harmonica', 'recorder', 'bagpipes',
            
            // Composition & Arrangement (Musical Creative)
            'composer', 'songwriter', 'written-by', 'written by',
            'music by', 'composed by', 'arranger', 'arranged by',
            'orchestrator', 'orchestrated by', 'string arrangements',
            'horn arrangements', 'vocal arrangements', 'conductor',
            'musical director', 'bandleader', 'soloist',
            
            // Performance Roles
            'performer', 'musician', 'instrumentalist', 'artist',
            'featured artist', 'guest artist', 'session musician'
        ]);

        // Create normalized lookup maps for faster matching
        this.technicalRolesNormalized = new Set();
        this.musicalRolesNormalized = new Set();
        
        this.technicalRoles.forEach(role => {
            this.technicalRolesNormalized.add(this.normalizeRole(role));
        });
        
        this.musicalRoles.forEach(role => {
            this.musicalRolesNormalized.add(this.normalizeRole(role));
        });
    }

    normalizeRole(role) {
        return role.toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' '); // Normalize spaces
    }

    categorizeRole(role) {
        if (!role || typeof role !== 'string') {
            return 'unknown';
        }

        const normalizedRole = this.normalizeRole(role);
        
        // Check for exact matches first
        if (this.technicalRolesNormalized.has(normalizedRole)) {
            return 'technical';
        }
        
        if (this.musicalRolesNormalized.has(normalizedRole)) {
            return 'musical';
        }

        // Check for partial matches using keywords
        const roleWords = normalizedRole.split(' ');
        
        // Check if any word matches technical roles
        for (const word of roleWords) {
            for (const techRole of this.technicalRolesNormalized) {
                if (techRole.includes(word) && word.length > 2) {
                    return 'technical';
                }
            }
        }
        
        // Check if any word matches musical roles
        for (const word of roleWords) {
            for (const musicalRole of this.musicalRolesNormalized) {
                if (musicalRole.includes(word) && word.length > 2) {
                    return 'musical';
                }
            }
        }

        // Special patterns for technical roles
        const technicalPatterns = [
            /engineer/i,
            /producer?/i,
            /produced/i,
            /design/i,
            /photography/i,
            /photos?/i,
            /artwork/i,
            /painting/i,
            /mastered?/i,
            /remastering/i,
            /mixed?/i,
            /recorded?/i,
            /supervisor?/i,
            /coordinator/i,
            /management/i,
            /director/i,
            /notes/i,
            /liner/i,
            /layout/i,
            /typography/i,
            /consultant/i,
            /advisor/i,
            /digitally/i,
            /uncredited/i,
            /digital/i,
            /session/i,
            /original session/i,
            /compiled/i,
            /sequenced/i,
            /supervision/i,
            /for release/i
        ];

        // Special patterns for musical roles
        const musicalPatterns = [
            /guitar/i,
            /bass/i,
            /piano/i,
            /vocal/i,
            /drum/i,
            /trumpet/i,
            /saxophone/i,
            /violin/i,
            /composer/i,
            /arranged?/i,
            /conductor/i
        ];

        // Apply pattern matching
        for (const pattern of technicalPatterns) {
            if (pattern.test(role)) {
                return 'technical';
            }
        }

        for (const pattern of musicalPatterns) {
            if (pattern.test(role)) {
                return 'musical';
            }
        }

        // Default to musical for ambiguous cases
        return 'musical';
    }

    // Extract roles by removing brackets and splitting bracketed content
    extractExpandedRoles(roleString) {
        if (!roleString || typeof roleString !== 'string') {
            return [];
        }
        
        const roles = [];
        
        // Check if role has brackets
        const bracketMatch = roleString.match(/^([^[]+)\s*\[([^\]]+)\](.*)$/);
        
        if (bracketMatch) {
            // Has brackets: "Synthesizer [Oberheim, Prophet V]"
            const mainRole = bracketMatch[1].trim(); // "Synthesizer"
            const bracketContent = bracketMatch[2].trim(); // "Oberheim, Prophet V" 
            const suffix = bracketMatch[3].trim(); // anything after brackets
            
            // Add main role
            if (mainRole) {
                roles.push(mainRole);
            }
            
            // Split bracketed content by commas and add each as separate role
            const bracketRoles = bracketContent.split(',').map(r => r.trim()).filter(r => r);
            roles.push(...bracketRoles);
            
            // Add suffix if exists
            if (suffix) {
                roles.push(suffix);
            }
        } else {
            // No brackets: treat as simple role
            roles.push(roleString.trim());
        }
        
        return roles.filter(role => role); // Remove empty roles
    }

    // Smart role splitting that first expands brackets, then handles commas
    smartSplitRoles(roleString) {
        if (!roleString || typeof roleString !== 'string') {
            return [];
        }
        
        const allRoles = [];
        
        // First split by commas at the top level
        const commaSeparatedParts = [];
        let current = '';
        let bracketDepth = 0;
        
        for (let i = 0; i < roleString.length; i++) {
            const char = roleString[i];
            
            if (char === '[') {
                bracketDepth++;
                current += char;
            } else if (char === ']') {
                bracketDepth--;
                current += char;
            } else if (char === ',' && bracketDepth === 0) {
                if (current.trim()) {
                    commaSeparatedParts.push(current.trim());
                }
                current = '';
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            commaSeparatedParts.push(current.trim());
        }
        
        // Now expand each part (extract main role + bracketed content)
        commaSeparatedParts.forEach(part => {
            const expandedRoles = this.extractExpandedRoles(part);
            allRoles.push(...expandedRoles);
        });
        
        return allRoles;
    }

    separateRoles(credits) {
        const musicalCredits = [];
        const technicalCredits = [];

        if (!Array.isArray(credits)) {
            return { musicalCredits, technicalCredits };
        }

        credits.forEach(credit => {
            if (!credit || !credit.role) {
                return;
            }

            // FIRST: Use smart splitting to get top-level roles (preserves brackets)
            const topLevelRoles = [];
            let current = '';
            let bracketDepth = 0;
            
            for (let i = 0; i < credit.role.length; i++) {
                const char = credit.role[i];
                
                if (char === '[') {
                    bracketDepth++;
                    current += char;
                } else if (char === ']') {
                    bracketDepth--;
                    current += char;
                } else if (char === ',' && bracketDepth === 0) {
                    if (current.trim()) {
                        topLevelRoles.push(current.trim());
                    }
                    current = '';
                } else {
                    current += char;
                }
            }
            
            if (current.trim()) {
                topLevelRoles.push(current.trim());
            }

            // SECOND: For each top-level role, categorize THEN expand
            topLevelRoles.forEach(topLevelRole => {
                // Check if this role has brackets
                const hasBrackets = topLevelRole.includes('[') && topLevelRole.includes(']');
                
                if (hasBrackets) {
                    // Has brackets: Strip brackets for categorization, then expand
                    const roleForCategorization = topLevelRole.replace(/\s*\[.*?\]/g, '').trim();
                    const originalCategory = this.categorizeRole(roleForCategorization);
                    const expandedRoles = this.extractExpandedRoles(topLevelRole);
                    
                    // All expanded roles inherit the category from the original
                    expandedRoles.forEach(expandedRole => {
                        const creditCopy = {
                            ...credit,
                            role: expandedRole
                        };

                        if (originalCategory === 'technical') {
                            technicalCredits.push(creditCopy);
                        } else {
                            musicalCredits.push(creditCopy);
                        }
                    });
                } else {
                    // Simple role without brackets: use original working logic
                    const category = this.categorizeRole(topLevelRole);
                    const creditCopy = {
                        ...credit,
                        role: topLevelRole
                    };

                    if (category === 'technical') {
                        technicalCredits.push(creditCopy);
                    } else {
                        musicalCredits.push(creditCopy);
                    }
                }
            });
        });

        return { musicalCredits, technicalCredits };
    }

    separateArtistRoles(artist) {
        if (!artist || !artist.roles) {
            return { 
                musicalRoles: [], 
                technicalRoles: [] 
            };
        }

        const musicalRoles = [];
        const technicalRoles = [];

        artist.roles.forEach(role => {
            const category = this.categorizeRole(role);
            if (category === 'technical') {
                technicalRoles.push(role);
            } else {
                musicalRoles.push(role);
            }
        });

        return { musicalRoles, technicalRoles };
    }

    getStats() {
        return {
            technicalRolesCount: this.technicalRoles.size,
            musicalRolesCount: this.musicalRoles.size,
            totalRoles: this.technicalRoles.size + this.musicalRoles.size
        };
    }
}

// Create global instance
window.roleCategorizer = new RoleCategorizer();
