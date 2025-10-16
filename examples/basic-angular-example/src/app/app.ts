import { Component, OnInit, NgZone } from '@angular/core';
import { adapty, createPaywallView, AdaptyProfile, AdaptyPaywall } from '@adapty/capacitor';
import { getApiKey, getPlacementId } from './helpers';
import { recipes, Recipe } from './recipes';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  constructor(private ngZone: NgZone) {}
  // State management
  isLoading = true;
  error: string | null = null;
  profile: AdaptyProfile | null = null;
  paywall: AdaptyPaywall | null = null;
  selectedRecipe: Recipe | null = null;

  // Recipe data
  recipes = recipes;

  // Initialize Adapty SDK on mount
  ngOnInit() {
    this.initializeAdapty();
  }

  // Initialize Adapty: activate, load profile, load paywall
  async initializeAdapty() {
    try {
      this.isLoading = true;
      this.error = null;

      // Step 1: Activate SDK
      await adapty.activate({
        apiKey: getApiKey(),
        params: {
          // Prevent SDK re-activation on fast refresh during development
          __ignoreActivationOnFastRefresh: true,
        },
      });

      // Step 2: Get user profile
      const userProfile = await adapty.getProfile();
      this.profile = userProfile;

      // Step 3: Load paywall
      const paywallData = await adapty.getPaywall({
        placementId: getPlacementId(),
      });
      this.paywall = paywallData;

      this.isLoading = false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Adapty SDK';
      this.error = errorMessage;
      this.isLoading = false;
    }
  }

  // Check if user has premium access
  get isPremiumActive(): boolean {
    return this.profile?.accessLevels?.['premium']?.isActive ?? false;
  }

  // Get free recipes
  get freeRecipes(): Recipe[] {
    return this.recipes.filter((recipe) => !recipe.isPremium);
  }

  // Get premium recipes
  get premiumRecipes(): Recipe[] {
    return this.recipes.filter((recipe) => recipe.isPremium);
  }

  // Handle recipe click
  async handleRecipeClick(recipe: Recipe) {
    // If recipe is not premium or user has premium access, show details
    const isRecipeFree = !recipe.isPremium;
    if (isRecipeFree || this.isPremiumActive) {
      this.selectedRecipe = recipe;
      return;
    }

    // Otherwise, show paywall
    await this.showPaywall();
  }

  // Show paywall using Paywall Builder
  async showPaywall() {
    if (!this.paywall) {
      this.error = 'Paywall not loaded. Please try again.';
      return;
    }

    if (!this.paywall.hasViewConfiguration) {
      this.error = 'Paywall does not have Paywall Builder configuration.';
      return;
    }

    try {
      // Create paywall view
      const view = await createPaywallView(this.paywall);

      // Set up event handlers
      await view.setEventHandlers({
        onPurchaseCompleted: (purchaseResult, _product) => {
          // Purchase completed successfully
          if (purchaseResult.type === 'success') {
            // Update profile to reflect new access level
            this.ngZone.run(() => {
              this.profile = purchaseResult.profile;
            });
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
      this.error = errorMessage;
    }
  }

  // Go back from recipe detail view
  handleBack() {
    this.selectedRecipe = null;
  }
}
