import { Component, OnInit, NgZone } from '@angular/core';
import { adapty, createFlowView, AdaptyProfile, AdaptyFlow } from '@adapty/capacitor';
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
  flow: AdaptyFlow | null = null;
  selectedRecipe: Recipe | null = null;

  // Recipe data
  recipes = recipes;

  // Initialize Adapty SDK on mount
  ngOnInit() {
    this.initializeAdapty();
  }

  // Initialize Adapty: activate, load profile, load flow
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

      // Step 3: Load flow
      const flowData = await adapty.getFlow({
        placementId: getPlacementId(),
      });
      this.flow = flowData;

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

    // Otherwise, present the flow (paywall)
    await this.showFlow();
  }

  // Present the flow (paywall) using the Adapty Flow Builder
  async showFlow() {
    if (!this.flow) {
      this.error = 'Flow not loaded. Please try again.';
      return;
    }

    try {
      // Create the flow view. Throws if the flow has no view configuration.
      const view = await createFlowView(this.flow);

      // Set up event handlers
      await view.setEventHandlers({
        onPurchaseCompleted: (purchaseResult, _product) => {
          // Purchase completed successfully
          if (purchaseResult.type === 'success') {
            // Update profile (from a native callback) inside Angular's zone
            this.ngZone.run(() => {
              this.profile = purchaseResult.profile;
            });
            // Close the flow
            return true;
          }
          // Don't close for cancelled or pending purchases
          return false;
        },
      });

      // Present the flow
      await view.present();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to show flow';
      this.error = errorMessage;
    }
  }

  // Go back from recipe detail view
  handleBack() {
    this.selectedRecipe = null;
  }
}
