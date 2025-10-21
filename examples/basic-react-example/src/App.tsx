import React, { useEffect, useState } from 'react';
import { adapty, createPaywallView, AdaptyProfile, AdaptyPaywall } from '@adapty/capacitor';
import { getApiKey, getPlacementId } from './helpers';
import { recipes, Recipe } from './recipes';
import styles from './main.module.css';

const App: React.FC = () => {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdaptyProfile | null>(null);
  const [paywall, setPaywall] = useState<AdaptyPaywall | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Initialize Adapty SDK on mount
  useEffect(() => {
    initializeAdapty();
  }, []);

  // Initialize Adapty: activate, load profile, load paywall
  const initializeAdapty = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Activate SDK
      await adapty.activate({
        apiKey: getApiKey(),
        params: {
          // Prevent SDK re-activation on fast refresh during development
          __ignoreActivationOnFastRefresh: import.meta.env.DEV,
        },
      });

      // Step 2: Get user profile
      const userProfile = await adapty.getProfile();
      setProfile(userProfile);

      // Step 3: Load paywall
      const paywallData = await adapty.getPaywall({
        placementId: getPlacementId(),
      });
      setPaywall(paywallData);

      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Adapty SDK';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  // Check if user has premium access
  const isPremiumActive = profile?.accessLevels?.['premium']?.isActive ?? false;

  // Handle recipe click
  const handleRecipeClick = async (recipe: Recipe) => {
    // If recipe is not premium or user has premium access, show details
    const isRecipeFree = !recipe.isPremium;
    if (isRecipeFree || isPremiumActive) {
      setSelectedRecipe(recipe);
      return;
    }

    // Otherwise, show paywall
    await showPaywall();
  };

  // Show paywall using Paywall Builder
  const showPaywall = async () => {
    if (!paywall) {
      setError('Paywall not loaded. Please try again.');
      return;
    }

    if (!paywall.hasViewConfiguration) {
      setError('Paywall does not have Paywall Builder configuration.');
      return;
    }

    try {
      // Create paywall view
      const view = await createPaywallView(paywall);

      // Set up event handlers
      await view.setEventHandlers({
        onPurchaseCompleted: (purchaseResult, _product) => {
          // Purchase completed successfully
          if (purchaseResult.type === 'success') {
            // Update profile to reflect new access level
            setProfile(purchaseResult.profile);
            // Close paywall
            return true;
          }
          // Don't close for cancelled or pending purchases
          return false;
        },
      });

      // Present the paywall
      await view.present();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to show paywall';
      setError(errorMessage);
    }
  };

  // Go back from recipe detail view
  const handleBack = () => {
    setSelectedRecipe(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading Adapty SDK...</div>
      </div>
    );
  }

  // Detail view for selected recipe
  if (selectedRecipe) {
    return (
      <div className={styles.container}>
        <div className={styles.detailView}>
          <h2>{selectedRecipe.title}</h2>
          <p>{selectedRecipe.description}</p>
          <button className={styles.backButton} onClick={handleBack}>
            ← Back to Recipes
          </button>
        </div>
      </div>
    );
  }

  // Main recipe list view
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Adapty Recipes (React)</h1>
      </header>

      {/* Error display */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Premium status bar */}
      <div className={`${styles.statusBar} ${isPremiumActive ? styles.statusPremium : styles.statusFree}`}>
        {isPremiumActive ? '✓ Premium Active' : 'Free Plan'}
      </div>

      {/* Basic Recipes Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Basic Recipes (Free)</h2>
        {recipes
          .filter((recipe) => !recipe.isPremium)
          .map((recipe) => (
            <div key={recipe.id} className={styles.recipeCard} onClick={() => handleRecipeClick(recipe)}>
              <div className={styles.recipeTitle}>{recipe.title}</div>
              <div className={styles.recipeDescription}>{recipe.description}</div>
            </div>
          ))}
      </section>

      {/* Premium Recipes Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Premium Recipes</h2>
        {recipes
          .filter((recipe) => recipe.isPremium)
          .map((recipe) => (
            <div
              key={recipe.id}
              className={`${styles.recipeCard} ${!isPremiumActive ? styles.recipeCardLocked : ''}`}
              onClick={() => handleRecipeClick(recipe)}
            >
              <div className={styles.recipeTitle}>
                {!isPremiumActive && <span className={styles.lockIcon}>🔒</span>}
                {recipe.title}
              </div>
              <div className={styles.recipeDescription}>{recipe.description}</div>
            </div>
          ))}
      </section>
    </div>
  );
};

export default App;
