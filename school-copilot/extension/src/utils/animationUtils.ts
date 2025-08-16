/**
 * Animation Utilities
 * Helper functions for managing animations and transitions
 */

// Animation state management
export class AnimationManager {
  private static instance: AnimationManager;
  private animations: Map<string, Animation> = new Map();
  private observers: Map<string, IntersectionObserver> = new Map();
  private prefersReducedMotion: boolean = false;

  private constructor() {
    this.checkReducedMotionPreference();
    this.setupMediaQueryListener();
  }

  static getInstance(): AnimationManager {
    if (!AnimationManager.instance) {
      AnimationManager.instance = new AnimationManager();
    }
    return AnimationManager.instance;
  }

  private checkReducedMotionPreference(): void {
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private setupMediaQueryListener(): void {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
      if (this.prefersReducedMotion) {
        this.pauseAllAnimations();
      }
    });
  }

  // Create and manage animations
  createAnimation(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
    id?: string
  ): Animation | null {
    if (this.prefersReducedMotion) {
      return null;
    }

    const animation = element.animate(keyframes, options);
    
    if (id) {
      this.animations.set(id, animation);
    }

    return animation;
  }

  // Pause all animations
  pauseAllAnimations(): void {
    this.animations.forEach(animation => {
      animation.pause();
    });
  }

  // Resume all animations
  resumeAllAnimations(): void {
    if (!this.prefersReducedMotion) {
      this.animations.forEach(animation => {
        animation.play();
      });
    }
  }

  // Remove animation
  removeAnimation(id: string): void {
    const animation = this.animations.get(id);
    if (animation) {
      animation.cancel();
      this.animations.delete(id);
    }
  }

  // Check if animations are enabled
  areAnimationsEnabled(): boolean {
    return !this.prefersReducedMotion;
  }

  // Intersection observer for scroll animations
  observeElement(
    element: Element,
    callback: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit
  ): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(callback);
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
      ...options
    });

    observer.observe(element);
    this.observers.set(element.id || Math.random().toString(), observer);
  }

  // Cleanup
  cleanup(): void {
    this.animations.forEach(animation => animation.cancel());
    this.animations.clear();
    
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// Animation presets
export const animationPresets = {
  // Entrance animations
  fadeIn: {
    keyframes: [
      { opacity: 0 },
      { opacity: 1 }
    ],
    options: {
      duration: 300,
      easing: 'ease-out',
      fill: 'both' as FillMode
    }
  },

  slideInFromRight: {
    keyframes: [
      { transform: 'translateX(100%)', opacity: 0 },
      { transform: 'translateX(0)', opacity: 1 }
    ],
    options: {
      duration: 350,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'both' as FillMode
    }
  },

  slideInFromLeft: {
    keyframes: [
      { transform: 'translateX(-100%)', opacity: 0 },
      { transform: 'translateX(0)', opacity: 1 }
    ],
    options: {
      duration: 350,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'both' as FillMode
    }
  },

  slideInFromTop: {
    keyframes: [
      { transform: 'translateY(-100%)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ],
    options: {
      duration: 350,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'both' as FillMode
    }
  },

  slideInFromBottom: {
    keyframes: [
      { transform: 'translateY(100%)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ],
    options: {
      duration: 350,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'both' as FillMode
    }
  },

  scaleIn: {
    keyframes: [
      { transform: 'scale(0.8)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1 }
    ],
    options: {
      duration: 300,
      easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      fill: 'both' as FillMode
    }
  },

  // Exit animations
  fadeOut: {
    keyframes: [
      { opacity: 1 },
      { opacity: 0 }
    ],
    options: {
      duration: 250,
      easing: 'ease-in',
      fill: 'both' as FillMode
    }
  },

  slideOutToRight: {
    keyframes: [
      { transform: 'translateX(0)', opacity: 1 },
      { transform: 'translateX(100%)', opacity: 0 }
    ],
    options: {
      duration: 300,
      easing: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
      fill: 'both' as FillMode
    }
  },

  scaleOut: {
    keyframes: [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(0.8)', opacity: 0 }
    ],
    options: {
      duration: 250,
      easing: 'ease-in',
      fill: 'both' as FillMode
    }
  },

  // Attention animations
  pulse: {
    keyframes: [
      { transform: 'scale(1)' },
      { transform: 'scale(1.05)' },
      { transform: 'scale(1)' }
    ],
    options: {
      duration: 1000,
      easing: 'ease-in-out',
      iterations: Infinity
    }
  },

  bounce: {
    keyframes: [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-10px)' },
      { transform: 'translateY(0)' }
    ],
    options: {
      duration: 600,
      easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      iterations: 1
    }
  },

  shake: {
    keyframes: [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-10px)' },
      { transform: 'translateX(10px)' },
      { transform: 'translateX(-10px)' },
      { transform: 'translateX(10px)' },
      { transform: 'translateX(0)' }
    ],
    options: {
      duration: 500,
      easing: 'ease-in-out',
      iterations: 1
    }
  },

  // Loading animations
  spin: {
    keyframes: [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(360deg)' }
    ],
    options: {
      duration: 1000,
      easing: 'linear',
      iterations: Infinity
    }
  },

  // Hover animations
  liftUp: {
    keyframes: [
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(-2px) scale(1.02)' }
    ],
    options: {
      duration: 200,
      easing: 'ease-out',
      fill: 'both' as FillMode
    }
  }
};

// Animation helper functions
export const animateElement = (
  element: Element,
  animationName: keyof typeof animationPresets,
  options?: Partial<KeyframeAnimationOptions>
): Promise<void> => {
  const manager = AnimationManager.getInstance();
  
  if (!manager.areAnimationsEnabled()) {
    return Promise.resolve();
  }

  const preset = animationPresets[animationName];
  const mergedOptions = { ...preset.options, ...options };
  
  return new Promise((resolve) => {
    const animation = manager.createAnimation(
      element,
      preset.keyframes,
      mergedOptions
    );

    if (animation) {
      animation.addEventListener('finish', () => resolve());
      animation.addEventListener('cancel', () => resolve());
    } else {
      resolve();
    }
  });
};

// Stagger animation for multiple elements
export const staggerAnimation = async (
  elements: Element[],
  animationName: keyof typeof animationPresets,
  delay: number = 100,
  options?: Partial<KeyframeAnimationOptions>
): Promise<void> => {
  const promises = elements.map((element, index) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        animateElement(element, animationName, options).then(resolve);
      }, index * delay);
    });
  });

  await Promise.all(promises);
};

