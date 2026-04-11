// System Config
       const API_BASE = "https://gallery-backend-0e83.onrender.com";
        
        // Application State
        const state = {
            currentView: 'dashboard',
            artists: [],
            artworks: [],
            isApiOnline: true,
            galleryValue: 0,
            highestPricedArtwork: 0
        };

        const FALLBACK_ART_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/e/ea/The_Starry_Night.jpg';

        let editingArtistId = null;
        let editingArtworkId = null;

        // Initialize App
        document.addEventListener('DOMContentLoaded', async () => {
            initParticles();
            setupMouseTracking();
            ensureInitialViewVisible();
            
            // GSAP Initial Intro
            const tl = gsap.timeline();
            gsap.set('.view-section:not(.active)', { autoAlpha: 0, scale: 0.95 });
            
            tl.to('#sidebar', { x: 0, duration: 0.8, ease: 'power4.out' })
              .from('header', { y: -20, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, "-=0.6")
              .from('.dashboard-module', { y: 30, autoAlpha: 0, duration: 0.8, stagger: 0.05, ease: 'back.out(1.2)' }, "-=0.4");

            await fetchAllData();

                        // Guarantee dashboard content is painted on first load.
                        if (state.currentView === 'dashboard') {
                                renderDashboardModules();
                        }

            // Search
            document.getElementById('global-search').addEventListener('input', handleSearch);
        });

        // -----------------------------------------
        // Core Visual Effects
        // -----------------------------------------

        function ensureInitialViewVisible() {
            const initialView = document.querySelector('.view-section.active') || document.getElementById(state.currentView);
            if (!initialView) return;

            gsap.set(initialView, { autoAlpha: 1, scale: 1, y: 0 });
        }
        
        // Linear-style Card Glow Mouse Tracking
        function setupMouseTracking() {
            document.getElementById('main-scroll-area').addEventListener('mousemove', e => {
                document.querySelectorAll('.hover-card').forEach(card => {
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    card.style.setProperty('--mouse-x', `${x}px`);
                    card.style.setProperty('--mouse-y', `${y}px`);
                });
            });
        }

        // Floating Background Particles
        function initParticles() {
            const container = document.getElementById('particles');
            const particleCount = 25;
            for (let i = 0; i < particleCount; i++) {
                const p = document.createElement('div');
                p.className = 'particle';
                
                // Randomize properties
                const size = Math.random() * 4 + 1;
                const left = Math.random() * 100;
                const duration = Math.random() * 20 + 10;
                const delay = Math.random() * 10;
                
                p.style.width = `${size}px`;
                p.style.height = `${size}px`;
                p.style.left = `${left}%`;
                p.style.animationDuration = `${duration}s`;
                p.style.animationDelay = `-${delay}s`;
                
                container.appendChild(p);
            }
        }

        // Floating Stats Animation
        gsap.to('.stat-card', {
            y: -5,
            duration: 3,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            stagger: {
                amount: 1,
                from: "random"
            }
        });

        // -----------------------------------------
        // Navigation Logic
        // -----------------------------------------
        function navigateTo(targetId) {
            if (state.currentView === targetId) return;

            const currentEl = document.getElementById(state.currentView);
            const targetEl = document.getElementById(targetId);
            
            // Update Sidebar UI
            document.querySelectorAll('.nav-btn:not(.cursor-not-allowed)').forEach(btn => {
                const isActive = btn.dataset.nav === targetId;
                const span = btn.querySelector('span');
                const icon = btn.querySelector('svg');
                const bg = btn.querySelector('div'); // The gradient bg

                if(isActive) {
                    btn.classList.add('bg-white/10', 'text-white', 'border-white/10', 'shadow-[0_0_10px_rgba(255,255,255,0.05)]');
                    btn.classList.remove('text-gray-400', 'border-transparent', 'hover:border-white/5', 'hover:bg-white/5');
                    span.classList.add('text-white');
                    icon.classList.replace('text-gray-500', 'text-brand-400');
                    bg.classList.replace('opacity-0', 'opacity-100');
                } else {
                    btn.classList.remove('bg-white/10', 'text-white', 'border-white/10', 'shadow-[0_0_10px_rgba(255,255,255,0.05)]');
                    btn.classList.add('text-gray-400', 'border-transparent', 'hover:border-white/5', 'hover:bg-white/5');
                    span.classList.remove('text-white');
                    icon.classList.replace('text-brand-400', 'text-gray-500');
                    bg.classList.replace('opacity-100', 'opacity-0');
                }
            });

            // Update Header Title
            const titles = { dashboard: 'Dashboard', artists: 'Artist Directory', artworks: 'Artwork Vault' };
            document.getElementById('page-title').textContent = titles[targetId];
            document.getElementById('global-search').value = '';

            // Crossfade Section Transition
            gsap.to(currentEl, {
                autoAlpha: 0,
                scale: 0.98,
                duration: 0.3,
                ease: 'power2.in',
                onComplete: () => {
                    currentEl.classList.remove('active');
                    
                    targetEl.classList.add('active');
                    gsap.fromTo(targetEl, 
                        { autoAlpha: 0, scale: 1.02, y: 20 },
                        { autoAlpha: 1, scale: 1, y: 0, duration: 0.5, ease: 'power3.out' }
                    );
                    
                    state.currentView = targetId;
                    
                    // Stagger cards in
                    if(targetId === 'artists') animateCards('.artist-card');
                    if(targetId === 'artworks') animateCards('.artwork-card');
                    if(targetId === 'dashboard') animateCards('.dashboard-module');
                    
                    // Ensure fresh render
                    if(targetId === 'artists') renderArtists(state.artists);
                    if(targetId === 'artworks') renderArtworks(state.artworks);
                }
            });
        }

        // -----------------------------------------
        // Data Fetching & API
        // -----------------------------------------
        async function fetchAllData() {
            try {
                // Fetch from localhost per requirements
                const [artistsRes, artworksRes] = await Promise.all([
                    fetch(`${API_BASE}/artists`).catch(() => ({ok: false})),
                    fetch(`${API_BASE}/artworks`).catch(() => ({ok: false}))
                ]);

                if (!artistsRes.ok) {
                    throw new Error("Local API Offline");
                }

                state.artists = await artistsRes.json();
                const rawArtworks = await artworksRes.json();
                state.artworks = rawArtworks.map(normalizeArtwork);
                
                updateApiStatus(true);
                processDashboardData();
                updateCounters();
                renderDashboardModules();
                renderArtists(state.artists);
                renderArtworks(state.artworks);

            } catch (error) {
                console.warn("API Offline. Populating stunning mock data for demo.");
                updateApiStatus(false);
                
                generateMockData();
                processDashboardData();
                updateCounters();
                renderDashboardModules();
                renderArtists(state.artists);
                renderArtworks(state.artworks);
            }
        }

        function normalizeArtwork(art) {
            return {
                ...art,
                year: art.year ?? art.year_in_made ?? '2024',
                image_url: art.image_url 
    ? `${API_BASE}/uploads/${art.image_url}` 
    : FALLBACK_ART_IMAGE,
            };
        }

        function updateApiStatus(isOnline) {
            state.isApiOnline = isOnline;
            const statusText = document.getElementById('api-status');
            const ping = document.getElementById('api-ping');
            const dot = document.getElementById('api-dot');
            
            if(isOnline) {
                statusText.textContent = 'API Connected';
                statusText.className = 'text-xs font-semibold text-emerald-400 tracking-wide';
                ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
                dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]';
            } else {
                statusText.textContent = 'Demo Mode (Mock DB)';
                statusText.className = 'text-xs font-semibold text-amber-400 tracking-wide';
                ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75';
                dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]';
            }
        }

        // -----------------------------------------
        // Rendering & Data Binding
        // -----------------------------------------
        
        function processDashboardData() {
            state.galleryValue = state.artworks.reduce((sum, art) => sum + Number(art.price || 0), 0);
            state.highestPricedArtwork = Math.max(...state.artworks.map(art => Number(art.price || 0)), 0);
        }

        function updateCounters() {
            const countA = document.getElementById('count-artists');
            const countW = document.getElementById('count-artworks');
            const countV = document.getElementById('count-value');
            const countNewA = document.getElementById('count-new-artists');
            
            countA.setAttribute('data-target', state.artists.length);
            countW.setAttribute('data-target', state.artworks.length);
            countV.setAttribute('data-target', state.galleryValue);
            // Simulate random new artists this month for visual effect based on total
            countNewA.setAttribute('data-target', Math.max(1, Math.floor(state.artists.length / 3)));

            gsap.utils.toArray('.counter').forEach(el => {
                let target = parseInt(el.getAttribute('data-target')) || 0;
                gsap.to(el, {
                    innerHTML: target,
                    duration: 2,
                    snap: { innerHTML: 1 },
                    ease: "power3.out",
                    onUpdate: function() {
                        const val = Math.round(this.targets()[0].innerHTML);
                        // Add comma formatting if it's the value counter
                        if(el.id === 'count-value') {
                            el.innerHTML = val.toLocaleString('en-IN');
                        } else {
                            el.innerHTML = val;
                        }
                    }
                });
            });
        }

        function renderDashboardModules() {
            // Arts Module (Featured)
if(state.artworks.length > 0) {

    const featured = state.artworks.reduce((max, art) =>
        Number(art.price) > Number(max.price) ? art : max
    );

    document.getElementById("featured-image").src = featured.image_url;

    document.getElementById('featured-title').textContent = featured.title || 'Untitled';
    document.getElementById('featured-style').textContent = featured.style || 'Digital';
    document.getElementById('featured-year').textContent = featured.year || '2024';

    const priceEl = document.getElementById('featured-price');

    gsap.to(priceEl, {
        innerHTML: featured.price || 0,
        duration: 1.5,
        snap: { innerHTML: 1 },
        onUpdate: function() {
            priceEl.innerHTML = "₹" + Number(this.targets()[0].innerHTML).toLocaleString('en-IN');
        }
    });

}

            // Transaction Module
            document.getElementById('tx-highest-price').textContent =
`₹${state.highestPricedArtwork.toLocaleString('en-IN')}`;

            // Stock Module
            const availableCount = state.artworks.length;
            document.getElementById('stock-available').textContent = availableCount;
            // animate stock bar
            gsap.to('#stock-bar', { width: '85%', duration: 1.5, ease: "power2.out", delay: 0.5 });

            // Recent Artists
            const recentArtistsList = document.getElementById('recent-artists-list');
            const recentA = state.artists.slice(-3).reverse(); // simulate last 3
            if(recentA.length === 0) {
                recentArtistsList.innerHTML = `<li class="p-6 text-sm text-gray-500 text-center">No artists found.</li>`;
            } else {
                recentArtistsList.innerHTML = recentA.map(artist => `
                    <li class="p-4 flex items-center hover:bg-white/5 transition-colors cursor-pointer" onclick="navigateTo('artists')">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm shadow-sm mr-3">
                            ${(artist.name || 'X').charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-white truncate">${artist.name}</p>
                            <p class="text-xs text-brand-400 truncate">${artist.qualification || 'Verified Artist'}</p>
                        </div>
                        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </li>
                `).join('');
            }

            // Gallery Preview Grid
            const previewGrid = document.getElementById('gallery-preview-grid');
            const previews = state.artworks.slice(0, 3); // take first 3 for preview
            if(previews.length === 0) {
                previewGrid.innerHTML = `<div class="text-sm text-gray-500 col-span-full">No artworks available.</div>`;
            } else {
                previewGrid.innerHTML = previews.map((art, i) => `
    <div class="bg-white/5 border border-white/5 rounded-xl overflow-hidden group cursor-pointer">

        <div class="h-28 overflow-hidden border-b border-white/5">
            <img src="${art.image_url}"
                 class="w-full h-full object-cover">
        </div>

        <div class="p-3">
            <h4 class="text-sm font-bold text-white truncate mb-1">${art.title}</h4>

            <div class="flex justify-between items-center">
                <span class="text-[10px] text-gray-400">${art.style}</span>
                <span class="text-xs font-bold text-emerald-400">₹${Number(art.price).toLocaleString('en-IN')}</span>
            </div>
        </div>

    </div>
`).join('');
            }
        }

        function animateCards(selector) {
            gsap.fromTo(selector, 
                { autoAlpha: 0, y: 40, rotationX: 10 },
                { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(1.5)', overwrite: 'auto' }
            );
        }

        function renderArtists(data) {
            const container = document.getElementById('artists-container');
            if(!data.length) {
                container.innerHTML = getEmptyState('artists');
                return;
            }

            container.innerHTML = data.map((artist, i) => `
                <div class="artist-card hover-card glass-panel rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-2 cursor-pointer flex flex-col h-full border border-white/5">
                    <div class="card-content flex-1">
                        <div class="flex justify-between items-start mb-5">
                            <div class="w-14 h-14 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center text-xl font-bold text-white shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 ring-2 ring-white/5 relative overflow-hidden group-hover:ring-brand-500/50 transition-all">
                                ${(artist.name || 'X').charAt(0).toUpperCase()}
                                <div class="absolute inset-0 bg-brand-500/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                            </div>
                            <div class="flex gap-2">

<button onclick="editArtist(${artist.artist_id})"
class="text-gray-600 hover:text-blue-400 transition-colors p-2 bg-black/20 rounded-lg border border-transparent hover:border-blue-400/30 hover:bg-blue-400/10"
title="Edit artist">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
d="M11 5h2M12 7v12M5 19h14M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"></path>
</svg>
</button>

<button onclick="deleteArtist(${artist.artist_id})"
class="text-gray-600 hover:text-rose-500 transition-colors p-2 bg-black/20 rounded-lg border border-transparent hover:border-rose-500/30 hover:bg-rose-500/10"
title="Delete record">

<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
</svg>

</button>

</div>
                        </div>
                        
                        <h3 class="text-xl font-bold text-white mb-1 drop-shadow-sm tracking-tight">${artist.name}</h3>
                        <p class="text-sm text-brand-400 font-medium mb-6 flex items-center">
                            <svg class="w-3.5 h-3.5 mr-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            ${artist.qualification || 'Verified Artist'}
                        </p>
                        
                        <div class="space-y-3 pt-5 border-t border-white/5">
                            <div class="flex items-start text-sm">
                                <div class="p-1.5 bg-white/5 rounded-md mr-3 border border-white/5">
                                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </div>
                                <span class="text-gray-400 truncate mt-1 font-medium">${artist.address || '0x...Unknown'}</span>
                            </div>
                            <div class="flex items-center text-sm">
                                <div class="p-1.5 bg-white/5 rounded-md mr-3 border border-white/5">
                                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                </div>
                                <span class="text-gray-400 truncate font-medium">${artist.contact || 'No routing address'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        function renderArtworks(data) {
            const container = document.getElementById('artworks-container');
            if(!data.length) {
                container.innerHTML = getEmptyState('artworks');
                return;
            }

            container.innerHTML = data.map((art, i) => `
                <div class="artwork-card hover-card glass-panel rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 flex flex-col border border-white/5 cursor-pointer">
                    <div class="h-52 border-b border-white/5 relative">

<img src="${art.image_url}"
class="absolute top-0 left-0 w-full h-full object-cover"
onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/e/ea/The_Starry_Night.jpg'">

</div>
                    
                    <div class="card-content p-6 flex flex-col flex-1 bg-black/20">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="text-lg font-bold text-white truncate pr-2 tracking-tight drop-shadow-sm">${art.title || 'Untitled_0x'}</h3>
                            <div class="flex gap-2">

<button onclick="editArtwork(${art.art_id})"
class="text-gray-600 hover:text-blue-400 transition-colors p-2 bg-black/20 rounded-lg border border-transparent hover:border-blue-400/30 hover:bg-blue-400/10"
title="Edit artwork">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
d="M11 5h2M12 7v12M5 19h14M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"></path>
</svg>
</button>

<button onclick="deleteArtwork(${art.art_id})"
class="text-gray-600 hover:text-rose-500 transition-colors p-2 bg-black/20 rounded-lg border border-transparent hover:border-rose-500/30 hover:bg-rose-500/10"
title="Delete record">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
</svg>
</button>

</div>
                        </div>
                        
                        <div class="flex items-center gap-2 mb-6">
                            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-brand-500/10 text-brand-300 border border-brand-500/20 uppercase tracking-widest">
                                ${art.style || 'Digital'}
                            </span>
                            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-white/5 text-gray-400 border border-white/5">
                                ${art.year || '202X'}
                            </span>
                        </div>
                        
                        <div class="mt-auto pt-4 flex justify-between items-end border-t border-white/5">
                            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Floor Price</span>
                            <div class="text-right">
                                <span class="font-bold text-white text-lg drop-shadow-sm">₹${Number(art.price || 0).toLocaleString('en-IN')}</span>
<span class="text-xs text-emerald-400 ml-1">INR</span>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // -----------------------------------------
        // Utilities
        // -----------------------------------------
        function handleSearch(e) {
            const term = e.target.value.toLowerCase();
            if(state.currentView === 'artists') {
                const filtered = state.artists.filter(a => 
                    (a.name && a.name.toLowerCase().includes(term)) || 
                    (a.qualification && a.qualification.toLowerCase().includes(term))
                );
                renderArtists(filtered);
            } else if (state.currentView === 'artworks') {
                const filtered = state.artworks.filter(a => 
                    (a.title && a.title.toLowerCase().includes(term)) || 
                    (a.style && a.style.toLowerCase().includes(term))
                );
                renderArtworks(filtered);
            }
        }

        function getEmptyState(type) {
            return `
                <div class="col-span-full py-20 text-center border border-dashed border-white/10 rounded-2xl bg-black/20 backdrop-blur-md">
                    <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
                        <svg class="h-8 w-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                    </div>
                    <h3 class="text-base font-semibold text-white tracking-tight">No ${type} found in DB</h3>
                    <p class="mt-2 text-sm text-gray-500 max-w-sm mx-auto">The decentralized index returned no results. Deploy a new contract to populate the grid.</p>
                </div>
            `;
        }

        // Stunning Mock Data for Demo
        function generateMockData() {
            state.artists = [
                { name: 'Aria Nova', qualification: 'Generative AI Specialist', address: '0x71C...3B92', contact: 'aria.eth' },
                { name: 'Kaelen Void', qualification: '3D Motion Designer', address: '0x88A...9F11', contact: 'void@studio.io' },
                { name: 'Cipher.art', qualification: 'Creative Coder', address: '0x22F...1E88', contact: 'cipher_art.lens' },
                { name: 'Elena Rostova', qualification: 'Classical -> Digital', address: 'Brooklyn, NY (Node)', contact: 'elena@crypto.art' },
                { name: 'Zeta Protocol', qualification: 'Algorithmic Collective', address: 'On-chain', contact: 'zeta.dao' }
            ];
            
            state.artworks = [
                { title: 'Neon Silence_v2', style: 'Cyberpunk', price: 12500, year: 2024 },
                { title: 'Fragmented Reality', style: 'Glitch Art', price: 8400, year: 2023 },
                { title: 'The Architect AI', style: 'Neural Gen', price: 28000, year: 2024 },
                { title: 'Midnight Bloom.exe', style: 'Voxel', price: 5900, year: 2022 },
                { title: 'Digital Horizons', style: 'Generative', price: 14200, year: 2024 },
                { title: 'Echoes of Bronze', style: 'Photogrammetry', price: 45000, year: 2023 }
            ];
        }

        async function deleteArtist(id){

if(!confirm("Delete this artist?")) return;

await fetch(`https://gallery-backend-0e83.onrender.com/artists/${id}`,{
method:"DELETE"
});

fetchAllData();

}

async function deleteArtwork(id){

if(!confirm("Delete this artwork?")) return;

await fetch(`https://gallery-backend-0e83.onrender.com/artworks/${id}`,{
method:"DELETE"
});

fetchAllData();

}

function editArtwork(id){

editingArtworkId = id;

const art = state.artworks.find(a => a.art_id === id);

document.getElementById("artwork-form").classList.remove("hidden");

document.getElementById("artTitle").value = art.title;
document.getElementById("artStyle").value = art.style;
document.getElementById("artYear").value = art.year_in_made;
document.getElementById("artPrice").value = art.price;

}

async function editArtist(id){

editingArtistId = id;

const artist = state.artists.find(a => a.artist_id === id);

document.getElementById("artist-form").classList.remove("hidden");

document.getElementById("artistName").value = artist.name;
document.getElementById("artistQualification").value = artist.qualification;
document.getElementById("artistAddress").value = artist.address;
document.getElementById("artistContact").value = artist.contact;

}

function showArtistForm(){
document.getElementById("artist-form").classList.remove("hidden")
}

async function submitArtist(){

const name = document.getElementById("artistName").value;
const qualification = document.getElementById("artistQualification").value;
const address = document.getElementById("artistAddress").value;
const contact = document.getElementById("artistContact").value;

if(editingArtistId){

await fetch(`https://gallery-backend-0e83.onrender.com/artists/${editingArtistId}`,{
method:"PUT",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
name,
qualification,
address,
contact
})
});

editingArtistId = null;

}else{

await fetch("https://gallery-backend-0e83.onrender.com/artists",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
name,
qualification,
address,
contact
})
});

}

fetchAllData();

hideArtistForm();

}

function hideArtistForm(){
document.getElementById("artist-form").classList.add("hidden")
}

function showArtworkForm(){
document.getElementById("artwork-form").classList.remove("hidden")
}

function hideArtworkForm(){
document.getElementById("artwork-form").classList.add("hidden")
}

async function submitArtwork(){

const title=document.getElementById("artTitle").value
const style=document.getElementById("artStyle").value
const year=document.getElementById("artYear").value
const price=document.getElementById("artPrice").value

if(editingArtworkId){

await fetch(`https://gallery-backend-0e83.onrender.com/artworks/${editingArtworkId}`,{
method:"PUT",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
title:title,
style:style,
year_in_made:year,
price:price
})
})

editingArtworkId=null

}else{

await fetch("https://gallery-backend-0e83.onrender.com/artworks",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
title:title,
style:style,
year_in_made:year,
price:price
})
})

}

fetchAllData()
hideArtworkForm()

}
