document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const loadingScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('main-content');
    const solarSystem = document.getElementById('solar-system');
    const planetDetails = document.getElementById('planet-details');
    const backButton = document.getElementById('back-to-system');
    const resetViewButton = document.getElementById('reset-view');
    const ctaButton = document.querySelector('.cta-button');
    
    // Planet elements
    const planets = document.querySelectorAll('.planet');
    const planetContents = document.querySelectorAll('.planet-content');
    
    // State
    let currentPlanet = null;
    let isTransitioning = false;

    // Loading screen logic
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        mainContent.classList.remove('hidden');
        
        // Add entrance animation to solar system
        setTimeout(() => {
            solarSystem.style.opacity = '1';
            solarSystem.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 200);
    }, 4800);

    // Planet click handlers
    planets.forEach(planet => {
        planet.addEventListener('click', (e) => {
            if (isTransitioning) return;
            
            e.stopPropagation();
            const planetName = planet.dataset.planet;
            showPlanetDetails(planetName);
        });

        // Add hover sound effect (visual feedback)
        planet.addEventListener('mouseenter', () => {
            if (!isTransitioning) {
                planet.style.transform = 'scale(1.3)';
                planet.style.filter = 'brightness(1.3) drop-shadow(0 0 10px rgba(255, 255, 255, 0.8))';
            }
        });

        planet.addEventListener('mouseleave', () => {
            if (!isTransitioning) {
                planet.style.transform = 'scale(1)';
                planet.style.filter = 'brightness(1)';
            }
        });
    });

    // Show planet details
    function showPlanetDetails(planetName) {
        if (isTransitioning) return;
        
        isTransitioning = true;
        currentPlanet = planetName;
        
        // Hide solar system with zoom effect
        solarSystem.classList.add('zoomed');
        
        // Show planet details after zoom animation
        setTimeout(() => {
            planetDetails.classList.add('active');
            planetDetails.classList.remove('hidden');
            
            // Hide all planet content first
            planetContents.forEach(content => {
                content.classList.remove('active');
            });
            
            // Show specific planet content
            const targetContent = document.querySelector(`.planet-content[data-planet="${planetName}"]`);
            if (targetContent) {
                setTimeout(() => {
                    targetContent.classList.add('active');
                    isTransitioning = false;
                }, 300);
            }
        }, 400);
    }

    // Hide planet details
    function hidePlanetDetails() {
        if (isTransitioning) return;
        
        isTransitioning = true;
        
        // Hide planet details
        planetDetails.classList.remove('active');
        
        // Hide all planet content
        planetContents.forEach(content => {
            content.classList.remove('active');
        });
        
        setTimeout(() => {
            planetDetails.classList.add('hidden');
            
            // Show solar system
            solarSystem.classList.remove('zoomed');
            
            setTimeout(() => {
                currentPlanet = null;
                isTransitioning = false;
            }, 400);
        }, 300);
    }

    // Back button handler
    backButton.addEventListener('click', hidePlanetDetails);

    // Reset view button handler
    resetViewButton.addEventListener('click', () => {
        if (currentPlanet) {
            hidePlanetDetails();
        }
    });

    // CTA button handler
    ctaButton.addEventListener('click', () => {
        // Animate CTA button
        ctaButton.style.transform = 'scale(0.95)';
        ctaButton.style.boxShadow = '0 5px 15px rgba(255, 255, 255, 0.5)';
        
        setTimeout(() => {
            ctaButton.style.transform = 'scale(1)';
            ctaButton.style.boxShadow = '0 10px 30px rgba(255, 255, 255, 0.3)';
        }, 150);
        
        // You can add actual launch functionality here
        showLaunchModal();
    });

    // Launch modal (placeholder)
    function showLaunchModal() {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // Modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: var(--gray-900);
            border: 2px solid var(--white);
            border-radius: 20px;
            padding: 3rem;
            text-align: center;
            max-width: 500px;
            margin: 2rem;
        `;

        modalContent.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <div style="width: 80px; height: 80px; margin: 0 auto 1rem; border: 3px solid var(--white); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <div style="width: 50px; height: 50px; background: var(--white); border-radius: 50%; position: relative;">
                        <div style="width: 12px; height: 12px; background: var(--black); border-radius: 50%; position: absolute; top: 15px; right: 15px;"></div>
                    </div>
                </div>
                <h2 style="font-family: 'Space Mono', monospace; font-size: 2rem; margin-bottom: 1rem;">Ready to Launch?</h2>
                <p style="font-size: 1.1rem; line-height: 1.6; color: var(--gray-300); margin-bottom: 2rem;">
                    Join thousands of users who have already launched their projects into the Stratosphere. 
                    Experience the future of productivity and collaboration.
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="launch-demo" style="background: var(--white); color: var(--black); border: none; padding: 0.75rem 1.5rem; border-radius: 25px; font-weight: 600; cursor: pointer;">
                        Try Demo
                    </button>
                    <button id="close-modal" style="background: transparent; color: var(--white); border: 2px solid var(--white); padding: 0.75rem 1.5rem; border-radius: 25px; font-weight: 500; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Fade in modal
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);

        // Close modal handlers
        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        };

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        modalContent.querySelector('#close-modal').addEventListener('click', closeModal);
        modalContent.querySelector('#launch-demo').addEventListener('click', () => {
            // Placeholder for demo launch
            alert('Demo launching soon! 🚀');
            closeModal();
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'Escape':
                if (currentPlanet) {
                    hidePlanetDetails();
                }
                break;
                
            case 'Enter':
            case ' ':
                if (currentPlanet) {
                    // Space or Enter to go back to solar system
                    hidePlanetDetails();
                } else {
                    // Launch CTA
                    ctaButton.click();
                }
                e.preventDefault();
                break;
                
            // Number keys to select planets
            case '1': selectPlanet('mercury'); break;
            case '2': selectPlanet('venus'); break;
            case '3': selectPlanet('earth'); break;
            case '4': selectPlanet('mars'); break;
            case '5': selectPlanet('jupiter'); break;
            case '6': selectPlanet('saturn'); break;
            case '7': selectPlanet('uranus'); break;
            case '8': selectPlanet('neptune'); break;
        }
    });

    function selectPlanet(planetName) {
        if (!currentPlanet && !isTransitioning) {
            showPlanetDetails(planetName);
        }
    }

    // Add subtle parallax effect on mouse move
    document.addEventListener('mousemove', (e) => {
        if (currentPlanet || isTransitioning) return;
        
        const mouseX = (e.clientX - window.innerWidth / 2) / window.innerWidth;
        const mouseY = (e.clientY - window.innerHeight / 2) / window.innerHeight;
        
        const parallaxStrength = 10;
        
        solarSystem.style.transform = `translate(${-50 + mouseX * parallaxStrength}%, ${-50 + mouseY * parallaxStrength}%)`;
    });

    // Reset parallax on mouse leave
    document.addEventListener('mouseleave', () => {
        if (currentPlanet || isTransitioning) return;
        solarSystem.style.transform = 'translate(-50%, -50%)';
    });

    // Info toggle functionality
    const infoToggle = document.getElementById('info-toggle');
    let infoVisible = false;

    infoToggle.addEventListener('click', () => {
        infoVisible = !infoVisible;
        
        if (infoVisible) {
            showInfoOverlay();
        } else {
            hideInfoOverlay();
        }
    });

    function showInfoOverlay() {
        // Create info overlay
        const infoOverlay = document.createElement('div');
        infoOverlay.id = 'info-overlay';
        infoOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
            z-index: 1500;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const infoContent = document.createElement('div');
        infoContent.style.cssText = `
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid var(--white);
            border-radius: 20px;
            padding: 2rem;
            max-width: 600px;
            margin: 2rem;
            text-align: center;
        `;

        infoContent.innerHTML = `
            <h2 style="font-family: 'Space Mono', monospace; font-size: 2rem; margin-bottom: 1rem;">Navigation Guide</h2>
            <div style="text-align: left; font-size: 1rem; line-height: 1.6; color: var(--gray-300);">
                <h3 style="color: var(--white); margin: 1.5rem 0 0.5rem;">Mouse Controls:</h3>
                <ul style="margin-left: 1rem;">
                    <li>Click any planet to explore its features</li>
                    <li>Move mouse to create parallax effect</li>
                    <li>Hover planets for preview</li>
                </ul>
                
                <h3 style="color: var(--white); margin: 1.5rem 0 0.5rem;">Keyboard Shortcuts:</h3>
                <ul style="margin-left: 1rem;">
                    <li><strong>1-8</strong>: Jump to planets (Mercury to Neptune)</li>
                    <li><strong>Escape</strong>: Return to solar system</li>
                    <li><strong>Space/Enter</strong>: Launch Stratosphere</li>
                </ul>
                
                <h3 style="color: var(--white); margin: 1.5rem 0 0.5rem;">Features:</h3>
                <ul style="margin-left: 1rem;">
                    <li>Interactive solar system with realistic orbits</li>
                    <li>Detailed planet information pages</li>
                    <li>Smooth zoom transitions and animations</li>
                    <li>Responsive design for all devices</li>
                </ul>
            </div>
        `;

        infoOverlay.appendChild(infoContent);
        document.body.appendChild(infoOverlay);

        setTimeout(() => {
            infoOverlay.style.opacity = '1';
        }, 10);

        // Close on click outside or escape
        infoOverlay.addEventListener('click', (e) => {
            if (e.target === infoOverlay) {
                hideInfoOverlay();
            }
        });
    }

    function hideInfoOverlay() {
        const infoOverlay = document.getElementById('info-overlay');
        if (infoOverlay) {
            infoOverlay.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(infoOverlay);
            }, 300);
        }
        infoVisible = false;
    }

    // Add smooth scrolling for planet content (if content is long)
    planetContents.forEach(content => {
        content.addEventListener('wheel', (e) => {
            e.stopPropagation();
        });
    });

    // Performance optimization: pause animations when not visible
    let isVisible = true;
    
    document.addEventListener('visibilitychange', () => {
        isVisible = !document.hidden;
        
        if (!isVisible) {
            // Pause animations
            solarSystem.style.animationPlayState = 'paused';
            planets.forEach(planet => {
                planet.style.animationPlayState = 'paused';
            });
        } else {
            // Resume animations
            solarSystem.style.animationPlayState = 'running';
            planets.forEach(planet => {
                planet.style.animationPlayState = 'running';
            });
        }
    });

    // Touch support for mobile devices
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // Swipe gestures
        if (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50) {
            if (currentPlanet && Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0) {
                // Swipe down to go back
                hidePlanetDetails();
            }
        }
    });

    // Preload images/animations for smooth experience
    const preloadTimer = setTimeout(() => {
        // Force a repaint to ensure all animations are ready
        document.body.offsetHeight;
        
        // Add loaded class for any additional styling
        document.body.classList.add('loaded');
    }, 100);

    console.log('🚀 Stratosphere Solar System loaded successfully!');
    console.log('Use number keys 1-8 to navigate planets, or click to explore!');
});