// Scroll-triggered animations
export const setupScrollAnimations = (): void => {
  const manager = AnimationManager.getInstance();
  
  if (!manager.areAnimationsEnabled()) {
    return;
  }

  const animatedElements = document.querySelectorAll('[data-animate]');
  
  animatedElements.forEach((element) => {
    const animationName = element.getAttribute('data-animate') as keyof typeof animationPresets;
    const delay = parseInt(element.getAttribute('data-animate-delay') || '0');
    
    if (animationPresets[animationName]) {
      manager.observeElement(element, (entry) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            animateElement(element, animationName);
          }, delay);
        }
      });
    }
  });
};

// Window focus/blur animation control
export const setupFocusAnimationControl = (): void => {
  const manager = AnimationManager.getInstance();
  
  window.addEventListener('blur', () => {
    manager.pauseAllAnimations();
    document.documentElement.setAttribute('data-window-focused', 'false');
  });
  
  window.addEventListener('focus', () => {
    manager.resumeAllAnimations();
    document.documentElement.setAttribute('data-window-focused', 'true');
  });
};

// Performance monitoring
export const measureAnimationPerformance = (
  callback: () => void,
  label: string = 'Animation'
): void => {
  if (performance.mark) {
    performance.mark(`${label}-start`);
    
    requestAnimationFrame(() => {
      callback();
      
      requestAnimationFrame(() => {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
        
        const measure = performance.getEntriesByName(label)[0];
        if (measure.duration > 16.67) { // More than one frame at 60fps
          console.warn(`Animation "${label}" took ${measure.duration.toFixed(2)}ms`);
        }
        
        performance.clearMarks(`${label}-start`);
        performance.clearMarks(`${label}-end`);
        performance.clearMeasures(label);
      });
    });
  } else {
    callback();
  }
};

// CSS animation utilities
export const addCSSAnimation = (
  element: Element,
  className: string,
  duration?: number
): Promise<void> => {
  return new Promise((resolve) => {
    const manager = AnimationManager.getInstance();
    
    if (!manager.areAnimationsEnabled()) {
      resolve();
      return;
    }

    element.classList.add(className);
    
    const handleAnimationEnd = () => {
      element.classList.remove(className);
      element.removeEventListener('animationend', handleAnimationEnd);
      resolve();
    };
    
    element.addEventListener('animationend', handleAnimationEnd);
    
    // Fallback timeout
    if (duration) {
      setTimeout(() => {
        element.classList.remove(className);
        element.removeEventListener('animationend', handleAnimationEnd);
        resolve();
      }, duration);
    }
  });
};

// Cleanup function
export const cleanupAnimations = (): void => {
  AnimationManager.getInstance().cleanup();
};

// Initialize animation system
export const initializeAnimationSystem = (): void => {
  setupScrollAnimations();
  setupFocusAnimationControl();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanupAnimations);
};

// Export the animation manager instance
export const animationManager = AnimationManager.getInstance();