# 🎵 Albums Collection App

A modern, feature-rich web application for curating and exploring your personal music collection using the Discogs API. Built with vanilla JavaScript, this app provides an intuitive interface for discovering albums, artists, tracks, and musical roles with persistent cloud storage via Supabase.

![App Screenshot](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=Albums+Collection+App)

## ✨ Features

### 🎨 **Modern Dark UI**
- Clean, card-based interface with elegant dark theme
- Responsive design optimized for desktop, tablet, and mobile
- Smooth animations and hover effects
- Professional gallery-style album browsing

### 🔍 **Intelligent Collection Views**
- **Albums View**: Grid of album cards with cover art, sorting by year/random
- **Artists View**: Separate tabs for Musical Artists vs Technical Contributors  
- **Tracks View**: Track frequency analysis across your collection
- **Roles View**: Musical vs Technical role categorization with smart parsing

### 🎯 **Advanced Scraping System**
- **Artist Discography Scraper**: Import entire artist discographies from Discogs
- **Album Batch Scraper**: Search and select specific albums to add
- **Smart Filtering**: Automatic exclusion of compilations, singles, reissues
- **Musical Role Filtering**: Only includes albums where artists actually perform music
- **Progress Tracking**: Real-time feedback with detailed statistics

### 🧠 **Intelligent Data Processing**
- **Credits-Based Artist Extraction**: Artists derived from actual performance credits
- **Smart Role Parsing**: Comma-separated role handling ("Producer, Engineer" → separate roles)
- **Role Categorization**: 196+ predefined musical vs technical roles
- **Duplicate Prevention**: Year-based prioritization for original releases
- **Format Quality Control**: LP/Album focus with compilation filtering

### 🌟 **Rich Exploration Features**
- **Interactive Modals**: Detailed album info with credits and tracklist
- **Cross-Navigation**: Click artists in credits to view their albums
- **Role-Based Discovery**: Click roles to see all associated artists
- **Platform Integration**: Direct Spotify and YouTube search buttons
- **Modal Navigation Stack**: Seamless back navigation through related content

### ☁️ **Cloud-Powered Persistence**
- **Supabase Integration**: Full-featured PostgreSQL database backend
- **Real-time Sync**: Live updates across devices and sessions
- **Scalable Architecture**: Handles large collections (1000+ albums) efficiently
- **Data Relationships**: Complex many-to-many relationships properly managed

## 🚀 Quick Start

### Prerequisites
- Web browser with ES6+ support
- [Discogs API account](https://www.discogs.com/settings/developers)
- [Supabase account](https://supabase.com) (optional for persistence)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/albums-collection-app.git
   cd albums-collection-app
   ```

2. **Configure API credentials**
   ```bash
   cp src/config.example.js src/config.js
   ```
   
   Edit `src/config.js` and add your credentials:
   ```javascript
   DISCOGS: {
       API_KEY: 'your_discogs_api_key_here'
   },
   SUPABASE: {
       URL: 'your_supabase_project_url',
       ANON_KEY: 'your_supabase_anon_key'
   }
   ```

3. **Set up Supabase database** (optional)
   - Create a new Supabase project
   - Run the SQL schema from `docs/supabase-schema.sql`
   - Update your config with the project credentials

4. **Start a local server**
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Node.js (if you have it)
   npx serve .
   
   # PHP
   php -S localhost:8000
   ```

5. **Open the app**
   Navigate to `http://localhost:8000` in your browser

## 🎯 Usage Guide

### Getting Started
1. **First Launch**: The app loads with an empty collection
2. **Add Music**: Use the Scraper tab to search and import albums
3. **Explore**: Browse your collection using the Albums, Artists, Tracks, and Roles tabs

### Scraping Music
- **Artist Scraping**: Search for an artist and import their entire discography
- **Album Scraping**: Search for specific albums and add them to your cart
- **Smart Filtering**: The app automatically filters out non-musical releases

### Exploring Your Collection
- **Album Details**: Click "More Info" for credits, tracklist, and metadata
- **Artist Discovery**: Click artist names in credits to see their other albums
- **Role Exploration**: In the Roles tab, click roles to see all associated artists
- **Platform Search**: Use Spotify/YouTube buttons for instant music discovery

## 🛠️ Technical Architecture

### Frontend Stack
- **Vanilla JavaScript**: ES6+ modules with modern browser APIs
- **CSS3**: Custom properties, flexbox, grid, and animations
- **Web APIs**: Fetch, Intersection Observer, Web Storage

### Backend Integration
- **Discogs API**: Music metadata and release information
- **Supabase**: PostgreSQL database with real-time capabilities
- **RESTful Design**: Clean separation between data and presentation layers

### Key Components
```
src/
├── api/           # Discogs API integration
├── components/    # Reusable UI components (AlbumCard, ArtistCard)
├── data/          # Data models and parsing logic
├── services/      # External service integrations (Supabase)
├── styles/        # Modular CSS with component-based organization
└── utils/         # Utility functions (role categorization, lazy loading)
```

## 🗄️ Database Schema

The app uses a sophisticated relational database with 9 tables:

- **Core Tables**: albums, artists, tracks, roles
- **Relationship Tables**: album_artists, album_tracks, artist_roles  
- **Collection Management**: collections, collection_albums

See `docs/supabase-schema.sql` for the complete database schema.

## 🎨 Customization

### Themes
The app uses CSS custom properties for easy theming:
```css
:root {
    --primary-bg: #1a1a1a;
    --secondary-bg: #2a2a2a;
    --accent-color: #3b82f6;
    --text-primary: #ffffff;
}
```

### Configuration
Modify `src/config.js` to customize:
- API rate limiting and retry behavior
- UI animation timing and page sizes
- Debug logging levels
- Filter words and exclusion rules

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Discogs**: For providing the comprehensive music database API
- **Supabase**: For the excellent real-time database platform
- **Music Community**: For inspiring this tool for music discovery and organization

## 📧 Support

For questions or support, please open an issue on GitHub or contact [your-email@example.com].

---

**Built with ❤️ for music lovers and collection enthusiasts**
